import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import vm from 'node:vm';
import {
  verifySafiPaySignature,
  createPaymentStore,
  createUpstashPaymentStore,
  processSafiPayWebhookPayload,
  defaultPaymentStore
} from '../lib/safipay.mjs';
import handler from '../api/index.mjs';

const TEST_SECRET = 'test_safipay_webhook_secret_123456';

function signV2(body, secret = TEST_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function makeReq({ method = 'POST', url = '/api/index?handler=safipay_webhook', query = { handler: 'safipay_webhook' }, headers = {}, body = '' }) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  const stream = Readable.from(buf.length ? [buf] : []);
  stream.method = method;
  stream.url = url;
  stream.query = query;
  stream.headers = headers;
  return stream;
}

function makeRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(k, v) { headers[k] = v; },
    end(raw) { this.body = raw ? JSON.parse(raw) : null; }
  };
}

test('verifySafiPaySignature valida HMAC-SHA256 V2 (t=...,v1=...) e rejeita timestamp expirado', () => {
  const payload = JSON.stringify({ event: 'pix.paid', data: { id: 'tx_1' } });
  const now = 1700000000;
  const header = signV2(payload, TEST_SECRET, now);
  assert.equal(verifySafiPaySignature(payload, header, TEST_SECRET, { nowSeconds: now }), true);
  assert.equal(verifySafiPaySignature(payload, header.toUpperCase(), TEST_SECRET, { nowSeconds: now }), true);
  assert.equal(verifySafiPaySignature(payload, `t=${now - 400},v1=${'0'.repeat(64)}`, TEST_SECRET, { nowSeconds: now }), false);
  assert.equal(verifySafiPaySignature(payload, signV2(payload, TEST_SECRET, now - 301), TEST_SECRET, { nowSeconds: now }), false);
  assert.equal(verifySafiPaySignature(payload, `t=${now},v1=${'0'.repeat(64)}`, TEST_SECRET, { nowSeconds: now }), false);
  assert.equal(verifySafiPaySignature(payload, '', TEST_SECRET, { nowSeconds: now }), false);
  assert.equal(verifySafiPaySignature(payload, header, '', { nowSeconds: now }), false);
});

test('testa estados de pagamento: aprovado, pendente, expirado e inválido', async () => {
  const store = createPaymentStore();

  // Pendente (pix.created e pix.paid com status pending)
  const pendingEvent = await processSafiPayWebhookPayload({ event: 'pix.created', data: { id: 'tx_pending_1', status: 'pending' } }, store);
  assert.equal(pendingEvent.statusCode, 200);
  assert.equal(pendingEvent.body.confirmed, false);
  assert.equal(await store.has('tx_pending_1'), false);

  const pendingPaid = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_pending_2', status: 'waiting_payment' } }, store);
  assert.equal(pendingPaid.statusCode, 200);
  assert.equal(pendingPaid.body.confirmed, false);
  assert.equal(await store.has('tx_pending_2'), false);

  // Expirado (pix.expired e pix.paid com status expired)
  const expiredEvent = await processSafiPayWebhookPayload({ event: 'pix.expired', data: { id: 'tx_exp_1', status: 'expired' } }, store);
  assert.equal(expiredEvent.statusCode, 200);
  assert.equal(expiredEvent.body.confirmed, false);
  assert.equal(await store.has('tx_exp_1'), false);

  const expiredPaid = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_exp_2', status: 'expired' } }, store);
  assert.equal(expiredPaid.statusCode, 200);
  assert.equal(expiredPaid.body.confirmed, false);
  assert.equal(await store.has('tx_exp_2'), false);

  // Inválido (sem ID ou ID trivial)
  const missingId = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: '12' } }, store);
  assert.equal(missingId.statusCode, 400);

  // Aprovado (pix.paid com status paid)
  const approved = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_ok_999', txid: 'e2e_ok_999', status: 'paid' } }, store);
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.body.confirmed, true);
  assert.equal(approved.body.duplicate, false);
  assert.equal(await store.has('tx_ok_999'), true);
  assert.equal(await store.has('e2e_ok_999'), true);

  // Duplicado (mesmo txid com outro id primário não duplica nem sobrescreve)
  const dupByAlias = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_ok_999', txid: 'e2e_ok_999', status: 'paid' } }, store);
  assert.equal(dupByAlias.statusCode, 200);
  assert.equal(dupByAlias.body.duplicate, true);
});

test('createUpstashPaymentStore usa SET NX atômico, detecta reutilização de alias e persiste entre instâncias', async () => {
  const redis = new Map();
  const makeClient = () => createUpstashPaymentStore({
    url: 'https://mock-upstash.upstash.io',
    token: 'mock-token',
    fetchImpl: async (url, opts) => {
      assert.equal(url, 'https://mock-upstash.upstash.io/pipeline');
      assert.equal(opts.headers.Authorization, 'Bearer mock-token');
      const cmds = JSON.parse(opts.body);
      const out = cmds.map(([cmd, key, val, ...rest]) => {
        if (cmd === 'PING') return { result: 'PONG' };
        if (cmd === 'GET') return { result: redis.get(key) ?? null };
        if (cmd === 'SET') {
          const isNx = rest.includes('NX');
          if (isNx && redis.has(key)) return { result: null };
          redis.set(key, val);
          return { result: 'OK' };
        }
        return { result: null };
      });
      return { ok: true, json: async () => out };
    }
  });

  // Instância A (webhook)
  const instanceA = makeClient();
  assert.equal(instanceA.isPersistent, true);
  assert.equal(await instanceA.ping(), true);

  const first = await instanceA.confirm('tx_redis_1', ['e2e_redis_1']);
  assert.equal(first.duplicate, false);

  // Instância B (outra função serverless lendo /api/payment/status)
  const instanceB = makeClient();
  assert.equal((await instanceB.get('e2e_redis_1'))?.confirmed, true);
  assert.equal((await instanceB.get('tx_redis_1'))?.transactionId, 'tx_redis_1');

  // Tentativa de reutilizar o alias e2e_redis_1 em outra transação é barrada como duplicada
  const reuse = await instanceB.confirm('tx_redis_2', ['e2e_redis_1']);
  assert.equal(reuse.duplicate, true);
  assert.equal(reuse.record.transactionId, 'tx_redis_1');
});

test('na Vercel sem Upstash configurado retorna 503 em vez de usar memória temporária', async () => {
  const prevVercel = process.env.VERCEL;
  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const prevSecret = process.env.SAFIPAY_WEBHOOK_SECRET;
  process.env.VERCEL = '1';
  process.env.SAFIPAY_WEBHOOK_SECRET = TEST_SECRET;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const raw = JSON.stringify({ event: 'pix.paid', data: { id: 'tx_no_kv' } });
    const res = makeRes();
    await handler(makeReq({ body: raw, headers: { 'X-SafiPay-Signature-V2': signV2(raw) } }), res);
    assert.equal(res.statusCode, 503);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevVercel;
    if (prevUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.SAFIPAY_WEBHOOK_SECRET; else process.env.SAFIPAY_WEBHOOK_SECRET = prevSecret;
  }
});

test('handler /api/webhooks/safipay rejeita assinatura inválida e confirma pix.paid válido sem vazar PII', async () => {
  const prevSecret = process.env.SAFIPAY_WEBHOOK_SECRET;
  process.env.SAFIPAY_WEBHOOK_SECRET = TEST_SECRET;
  defaultPaymentStore.clear();

  try {
    // Método GET não permitido
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes);
    assert.equal(getRes.statusCode, 405);

    // Assinatura inválida
    const rawInvalid = JSON.stringify({ event: 'pix.paid', data: { id: 'tx_invalid' } });
    const badRes = makeRes();
    await handler(makeReq({
      body: rawInvalid,
      headers: { 'x-safipay-signature-v2': 'f'.repeat(64) }
    }), badRes);
    assert.equal(badRes.statusCode, 401);
    assert.equal(await defaultPaymentStore.has('tx_invalid'), false);

    // Webhook válido pix.paid com formatação customizada (rawBody exato) e dados pessoais que NÃO devem vazar
    const rawValid = '{\n  "event": "pix.paid",\n  "data": {\n    "id": "tx_real_777",\n    "txid": "pix_e2e_777",\n    "status": "paid",\n    "customer": { "name": "João Silva", "email": "joao@example.com", "document": "12345678900" }\n  }\n}';
    const okRes = makeRes();
    await handler(makeReq({
      body: rawValid,
      headers: { 'X-SafiPay-Signature-V2': signV2(rawValid) }
    }), okRes);
    assert.equal(okRes.statusCode, 200);
    assert.equal(okRes.body.received, true);
    assert.equal(okRes.body.confirmed, true);
    assert.equal(okRes.body.duplicate, false);

    // Reenvio idempotente
    const dupRes = makeRes();
    await handler(makeReq({
      body: rawValid,
      headers: { 'x-safipay-signature-v2': signV2(rawValid) }
    }), dupRes);
    assert.equal(dupRes.statusCode, 200);
    assert.equal(dupRes.body.duplicate, true);

    // Consulta de status para transação não confirmada
    const unconfirmedRes = makeRes();
    await handler(makeReq({
      method: 'GET',
      url: '/api/index?handler=payment_status&id=tx_nao_existe',
      query: { handler: 'payment_status', id: 'tx_nao_existe' }
    }), unconfirmedRes);
    assert.equal(unconfirmedRes.statusCode, 200);
    assert.equal(unconfirmedRes.body.confirmed, false);

    // Consulta de status para transação confirmada (sem PII e sem segredo)
    const confirmedRes = makeRes();
    await handler(makeReq({
      method: 'GET',
      url: '/api/index?handler=payment_status&id=tx_real_777',
      query: { handler: 'payment_status', id: 'tx_real_777' }
    }), confirmedRes);
    assert.equal(confirmedRes.statusCode, 200);
    assert.equal(confirmedRes.body.confirmed, true);
    assert.equal(confirmedRes.body.transactionId, 'tx_real_777');
    const serialized = JSON.stringify(confirmedRes.body);
    assert.equal(serialized.includes('joao@example.com'), false);
    assert.equal(serialized.includes('12345678900'), false);
    assert.equal(serialized.includes(TEST_SECRET), false);
  } finally {
    defaultPaymentStore.clear();
    if (prevSecret === undefined) delete process.env.SAFIPAY_WEBHOOK_SECRET;
    else process.env.SAFIPAY_WEBHOOK_SECRET = prevSecret;
  }
});

test('obrigado.html não exibe pagamento confirmado sem validação e registra Purchase apenas após confirmação real, em BRL e sem duplicidade', async () => {
  const html = readFileSync(new URL('../obrigado.html', import.meta.url), 'utf8');
  assert.equal(html.includes('<h1 id="heading">Pagamento confirmado!</h1>'), false);
  assert.equal(html.includes('/api/payment/status'), true);
  assert.equal(html.includes('exclusivamente informações públicas'), true);

  // Extrai o script de validação/rastreamento de obrigado.html e executa em sandbox isolada (sem enviar nada ao Pixel de produção)
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(scripts.length, 2);
  const trackingScript = scripts[1];

  function createStorage() {
    const map = new Map();
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v))
    };
  }

  function runObrigado({ search = '', fetchImpl, localStorage = createStorage(), sessionStorage = createStorage() }) {
    const fbqCalls = [];
    const elements = {
      heading: { textContent: '' },
      intro: { textContent: '' },
      'next-title': { textContent: '' },
      'next-text': { textContent: '' },
      'verify-form': { classList: { add() {}, remove() {} }, addEventListener() {} },
      'tx-input': { value: '' },
      'verify-btn': { disabled: false }
    };
    const fbq = (...args) => fbqCalls.push(args);
    const windowObj = {
      location: { search },
      localStorage,
      sessionStorage,
      fbq
    };
    const context = {
      window: windowObj,
      document: { getElementById: id => elements[id] },
      URLSearchParams,
      fetch: fetchImpl,
      fbq,
      setTimeout: (fn) => fn(),
      encodeURIComponent
    };
    vm.runInNewContext(trackingScript, context);
    return { fbqCalls, elements, localStorage, sessionStorage };
  }

  // 1. Acesso sem ID -> NÃO dispara Purchase
  const noId = runObrigado({
    search: '',
    fetchImpl: async () => { throw new Error('não deveria chamar fetch sem ID'); }
  });
  await new Promise(r => setTimeout(r, 10));
  assert.equal(noId.fbqCalls.length, 0);
  assert.equal(noId.elements.heading.textContent, 'Pagamento não confirmado');

  // 2. Acesso com ID pendente/não confirmado -> NÃO dispara Purchase
  const unconfirmed = runObrigado({
    search: '?id=tx_pending_sandbox',
    fetchImpl: async () => ({ ok: true, json: async () => ({ confirmed: false }) })
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(unconfirmed.fbqCalls.length, 0);
  assert.equal(unconfirmed.elements.heading.textContent, 'Pagamento não confirmado');

  // 3. Acesso com pagamento real confirmado -> dispara Purchase 1x com value em BRL e eventID
  const sharedLocalStorage = createStorage();
  const sharedSessionStorage = createStorage();
  const confirmed = runObrigado({
    search: '?id=tx_real_brl_47',
    localStorage: sharedLocalStorage,
    sessionStorage: sharedSessionStorage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ confirmed: true, transactionId: 'tx_real_brl_47', value: 47, currency: 'BRL' })
    })
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(confirmed.elements.heading.textContent, 'Pagamento confirmado!');
  assert.equal(confirmed.fbqCalls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(confirmed.fbqCalls[0])), [
    'track',
    'Purchase',
    { value: 47, currency: 'BRL' },
    { eventID: 'purchase_tx_real_brl_47' }
  ]);

  // 4. Refresh na página com o mesmo ID -> proteção contra duplicidade impede segundo Purchase
  const refreshed = runObrigado({
    search: '?id=tx_real_brl_47',
    localStorage: sharedLocalStorage,
    sessionStorage: sharedSessionStorage,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ confirmed: true, transactionId: 'tx_real_brl_47', value: 47, currency: 'BRL' })
    })
  });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(refreshed.elements.heading.textContent, 'Pagamento confirmado!');
  assert.equal(refreshed.fbqCalls.length, 0);
});

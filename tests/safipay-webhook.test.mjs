import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
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

test('processSafiPayWebhookPayload evita confirmações duplicadas e ignora outros eventos', async () => {
  const store = createPaymentStore();

  const created = await processSafiPayWebhookPayload({ event: 'pix.created', data: { id: 'tx_dup_1' } }, store);
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.confirmed, false);
  assert.equal(created.body.ignored, true);
  assert.equal(await store.has('tx_dup_1'), false);

  const first = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_dup_1', txid: 'e2e_999', status: 'paid' } }, store);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.confirmed, true);
  assert.equal(first.body.duplicate, false);
  assert.equal(await store.has('tx_dup_1'), true);
  assert.equal(await store.has('e2e_999'), true);

  const second = await processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_dup_1', txid: 'e2e_999', status: 'paid' } }, store);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.confirmed, true);
  assert.equal(second.body.duplicate, true);
});

test('createUpstashPaymentStore usa SET NX atômico e persiste aliases sem memória temporária', async () => {
  const redis = new Map();
  const mockFetch = async (url, opts) => {
    assert.equal(url, 'https://mock-upstash.upstash.io/pipeline');
    assert.equal(opts.headers.Authorization, 'Bearer mock-token');
    const cmds = JSON.parse(opts.body);
    const out = cmds.map(([cmd, key, val, ...rest]) => {
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
  };

  const store = createUpstashPaymentStore({
    url: 'https://mock-upstash.upstash.io',
    token: 'mock-token',
    fetchImpl: mockFetch
  });
  assert.equal(store.isPersistent, true);

  const first = await store.confirm('tx_redis_1', ['e2e_redis_1']);
  assert.equal(first.duplicate, false);
  assert.equal((await store.get('e2e_redis_1'))?.confirmed, true);

  const dup = await store.confirm('tx_redis_1', ['e2e_redis_1']);
  assert.equal(dup.duplicate, true);
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

test('obrigado.html não exibe pagamento confirmado sem validação e não contém Pixel', () => {
  const html = readFileSync(new URL('../obrigado.html', import.meta.url), 'utf8');
  assert.equal(html.includes('<h1 id="heading">Pagamento confirmado!</h1>'), false);
  assert.equal(html.includes('/api/payment/status'), true);
  assert.equal(html.includes('exclusivamente informações públicas'), true);
  assert.equal(/fbq\s*\(/i.test(html), false);
});

test('cta-ghost-final.js deixa explícito antes da compra que consulta somente informações públicas', () => {
  const cta = readFileSync(new URL('../assets/cta-ghost-final.js', import.meta.url), 'utf8');
  assert.equal(cta.includes('somente informações públicas'), true);
  assert.equal(cta.includes('Todas as mensagens do direct'), false);
  assert.equal(cta.includes('incluindo apagadas'), false);
});

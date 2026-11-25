import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import {
  verifySafiPaySignature,
  createPaymentStore,
  processSafiPayWebhookPayload,
  defaultPaymentStore
} from '../lib/safipay.mjs';
import handler from '../api/index.mjs';

const TEST_SECRET = 'test_safipay_webhook_secret_123456';

function sign(body, secret = TEST_SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex');
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

test('verifySafiPaySignature valida HMAC-SHA256 corretamente', () => {
  const payload = JSON.stringify({ event: 'pix.paid', data: { id: 'tx_1' } });
  const sig = sign(payload);
  assert.equal(verifySafiPaySignature(payload, sig, TEST_SECRET), true);
  assert.equal(verifySafiPaySignature(payload, `sha256=${sig.toUpperCase()}`, TEST_SECRET), true);
  assert.equal(verifySafiPaySignature(payload, '0'.repeat(64), TEST_SECRET), false);
  assert.equal(verifySafiPaySignature(payload, '', TEST_SECRET), false);
  assert.equal(verifySafiPaySignature(payload, sig, ''), false);
});

test('processSafiPayWebhookPayload evita confirmações duplicadas e ignora outros eventos', () => {
  const store = createPaymentStore({ persist: false });

  const created = processSafiPayWebhookPayload({ event: 'pix.created', data: { id: 'tx_dup_1' } }, store);
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.confirmed, false);
  assert.equal(created.body.ignored, true);
  assert.equal(store.has('tx_dup_1'), false);

  const first = processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_dup_1', txid: 'e2e_999', status: 'paid' } }, store);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.confirmed, true);
  assert.equal(first.body.duplicate, false);
  assert.equal(store.has('tx_dup_1'), true);
  assert.equal(store.has('e2e_999'), true);

  const second = processSafiPayWebhookPayload({ event: 'pix.paid', data: { id: 'tx_dup_1', txid: 'e2e_999', status: 'paid' } }, store);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.confirmed, true);
  assert.equal(second.body.duplicate, true);
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
    assert.equal(defaultPaymentStore.has('tx_invalid'), false);

    // Webhook válido pix.paid (com dados pessoais no payload que NÃO devem ser expostos)
    const rawValid = JSON.stringify({
      event: 'pix.paid',
      data: {
        id: 'tx_real_777',
        txid: 'pix_e2e_777',
        status: 'paid',
        customer: { name: 'João Silva', email: 'joao@example.com', document: '12345678900' }
      }
    });
    const okRes = makeRes();
    await handler(makeReq({
      body: rawValid,
      headers: { 'X-SafiPay-Signature-V2': sign(rawValid) }
    }), okRes);
    assert.equal(okRes.statusCode, 200);
    assert.equal(okRes.body.received, true);
    assert.equal(okRes.body.confirmed, true);
    assert.equal(okRes.body.duplicate, false);

    // Reenvio idempotente
    const dupRes = makeRes();
    await handler(makeReq({
      body: rawValid,
      headers: { 'x-safipay-signature-v2': sign(rawValid) }
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
  assert.equal(/fbq\s*\(/i.test(html), false);
});

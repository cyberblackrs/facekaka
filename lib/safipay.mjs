import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DEFAULT_STORE_FILE = '/tmp/safipay-confirmed-payments.json';
const MAX_IN_MEMORY_RECORDS = 5000;

/**
 * Lê o corpo bruto (Buffer) de uma requisição HTTP/serverless sem depender de body-parser externo.
 */
export async function readRawBody(req, maxBytes = 1048576) {
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody;
  if (typeof req?.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');

  if (req && typeof req[Symbol.asyncIterator] === 'function' && req.readableEnded !== true) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        const err = new Error('Payload muito grande.');
        err.status = 413;
        throw err;
      }
      chunks.push(buf);
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  }

  if (Buffer.isBuffer(req?.body)) return req.body;
  if (typeof req?.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req?.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body), 'utf8');
  return Buffer.alloc(0);
}

/**
 * Valida a assinatura HMAC-SHA256 do cabeçalho X-SafiPay-Signature-V2 (formato t=<unix>,v1=<hex>)
 * com janela de tolerância contra replay attacks e comparação em tempo constante.
 */
export function verifySafiPaySignature(rawBody, signatureHeader, secret, { toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret || typeof secret !== 'string') return false;
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;

  const parts = {};
  for (const segment of signatureHeader.split(',')) {
    const idx = segment.indexOf('=');
    if (idx <= 0) continue;
    const k = segment.slice(0, idx).trim().toLowerCase();
    const v = segment.slice(idx + 1).trim();
    if (k && v) parts[k] = v;
  }

  const timestampStr = parts.t;
  const providedHex = parts.v1 || parts.v2;
  if (!timestampStr || !providedHex) return false;
  if (!/^\d{9,12}$/.test(timestampStr)) return false;
  if (!/^[0-9a-f]{64}$/i.test(providedHex)) return false;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const signedPayload = Buffer.concat([Buffer.from(`${timestampStr}.`, 'utf8'), bodyBuf]);
  const expectedHex = createHmac('sha256', secret).update(signedPayload).digest('hex');

  const a = Buffer.from(providedHex.toLowerCase(), 'utf8');
  const b = Buffer.from(expectedHex.toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Extrai apenas identificadores técnicos e status do payload da SafiPay, sem armazenar dados pessoais.
 */
export function extractSafiPayEvent(payload) {
  const obj = payload && typeof payload === 'object' ? payload : {};
  const data = obj.data && typeof obj.data === 'object' ? obj.data : obj;
  const event = String(obj.event || obj.type || data.event || '').trim().toLowerCase();
  const status = String(data.status || obj.status || '').trim().toLowerCase();

  const rawCandidates = [
    data.id,
    data.transactionId,
    data.transaction_id,
    data.paymentId,
    data.payment_id,
    data.txid,
    data.endToEndId,
    data.end_to_end_id,
    data.externalId,
    data.external_id,
    data.orderId,
    data.order_id,
    data.reference,
    obj.transactionId,
    obj.transaction_id,
    obj.paymentId,
    obj.payment_id,
    obj.id
  ];

  const aliases = [];
  const seen = new Set();
  for (const candidate of rawCandidates) {
    if (candidate === undefined || candidate === null) continue;
    const val = String(candidate).trim();
    if (!val || val.length > 160 || seen.has(val)) continue;
    seen.add(val);
    aliases.push(val);
  }

  return {
    event,
    status,
    transactionId: aliases[0] || null,
    aliases
  };
}

/**
 * Cria um armazenamento idempotente de pagamentos confirmados (memória + fallback opcional em /tmp).
 */
export function createPaymentStore({ filePath = DEFAULT_STORE_FILE, persist = true } = {}) {
  const records = new Map();

  function hydrate() {
    if (!persist || !filePath) return;
    try {
      if (!existsSync(filePath)) return;
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && v.confirmed === true && v.transactionId) {
            records.set(k, v);
          }
        }
      }
    } catch {
      // Ignora erro de leitura em ambientes somente leitura
    }
  }

  function flush() {
    if (!persist || !filePath) return;
    try {
      const obj = Object.fromEntries(records.entries());
      writeFileSync(filePath, JSON.stringify(obj), 'utf8');
    } catch {
      // Ignora erro de escrita em ambientes somente leitura
    }
  }

  hydrate();

  return {
    has(id) {
      if (!id) return false;
      const key = String(id).trim();
      if (!key) return false;
      if (records.has(key)) return true;
      hydrate();
      return records.has(key);
    },
    get(id) {
      if (!id) return null;
      const key = String(id).trim();
      if (!key) return null;
      if (!records.has(key)) hydrate();
      return records.get(key) || null;
    },
    confirm(transactionId, aliases = []) {
      const keys = [transactionId, ...aliases]
        .map(v => String(v || '').trim())
        .filter(Boolean);
      const uniqueKeys = [...new Set(keys)];
      if (uniqueKeys.length === 0) return { duplicate: false, record: null };

      for (const k of uniqueKeys) {
        if (records.has(k)) {
          return { duplicate: true, record: records.get(k) };
        }
      }

      if (records.size >= MAX_IN_MEMORY_RECORDS) {
        records.clear();
      }

      const record = {
        confirmed: true,
        transactionId: uniqueKeys[0],
        event: 'pix.paid',
        confirmedAt: new Date().toISOString()
      };

      for (const k of uniqueKeys) {
        records.set(k, record);
      }
      flush();
      return { duplicate: false, record };
    },
    clear() {
      records.clear();
      flush();
    }
  };
}

export const defaultPaymentStore = createPaymentStore();

const DISALLOWED_STATUSES = new Set([
  'pending',
  'waiting_payment',
  'awaiting_payment',
  'created',
  'cancelled',
  'canceled',
  'refunded',
  'chargeback',
  'failed',
  'expired',
  'rejected'
]);

/**
 * Processa o evento JSON já verificado pela assinatura da SafiPay.
 */
export function processSafiPayWebhookPayload(payload, store = defaultPaymentStore) {
  const { event, status, transactionId, aliases } = extractSafiPayEvent(payload);

  if (event !== 'pix.paid') {
    return {
      statusCode: 200,
      body: { received: true, ignored: true, confirmed: false, event: event || null }
    };
  }

  if (status && DISALLOWED_STATUSES.has(status)) {
    return {
      statusCode: 200,
      body: { received: true, ignored: true, confirmed: false, reason: 'status_not_paid' }
    };
  }

  if (!transactionId) {
    return {
      statusCode: 400,
      body: { received: false, error: 'Identificador da transação ausente no evento pix.paid.' }
    };
  }

  const { duplicate, record } = store.confirm(transactionId, aliases);
  return {
    statusCode: 200,
    body: {
      received: true,
      confirmed: true,
      duplicate,
      transactionId: record.transactionId
    }
  };
}

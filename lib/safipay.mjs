import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_IN_MEMORY_RECORDS = 5000;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

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
 * Armazenamento em memória para desenvolvimento local e testes unitários.
 */
export function createPaymentStore() {
  const records = new Map();

  return {
    isPersistent: false,
    async has(id) {
      const key = String(id || '').trim();
      return Boolean(key && records.has(key));
    },
    async get(id) {
      const key = String(id || '').trim();
      if (!key) return null;
      return records.get(key) || null;
    },
    async confirm(transactionId, aliases = []) {
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
      return { duplicate: false, record };
    },
    async clear() {
      records.clear();
    }
  };
}

/**
 * Armazenamento persistente compartilhado via Upstash Redis REST API (compatível com Vercel Serverless).
 */
export function createUpstashPaymentStore({ url, token, fetchImpl = fetch, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const baseUrl = String(url || '').replace(/\/+$/, '');
  const prefix = 'safipay:tx:';

  async function pipeline(commands) {
    const res = await fetchImpl(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      const err = new Error(`Falha ao comunicar com Upstash Redis (HTTP ${res.status}).`);
      err.status = 502;
      throw err;
    }
    return await res.json();
  }

  return {
    isPersistent: true,
    async get(id) {
      const key = String(id || '').trim();
      if (!key) return null;
      const results = await pipeline([['GET', `${prefix}${key}`]]);
      const raw = results?.[0]?.result;
      if (!raw || typeof raw !== 'string') return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed?.confirmed === true ? parsed : null;
      } catch {
        return null;
      }
    },
    async has(id) {
      return Boolean(await this.get(id));
    },
    async confirm(transactionId, aliases = []) {
      const keys = [transactionId, ...aliases]
        .map(v => String(v || '').trim())
        .filter(Boolean);
      const uniqueKeys = [...new Set(keys)];
      if (uniqueKeys.length === 0) return { duplicate: false, record: null };

      const primaryKey = `${prefix}${uniqueKeys[0]}`;
      const record = {
        confirmed: true,
        transactionId: uniqueKeys[0],
        event: 'pix.paid',
        confirmedAt: new Date().toISOString()
      };
      const serialized = JSON.stringify(record);

      // Grava a chave primária atomicamente com NX para evitar confirmações duplicadas em concorrência
      const primaryRes = await pipeline([['SET', primaryKey, serialized, 'EX', String(ttlSeconds), 'NX']]);
      const created = primaryRes?.[0]?.result === 'OK';
      if (!created) {
        const existing = await this.get(uniqueKeys[0]);
        return { duplicate: true, record: existing || record };
      }

      if (uniqueKeys.length > 1) {
        const aliasCmds = uniqueKeys.slice(1).map(k => ['SET', `${prefix}${k}`, serialized, 'EX', String(ttlSeconds)]);
        await pipeline(aliasCmds);
      }

      return { duplicate: false, record };
    }
  };
}

export const defaultPaymentStore = createPaymentStore();

/**
 * Seleciona Upstash Redis quando configurado no ambiente; caso contrário, usa fallback em memória (local/testes).
 */
export function getActivePaymentStore(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) {
    return createUpstashPaymentStore({ url, token });
  }
  return defaultPaymentStore;
}

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
export async function processSafiPayWebhookPayload(payload, store = getActivePaymentStore()) {
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

  const { duplicate, record } = await store.confirm(transactionId, aliases);
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

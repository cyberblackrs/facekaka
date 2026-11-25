import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

test('seguranca.js bloqueia atalhos de DevTools, menu de contexto e silencia console', () => {
  const content = readFileSync(resolve(ROOT, 'seguranca.js'), 'utf8');
  // Silenciamento de console
  assert(content.includes('console'), 'deve referenciar console');
  assert(content.includes('noop'), 'deve definir noop');
  assert(content.includes('console.clear'), 'deve chamar console.clear');
  // Atalhos de desenvolvedor
  assert(content.includes('f12'), 'deve bloquear F12');
  assert(content.includes('contextmenu'), 'deve bloquear menu de contexto');
  assert(content.includes('preventDefault'), 'deve prevenir comportamento padrao');
  // Anti-debugging trap
  assert(content.includes('debugger'), 'deve conter anti-debug trap');
  // Bloqueio de senhas e checkouts indevidos mantido
  assert(content.includes('hancefy.com.br'), 'deve manter checkout hancefy liberado');
  assert(content.includes('safipaybr.com'), 'deve manter checkout safipay liberado');
});

test('index.html carrega seguranca.js no topo do head e nao possui comentarios expositivos de autoria', () => {
  const content = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert(content.includes('<script src="/seguranca.js"></script>'), 'deve carregar seguranca.js');
  assert(!content.includes('ai-copyright-guard'), 'nao deve conter div identificadora de copyright');
  assert(!content.includes('AVISO JURÍDICO EXPRESSO'), 'nao deve conter bloco expositivo de aviso juridico');
  assert(content.includes('oncontextmenu="return false;"'), 'body deve conter protecao contra contextmenu');
});

test('rotas.js foi neutralizado para nao expor mapa de rotas a invasores', () => {
  const content = readFileSync(resolve(ROOT, 'rotas.js'), 'utf8');
  assert(!content.includes('#gs-route-btn'), 'nao deve conter botao de rotas');
  assert(!content.includes('gs-route-panel'), 'nao deve conter menu de rotas');
});

test('vercel.json e dev-server.mjs configuram headers de seguranca e anonimato', () => {
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
  const headers = vercel.headers[0].headers;
  const headerKeys = headers.map(h => h.key);
  assert(headerKeys.includes('Referrer-Policy'), 'deve conter Referrer-Policy');
  assert(headerKeys.includes('X-Frame-Options'), 'deve conter X-Frame-Options');
  assert(headerKeys.includes('X-Content-Type-Options'), 'deve conter X-Content-Type-Options');
  const referrer = headers.find(h => h.key === 'Referrer-Policy');
  assert.equal(referrer.value, 'no-referrer', 'Referrer deve ser no-referrer para anonimato');
});

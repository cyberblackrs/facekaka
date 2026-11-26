/**
 * Testes das novas funcionalidades de chat:
 * - Cidade dinâmica (userCity) no chat 3
 * - Chats 6, 7 e 8 com mensagens borradas e histórico bloqueado
 * - Bloqueio de scroll na versão gratuita e liberação após pagamento (gs_msg_unlocked)
 * - Lista no Direct e rotas no dev-server / estado-navegacao / chat-nome
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatSrc = readFileSync(new URL('../assets/chat._chatId-B0W9ilwe.js', import.meta.url), 'utf8');
const directSrc = readFileSync(new URL('../assets/direct-CrUBYN4v.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../estado-navegacao.js', import.meta.url), 'utf8');
const chatNomeSrc = readFileSync(new URL('../chat-nome.js', import.meta.url), 'utf8');
const devServerSrc = readFileSync(new URL('../dev-server.mjs', import.meta.url), 'utf8');
const obrigadoSrc = readFileSync(new URL('../obrigado.html', import.meta.url), 'utf8');
const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('chat 3 usa dynamicType userCity com prefixo "Estou por "', () => {
  assert.match(chatSrc, /content:\s*"Estou por ",\s*\n\s*dynamicType:\s*"userCity"/);
  assert.match(chatSrc, /t\.dynamicType === "userCity"/);
  assert.match(chatSrc, /localStorage\.getItem\("user_city"\)/);
  assert.match(chatSrc, /window\.addEventListener\("gs:city",\s*onCity\)/);
});

test('chats 6 a 13 existem em Ue e ct com mensagens borradas e sem trava no scroll', () => {
  for (const id of [6, 7, 8, 9, 10, 11, 12, 13]) {
    assert.match(chatSrc, new RegExp(`sessionKey:\\s*"chat-${id}"`), `chat-${id} deve existir em Ue`);
    assert.match(chatSrc, new RegExp(`\\n\\s*${id}:\\s*\\[\\s*\\n\\s*\\{\\s*id:\\s*"bh1"`), `ct[${id}] deve ter histórico borrado`);
  }
  assert.match(chatSrc, /blurredContent:/);
  assert.match(chatSrc, /requestAnimationFrame/);
  assert.doesNotMatch(indexSrc, /new MutationObserver/);
});

test('scroll para cima é bloqueado na versão grátis e liberado com gs_msg_unlocked', () => {
  assert.match(chatSrc, /localStorage\.getItem\("gs_msg_unlocked"\)\s*===\s*"1"/);
  assert.match(chatSrc, /action:\s*s\.chat\.viewFullHistory/);
  assert.match(chatSrc, /f\.current\s*=\s*!1/);
});

test('direct-CrUBYN4v.js lista chats 6 a 13 e evita colisão nos locked', () => {
  for (const id of [6, 7, 8, 9, 10, 11, 12, 13]) {
    assert.match(directSrc, new RegExp(`chatIndex:\\s*${id}`));
  }
  assert.match(directSrc, /m\s*=\s*t\.slice\(10\)/);
});

test('rotas e helpers suportam chats 1 a 13', () => {
  assert.match(navSrc, /k<=13/);
  assert.match(chatNomeSrc, /1\[0-3\]/);
  assert.match(devServerSrc, /1\[0-3\]/);
});

test('pagamento confirmado seta gs_msg_unlocked e index.html remove .blur-word', () => {
  assert.match(obrigadoSrc, /localStorage\.setItem\('gs_msg_unlocked',\s*'1'\)/);
  assert.match(indexSrc, /localStorage\.getItem\('gs_msg_unlocked'\)\s*===\s*'1'/);
  assert.match(indexSrc, /\.blur-word\{display:none!important\}/);
});

test('botão Ajuda aparece apenas após pagamento e sem termos de prévia/demo', () => {
  assert.match(indexSrc, /id\s*=\s*'gs-ajuda-btn'/);
  assert.match(indexSrc, /localStorage\.getItem\('gs_msg_unlocked'\)\s*!==\s*'1'/);
  assert.match(indexSrc, /Estamos corrigindo alguns bugs no nosso site e já já vamos liberar mais funcionalidades/);
  assert.doesNotMatch(indexSrc, /gs-ajuda-modal[\s\S]*(?:prévia|previa|demo)/i);
});

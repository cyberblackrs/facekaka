import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=(file)=>readFileSync(new URL(file,root),'utf8');
const css=read('assets/root-zQuPsh3d.css');
const feed=read('assets/feed-CMXMV7Sa.js');
const html=read('index.html');
const server=read('dev-server.mjs');

test('Tema escuro do Work preservado em Feed, Direct, Chat e Notificações',()=>{
  assert.match(css,/body:has\(\.fd-screen, \.dm-screen, \.chat-area, \.notif-page\)/);
  assert.match(css, /--ig-bg:#0c1014/);
  assert.match(css,/\.fd-header/);
  assert.match(css,/\.dm-header/);
});
test('Feed usa o SVG oficial fornecido, sem o texto GhostSpy no cabeçalho',()=>{
  assert.match(feed, /fd-instagram-wordmark/);
  assert.match(feed,/assets-local\/instagram-wordmark\.svg/);
  assert.doesNotMatch(feed,/className: "fd-wordmark", children: "GhostSpy"/);
  assert.match(feed,/fd-post-author/);
  const svg=read('assets-local/instagram-wordmark.svg');
  assert.match(svg,/viewBox="0 0 600 150"/);
  assert.match(svg,/<title>Instagram<\/title>/);
  assert.match(server,/image\/svg\+xml/);
});
test('Feed não exibe menu inferior e mantém o aviso existente no rodapé',()=>{
  assert.match(css,/\.fd-screen \.fd-bottom-nav \{ display:none!important; \}/);
  assert.match(css,/\.fd-screen \.ig-preview-banner[\s\S]*?z-index:2000!important/);
  assert.match(feed,/e\.jsx\(Me, \{ onGoToCTA: ue, bottomPosition: "1px" \}\)/);
});
test('Direct deixa Pedidos com azul de Instagram e peso levemente maior',()=>{
  const direct=read('assets/direct-CrUBYN4v.js');
  assert.match(direct,/dm-pedidos-link/);
  assert.match(css,/\.dm-screen \.dm-pedidos-link[\s\S]*?#3797f0!important/);
  assert.match(css,/font-weight:600!important/);
});
test('Stories ilustrativos continuam locais sem gastar APIs',()=>{
  const notes=read('notas-publicas.js');
  assert.match(notes,/assets-local\/notes/);
  assert.doesNotMatch(notes,/\bfetch\(/);
  assert.match(html,/root-zQuPsh3d\.css/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
test('faixa de Notas clona o design original e adiciona 8 rostos desfocados',()=>{
 const html=read('index.html'),js=read('notas-publicas.js'),server=read('dev-server.mjs');
 assert.ok(html.includes('<script src="/notas-publicas.js"></script>'));
 assert.match(js,/storiesContainer/);
 assert.match(js,/cloneNode\(true\)/);
 assert.match(js,/gs-visual-note/);
 assert.match(js,/gs-note-foto/);
 assert.match(js,/filter:blur/);
 assert.doesNotMatch(js,/Nenhuma conta carregada/);
 assert.doesNotMatch(js,/Contas seguidas \(perfis públicos\)/);
 for(let i=1;i<=8;i++){
  const f=`assets-local/notes/pessoa-${String(i).padStart(2,'0')}.jpg`;
  assert.ok(js.includes('/'+f));
  assert.ok(server.includes("'"+f+"'"));
  assert.ok(statSync(new URL(f,root)).size>1000);
 }
});
test('notas ilustrativas não fazem consultas nem consomem HikerAPI ao entrar no Direct',()=>{
 const js=read('notas-publicas.js');
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 assert.doesNotMatch(js,/x-access-key|X-RapidAPI-Key/);
 const sync=read('atualizar-seguidos.js');
 assert.match(sync,/Notas meramente visuais/);
 const api=read('api/index.mjs');
 assert.match(api,/getFollowingImpl:async\(\)=>\[\]/);
 assert.match(api,/mode:'visual_placeholder'/);
});

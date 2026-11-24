import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
test('Sua nota usa foto salva do perfil público pesquisado, sem chamar APIs',()=>{
 const s=read('notas-publicas.js');assert.match(s,/activeProfile\(/);assert.match(s,/updateOwnPhoto\(/);
 assert.match(s,/profile_pic_url/);assert.match(s,/profile_pic_original_url/);
 assert.match(s,/gs:public-data/);assert.doesNotMatch(s,/\bfetch\s*\(/);
});
test('Notas ficam legíveis no tema escuro e sem degradê lateral',()=>{
 const s=read('notas-publicas.js'), css=read('assets/root-zQuPsh3d.css');
 assert.match(css,/\.dm-screen #gs-notas-borradas p \{color:#a8a8a8!important;\}/);
 assert.match(s,/removeRightShade\(/);assert.match(s,/mask-image:none!important/);
 assert.match(s,/gs-note-own-photo/);
 assert.match(s,/filter:blur\(5px\)!important/);
 assert.match(s,/gs-note-own-photo\{filter:none!important;\}/);
 const stories=read('instagram-dark-ui.js');
 assert.match(stories,/\.gs-ig-story:not\(:first-child\) img\{filter:blur\(\.8px\)!important;\}/);
 assert.match(stories,/\.gs-ig-story-ring img\{[^}]*border:3px solid \$\{BG\}!important/);
 assert.match(css,/\.fd-story-portrait-image \{[^}]*border:3px solid var\(--ig-bg\);[^}]*filter:blur\(\.8px\);/);
 assert.doesNotMatch(stories,/gs-note-own-photo\{filter:none/);
});
test('frase ilustrativa A adivinha recebe nome do perfil, sem DM real',()=>{
 const s=read('chat-nome.js');assert.match(s,/firstName\(/);assert.match(s,/full_name/);
 assert.match(s,/adivinha o que vc esqueceu aqui/);assert.doesNotMatch(s,/\bfetch\s*\(/);
 assert.ok(read('index.html').includes('<script src="/chat-nome.js"></script>'));
 assert.ok(read('dev-server.mjs').includes("'chat-nome.js'"));
});

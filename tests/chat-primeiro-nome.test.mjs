import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {URL} from 'node:url';
const source=readFileSync(new URL('../chat-nome.js',import.meta.url),'utf8');
function simulate({user='ssupedro',fullName='Pedro Henrique',message='A adivinha o que vc esqueceu aqui? kkkk',cacheName=null,wrongProfile=false}={}){
 const store=new Map([
  ['espionado_username',user],
  ['instagram_profile',JSON.stringify({username:wrongProfile?'outro':user,full_name:fullName})],
 ]);
 if(cacheName)store.set('gs_profile_cache_v88_'+user,JSON.stringify({saved:Date.now(),data:{username:user,full_name:cacheName}}));
 const node={nodeValue:message,parentElement:{tagName:'DIV'}};
 const events={};
 const document={body:{},readyState:'complete',createTreeWalker(){let once=false;return {nextNode(){if(once)return null;once=true;return node}}},addEventListener(k,cb){events[k]=cb}};
 const context={URL,window:{addEventListener(k,cb){events[k]=cb}},document,location:new URL('http://127.0.0.1/chat/1?username='+user),localStorage:{getItem(k){return store.get(k)||null}},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}},requestAnimationFrame(cb){cb()}};
 vm.runInNewContext(source,context);
 return {node,store,events};
}
test('nome Pedro Henrique com @ssupedro vira somente Pedro',()=>{
 assert.equal(simulate().node.nodeValue,'Pedro, adivinha o que vc esqueceu aqui? kkkk');
});
test('substitui nome de usuário antigo na frase quando nome de exibição aparece',()=>{
 assert.equal(simulate({message:'ssupedro, adivinha o que vc esqueceu aqui? kkkk'}).node.nodeValue,'Pedro, adivinha o que vc esqueceu aqui? kkkk');
});
test('aceita nomes acentuados e nomes com emoji antes',()=>{
 assert.equal(simulate({user:'josezinha',fullName:'🌻 José de Souza'}).node.nodeValue,'José, adivinha o que vc esqueceu aqui? kkkk');
});
test('não usa nome do perfil anterior quando o @ consultado muda; prefere cache do @ correto',()=>{
 assert.equal(simulate({wrongProfile:true,cacheName:'Pedro Henrique'}).node.nodeValue,'Pedro, adivinha o que vc esqueceu aqui? kkkk');
});
test('sem full_name não chama pelo @; melhora quando dados chegarem',()=>{
 const s=simulate({fullName:''});assert.equal(s.node.nodeValue,'Ei, adivinha o que vc esqueceu aqui? kkkk');
 s.store.set('instagram_profile',JSON.stringify({username:'ssupedro',full_name:'Pedro Henrique'}));
 s.events['gs:public-data']();
 assert.equal(s.node.nodeValue,'Pedro, adivinha o que vc esqueceu aqui? kkkk');
});
test('ignora textos sem relação com o balão e nunca faz fetch',()=>{
 assert.equal(simulate({message:'A mensagem que está no site'}).node.nodeValue,'A mensagem que está no site');
 assert.doesNotMatch(source,/\bfetch\s*\(/);
});

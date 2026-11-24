import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../estado-navegacao.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function storage(){
 const mem=new Map();return {
  getItem(k){return mem.has(k)?mem.get(k):null},
  setItem(k,v){mem.set(k,String(v))},
  removeItem(k){mem.delete(k)}
 };
}
function visit(path,seed={}){
 const localStorage=storage(),sessionStorage=storage();
 for(const [key,value] of Object.entries(seed))localStorage.setItem(key,value);
 const navigations=[];
 const context={window:{},location:{pathname:path,href:`http://example.local${path}`},history:{state:null,replaceState(...a){navigations.push(a)}},localStorage,sessionStorage,URL,console};
 runInNewContext(source,context);
 return {localStorage,sessionStorage,navigations};
}
test('a home não cria um perfil fictício automaticamente',()=>{
 const {localStorage}=visit('/');assert.equal(localStorage.getItem('instagram_profile'),null);
});
test('as páginas de conversa continuam navegáveis mesmo antes da consulta',()=>{
 const {sessionStorage,localStorage}=visit('/chat/1');
 assert.equal(sessionStorage.getItem('chat-1-user-name'),'Fer*****');
 assert.ok(localStorage.getItem('instagram_profile'));
});
test('o perfil retornado da RapidAPI continua disponível em Direct e feed',()=>{
 const real={username:'ssupedro',pk:'123',source:'rapidapi'};
 const {localStorage,navigations}=visit('/direct',{'gs_last_rapidapi_profile':JSON.stringify(real)});
 assert.equal(JSON.parse(localStorage.getItem('instagram_profile')).username,'ssupedro');
 assert.equal(localStorage.getItem('espionado_username'),'ssupedro');
 assert.ok(navigations.length>0);
});
test('o HTML não injeta alertas sobre a interface ou as conversas',()=>{
 assert.equal(index.includes('safe-visual-banner'),false);
 assert.equal(index.includes('safe-disabled-login'),false);
 assert.equal(index.includes('estado-demo.js'),false);
 assert.ok(index.includes('/estado-navegacao.js'));
});

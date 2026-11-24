import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../atualizar-seguidos.js',import.meta.url),'utf8');
function storage(seed={}){
 const mem=new Map(Object.entries(seed));
 return {getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
}
function install({path='/direct',user='perfil.publico',body={users:[{username:'amigo.real',profile_pic_url:'https://example.org/amigo.jpg'}]},status=200,already=false}={}){
 const localStorage=storage({
  instagram_profile:JSON.stringify({username:user,is_private:false}),
  espionado_username:user,
  ...(already?{[`chaining_results_${user}`]:JSON.stringify([{username:'cached'}])}:{})
 });
 const sessionStorage=storage();
 const calls=[],reloads=[]; const listeners={};
 const location={pathname:path,href:'http://127.0.0.1:5173'+path+'?username='+user,reload:()=>reloads.push('yes')};
 const win={
  fetch:async url=>{calls.push(url);return {ok:status===200,status,json:async()=>body}},
  gsSaveFollowing:(username,users)=>{
   localStorage.setItem(`chaining_results_${username}`,JSON.stringify(users));
   localStorage.setItem('chaining_results',JSON.stringify(users));
   localStorage.setItem('gs_people_owner',username);
  },
  addEventListener:(k,cb)=>{listeners[k]=cb}
 };
 const context={window:win,fetch:win.fetch,localStorage,sessionStorage,location,document:{readyState:'complete'},history:{pushState(){},replaceState(){}},URL,Date,console,setTimeout};
 vm.runInNewContext(source,context);
 return {localStorage,sessionStorage,calls,reloads,listeners,location};
}
const sleep=n=>new Promise(r=>setTimeout(r,n));
test('Notas ilustrativas não consultam following automaticamente no Direct',async()=>{
 const app=install();await sleep(320);
 assert.equal(app.calls.length,0);
 assert.equal(app.localStorage.getItem('chaining_results'),null);
 assert.equal(app.reloads.length,0);
});
test('não gasta requisições na home e não repete consulta se cache está válido',async()=>{
 const home=install({path:'/'}),cached=install({already:true});await sleep(220);
 assert.equal(home.calls.length,0);assert.equal(cached.calls.length,0);
});
test('modo ilustrativo ignora API de following e não consome crédito mesmo quando serviço daria erro',async()=>{
 const a=install({status:403,body:{error:'Plano sem permissão'}});await sleep(250);
 assert.equal(a.calls.length,0);assert.equal(a.reloads.length,0);
 assert.equal(a.localStorage.getItem('gs_following_status_perfil.publico'),null);
});
test('um perfil privado não inicia busca de contas seguidas',async()=>{
 const a=install();a.localStorage.setItem('instagram_profile',JSON.stringify({username:'perfil.publico',is_private:true}));
 // Evento de rota futuro lê o novo estado privado.
 a.listeners.popstate();await sleep(200);
 assert.equal(a.calls.length,0);
});

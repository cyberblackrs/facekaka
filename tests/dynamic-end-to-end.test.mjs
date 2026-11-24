import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import handler from '../api/index.mjs';
import {HOST,SOCIAL_HOST} from '../lib/rapidapi.mjs';

const ids={'teste.publico':'12345','outra.conta':'98765'};
const calls=[];
const fakeFetch=async(url,options)=>{
  calls.push({host:url.hostname,path:url.pathname,query:Object.fromEntries(url.searchParams)});
  assert.equal(options.headers['X-RapidAPI-Key'],'fixture-secret');
  assert.equal(options.headers['X-RapidAPI-Host'],url.hostname);
  if(url.hostname===HOST && url.pathname==='/v1/user'){
    const username=url.searchParams.get('username');
    return {ok:true,json:async()=>({username,id:ids[username],is_private:false,profile_pic_url:'https://images.example/p.jpg'})};
  }
  if(url.hostname===HOST && url.pathname==='/v1/user/posts'){
    return {ok:true,json:async()=>({items:[{id:'p',thumbnail_url:'https://images.example/post.jpg',caption:'hello'}]})};
  }
  if(url.hostname===SOCIAL_HOST && url.pathname==='/g2/user/following'){
    const id=url.searchParams.get('user_id');
    assert.ok(Object.values(ids).includes(id));
    assert.equal(url.searchParams.has('username'),false);
    return {ok:true,json:async()=>({response:{users:[
      {pk:id+'1',username:'contato.'+id,full_name:'Contato Real',profile_pic_url:'https://images.example/'+id+'.jpg'}
    ]}})};
  }
  throw Error('unexpected route: '+url);
};

async function query(username){
  const headers={};const res={statusCode:200,setHeader(k,v){headers[k]=v},end(s){this.body=JSON.parse(s)}};
  await handler({method:'GET',url:'/api/proxy/instagram.php?tipo=busca_completa&username='+username,
    headers:{'x-forwarded-for':'203.0.113.7'},query:{handler:'instagram',tipo:'busca_completa',username}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.ok(!JSON.stringify(res.body).includes('fixture-secret'));
  return res.body;
}

test('busca de múltiplos @ carrega perfil e posts sem gastar créditos de following',async()=>{
  const old=globalThis.fetch;
  const oldKey=process.env.RAPIDAPI_KEY;
  globalThis.fetch=fakeFetch;process.env.RAPIDAPI_KEY='fixture-secret';
  try{
    const a=await query('teste.publico');
    const b=await query('outra.conta');
    assert.equal(a.username,'teste.publico');
    assert.equal(b.username,'outra.conta');
    assert.equal(a.chaining_results.length,0);
    assert.equal(b.chaining_results.length,0);
    assert.equal(a.posts.length,1);
    assert.equal(b.posts.length,1);
    assert.ok(!calls.some(c=>c.host===SOCIAL_HOST&&c.query.user_id==='12345'));
    assert.ok(!calls.some(c=>c.host===SOCIAL_HOST&&c.query.user_id==='98765'));
  }finally{
    globalThis.fetch=old;
    if(oldKey===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=oldKey;
  }
});

test('ponte do navegador salva as contas para o Feed e Direct',async()=>{
 const code=readFileSync(new URL('../consulta-rapidapi.js',import.meta.url),'utf8');
 const data={username:'teste.publico',source:'rapidapi',pk:'12345',chaining_results:[{username:'contato.12345',profile_pic_url:'https://images.example/12345.jpg'}],posts:[{id:'p1'}]};
 const kv=new Map();
 const localStorage={getItem(k){return kv.get(k)??null},setItem(k,v){kv.set(k,v)},removeItem(k){kv.delete(k)}};
 const win={fetch:async()=>({ok:true,clone:()=>({json:async()=>data})}),dispatchEvent:()=>{}};
 class CustomEvent{constructor(name,{detail}){this.type=name;this.detail=detail}}
 const ctx={window:win,localStorage,location:{href:'https://domain.test/',origin:'https://domain.test'},URL,CustomEvent};
 vm.runInNewContext(code,ctx);
 await win.fetch('/api/proxy/instagram.php?tipo=busca_completa&username=teste.publico');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(JSON.parse(kv.get('chaining_results'))[0].username,'contato.12345');
 assert.equal(JSON.parse(kv.get('instagram_followers'))[0].username,'contato.12345');
 assert.equal(JSON.parse(kv.get('instagram_posts_teste.publico')).length,1);
});

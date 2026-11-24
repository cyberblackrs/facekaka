import test from 'node:test';
import assert from 'node:assert/strict';
import {getFollowing, requestHiker, HIKER_HOST, SOCIAL_HOST, resetProviderState} from '../lib/rapidapi.mjs';
import handler from '../api/index.mjs';
const TOKEN='fixture-hiker-token-never-real';
const rapidKey='fixture-rapid-key-never-real';
const response=(json,status=200)=>({ok:status>=200&&status<300,status,headers:{get:()=>null},json:async()=>json});

test('HikerAPI: x-access-key apenas no backend; uma página e ID dinâmico, zero RapidAPI',async()=>{
 const requests=[];
 const following=await getFollowing('danxelly','9057805302',{
  hikerKey:TOKEN,expectedCount:998,
  hikerFetchImpl:async(url,init)=>{
   requests.push({url,init});
   assert.equal(url.hostname,HIKER_HOST);
   assert.equal(url.pathname,'/g2/user/following');
   assert.equal(url.searchParams.get('user_id'),'9057805302');
   assert.equal(url.searchParams.has('page_id'),false);
   assert.equal(init.headers['x-access-key'],TOKEN);
   assert.equal(init.headers['X-RapidAPI-Key'],undefined);
   return response({response:{users:[{username:'amigo.publico',pk:'123',full_name:'Amigo',profile_pic_url:'https://example.org/a.jpg'}]},next_page_id:'NEXT_PAGE_NOT_FETCHED'});
  },
  key:rapidKey,
  fetchImpl:()=>{throw Error('RapidAPI não deveria ser chamada');}
 });
 assert.equal(following.length,1);
 assert.equal(following[0].username,'amigo.publico');
 assert.equal(requests.length,1);
 assert.ok(!JSON.stringify(following).includes(TOKEN));
});

test('HikerAPI: erro simulado passa ao segundo fornecedor, sem repetição da HikerAPI',async()=>{
 let hiker=0, rapid=0, selected='';
 const people=await getFollowing('perfil.teste','8822',{
  hikerKey:TOKEN,expectedCount:12,
  hikerFetchImpl:async()=>{hiker++;return response({detail:'rate limit exceeded'},429)},
  fetchImpl:async url=>{rapid++;assert.equal(url.hostname,SOCIAL_HOST);return response({response:{users:[{username:'alternativa.real'}]}})},
  key:rapidKey,
  onProvider:provider=>selected=provider
 });
 assert.equal(hiker,1);assert.equal(rapid,1);
 assert.equal(people[0].username,'alternativa.real');assert.equal(selected,'rapidapi');
});

test('HikerAPI: se ambas retornam zero, mostra falha em vez de inventar perfis',async()=>{
 await assert.rejects(getFollowing('perfil.vazio','9988',{
  hikerKey:TOKEN,expectedCount:998,
  hikerFetchImpl:async()=>response({response:{users:[]}}),
  fetchImpl:async()=>response({response:{users:[]}}),key:rapidKey
 }),e=>{
  assert.equal(e.origin,'provider_empty');
  assert.equal(e.status,502);
  assert.equal(e.providerFailures.length,2);
  assert.equal(e.responseShape.list_length,0);
  return true;
 });
});

test('Integração HTTP: usando o perfil pesquisado escolhe HikerAPI, cacheia e não revela token',async()=>{
 const oldH=process.env.HIKERAPI_KEY,oldR=process.env.RAPIDAPI_KEY,oldFetch=globalThis.fetch;
 let profileCalls=0,hikerCalls=0,rapidSocialCalls=0;
 process.env.HIKERAPI_KEY=TOKEN;process.env.RAPIDAPI_KEY=rapidKey;
 resetProviderState();
 globalThis.fetch=async(url,init)=>{
  if(url.pathname==='/v1/user'){
   profileCalls++;assert.equal(url.searchParams.get('username'),'hiker.v85test');
   return response({id:'12341234',pk:'12341234',username:'hiker.v85test',following_count:45,is_private:false});
  }
  if(url.hostname===HIKER_HOST){
   hikerCalls++;
   assert.equal(url.searchParams.get('user_id'),'12341234');
   assert.equal(init.headers['x-access-key'],TOKEN);
   return response({response:{users:[{username:'real.um',profile_pic_url:'https://example.org/u.jpg'}]}});
  }
  if(url.hostname===SOCIAL_HOST){rapidSocialCalls++;throw Error('Não deveria consultar RapidAPI social');}
  throw Error('Rota não esperada nos testes '+url);
 };
 const call=async(kind,username)=>{
  const req={method:'GET',url:`/api/${kind}?username=${username}`,query:{handler:kind,username},headers:{},socket:{remoteAddress:'127.0.0.1'}};
  const res={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body)}};
  await handler(req,res);return res;
 };
 try{
  const health=await call('health','hiker.v85test');
  assert.equal(health.body.version,'8.12.2');assert.equal(health.body.hiker_configured,true);
  assert.equal(hikerCalls,0,'health não deve consumir crédito');
  const a=await call('following','hiker.v85test');
  assert.equal(a.statusCode,200);assert.equal(a.body.users.length,1);
  assert.equal(a.body.source,'hikerapi');
  assert.equal(profileCalls,1);assert.equal(hikerCalls,1);assert.equal(rapidSocialCalls,0);
  const b=await call('following','hiker.v85test');
  assert.equal(b.statusCode,200);assert.equal(hikerCalls,1,'a segunda consulta precisa vir do cache');
  const diag=await call('diagnostics','hiker.v85test');
  assert.equal(diag.statusCode,200);
  assert.equal(diag.body.following_check.provider,'hikerapi');
  assert.equal(diag.body.contas,1);
  for(const payload of [health.body,a.body,b.body,diag.body]){
   assert.ok(!JSON.stringify(payload).includes(TOKEN));
   assert.ok(!JSON.stringify(payload).includes(rapidKey));
  }
 }finally{
  globalThis.fetch=oldFetch;
  if(oldH===undefined)delete process.env.HIKERAPI_KEY;else process.env.HIKERAPI_KEY=oldH;
  if(oldR===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=oldR;
 }
});

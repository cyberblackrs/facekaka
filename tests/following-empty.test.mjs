import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePeople,getFollowing,describePeoplePayload,SOCIAL_HOST} from '../lib/rapidapi.mjs';
const key='fixture-test-only';
const response=value=>({ok:true,status:200,headers:{get:()=>null},json:async()=>value});
test('prefere lista populada mesmo se houver uma lista vazia antes',()=>{
  const data={data:{users:[]},response:{data:{following:{users:[{user:{username:'contato.1',pk:'11',profile_pic_url:'https://site.example/a.png'}}]}}}};
  const result=normalizePeople(data);
  assert.equal(result.length,1);assert.equal(result[0].username,'contato.1');
  const summary=describePeoplePayload(data);assert.equal(summary.list_length,1);
  assert.equal(summary.list_path,'root.response.data.following.users');
  assert.ok(!JSON.stringify(summary).includes('contato.1'));
});
test('se perfil segue 998 pessoas e fornecedor responde users:[], retorna erro explicito e sem cache de sucesso',async()=>{
  let calls=0;
  const fetchImpl=async url=>{calls++;assert.equal(url.hostname,SOCIAL_HOST);return response({response:{users:[]}})};
  await assert.rejects(getFollowing('danxelly','9057805302',{key,fetchImpl,expectedCount:998}),error=>{
    assert.equal(error.status,502);assert.equal(error.origin,'provider_empty');
    assert.match(error.message,/998/);assert.equal(error.responseShape.list_length,0);
    return true;
  });
  assert.equal(calls,1);
});
test('para perfil que realmente segue zero contas, lista vazia eh permitida',async()=>{
 const people=await getFollowing('semseguindo','998',{key,fetchImpl:async()=>response({response:{users:[]}}),expectedCount:0});
 assert.deepEqual(people,[]);
});
test('lista aninhada com node.user é normalizada',()=>{
 const data={data:{paging:{total:998},users:[{node:{user:{username:'pagina.real',full_name:'Publico'}}}]}};
 assert.equal(normalizePeople(data)[0].username,'pagina.real');
});

test('rota real não chama lista vazia de sucesso, e diagnósticos mostram motivo estrutural',async()=>{
 const {default:handler}=await import('../api/index.mjs');
 const old=globalThis.fetch,oldKey=process.env.RAPIDAPI_KEY;
 process.env.RAPIDAPI_KEY=key;
 const calls=[];
 globalThis.fetch=async url=>{
   calls.push(url.hostname+url.pathname);
   if(url.pathname==='/v1/user')return response({id:'9057805302',username:'perfil.vazio841',following_count:998,is_private:false});
   if(url.pathname==='/v1/user/posts')return response({items:[{id:'p1',thumbnail_url:'https://site.example/post.jpg'}]});
   if(url.pathname==='/g2/user/following')return response({response:{users:[]}});
   throw Error('unexpected '+url);
 };
 async function invoke(kind,extra=''){
   const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body)}};
   const url=`/api/${kind}?username=perfil.vazio841${extra}`;
   await handler({method:'GET',url,query:{handler:kind,username:'perfil.vazio841'},headers:{},socket:{remoteAddress:'192.0.2.59'}},res);
   return res;
 }
 try{
   const complete=await invoke('profile','&complete=1');
   // direct /following must return error when API has no list despite profile count 998.
   const following=await invoke('following');
   assert.equal(following.statusCode,502);
   assert.match(following.body.error,/998/);
   const diagnostic=await invoke('diagnostics');
   assert.equal(diagnostic.statusCode,200);
   assert.equal(diagnostic.body.contas,0);
   assert.equal(diagnostic.body.following_in_cache,false);
   assert.equal(diagnostic.body.following_check.status,'empty_unverified');
   assert.equal(diagnostic.body.following_check.response_shape.list_length,0);
   assert.equal(diagnostic.body.expected_following_count,998);
   assert.ok(!JSON.stringify(diagnostic.body).includes(key));
   assert.equal(calls.filter(x=>x.endsWith('/g2/user/following')).length,1);
 }finally{
   globalThis.fetch=old;
   if(oldKey===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=oldKey;
 }
});

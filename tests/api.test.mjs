import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, normalizeProfile, getProfile, getComplete, HOST } from '../lib/rapidapi.mjs';
import handler from '../api/index.mjs';

const result={id:'888',username:'ssupedro',full_name:'Pedro Henrique',biography:'software engineer',follower_count:120,following_count:30,media_count:11,profile_pic_url_hd:'https://example.org/avatar.png'};
function mockFetch(url,opts) {
  assert.equal(url.hostname,HOST);
  assert.equal(opts.headers['X-RapidAPI-Key'],'test-secret-api-key');
  assert.equal(opts.headers['X-RapidAPI-Host'],HOST);
  const path=url.pathname;
  if(path==='/v1/user') {
    assert.equal(url.searchParams.get('username'),'ssupedro');
    return Promise.resolve({ok:true,json:async()=>result});
  }
  if(path==='/v1/user/posts') {
    assert.equal(url.searchParams.get('user_id'),'888');
    return Promise.resolve({ok:true,json:async()=>({items:[{id:'post1',code:'abc',thumbnail_url:'https://example.org/post.jpg'}]})});
  }
  throw new Error('unexpected route');
}

test('host RapidAPI fixo',()=>assert.equal(HOST,'instagram-pro-and-cheap-api.p.rapidapi.com'));
test('username recebe handle dinâmico e impede entrada inválida',()=>{assert.equal(normalizeUsername('@ssupedro'),'ssupedro');assert.throws(()=>normalizeUsername('https://malicious.com'));});
test('converte resposta flat e foto HD',()=>{const p=normalizeProfile(result,'ssupedro');assert.equal(p.profile_pic_url,'https://example.org/avatar.png');assert.equal(p.follower_count,120);assert.equal(p.source,'rapidapi');});
test('consulta perfil com X-RapidAPI-Key no servidor',async()=>{
 const p=await getProfile('ssupedro',{fetchImpl:mockFetch,key:'test-secret-api-key'});
 assert.equal(p.username,'ssupedro');
});
test('busca completa preserva posts públicos mesmo quando fonte de contas não responde',async()=>{
 const p=await getComplete('ssupedro',{fetchImpl:mockFetch,key:'test-secret-api-key'});
 assert.equal(p.posts.length,1);assert.deepEqual(p.followers,[]);assert.deepEqual(p.chaining_results,[]);
});
test('a função serverless usa a env e não a expõe ao browser',async()=>{
 process.env.RAPIDAPI_KEY='test-secret-api-key';
 const origFetch=globalThis.fetch;globalThis.fetch=mockFetch;
 const headers={};const res={setHeader(k,v){headers[k]=v},end(s){this.body=JSON.parse(s)},statusCode:200};
 try {
  await handler({method:'GET',url:'/api/index?handler=profile&username=ssupedro',query:{handler:'profile',username:'ssupedro'},headers:{'x-forwarded-for':'198.51.100.1'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.username,'ssupedro');
  assert.equal(JSON.stringify(res.body).includes('test-secret-api-key'),false);
 }finally{globalThis.fetch=origFetch;delete process.env.RAPIDAPI_KEY}
});

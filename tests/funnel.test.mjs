import test from 'node:test';
import assert from 'node:assert/strict';
import {getProfile,getComplete,HOST,SOCIAL_HOST,ENGAGEMENT_HOST,requestRapid,normalizeProfile,resetProviderState} from '../lib/rapidapi.mjs';
import handler from '../api/index.mjs';
const key='test-key-no-secret';
const response=(v,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:n=>headers[n.toLowerCase()]||null},json:async()=>v});

test('funil: se a Pro dá 429, tenta IG Public Data via POST JSON; reaproveita seus posts',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({host:url.hostname,path:url.pathname,method:init.method,body:init.body});
    if(url.hostname===HOST)return response({error:{code:'rate_limited',message:'Too many requests'}},429);
    if(url.hostname===ENGAGEMENT_HOST)return response({success:true,id:'451',username:'danxelly',full_name:'Teste',followers:42,following:6,posts:1,is_private:false,profile_pic_url:'https://example.org/a.jpg',recent_posts:[{id:'11',thumbnail:'https://example.org/p.jpg',caption:'ola'}]});
    throw Error('Unexpected host '+url.hostname);
  };
  const p=await getProfile('danxelly',{key,fetchImpl});
  assert.equal(p.pk,'451');assert.equal(p.follower_count,42);
  assert.equal(p.recent_posts.length,1);
  assert.equal(p.provider_host,ENGAGEMENT_HOST);
  assert.equal(calls.length,2);
  assert.equal(calls[1].method,'POST');
  assert.deepEqual(JSON.parse(calls[1].body),{username:'danxelly'});
  const completed=await getComplete('danxelly',{profile:p,key,fetchImpl:async(url)=>{
    assert.equal(url.hostname,SOCIAL_HOST);return response({response:{users:[{username:'amigo1',profile_pic_url:'https://example.org/u.png'}]}});
  }});
  assert.equal(completed.posts.length,1);
  assert.equal(completed.chaining_results.length,1);
});

test('funil: Pro e Engagement falham, API Pública por username assume',async()=>{
  let count=0;
  const fetchImpl=async(url)=>{
    count++;
    if(url.hostname===HOST)return response({error:'rate_limited'},429);
    if(url.hostname===ENGAGEMENT_HOST)return response({error:'overloaded'},503);
    if(url.hostname===SOCIAL_HOST&&url.pathname==='/v2/user/by/username')return response({user:{pk:'999',username:'nasa',full_name:'NASA',follower_count:103000,is_private:false}});
    throw Error('unexpected');
  };
  const p=await getProfile('nasa',{key,fetchImpl});
  assert.equal(count,3);assert.equal(p.pk,'999');assert.equal(p.username,'nasa');assert.equal(p.provider_host,SOCIAL_HOST);
});

test('normaliza payload do Basic Profile Info se o host tiver sido configurado',()=>{
  const p=normalizeProfile({success:true,data:{profile:{id:'10',username:'abc',fullName:'Nome',followersCount:123,followsCount:9,postsCount:30,profilePicUrl:'https://example.org/test.png'}}},'abc');
  assert.equal(p.follower_count,123);assert.equal(p.following_count,9);assert.equal(p.media_count,30);
});

test('requisição: erro de quota mantém origem e retry-after; senha não aparece',async()=>{
  resetProviderState();
  const fetchImpl=async()=>response({error:{code:'rate_limited',message:'Temporary quota'}},429,{'retry-after':'19'});
  await assert.rejects(requestRapid('/v1/user',{username:'nasa'},{key,fetchImpl}),error=>{
    assert.equal(error.status,429);assert.equal(error.origin,'rapidapi');assert.equal(error.retryAfter,19);assert.ok(!error.message.includes(key));return true;
  });
});

test('servidor: chamadas simultâneas de um @ viram uma única ida à API',async()=>{
 const orig=globalThis.fetch,prev=process.env.RAPIDAPI_KEY;let calls=0;
 process.env.RAPIDAPI_KEY=key;resetProviderState();
 globalThis.fetch=async(url)=>{
  if(url.hostname!==HOST)throw Error('outro provedor não deveria receber chamada');
  calls++;await new Promise(r=>setTimeout(r,20));return response({id:'18',username:'cacheteste84',full_name:'Cache Teste'});
 };
 const sendRequest=()=>new Promise(resolve=>{
   const res={statusCode:200,setHeader(){},end(body){resolve({status:this.statusCode,data:JSON.parse(body)})}};
   Promise.resolve(handler({method:'GET',url:'/api/profile?username=cacheteste84',query:{handler:'profile',username:'cacheteste84'},headers:{},socket:{remoteAddress:'198.51.100.45'}},res)).catch(e=>resolve({error:e}));
 });
 try{
  const arr=await Promise.all(Array.from({length:8},()=>sendRequest()));
  assert.ok(arr.every(v=>v.status===200));
  assert.equal(calls,1);
  await sendRequest();assert.equal(calls,1);
 }finally{globalThis.fetch=orig;prev===undefined?delete process.env.RAPIDAPI_KEY:process.env.RAPIDAPI_KEY=prev;}
});

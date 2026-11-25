import test from 'node:test';
import assert from 'node:assert/strict';
import {getProfile,getComplete,HOST,SOCIAL_HOST,ENGAGEMENT_HOST,PROFILE4_HOST,configuredProfileProviders,requestRapid,normalizeProfile,resetProviderState} from '../lib/rapidapi.mjs';
import handler from '../api/index.mjs';
const key='test-key-no-secret';
const response=(v,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:n=>headers[n.toLowerCase()]||null},json:async()=>v});

test('Instagram Profile (profile4): consulta primária via POST JSON com handle e normaliza output.data',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({host:url.hostname,path:url.pathname,method:init.method,body:init.body});
    if(url.hostname===PROFILE4_HOST){
      assert.equal(url.pathname,'/v1/run/instagram.profile');
      assert.equal(init.method,'POST');
      assert.deepEqual(JSON.parse(init.body),{handle:'nasa'});
      return response({
        output:{
          data:{
            userId:'13460080',
            handle:'nasa',
            displayName:'NASA',
            bio:'Exploring the universe and our home planet.',
            followers:97000000,
            following:75,
            posts:4050,
            avatarUrl:'https://example.org/nasa.jpg',
            private:false,
            verified:true
          }
        }
      });
    }
    throw Error('Unexpected host '+url.hostname);
  };
  const p=await getProfile('nasa',{key,fetchImpl});
  assert.equal(p.pk,'13460080');
  assert.equal(p.username,'nasa');
  assert.equal(p.full_name,'NASA');
  assert.equal(p.biography,'Exploring the universe and our home planet.');
  assert.equal(p.follower_count,97000000);
  assert.equal(p.following_count,75);
  assert.equal(p.media_count,4050);
  assert.equal(p.profile_pic_url,'https://example.org/nasa.jpg');
  assert.equal(p.is_private,false);
  assert.equal(p.is_verified,true);
  assert.equal(p.provider_host,PROFILE4_HOST);
  assert.equal(calls.length,1);
});

test('Instagram Profile (profile4): perfil inexistente lança 404 sem tentar outros provedores',async()=>{
  let calls=0;
  const fetchImpl=async(url)=>{
    calls++;
    if(url.hostname===PROFILE4_HOST){
      return response({message:'User not found'},404);
    }
    throw Error('Não deveria chamar outro provedor');
  };
  await assert.rejects(getProfile('nao_existe_xyz_123',{key,fetchImpl}),error=>{
    assert.equal(error.status,404);
    return true;
  });
  assert.equal(calls,1);
});

test('Instagram Profile (profile4): se der 429, faz fallback para os outros provedores',async()=>{
  let calls=0;
  const fetchImpl=async(url)=>{
    calls++;
    if(url.hostname===PROFILE4_HOST){
      return response({message:'You have exceeded the rate limit per second for your plan, BASIC, by the API provider'},429);
    }
    if(url.hostname===HOST){
      return response({error:'rate_limited'},429);
    }
    if(url.hostname===ENGAGEMENT_HOST){
      return response({id:'123',username:'nasa',followers:10,is_private:false});
    }
    throw Error('unexpected host '+url.hostname);
  };
  const p=await getProfile('nasa',{key,fetchImpl});
  assert.equal(p.pk,'123');
  assert.equal(calls,3);
});

test('Instagram Profile (profile4): timeout lança 408',async()=>{
  const fetchImpl=async()=>{
    const err=new Error('Timeout');
    err.name='TimeoutError';
    throw err;
  };
  await assert.rejects(
    requestRapid('/v1/run/instagram.profile',{handle:'nasa'},{key,host:PROFILE4_HOST,method:'POST',bodyType:'json',fetchImpl}),
    error=>{
      assert.equal(error.status,408);
      assert.equal(error.message,'Tempo limite da RapidAPI.');
      return true;
    }
  );
});

test('funil: se a Pro dá 429, tenta IG Public Data via POST JSON; reaproveita seus posts',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({host:url.hostname,path:url.pathname,method:init.method,body:init.body});
    if(url.hostname===HOST)return response({error:{code:'rate_limited',message:'Too many requests'}},429);
    if(url.hostname===ENGAGEMENT_HOST)return response({success:true,id:'451',username:'danxelly',full_name:'Teste',followers:42,following:6,posts:1,is_private:false,profile_pic_url:'https://example.org/a.jpg',recent_posts:[{id:'11',thumbnail:'https://example.org/p.jpg',caption:'ola'}]});
    throw Error('Unexpected host '+url.hostname);
  };
  const legacyProviders=configuredProfileProviders().filter(p=>p.host!==PROFILE4_HOST);
  const p=await getProfile('danxelly',{key,fetchImpl,providers:legacyProviders});
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
  const legacyProviders=configuredProfileProviders().filter(p=>p.host!==PROFILE4_HOST);
  const p=await getProfile('nasa',{key,fetchImpl,providers:legacyProviders});
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
  if(url.hostname!==PROFILE4_HOST)throw Error('outro provedor não deveria receber chamada');
  calls++;await new Promise(r=>setTimeout(r,20));return response({output:{data:{userId:'18',handle:'cacheteste84',displayName:'Cache Teste'}}});
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

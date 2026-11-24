import test from 'node:test';
import assert from 'node:assert/strict';
import {getComplete,getFollowers,normalizePeople,normalizePosts,SOCIAL_HOST,HOST} from '../lib/rapidapi.mjs';
import {getVisitorLocation,normalizeLocation} from '../lib/location.mjs';
import {readFileSync} from 'node:fs';

const testKey='test-secret-api-key';
function fakeRapid(url,options){
  assert.equal(options.headers['X-RapidAPI-Key'],testKey);
  assert.equal(options.headers['X-RapidAPI-Host'],url.hostname);
  if(url.hostname===HOST && url.pathname==='/v1/user')return Promise.resolve({ok:true,json:async()=>({id:'888',username:'ssupedro',full_name:'Pedro',profile_pic_url:'https://static.example.org/p.jpg',follower_count:70})});
  if(url.hostname===HOST && url.pathname==='/v1/user/posts')return Promise.resolve({ok:true,json:async()=>({items:[{id:'11',code:'abcd',thumbnail_url:'https://static.example.org/post.jpg',caption:'Olá mundo',like_count:10,taken_at:1711100000}]})});
  if(url.hostname===SOCIAL_HOST && ['/g2/user/following','/g2/user/followers'].includes(url.pathname)){
    assert.equal(options.method,'GET');
    assert.equal(url.searchParams.get('user_id'),'888');
    assert.equal(url.searchParams.has('page_id'),false);
    assert.equal(options.body,undefined);
    return Promise.resolve({ok:true,json:async()=>({response:{users:[
      {pk:1,username:'amigo.um',full_name:'Amigo',profile_pic_url:'https://static.example.org/u1.jpg'},
      {pk:2,username:'amigo.dois',profile_pic_url:'https://static.example.org/u2.jpg'}
    ]}})});
  }
  throw new Error('Rota não esperada '+url.hostname+url.pathname);
}
test('normaliza contas seguidas e URLs públicas sem duplicar usuários',()=>{
 const list=normalizePeople({response:{users:[{username:'test_user',profile_pic_url:'https://cdn.example.org/a.jpg'},{username:'test_user',profile_pic_url:'https://cdn.example.org/b.jpg'},{username:'bad user'}]}});
 assert.equal(list.length,1);
 assert.equal(list[0].profile_pic_url,'https://cdn.example.org/a.jpg');
});
test('busca completa une foto do perfil, posts e contas seguidas com 1 chave RapidAPI',async()=>{
 const data=await getComplete('ssupedro',{fetchImpl:fakeRapid,key:testKey});
 assert.equal(data.posts.length,1);
 assert.equal(data.posts[0].caption.text,'Olá mundo');
 assert.equal(data.chaining_results.length,2);
 assert.equal(data.following[0].username,'amigo.um');
 assert.equal(data.feed_posts.length,1);
 assert.equal(data.results[0].following,'ok');
 assert.equal(data.error_count,0);
 assert.ok(!JSON.stringify(data).includes(testKey));
});
test('se listagem falhar posts reais continuam (sem inventar seguidores)',async()=>{
 const fetchImpl=(url,init)=>url.hostname===SOCIAL_HOST?Promise.reject(new Error('unavailable')):fakeRapid(url,init);
 const data=await getComplete('ssupedro',{fetchImpl,key:testKey});
 assert.equal(data.posts.length,1);
 assert.deepEqual(data.following,[]);
 assert.equal(data.results[0].following,'unavailable');
});
test('posts sem mídia não são incluídos e links HTTP são rejeitados',()=>{
 const items=normalizePosts({data:{items:[{thumbnail_url:'http://example.org/a.jpg'},{thumbnail_url:'https://example.org/b.jpg'}]}});
 assert.equal(items.length,1);
});
test('geo IP retorna apenas cidade aproximada sem repassar IP ou coordenadas',async()=>{
 const req={headers:{'x-forwarded-for':'8.8.8.8'}};
 let asked='';
 const location=await getVisitorLocation(req,{fetchImpl:async u=>{asked=u;return {ok:true,json:async()=>({city:'Mountain View',region:'California',country:'United States',ip:'8.8.8.8',latitude:'37.3',longitude:'-122'})}}});
 assert.match(asked,/geo\/8\.8\.8\.8\.json$/);
 assert.equal(location.city,'Mountain View');
 assert.deepEqual(location.nearby_cities,['Mountain View']);
 assert.ok(!('ip' in location));
 assert.ok(!('latitude' in location));
});
test('IP privado não faz consulta externa',async()=>{
 const location=await getVisitorLocation({headers:{'x-forwarded-for':'127.0.0.1'}},{fetchImpl:()=>{throw new Error('não chamar')}});
 assert.equal(location.city,'');
 assert.deepEqual(location.nearby_cities,[]);
});
test('frontend conecta localização, perfis e rotas sem colocar a chave no JS',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const geo=readFileSync(new URL('../geo-context.js',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../consulta-rapidapi.js',import.meta.url),'utf8');
 assert.ok(index.includes('/geo-context.js'));
 assert.ok(geo.includes("localStorage.setItem('user_city'"));
 assert.ok(bridge.includes("window.gsSaveFollowing=setPeople"));
 assert.ok(bridge.includes('instagram_posts_'));
 assert.ok(!bridge.includes('X-RapidAPI-Key'));
});

test('seguidores têm endpoint independente e compartilham a mesma chave',async()=>{
 const users=await getFollowers('ssupedro','888',{fetchImpl:fakeRapid,key:testKey});
 assert.equal(users.length,2);
 assert.equal(users[1].username,'amigo.dois');
});

test('getFollowing usa ID diferente de acordo com @ pesquisado, sem ID da NASA fixo',async()=>{
  const {getFollowing}=await import('../lib/rapidapi.mjs');
  for(const [handle,id] of [['teste.um','123'],['teste.dois','987']]){
    const arr=await getFollowing(handle,id,{key:testKey,fetchImpl:async(url,init)=>{
      assert.equal(url.searchParams.get('user_id'),id);
      assert.equal(url.pathname,'/g2/user/following');
      assert.equal(init.headers['X-RapidAPI-Host'],SOCIAL_HOST);
      return {ok:true,json:async()=>({response:{users:[{username:handle}]}})};
    }});
    assert.equal(arr[0].username,handle);
  }
});
test('quando falta ID numérico, não faz consultas por aproximação',async()=>{
 const {getFollowing}=await import('../lib/rapidapi.mjs');
 await assert.rejects(getFollowing('nasa','',{key:testKey}),/ID numerico/i);
});

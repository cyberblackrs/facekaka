import test from 'node:test';
import assert from 'node:assert/strict';
import {getComplete,normalizePeople,HOST,SOCIAL_HOST} from '../lib/rapidapi.mjs';
const key='fixture-only';
function fake(url, init) {
  if(url.hostname===HOST && url.pathname==='/v1/user')return Promise.resolve({ok:true,json:async()=>({id:'100',username:'exemplobrasil',full_name:'Exemplo',profile_pic_url:'https://img.example/a.jpg'})});
  if(url.hostname===HOST && url.pathname==='/v1/user/posts')return Promise.resolve({ok:true,json:async()=>({items:[]})});
  if(url.hostname===SOCIAL_HOST)return Promise.resolve({ok:false,status:403,json:async()=>({error:'not subscribed'})});
  throw Error('unknown');
}
test('exibe o motivo seguro da falha do fornecedor social em results',async()=>{
  const obj=await getComplete('exemplobrasil',{fetchImpl:fake,key});
  assert.equal(obj.chaining_results.length,0);
  assert.equal(obj.results[0].following,'unavailable');
  assert.match(obj.results[0].following_error,/assinatura/i);
  assert.ok(!JSON.stringify(obj).includes(key));
});
test('JSON com estrutura desconhecida gera diagnóstico, não zero silencioso',()=>{
  assert.throws(()=>normalizePeople({foo:{list:[{name:'alguem'}]}}),/JSON sem lista identificável/i);
  assert.equal(normalizePeople({foo:{list:[{username:'alguem'}]}})[0].username,'alguem');
});
test('normaliza resposta GraphQL aninhada de contas reais',()=>{
  const obj={data:{user:{edge_follow:{edges:[{node:{username:'publico123',profile_pic_url:'https://img.example/u.jpg'}}]}}}};
  assert.equal(normalizePeople(obj).length,1);
  assert.equal(normalizePeople(obj)[0].username,'publico123');
});

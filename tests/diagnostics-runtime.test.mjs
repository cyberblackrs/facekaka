import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.mjs';
import {HOST,SOCIAL_HOST} from '../lib/rapidapi.mjs';

const originalFetch=globalThis.fetch;
const previousKey=process.env.RAPIDAPI_KEY;
const respond=(json,status=200)=>({ok:status>=200&&status<300,status,json:async()=>json});
function sendRequest(handlerName,username,tipo='') {
  const qs=new URLSearchParams({username}); if(tipo)qs.set('tipo',tipo);
  const req={url:`/api/${handlerName}?${qs}`,query:{handler:handlerName,username,...(tipo?{tipo}:{})},method:'GET',headers:{},socket:{remoteAddress:'local-test'}};
  return new Promise((resolve,reject)=>{
    const headers={};
    const res={statusCode:200,headersSent:false,setHeader(k,v){headers[k]=v},end(body){try{resolve({status:this.statusCode,json:JSON.parse(body),headers})}catch(e){reject(e)}}};
    Promise.resolve(handler(req,res)).catch(reject);
  });
}

test('diagnóstico depois de buscar perfil completo responde JSON 200, sem ReferenceError',async()=>{
  process.env.RAPIDAPI_KEY='fixture-only-key';
  globalThis.fetch=async(input)=>{
    const u=new URL(input);
    if(u.hostname===HOST&&u.pathname==='/v1/user')return respond({id:'528817151',username:'nasa',full_name:'NASA',is_private:false});
    if(u.hostname===HOST&&u.pathname==='/v1/user/posts')return respond({items:[]});
    if(u.hostname===SOCIAL_HOST&&u.pathname==='/g2/user/following')return respond({response:{users:[{id:'77',username:'spaceagency',profile_pic_url:'https://example.org/space.jpg'}]}});
    throw Error('unexpected fetch');
  };
  try{
    const complete=await sendRequest('instagram','nasa','busca_completa');
    assert.equal(complete.status,200);
    assert.equal(complete.json.chaining_results.length,0);
    const diag=await sendRequest('diagnostics','nasa');
    assert.equal(diag.status,200);
    assert.equal(diag.json.version,'8.12.2');
    assert.equal(diag.json.contas,0);
    assert.ok(diag.json.following_check.status==='ok'||diag.json.following_check.status==='not_checked');
    assert.ok(!JSON.stringify(diag.json).includes('fixture-only-key'));
  }finally{globalThis.fetch=originalFetch;if(previousKey===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=previousKey;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeProfile,findProfilePictures} from '../lib/rapidapi.mjs';
import {allowedAvatarURL,fetchAvatar} from '../lib/avatar.mjs';
import handler from '../api/index.mjs';

test('foto: normaliza objeto url sem cair no ícone azul',()=>{
 const value={success:true,data:{profile:{username:'danxelly',id:'9057805302',followers:2058,
  following:998,profile_pic_url:{url:'https://scontent.cdninstagram.com/foto.jpg'}}}};
 const result=normalizeProfile(value,'danxelly');
 assert.equal(result.profile_pic_url,'https://scontent.cdninstagram.com/foto.jpg');
 assert.equal(result.profile_picture_available,true);
 assert.deepEqual(result.profile_picture_candidates,['https://scontent.cdninstagram.com/foto.jpg']);
});

test('foto: se o payload possui foto em um wrapper, prioriza foto existente',()=>{
 const value={profile_pic_url:'https://scontent.cdninstagram.com/original.jpg',data:{id:'42',username:'nasa',profile_pic_url:{invalid:'not a url'},avatar_url:'https://example.org/nasa.jpg'}};
 const result=normalizeProfile(value,'nasa');
 assert.equal(result.profile_pic_url,'https://example.org/nasa.jpg');
 assert.deepEqual(result.profile_picture_candidates,['https://example.org/nasa.jpg','https://scontent.cdninstagram.com/original.jpg']);
});

test('foto: sem URL legítima nunca inventa o rosto da pessoa',()=>{
 const result=normalizeProfile({id:'1',username:'publico',profile_pic_url:null},'publico');
 assert.equal(result.profile_picture_available,false);
 assert.ok(result.profile_pic_url.includes('perfil-sem-foto'));
});

test('proxy de imagem bloqueia hosts arbitrários e redirecionamentos externos',async()=>{
 for(const url of ['http://scontent.cdninstagram.com/x.jpg','https://example.com/test.jpg','https://fbcdn.net.attacker.test/a.jpg','https://localhost/image.jpg','https://127.0.0.1/x.jpg']){
  assert.equal(allowedAvatarURL(url),false,url);
 }
 assert.equal(allowedAvatarURL('https://instagram.fgru1-1.fna.fbcdn.net/p.jpg'),true);
 assert.equal(allowedAvatarURL('https://scontent.cdninstagram.com/p.jpg'),true);
 await assert.rejects(fetchAvatar('https://scontent.cdninstagram.com/redirect-test.jpg',{fetchImpl:async()=>({status:302,headers:new Headers({location:'http://127.0.0.1/admin'})})}),/Redirecionamento não permitido/);
});

test('proxy de imagem serve JPEG binário sem chamar nenhuma API paga',async()=>{
 const body=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0xff,0xd9]);
 let seen=0;
 const result=await fetchAvatar('https://scontent.cdninstagram.com/avatar-882.jpg',{fetchImpl:async(url,opts)=>{
  seen++;assert.ok(url.includes('/avatar-882.jpg'));assert.equal(opts.method,'GET');
  return {ok:true,status:200,headers:new Headers({'content-type':'image/jpeg','content-length':String(body.length)}),arrayBuffer:async()=>body};
 }});
 assert.equal(result.contentType,'image/jpeg');assert.deepEqual(result.body,body);assert.equal(seen,1);
 await fetchAvatar('https://scontent.cdninstagram.com/avatar-882.jpg',{fetchImpl:async()=>{throw Error('Image not cached')}});
});

test('proxy recusa resposta HTML travestida de foto',async()=>{
 await assert.rejects(fetchAvatar('https://scontent.cdninstagram.com/avatar-html.jpg',{fetchImpl:async()=>({ok:true,status:200,headers:new Headers({'content-type':'text/html'}),arrayBuffer:async()=>Buffer.from('<html>')})}),/não devolveu imagem/);
});

test('rota avatar sem src é bloqueada antes de qualquer requisição externa',async()=>{
 const req={method:'GET',url:'/api/avatar?src=https%3A%2F%2Fevil.example%2Ftest',query:{handler:'avatar',src:'https://evil.example/test'},headers:{},socket:{remoteAddress:'198.51.100.10'}};
 const res={statusCode:200,setHeader(){},end(x){this.body=JSON.parse(x)}};
 await handler(req,res);assert.equal(res.statusCode,400);
});

test('cliente entrega URL de proxy ao React ANTES do modal abrir',async()=>{
 const js=readFileSync(new URL('../consulta-rapidapi.js',import.meta.url),'utf8');
 const values=new Map();
 const nativeFetch=async(url)=>new Response(JSON.stringify({source:'rapidapi',username:'danxelly',pk:'9057805302',profile_pic_url:'https://scontent.cdninstagram.com/a.jpg',follower_count:2058}),{status:200,headers:{'Content-Type':'application/json'}});
 const window={fetch:nativeFetch,dispatchEvent(){},CustomEvent:class{}};
 const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const context={window,localStorage,location:{origin:'http://127.0.0.1:5173',href:'http://127.0.0.1:5173/'},URL,Response,CustomEvent:class{constructor(name,init){this.detail=init.detail}},console};
 vm.runInNewContext(js,context);
 const res=await window.fetch('/api/proxy/instagram.php?tipo=perfil&username=danxelly');
 const payload=await res.json();
 assert.equal(payload.profile_pic_url,'/api/avatar?src=https%3A%2F%2Fscontent.cdninstagram.com%2Fa.jpg');
 assert.equal(payload.profile_pic_original_url,'https://scontent.cdninstagram.com/a.jpg');
 assert.ok(values.has('gs_profile_cache_v88_danxelly'));
 assert.equal(JSON.parse(values.get('instagram_profile')).profile_pic_url,payload.profile_pic_url);
});

test('rota HTTP avatar entrega imagem em bytes e não consulta HikerAPI/RapidAPI',async()=>{
 const previous=globalThis.fetch;
 const body=Buffer.from([0xff,0xd8,0x01,0xff,0xd9]);
 const calls=[];
 globalThis.fetch=async(url,init)=>{
   calls.push({url:String(url),headers:init.headers});
   assert.ok(String(url).startsWith('https://scontent.cdninstagram.com/'));
   assert.equal('x-access-key' in init.headers,false);
   assert.equal('X-RapidAPI-Key' in init.headers,false);
   return {ok:true,status:200,headers:new Headers({'content-type':'image/jpeg'}),arrayBuffer:async()=>body};
 };
 try{
   const src='https://scontent.cdninstagram.com/test-avatar-http-88.jpg';
   const req={method:'GET',url:'/api/avatar?src='+encodeURIComponent(src),query:{handler:'avatar',src},headers:{},socket:{remoteAddress:'198.51.100.10'}};
   const headers={};
   const res={statusCode:200,setHeader(name,value){headers[name.toLowerCase()]=value},end(data){this.body=data}};
   await handler(req,res);
   assert.equal(res.statusCode,200);
   assert.equal(headers['content-type'],'image/jpeg');
   assert.deepEqual(res.body,body);
   assert.equal(calls.length,1);
 }finally{globalThis.fetch=previous;}
});

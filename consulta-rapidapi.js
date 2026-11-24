/* Ponte de dados públicos do backend para o frontend original. A chave permanece no servidor. */
(()=>{'use strict';
 const nativeFetch=window.fetch.bind(window);
 const valid=u=>typeof u==='string'&&/^[A-Za-z0-9._]{1,30}$/.test(u);
 const lower=u=>String(u||'').toLowerCase();
 const PHOTO_ALLOWED=/(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|fna\.fbcdn\.net)$/i;
 function avatarProxy(url){
   if(typeof url!=='string')return url;
   try{
     const u=new URL(url,location.href);
     if(u.protocol==='https:' && PHOTO_ALLOWED.test(u.hostname))
       return '/api/avatar?src='+encodeURIComponent(u.href);
   }catch{}
   return url;
 }
 function makePhotoReliable(obj){
   if(!obj||typeof obj!=='object')return obj;
   const profile=obj.profile?.username?obj.profile:(obj.user?.username?obj.user:obj);
   if(profile?.username&&profile?.profile_pic_url){
     if(!profile.profile_pic_original_url && /^https:\/\//.test(profile.profile_pic_url))
       profile.profile_pic_original_url=profile.profile_pic_url;
     profile.profile_pic_url=avatarProxy(profile.profile_pic_url);
   }
   return obj;
 }
 const get=k=>{try{return localStorage.getItem(k)}catch{return null}};
 const put=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
 const json=(k,fallback)=>{try{return JSON.parse(get(k)||'null')??fallback}catch{return fallback}};
 function setPeople(username,people){
   if(!valid(username)||!Array.isArray(people))return;
   const stored=json(`chaining_results_${username}`,[]);
   if(people.length===0&&Array.isArray(stored)&&stored.length>0)return;
   // Persistir sempre por perfil; a lista global pertence apenas ao perfil ativo.
   put(`chaining_results_${username}`,JSON.stringify(people));
   put(`instagram_followers_${username}`,JSON.stringify(people));
   const active=get('espionado_username')||get('username');
   if(active && lower(active)!==lower(username))return;
   for(const k of ['chaining_results','instagram_followers','followers'])put(k,JSON.stringify(people));
   put('gs_people_owner',username);
   window.dispatchEvent(new CustomEvent('gs:following-ready',{detail:{username,count:people.length}}));
 }
 function save(payload,requestUsername){
   const profile=payload?.profile?.username?payload.profile:payload;
   if(!valid(profile?.username)||profile.source!=='rapidapi')return;
   const username=profile.username;
   if(requestUsername && lower(requestUsername)!==lower(username))return;
   const previous=get('espionado_username')||get('username');
   const active=previous===null||lower(previous)===lower(username);
   if(!active){
     for(const k of ['chaining_results','instagram_followers','followers'])put(k,'[]');
     put('gs_people_owner',username);
   }
   put('gs_last_rapidapi_profile',JSON.stringify(profile));
   put('instagram_profile',JSON.stringify(profile));
   put('username',username);
   put('espionado_username',username);
   const people=payload.lista_perfis_publicos??payload.chaining_results??payload.following;
   if(Array.isArray(people))setPeople(username,people);
   else {
     const old=json(`chaining_results_${username}`,[]);
     if(Array.isArray(old)&&old.length>0)setPeople(username,old);
   }
   const posts=payload.posts??payload.feed_posts;
   if(Array.isArray(posts)){
     put(`instagram_posts_${username}`,JSON.stringify(posts));
     put(`instagram_posts_${username}_timestamp`,String(Date.now()));
   }
   window.dispatchEvent(new CustomEvent('gs:public-data',{detail:{username,people:people?.length??null,posts:posts?.length??null}}));
 }
 window.gsSaveFollowing=setPeople;
 // Cache local apenas para o perfil publico consultado. Válido mesmo quando
 // uma função serverless troca de instância e perde o cache de memória.
 const BROWSER_TTL=10*60*1000;
 window.fetch=async function(input,init){
   let url;
   try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch{return nativeFetch(input,init)}
   const isLocal=url.origin===location.origin;
   const isProfile=isLocal&&(['/api/profile'].includes(url.pathname)||
      (url.pathname==='/api/proxy/instagram.php'&&(!url.searchParams.get('tipo')||url.searchParams.get('tipo')==='perfil')));
   const username=url.searchParams.get('username');
   const canCache=isProfile&&valid(username)&&(!init?.method||init.method.toUpperCase()==='GET');
   if(canCache){
     const entry=json('gs_profile_cache_v88_'+lower(username),null);
     if(entry&&Date.now()-entry.saved<BROWSER_TTL&&entry.data?.source==='rapidapi'&&entry.data?.username?.toLowerCase()===lower(username)){
       save(entry.data,username);
       return new Response(JSON.stringify(entry.data),{status:200,headers:{'Content-Type':'application/json','X-GS-Cache':'browser'}});
     }
   }
   const response=await nativeFetch(input,init);
   if(isLocal&&['/api/proxy/instagram.php','/api/profile','/api/proxy/hikerapi.php'].includes(url.pathname)&&response.ok){
     const requested=url.searchParams.get('username');
     try{
       // Importante: reescrever ANTES de entregar o JSON ao React. Se a imagem
       // falhar uma vez, o modal original troca pelo ícone e não tenta de novo.
       const obj=makePhotoReliable(await response.clone().json());
       save(obj,requested);
       if(canCache&&obj?.source==='rapidapi'&&lower(obj.username)===lower(username))
         put('gs_profile_cache_v88_'+lower(username),JSON.stringify({saved:Date.now(),data:obj}));
       return new Response(JSON.stringify(obj),{status:response.status,
         headers:{'Content-Type':'application/json; charset=utf-8','X-GS-Photo':'normalized'}});
     }catch(e){console.warn('[GhostSpy] Não foi possível preparar o avatar:',e)}
   }
   return response;
 };
})();

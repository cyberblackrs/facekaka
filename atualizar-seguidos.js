(()=>{'use strict';
 const valid=u=>typeof u==='string'&&/^[A-Za-z0-9._]{1,30}$/.test(u);
 const get=k=>{try{return localStorage.getItem(k)}catch{return null}};
 const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
 const obj=k=>{try{return JSON.parse(get(k)||'null')}catch{return null}};
 const route=()=>/^\/(direct|feed)(?:\/|$)/.test(location.pathname);
 let pending=null;
 let loadingFor='';
 function active(){
   const q=new URL(location.href).searchParams.get('username');
   const p=obj('instagram_profile');
   const u=q||p?.username||get('espionado_username');
   return valid(u)?u:null;
 }
 function peopleFor(username){
   const keyed=obj(`chaining_results_${username}`);
   if(Array.isArray(keyed)&&keyed.length>0)return keyed;
   // Nunca confiar em listas globais da home, que pode inserir placeholders
   // antes de receber a consulta; só uma lista identificada por @ é válida.
   return [];
 }
 function maybeReload(username){
   // O componente visual de V8.6 reage aos eventos; não recarregar a página.
   window.gsRenderPublicFollowing?.();
 }
 async function sync(){
   // V8.7: Notas meramente visuais. Nunca gastar créditos de seguindo automaticamente.
   return;
   if(!route())return;
   const username=active();if(!username)return;
   const profile=obj('instagram_profile');
   if(profile?.is_private)return;
   if(peopleFor(username).length>0)return;
   if(pending&&loadingFor===username)return pending;
   const marker=`gs_following_attempt_v85_${username.toLowerCase()}`;
   const last=Number(get(marker)||0);
   if(Date.now()-last<120000)return;
   put(marker,Date.now());
   loadingFor=username;
   pending=(async()=>{
     try{
       const res=await fetch(`/api/following?username=${encodeURIComponent(username)}`,{headers:{Accept:'application/json'}});
       const data=await res.json();
       if(!res.ok)throw Error(String(data.error||`HTTP ${res.status}`).slice(0,160));
       if(!Array.isArray(data.users))throw Error('Resposta sem lista de usuários');
       put(`gs_following_status_${username}`,JSON.stringify({ok:true,count:data.users.length,time:Date.now()}));
       if(data.users.length>0){
         const before=peopleFor(username).length;
         if(typeof window.gsSaveFollowing==='function')window.gsSaveFollowing(username,data.users);
         else {
           put(`chaining_results_${username}`,JSON.stringify(data.users));
           if(active()?.toLowerCase()===username.toLowerCase()){
             put('chaining_results',JSON.stringify(data.users));
             put('instagram_followers',JSON.stringify(data.users));
             put('gs_people_owner',username);
           }
         }
         if(before===0)maybeReload(username);
       }
     }catch(err){
       const message=String(err?.message||'Falha na consulta').slice(0,160);
       put(`gs_following_status_${username}`,JSON.stringify({ok:false,error:message,time:Date.now()}));
       console.warn('[RapidAPI following]',message);
     }finally{pending=null;loadingFor='';}
   })();
   return pending;
 }
 function handleRoute(){setTimeout(sync,160)}
 // Navegação SPA da aplicação original.
 for(const method of ['pushState','replaceState']){
   const old=history[method];
   history[method]=function(...args){const v=old.apply(this,args);handleRoute();return v;};
 }
 window.addEventListener('popstate',handleRoute);
 window.addEventListener('gs:public-data',e=>{
   const p=e.detail;
   if(!p?.username)return;
   if(p.people>0&&route())maybeReload(p.username);
   else if(route())handleRoute();
 });
 window.addEventListener('gs:following-ready',e=>{
   if(e.detail?.count>0)maybeReload(e.detail.username);
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',handleRoute,{once:true});
 else handleRoute();
})();

(()=>{'use strict';
 const suffix=/^\s*(?:(?:A|[\p{L}\p{N}._@-]{1,30})\s*,?\s+)adivinha\s+o\s+que\s+(?:vc|você)\s+esqueceu\s+aqui\?/iu;
 const readJSON=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
 const username=()=>{
   const u=(new URL(location.href).searchParams.get('username')||localStorage.getItem('espionado_username')||localStorage.getItem('username')||'').replace(/^@/,'').trim().toLowerCase();
   return /^[a-z0-9._]{1,30}$/.test(u)?u:'';
 };
 function displayName(profile,expected){
   if(!profile || typeof profile!=='object')return null;
   for(const p of [profile,profile.profile,profile.user,profile.data?.profile,profile.data?.user]){
     if(!p || typeof p!=='object'||String(p.username||'').toLowerCase()!==expected)continue;
     const value=[p.full_name,p.fullName,p.display_name,p.displayName,p.name].find(v=>typeof v==='string'&&v.trim());
     if(!value)continue;
     // Nome do Instagram pode começar com emoji. Encontre a primeira palavra com letras.
     const first=value.trim().match(/[\p{L}][\p{L}\p{M}'’-]*/u)?.[0];
     if(first && first.length>=2 && first.length<=30)
       return first.charAt(0).toLocaleUpperCase('pt-BR')+first.slice(1);
   }
   return null;
 }
 function firstName(){
   const user=username();if(!user)return null;
   const cached=readJSON('gs_profile_cache_v88_'+user);
   for(const profile of [readJSON('instagram_profile'),readJSON('gs_last_rapidapi_profile'),cached?.data]){
     const name=displayName(profile,user);
     if(name)return name;
   }
   return null;
 }
 let queued=false;
 function update(){
   if(!/^\/chat\/(?:[1-9]|1[0-3])(?:\/|$)/.test(location.pathname) || !document.body)return;
   const name=firstName()||'Ei'; // Nunca transformar @ssupedro no nome "ssupedro".
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
     if(!node.parentElement||['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement.tagName))continue;
     const text=node.nodeValue||'';
     if(suffix.test(text))node.nodeValue=text.replace(suffix,`${name}, adivinha o que vc esqueceu aqui?`);
   }
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()});}
 function boot(){
   new MutationObserver(changes=>{
     if(changes.some(c=>c.addedNodes.length||c.type==='characterData'))schedule();
   }).observe(document.body,{childList:true,subtree:true,characterData:true});
   schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.addEventListener('popstate',schedule);
 window.addEventListener('gs:public-data',schedule);
})();

(()=>{'use strict';
 window.dataLayer=window.dataLayer||[];
 const path=location.pathname;
 const isHome=path==='/'||path==='/index.html';
 const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 const valid=(p)=>!!(p&&/^[A-Za-z0-9._]{1,30}$/.test(p.username||''));
 let p=read('gs_last_rapidapi_profile')||read('instagram_profile');
 if(p?.source==='local' || p?.username==='exemplo.visual')p=null;
 if(isHome){
  // O campo da home sempre controla a próxima consulta.
  const saved=read('instagram_profile');
  if(saved?.source==='local'||saved?.username==='exemplo.visual'){
   for(const key of ['username','espionado_username','instagram_profile'])try{localStorage.removeItem(key)}catch{}
  }
  return;
 }
 if(!valid(p)){
  // Apenas mantém a navegação direta disponível antes de uma pesquisa.
  // O perfil escolhido na home substitui este contexto no primeiro retorno da API.
  p={pk:'local',id:'local',username:'exemplo.visual',full_name:'Perfil',
   biography:'',profile_pic_url:'/images/avatars/perfil-sem-foto.jpeg',
   follower_count:0,following_count:0,media_count:0,is_private:false,is_verified:false,source:'local'};
 }
 try{
  localStorage.setItem('username',p.username);
  localStorage.setItem('espionado_username',p.username);
  localStorage.setItem('instagram_profile',JSON.stringify(p));
  for(const key of ['chaining_results','instagram_followers','followers',`chaining_results_${p.username}`,`instagram_followers_${p.username}`]){
   if(localStorage.getItem(key)===null)localStorage.setItem(key,'[]');
  }
  if(!localStorage.getItem('shared_timer_start'))localStorage.setItem('shared_timer_start',String(Date.now()));
  const names=['Fer*****','And*****','Bru*****','Contato 4','Contato 5'];
  for(let k=1;k<=5;k++){
   const key=`chat-${k}-user-name`,old=sessionStorage.getItem(key);
   if(!old||/demo|demonstrativ/i.test(old))sessionStorage.setItem(key,names[k-1]);
   if(!sessionStorage.getItem(`chat-${k}-user-photo`))
    sessionStorage.setItem(`chat-${k}-user-photo`,`/images/screenshots/chat${Math.min(k,3)}.png`);
  }
  if(/^\/(feed|direct|notifications)$/.test(path)){
   const url=new URL(location.href);
   if(!url.searchParams.has('username')){
    url.searchParams.set('username',p.username);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
   }
  }
 }catch(e){console.warn('Não foi possível restaurar a navegação',e)}
})();

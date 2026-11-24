/* Estima apenas a cidade de quem está acessando o site, nunca a de um perfil pesquisado. */
(()=>{'use strict';
 const apply=(locationData)=>{
   const city=String(locationData?.city||'').trim().slice(0,90);
   if(!city||city.toLowerCase()==='unknown')return false;
   const candidates=Array.isArray(locationData.nearby_cities)?locationData.nearby_cities:[];
   const nearby=[...new Set([...candidates,city].map(x=>String(x).trim()).filter(Boolean))].slice(0,5);
   try{
     localStorage.setItem('user_city',city);
     localStorage.setItem('nearby_cities',JSON.stringify(nearby));
     localStorage.setItem('user_real_city',city);
     window.dispatchEvent(new CustomEvent('gs:city',{detail:{city}}));
   }catch{}
   return true;
 };
 async function start(){
   try{
     const r=await fetch('/api/location',{cache:'no-store',headers:{Accept:'application/json'}});
     if(r.ok&&apply(await r.json()))return;
   }catch{}
   // O servidor local recebe IP privado; o navegador consulta o próprio IP público.
   if(location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return;
   try{
     const r=await fetch('https://get.geojs.io/v1/ip/geo.json',{cache:'no-store'});
     if(r.ok)apply(await r.json());
   }catch{}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

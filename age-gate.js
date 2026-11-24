(()=>{
 const KEY='ghost_age_verified';
 let gate=null;
 let observer=null;
 function cleanup(){gate?.remove();gate=null;document.body.style.overflow=''}
 function sync(){
  if(localStorage.getItem(KEY)==='1'){
   if(gate)cleanup();
   if(observer){observer.disconnect();observer=null;}
   return;
  }
  const home=!!document.querySelector('.ghost-home-scope');
  if(!home){if(gate)cleanup();return;}
  if(gate)return;
  const host=document.createElement('div');
  host.innerHTML=`<div id="ghost-age-gate" role="dialog" aria-modal="true" aria-label="Verificação de idade"><div class="ghost-gate-card"><div class="ghost-gate-icon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div id="ghost-age-main"><h2 class="ghost-gate-title">Você tem 18 anos<br/>ou mais?</h2><p class="ghost-gate-sub">Confirme sua idade para continuar.</p><button type="button" id="ghost-age-yes" class="ghost-gate-yes">Sim, tenho 18 anos ou mais</button><button type="button" id="ghost-age-no" class="ghost-gate-no">Não, tenho menos de 18 anos</button><p class="ghost-gate-note">Ao continuar, você confirma ter lido e aceito os termos de uso.</p></div><div id="ghost-age-blocked" hidden><h2 class="ghost-gate-blocked-title">Conteúdo restrito</h2><p class="ghost-gate-blocked-text">O acesso ao GhostSpy é permitido apenas para maiores de 18 anos.</p></div></div></div>`;
  gate=host.firstElementChild;
  document.body.appendChild(gate);
  document.body.style.overflow='hidden';
  gate.querySelector('#ghost-age-yes').addEventListener('click',()=>{
   localStorage.setItem(KEY,'1');
   cleanup();
   if(observer){observer.disconnect();observer=null;}
  });
  gate.querySelector('#ghost-age-no').addEventListener('click',()=>{
   gate.querySelector('#ghost-age-main').hidden=true;
   gate.querySelector('#ghost-age-blocked').hidden=false;
  });
 }
 if(localStorage.getItem(KEY)!=='1'){
  observer=new MutationObserver(sync);
  observer.observe(document.documentElement,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
})();

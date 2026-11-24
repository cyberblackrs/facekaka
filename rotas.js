/* Navegação entre as telas do frontend ORIGINAL, não uma reconstrução das interfaces. */
(()=>{
'use strict';
const paths=[
 ['Home','/'],['Feed','/feed'],['Direct','/direct'],
 ['Chat 1','/chat/1'],['Chat 2','/chat/2'],['Chat 3','/chat/3'],['Chat 4','/chat/4'],['Chat 5','/chat/5'],
 ['Notificações','/notifications'],['CTA','/cta'],['White page','/white-page'],
 ['Início 1','/inicio1'],['Início 2','/inicio2'],['Início 3','/inicio3'],['Início 4','/inicio4'],
 ['GhostSpy','/in-ghostspy'],['Resultados','/in-ghostspy/results'],
 ['GhostSpy V2','/ghostspy-v2'],['Resultados V2','/ghostspy-v2/results'],
 ['Backredirect','/ghostspy-v2/backredirect']
];
const CSS=`
#gs-route-btn{position:fixed!important;right:13px!important;bottom:14px!important;z-index:2147483450!important;background:#0e82f8!important;color:#fff!important;border:1px solid #fff9!important;border-radius:99px!important;box-shadow:0 8px 28px #0005!important;padding:9px 15px!important;font:700 12px Inter,Arial,sans-serif!important;cursor:pointer!important;opacity:.85}
#gs-route-btn:hover{opacity:1}
#gs-route-menu{display:none;position:fixed;inset:0;z-index:2147483490;background:#0009;justify-content:flex-end;align-items:stretch;font:13px Inter,Arial,sans-serif;box-sizing:border-box}
#gs-route-menu.gs-visible{display:flex}
#gs-route-panel{width:min(375px,100vw);height:100%;overflow:auto;box-sizing:border-box;padding:18px 18px 28px;background:#fff;color:#0f172a;box-shadow:0 0 65px #0005}
#gs-route-panel *{box-sizing:border-box}#gs-route-panel h2{font-size:20px;color:#0f172a;margin:0 0 9px}#gs-route-panel p{font-size:12px;line-height:1.6;color:#64748b;margin:0 0 14px}
#gs-route-panel a{display:block;margin:5px 0;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;color:#334155;background:#f8fafc;text-decoration:none;font:500 13px Inter,Arial,sans-serif}
#gs-route-panel a.current{background:#dbeafe;color:#0d54a3;border-color:#0e82f8;font-weight:700}
#gs-route-panel .gs-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
#gs-route-panel button{background:#eff6ff;color:#0f172a;border:0;padding:8px 13px;border-radius:9px;cursor:pointer}
#gs-route-panel .gs-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 7px}
body.gs-clean #gs-route-btn{display:none!important}
`;
function init(){
 if(document.getElementById('gs-route-btn'))return;
 const st=document.createElement('style');st.id='gs-route-style';st.textContent=CSS;document.head.appendChild(st);
 if(new URL(location.href).searchParams.get('clean')==='1')document.body.classList.add('gs-clean');
 const btn=document.createElement('button');btn.id='gs-route-btn';btn.textContent='☰ Rotas';btn.type='button';btn.title='Abrir navegação de rotas';
 const wrap=document.createElement('div');wrap.id='gs-route-menu';wrap.innerHTML=`<section id="gs-route-panel" role="dialog" aria-modal="true" aria-label="Telas do site"><div class="gs-head"><h2>Navegação</h2><button id="gs-close" type="button">✕</button></div><div class="gs-grid" id="gs-links"></div><p style="margin-top:17px">Para ocultar o botão de navegação na comparação visual, abra qualquer rota com <code>?clean=1</code>.</p></section>`;
 const links=wrap.querySelector('#gs-links');
 for(const [label,route] of paths){const a=document.createElement('a');a.href=route+(route==='/'?'?clean=0':'');a.textContent=label;if(location.pathname===route)a.className='current';links.append(a)}
 document.body.append(btn,wrap);
 // React Router pode reescrever nós do body durante a inicialização.
 // Manter o menu fora da árvore visual original sem modificar seus módulos.
 const keepMenu=new MutationObserver(()=>{if(!document.body.contains(btn))document.body.append(btn);if(!document.body.contains(wrap))document.body.append(wrap)});
 keepMenu.observe(document.body,{childList:true});
 btn.onclick=()=>wrap.classList.add('gs-visible');wrap.querySelector('#gs-close').onclick=()=>wrap.classList.remove('gs-visible');wrap.onclick=e=>{if(e.target===wrap)wrap.classList.remove('gs-visible')};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')wrap.classList.remove('gs-visible');if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='m'){e.preventDefault();wrap.classList.toggle('gs-visible')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

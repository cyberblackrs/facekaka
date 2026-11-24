/* Rotas locais recompostas onde os bundles antigos não estavam presentes.
   Mantém a navegação do projeto em funcionamento sem consumir API ou criar
   informações privadas fictícias. Usam apenas o perfil público já armazenado. */
import { p as jsx } from './chunk-EPOLDU6W-CkoexLYk.js';

const h=jsx.jsx, hs=jsx.jsxs;
const flows={
  'white-page':{theme:'light',step:0,title:'Continuar análise',subtitle:'Confira o perfil que você selecionou para continuar.',back:'/',next:'/inicio1',button:'Continuar'},
  inicio1:{step:1,title:'Perfil selecionado',subtitle:'Confira as informações públicas carregadas para este perfil.',back:'/',next:'/inicio2',button:'Próxima etapa'},
  inicio2:{step:2,title:'Publicações',subtitle:'Explore as publicações disponíveis na prévia.',back:'/inicio1',next:'/inicio3',button:'Continuar'},
  inicio3:{step:3,title:'Interações',subtitle:'Confira os recursos e as informações disponíveis nesta experiência.',back:'/inicio2',next:'/inicio4',button:'Continuar'},
  inicio4:{step:4,title:'Próxima etapa',subtitle:'Tudo pronto para seguir para a tela de acesso.',back:'/inicio3',next:'/cta',button:'Ver acesso VIP'},
  'in-ghostspy':{step:0,title:'Seu perfil',subtitle:'Veja o perfil consultado e as opções de navegação.',back:'/feed',next:'/in-ghostspy/results',button:'Ver resultados'},
  'in-ghostspy-results':{step:0,title:'Resultados',subtitle:'Resumo das informações disponíveis do perfil consultado.',back:'/in-ghostspy',next:'/cta',button:'Continuar'},
  'ghostspy-v2':{step:0,title:'Explorar perfil',subtitle:'Acesse as informações públicas deste perfil.',back:'/feed',next:'/ghostspy-v2/results',button:'Ver resultados'},
  'ghostspy-v2-results':{step:0,title:'Resultados do perfil',subtitle:'Confira o perfil e continue para a próxima etapa.',back:'/ghostspy-v2',next:'/cta',button:'Ver opções de acesso'},
  'ghostspy-v2-backredirect':{step:0,title:'Continuar',subtitle:'Escolha se deseja retornar ao Feed ou seguir para o acesso.',back:'/feed',next:'/cta',button:'Continuar'},
};
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
function data(){
  const search=new URLSearchParams(location.search);
  const wanted=(search.get('username')||localStorage.getItem('espionado_username')||localStorage.getItem('username')||'').trim();
  const p=read('instagram_profile')||read('gs_last_rapidapi_profile')||{};
  const matched=String(p.username||'').toLowerCase()===wanted.toLowerCase();
  return {
    username: wanted||'perfil',
    name:matched?(p.full_name||p.fullName||p.username||wanted):wanted,
    photo:matched && typeof p.profile_pic_url==='string'?p.profile_pic_url:'/images/avatars/perfil-sem-foto.jpeg',
    posts:matched&&Number.isFinite(Number(p.media_count))?p.media_count:null,
    followers:matched&&Number.isFinite(Number(p.follower_count))?p.follower_count:null,
    following:matched&&Number.isFinite(Number(p.following_count))?p.following_count:null,
  };
}
function url(path){
  const params=new URLSearchParams(location.search);
  const u=data().username;
  if(!params.has('username')&&u!=='perfil')params.set('username',u);
  const query=params.toString();
  return path+(query?'?'+query:'');
}
const stat=(value,label)=>hs('div',{className:'gs-recovery-stat',children:[h('strong',{children:value==null?'—':Number(value).toLocaleString('pt-BR')}),h('span',{children:label})]});
function card(p){return hs('div',{className:'gs-recovery-profile',children:[
  h('img',{src:p.photo,alt:'Foto pública do perfil',className:'gs-recovery-avatar',onError:ev=>{ev.currentTarget.onerror=null;ev.currentTarget.src='/images/avatars/perfil-sem-foto.jpeg'}}),
  hs('div',{className:'gs-recovery-user',children:[h('strong',{children:p.name}),h('small',{children:'@'+p.username})]})
]});}
export function buildRoute(name){
  const cfg=flows[name]||flows['white-page'];const p=data();
  const step=cfg.step;
  return hs('main',{className:'gs-recovery'+(cfg.theme==='light'?' gs-recovery-light':''),children:[
    hs('header',{className:'gs-recovery-header',children:[
      h('a',{href:url('/'),className:'gs-recovery-brand',children:'GhostSpy'}),
      h('a',{href:url('/feed'),className:'gs-recovery-toplink',children:'Voltar ao Feed'})
    ]}),
    hs('section',{className:'gs-recovery-panel',children:[
      step>0&&hs('div',{className:'gs-recovery-progress',children:[h('span',{children:`Etapa ${step} de 4`}),h('div',{className:'gs-recovery-progress-track',children:h('i',{style:{width:`${step*25}%`}})})]}),
      h('h1',{children:cfg.title}),
      h('p',{className:'gs-recovery-description',children:cfg.subtitle}),
      card(p),
      hs('div',{className:'gs-recovery-stats',children:[stat(p.posts,'Publicações'),stat(p.followers,'Seguidores'),stat(p.following,'Seguindo')]}),
      hs('div',{className:'gs-recovery-actions',children:[
        h('a',{href:url(cfg.back),className:'gs-recovery-back',children:'Voltar'}),
        h('a',{href:url(cfg.next),className:'gs-recovery-next',children:cfg.button})
      ]})
    ]})
  ]});
}

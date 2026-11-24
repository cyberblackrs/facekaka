import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p),'utf8');
const manifest=JSON.parse(read('assets/manifest-958455cb.js').replace(/^window.__reactRouterManifest=/,'').replace(/;\s*$/,''));
const requiredRoutes=['/','/feed','/direct','/chat/:chatId','/notifications','/cta','/white-page','/inicio1','/inicio2','/inicio3','/inicio4','/in-ghostspy','/in-ghostspy/results','/ghostspy-v2','/ghostspy-v2/results','/ghostspy-v2/backredirect'];

test('todas as 16 rotas e componentes estão declarados e disponíveis localmente',()=>{
  const paths=new Set(Object.values(manifest.routes).map(r=>r.index?'/':'/'+(r.path||'')));
  assert.equal(Object.keys(manifest.routes).length>=requiredRoutes.length,true);
  for(const route of requiredRoutes){assert(paths.has(route),`Falta rota ${route}`)}
  for(const [key,route] of Object.entries(manifest.routes)){
    const module=route.module.split('?')[0].replace(/^\//,'');
    assert(existsSync(resolve(root,module)),`Falta componente local ${key}: ${module}`);
    for(const file of route.imports||[])
      assert(existsSync(resolve(root,file.replace(/^\//,''))),`Falta import do módulo ${key}: ${file}`);
  }
});

test('CTA existe, Feed não aponta mais para /cta/ e banner permanece clicável',()=>{
  assert(existsSync(resolve(root,'assets/cta-ghost-final.js')));
  const feed=read('assets/feed-CMXMV7Sa.js');
  assert(!feed.includes('`/cta/${window.location.search || ""}`'));
  assert(!feed.includes('`/cta/?${a.toString()}`'));
  assert(feed.includes('`/cta${window.location.search || ""}`'));
  assert(read('assets/PreviewBanner-DpTiVZze.js').includes('onClick: l'));
});

test('Stories não são truncados a cinco placeholders e mantêm rolagem horizontal',()=>{
  const feed=read('assets/feed-CMXMV7Sa.js');
  assert(feed.includes('for (let f = 0; f < 14; f++)'));
  assert(feed.includes('slice(0, 14)'));
  const css=read('assets/root-zQuPsh3d.css');
  assert(css.includes('.fd-story-tray{overflow-x:auto!important'));
});

test('faixa original de prévia em gradiente cobre a navegação inferior sem duplicar avisos',()=>{
  const css=read('assets/root-zQuPsh3d.css');
  assert(css.includes('.fd-screen .fd-bottom-nav {display:none !important;}'));
  assert(css.includes('background:linear-gradient(112deg,#f09433'));
  assert(css.includes('bottom:0 !important'));
  assert(css.includes('z-index:9999 !important'));
  assert(!read('index.html').includes('Nenhuma conta carregada'));
});

test('CTA e 10 módulos ausentes podem ser importados sem React quebra de sintaxe',async()=>{
  globalThis.location={search:'?username=danxelly'};
  globalThis.localStorage={getItem:k=>k==='instagram_profile'?JSON.stringify({username:'danxelly',full_name:'Danxelly',media_count:29,following_count:998,follower_count:2058}):'danxelly'};
  const moduleFiles=[...Object.values(manifest.routes).map(r=>r.module.split('?')[0].replace(/^\//,''))];
  for(const file of moduleFiles){
    // Importa os que foram reconstruídos; as demais rotas têm bundling original.
    if(!read(file).includes("buildRoute("))continue;
    const mod=await import('../'+file);
    const result=mod.default();
    assert.equal(result.type,'main',`${file} não renderizou um componente`);
  }
});

test('respostas HTTP de CTA, barra de navegação, e os caminhos perdidos',async()=>{
  const port=Number(process.env.TEST_PORT||51889);
  const child=spawn(process.execPath,['dev-server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  try{
    let ready=false;
    for(let i=0;i<60;i++){
      try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){const d=await r.json();assert.equal(d.version,'8.12.2');ready=true;break}}catch{}
      await new Promise(done=>setTimeout(done,50));
    }
    assert(ready,'servidor não iniciou');
    const paths=['/','/cta','/feed','/direct','/chat/1','/chat/2','/chat/3','/chat/4','/chat/5','/notifications','/white-page','/inicio1','/inicio2','/inicio3','/inicio4','/in-ghostspy','/in-ghostspy/results','/ghostspy-v2','/ghostspy-v2/results','/ghostspy-v2/backredirect'];
    for(const path of paths){
      const r=await fetch(`http://127.0.0.1:${port}${path}`,{redirect:'manual'});
      assert.equal(r.status,200,`${path}: status ${r.status}`);
      assert.match(r.headers.get('content-type')||'',/text\/html/,`${path}: HTML esperado`);
    }
    for(const path of ['/cta/','/back-redirect']){
      const r=await fetch(`http://127.0.0.1:${port}${path}`,{redirect:'manual'});
      assert([302,308].includes(r.status),`${path}: status ${r.status}`);
      assert(r.headers.get('location')?.startsWith('/cta'));
    }
    for(const path of ['assets/white-page-BfOhVZOs.js','assets/inicio1-CtGIMaOY.js','assets/ghostspy-v2-backredirect-qi9BgUjG.js','assets/cta-ghost-final.js','assets-local/route-recovery.css']){
      const r=await fetch(`http://127.0.0.1:${port}/${path}`);
      assert.equal(r.status,200,`${path}: ${r.status}`);
    }
    const env=await fetch(`http://127.0.0.1:${port}/.env`);assert.equal(env.status,404);
  }finally{child.kill('SIGTERM')}
});

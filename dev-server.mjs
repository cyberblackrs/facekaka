/**
 * Servidor de desenvolvimento local (Node 20+, sem dependências).
 * Produção: Vercel, por meio do vercel.json e api/index.mjs.
 * Nunca publica RAPIDAPI_KEY: serve apenas os arquivos públicos enumerados.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/index.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
function loadEnv(filename) {
  const p=resolve(ROOT,filename);
  if(!existsSync(p)) return;
  const content=readFileSync(p,'utf8');
  for(const line of content.split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*?)\s*$/);
    if(!match || !['RAPIDAPI_KEY','HIKERAPI_KEY','RAPIDAPI_BASIC_HOST','SAFIPAY_WEBHOOK_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'].includes(match[1]) || process.env[match[1]])continue;
    let value=match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value=value.slice(1,-1);
    process.env[match[1]]=value;
  }
}
loadEnv('.env.local');
loadEnv('.env');

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const FILES=new Set(['obrigado.html','obrigado.css','assets-local/notes/pessoa-01.jpg','assets-local/notes/pessoa-02.jpg','assets-local/notes/pessoa-03.jpg','assets-local/notes/pessoa-04.jpg','assets-local/notes/pessoa-05.jpg','assets-local/notes/pessoa-06.jpg','assets-local/notes/pessoa-07.jpg','assets-local/notes/pessoa-08.jpg','index.html','age-gate.css','age-gate.js','consulta-rapidapi.js','atualizar-seguidos.js','notas-publicas.js','chat-nome.js','geo-context.js','instagram-dark-ui.js','seguranca.js','rotas.js','estado-navegacao.js','assets-local/ghost-theme.css','assets-local/instagram-wordmark.svg','assets-local/route-recovery.css','assets-local/stories/story-01.jpg','assets-local/stories/story-02.jpg','assets-local/stories/story-03.jpg','assets-local/stories/story-04.jpg','assets-local/stories/story-05.jpg','assets-local/stories/story-06.jpg','assets-local/stories/story-07.jpg','assets-local/stories/story-08.jpg','assets-local/stories/story-09.jpg','assets-local/stories/story-10.jpg','assets-local/stories/story-11.jpg','assets-local/stories/story-12.jpg','assets-local/stories/story-13.jpg','assets-local/stories/story-14.jpg','assets-local/stories/story-15.jpg','assets-local/stories/story-16.jpg']);
const ROUTES=new Set(['/','/feed','/direct','/notifications','/cta','/white-page','/inicio1','/inicio2','/inicio3','/inicio4','/in-ghostspy','/in-ghostspy/results','/ghostspy-v2','/ghostspy-v2/results','/ghostspy-v2/backredirect']);
function respond(res,status,message,mime='text/plain; charset=utf-8') {
 res.statusCode=status;
 res.setHeader('Content-Type',mime);
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','SAMEORIGIN');
 res.setHeader('X-XSS-Protection','1; mode=block');
 res.setHeader('Referrer-Policy','no-referrer');
 res.end(message);
}
async function remoteAsset(req,res,path,search) {
  if(req.method!=='GET' && req.method!=='HEAD')return respond(res,405,'Método não permitido');
  const url=`https://stalkeia.ai${path}${search}`;
  try{
    const upstream=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; GhostSpy Visual Dev Preview)'},redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!upstream.ok)return respond(res,upstream.status,`Asset remoto indisponível (HTTP ${upstream.status}).`);
    res.statusCode=upstream.status;
    res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
    res.setHeader('Cache-Control','public, max-age=60');
    const ab=await upstream.arrayBuffer();
    res.end(req.method==='HEAD'?undefined:Buffer.from(ab));
  }catch(e){respond(res,502,'Não foi possível baixar o asset público do site de referência. Verifique a conexão.');}
}
const PORT=Number(process.env.PORT||5173);
// Only bundled public assets can be read here; configuration remains server-only.
const BUNDLED_ASSETS=new Set(existsSync(resolve(ROOT,'assets')) ? readdirSync(resolve(ROOT,'assets')).filter(name=>/\.(?:js|css)$/.test(name)).map(name=>'/assets/'+name) : []);
const server=createServer(async(req,res)=>{
 try{
  const target=new URL(req.url||'/',`http://127.0.0.1:${PORT}`);
  const pathname=target.pathname.replace(/\/+$/,'') || '/';
  if(pathname!==target.pathname){res.statusCode=308;res.setHeader('Location',pathname+target.search);res.setHeader('Cache-Control','no-store');return res.end();}
  if(pathname==='/back-redirect'){res.statusCode=302;res.setHeader('Location','/cta'+target.search);return res.end();}
  if(pathname.startsWith('/api/')){
    const names={'/api/webhooks/safipay':'safipay_webhook','/api/payment/status':'payment_status','/api/avatar':'avatar','/api/health':'health','/api/diagnostics':'diagnostics','/api/profile':'profile','/api/location':'location','/api/following':'following','/api/followers':'followers','/api/posts':'posts','/api/proxy/instagram.php':'instagram','/api/proxy/hikerapi.php':'compat','/api/proxy/leads.php':'leads'};
    const name=names[pathname]||(pathname==='/api/index'?target.searchParams.get('handler'):null);
    if(!name)return respond(res,404,'API desconhecida');
    req.query={...Object.fromEntries(target.searchParams.entries()),handler:name};
    return await handler(req,res);
  }
  if(pathname.startsWith('/assets/')||pathname.startsWith('/images/')||pathname==='/favicon.png'){
    if(BUNDLED_ASSETS.has(pathname))return respond(res,200,readFileSync(resolve(ROOT,pathname.slice(1))),MIME[extname(pathname)]);
    return await remoteAsset(req,res,pathname,target.search);
  }
  let file=null;
  if(pathname==='/obrigado')file='obrigado.html';
  else if(ROUTES.has(pathname)||/^\/chat\/[1-5]$/.test(pathname))file='index.html';
  else if(FILES.has(pathname.slice(1)))file=pathname.slice(1);
  if(!file)return respond(res,404,'Não encontrado');
  if(req.method!=='GET' && req.method!=='HEAD')return respond(res,405,'Método não permitido');
  const body=readFileSync(resolve(ROOT,file));
  res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('X-XSS-Protection','1; mode=block');
  res.setHeader('Referrer-Policy','no-referrer');
  res.statusCode=200;
  res.end(req.method==='HEAD'?undefined:body);
 }catch(e){console.error('Erro no servidor:',e?.message);if(!res.headersSent)respond(res,500,'Erro no servidor de desenvolvimento');else res.end();}
});
server.listen(PORT,'127.0.0.1',()=>{
 console.log(`\nGhostSpy V8.12.2 · ambiente local: http://127.0.0.1:${PORT}`);
 console.log(`RapidAPI: ${process.env.RAPIDAPI_KEY && !/COLE_|SUA_CHAVE/i.test(process.env.RAPIDAPI_KEY)?'chave encontrada no ambiente':'adicione RAPIDAPI_KEY ao .env.local'}`);
 console.log(`HikerAPI: ${process.env.HIKERAPI_KEY?'token encontrado no ambiente':'token não configurado'} (nenhuma consulta prévia realizada)`);
 console.log('Para produção, cadastre RAPIDAPI_KEY e HIKERAPI_KEY nas variáveis de ambiente da Vercel.\n');
});

server.on('error',error=>{
 if(error.code==='EADDRINUSE'){
   console.error(`\nA porta ${PORT} já está ocupada. Encerre o outro servidor (Ctrl+C) ou use outra porta com: set PORT=5174 && npm run dev\n`);
   process.exitCode=1;
   return;
 }
 console.error(error);process.exitCode=1;
});

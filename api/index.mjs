import {getProfile,getComplete,getFollowing,getFollowers,getPostsById,normalizeUsername,getProviderStatus,configuredProfileProviders} from '../lib/rapidapi.mjs';
import {getVisitorLocation} from '../lib/location.mjs';
import {fetchAvatar,allowedAvatarURL} from '../lib/avatar.mjs';

const hits=new Map(),cache=new Map(),inflight=new Map(),followingDiagnostics=new Map(),recentFailures=new Map(),lastPartialComplete=new Map();
function clientIP(req){return String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'anonymous').split(',')[0].trim()}
function checkRate(req){
  const key=clientIP(req),now=Date.now(),entry=hits.get(key)||{since:now,n:0};
  if(now-entry.since>=60_000){entry.since=now;entry.n=0;}
  entry.n++;hits.set(key,entry);if(hits.size>2000)hits.clear();
  return entry.n<=60;
}
function send(res,code,data,{maxAge=0}={}) {
  res.statusCode=code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control',maxAge?`public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`:'no-store');
  res.end(JSON.stringify(data));
}
async function memo(key,ms,work,{cacheIf=()=>true}={}){
  const current=cache.get(key),now=Date.now();
  if(current?.expires>now)return current.value;
  const lastFailure=recentFailures.get(key);
  if(lastFailure?.until>now){
    // Falhou por quota/limite? Não disparar novas chamadas ao mesmo fornecedor.
    if(current?.staleUntil>now)return {...current.value,stale:true};
    throw lastFailure.error;
  }
  if(inflight.has(key))return inflight.get(key);
  const task=Promise.resolve().then(work).then(value=>{
    if(cache.size>500)cache.clear();
    if(cacheIf(value))cache.set(key,{expires:Date.now()+ms,staleUntil:Date.now()+86400000,value});
    recentFailures.delete(key);
    return value;
  }).catch(error=>{
    // Somente falhas temporárias são armazenadas por segundos.
    if([429,502,503].includes(Number(error?.status))){
      recentFailures.set(key,{until:Date.now()+Math.max(15000,Math.min(120000,(error.retryAfter||30)*1000)),error});
      if(current?.staleUntil>now)return {...current.value,stale:true};
    }
    throw error;
  }).finally(()=>inflight.delete(key));
  inflight.set(key,task);return task;
}

const message=e=>String(e?.message||'Não foi possível consultar o serviço.').slice(0,160);
export default async function handler(req,res){
  const url=new URL(req.url||'/', 'https://app.invalid');
  const kind=String(req.query?.handler||url.searchParams.get('handler')||'profile');
  if(!['GET','HEAD','POST'].includes(req.method))return send(res,405,{error:'Método não permitido.'});
  if(kind==='health')return send(res,200,{ok:true,version:'8.12.2',hiker_configured:Boolean(process.env.HIKERAPI_KEY)});
  // Apenas recupera imagens de CDN: ZERO requisições à RapidAPI/HikerAPI.
  if(kind==='avatar'){
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Método não permitido.'});
    const source=String(req.query?.src||url.searchParams.get('src')||'');
    if(!allowedAvatarURL(source))return send(res,400,{error:'Host de imagem não autorizado.'});
    try{
      const image=await fetchAvatar(source);
      res.statusCode=200;
      res.setHeader('Content-Type',image.contentType);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Cache-Control','public, max-age=1200, s-maxage=1200');
      return res.end(req.method==='HEAD'?undefined:image.body);
    }catch(e){return send(res,Number(e?.status)||404,{error:'Foto de perfil temporariamente indisponível.'})}
  }
  if(kind==='diagnostics') {
    const sought=String(req.query?.username||url.searchParams.get('username')||'').replace(/^@/,'').toLowerCase();
    if(!/^[a-z0-9._]{1,30}$/.test(sought))return send(res,400,{error:'Informe ?username=perfil'});
    const entry=cache.get('complete:'+sought);
    const profile=cache.get('profile:'+sought)?.value;
    const following=profile?.pk ? cache.get('following:'+profile.pk)?.value : null;
    const recorded=followingDiagnostics.get(sought);
    if((!entry||entry.expires<Date.now()) && !following && !recorded && !recentFailures.get('profile:'+sought))return send(res,404,{error:'Sem consulta desse perfil em cache. Pesquise na home.',providers:getProviderStatus().providers});
    const partial=lastPartialComplete.get(sought);
    const info=entry?.expires>Date.now()?entry.value:(partial?.expires>Date.now()?partial.value:null);
    const people=Array.isArray(following)?following:(info?.chaining_results||[]);
    const outcome=info?.results?.find(item=>item.source==='rapidapi');
    const following_check=recorded || (outcome?.following==='unavailable'
      ? {status:'error',message:outcome.following_error||'O fornecedor não retornou contas seguidas.',...(outcome.following_response_shape?{response_shape:outcome.following_response_shape}:{})}
      : outcome?.following==='ok'||Array.isArray(following)
        ? {status:'ok',count:people.length}
        : {status:'not_checked'});
    const pic=String(profile?.profile_pic_url||info?.profile_pic_url||'');
    const photo_status={received_from_provider:/^https:\/\//.test(pic),proxy_supported:allowedAvatarURL(pic),is_placeholder:!pic||pic.includes('perfil-sem-foto')};
    return send(res,200,{version:'8.12.2',username:sought,is_private:info?.is_private??profile?.is_private??null,photo_status,
      contas:people.length,posts:(info?.posts||[]).length,details:info?.results||[],following_provider:recorded?.provider||(process.env.HIKERAPI_KEY?'hikerapi (prioridade)':'instagram-public-data-api1'),hiker_configured:Boolean(process.env.HIKERAPI_KEY),
      following_in_cache:Boolean(following),following_check,profile_id:profile?.pk||info?.pk||null,expected_following_count:profile?.following_count??info?.following_count??null,configured:Boolean(process.env.RAPIDAPI_KEY),providers:getProviderStatus(),profile_error:recentFailures.get('profile:'+sought)?.error?.providerFailures||null});
  }
  // Chamadas de health, leads, location e diagnostics NÃO consomem o limitador de perfil.
  // Consultas já cacheadas também não devem impedir a navegação.
  const requested=String(req.query?.username||url.searchParams.get('username')||'').toLowerCase();
  const hasProfileCache=cache.get('profile:'+requested)?.expires>Date.now();
  const hasCompleteCache=cache.get('complete:'+requested)?.expires>Date.now();
  const cachedRequest=(kind==='profile'&&hasProfileCache)||(kind==='instagram'&&((req.query?.tipo==='perfil'&&hasProfileCache)||(req.query?.tipo==='busca_completa'&&hasCompleteCache)));
  const chargeRate=['profile','instagram','posts','following','followers','compat'].includes(kind) && !cachedRequest;
  if(chargeRate && !checkRate(req)){
    res.setHeader('X-RateLimit-Origin','local');
    res.setHeader('Retry-After','60');
    return send(res,429,{error:'Limite de segurança local por minuto. Aguarde e tente de novo.',origin:'local',retry_after:60});
  }
  if(kind==='leads'){
    // Sem rastreamento de visitantes nem bloqueio por IP. Contrato legado do frontend.
    return send(res,200,{success:true,exists:false,canSearch:true,leadId:null});
  }
  if(kind==='location'){
    if(req.method!=='GET')return send(res,405,{error:'Método não permitido.'});
    return send(res,200,await getVisitorLocation(req));
  }
  if(req.method!=='GET')return send(res,405,{error:'Método não permitido.'});
  try {
    const read=name=>req.query?.[name]??url.searchParams.get(name);
    if(kind==='compat'){
      const path=String(read('path')||'');
      if(path==='/v2/user/by/username'){const h=normalizeUsername(read('username'));return send(res,200,{user:await memo('profile:'+h.toLowerCase(),900000,()=>getProfile(h))});}
      if(path==='/v2/user/following')return send(res,200,{response:{users:[]},mode:'visual_placeholder'});
      if(path==='/g2/user/medias')return send(res,200,{response:{items:await memo('posts:'+read('user_id'),900000,()=>getPostsById(read('user_id')||''))}});
      return send(res,404,{error:'Rota indisponível.'});
    }
    if(!['profile','instagram','following','followers','posts'].includes(kind))return send(res,404,{error:'Rota desconhecida.'});
    const handle=normalizeUsername(read('username'));
    const tipo=String(read('tipo')||'');
    const complete=tipo==='busca_completa'||tipo==='all'||read('complete')==='1';
    if(kind==='followers'||kind==='following'){
      const key=handle.toLowerCase();
      // Sem ID fixo: aproveita o cache do perfil; se faltar, consulta o @ digitado.
      const profile=await memo('profile:'+key,900000,()=>getProfile(handle));
      if(profile.is_private)return send(res,403,{error:'Lista não disponível para perfil privado.'});
      const work=kind==='following'?getFollowing:getFollowers;
      let users;
      try {
        users=await memo(kind+':'+profile.pk,3600000,()=>work(handle,profile.pk,{expectedCount:kind==='following'?profile.following_count:undefined,onProvider:provider=>followingDiagnostics.set(key,{status:'ok',provider,count:0,at:new Date().toISOString()})}),
          {cacheIf:users=>Array.isArray(users)&&(users.length>0 || kind==='followers'||profile.following_count===0)});
        if(kind==='following')followingDiagnostics.set(key,{status:'ok',count:users.length,provider:followingDiagnostics.get(key)?.provider||(process.env.HIKERAPI_KEY?'hikerapi':'rapidapi'),at:new Date().toISOString()});
      } catch(err){
        if(kind==='following')followingDiagnostics.set(key,{status:err.origin==='provider_empty'?'empty_unverified':'error',provider:err.provider||null,attempts:err.providerFailures||[],message:message(err),
          ...(err.responseShape?{response_shape:err.responseShape}:{}),at:new Date().toISOString()});
        throw err;
      }
      return send(res,200,{users,source:kind==='following'?(followingDiagnostics.get(key)?.provider||'rapidapi'):'rapidapi',provider:kind==='following'?(followingDiagnostics.get(key)?.provider||'rapidapi'):'instagram-public-data-api1',username:profile.username},{maxAge:900});
    }
    if(kind==='posts'){
      const profile=await memo('profile:'+handle.toLowerCase(),900000,()=>getProfile(handle));
      const posts=await memo('posts:'+profile.pk,900000,()=>Array.isArray(profile.recent_posts)&&profile.recent_posts.length>0?profile.recent_posts:getPostsById(profile.pk));
      return send(res,200,{posts,source:'rapidapi'},{maxAge:300});
    }
    const cacheKey=(complete?'complete:':'profile:')+handle.toLowerCase();
    const data=await memo(cacheKey,complete?900000:900000,async()=>{
      if(!complete)return getProfile(handle);
      const profile=await memo('profile:'+handle.toLowerCase(),900000,()=>getProfile(handle));
      const result=await getComplete(handle,{profile,
        // Notas ilustrativas: nunca consulta following durante a busca completa.
        getFollowingImpl:async()=>[],
        getPostsImpl:(id)=>memo('posts:'+id,900000,()=>getPostsById(id))});
      result.following_mode='illustrative_no_request';
      for(const row of result.results||[]){
        if(row.source==='rapidapi'){
          row.following='skipped_visual_placeholder';
          row.following_error=null;
          row.following_count=0;
        }
      }
      return result;
    },{cacheIf:value=>!complete||value.error_count===0});
    if(complete && Array.isArray(data.following) && data.following.length>0){const rec=followingDiagnostics.get(handle.toLowerCase());if(rec?.status==='ok')followingDiagnostics.set(handle.toLowerCase(),{...rec,count:data.following.length});}
    if(complete){if(data.error_count>0)lastPartialComplete.set(handle.toLowerCase(),{value:data,expires:Date.now()+10*60*1000});else lastPartialComplete.delete(handle.toLowerCase());}
    if(tipo==='all')return send(res,200,{success:true,profile:data,...data},{maxAge:300});
    return send(res,200,data,{maxAge:complete?300:120});
  }catch(error){
    const code=[400,401,403,404,408,422,429,502,503].includes(Number(error?.status))?Number(error.status):502;
    if(error?.origin==='rapidapi'||error?.origin==='provider_cooldown'||error?.origin==='providers'){
      res.setHeader('X-RateLimit-Origin','rapidapi');
      if(error?.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
    }
    return send(res,code,{error:message(error),origin:error?.origin||'backend',retry_after:error?.retryAfter||null,
      failures:error?.providerFailures||undefined,provider:error?.provider||undefined,
      response_shape:error?.responseShape||undefined});
  }
}

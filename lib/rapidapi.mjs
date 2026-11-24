/**
 * Gateway de dados públicos. Todos os requests para RapidAPI acontecem no backend.
 * Nenhum dado ou mensagem privada é consultado. Não gera perfis/posts fictícios.
 */
export const HOST = 'instagram-pro-and-cheap-api.p.rapidapi.com';
export const SOCIAL_HOST = 'instagram-public-data-api1.p.rapidapi.com';
export const BASE = `https://${HOST}`;
export const ENGAGEMENT_HOST = 'ig-public-data-api-profile-posts-engagement.p.rapidapi.com';
export const HIKER_HOST = 'api.hikerapi.com';
// Basic Profile Info: o host exato depende do provedor exibido no Playground.
// Somente habilitar com RAPIDAPI_BASIC_HOST, após confirmá-lo, sem adivinhar endereço.
const circuits = new Map();
const recentAttempts = [];
function track(provider, status, error=null) {
  recentAttempts.push({provider,status,at:new Date().toISOString(),...(error?{reason:String(error).slice(0,120)}:{})});
  if(recentAttempts.length>45)recentAttempts.shift();
}
export function getProviderStatus() {
 const now=Date.now();
 return {providers:[HOST,ENGAGEMENT_HOST,SOCIAL_HOST,...(process.env.RAPIDAPI_BASIC_HOST?[process.env.RAPIDAPI_BASIC_HOST]:[]),HIKER_HOST].map(host=>({host,configured:host===HIKER_HOST?Boolean(process.env.HIKERAPI_KEY):Boolean(process.env.RAPIDAPI_KEY),cooldown_seconds:Math.max(0,Math.ceil(((circuits.get(host)?.until||0)-now)/1000)),last_error:circuits.get(host)?.reason||null})),recent:recentAttempts.slice(-12)};
}
function isValidBasicHost(host) {return typeof host==='string' && /^[a-z0-9][a-z0-9-]*\.p\.rapidapi\.com$/.test(host)}
export function resetProviderState(){circuits.clear();recentAttempts.length=0;}


export function normalizeUsername(raw) {
  const input = String(raw ?? '').trim().replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(input)) {
    throw Object.assign(new Error('Username inválido.'), {status:400});
  }
  return input;
}

const apiError = (message, status=502) => Object.assign(new Error(message), {status});
const pathValue = (source, path) => path.split('.').reduce((value, part) => value?.[part], source);
const pick = (source, fields, fallback='') => {
  for(const field of fields) {
    const value=pathValue(source,field);
    if(value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};
function count(value) {
  if(value === null || value === undefined) return 0;
  if(typeof value === 'object') return count(value.count ?? value.total ?? value.value ?? 0);
  if(typeof value === 'string') {
    const clean=value.replace(/,/g,'').trim();
    const multiplier=/[mM]$/.test(clean)?1e6:/[kK]$/.test(clean)?1e3:1;
    return Math.round((parseFloat(clean)||0)*multiplier);
  }
  return Number(value)||0;
}
function safeImage(value) {
  if(typeof value !== 'string') return '';
  try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch {return ''}
}
// A API pode entregar a foto em um campo simples, um objeto {url}, ou dentro
// de 'response/data'. Não confundir um objeto não vazio com uma URL válida.
export function findProfilePictures(payload,profile){
  const fields=[
    'profile_pic_url','profile_pic_url_hd','profile_picture_url','profilePicUrl',
    'profilePictureUrl','profile_picture','profile_photo_url','profile_image_url',
    'picture','avatar_url','avatar','profile_pic','image_url',
    'hd_profile_pic_url_info.url','hd_profile_pic_url_info','profile_pic_url_info.url',
    'profile_picture.url','profile_picture.src','profile_pic_url.url',
    'profile_pic_url_hd.url','picture.data.url','picture.url','avatar.url',
    'user.profile_pic_url','user.profile_picture_url','owner.profile_pic_url'
  ];
  const entries=[profile,payload?.response?.user,payload?.data?.profile,payload?.profile,
    payload?.data?.user,payload?.user,payload?.data,payload?.response,payload];
  const pictures=[];
  const add=value=>{
    if(value&&typeof value==='object'&&!Array.isArray(value)){
      add(value.url||value.src||value.uri||value.value||value.image_url);return;
    }
    const url=safeImage(value);
    if(url&&!pictures.includes(url))pictures.push(url);
  };
  for(const entry of entries){
    if(!entry||typeof entry!=='object')continue;
    for(const path of fields)add(pathValue(entry,path));
  }
  return pictures.slice(0,5);
}

/** HikerAPI REST: endpoint oficial https://api.hikerapi.com/g2/user/following.
 * Usa x-access-key no servidor. Sem endpoint de saldo, polling ou pré-teste.
 * O fetchImpl opcional existe SOMENTE para testes locais simulados. */
export async function requestHiker(path,params={},options={}) {
  const key=options.hikerKey ?? process.env.HIKERAPI_KEY;
  if(!key || /^(?:SUA_CHAVE|COLE_AQUI|YOUR_KEY)/i.test(String(key))) {
    const err=apiError('HIKERAPI_KEY não configurada.',503);err.provider=HIKER_HOST;throw err;
  }
  if(!['/g2/user/following','/g2/user/followers'].includes(path))throw apiError('Endpoint HikerAPI não permitido.',400);
  const live=!Object.prototype.hasOwnProperty.call(options,'hikerFetchImpl');
  const circuit=live?circuits.get(HIKER_HOST):null;
  if(circuit?.until>Date.now()){
    const wait=Math.ceil((circuit.until-Date.now())/1000);
    const err=apiError(`HikerAPI em espera temporária (${wait}s).`,429);
    err.provider=HIKER_HOST;err.origin='provider_cooldown';err.retryAfter=wait;throw err;
  }
  const url=new URL(path,`https://${HIKER_HOST}`);
  for(const [name,value] of Object.entries(params))if(value!==undefined&&value!==null)url.searchParams.set(name,String(value));
  const fetchImpl=options.hikerFetchImpl??fetch;
  let response;
  try {
    response=await fetchImpl(url,{method:'GET',redirect:'error',headers:{'x-access-key':String(key),'Accept':'application/json'},signal:AbortSignal.timeout(18000)});
  }catch(e){
    const err=apiError(e?.name==='TimeoutError'?'HikerAPI excedeu o tempo de resposta.':'Não foi possível conectar à HikerAPI.',502);
    err.provider=HIKER_HOST;err.origin='network';track(HIKER_HOST,'network',err.message);throw err;
  }
  let raw=null;try{raw=await response.json()}catch{}
  const status=Number(response.status??(response.ok?200:502));
  const detail=typeof raw?.detail==='string'?raw.detail:typeof raw?.error==='string'?raw.error:typeof raw?.message==='string'?raw.message:'';
  if(!response.ok || raw?.success===false || raw?.status==='error'){
    let retryAfter=Number(response.headers?.get?.('retry-after'));
    if(!Number.isFinite(retryAfter)||retryAfter<1)retryAfter=status===429?60:status>=500?20:0;
    const delay=status===401?600:status===403?300:retryAfter;
    if(live&&(status===429||status===401||status===403||status>=500))circuits.set(HIKER_HOST,{until:Date.now()+delay*1000,reason:`HTTP ${status}: ${detail.slice(0,100)}`});
    const err=apiError(`HikerAPI HTTP ${status}${detail?': '+detail.slice(0,105):''}`,[400,401,403,404,422,429,502,503].includes(status)?status:502);
    err.provider=HIKER_HOST;err.origin='hikerapi';err.retryAfter=retryAfter;track(HIKER_HOST,'error',err.message);
    throw err;
  }
  if(raw===null){const err=apiError('HikerAPI não retornou JSON válido.',502);err.provider=HIKER_HOST;throw err;}
  if(live)circuits.delete(HIKER_HOST);
  track(HIKER_HOST,'ok');return raw;
}

/** HTTP client: credencial só no backend, JSON/form, timeout e motivo do bloqueio. */
export async function requestRapid(path,params={},options={}) {
  const {fetchImpl=fetch,key=process.env.RAPIDAPI_KEY,host=HOST,method='GET',timeout=14000,bodyType='form'}=options;
  if(!key || /^(?:SUA_CHAVE|COLE_AQUI|YOUR_KEY)/i.test(String(key)))throw apiError('RAPIDAPI_KEY não configurada no servidor.',503);
  const allowed=[HOST,SOCIAL_HOST,ENGAGEMENT_HOST];
  if(isValidBasicHost(process.env.RAPIDAPI_BASIC_HOST))allowed.push(process.env.RAPIDAPI_BASIC_HOST);
  if(!allowed.includes(host))throw apiError('Provedor de API não permitido.',400);
  if(!/^\/[a-zA-Z0-9/_\-.]+\/?$/.test(path))throw apiError('Endpoint inválido.',400);
  const applyCircuit=!Object.prototype.hasOwnProperty.call(options,'fetchImpl')||options.enableCircuit===true;
  const cachedCircuit=applyCircuit?circuits.get(host):null;
  if(cachedCircuit?.until>Date.now()){
    const err=apiError(`Provedor em espera temporária (${Math.ceil((cachedCircuit.until-Date.now())/1000)}s).`,429);
    err.provider=host;err.origin='provider_cooldown';err.retryAfter=Math.ceil((cachedCircuit.until-Date.now())/1000);
    throw err;
  }
  const url=new URL(path,`https://${host}`);
  const values=Object.entries(params).filter(([,value])=>value!==undefined&&value!==null);
  const headers={'X-RapidAPI-Key':String(key),'X-RapidAPI-Host':host,'Accept':'application/json'};
  const upper=method.toUpperCase();
  const init={method:upper,redirect:'error',headers,signal:AbortSignal.timeout(timeout)};
  if(upper==='POST') {
    if(bodyType==='json') {headers['Content-Type']='application/json';init.body=JSON.stringify(Object.fromEntries(values));}
    else {headers['Content-Type']='application/x-www-form-urlencoded';init.body=new URLSearchParams(values.map(([k,v])=>[k,String(v)])).toString();}
  }else for(const [k,v] of values)url.searchParams.set(k,String(v));
  let response;
  try {response=await fetchImpl(url,init)}catch(error) {
    const err=apiError(error?.name==='TimeoutError'?'Tempo limite da RapidAPI.':'Não foi possível consultar a RapidAPI.');
    err.provider=host;err.origin='network';track(host,'network',err.message);
    throw err;
  }
  let value=null;try{value=await response.json()}catch{}
  const httpStatus=Number(response.status|| (response.ok?200:502));
  const errorValue=value?.error;
  const hasApplicationError=Boolean(errorValue || value?.success===false || value?.status==='error');
  if(!response.ok || hasApplicationError){
    const errorCode=String(errorValue?.code||value?.code||'');
    const rawMessage=typeof errorValue==='string'?errorValue:String(errorValue?.message||value?.message||'');
    const descriptions={400:'Parâmetros recusados pelo fornecedor.',401:'Chave RapidAPI inválida.',403:'A assinatura não dá acesso a esse endpoint.',404:'Perfil ou endpoint não encontrado.',408:'Tempo esgotado.',422:'Conteúdo indisponível.',429:'Limite temporário ou de cota do fornecedor.',502:'Falha temporária no fornecedor.',503:'Serviço do fornecedor indisponível.'};
    const code=hasApplicationError&&response.ok?( /limit|quota|rate|429|too many|exceed|not charged|later/i.test(rawMessage)?429:502 ):httpStatus;
    let retryAfter=Number(response.headers?.get?.('retry-after'));
    if(!Number.isFinite(retryAfter)||retryAfter<=0)retryAfter=code===429?60:code>=500?20:0;
    const until=Date.now()+Math.min(3600,Math.max(0,retryAfter))*1000;
    if(code===429||code===403||code===401||code>=500){
      const delay=code===401?600:code===403?300:retryAfter;
      if(applyCircuit)circuits.set(host,{until:Date.now()+delay*1000,reason:`HTTP ${httpStatus}: ${rawMessage.slice(0,105)||descriptions[code]||'erro'}`});
    }
    const err=apiError((code===403?`${descriptions[403]} ${rawMessage}`:(rawMessage||descriptions[code]||`RapidAPI HTTP ${httpStatus}`)).slice(0,160),[400,401,403,404,408,422,429,502,503].includes(code)?code:502);
    err.provider=host;err.origin='rapidapi';err.retryAfter=retryAfter;err.upstreamStatus=httpStatus;err.upstreamCode=errorCode;
    track(host,'error',`HTTP ${httpStatus} ${rawMessage}`);
    throw err;
  }
  if(value===null) {const err=apiError('Fornecedor não retornou JSON válido.');err.provider=host;throw err;}
  if(applyCircuit)circuits.delete(host);track(host,'ok');
  return value;
}

export function publicProfileCity(profile) {
  if(!profile || typeof profile !== 'object')return null;
  const clean=value=>{
    if(typeof value !== 'string')return null;
    const city=value.trim();
    return city.length>=2 && city.length<=80 && /^[\p{L}\p{M}][\p{L}\p{M} .,'’–-]*$/u.test(city) ? city : null;
  };
  // Only explicit public city fields; never use address coordinates, IP or followers.
  for(const value of [profile.business_address_json?.city_name,profile.business_address?.city_name,profile.business_address?.city,profile.public_city,profile.city_name]){
    const city=clean(value);if(city)return {city,source:'public_profile'};
  }
  const bio=profile.biography??profile.bio??'';
  if(typeof bio==='string'){
    for(const line of bio.split(/\r?\n/)){
      const match=line.trim().match(/^📍\s*([\p{L}\p{M}][\p{L}\p{M} .'-]{1,60})\s*[-–,/|]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/iu);
      if(match){const city=clean(match[1]);if(city)return {city:city+' - '+match[2].toUpperCase(),source:'bio'};}
    }
  }
  return null;
}

export function normalizeProfile(payload,soughtUsername) {
  const d=payload?.data?.profile??payload?.profile??payload?.user??payload?.data?.user??payload?.data??payload?.response?.user??payload;
  if(!d || typeof d!=='object' || Array.isArray(d))throw apiError('Formato do perfil não reconhecido.');
  const username=String(pick(d,['username','user_name','handle'],'')).replace(/^@/,'');
  if(!username || username.toLowerCase()!==soughtUsername.toLowerCase()) throw apiError('Perfil retornado não corresponde ao username pesquisado.');
  const id=String(pick(d,['id','pk','user_id','pk_id'],''));
  const pictures=findProfilePictures(payload,d);
  return {
    id,pk:id,username,full_name:String(pick(d,['full_name','fullName','name'],'')),
    biography:String(pick(d,['biography','bio','description'],'')),
    public_city:publicProfileCity(d),
    profile_pic_url:pictures[0]||'/images/avatars/perfil-sem-foto.jpeg',
    profile_picture_candidates:pictures,
    profile_picture_available:pictures.length>0,
    follower_count:count(pick(d,['follower_count','followersCount','followers_count','followers','edge_followed_by.count'],0)),
    following_count:count(pick(d,['following_count','followsCount','following','edge_follow.count'],0)),
    media_count:count(pick(d,['media_count','postsCount','posts_count','posts','edge_owner_to_timeline_media.count'],0)),
    is_private:Boolean(pick(d,['is_private','private'],false)),
    is_verified:Boolean(pick(d,['is_verified','verified'],false)),
    is_business:Boolean(pick(d,['is_business','is_business_account'],false)),
    source:'rapidapi',fetched_at:new Date().toISOString(),
    recent_posts: Array.isArray(payload?.recent_posts)?normalizePosts({items:payload.recent_posts}):Array.isArray(d.recent_posts)?normalizePosts({items:d.recent_posts}):[],
    provider_host: payload?.provider_host||HOST
  };
}

function listFrom(data, fields) {
  if(Array.isArray(data))return data;
  for(const field of fields) {
    const value=pathValue(data,field);
    if(Array.isArray(value) && value.length)return value;
  }
  for(const field of fields) {
    const value=pathValue(data,field);
    if(Array.isArray(value))return value;
  }
  return [];
}

/* Discovery of user arrays without assuming that 'data.users' wins over a
 * populated 'response.users'. Never expose the returned accounts in diagnosis. */
function userRecord(entry) {
  if(!entry || typeof entry!=='object' || Array.isArray(entry))return null;
  let node=entry;
  for(let i=0;i<4;i++) {
    if(typeof node.username==='string'||typeof node.user_name==='string'||typeof node.handle==='string')return node;
    if(node.node && typeof node.node==='object')node=node.node;
    else if(node.user && typeof node.user==='object')node=node.user;
    else if(node.profile && typeof node.profile==='object')node=node.profile;
    else if(node.user_data && typeof node.user_data==='object')node=node.user_data;
    else break;
  }
  return node;
}
function findPeopleList(payload){
  const pending=[{v:payload,path:'root',depth:0}];
  const seen=new WeakSet();let emptyPath=null;let largestCandidate=null;
  const preferred=['users','items','following','followers','edges','user_list','list','results','data','response','result','payload','body','user','graphql'];
  for(let i=0;i<pending.length&&i<160;i++){
    const {v,path,depth}=pending[i];
    if(!v||typeof v!=='object'||seen.has(v)||depth>7)continue;
    seen.add(v);
    if(Array.isArray(v)){
      if(v.length===0){if(!emptyPath)emptyPath=path;continue;}
      const qualifying=v.filter(x=>{
        const u=userRecord(x);
        return u&&typeof (u.username??u.user_name??u.handle)==='string';
      });
      if(qualifying.length){return {list:v,path,hadRecognizedUsers:true};}
      if(!largestCandidate||v.length>largestCandidate.length){largestCandidate={length:v.length,path};}
      for(const [index,val] of v.slice(0,3).entries())if(val&&typeof val==='object')pending.push({v:val,path:path+'['+index+']',depth:depth+1});
      continue;
    }
    const keys=Object.keys(v);
    const ordered=[...new Set([...preferred.filter(k=>k in v),...keys])].slice(0,35);
    for(const key of ordered){
      const child=v[key];
      if(child&&typeof child==='object')pending.push({v:child,path:path+'.'+key,depth:depth+1});
    }
  }
  return {list:[],path:emptyPath||null,hadRecognizedUsers:false,largestCandidate};
}
export function describePeoplePayload(raw){
  const found=findPeopleList(raw);
  const rootKeys=raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.keys(raw).slice(0,12):[];
  // Only structure and key names, never usernames, IDs, photos, cookies or tokens.
  const safeKeys=keys=>keys.filter(k=>!/token|key|secret|cookie|auth|session|pass|csrf/i.test(k)).slice(0,12);
  const sample=found.list.length?found.list.find(x=>x&&typeof x==='object'):null;
  return {root_type:Array.isArray(raw)?'array':typeof raw,root_keys:safeKeys(rootKeys),
    list_path:found.path,list_length:found.list.length,recognized:found.hadRecognizedUsers,
    sample_keys:sample?safeKeys(Object.keys(sample)):[],
    largest_unrecognized_array:found.largestCandidate||null};
}
export function normalizePeople(data,limit=30) {
  const found=findPeopleList(data);
  if(!found.hadRecognizedUsers && found.list.length===0){
    // An explicit empty list is acceptable only when the profile follows nobody.
    // getFollowing checks expectedCount, so this cannot silently become success.
    if(!found.path){
      const err=apiError('A API retornou JSON sem lista identificável de usuários.');
      err.responseShape=describePeoplePayload(data);
      throw err;
    }
    return [];
  }
  const unique=new Set();
  const people=found.list.map(userRecord).filter(v=>v&&typeof v==='object').map(v=>{
    const username=String(pick(v,['username','user_name','handle'],'')).replace(/^@/,'');
    return {pk:String(pick(v,['pk','id','user_id'],'')),username,
      full_name:String(pick(v,['full_name','fullName','name'],'')),
      profile_pic_url:safeImage(pick(v,['profile_pic_url','profile_pic_url_hd','profile_picture_url','hd_profile_pic_url_info.url','avatar_url','profilePicUrl'],'')),
      is_private:Boolean(pick(v,['is_private','private'],false)),
      is_verified:Boolean(pick(v,['is_verified','verified'],false))};
  }).filter(v=>{
    if(!/^[A-Za-z0-9._]{1,30}$/.test(v.username)||unique.has(v.username.toLowerCase()))return false;
    unique.add(v.username.toLowerCase());return true;
  }).slice(0,Math.min(limit,50));
  if(found.list.length>0&&people.length===0){
    const err=apiError('A API retornou itens, mas nenhum nome de usuário foi reconhecido.');
    err.responseShape=describePeoplePayload(data);throw err;
  }
  return people;
}

export function normalizePosts(data) {
  const list=listFrom(data,['items','posts','data.items','data.posts','data.edges','data.user.edge_owner_to_timeline_media.edges','response.items','response.posts','response','data']);
  return list.slice(0,15).map((value,index)=>{
    const d=value?.node??value?.media??value;
    const picture=safeImage(pick(d,['thumbnail_url','display_url','image_url','image_versions2.candidates.0.url','thumbnail','cover_url','cover','media.0.url'],''));
    const video=safeImage(pick(d,['video_url','video_versions.0.url','video_versions.0.src','video'],''));
    const rawCaption=pick(d,['caption.text','caption_text','caption','text'],'');
    const caption=typeof rawCaption==='string'?rawCaption:String(rawCaption?.text||'');
    const mediaType=Number(pick(d,['media_type'],video||d.type==='video'?2:1));
    const time=pick(d,['taken_at','taken_at_timestamp','timestamp'],null);
    const post={
      id:String(pick(d,['id','pk','media_id'],String(index))),
      pk:String(pick(d,['pk','id','media_id'],String(index))),
      code:String(pick(d,['code','shortcode'],'')),
      thumbnail_url:picture,display_url:picture,
      image_versions2:picture?{candidates:[{url:picture}]}:undefined,
      video_url:video,video_versions:video?[{url:video}]:[],
      caption:{text:caption.slice(0,1000)},caption_text:caption.slice(0,1000),
      media_type:mediaType,
      like_count:count(pick(d,['like_count','edge_liked_by.count'],0)),
      comment_count:count(pick(d,['comment_count','edge_media_to_comment.count'],0)),
      taken_at:time??undefined,
      location:pick(d,['location'],undefined)
    };
    return post;
  }).filter(post=>post.thumbnail_url||post.video_url);
}

const providers = [
 {host:HOST, name:'pro-and-cheap',path:'/v1/user',params:u=>({username:u,include_media_count:true}),method:'GET'},
 {host:ENGAGEMENT_HOST,name:'ig-public-engagement',path:'/api/v1/rapid/igdata/profile',params:u=>({username:u}),method:'POST',bodyType:'json'},
 {host:SOCIAL_HOST,name:'instagram-public-data',path:'/v2/user/by/username',params:u=>({username:u}),method:'GET'},
];
export function configuredProfileProviders(){
 const list=[...providers];
 if(isValidBasicHost(process.env.RAPIDAPI_BASIC_HOST))list.push({host:process.env.RAPIDAPI_BASIC_HOST,name:'basic-profile',path:'/v2/instagram-profile/',params:u=>({usernames:u}),method:'GET'});
 return list;
}
export async function getProfile(username,deps={}) {
 const handle=normalizeUsername(username);
 const tried=[];
 for(const provider of configuredProfileProviders()){
  try{
   const result=await requestRapid(provider.path,provider.params(handle),{...deps,host:provider.host,method:provider.method,bodyType:provider.bodyType});
   const profile=normalizeProfile(result,handle);
   if(!profile.pk)throw apiError('API de perfil retornou ID numérico ausente.');
   profile.provider_host=provider.host;
   return profile;
  }catch(error){
   tried.push({provider:provider.name,reason:String(error?.message||error).slice(0,110),status:error?.status||502});
   // Falha de credencial global não justifica tentar todas as APIs com a mesma chave.
   if(error?.status===401)throw error;
   if(error?.status===400 && error?.origin!=='rapidapi')throw error;
  }
 }
 const last=tried.at(-1);
 const err=apiError('Nenhuma API disponível para consultar o perfil agora. Consulte /api/diagnostics para detalhes.',tried.some(t=>t.status===429)?429:last?.status||502);
 err.providerFailures=tried;err.origin='providers';err.retryAfter=60;
 throw err;
}

export async function getPostsById(userId,deps={}) {
 if(!/^[0-9]{1,30}$/.test(String(userId)))return [];
 let firstError;
 try{
  const raw=await requestRapid('/v1/user/posts',{user_id:userId},{...deps,host:HOST});
  return normalizePosts(raw);
 }catch(error){firstError=error;}
 try{
  const raw=await requestRapid('/gql/user/medias',{user_id:userId},{...deps,host:SOCIAL_HOST});
  return normalizePosts(raw);
 }catch(error){throw firstError || error;}
}

/**
 * Instagram Public Data API (xudi3235): a conta pesquisada determina dinamicamente
 * seu ID numerico; a consulta da lista jamais usa ID de teste fixo.
 * GET /g2/user/following?user_id=<pk> (page_id opcional na paginacao).
 * 1 pagina por busca. Evita gastar varias requisicoes do plano Basic.
 */
function requireUserId(userId) {
  const id=String(userId??'');
  if(!/^[0-9]{1,30}$/.test(id)) throw apiError('ID numerico do perfil nao identificado para consultar as contas.',422);
  return id;
}
export async function getFollowing(username,userId='',deps={}) {
  normalizeUsername(username);
  const id=requireUserId(userId);
  const sources=process.env.HIKERAPI_KEY || deps.hikerKey
    ? [{name:'hikerapi',host:HIKER_HOST,run:()=>requestHiker('/g2/user/following',{user_id:id},deps)},
       {name:'rapidapi',host:SOCIAL_HOST,run:()=>requestRapid('/g2/user/following',{user_id:id},{...deps,host:SOCIAL_HOST,method:'GET',timeout:18000})}]
    : [{name:'rapidapi',host:SOCIAL_HOST,run:()=>requestRapid('/g2/user/following',{user_id:id},{...deps,host:SOCIAL_HOST,method:'GET',timeout:18000})}];
  const failures=[];
  for(const source of sources){
    try {
      const raw=await source.run();
      let people;
      try{people=normalizePeople(raw,30)}catch(error){error.responseShape=error.responseShape||describePeoplePayload(raw);throw error;}
      if(people.length===0&&Number(deps.expectedCount)>0){
        const err=apiError(`${source.name} retornou zero contas, mas o perfil indica ${Math.round(Number(deps.expectedCount))} contas seguidas. Resultado não confirmado.`,502);
        err.origin='provider_empty';err.provider=source.host;err.responseShape=describePeoplePayload(raw);
        track(source.host,'empty_unverified',err.message);throw err;
      }
      if(typeof deps.onProvider==='function')deps.onProvider(source.name);
      return people;
    }catch(error){
      failures.push({source:source.name,reason:String(error?.message||error).slice(0,135)});
      // Não consultar uma segunda API quando o ID é inválido.
      if(error?.status===400 && error?.origin!=='hikerapi' && error?.origin!=='rapidapi')throw error;
      if(source===sources.at(-1)){
        error.providerFailures=failures;
        // Preserve a estrutura útil do primeiro erro se a segunda API também falhar.
        error.responseShape=error.responseShape || null;
        throw error;
      }
    }
  }
}

/** Seguidores sob demanda: outra chamada que usa a mesma chave, sem custo adicional automatico. */
export async function getFollowers(username,userId='',deps={}) {
  normalizeUsername(username);
  const raw=await requestRapid('/g2/user/followers',{user_id:requireUserId(userId)},
    {...deps,host:SOCIAL_HOST,method:'GET',timeout:18000});
  return normalizePeople(raw,30);
}

export async function getComplete(username,deps={}) {
  const profile=deps.profile || await getProfile(username,deps);
  if(profile.is_private)return {...profile,posts:[],feed_posts:[],followers_posts:[],lista_perfis_publicos:[],followers:[],chaining_results:[],following:[],error_count:0,results:[{source:'rapidapi',status:'private'}]};
  const [postsResult,peopleResult]=await Promise.allSettled([
    (Array.isArray(profile.recent_posts)&&profile.recent_posts.length>0) ? profile.recent_posts : deps.getPostsImpl ? deps.getPostsImpl(profile.pk) : getPostsById(profile.pk,deps),
    deps.getFollowingImpl ? deps.getFollowingImpl(profile.username,profile.pk) : getFollowing(profile.username,profile.pk,{...deps,expectedCount:profile.following_count})
  ]);
  const posts=postsResult.status==='fulfilled'?postsResult.value:[];
  const people=peopleResult.status==='fulfilled'?peopleResult.value:[];
  return {...profile,
    posts,feed_posts:posts,followers_posts:posts,
    // 'followers' é nome legado das variáveis do frontend. Estes perfis são contas seguidas.
    lista_perfis_publicos:people,followers:[],chaining_results:people,following:people,
    error_count:Number(postsResult.status==='rejected')+Number(peopleResult.status==='rejected'),
    results:[{source:'rapidapi',posts:postsResult.status==='fulfilled'?'ok':'unavailable',following:peopleResult.status==='fulfilled'?'ok':'unavailable',
      posts_error:postsResult.status==='rejected'?String(postsResult.reason?.message||'Erro de publicações').slice(0,160):null,
      following_error:peopleResult.status==='rejected'?String(peopleResult.reason?.message||'Erro de contas seguidas').slice(0,160):null,
      following_response_shape:peopleResult.status==='rejected'?(peopleResult.reason?.responseShape||null):null,
      following_count:people.length,posts_count:posts.length}]
  };
}

/** Proxy SOMENTE de imagens públicas de CDNs Instagram/Facebook.
 * Não consulta APIs de perfil, seguindo ou HikerAPI; não usa credenciais.
 * Impede SSRF via allowlist de hosts, redirects verificados, limite de bytes e MIME. */
const ALLOWED_SUFFIXES=['cdninstagram.com','fbcdn.net','fna.fbcdn.net'];
const MAX_BYTES=2_500_000;
const memory=new Map();
export function allowedAvatarURL(value){
  try{
    const u=new URL(String(value));
    if(u.protocol!=='https:' || u.username || u.password || (u.port&&u.port!=='443'))return false;
    const host=u.hostname.toLowerCase();
    return ALLOWED_SUFFIXES.some(s=>host===s||host.endsWith('.'+s));
  }catch{return false}
}
export async function fetchAvatar(source,{fetchImpl=fetch,ttlMs=20*60*1000}={}){
  if(!allowedAvatarURL(source))throw Object.assign(new Error('URL de foto não permitida.'),{status:400});
  const key=String(source),now=Date.now(),cached=memory.get(key);
  if(cached&&cached.expires>now)return cached.data;
  let current=key, response;
  for(let i=0;i<3;i++){
    if(!allowedAvatarURL(current))throw Object.assign(new Error('Redirecionamento não permitido.'),{status:400});
    response=await fetchImpl(current,{method:'GET',redirect:'manual',headers:{
      'User-Agent':'Mozilla/5.0 (compatible; GhostSpy Profile Photo; +https://www.instagram.com/)',
      'Accept':'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5',
      'Referer':'https://www.instagram.com/'
    },signal:AbortSignal.timeout(12_000)});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      if(!location)break;
      current=new URL(location,current).href;
      continue;
    }
    break;
  }
  if(!response?.ok)throw Object.assign(new Error('A foto não está acessível no CDN.'),{status:404});
  const rawType=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  const allowedTypes=['image/jpeg','image/png','image/webp','image/gif','image/avif'];
  if(!allowedTypes.includes(rawType))throw Object.assign(new Error('O CDN não devolveu imagem.'),{status:415});
  const length=Number(response.headers.get('content-length'));
  if(length>MAX_BYTES)throw Object.assign(new Error('Foto excede o limite de tamanho.'),{status:413});
  const data=Buffer.from(await response.arrayBuffer());
  if(!data.length || data.length>MAX_BYTES)throw Object.assign(new Error('Imagem vazia ou muito grande.'),{status:413});
  const result={body:data,contentType:rawType};
  if(memory.size>120)memory.clear();
  memory.set(key,{data:result,expires:Date.now()+ttlMs});
  return result;
}

/** Localização aproximada do visitante por IP (não é endereço ou GPS do perfil pesquisado). */
import {isIP} from 'node:net';
const cache=new Map();
const empty=Object.freeze({city:'',region:'',country:'',nearby_cities:[],source:'unavailable',approximate:true});

export function visitorIP(req) {
  const raw=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||req.socket?.remoteAddress||'');
  const first=raw.split(',')[0].trim().replace(/^::ffff:/,'');
  return isIP(first) ? first : '';
}
function publicIP(ip) {
  if(!isIP(ip))return false;
  if(ip==='::1'||ip==='0.0.0.0'||ip.startsWith('fe80:')||ip.startsWith('fc')||ip.startsWith('fd'))return false;
  if(isIP(ip)===6)return true;
  const p=ip.split('.').map(Number);
  return !(p[0]===10||p[0]===127||p[0]===0||p[0]>=224||(p[0]===192&&p[1]===168)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===169&&p[1]===254)||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===192&&p[1]===0&&p[2]===2)||(p[0]===198&&p[1]===51&&p[2]===100)||(p[0]===203&&p[1]===0&&p[2]===113));
}
export function normalizeLocation(input) {
  if(!input||typeof input!=='object')return {...empty};
  const city=String(input.city||'').trim().slice(0,90);
  if(!city||city.toLowerCase()==='unknown')return {...empty};
  return {city,region:String(input.region||'').slice(0,90),country:String(input.country||'').slice(0,90),nearby_cities:[city],source:'geojs',approximate:true};
}
export async function getVisitorLocation(req,{fetchImpl=fetch}={}) {
  const ip=visitorIP(req);
  if(!publicIP(ip))return {...empty};
  const stored=cache.get(ip);if(stored&&stored.expires>Date.now())return stored.value;
  try {
    const r=await fetchImpl(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,{
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(5500)
    });
    if(!r.ok)return {...empty};
    const data=normalizeLocation(await r.json());
    if(cache.size>=300)cache.clear();
    cache.set(ip,{value:data,expires:Date.now()+3_600_000});
    return data;
  }catch {return {...empty}}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(resolve(root,file));
const primary=read('assets/feed-CMXMV7Sa.js').toString();
const alternate=read('instagram-dark-ui.js').toString();

test('Stories ilustrativos usam imagens diferentes, sem reciclar as fotos das Notas',()=>{
  assert(!primary.includes('/assets-local/notes/pessoa-0${(m % 8) + 1}.jpg'));
  assert(primary.includes('/assets-local/stories/story-${String(m).padStart(2, "0")}.jpg'));
  const hashes=new Set();
  for(let index=1;index<=14;index++){
    const name=`story-${String(index).padStart(2,'0')}.jpg`;
    const file=`assets-local/stories/${name}`;
    assert(existsSync(resolve(root,file)),`Faltando ${file}`);
    const contents=read(file);
    assert(contents.length>3000,`Imagem vazia: ${name}`);
    assert.equal(contents[0],0xff);
    assert.equal(contents[1],0xd8);
    hashes.add(createHash('sha256').update(contents).digest('hex'));
    assert(alternate.includes(name),`${name} ausente na faixa alternativa`);
  }
  assert.equal(hashes.size,14,'Existem Stories com arquivos fotográficos repetidos');
  assert.equal((alternate.match(/'story-\d{2}\.jpg'/g)||[]).length,14);
  assert.equal((primary.match(/slice\(0, 14\)/g)||[]).length>0,true);
});

test('Notas continuam com oito fotos originais e as imagens de Stories abrem no servidor',async()=>{
  const notes=read('notas-publicas.js').toString();
  assert(notes.includes("image:'/assets-local/notes/pessoa-01.jpg'"));
  assert(notes.includes("image:'/assets-local/notes/pessoa-08.jpg'"));
  const port=51892;
  const p=spawn(process.execPath,['dev-server.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
  try{
    let ready=false;
    for(let n=0;n<80;n++){
      try{const h=await fetch(`http://127.0.0.1:${port}/api/health`);if(h.ok){ready=true;break}}catch{}
      await new Promise(r=>setTimeout(r,40));
    }
    assert(ready,'Servidor não iniciou');
    for(let i=1;i<=16;i++){
      const name=`story-${String(i).padStart(2,'0')}.jpg`;
      const r=await fetch(`http://127.0.0.1:${port}/assets-local/stories/${name}`);
      assert.equal(r.status,200,`Não carregou ${name}`);
      assert.match(r.headers.get('content-type')||'',/image\/jpeg/);
      assert((await r.arrayBuffer()).byteLength>3000);
    }
    const cta=await fetch(`http://127.0.0.1:${port}/cta`);
    assert.equal(cta.status,200,'CTA alterada');
    const notes=await fetch(`http://127.0.0.1:${port}/assets-local/notes/pessoa-01.jpg`);
    assert.equal(notes.status,200,'Notas afetadas');
  }finally{p.kill('SIGTERM')}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicProfileCity,normalizeProfile} from '../lib/rapidapi.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('cidade somente quando declarada explicitamente no perfil',()=>{
 assert.deepEqual(publicProfileCity({biography:'Oi!\n📍 Goiânia - GO'}),{city:'Goiânia - GO',source:'bio'});
 assert.deepEqual(publicProfileCity({city_name:'Recife'}),{city:'Recife',source:'public_profile'});
 assert.equal(publicProfileCity({biography:'Olá!',user_city:'Trindade',location:{latitude:12}}),null);
 assert.equal(publicProfileCity({biography:'viajei para Trindade'}),null);
 assert.equal(normalizeProfile({username:'teste',id:'123',biography:'Olá'},'teste').public_city,null);
});
test('as simulações não utilizam localização do visitante',()=>{
 for(const file of ['assets/feed-CMXMV7Sa.js','assets/direct-CrUBYN4v.js','assets/chat._chatId-B0W9ilwe.js'])assert.doesNotMatch(read(file),/localStorage\.getItem\("(?:nearby_cities|user_city)"\)/);
 assert.doesNotMatch(read('notas-publicas.js'),/note:'[^']*Trindade/);
});
test('aros verdes decorativos em stories ilustrativos',()=>{
 assert.match(read('assets/feed-CMXMV7Sa.js'),/\[2, 5, 8, 11, 14\]\.includes\(m\)/);
 assert.match(read('assets/feed-CMXMV7Sa.js'),/Stories ilustrativos/);
 assert.match(read('assets/root-zQuPsh3d.css'),/fd-story-portrait--green \{background:#32c759/);
});

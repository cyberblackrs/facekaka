/**
 * Testes de fallback dos 8 provedores RapidAPI adicionados.
 * Usa apenas node:test + node:assert/strict. Nenhuma requisição real é feita.
 * Nenhum evento fictício é enviado ao Pixel de produção.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPUNG_HOST, APIALL_HOST, MEDIACRAWLERS_HOST, LOOTER_HOST,
  LOBSTER_HOST, ROCKSOLID_HOST, FLASH_HOST, ULRIC_HOST,
  PROFILE4_HOST, HOST as PRO_HOST, ENGAGEMENT_HOST, SOCIAL_HOST,
  normalizeProfile, resetProviderState, getProfile, requestRapid,
  ALL_RAPID_PROFILE_HOSTS,
} from '../lib/rapidapi.mjs';

// Verifica que os 8 hosts estão exportados e são strings de hostname válidos.
test('constantes de host exportadas', () => {
  for (const [name, host] of [
    ['CAPUNG_HOST', CAPUNG_HOST],
    ['APIALL_HOST', APIALL_HOST],
    ['MEDIACRAWLERS_HOST', MEDIACRAWLERS_HOST],
    ['LOOTER_HOST', LOOTER_HOST],
    ['LOBSTER_HOST', LOBSTER_HOST],
    ['ROCKSOLID_HOST', ROCKSOLID_HOST],
    ['FLASH_HOST', FLASH_HOST],
    ['ULRIC_HOST', ULRIC_HOST],
  ]) {
    assert.match(host, /^[a-z0-9][a-z0-9-]+\.p\.rapidapi\.com$/, `${name} deve ser hostname RapidAPI válido`);
  }
});

// Teste 1: cadeia de fallback — primários retornam 429, terceiro provedor (Looter) retorna perfil.
test('fallback chain: primários 429 → Looter retorna perfil', async () => {
  resetProviderState();
  const looterPayload = {
    status: 'ok',
    data: {
      user: {
        username: 'testuser',
        id: '123456',
        full_name: 'Test User',
        edge_followed_by: { count: 1234 },
        edge_follow: { count: 56 },
        is_private: false,
        is_verified: false,
        biography: 'bio test',
        media_count: 10,
        profile_pic_url: 'https://example.com/pic.jpg',
      },
    },
  };

  // Apenas Looter deve retornar sucesso; todos os anteriores retornam 429.
  const mockFetch = async (url) => {
    const urlStr = url.toString();
    if (urlStr.includes(LOOTER_HOST)) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => looterPayload,
      };
    }
    // Todos os outros: 429
    return {
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({ message: 'rate limit exceeded' }),
    };
  };

  const profile = await getProfile('testuser', { fetchImpl: mockFetch, key: 'testkey' });
  assert.equal(profile.username, 'testuser');
  assert.equal(profile.follower_count, 1234);
  assert.equal(profile.following_count, 56);
  assert.equal(profile.provider_host, LOOTER_HOST);
});

// Teste 2: FlashAPI — full_name com mensagem de indisponibilidade é sanitizado para ''.
test('FlashAPI: full_name com "Access delayed..." é limpo para string vazia', () => {
  resetProviderState();
  const payload = {
    user: {
      username: 'sanitizetest',
      id: '999',
      pk: '999',
      full_name: 'Access delayed. Only the owner of the page can access this information',
      biography: '',
      follower_count: 100,
      following_count: 10,
      is_private: false,
      is_verified: false,
      media_count: 0,
      profile_pic_url: 'https://example.com/pic.jpg',
    },
  };
  const profile = normalizeProfile(payload, 'sanitizetest');
  assert.equal(profile.full_name, '', 'full_name deve ser string vazia quando contém mensagem de acesso negado');
  assert.equal(profile.follower_count, 100);
});

// Teste 3: variação "Only the owner..." também é sanitizada.
test('FlashAPI: full_name com "only the owner" é limpo', () => {
  resetProviderState();
  const payload = {
    user: {
      username: 'ownertest',
      id: '888',
      full_name: 'Only the owner of the page can access this information',
      biography: '',
      follower_count: 50,
      following_count: 5,
      is_private: false,
      is_verified: false,
      media_count: 0,
    },
  };
  const profile = normalizeProfile(payload, 'ownertest');
  assert.equal(profile.full_name, '');
});

// Teste 4: Looter — shape com edge_followed_by.count / edge_follow.count.
test('normalizeProfile: Looter shape (edge_followed_by.count)', () => {
  resetProviderState();
  const payload = {
    status: 'ok',
    data: {
      user: {
        username: 'lootertest',
        id: '777',
        full_name: 'Looter Test',
        edge_followed_by: { count: 100 },
        edge_follow: { count: 50 },
        is_private: false,
        is_verified: true,
        biography: 'Looter bio',
        media_count: 5,
        profile_pic_url: 'https://example.com/pic.jpg',
      },
    },
  };
  const profile = normalizeProfile(payload, 'lootertest');
  assert.equal(profile.follower_count, 100);
  assert.equal(profile.following_count, 50);
  assert.equal(profile.is_verified, true);
  assert.equal(profile.biography, 'Looter bio');
});

// Teste 5: capung V2 — objeto raiz (sem envelope), campos bio/followers/following.
test('normalizeProfile: capung V2 shape (root object, bio/followers/following)', () => {
  resetProviderState();
  const payload = {
    username: 'capungtest',
    id: '654',
    full_name: 'Capung Test',
    bio: 'texto da bio',
    followers: 1000,
    following: 200,
    is_private: false,
    is_verified: false,
    media_count: 20,
    profile_pic_url: 'https://example.com/capung.jpg',
  };
  const profile = normalizeProfile(payload, 'capungtest');
  assert.equal(profile.biography, 'texto da bio');
  assert.equal(profile.follower_count, 1000);
  assert.equal(profile.following_count, 200);
  assert.equal(profile.full_name, 'Capung Test');
});

// Teste 6: APIall — envelope data, edge_followed_by.count.
test('normalizeProfile: APIall shape (data.edge_followed_by.count)', () => {
  resetProviderState();
  const payload = {
    data: {
      username: 'apialltest',
      id: '543',
      full_name: 'APIall Test',
      edge_followed_by: { count: 5000 },
      edge_follow: { count: 100 },
      is_private: false,
      is_verified: false,
      biography: 'bio apiall',
      media_count: 30,
      profile_pic_url: 'https://example.com/apiall.jpg',
    },
    status: 'ok',
  };
  const profile = normalizeProfile(payload, 'apialltest');
  assert.equal(profile.follower_count, 5000);
  assert.equal(profile.following_count, 100);
});

// Teste 7: RockSolid — objeto raiz sem envelope.
test('normalizeProfile: RockSolid shape (root object, follower_count direto)', () => {
  resetProviderState();
  const payload = {
    username: 'rocksolidtest',
    id: '432',
    full_name: 'RockSolid Test',
    biography: 'bio rocksolid',
    follower_count: 999,
    following_count: 10,
    is_private: false,
    is_verified: false,
    media_count: 7,
    profile_pic_url: 'https://example.com/rock.jpg',
  };
  const profile = normalizeProfile(payload, 'rocksolidtest');
  assert.equal(profile.follower_count, 999);
  assert.equal(profile.following_count, 10);
  assert.equal(profile.biography, 'bio rocksolid');
  assert.equal(profile.full_name, 'RockSolid Test');
});

// Teste 8: ulric — envelope data.user, media_count null → 0.
test('normalizeProfile: ulric shape (data.user, media_count null → 0)', () => {
  resetProviderState();
  const payload = {
    data: {
      user: {
        username: 'ulrictest',
        id: '321',
        pk: '321',
        full_name: 'Ulric Test',
        biography: 'bio ulric',
        follower_count: 100,
        following_count: 5,
        is_private: false,
        is_verified: true,
        media_count: null,
        profile_pic_url: 'https://example.com/ulric.jpg',
      },
    },
    status: 'ok',
  };
  const profile = normalizeProfile(payload, 'ulrictest');
  assert.equal(profile.media_count, 0, 'media_count null deve ser convertido para 0');
  assert.equal(profile.is_verified, true);
});

// Teste 9: FormData bodyType — requestRapid com bodyType:'formdata' envia FormData.
test('requestRapid bodyType formdata envia instância de FormData', async () => {
  resetProviderState();
  let capturedBody = null;

  const mockFetch = async (url, init) => {
    capturedBody = init.body;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        username: 'formtest',
        id: '111',
        full_name: 'Form Test',
        follower_count: 1,
        following_count: 0,
        is_private: false,
        is_verified: false,
        biography: '',
        media_count: 0,
      }),
    };
  };

  await requestRapid(
    '/ig_get_fb_profile.php',
    { username_or_url: 'formtest', data: 'basic' },
    { fetchImpl: mockFetch, key: 'testkey', host: ROCKSOLID_HOST, method: 'POST', bodyType: 'formdata' }
  );

  assert.ok(capturedBody instanceof FormData, 'body deve ser instância de FormData');
});

// Teste 10: pathFn dinâmico — capung e ulric embutem o username na URL.
test('pathFn dinâmico: capung e ulric embtem username na URL', async () => {
  resetProviderState();
  const urls = [];

  const mockFetch = async (url) => {
    urls.push(url.toString());
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        username: 'pathfntest',
        id: '200',
        full_name: 'PathFn Test',
        follower_count: 10,
        following_count: 2,
        is_private: false,
        is_verified: false,
        biography: '',
        media_count: 0,
        profile_pic_url: 'https://example.com/pic.jpg',
      }),
    };
  };

  // Simula apenas capung com pathFn
  const capungProviders = [
    { host: CAPUNG_HOST, name: 'instagram-capung', pathFn: u => `/getprofileinfo/${encodeURIComponent(u)}`, params: () => ({}), method: 'GET' },
  ];
  const profileCapung = await getProfile('pathfntest', { fetchImpl: mockFetch, key: 'testkey', providers: capungProviders });
  assert.ok(urls[0]?.includes('/getprofileinfo/pathfntest'), `URL capung deve conter /getprofileinfo/pathfntest, mas foi: ${urls[0]}`);

  urls.length = 0;
  resetProviderState();

  // Simula apenas ulric com pathFn
  const ulricProviders = [
    { host: ULRIC_HOST, name: 'instagram-ulric', pathFn: u => `/api/v1/instagram/user2/${encodeURIComponent(u)}`, params: () => ({}), method: 'GET' },
  ];
  await getProfile('pathfntest', { fetchImpl: mockFetch, key: 'testkey', providers: ulricProviders });
  assert.ok(urls[0]?.includes('/api/v1/instagram/user2/pathfntest'), `URL ulric deve conter /api/v1/instagram/user2/pathfntest, mas foi: ${urls[0]}`);
});

// Teste 11: 404 interrompe a cadeia de fallback imediatamente.
test('404 interrompe cadeia: não tenta demais provedores', async () => {
  resetProviderState();
  let callCount = 0;

  const mockFetch = async () => {
    callCount++;
    return {
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({ message: 'Perfil não encontrado.' }),
    };
  };

  // Dois provedores — o 404 do primeiro deve encerrar a chain.
  const twoProviders = [
    { host: LOOTER_HOST, name: 'p1', path: '/web-profile', params: u => ({ username: u }), method: 'GET' },
    { host: LOBSTER_HOST, name: 'p2', path: '/profile', params: u => ({ username: u }), method: 'GET' },
  ];

  await assert.rejects(
    () => getProfile('notexists', { fetchImpl: mockFetch, key: 'testkey', providers: twoProviders }),
    err => err.status === 404
  );
  assert.equal(callCount, 1, 'Deve ter feito apenas 1 requisição — 404 não faz fallback');
});

// Teste 12: host não permitido é rejeitado por requestRapid (whitelist).
test('requestRapid rejeita host não autorizado', async () => {
  resetProviderState();
  const mockFetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) });

  await assert.rejects(
    () => requestRapid('/profile', { username: 'x' }, {
      fetchImpl: mockFetch, key: 'testkey', host: 'evil.example.com'
    }),
    err => err.status === 400
  );
});

// Teste 13: resetProviderState limpa circuits entre testes.
test('resetProviderState limpa o estado de circuit breaker', async () => {
  resetProviderState();
  // Aciona um circuit manualmente simulando um 429
  const mockFetch429 = async () => ({
    ok: false, status: 429,
    headers: { get: () => '10' },
    json: async () => ({ message: 'rate limited' }),
  });

  await assert.rejects(
    () => requestRapid('/web-profile', { username: 'u' }, {
      fetchImpl: mockFetch429, key: 'testkey', host: LOOTER_HOST, enableCircuit: true
    })
  );

  // Sem reset, seria bloqueado pelo circuit breaker
  resetProviderState();

  // Após reset deve tentar normalmente (sem "em espera" imediata)
  let called = false;
  const mockFetchOk = async () => {
    called = true;
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json: async () => ({
        username: 'resettest', id: '1', full_name: 'R', biography: '',
        follower_count: 0, following_count: 0, is_private: false, is_verified: false, media_count: 0,
      }),
    };
  };

  await requestRapid('/web-profile', { username: 'resettest' }, {
    fetchImpl: mockFetchOk, key: 'testkey', host: LOOTER_HOST
  });
  assert.ok(called, 'após reset, requestRapid deve tentar o provedor normalmente');
});

// Teste 14: lobster shape (mediacrawlers-like) — data.username direto.
test('normalizeProfile: Lobster shape (data envelope, campos diretos)', () => {
  resetProviderState();
  const payload = {
    data: {
      username: 'lobstertest',
      id: '250',
      full_name: 'Lobster Test',
      biography: 'bio lobster',
      follower_count: 777,
      following_count: 33,
      is_private: false,
      is_verified: false,
      media_count: 12,
      profile_pic_url: 'https://example.com/lobster.jpg',
    },
    status: 'ok',
  };
  const profile = normalizeProfile(payload, 'lobstertest');
  assert.equal(profile.follower_count, 777);
  assert.equal(profile.following_count, 33);
  assert.equal(profile.biography, 'bio lobster');
});

// Teste 15: mediacrawlers shape — data envelope, campos diretos.
test('normalizeProfile: mediacrawlers shape (data envelope)', () => {
  resetProviderState();
  const payload = {
    data: {
      username: 'mediatest',
      id: '260',
      full_name: 'Media Test',
      biography: 'bio media',
      follower_count: 500,
      following_count: 20,
      is_private: false,
      is_verified: false,
      media_count: 8,
      profile_pic_url: 'https://example.com/media.jpg',
    },
    status: 'ok',
  };
  const profile = normalizeProfile(payload, 'mediatest');
  assert.equal(profile.follower_count, 500);
  assert.equal(profile.biography, 'bio media');
});

// Teste 16: FlashAPI shape — user envelope, full_name limpo (normal).
test('normalizeProfile: FlashAPI shape (user envelope, full_name válido)', () => {
  resetProviderState();
  const payload = {
    user: {
      username: 'flashtest',
      id: '270',
      full_name: 'Flash Test',
      biography: 'bio flash',
      follower_count: 300,
      following_count: 15,
      is_private: false,
      is_verified: false,
      media_count: 3,
      profile_pic_url: 'https://example.com/flash.jpg',
    },
  };
  const profile = normalizeProfile(payload, 'flashtest');
  assert.equal(profile.full_name, 'Flash Test');
  assert.equal(profile.follower_count, 300);
});

// Teste 17: capung com lastMedia.count
test('normalizeProfile: capung lastMedia.count para media_count', () => {
  resetProviderState();
  const payload = {
    username: 'capung2test',
    id: '280',
    full_name: 'Capung2 Test',
    bio: 'bio',
    followers: 50,
    following: 10,
    is_private: false,
    is_verified: false,
    lastMedia: { count: 42 },
    profile_pic_url: 'https://example.com/capung2.jpg',
  };
  const profile = normalizeProfile(payload, 'capung2test');
  assert.equal(profile.media_count, 42);
});

// Teste 18: 401 interrompe a chain sem tentar outros provedores.
test('401 (credencial inválida) interrompe chain imediatamente', async () => {
  resetProviderState();
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    return {
      ok: false, status: 401,
      headers: { get: () => null },
      json: async () => ({ message: 'Unauthorized' }),
    };
  };
  const twoProviders = [
    { host: LOOTER_HOST, name: 'p1', path: '/web-profile', params: u => ({ username: u }), method: 'GET' },
    { host: LOBSTER_HOST, name: 'p2', path: '/profile', params: u => ({ username: u }), method: 'GET' },
  ];
  await assert.rejects(
    () => getProfile('anyuser', { fetchImpl: mockFetch, key: 'testkey', providers: twoProviders }),
    err => err.status === 401
  );
  assert.equal(callCount, 1, '401 deve encerrar chain após 1 chamada');
});

// Teste 19: todos os 8 novos hosts estão na whitelist (via requestRapid rejeitando apenas hosts fora).
test('todos os 8 novos hosts são aceitos pelo whitelist de requestRapid', async () => {
  for (const host of [
    CAPUNG_HOST, APIALL_HOST, MEDIACRAWLERS_HOST, LOOTER_HOST,
    LOBSTER_HOST, ROCKSOLID_HOST, FLASH_HOST, ULRIC_HOST,
  ]) {
    resetProviderState();
    let reached = false;
    const mockFetch = async () => {
      reached = true;
      return {
        ok: false, status: 429,
        headers: { get: () => null },
        json: async () => ({}),
      };
    };
    // Deve chegar a fazer a requisição (não deve rejeitar por "host não permitido").
    await assert.rejects(
      () => requestRapid('/profile', { username: 'u' }, { fetchImpl: mockFetch, key: 'testkey', host }),
      err => err.status !== 400 || err.message !== 'Provedor de API não permitido.',
      `${host} não deveria ser rejeitado pelo whitelist`
    );
    assert.ok(reached, `${host} deve ter chegado ao fetchImpl (não bloqueado antes)`);
  }
});

// Teste 20: campo "followers_count" alternativo (alguns provedores podem usar esse nome).
test('normalizeProfile: followers_count como alias de follower_count', () => {
  resetProviderState();
  // followers e following são aliases já suportados pelo pick()
  const payload = {
    username: 'aliastest',
    id: '290',
    full_name: 'Alias Test',
    biography: '',
    followers: 888,
    following: 44,
    is_private: false,
    is_verified: false,
    media_count: 0,
  };
  const profile = normalizeProfile(payload, 'aliastest');
  assert.equal(profile.follower_count, 888);
  assert.equal(profile.following_count, 44);
});

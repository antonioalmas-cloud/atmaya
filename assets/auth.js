/* ============================================================
   ĀTMĀYÂ — Sistema de Utilizadores (HTML estático)
   auth.js — autenticação por hash SHA-256 + permissões por app
   AVISO: proteção de entrada do lado do cliente. Os ficheiros
   continuam acessíveis a quem souber o URL diretamente.
   ============================================================ */

const AUTH = (() => {
  const USERS_KEY = 'atmaya_users_v1';
  const SESSION_KEY = 'atmaya_session_v1';

  const DEFAULT_APPS = [
    { id: 'reiki-sabedoria', name: 'Reiki & Sabedoria Japonesa', file: 'reiki-sabedoria.html', icon: '霊', desc: 'Oráculo de Reiki e sabedoria japonesa' },
    { id: 'reiki-25', name: 'As 25 Técnicas de Reiki', file: 'reiki-25-tecnicas.html', icon: '手', desc: 'Enciclopédia das 25 técnicas tradicionais' },
    { id: 'gestao', name: 'Gestão ĀTMÁYÂ', file: 'gestao.html', icon: '管', desc: 'Aplicação de gestão integrada' },
    { id: 'oraculo64', name: 'Oráculo dos 64 Portais', file: 'oraculo-64-portais.html', icon: '門', desc: 'Oráculo Sagrado dos 64 Portais' }
  ];
  let APPS = DEFAULT_APPS.slice();


  const app = id => APPS.find(a => a.id === id);

  /* ---------- SHA-256 puro em JavaScript (funciona também sem HTTPS) ---------- */
  function sha256(ascii) {
    function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
    const maxWord = Math.pow(2, 32);
    let result = '';
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = sha256.h = sha256.h || [];
    let k = sha256.k = sha256.k || [];
    let primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return; // apenas ASCII
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = hash.slice(0, 8);
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ (~e & hash[6])) + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  /* ---------- Dados do servidor (Cloudflare /api/data ou users.js estatico) ---------- */
  let remoteDataLoaded = false;

  async function loadServerData() {
    try {
      const r = await fetch('api/data', { cache: 'no-store' });
      if (!r.ok) throw new Error('sem api/data');
      const d = await r.json();
      if (d && d.ok && Array.isArray(d.users) && d.users.length) {
        window.ATMAYA_USERS = d.users;
        window.ATMAYA_APPS = d.apps && d.apps.length ? d.apps : window.ATMAYA_APPS;
        remoteDataLoaded = true;
      }
    } catch (e) {
      // sem Functions (ex.: alojamento PHP puro): usa o users.js estatico
    }
    const evt = document.createEvent('Event');
    evt.initEvent('atmaya-data', true, true);
    document.dispatchEvent(evt);
    return remoteDataLoaded;
  }

  /* ---------- Sincronização automática com o servidor ---------- */
  const SYNC_KEY = '6a33e1b1eb6d91383dc6a23caed8261b75133a3aa8fe99e9';
  let lastSync = { ok: null, msg: 'sem tentativas' };

  async function syncServer(dados) {
    const payload = dados || { users: getUsers(), apps: getApps() };
    const corpo = JSON.stringify({
      key: SYNC_KEY,
      users: payload.users,
      apps: payload.apps,
      v: Date.now()
    });

    let data = null;
    // 1a tentativa: Function do Cloudflare (api/sync)
    try {
      const r = await fetch('api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo
      });
      data = await r.json();
      if (data && data.ok === false && data.msg === 'Chave de sincronizacao invalida.') {
        // endpoint existe mas recusou: nao insistir no sync.php
        lastSync = { ok: false, msg: data.msg };
        avisaSync();
        return lastSync;
      }
    } catch (e) { data = null; }

    // 2a tentativa: alojamento PHP classico (sync.php)
    if (!data || data.ok !== true) {
      try {
        const r2 = await fetch('sync.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corpo
        });
        data = await r2.json();
      } catch (e) {
        if (!data) data = { ok: false, msg: 'O servidor nao respondeu.' };
      }
    }

    lastSync = { ok: !!data.ok, msg: (data && data.msg) || '' };
    avisaSync();
    return lastSync;
  }

  function avisaSync() {
    const evt = document.createEvent('Event');
    evt.initEvent('atmaya-sync', true, true);
    evt.sync = lastSync;
    document.dispatchEvent(evt);
  }

  /* ---------- Armazenamento ---------- */
  function getUsers() {
    // O users.js do servidor e a fonte da verdade (sincronizado
    // automaticamente pelo painel via sync.php). A copia local so
    // serve de reserva quando o servidor nao tem o ficheiro.
    let shared = [];
    try {
      if (Array.isArray(window.ATMAYA_USERS) && window.ATMAYA_USERS.length) shared = window.ATMAYA_USERS;
    } catch (e) {}
    if (shared.length) return shared;

    let local = [];
    try {
      const raw = JSON.parse(localStorage.getItem(USERS_KEY));
      if (Array.isArray(raw)) local = raw;
      else if (raw && Array.isArray(raw.users)) local = raw.users;
    } catch (e) {}
    if (local.length) return local;

    // Primeira utilizacao sem users.js: contas iniciais
    const seed = [{
      id: 'admin-inicial',
      name: 'Administrador',
      username: 'admin',
      passHash: sha256('atmaya25'),
      admin: true,
      apps: APPS.map(a => a.id)
    }, {
      id: 'convidado',
      name: 'Convidado',
      username: 'convidado',
      passHash: sha256('a'),
      admin: false,
      apps: ['reiki-sabedoria']
    }];
    saveUsers(seed);
    return seed;
  }

  function saveUsers(users) {
    try { window.ATMAYA_USERS = users; } catch (e) {}
    localStorage.setItem(USERS_KEY, JSON.stringify({ v: Date.now(), users }));
    syncServer({ users: users, apps: getApps() });
  }

  /* Exporta a base de dados atual para colar no users.js do servidor */
  function exportUsersJs() {
    const users = getUsers();
    const v = Date.now();
    return 'window.ATMAYA_USERS = ' + JSON.stringify(users, null, 2) + ';\n\n' +
           'window.ATMAYA_USERS_META = { v: ' + v + ' };\n\n' +
           'window.ATMAYA_APPS = ' + JSON.stringify(getApps(), null, 2) + ';\n\n' +
           'window.ATMAYA_APPS_META = { v: ' + v + ' };\n';
  }

  /* ---------- Aplicações dinâmicas ---------- */
  const APPS_KEY = 'atmaya_apps_v1';

  function getApps() {
    let shared = [];
    try {
      if (Array.isArray(window.ATMAYA_APPS) && window.ATMAYA_APPS.length) shared = window.ATMAYA_APPS;
    } catch (e) {}
    if (shared.length) { APPS = shared; return APPS; }

    let local = [];
    try {
      const raw = JSON.parse(localStorage.getItem(APPS_KEY));
      if (Array.isArray(raw)) local = raw;
      else if (raw && Array.isArray(raw.apps)) local = raw.apps;
    } catch (e) {}
    if (local.length) { APPS = local; return APPS; }

    APPS = DEFAULT_APPS.slice();
    return APPS;
  }

  function saveApps(apps) {
    APPS = apps;
    try { window.ATMAYA_APPS = apps; } catch (e) {}
    localStorage.setItem(APPS_KEY, JSON.stringify({ v: Date.now(), apps }));
    syncServer({ users: getUsers(), apps: apps });
  }

  function addApp(a) {
    const apps = getApps().slice();
    if (!a.id) a.id = 'app-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    if (apps.some(x => x.id === a.id || x.file === a.file)) return null;
    apps.push(a);
    saveApps(apps);
    return a;
  }

  function removeApp(id) {
    const apps = getApps().filter(a => a.id !== id);
    saveApps(apps);
  }

  /* ---------- Sessão (por separador, perde-se ao fechar o browser) ---------- */
  function login(username, password) {
    const users = getUsers();
    const u = users.find(u => u.username === username && u.passHash === sha256(password));
    if (!u) return null;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      id: u.id, name: u.name, username: u.username, admin: !!u.admin, apps: u.apps
    }));
    return u;
  }

  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  function canAccess(s, appId) {
    return !!s && (s.admin || (s.apps || []).includes(appId));
  }

  /* Guarda usada no topo de cada aplicação */
  function requireApp(appId) {
    const s = session();
    if (!canAccess(s, appId)) {
      location.replace('index.html');
      return false;
    }
    return true;
  }

  /* ---------- API pública ---------- */
  getApps(); // carrega aplicações do servidor/local no arranque
  loadServerData(); // se houver /api/data (Cloudflare), os dados frescos substituem o users.js

  return {
    get APPS() { return APPS; },
    app, sha256, getUsers, saveUsers, exportUsersJs,
    getApps, saveApps, addApp, removeApp, loadServerData,
    syncServer, get lastSync() { return lastSync; },
    login, logout, session, canAccess, requireApp
  };
})();

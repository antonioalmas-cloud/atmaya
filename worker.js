// ============================================================
// ĀTMĀYÂ — Worker do Cloudflare (novo modelo "Workers com
// ficheiros estáticos"). Serve os endereços da API:
//   /api/sync  → grava utilizadores e apps no KV (SITE_DB)
//   /api/data  → devolve a base de dados a todos os dispositivos
// Todos os outros pedidos (páginas, imagens) são servidos
// automaticamente a partir da pasta "assets" pelo Cloudflare.
//
// Se mudares a chave abaixo, muda também a SYNC_KEY no auth.js.
// ============================================================

const CHAVE_SECRETA = '6a33e1b1eb6d91383dc6a23caed8261b75133a3aa8fe99e9';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- /api/data : todos os dispositivos leem daqui ----
    if (url.pathname === '/api/data' && request.method === 'GET') {
      try {
        const bruto = await env.SITE_DB.get('db');
        if (!bruto) {
          return json({ ok: false, vazio: true });
        }
        const registo = JSON.parse(bruto);
        if (!Array.isArray(registo.users) || !Array.isArray(registo.apps)) {
          return json({ ok: false, vazio: true });
        }
        return json({ ok: true, v: registo.v, users: registo.users, apps: registo.apps });
      } catch (e) {
        return json({ ok: false });
      }
    }

    // ---- /api/sync : o painel de administração grava aqui ----
    if (url.pathname === '/api/sync' && request.method === 'GET') {
      let tem = false;
      try {
        tem = !!(await env.SITE_DB.get('db'));
      } catch (e) {
        return json({ ok: false, kv_ligado: false, msg: 'A Function corre, mas o KV SITE_DB não está ligado.' });
      }
      return json({ ok: true, plataforma: 'cloudflare', kv_ligado: true, tem_dados: tem,
                    msg: 'Tudo a funcionar. Sincronização automática disponível.' });
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      let data;
      try {
        data = await request.json();
      } catch (e) {
        return json({ ok: false, msg: 'Corpo do pedido inválido.' }, 400);
      }
      if (!data || data.key !== CHAVE_SECRETA) {
        return json({ ok: false, msg: 'Chave de sincronização inválida.' }, 403);
      }
      if (!Array.isArray(data.users) || !Array.isArray(data.apps)) {
        return json({ ok: false, msg: 'Dados incompletos.' }, 400);
      }
      const registo = { v: Date.now(), users: data.users, apps: data.apps };
      try {
        await env.SITE_DB.put('db', JSON.stringify(registo));
      } catch (e) {
        return json({ ok: false, msg: 'Falha ao escrever no KV: ' + (e.message || 'desconhecida') }, 500);
      }
      return json({ ok: true, msg: 'Base de dados atualizada (' + data.users.length + ' utilizadores, ' + data.apps.length + ' apps).' });
    }

    return new Response('Não encontrado.', { status: 404 });
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: HEADERS });
}

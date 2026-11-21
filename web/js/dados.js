/* AeroControl — dados.js
   ÚNICO arquivo que lê e grava. Fala com o Supabase direto pela API REST (sem biblioteca).
   Na abertura carrega a frota inteira para a memória; cada gravação vai primeiro ao banco
   e só depois muda a memória — se o banco recusar, nada muda na tela. */
(function (raiz) {
  'use strict';
  const AC = raiz.AC = raiz.AC || {};
  const SB = { url: 'https://flbolzjexwczbsjeeyap.supabase.co', chave: 'sb_publishable_yehMhuNkG6r-O4DjS4hgBg_OWSrH7ZS' };
  const K_SESSAO = 'aerocontrol.sessao', K_REF = 'aerocontrol.dataRef';
  const SEM_ACESSO = 'Este e-mail não tem acesso ao AeroControl. Peça ao administrador para incluí-lo.';
  let db = null, sessao = null, renovando = null;

  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = o => JSON.parse(JSON.stringify(o));
  const lerLocal = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const trocar = (lista, novo) => { const i = lista.findIndex(x => x.id === novo.id); if (i < 0) lista.push(novo); else lista[i] = novo; };

  /* ---------- nomes: camelCase no app ⇄ snake_case no banco ---------- */
  const COLUNAS = {
    aeronaves: 'id matricula fabricante modelo sn ano tsn tso posicao_data util_mensal ciclos manual_ref manual_rev origem mapas criado_em',
    itens: 'id aeronave_id mapa secao grupo ordem nome pn ns tlv_data tlv_horas tbo_data tbo_horas validade validade_mes efetuado_data efetuado_mes efetuado_tsn tsn_base tsn_ign tso_novo situacao ref_mapa obs principal',
    lancamentos: 'id aeronave_id data horas pousos obs tsn_antes tsn_apos posicao_antes criado_em',
    cumprimentos: 'id item_id aeronave_id data tsn obs troca antes criado_em'
  };
  for (const t in COLUNAS) COLUNAS[t] = COLUNAS[t].split(' ');
  const SEM_VAZIO = new Set('ano tsn tso posicao_data util_mensal ciclos manual_rev ordem tlv_horas tbo_horas validade efetuado_data efetuado_tsn tsn_base data horas pousos tsn_antes tsn_apos posicao_antes criado_em'.split(' '));
  const TEXTO = new Set('secao grupo pn ns tlvData tboData obs fabricante modelo sn manualRef origem'.split(' '));
  const camel = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  /* parcial = só as chaves presentes (para atualizar alguns campos sem apagar os outros) */
  function paraBanco(tabela, o, parcial) {
    const src = Object.assign({}, o);
    if (tabela === 'itens' && (!parcial || 'tsnBase' in src)) { src.tsnIgn = src.tsnBase === 'IGN'; if (src.tsnIgn) src.tsnBase = null; }
    if (tabela === 'cumprimentos' && src.antes) src.antes = paraBanco('itens', src.antes);
    const out = {};
    for (const col of COLUNAS[tabela]) {
      const k = camel(col);
      if (parcial && !(k in src)) continue;
      if (col === 'criado_em' && !src[k]) continue;
      let v = src[k];
      if (v === undefined || (v === '' && SEM_VAZIO.has(col))) v = null;
      out[col] = v;
    }
    return out;
  }
  function doBanco(tabela, r) {
    if (!r) return r;
    const o = {};
    for (const k in r) o[camel(k)] = r[k];
    for (const k in o) if (o[k] === null && TEXTO.has(k)) o[k] = '';
    if (tabela === 'itens') { if (o.tsnIgn) o.tsnBase = 'IGN'; delete o.tsnIgn; delete o.atualizadoEm; }
    if (tabela === 'cumprimentos' && o.antes) o.antes = doBanco('itens', o.antes);
    return o;
  }

  /* ---------- conversa com o servidor ---------- */
  function erroLegivel(j, status) {
    const m = (j && (j.message || j.msg || j.error_description || j.error)) || '';
    if (j && /^PGRST20[25]$/.test(j.code)) return 'O banco do AeroControl ainda não foi configurado no Supabase (falta rodar o supabase/schema.sql).';
    if (j && j.code === '23505') return 'Já existe um registro com esses dados (matrícula repetida?).';
    if ((j && j.code === '42501') || status === 403) return 'Seu usuário não tem permissão para gravar no AeroControl.';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Este e-mail ainda não foi confirmado no Supabase.';
    return m || `O servidor recusou a operação (erro ${status}).`;
  }
  async function chamar(caminho, op) {
    op = op || {};
    const semRede = () => Object.assign(new Error('Sem conexão com o servidor. Nada foi gravado — confira a internet e tente de novo.'), { rede: true });
    if (raiz.navigator && navigator.onLine === false) throw semRede();
    const headers = Object.assign({ apikey: SB.chave, 'Content-Type': 'application/json' }, op.cab);
    if (!op.anonimo) headers.Authorization = 'Bearer ' + await token();
    let r;
    try { r = await fetch(SB.url + caminho, { method: op.metodo || 'GET', headers, body: op.corpo === undefined ? undefined : JSON.stringify(op.corpo) }); }
    catch (e) { throw semRede(); }
    const txt = await r.text();
    let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (r.status === 401 && !op.anonimo) { encerrar('Sua sessão expirou. Entre de novo.'); throw new Error('Sua sessão expirou. Entre de novo.'); }
    if (!r.ok) throw new Error(erroLegivel(j, r.status));
    return j;
  }
  const rpc = (nome, args) => chamar(`/rest/v1/rpc/${nome}`, { metodo: 'POST', corpo: args || {} });
  const filtroId = id => `id=eq.${encodeURIComponent(id)}`;

  /* ---------- sessão ---------- */
  function definirSessao(j) {
    sessao = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), email: (j.user && j.user.email) || (sessao && sessao.email) || '' };
    guardar(K_SESSAO, JSON.stringify(sessao));
  }
  function encerrar(motivo) {
    sessao = null; db = null; guardar(K_SESSAO, null);
    if (typeof auth.aoEncerrar === 'function') auth.aoEncerrar(motivo);
  }
  async function token() {
    if (!sessao) throw new Error('Entre com seu e-mail e senha.');
    if (sessao.expires_at - 60 > Date.now() / 1000) return sessao.access_token;
    renovando = renovando || (async () => {
      try { definirSessao(await chamar('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: sessao.refresh_token }, anonimo: true })); }
      catch (e) { if (!e.rede) encerrar('Sua sessão expirou. Entre de novo.'); throw e.rede ? e : new Error('Sua sessão expirou. Entre de novo.'); }
      finally { renovando = null; }
    })();
    await renovando;
    return sessao.access_token;
  }
  const auth = {
    aoEncerrar: null,
    email: () => (sessao ? sessao.email : ''),
    async entrar(email, senha) {
      definirSessao(await chamar('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: senha }, anonimo: true }));
      await carregar();
    },
    async sair() {
      const tok = sessao && sessao.access_token;
      sessao = null; db = null; guardar(K_SESSAO, null);
      if (tok) fetch(SB.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: SB.chave, Authorization: 'Bearer ' + tok } }).catch(() => {});
    }
  };

  /* ---------- carga ---------- */
  async function lerTudo(tabela) {
    const out = [];
    for (let de = 0; ;) {   // pagina até vir vazio: funciona com qualquer limite de linhas do servidor
      const pg = await chamar(`/rest/v1/${tabela}?select=*&order=id&limit=1000&offset=${de}`);
      if (!pg.length) return out;
      out.push(...pg.map(r => doBanco(tabela, r)));
      de += pg.length;
    }
  }
  async function carregar() {
    const [ok, cfg, aeronaves, itens, lancamentos, cumprimentos] = await Promise.all([
      rpc('eh_autorizado'), chamar('/rest/v1/config?select=*&id=eq.1'),
      lerTudo('aeronaves'), lerTudo('itens'), lerTudo('lancamentos'), lerTudo('cumprimentos')
    ]);
    // sem autorização o banco devolve listas vazias em silêncio — por isso a pergunta explícita
    if (ok !== true) { await auth.sair(); throw new Error(SEM_ACESSO); }
    const c = (cfg && cfg[0]) || {};
    db = { config: { alertaDias: c.alerta_dias ?? 30, alertaHoras: c.alerta_horas ?? 25 }, aeronaves, itens, lancamentos, cumprimentos };
  }
  /* devolve false quando ninguém está logado (o app mostra a tela de entrada) */
  async function iniciar() {
    if (!sessao) { try { sessao = JSON.parse(lerLocal(K_SESSAO) || 'null'); } catch (e) { sessao = null; } }
    if (!sessao) return false;
    await carregar();
    return true;
  }

  /* ---------- configuração (alertas no banco; data de referência é de cada pessoa) ---------- */
  const config = {
    async obter() { return Object.assign(clone(db.config), { dataRef: lerLocal(K_REF) || null }); },
    async salvar(p) {
      if ('dataRef' in p) guardar(K_REF, p.dataRef || null);
      const banco = {};
      if ('alertaDias' in p) banco.alerta_dias = p.alertaDias;
      if ('alertaHoras' in p) banco.alerta_horas = p.alertaHoras;
      if (Object.keys(banco).length) {
        await chamar('/rest/v1/config?id=eq.1', { metodo: 'PATCH', corpo: banco, cab: { Prefer: 'return=minimal' } });
        Object.assign(db.config, { alertaDias: banco.alerta_dias ?? db.config.alertaDias, alertaHoras: banco.alerta_horas ?? db.config.alertaHoras });
      }
      return config.obter();
    }
  };

  /* ---------- aeronaves ---------- */
  const aeronaves = {
    async listar() { return clone(db.aeronaves).sort((a, b) => a.matricula.localeCompare(b.matricula)); },
    async obter(id) { const a = db.aeronaves.find(x => x.id === id); return a ? clone(a) : null; },
    async salvar(a) {
      const dup = db.aeronaves.find(x => x.matricula.toUpperCase() === a.matricula.toUpperCase() && x.id !== a.id);
      if (dup) throw new Error(`Já existe uma aeronave com a matrícula ${a.matricula}.`);
      const completo = Object.assign({}, db.aeronaves.find(x => x.id === a.id), a);
      if (!completo.id) completo.id = novoId();
      const [salvo] = await chamar('/rest/v1/aeronaves?on_conflict=id', { metodo: 'POST', corpo: [paraBanco('aeronaves', completo)], cab: { Prefer: 'resolution=merge-duplicates,return=representation' } });
      const novo = doBanco('aeronaves', salvo);
      trocar(db.aeronaves, novo);
      a.id = novo.id;
      return clone(novo);
    },
    /* várias de uma vez, numa única operação (importar frota) */
    async salvarVarias(lista) {
      const novas = lista.map(a => Object.assign({}, a, { id: a.id || novoId(), criadoEm: null }));
      const r = await chamar('/rest/v1/aeronaves?on_conflict=id', { metodo: 'POST', corpo: novas.map(a => paraBanco('aeronaves', a)), cab: { Prefer: 'resolution=merge-duplicates,return=representation' } });
      r.forEach(x => trocar(db.aeronaves, doBanco('aeronaves', x)));
      return r.length;
    },
    async excluir(id) {
      const r = await chamar(`/rest/v1/aeronaves?${filtroId(id)}`, { metodo: 'DELETE', cab: { Prefer: 'return=representation' } });
      if (!r || !r.length) throw new Error('Aeronave não encontrada ou sem permissão para excluir.');
      db.aeronaves = db.aeronaves.filter(x => x.id !== id);
      db.itens = db.itens.filter(x => x.aeronaveId !== id);
      db.lancamentos = db.lancamentos.filter(x => x.aeronaveId !== id);
      db.cumprimentos = db.cumprimentos.filter(x => x.aeronaveId !== id);
    }
  };

  /* ---------- itens do MICCA ---------- */
  const itens = {
    async todos() { return db.itens; },                                 // leitura em massa (sem cópia — não altere)
    async daAeronave(id) { return db.itens.filter(x => x.aeronaveId === id); },
    async obter(id) { const i = db.itens.find(x => x.id === id); return i ? clone(i) : null; },
    async salvar(it) {
      if (!it.id) {
        const irmaos = db.itens.filter(x => x.aeronaveId === it.aeronaveId && x.mapa === it.mapa);
        if (it.ordem === undefined || it.ordem === null) it.ordem = irmaos.reduce((m, x) => Math.max(m, x.ordem || 0), 0) + 10;
      }
      await itens.trocar([], [it]);
      return clone(it);
    },
    async salvarVarios(lista) { await itens.trocar([], lista); return lista.length; },
    /* apaga uns e grava outros numa única operação no banco (importação e seu "Desfazer") */
    async trocar(apagarIds, lista) {
      lista.forEach(it => { if (!it.id) it.id = novoId(); });
      await rpc('gravar_itens', { apagar: apagarIds, gravar: lista.map(it => paraBanco('itens', it)) });
      const fora = new Set(apagarIds);
      if (fora.size) { db.itens = db.itens.filter(x => !fora.has(x.id)); db.cumprimentos = db.cumprimentos.filter(x => !fora.has(x.itemId)); }
      lista.forEach(it => trocar(db.itens, clone(it)));
    },
    async excluir(id) {
      const r = await chamar(`/rest/v1/itens?${filtroId(id)}`, { metodo: 'DELETE', cab: { Prefer: 'return=representation' } });
      if (!r || !r.length) throw new Error('Item não encontrado ou sem permissão para excluir.');
      db.itens = db.itens.filter(x => x.id !== id);
      db.cumprimentos = db.cumprimentos.filter(x => x.itemId !== id);
    }
  };

  /* ---------- horas voadas ---------- */
  const lancamentos = {
    async todos() { return db.lancamentos; },
    async daAeronave(id) { return clone(db.lancamentos.filter(x => x.aeronaveId === id)).sort((a, b) => b.data.localeCompare(a.data) || b.tsnApos - a.tsnApos); },
    /* registra horas e move o TSN da célula — tudo ou nada, no servidor */
    async registrar({ aeronaveId, data, horas, pousos, obs }) {
      const r = await rpc('registrar_lancamento', { p_aeronave: aeronaveId, p_data: data, p_horas: horas, p_pousos: pousos || null, p_obs: obs || '' });
      const l = doBanco('lancamentos', r.lancamento);
      db.lancamentos.push(l);
      trocar(db.aeronaves, doBanco('aeronaves', r.aeronave));
      return clone(l);
    },
    /* desfaz só o último lançamento da aeronave (o TSN volta junto) */
    async desfazerUltimo(aeronaveId) {
      const r = await rpc('desfazer_lancamento', { p_aeronave: aeronaveId });
      const l = doBanco('lancamentos', r.lancamento);
      db.lancamentos = db.lancamentos.filter(x => x.id !== l.id);
      trocar(db.aeronaves, doBanco('aeronaves', r.aeronave));
      return clone(l);
    }
  };

  /* ---------- cumprimentos (histórico de cada item) ---------- */
  const cumprimentos = {
    async doItem(itemId) { return clone(db.cumprimentos.filter(x => x.itemId === itemId)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)); },
    async daAeronave(id) { return clone(db.cumprimentos.filter(x => x.aeronaveId === id)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)); },
    /* grava o cumprimento e atualiza o item na mesma operação */
    async registrar(item, novo) {
      const r = await rpc('registrar_cumprimento', {
        p_item: item.id, p_campos: paraBanco('itens', novo.campos || {}, true),
        p_data: novo.efetuadoData || null, p_tsn: novo.efetuadoTsn ?? null, p_obs: novo.obs || '', p_troca: novo.troca || null
      });
      const c = doBanco('cumprimentos', r.cumprimento);
      db.cumprimentos.push(c);
      trocar(db.itens, doBanco('itens', r.item));
      return clone(c);
    },
    async desfazer(id) {
      const it = await rpc('desfazer_cumprimento', { p_id: id });
      const c = db.cumprimentos.find(x => x.id === id);
      if (it) trocar(db.itens, doBanco('itens', it));
      else if (c) db.itens = db.itens.filter(x => x.id !== c.itemId);
      db.cumprimentos = db.cumprimentos.filter(x => x.id !== id);
      return true;
    }
  };

  /* ---------- backup ---------- */
  const backup = {
    async exportar() { return JSON.stringify(Object.assign({ versao: 1 }, db), null, 1); },
    /* substitui TUDO no servidor pelo conteúdo do arquivo */
    async importar(texto) {
      let novo;
      try { novo = JSON.parse(texto); } catch (e) { novo = null; }
      if (!novo || novo.versao !== 1 || !Array.isArray(novo.aeronaves) || !Array.isArray(novo.itens)) throw new Error('Arquivo não reconhecido. Use um backup exportado pelo AeroControl.');
      const cfg = novo.config || {};
      await rpc('restaurar_backup', { p: {
        aeronaves: novo.aeronaves.map(a => paraBanco('aeronaves', a)),
        itens: novo.itens.map(i => paraBanco('itens', i)),
        lancamentos: (novo.lancamentos || []).map(l => paraBanco('lancamentos', l)),
        cumprimentos: (novo.cumprimentos || []).map(c => paraBanco('cumprimentos', c)),
        config: { alerta_dias: cfg.alertaDias ?? null, alerta_horas: cfg.alertaHoras ?? null }
      } });
      await carregar();
      return true;
    }
  };

  AC.dados = { iniciar, recarregar: carregar, novoId, auth, config, aeronaves, itens, lancamentos, cumprimentos, backup, paraBanco, doBanco };
})(typeof window !== 'undefined' ? window : globalThis);

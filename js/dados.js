/* AeroControl — dados.js
   ÚNICO arquivo que lê e grava. Hoje: localStorage. Amanhã: Supabase —
   basta trocar o miolo destas funções; as telas não mudam (tudo é async). */
(function (raiz) {
  'use strict';
  const AC = raiz.AC = raiz.AC || {};
  const CHAVE = 'aerocontrol.v1';
  let db = null;

  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = o => JSON.parse(JSON.stringify(o));

  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
    catch (e) { throw new Error('Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado). Exporte um backup em Configurações.'); }
  }

  async function iniciar() {
    try { db = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { db = null; }
    if (!db || db.versao !== 1) { db = AC.semente.gerar(novoId); gravar(); }
    return true;
  }

  /* ---------- configuração ---------- */
  const config = {
    async obter() { return clone(db.config); },
    async salvar(parcial) { Object.assign(db.config, parcial); gravar(); return clone(db.config); }
  };

  /* ---------- aeronaves ---------- */
  const aeronaves = {
    async listar() { return clone(db.aeronaves).sort((a, b) => a.matricula.localeCompare(b.matricula)); },
    async obter(id) { const a = db.aeronaves.find(x => x.id === id); return a ? clone(a) : null; },
    async salvar(a) {
      const dup = db.aeronaves.find(x => x.matricula.toUpperCase() === a.matricula.toUpperCase() && x.id !== a.id);
      if (dup) throw new Error(`Já existe uma aeronave com a matrícula ${a.matricula}.`);
      if (!a.id) { a.id = novoId(); db.aeronaves.push(clone(a)); }
      else { const i = db.aeronaves.findIndex(x => x.id === a.id); if (i < 0) db.aeronaves.push(clone(a)); else db.aeronaves[i] = clone(a); }
      gravar(); return clone(a);
    },
    async excluir(id) {
      db.aeronaves = db.aeronaves.filter(x => x.id !== id);
      db.itens = db.itens.filter(x => x.aeronaveId !== id);
      db.lancamentos = db.lancamentos.filter(x => x.aeronaveId !== id);
      db.cumprimentos = db.cumprimentos.filter(x => x.aeronaveId !== id);
      gravar();
    }
  };

  /* ---------- itens do MICCA ---------- */
  const itens = {
    async todos() { return db.itens; },                                 // leitura em massa (sem cópia — não altere)
    async daAeronave(id) { return db.itens.filter(x => x.aeronaveId === id); },
    async obter(id) { const i = db.itens.find(x => x.id === id); return i ? clone(i) : null; },
    async salvar(it) {
      if (!it.id) {
        it.id = novoId();
        const irmaos = db.itens.filter(x => x.aeronaveId === it.aeronaveId && x.mapa === it.mapa);
        if (it.ordem === undefined || it.ordem === null) it.ordem = (irmaos.reduce((m, x) => Math.max(m, x.ordem || 0), 0) + 10);
        db.itens.push(clone(it));
      } else {
        const i = db.itens.findIndex(x => x.id === it.id);
        db.itens[i] = clone(it);
      }
      gravar(); return clone(it);
    },
    async salvarVarios(lista) {
      for (const it of lista) {
        if (!it.id) it.id = novoId();
        const i = db.itens.findIndex(x => x.id === it.id);
        if (i < 0) db.itens.push(clone(it)); else db.itens[i] = clone(it);
      }
      gravar(); return lista.length;
    },
    async excluir(id) {
      db.itens = db.itens.filter(x => x.id !== id);
      db.cumprimentos = db.cumprimentos.filter(x => x.itemId !== id);
      gravar();
    },
    async excluirDoMapa(aeronaveId, mapa) {
      const fora = new Set(db.itens.filter(x => x.aeronaveId === aeronaveId && x.mapa === mapa).map(x => x.id));
      db.itens = db.itens.filter(x => !fora.has(x.id));
      db.cumprimentos = db.cumprimentos.filter(x => !fora.has(x.itemId));
      gravar();
    }
  };

  /* ---------- horas voadas ---------- */
  const lancamentos = {
    async todos() { return db.lancamentos; },
    async daAeronave(id) { return clone(db.lancamentos.filter(x => x.aeronaveId === id)).sort((a, b) => b.data.localeCompare(a.data) || b.tsnApos - a.tsnApos); },
    /* registra horas e move o TSN da célula — tudo ou nada */
    async registrar({ aeronaveId, data, horas, pousos, obs }) {
      const a = db.aeronaves.find(x => x.id === aeronaveId);
      if (!a) throw new Error('Aeronave não encontrada.');
      const l = { id: novoId(), aeronaveId, data, horas, pousos: pousos || null, obs: obs || '', tsnAntes: a.tsn, tsnApos: Math.round((a.tsn + horas) * 10) / 10, posicaoAntes: a.posicaoData, criadoEm: new Date().toISOString() };
      a.tsn = l.tsnApos;
      if (!a.posicaoData || data >= a.posicaoData) a.posicaoData = data;
      if (pousos) a.ciclos = (a.ciclos || 0) + pousos;
      db.lancamentos.push(l);
      gravar(); return clone(l);
    },
    /* desfaz só o último lançamento da aeronave (o TSN volta junto) */
    async desfazerUltimo(aeronaveId) {
      const da = db.lancamentos.filter(x => x.aeronaveId === aeronaveId && x.tsnAntes !== undefined);
      if (!da.length) throw new Error('Não há lançamento para desfazer.');
      const ult = da.reduce((m, x) => (x.criadoEm > m.criadoEm ? x : m));
      const a = db.aeronaves.find(x => x.id === aeronaveId);
      a.tsn = ult.tsnAntes; a.posicaoData = ult.posicaoAntes;
      if (ult.pousos) a.ciclos = Math.max(0, (a.ciclos || 0) - ult.pousos);
      db.lancamentos = db.lancamentos.filter(x => x.id !== ult.id);
      gravar(); return clone(ult);
    }
  };

  /* ---------- cumprimentos (histórico de cada item) ---------- */
  const cumprimentos = {
    async doItem(itemId) { return clone(db.cumprimentos.filter(x => x.itemId === itemId)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)); },
    async daAeronave(id) { return clone(db.cumprimentos.filter(x => x.aeronaveId === id)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)); },
    /* grava o cumprimento e atualiza o item na mesma operação */
    async registrar(item, novo) {
      const i = db.itens.findIndex(x => x.id === item.id);
      if (i < 0) throw new Error('Item não encontrado.');
      const antes = clone(db.itens[i]);
      const c = { id: novoId(), itemId: item.id, aeronaveId: item.aeronaveId, data: novo.efetuadoData, tsn: novo.efetuadoTsn, obs: novo.obs, troca: novo.troca || null, antes, criadoEm: new Date().toISOString() };
      db.itens[i] = Object.assign(db.itens[i], novo.campos);
      db.cumprimentos.push(c);
      gravar(); return clone(c);
    },
    async desfazer(id) {
      const c = db.cumprimentos.find(x => x.id === id);
      if (!c) throw new Error('Registro não encontrado.');
      const i = db.itens.findIndex(x => x.id === c.itemId);
      if (i >= 0) db.itens[i] = c.antes;
      db.cumprimentos = db.cumprimentos.filter(x => x.id !== id);
      gravar(); return true;
    }
  };

  /* ---------- backup / demonstração ---------- */
  const backup = {
    async exportar() { return JSON.stringify(db, null, 1); },
    async importar(texto) {
      const novo = JSON.parse(texto);
      if (!novo || novo.versao !== 1 || !Array.isArray(novo.aeronaves) || !Array.isArray(novo.itens)) throw new Error('Arquivo não reconhecido. Use um backup exportado pelo AeroControl.');
      novo.lancamentos = novo.lancamentos || []; novo.cumprimentos = novo.cumprimentos || []; novo.config = novo.config || {};
      db = novo; gravar(); return true;
    },
    async restaurarDemo() { db = AC.semente.gerar(novoId); gravar(); return true; },
    tamanho() { try { return (localStorage.getItem(CHAVE) || '').length; } catch (e) { return 0; } }
  };

  AC.dados = { iniciar, novoId, config, aeronaves, itens, lancamentos, cumprimentos, backup };
})(typeof window !== 'undefined' ? window : globalThis);

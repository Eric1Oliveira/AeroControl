/* AeroControl — app.js
   Casca do aplicativo: rotas, topo, busca global, diálogos, avisos e os
   componentes visuais compartilhados (horímetro, etiqueta, medidor H/D). */
(function () {
  'use strict';
  const AC = window.AC;
  const R = AC.regras, D = AC.dados;
  AC.telas = AC.telas || {};
  AC.acoes = AC.acoes || {};
  AC.forms = AC.forms || {};
  AC.previas = AC.previas || {};
  AC.estado = { filtro: { sit: 'todos', busca: '', mostrarNA: false }, abrirItemApos: null, rotaAnterior: '' };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- ícones (traço Lucide) ---------- */
  const ICONES = {
    busca: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    voltar: '<path d="m15 18-6-6 6-6"/>',
    seta: '<path d="m9 18 6-6-6-6"/>',
    imprimir: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    calendario: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    relogio: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    ajustes: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
    baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    lapis: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    lixo: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    chave: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    historico: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    pontos: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    lista: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    painel: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    grade: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    tabela: '<path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    ordenar: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'
  };
  const ic = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n] || ''}</svg>`;

  /* ---------- componentes ---------- */
  /* faixa navy de cabeçalho de página, com rotas finas em champanhe ao fundo */
  const ARCOS = `<svg class="faixa-arcos" viewBox="0 0 640 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <path d="M40 262 Q 330 -70 640 150"/><path class="tracejado" d="M190 262 Q 430 30 640 62"/><path d="M340 262 Q 510 120 640 222"/>
    <circle cx="563" cy="96" r="2.6"/><circle cx="452" cy="74" r="2"/><circle cx="604" cy="196" r="2"/></svg>`;
  function faixa({ sobre, titulo, tituloClasse, sub, acoes, migalha, nota, alta, direita }) {
    return `<section class="faixa${alta ? ' alta' : ''}">${ARCOS}<div class="faixa-int">
      ${migalha ? `<nav class="migalha" aria-label="Você está em">${migalha}</nav>` : ''}
      <div class="faixa-linha"><div class="faixa-texto">${sobre ? `<p class="sobre">${sobre}</p>` : ''}<h1 class="${tituloClasse || ''}">${titulo}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      ${direita || acoes ? `<div class="faixa-dir">${direita || ''}${acoes ? `<div class="faixa-acoes">${acoes}</div>` : ''}</div>` : ''}</div>
      ${nota || ''}</div></section>`;
  }

  function etiqueta(sit, texto) {
    const rot = texto || R.SITUACOES[sit]?.rotulo || '';
    return rot ? `<span class="pilula p-${sit}">${esc(rot)}</span>` : '';
  }

  /* medidor duplo: H (horas) e D (dias); o limite que vence primeiro fica aceso */
  function medidor(r) {
    const L = [];
    if (r.horasRest !== null) L.push({ rot: 'H', nome: 'horas', f: r.fracH, txt: `${R.fmtH(r.horasRest)} h`, m: r.horasRest < 0 ? 'vencido' : r.alertaH ? 'atencao' : 'ok', rege: r.rege === 'horas' });
    if (r.diasRest !== null) L.push({ rot: 'D', nome: 'dias', f: r.fracD ?? Math.max(0, Math.min(1, r.diasRest / 730)), txt: `${R.fmtInt(r.diasRest)} d`, m: r.diasRest < 0 ? 'vencido' : r.alertaD ? 'atencao' : 'ok', rege: r.rege === 'data' });
    if (!L.length) return '';
    if (L.length === 1) L[0].rege = true;
    return `<div class="medidor">${L.map(l => `<div class="med m-${l.m}${l.rege ? ' rege' : ''}" title="${l.rege && L.length > 1 ? 'Este limite vence primeiro' : 'Disponível em ' + l.nome}"><span class="ml">${l.rot}</span><span class="trilho"><i style="--f:${(l.f ?? 0).toFixed(3)}"></i></span><span class="mv">${l.txt}</span></div>`).join('')}</div>`;
  }

  /* "faltam 414,9 h" em frase, para a folha do item e a agenda */
  function quando(r, util) {
    if (r.situacao === 'semregistro') return 'sem data de cumprimento';
    const partes = [];
    if (r.diasRest !== null) partes.push(r.diasRest < 0 ? `vencido ${R.prazoHumano(r.diasRest)}` : r.diasRest === 0 ? 'vence hoje' : `${R.prazoHumano(r.diasRest)}`);
    if (r.horasRest !== null) partes.push(r.horasRest < 0 ? `${R.fmtH(-r.horasRest)} h além do limite` : `${R.fmtH(r.horasRest)} h`);
    return partes.join(' · ');
  }

  /* ---------- diálogos ---------- */
  const dlg = () => $('#dlg'), folha = () => $('#folha'), conf = () => $('#confirma');
  function moldura({ titulo, sub, corpo, rodape, form, previa }) {
    const tag = form ? 'form' : 'div';
    const attrs = form ? ` data-form="${form}"${previa ? ` data-previa="${previa}"` : ''} novalidate` : '';
    return `<${tag} class="dlg-caixa"${attrs}>
      <header class="dlg-cab"><div><h2 id="dlg-tit">${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
        <button type="button" class="botao sutil icone" data-acao="fecharDialogo" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="dlg-corpo">${corpo}</div>
      ${rodape ? `<footer class="dlg-rodape">${rodape}</footer>` : ''}
    </${tag}>`;
  }
  function abrirDialogo(html, classe) {
    const d = dlg();
    d.className = 'dlg ' + (classe || '');
    d.setAttribute('aria-labelledby', 'dlg-tit');
    d.innerHTML = html;
    if (!d.open) d.showModal();
    const f = d.querySelector('[autofocus], .dlg-corpo input:not([type=hidden]), .dlg-corpo select');
    if (f) setTimeout(() => f.focus(), 30);
    const form = d.querySelector('form[data-previa]');
    if (form) AC.previas[form.dataset.previa]?.(form);
  }
  function fecharDialogo() { if (dlg().open) dlg().close(); }
  function abrirFolha(html) {
    const f = folha();
    f.innerHTML = html;
    f.setAttribute('aria-labelledby', 'dlg-tit');
    if (!f.open) f.showModal();
  }
  function fecharFolha() { if (folha().open) folha().close(); }
  function confirmar({ titulo, texto, botao, perigo }) {
    return new Promise(res => {
      const c = conf();
      c.className = 'dlg estreito';
      c.innerHTML = `<div class="dlg-caixa"><header class="dlg-cab"><div><h2>${esc(titulo)}</h2><p>${texto}</p></div></header>
        <footer class="dlg-rodape"><button type="button" class="botao" data-r="0">Cancelar</button>
        <button type="button" class="botao ${perigo ? 'perigo' : 'primario'}" data-r="1">${esc(botao)}</button></footer></div>`;
      const fim = v => { c.close(); res(v); };
      c.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => fim(b.dataset.r === '1')));
      c.addEventListener('cancel', () => res(false), { once: true });
      c.showModal();
      c.querySelector('[data-r="1"]').focus();
    });
  }
  function erroForm(form, msg) {
    let e = form.querySelector('.erro-form');
    if (!e) { e = document.createElement('div'); e.className = 'erro-form'; e.setAttribute('role', 'alert'); (form.querySelector('.form-grade') || form.querySelector('.dlg-corpo')).prepend(e); }
    e.textContent = msg;
    e.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- avisos ---------- */
  function aviso(texto, op) {
    op = op || {};
    const box = $('#avisos');
    const el = document.createElement('div');
    el.className = 'aviso' + (op.tipo === 'erro' ? ' erro' : '');
    el.innerHTML = `${ic(op.tipo === 'erro' ? 'alerta' : 'ok')}<span>${esc(texto)}</span>${op.acao ? `<button type="button">${esc(op.acao.rotulo)}</button>` : ''}`;
    if (op.acao) el.querySelector('button').addEventListener('click', async () => { el.remove(); try { await op.acao.fn(); } catch (e) { aviso(e.message, { tipo: 'erro' }); } });
    box.append(el);
    setTimeout(() => el.remove(), op.acao ? 9000 : 5000);
  }

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- contexto (data de referência + limiares) ---------- */
  let cfg = null;
  async function contexto() { cfg = await D.config.obter(); return R.contexto(cfg); }

  function pintarTopo(c) {
    const p = $('#ref-pilula');
    const hoje = R.hojeISO();
    const simulando = !!cfg.dataRef && cfg.dataRef !== hoje;
    p.classList.toggle('simulando', simulando);
    p.innerHTML = `<span class="rot">${simulando ? 'Situação em' : 'Hoje'}</span><b>${R.fmtData(c.ref)}</b>${ic('calendario')}`;
    p.title = simulando ? 'A situação está sendo calculada para esta data. Clique para mudar.' : 'Data usada nos cálculos. Clique para simular outra data.';
    const escuro = document.documentElement.dataset.tema === 'escuro';
    $('#btn-tema').innerHTML = ic(escuro ? 'sol' : 'lua');
    $('#btn-tema').setAttribute('aria-label', escuro ? 'Usar tema claro' : 'Usar tema escuro');
    $('#btn-sair').title = `Sair (${D.auth.email()})`;
    $('#btn-sair').setAttribute('aria-label', `Sair (${D.auth.email()})`);
  }

  /* ---------- rotas ---------- */
  async function rotear(op) {
    op = op || {};
    if (document.body.classList.contains('sem-sessao')) return;   // ninguém logado: só a tela de entrada
    const h = location.hash || '#/painel';
    const c = await contexto();
    pintarTopo(c);
    let tela, m, navAtivo = 'painel';
    if ((m = h.match(/^#\/aeronave\/([^/]+)(?:\/([^/?]+))?/))) { tela = await AC.telas.aeronave(decodeURIComponent(m[1]), m[2], c, op); navAtivo = 'aeronave'; }
    else if ((m = h.match(/^#\/vencimentos(?:\/([^/]+))?/))) { tela = await AC.telas.vencimentos(m[1], c); navAtivo = 'vencimentos'; }
    else if ((m = h.match(/^#\/imprimir\/([^/]+)\/([^/]+)/))) { tela = await AC.telas.imprimir(decodeURIComponent(m[1]), m[2], c); navAtivo = 'aeronave'; }
    else tela = await AC.telas.painel(c);
    const main = $('#conteudo');
    main.innerHTML = tela.html;
    document.title = (tela.titulo ? tela.titulo + ' · ' : '') + 'AeroControl';
    document.querySelectorAll('.nav [data-nav]').forEach(a => {
      if (a.dataset.nav === navAtivo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const mesmaRota = AC.estado.rotaAnterior === h;
    if (!op.manterScroll && !mesmaRota) window.scrollTo(0, 0);
    AC.estado.rotaAnterior = h;
    if (tela.depois) await tela.depois();
    if (AC.estado.abrirItemApos) { const id = AC.estado.abrirItemApos; AC.estado.abrirItemApos = null; AC.acoes.abrirItem({ dataset: { id } }); }
  }
  AC.redesenhar = () => rotear({ manterScroll: true });

  /* ---------- menu "Aeronaves" do topo ---------- */
  async function montarMenuAeronaves() {
    const box = $('#lista-aeronaves');
    const avs = await D.aeronaves.listar();
    const itens = await D.itens.todos(), lans = await D.lancamentos.todos();
    const ctx = R.contexto(cfg);
    box.innerHTML = avs.map(a => {
      const s = R.resumoAeronave(a, itens, ctx, lans);
      const sit = s.cont.vencido ? 'vencido' : s.cont.atencao ? 'atencao' : 'ok';
      return `<a class="menu-av" href="#/aeronave/${a.id}"><span class="ponto p-${sit}" aria-hidden="true"></span><b>${esc(a.matricula)}</b><small>${esc(a.modelo)}</small><span class="so-leitor">${R.SITUACOES[sit].rotulo}</span></a>`;
    }).join('') + `<hr><button type="button" data-acao="novaAeronave">${ic('mais')}Nova aeronave</button><button type="button" data-acao="importarFrota">${ic('subir')}Importar frota (planilha)</button>`;
  }

  /* ---------- busca global (P/N, N/S, nomenclatura, matrícula) ---------- */
  let tBusca = null;
  async function buscar(q) {
    const res = $('#busca-res');
    q = q.trim().toLowerCase();
    if (q.length < 2) { res.hidden = true; return; }
    const avs = await D.aeronaves.listar();
    const porId = new Map(avs.map(a => [a.id, a]));
    const itens = await D.itens.todos();
    const termos = q.split(/\s+/);
    const achados = [];
    for (const a of avs) if (a.matricula.toLowerCase().includes(q.replace(/\s/g, ''))) achados.push({ tipo: 'av', a });
    for (const it of itens) {
      if (it.situacao === 'nota') continue;
      const alvo = `${it.nome} ${it.pn} ${it.ns} ${porId.get(it.aeronaveId)?.matricula || ''}`.toLowerCase();
      if (termos.every(t => alvo.includes(t))) achados.push({ tipo: 'item', it, a: porId.get(it.aeronaveId) });
      if (achados.length > 40) break;
    }
    if (!achados.length) { res.innerHTML = `<div class="vazio">Nada encontrado para “${esc(q)}”. Busque por nome do item, P/N, N/S ou matrícula.</div>`; res.hidden = false; return; }
    res.innerHTML = achados.slice(0, 14).map(x => {
      if (x.tipo === 'av') return `<button type="button" data-acao="irAeronave" data-id="${x.a.id}"><span class="mat-p">${esc(x.a.matricula)}</span><span class="r-nome">Abrir aeronave</span><span class="r-det">${esc(x.a.modelo)} · S/N ${esc(x.a.sn)}</span></button>`;
      const mapa = x.a?.mapas.find(m => m.id === x.it.mapa);
      return `<button type="button" data-acao="irItem" data-av="${x.a?.id}" data-mapa="${x.it.mapa}" data-id="${x.it.id}"><span class="mat-p">${esc(x.a?.matricula)}</span><span class="r-nome">${esc(x.it.nome)}</span><span class="r-det">${esc(mapa?.nome || '')}${x.it.pn ? ' · P/N ' + esc(x.it.pn) : ''}${x.it.ns ? ' · N/S ' + esc(x.it.ns) : ''}</span></button>`;
    }).join('');
    res.hidden = false;
  }

  /* ---------- ações da casca ---------- */
  Object.assign(AC.acoes, {
    fecharDialogo: el => { const d = el.closest('dialog'); if (d) d.close(); },
    irAeronave: el => { fecharBusca(); location.hash = `#/aeronave/${el.dataset.id}`; },
    irVencimentos: el => { location.hash = `#/vencimentos/${el.dataset.v}`; },
    irItem: el => {
      fecharBusca();
      const alvo = `#/aeronave/${el.dataset.av}/${el.dataset.mapa}`;
      AC.estado.filtro = { sit: 'todos', busca: '', mostrarNA: true };
      AC.estado.abrirItemApos = el.dataset.id;
      if (location.hash === alvo) rotear({ manterScroll: true }); else location.hash = alvo;
    },
    tema: () => {
      const escuro = document.documentElement.dataset.tema !== 'escuro';
      document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
      try { localStorage.setItem('aerocontrol.tema', escuro ? 'escuro' : 'claro'); } catch (e) { /* sem armazenamento: só nesta sessão */ }
      pintarTopo(R.contexto(cfg));
    },
    sair: async () => { await D.auth.sair(); telaEntrar(); }
  });
  function fecharBusca() { $('#busca-res').hidden = true; $('#busca-global').value = ''; }

  /* ---------- eventos (delegação única: telas redesenhadas não acumulam ouvintes) ---------- */
  function ligar() {
    document.addEventListener('click', async e => {
      const el = e.target.closest('[data-acao]');
      if (!el) {
        if (!e.target.closest('.busca')) $('#busca-res').hidden = true;
        document.querySelectorAll('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
        return;
      }
      const fn = AC.acoes[el.dataset.acao];
      if (!fn) return;
      if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
      const menu = el.closest('details.menu'); if (menu) menu.open = false;
      try { await fn(el, e); } catch (err) { console.error(err); aviso(err.message || 'Algo deu errado.', { tipo: 'erro' }); }
    });
    document.addEventListener('keydown', e => {
      const tr = e.target.closest && e.target.closest('tr[data-acao]');
      if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); AC.acoes[tr.dataset.acao](tr); }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('#busca-global').focus(); }
      if (e.key === 'Escape' && document.activeElement === $('#busca-global')) fecharBusca();
      if (e.key === 'ArrowDown' && document.activeElement === $('#busca-global')) { const b = $('#busca-res button'); if (b) { e.preventDefault(); b.focus(); } }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest && e.target.closest('#busca-res')) {
        e.preventDefault();
        const bs = [...document.querySelectorAll('#busca-res button')]; const i = bs.indexOf(e.target);
        const prox = bs[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (prox) prox.focus(); else if (e.key === 'ArrowUp') $('#busca-global').focus();
      }
    });
    document.addEventListener('submit', async e => {
      const f = e.target.closest('form[data-form]');
      if (!f) return;
      e.preventDefault();
      const fn = AC.forms[f.dataset.form];
      const btn = f.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      try { await fn(f); } catch (err) { console.error(err); erroForm(f, err.message || 'Não foi possível salvar.'); }
      finally { if (btn) btn.disabled = false; }
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'busca-global') { clearTimeout(tBusca); tBusca = setTimeout(() => buscar(e.target.value), 120); return; }
      const f = e.target.closest('form[data-previa]');
      if (f) AC.previas[f.dataset.previa]?.(f);
      const filtro = e.target.dataset && e.target.dataset.filtro;
      if (filtro && (e.target.type === 'search' || e.target.type === 'text') && AC.telas.aoFiltrar) AC.telas.aoFiltrar(filtro, e.target);
    });
    document.addEventListener('change', e => {
      const filtro = e.target.dataset && e.target.dataset.filtro;
      if (filtro && e.target.type !== 'search' && e.target.type !== 'text' && AC.telas.aoFiltrar) AC.telas.aoFiltrar(filtro, e.target);
      const f = e.target.closest('form[data-previa]');
      if (f) AC.previas[f.dataset.previa]?.(f);
    });
    ['#dlg', '#folha'].forEach(sel => $(sel).addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); }));
    window.addEventListener('hashchange', () => { fecharDialogo(); fecharFolha(); document.querySelectorAll('details.menu[open]').forEach(d => { d.open = false; }); rotear(); });
    $('#menu-aeronaves').addEventListener('toggle', e => { if (e.target.open) montarMenuAeronaves(); });
    /* voltou para a aba depois de 2 min fora: recarrega para mostrar o que outra pessoa mudou */
    let saiuEm = 0;
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) { saiuEm = Date.now(); return; }
      if (!saiuEm || Date.now() - saiuEm < 120000 || document.body.classList.contains('sem-sessao') || document.querySelector('dialog[open]')) return;
      try { await D.recarregar(); await AC.redesenhar(); }
      catch (e) { if (D.auth.email()) aviso(e.message, { tipo: 'erro' }); else telaEntrar(e.message); }
    });
  }

  AC.ui = { $, esc, ic, faixa, etiqueta, medidor, quando, moldura, abrirDialogo, fecharDialogo, abrirFolha, fecharFolha, confirmar, erroForm, aviso, baixar };
  AC.contexto = contexto;
  AC.cfg = () => cfg;

  /* ---------- entrada (login) ---------- */
  function telaEntrar(msg) {
    fecharDialogo(); fecharFolha();
    document.body.classList.add('sem-sessao');
    document.title = 'Entrar · AeroControl';
    $('#conteudo').innerHTML = `<section class="entrar">${ARCOS}
      <form class="entrar-cartao" id="form-entrar" novalidate>
        <div class="entrar-marca">${$('.marca-simbolo').outerHTML}<span>AeroControl<small>MICCA digital</small></span></div>
        <h1>Entrar</h1>
        <p class="entrar-sub">Controle de componentes da frota. Acesso só para usuários autorizados.</p>
        <div class="erro-form" role="alert"${msg ? '' : ' hidden'}>${esc(msg || '')}</div>
        <div class="campo"><label for="en-email">E-mail</label><input id="en-email" name="email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="en-senha">Senha</label><input id="en-senha" name="senha" type="password" autocomplete="current-password" required></div>
        <button type="submit" class="botao primario">Entrar</button>
        <p class="entrar-rodape">Esqueceu a senha? Fale com o administrador do sistema.</p>
      </form></section>`;
    const f = $('#form-entrar');
    const erro = texto => { const e = f.querySelector('.erro-form'); e.textContent = texto; e.hidden = false; };
    setTimeout(() => f.elements.email.focus(), 30);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.elements.email.value.trim().toLowerCase(), senha = f.elements.senha.value;
      if (!email || !senha) { erro('Informe e-mail e senha.'); return; }
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Entrando…';
      try { await D.auth.entrar(email, senha); await abrirApp(); }
      catch (err) { erro(err.message || 'Não foi possível entrar.'); btn.disabled = false; btn.textContent = 'Entrar'; }
    });
  }

  let ligado = false;
  async function abrirApp() {
    document.body.classList.remove('sem-sessao');
    if (!ligado) { ligar(); ligado = true; }
    await rotear();
  }
  async function iniciar() {
    D.auth.aoEncerrar = motivo => telaEntrar(motivo);
    try {
      if (await D.iniciar()) await abrirApp(); else telaEntrar();
    } catch (err) {
      console.error(err);
      if (!D.auth.email()) { telaEntrar(err.message); return; }
      $('#conteudo').innerHTML = `<div class="vazio-tabela"><strong>Não foi possível abrir o AeroControl</strong>${esc(err.message)}<div style="margin-top:14px"><button type="button" class="botao primario" onclick="location.reload()">Tentar de novo</button></div></div>`;
    }
  }
  document.addEventListener('DOMContentLoaded', iniciar);
})();

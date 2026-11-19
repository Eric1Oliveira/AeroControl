/* AeroControl — telas/painel.js
   Painel da frota: indicadores, situação dos itens, vencimentos previstos por mês,
   o que fazer primeiro, linha do tempo de 90 dias e as aeronaves (cartões ou tabela). */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras, D = AC.dados, U = AC.ui, G = AC.graficos;
  const { esc, ic } = U;
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const lerVista = () => { try { return localStorage.getItem('aerocontrol.vista') || 'cartoes'; } catch (e) { return 'cartoes'; } };
  const est = { vista: lerVista(), busca: '', filtro: 'todas', ordem: 'urgencia', dir: 1 };
  let linhas = [];
  const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

  /* ---------- aeronaves: cartões ou tabela (redesenhado a cada filtro) ---------- */
  function visiveis() {
    const q = est.busca.trim().toLowerCase();
    let l = linhas.filter(x => {
      if (est.filtro === 'vencido' && !x.s.cont.vencido) return false;
      if (est.filtro === 'atencao' && !x.s.cont.atencao) return false;
      if (est.filtro === 'ok' && (x.s.cont.vencido || x.s.cont.atencao)) return false;
      return !q || `${x.a.matricula} ${x.a.modelo} ${x.a.sn}`.toLowerCase().includes(q);
    });
    const chave = {
      urgencia: x => -(x.s.cont.vencido * 1e4 + x.s.cont.atencao), matricula: x => x.a.matricula, tsn: x => x.a.tsn,
      util: x => x.s.util.porDia, saude: x => x.pct, vencidos: x => x.s.cont.vencido, atencao: x => x.s.cont.atencao,
      proximo: x => x.urgente ? x.urgente.r.diasEquiv : Infinity, posicao: x => x.a.posicaoData || ''
    }[est.ordem];
    l = l.slice().sort((x, y) => {
      const a = chave(x), b = chave(y);
      const c = typeof a === 'string' ? a.localeCompare(b) : a - b;
      return (c || x.a.matricula.localeCompare(y.a.matricula)) * est.dir;
    });
    return l;
  }

  function prox(x) {
    if (!x.urgente) return '<span class="vazio-txt">Nada previsto</span>';
    const r = x.urgente.r;
    return `<b>${esc(x.urgente.it.nome)}</b><span class="quando ${r.situacao === 'vencido' ? 'q-venc' : ''}">${esc(U.quando(r))}</span>`;
  }

  function cartao(x) {
    const { a, s } = x;
    const tags = [];
    if (s.cont.vencido) tags.push(U.etiqueta('vencido', plural(s.cont.vencido, 'vencido', 'vencidos')));
    if (s.cont.atencao) tags.push(U.etiqueta('atencao', `${s.cont.atencao} em atenção`));
    if (s.cont.semregistro) tags.push(U.etiqueta('semregistro', `${s.cont.semregistro} sem lançamento`));
    if (!s.cont.vencido && !s.cont.atencao) tags.unshift(U.etiqueta('ok', 'Tudo em dia'));
    const parado = s.diasSemHoras !== null && s.diasSemHoras > 15;
    return `<a class="av-cartao s-${x.pior}" href="#/aeronave/${a.id}">
      <div class="avc-topo">
        <div class="avc-id"><span class="avc-mat">${esc(a.matricula)}</span>
          <span class="avc-mod">${esc(a.modelo)}${a.ano ? ` · ${esc(a.ano)}` : ''}${a.demo ? '<span class="selo-ficticia">Fictícia</span>' : ''}</span></div>
        ${G.anel(x.pct, x.pior, `${Math.floor(x.pct * 100)}% dos itens em dia`)}
      </div>
      <dl class="avc-dados">
        <div><dt>TSN da célula</dt><dd>${R.fmtH(a.tsn)} h</dd></div>
        <div><dt>Utilização</dt><dd>${R.fmtH(s.util.porDia * 30.4375)} h/mês</dd></div>
        <div class="${parado ? 'parado' : ''}"><dt>Horas lançadas em</dt><dd>${R.fmtData(a.posicaoData)}${parado ? `<small>há ${s.diasSemHoras} dias</small>` : ''}</dd></div>
        <div><dt>Itens controlados</dt><dd>${s.cont.controlados}</dd></div>
      </dl>
      <div class="avc-prox"><span class="avc-rot">${x.urgente && x.urgente.r.situacao === 'vencido' ? 'Mais urgente' : 'Próximo vencimento'}</span>${prox(x)}</div>
      <div class="avc-tags">${tags.join('')}</div>
    </a>`;
  }

  function tabela(l) {
    const th = (c, rot, cls) => {
      const ativo = est.ordem === c;
      return `<th scope="col" class="${cls || ''}" aria-sort="${ativo ? (est.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="ord${ativo ? ' ativo' : ''}" data-acao="ordenarFrota" data-c="${c}">${rot}${ic('ordenar')}</button></th>`;
    };
    const linhaT = x => {
      const { a, s } = x;
      const partes = [{ valor: s.cont.ok, cor: G.COR.ok }, { valor: s.cont.atencao, cor: G.COR.atencao }, { valor: s.cont.vencido, cor: G.COR.vencido }, { valor: s.cont.semregistro, cor: G.COR.semregistro }];
      return `<tr class="linha s-${x.pior}" data-acao="irAeronave" data-id="${a.id}">
        <td><a class="tf-mat" href="#/aeronave/${a.id}">${esc(a.matricula)}</a><span class="tf-sub">${esc(a.modelo)}${a.demo ? ' · fictícia' : ''}</span></td>
        <td class="num">${R.fmtH(a.tsn)} h<span class="tf-sub">em ${R.fmtData(a.posicaoData)}</span></td>
        <td class="num">${R.fmtH(s.util.porDia * 30.4375)}<span class="tf-sub">h/mês</span></td>
        <td class="tf-saude">${G.segmentada(partes)}<span class="tf-pct">${Math.floor(x.pct * 100)}% em dia</span></td>
        <td class="num">${s.cont.vencido ? U.etiqueta('vencido', String(s.cont.vencido)) : '<span class="vazio-txt">—</span>'}</td>
        <td class="num">${s.cont.atencao ? U.etiqueta('atencao', String(s.cont.atencao)) : '<span class="vazio-txt">—</span>'}</td>
        <td class="tf-prox">${prox(x)}</td></tr>`;
    };
    return `<div class="tabela-caixa"><table class="micca tab-frota">
      <thead><tr>${th('matricula', 'Aeronave')}${th('tsn', 'TSN da célula', 'num')}${th('util', 'Utilização', 'num')}${th('saude', 'Saúde dos itens')}${th('vencidos', 'Vencidos', 'num')}${th('atencao', 'Atenção', 'num')}${th('proximo', 'Próximo vencimento')}</tr></thead>
      <tbody>${l.map(linhaT).join('')}</tbody></table></div>`;
  }

  function secaoAeronaves() {
    const l = visiveis();
    if (!l.length) return `<div class="vazio-bloco"><strong>Nenhuma aeronave com esse filtro</strong>Limpe a busca ou escolha “Todas”.</div>`;
    return est.vista === 'tabela' ? tabela(l) : `<div class="grade-av">${l.map(cartao).join('')}</div>`;
  }
  function redesenharAeronaves() {
    const box = document.getElementById('frota-conteudo');
    if (box) box.innerHTML = secaoAeronaves();
    document.querySelectorAll('#vista-frota button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === est.vista)));
    const n = document.getElementById('n-frota'); if (n) n.textContent = plural(visiveis().length, 'aeronave', 'aeronaves');
  }

  /* ---------- tela ---------- */
  AC.telas.painel = async (ctx) => {
    AC.telas.aoFiltrar = null;
    const cfg = AC.cfg();
    const avs = await D.aeronaves.listar();
    if (!avs.length) {
      return { titulo: 'Painel', html: U.faixa({ sobre: 'Painel da frota', titulo: 'Nenhuma aeronave cadastrada', sub: 'Cadastre a primeira aeronave para começar a controlar os itens do MICCA.', acoes: `<button type="button" class="botao ouro" data-acao="novaAeronave">${ic('mais')}Cadastrar aeronave</button>` }) };
    }
    const itens = await D.itens.todos(), lans = await D.lancamentos.todos();
    const porId = new Map(itens.map(i => [i.id, i]));
    const tot = { vencido: 0, atencao: 0, ok: 0, semregistro: 0, controlados: 0 };
    const meses = new Map(), urgentes = [];
    const fimAno = R.somaDias(ctx.ref, 365);
    linhas = avs.map(a => {
      const s = R.resumoAeronave(a, itens, ctx, lans);
      for (const k of Object.keys(tot)) tot[k] += s.cont[k] || 0;
      const vencidos = [], urg = [], porDia = new Map();
      for (const [id, r] of s.calc) {
        const it = porId.get(id);
        if (r.situacao === 'vencido') { vencidos.push({ it, r }); urg.push({ a, it, r }); }
        else if (r.situacao === 'atencao') urg.push({ a, it, r });
        if ((r.situacao === 'ok' || r.situacao === 'atencao') && r.previsao) {
          if (r.previsao <= fimAno) meses.set(r.previsao.slice(0, 7), (meses.get(r.previsao.slice(0, 7)) || 0) + 1);
          const dia = Math.max(0, Math.floor(r.diasEquiv));
          if (dia <= 90) {
            const m = porDia.get(dia) || { dia, itens: [], sit: 'ok' };
            m.itens.push({ it, r });
            if (r.situacao === 'atencao') m.sit = 'atencao';
            porDia.set(dia, m);
          }
        }
      }
      urg.sort((x, y) => R.porUrgencia(x.r, y.r));
      urgentes.push(...urg);
      const urgente = urg[0] || (s.proximo ? { a, it: s.proximo.item, r: s.proximo.r } : null);
      return {
        a, s, urgente, vencidos: vencidos.sort((x, y) => R.porUrgencia(x.r, y.r)), marcas: [...porDia.values()].sort((x, y) => x.dia - y.dia),
        pct: s.cont.controlados ? s.cont.ok / s.cont.controlados : 0, pior: s.cont.vencido ? 'vencido' : s.cont.atencao ? 'atencao' : 'ok'
      };
    });
    urgentes.sort((x, y) => R.porUrgencia(x.r, y.r));
    const porUrg = linhas.slice().sort((x, y) => (y.s.cont.vencido - x.s.cont.vencido) || (y.s.cont.atencao - x.s.cont.atencao) || x.a.matricula.localeCompare(y.a.matricula));

    /* horas voadas: últimos 30 dias contra os 30 anteriores */
    const desde = R.somaDias(ctx.ref, -30), antes = R.somaDias(ctx.ref, -60);
    const soma = (de, ate) => lans.filter(l => l.data > de && l.data <= ate).reduce((t, l) => t + (l.horas || 0), 0);
    const h30 = soma(desde, ctx.ref), h30a = soma(antes, desde);
    const delta = h30a ? (h30 - h30a) / h30a : null;
    const avComVenc = linhas.filter(x => x.s.cont.vencido).length;
    const parados = linhas.filter(x => x.s.diasSemHoras !== null && x.s.diasSemHoras > 15);
    const pctOk = tot.controlados ? tot.ok / tot.controlados : 0;
    const simulando = cfg.dataRef && cfg.dataRef !== R.hojeISO();

    const nota = cfg.demo && cfg.avisoDemo ? `<div class="faixa-nota"><span class="selo-demo">Demonstração</span>
      <p>O <b>PR-ELF</b> tem os dados reais dos três MICCAs (posição de 11/10/2023) e os vencimentos conferem com o papel. As outras ${avs.length - 1} aeronaves são fictícias.</p>
      ${simulando ? `<button type="button" class="botao pequeno claro" data-acao="usarHoje">Ver a situação de hoje</button>` : `<button type="button" class="botao pequeno claro" data-acao="usarDataMicca">Voltar para 11/10/2023</button>`}
      <button type="button" class="botao pequeno fantasma-claro" data-acao="fecharDemo">Ocultar</button></div>` : '';

    const heroi = `<div class="heroi"><span class="heroi-v">${G.pct(tot.ok, tot.controlados)}</span><span class="heroi-r">dos itens controlados em dia</span><span class="heroi-d">${tot.ok.toLocaleString('pt-BR')} de ${tot.controlados.toLocaleString('pt-BR')}</span></div>`;

    const kpi = (href, cls, icone, rot, valor, pe) => `<a class="kpi ${cls}" href="${href}"><span class="kpi-rot"><span class="kpi-ic">${ic(icone)}</span>${rot}</span><span class="kpi-v">${valor}</span><span class="kpi-pe">${pe}</span></a>`;
    const kpis = `<section class="kpis sobreposto" aria-label="Indicadores da frota">
      ${kpi('#/vencimentos/vencido', 'k-venc', 'alerta', 'Itens vencidos', tot.vencido.toLocaleString('pt-BR'), avComVenc ? `em ${plural(avComVenc, 'aeronave', 'aeronaves')}` : 'nenhuma aeronave com vencido')}
      ${kpi('#/vencimentos/atencao', 'k-aten', 'relogio', 'Em atenção', tot.atencao.toLocaleString('pt-BR'), `vencem em até ${ctx.alertaDias} dias ou ${R.fmtH(ctx.alertaHoras).replace(',0', '')} h`)}
      ${kpi('#/vencimentos/semregistro', 'k-sem', 'lista', 'Sem lançamento', tot.semregistro.toLocaleString('pt-BR'), 'itens sem data de cumprimento')}
      ${kpi('#/vencimentos/90', 'k-horas', 'aviao', 'Horas voadas em 30 dias', `${R.fmtH(h30)}<small> h</small>`, delta === null ? (parados.length ? `${parados.map(p => p.a.matricula).join(', ')} sem lançar horas` : 'sem base de comparação') : `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}% sobre os 30 dias anteriores`)}
    </section>`;

    /* rosca + legenda */
    const partes = [
      { chave: 'ok', rotulo: 'Em dia', valor: tot.ok, cor: G.COR.ok, href: '' },
      { chave: 'atencao', rotulo: 'Em atenção', valor: tot.atencao, cor: G.COR.atencao, href: '#/vencimentos/atencao' },
      { chave: 'vencido', rotulo: 'Vencidos', valor: tot.vencido, cor: G.COR.vencido, href: '#/vencimentos/vencido' },
      { chave: 'semregistro', rotulo: 'Sem lançamento', valor: tot.semregistro, cor: G.COR.semregistro, href: '#/vencimentos/semregistro' }
    ];
    const legenda = partes.map(p => {
      const corpo = `<i style="background:var(${p.cor})"></i><span>${p.rotulo}</span><b>${p.valor.toLocaleString('pt-BR')}</b><small>${G.pct(p.valor, tot.controlados)}</small>`;
      return p.href ? `<a class="leg" href="${p.href}">${corpo}</a>` : `<span class="leg">${corpo}</span>`;
    }).join('');
    const cartaoRosca = `<section class="cartao">
      <header class="cartao-cab"><div><h2>Situação dos itens</h2><p>${tot.controlados.toLocaleString('pt-BR')} itens controlados na frota</p></div></header>
      <div class="rosca-corpo">${G.rosca(partes, { valor: G.pct(tot.ok, tot.controlados), rotulo: 'em dia' }, `Situação dos itens: ${partes.map(p => `${p.rotulo} ${p.valor}`).join(', ')}`)}
        <div class="legenda">${legenda}</div></div></section>`;

    /* colunas: próximos 12 meses */
    const colDados = [];
    for (let k = 0; k < 12; k++) {
      const d = R.somaMeses(ctx.ref.slice(0, 8) + '01', k);
      const [y, m] = d.split('-').map(Number);
      colDados.push({ rotulo: MESES[m - 1] + (m === 1 || k === 0 ? `/${String(y).slice(2)}` : ''), valor: meses.get(d.slice(0, 7)) || 0, dica: `${MESES_LONGOS[m - 1]} de ${y}` });
    }
    const totalAno = colDados.reduce((t, c) => t + c.valor, 0);
    const cartaoColunas = `<section class="cartao">
      <header class="cartao-cab"><div><h2>Vencimentos previstos</h2><p>${totalAno.toLocaleString('pt-BR')} itens nos próximos 12 meses, pela data ou pela média de horas</p></div></header>
      ${G.colunas(colDados, `Vencimentos previstos por mês: ${colDados.map(c => `${c.dica} ${c.valor}`).join(', ')}`)}</section>`;

    /* fazer primeiro */
    const fazer = urgentes.slice(0, 6).map(({ a, it, r }) => `<li><button type="button" class="fp-item" data-acao="abrirItem" data-id="${it.id}">
        <span class="fp-mat">${esc(a.matricula)}</span>
        <span class="fp-txt"><span class="fp-nome">${esc(it.nome)}</span><span class="fp-quando">${esc(U.quando(r))}</span></span>
        ${U.etiqueta(r.situacao)}</button></li>`).join('');
    const cartaoFazer = `<section class="cartao cartao-lista">
      <header class="cartao-cab"><div><h2>Fazer primeiro</h2><p>${plural(urgentes.length, 'item vencido ou em atenção', 'itens vencidos ou em atenção')}</p></div>
        <a class="link-cab" href="#/vencimentos/vencido">Ver todos</a></header>
      ${fazer ? `<ol class="fp-lista">${fazer}</ol>` : `<div class="vazio-bloco"><strong>Nada vencido nem em atenção</strong>A frota está em dia.</div>`}</section>`;

    /* linha do tempo */
    const cartaoTempo = `<section class="cartao">
      <header class="cartao-cab"><div><h2>Próximos 90 dias</h2><p>Cada marca é um vencimento previsto. Números indicam vários itens no mesmo dia.</p></div>
        <div class="leg-linha"><span><i class="lg-losango" style="background:var(${G.COR.vencido})"></i>Vencido</span><span><i style="background:var(${G.COR.atencao})"></i>Em atenção</span><span><i style="background:var(${G.COR.ok})"></i>Em dia</span></div></header>
      ${G.linhaTempo(porUrg, ctx.ref, 90)}</section>`;

    const filtros = `<div class="secao-cab">
        <div><h2 class="titulo-secao">Aeronaves</h2><p class="secao-sub" id="n-frota">${plural(linhas.length, 'aeronave', 'aeronaves')}</p></div>
        <div class="secao-ferr">
          <label class="campo-busca">${ic('busca')}<span class="so-leitor">Buscar aeronave</span><input type="search" data-filtro="buscaFrota" value="${esc(est.busca)}" placeholder="Buscar aeronave"></label>
          <label class="so-leitor" for="filtro-frota">Situação</label>
          <select id="filtro-frota" class="sel-filtro" data-filtro="filtroFrota">
            <option value="todas"${est.filtro === 'todas' ? ' selected' : ''}>Todas</option><option value="vencido"${est.filtro === 'vencido' ? ' selected' : ''}>Com vencidos</option>
            <option value="atencao"${est.filtro === 'atencao' ? ' selected' : ''}>Com itens em atenção</option><option value="ok"${est.filtro === 'ok' ? ' selected' : ''}>Em dia</option></select>
          <div class="segmentos" id="vista-frota" role="group" aria-label="Exibir como">
            <button type="button" data-acao="vistaFrota" data-v="cartoes" aria-pressed="${est.vista === 'cartoes'}">${ic('grade')}Cartões</button>
            <button type="button" data-acao="vistaFrota" data-v="tabela" aria-pressed="${est.vista === 'tabela'}">${ic('tabela')}Tabela</button></div>
          <button type="button" class="botao primario" data-acao="novaAeronave">${ic('mais')}Nova aeronave</button>
        </div></div>`;

    const html = `
      ${U.faixa({ sobre: 'Painel da frota', titulo: 'Situação da frota', sub: `${plural(avs.length, 'aeronave', 'aeronaves')} · situação em ${R.fmtData(ctx.ref)}`, direita: heroi, nota, alta: true })}
      <div class="pagina">
        ${kpis}
        <div class="grade-3">${cartaoRosca}${cartaoColunas}${cartaoFazer}</div>
        ${cartaoTempo}
        <section class="secao" aria-labelledby="t-aeronaves">${filtros.replace('class="titulo-secao"', 'class="titulo-secao" id="t-aeronaves"')}
          <div id="frota-conteudo">${secaoAeronaves()}</div></section>
      </div>`;
    return {
      titulo: 'Painel', html,
      depois: () => {
        AC.telas.aoFiltrar = (campo, el) => {
          if (campo === 'buscaFrota') est.busca = el.value;
          if (campo === 'filtroFrota') est.filtro = el.value;
          redesenharAeronaves();
        };
      }
    };
  };

  Object.assign(AC.acoes, {
    vistaFrota: el => { est.vista = el.dataset.v; try { localStorage.setItem('aerocontrol.vista', est.vista); } catch (e) { /* só nesta sessão */ } redesenharAeronaves(); },
    ordenarFrota: el => {
      const c = el.dataset.c;
      if (est.ordem === c) est.dir = -est.dir; else { est.ordem = c; est.dir = ['vencidos', 'atencao', 'tsn', 'util'].includes(c) ? -1 : 1; }
      redesenharAeronaves();
    }
  });
})();

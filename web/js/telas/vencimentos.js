/* AeroControl — telas/vencimentos.js
   Planejamento da frota: tudo que vence numa janela de tempo, por data ou
   pela previsão de horas na utilização média de cada aeronave. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras, D = AC.dados, U = AC.ui;
  const { esc, ic } = U;
  const JANELAS = [
    ['vencido', 'Vencidos'], ['atencao', 'Em atenção'], ['30', 'Até 30 dias'], ['90', 'Até 90 dias'], ['365', 'Até 1 ano'], ['semregistro', 'Sem lançamento']
  ];
  const est = { janela: '90', av: '', tipo: '', busca: '' };
  let dados = null;

  function passa(x) {
    const r = x.r, j = est.janela;
    if (j === 'vencido' || j === 'atencao' || j === 'semregistro') { if (r.situacao !== j) return false; }
    else {
      if (!['vencido', 'atencao', 'ok'].includes(r.situacao)) return false;
      if (!(r.situacao === 'vencido' || r.diasEquiv <= Number(j) || (r.horasRest !== null && r.horasRest <= 0))) return false;
    }
    if (est.av && x.a.id !== est.av) return false;
    if (est.tipo && x.mapa?.tipo !== est.tipo) return false;
    if (est.busca) {
      const alvo = `${x.it.nome} ${x.it.pn} ${x.it.ns} ${x.a.matricula}`.toLowerCase();
      if (!est.busca.toLowerCase().split(/\s+/).every(t => alvo.includes(t))) return false;
    }
    return true;
  }

  function linhas() {
    const lista = dados.filter(passa);
    if (!lista.length) return { n: 0, html: `<tr><td colspan="6"><div class="vazio-tabela"><strong>Nada nesta janela</strong>${est.janela === 'vencido' ? 'Nenhum item vencido com esses filtros.' : 'Amplie a janela de tempo ou limpe os filtros.'}</div></td></tr>` };
    return {
      n: lista.length,
      html: lista.map(({ a, it, r, mapa }) => {
        const venc = r.situacao === 'semregistro' ? '—'
          : `${r.vencData ? `<span class="l1 ${r.rege === 'data' ? 'rege' + (r.diasRest < 0 ? ' v' : '') : ''}">${R.fmtData(r.vencData)}</span>` : ''}${r.vencTsn !== null ? `<span class="l2 ${r.rege === 'horas' ? 'rege' + (r.horasRest < 0 ? ' v' : '') : ''}">TSN ${R.fmtH(r.vencTsn)}</span>` : ''}`;
        const prev = r.previsao && r.situacao !== 'vencido' ? `<span class="l1">≈ ${R.fmtData(r.previsao)}</span><span class="l2">por ${r.rege === 'horas' ? 'horas' : 'data'}</span>` : r.situacao === 'vencido' ? '<span class="l1 rege v">já vencido</span>' : '—';
        return `<tr class="linha com-av s-${r.situacao}" data-acao="abrirItem" data-id="${it.id}">
          <td class="c-av"><a href="#/aeronave/${a.id}/${it.mapa}">${esc(a.matricula)}</a><span class="c-mapa">${esc(mapa?.nome || '')}</span></td>
          <td class="c-nome"><button type="button" class="nome-item" data-acao="abrirItem" data-id="${it.id}">${esc(it.nome)}</button>${it.pn || it.ns ? `<div class="pnns">${it.pn ? `<span>P/N ${esc(it.pn)}</span>` : ''}${it.ns ? `<span>N/S ${esc(it.ns)}</span>` : ''}</div>` : ''}</td>
          <td class="c-venc" data-rot="Vencimento">${venc}</td>
          <td class="c-disp">${r.situacao === 'semregistro' ? `<button type="button" class="link" data-acao="cumprimento" data-id="${it.id}">Registrar cumprimento</button>` : U.medidor(r)}</td>
          <td class="c-venc" data-rot="Previsão">${prev}</td>
          <td class="c-sit">${U.etiqueta(r.situacao)}</td></tr>`;
      }).join('')
    };
  }

  function redesenhar() {
    const { n, html } = linhas();
    document.getElementById('corpo-venc').innerHTML = html;
    document.getElementById('n-venc').textContent = `${n} ${n === 1 ? 'item' : 'itens'}`;
    document.querySelectorAll('#janelas button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === est.janela)));
  }

  AC.telas.vencimentos = async (filtro, ctx) => {
    if (filtro && JANELAS.some(j => j[0] === filtro)) est.janela = filtro;
    const avs = await D.aeronaves.listar();
    const itens = await D.itens.todos();
    const lans = await D.lancamentos.todos();
    const porAv = new Map(avs.map(a => [a.id, a]));
    const util = new Map(avs.map(a => [a.id, R.utilizacaoDia(a, lans, ctx.ref).porDia]));
    dados = [];
    for (const it of itens) {
      const a = porAv.get(it.aeronaveId);
      if (!a || it.situacao !== 'controlado') continue;
      const r = R.calcular(it, a, ctx, util.get(a.id));
      dados.push({ a, it, r, mapa: a.mapas.find(m => m.id === it.mapa) });
    }
    dados.sort((x, y) => R.porUrgencia(x.r, y.r) || x.a.matricula.localeCompare(y.a.matricula));
    const { n, html } = linhas();

    return {
      titulo: 'Vencimentos',
      html: `
      ${U.faixa({ sobre: 'Planejamento', titulo: 'Vencimentos da frota', sub: `Por data ou pela previsão de horas na utilização média de cada aeronave · situação em ${R.fmtData(ctx.ref)}`,
        acoes: `<button type="button" class="botao claro" data-acao="exportarVencimentos">${ic('baixar')}Exportar lista (CSV)</button>` })}
      <div class="pagina pagina-simples">
      <div class="barra">
        <div class="segmentos" id="janelas" role="group" aria-label="Janela de tempo">${JANELAS.map(([v, rot]) => `<button type="button" data-acao="janelaVenc" data-v="${v}" aria-pressed="${est.janela === v}">${rot}</button>`).join('')}</div>
      </div>
      <div class="barra">
        <label class="campo-busca">${ic('busca')}<span class="so-leitor">Buscar</span><input type="search" data-filtro="busca" value="${esc(est.busca)}" placeholder="Item, P/N, N/S ou matrícula"></label>
        <label class="alternar">Aeronave
          <select data-filtro="av" class="sel-filtro"><option value="">Todas</option>${avs.map(a => `<option value="${a.id}"${est.av === a.id ? ' selected' : ''}>${esc(a.matricula)}</option>`).join('')}</select></label>
        <label class="alternar">Mapa
          <select data-filtro="tipo" class="sel-filtro"><option value="">Todos</option><option value="celula"${est.tipo === 'celula' ? ' selected' : ''}>Célula</option><option value="motor"${est.tipo === 'motor' ? ' selected' : ''}>Motor</option><option value="helice"${est.tipo === 'helice' ? ' selected' : ''}>Hélice</option></select></label>
        <span class="direita contagem" id="n-venc">${n} ${n === 1 ? 'item' : 'itens'}</span>
      </div>
      <div class="tabela-caixa"><table class="micca">
        <thead><tr><th scope="col">Aeronave</th><th scope="col">Item</th><th scope="col">Vencimento</th><th scope="col">Disponível</th><th scope="col">Previsão</th><th scope="col" style="text-align:right">Situação</th></tr></thead>
        <tbody id="corpo-venc">${html}</tbody></table></div></div>`,
      depois: () => {
        AC.telas.aoFiltrar = (campo, el) => { est[campo] = el.value; redesenhar(); };
      }
    };
  };

  Object.assign(AC.acoes, {
    janelaVenc: el => { est.janela = el.dataset.v; history.replaceState(null, '', `#/vencimentos/${est.janela}`); AC.estado.rotaAnterior = location.hash; redesenhar(); },
    exportarVencimentos: () => {
      const lista = dados.filter(passa);
      const cab = ['Aeronave', 'Mapa', 'Item', 'P/N', 'N/S', 'Situação', 'Vencimento data', 'Vencimento TSN', 'Disponível dias', 'Disponível horas', 'Previsão', 'Vence por'];
      const linhas = lista.map(({ a, it, r, mapa }) => [a.matricula, mapa?.nome, it.nome, it.pn, it.ns, R.SITUACOES[r.situacao]?.rotulo, R.fmtData(r.vencData), R.fmtH(r.vencTsn), r.diasRest ?? '', R.fmtH(r.horasRest), R.fmtData(r.previsao), r.rege || '']);
      U.baixar(`vencimentos-${est.janela}-${R.hojeISO()}.csv`, AC.planilha.csv([cab, ...linhas]), 'text/csv;charset=utf-8');
      U.aviso(`${lista.length} itens exportados.`);
    }
  });
})();

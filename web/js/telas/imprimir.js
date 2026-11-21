/* AeroControl — telas/imprimir.js
   Gera o MICCA no mesmo layout do papel (16 colunas, A4 paisagem),
   com os campos de vencimento e disponibilidade calculados na data de referência. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras, D = AC.dados, U = AC.ui;
  const { esc, ic } = U;

  const ABREV = `<div class="doc-abrev">
    <p>ABREVIATURAS:<br>P/N &gt;&gt;&gt; PART NUMBER (NÚMERO DE PARTE)<br>N/S &gt;&gt;&gt; NÚMERO DE SÉRIE<br>TLV &gt;&gt;&gt; TEMPO LIMITE DE VIDA<br>
    TBO &gt;&gt;&gt; TIME BETWEEN OVERHAUL (TEMPO ENTRE REVISÃO GERAL)<br>TSN &gt;&gt;&gt; TIME SINCE NEW (TEMPO DESDE NOVO)<br>TSO &gt;&gt;&gt; TIME SINCE OVERHAUL (TEMPO DESDE REVISÃO GERAL)<br>
    CSN &gt;&gt;&gt; CICLES SINCE NEW (CICLOS DESDE NOVO)<br>CSO &gt;&gt;&gt; CICLES SINCE OVERHAUL (CICLOS DESDE REVISÃO GERAL)<br>HS/T &gt;&gt;&gt; HORAS TOTAIS DA CÉLULA DA AERONAVE<br>
    C/T &gt;&gt;&gt; CICLOS TOTAIS DA CÉLULA DA AERONAVE<br>DATA &gt;&gt;&gt; DATA DE VENCIMENTO PARA ITENS COM CONTROLE DE VENCIMENTO POR DATA</p>
    <p>OBSERVAÇÕES:<br>(1) Os limites estabelecidos em horas deverão ser seguidos da letra H ao lado do valor numérico. Ex: 1.200:00H<br>
    (2) Os limites estabelecidos por data deverão ser seguidos das letras correspondentes. Ex: 4 anos 2 meses e 15 dias &gt;&gt;&gt; 4a 2m 15 d<br>
    (3) As colunas em OBS visam à utilização de qualquer tipo de controle não constante das abreviaturas acima ou específico para determinados modelos de aeronaves.<br>
    (4) Para os modelos de aeronaves em que o manual não especifica o critério de controle de ciclos, deverá ser utilizada a relação de números de ciclos igual ao número de pousos.<br>
    Os grandes componentes e seus acessórios, obrigatoriamente, deverão ser lançados no presente controle. Quando houver mais de um grande componente instalado, citar a posição de instalação: Ex: Motor esquerdo e Bomba de combustível do motor esquerdo</p></div>`;

  /* as 16 colunas de um item, no vocabulário do papel */
  function colunas(it, r) {
    const NA = 'N/A';
    const h = v => (v === null || v === undefined || v === '') ? NA : R.fmtH(v);
    const iv = v => v ? R.intervaloTxt(R.lerIntervalo(v), true) : NA;
    const base = [esc(iv(it.tlvData)), esc(h(it.tlvHoras)), esc(iv(it.tboData)), esc(h(it.tboHoras))];
    const sit = r.situacao;
    const marca = { outro: '**', na: NA, oc: 'O/C', pendente: 'regularizando' }[sit];
    if (marca) return [...base, ...Array(8).fill(marca)];
    const tsn = r.tsnComp === 'IGN' ? 'IGN' : r.tsnComp !== null ? R.fmtH(r.tsnComp) : NA;
    const tso = r.tso === 'NOVO' ? 'NOVO' : r.tso !== null ? R.fmtH(r.tso) : NA;
    const efD = it.efetuadoData ? R.fmtData(it.efetuadoData, it.efetuadoMes) : '';
    const efT = it.efetuadoTsn !== null && it.efetuadoTsn !== undefined ? R.fmtH(it.efetuadoTsn) : (it.efetuadoData ? NA : '');
    const vermelhoD = r.diasRest !== null && r.diasRest < 0, vermelhoH = r.horasRest !== null && r.horasRest < 0;
    const vD = r.vencData ? R.fmtData(r.vencData, it.validade ? it.validadeMes : it.efetuadoMes) : (sit === 'semregistro' ? '' : NA);
    const vT = r.vencTsn !== null ? R.fmtH(r.vencTsn) : (sit === 'semregistro' ? '' : NA);
    const dD = r.diasRest !== null ? String(r.diasRest).replace('-', '−') : (sit === 'semregistro' ? '' : NA);
    const dH = r.horasRest !== null ? R.fmtH(r.horasRest) : NA;
    const vm = (txt, v) => v ? `<span class="v">${txt}</span>` : txt;
    return [...base, tsn, tso, efD, efT, `<b>${vm(vD, vermelhoD)}</b>`, `<b>${vm(vT, vermelhoH)}</b>`, `<b>${vm(dD, vermelhoD)}</b>`, `<b>${vm(dH, vermelhoH)}</b>`];
  }

  AC.telas.imprimir = async (id, mapaId, ctx) => {
    AC.telas.aoFiltrar = null;
    const a = await D.aeronaves.obter(id);
    if (!a) return { titulo: 'Imprimir', html: `<div class="vazio-tabela"><strong>Aeronave não encontrada</strong></div>` };
    const mapa = a.mapas.find(m => m.id === mapaId) || a.mapas[0];
    const itens = (await D.itens.daAeronave(id)).filter(i => i.mapa === mapa.id).sort((x, y) => (y.principal - x.principal) || x.ordem - y.ordem);
    const util = R.utilizacaoDia(a, await D.lancamentos.todos(), ctx.ref).porDia;

    /* cabeçalho: célula mostra todos os grandes componentes; motor/hélice só o próprio */
    const grandes = a.mapas.filter(m => m.tipo !== 'celula' && (mapa.tipo === 'celula' || m.id === mapa.id));
    const todosItens = mapa.tipo === 'celula' ? await D.itens.daAeronave(id) : itens;
    const linhaGrande = m => {
      const p = todosItens.find(i => i.mapa === m.id && i.principal);
      const r = p ? R.calcular(p, a, ctx, util) : null;
      const tsn = r ? (r.tsnComp === 'IGN' ? 'IGN' : R.fmtH(r.tsnComp)) : '';
      const tso = r ? (r.tso === 'NOVO' ? 'NOVO' : R.fmtH(r.tso)) : '';
      return `<div class="doc-cab2"><span>${esc(m.nome)}${m.fabricante ? ` (${esc(m.fabricante)})` : ''}</span><span>Modelo: <b>${esc(m.modelo || '')}</b></span><span>S/N: <b>${esc(m.sn || '')}</b></span><span>TSN: <b>${tsn}</b></span><span>TSO: <b>${tso}</b></span></div>`;
    };

    let corpo = '', secao = null, grupo = null;
    for (const it of itens) {
      if (it.situacao === 'nota') { corpo += `<tr class="nota"><td colspan="16">${esc(it.nome)}</td></tr>`; continue; }
      if (it.secao !== secao) { secao = it.secao; grupo = null; if (secao) corpo += `<tr class="sec"><td>${esc(secao)}</td><td colspan="15"></td></tr>`; }
      if (it.grupo !== grupo) { grupo = it.grupo; if (grupo) corpo += `<tr class="grp"><td>${esc(grupo)}</td><td colspan="15"></td></tr>`; }
      const r = R.calcular(it, a, ctx, util);
      const c = colunas(it, r);
      corpo += `<tr><td class="nome">${esc(it.nome)}</td><td>${esc(it.pn)}</td><td>${esc(it.ns)}</td>${c.map((v, k) => `<td class="n${k >= 8 ? ' b' : ''}">${v}</td>`).join('')}<td class="obs">${esc(it.obs)}</td></tr>`;
    }

    const html = `
      ${U.faixa({
        migalha: `<a href="#/painel">Painel</a>${ic('seta')}<a href="#/aeronave/${a.id}/${mapa.id}">${esc(a.matricula)}</a>${ic('seta')}<span aria-current="page">Imprimir</span>`,
        sobre: 'Documento', titulo: `MICCA ${esc(a.matricula)}`, sub: `Mesmo layout do MICCA em papel, calculado em ${R.fmtData(ctx.ref)}. Vencidos saem em vermelho.`,
        acoes: `<div class="segmentos escuro" role="group" aria-label="Mapa">${a.mapas.map(m => `<a href="#/imprimir/${a.id}/${m.id}" ${m.id === mapa.id ? ' aria-current="page"' : ''}>${esc(m.nome)}</a>`).join('')}</div>
          <button type="button" class="botao ouro" data-acao="imprimir">${ic('imprimir')}Imprimir ou salvar PDF</button>`
      })}
      <div class="pagina pagina-simples">
      <article class="doc-folha">
        <div class="doc-tit">MICCA - MAPA INFORMATIVO DE CONTROLE DE COMPONENTES DA AERONAVE<br>PMA - PROGRAMA DE MANUTENÇÃO DE AERONAVE</div>
        <div class="doc-mapa">${esc((mapa.tipo === 'celula' ? 'CÉLULA' : mapa.nome).toUpperCase())}</div>
        <div class="doc-cab">
          <span>Matrícula: <b>${esc(a.matricula)}</b></span><span>Fabricante: <b>${esc(a.fabricante)}</b></span><span>Modelo: <b>${esc(a.modelo)}</b></span><span>S/N: <b>${esc(a.sn)}</b> &nbsp; Ano fabr.: <b>${esc(a.ano || '')}</b></span>
          <span>TSN Cel.: <b>${R.fmtH(a.tsn)}</b></span><span>TSO Cel.: <b>${a.tso !== null && a.tso !== undefined ? R.fmtH(a.tso) : 'N/A'}</b></span><span></span><span>Data: <b>${R.fmtData(ctx.ref)}</b></span>
        </div>
        ${grandes.map(linhaGrande).join('')}
        <div class="doc-man"><span>Manual de referência: <b>${esc(a.manualRef || '')}</b></span><span>Última revisão: <b>${a.manualRev ? R.fmtData(a.manualRev) : ''}</b></span></div>
        <table class="doc-tab">
          <thead>
            <tr><th rowspan="2">NOMENCLATURA</th><th rowspan="2">P/N</th><th rowspan="2">N/S</th><th colspan="2">TLV</th><th colspan="2">TBO</th><th rowspan="2">TSN</th><th rowspan="2">TSO</th><th colspan="2">EFETUADO</th><th colspan="2">VENCIMENTO</th><th colspan="2">DISPONIBILIDADE</th><th rowspan="2">OBS</th></tr>
            <tr><th>DATA</th><th>HORAS</th><th>DATA</th><th>HORAS</th><th>DATA</th><th>TSN</th><th>DATA</th><th>TSN</th><th>Tempo (Dias)</th><th>HS</th></tr>
          </thead>
          <tbody>${corpo || '<tr><td colspan="16">Nenhum item cadastrado neste mapa.</td></tr>'}</tbody>
        </table>
        ${mapa.tipo === 'celula' ? ABREV : ''}
        <div class="doc-rodape"><span>______________________ Inspetor</span><span>Gerado pelo AeroControl</span><span>MICCA${esc(a.matricula)}</span></div>
      </article></div>`;
    return { titulo: `MICCA ${a.matricula} · ${mapa.nome}`, html };
  };

  AC.acoes.imprimir = () => window.print();
})();

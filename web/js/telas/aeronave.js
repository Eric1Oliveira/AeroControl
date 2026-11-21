/* AeroControl — telas/aeronave.js
   Uma aeronave: painel de instrumentos (TSN, motor, hélice), um mapa por aba
   (Célula, Motor, Hélice…), histórico e a folha lateral de cada item. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras, D = AC.dados, U = AC.ui;
  const { esc, ic } = U;
  let atual = null; // { a, s, itens, ctx, aba }

  const NOMES_TIPO = { celula: 'Célula', motor: 'Motor', helice: 'Hélice' };
  const dataItem = (iso, mes) => iso ? R.fmtData(iso, mes) : '';

  /* texto dos limites: "TBO 2000 h · 12 anos" */
  function limites(it, curto) {
    const L = [];
    const parte = (h, d) => [h !== null && h !== undefined && h !== '' ? `${R.fmtH(h)} h` : '', d ? R.intervaloTxt(R.lerIntervalo(d), curto) : ''].filter(Boolean).join(' · ');
    const tbo = parte(it.tboHoras, it.tboData), tlv = parte(it.tlvHoras, it.tlvData);
    if (tbo) L.push(`<span class="t"><abbr title="Tempo entre revisões / intervalo de inspeção (TBO)">TBO</abbr>${tbo}</span>`);
    if (tlv) L.push(`<span class="t"><abbr title="Tempo limite de vida (TLV)">TLV</abbr>${tlv}</span>`);
    if (it.validade) L.push(`<span class="t"><abbr title="Data de validade fixa">VAL</abbr>validade</span>`);
    return L.join('') || '<span class="t">—</span>';
  }

  function nomeMapa(a, tipoOuId) {
    const m = a.mapas.find(x => x.id === tipoOuId) || a.mapas.find(x => x.tipo === tipoOuId);
    return m ? m.nome : (NOMES_TIPO[tipoOuId] || '');
  }

  /* ---------- linha da tabela ---------- */
  function linha(it, r, a) {
    if (it.situacao === 'nota') return `<tr class="nota"><td colspan="6">${esc(it.nome)}</td></tr>`;
    const sit = r.situacao;
    const pnns = [it.pn ? `<span>P/N ${esc(it.pn)}</span>` : '', it.ns ? `<span>N/S ${esc(it.ns)}</span>` : ''].join('');
    const controlado = ['vencido', 'atencao', 'ok', 'semregistro'].includes(sit);
    const motivo = !controlado && it.obs ? `<div class="motivo">${esc(it.obs)}</div>` : '';
    const nome = `<td class="c-nome"><button type="button" class="nome-item" data-acao="abrirItem" data-id="${it.id}">${esc(it.nome)}</button>${pnns ? `<div class="pnns">${pnns}</div>` : ''}${motivo}</td>`;
    const lim = `<td class="c-lim" data-rot="Limite">${limites(it, true)}</td>`;
    let meio;
    if (controlado) {
      const efe = it.efetuadoData || (it.efetuadoTsn !== null && it.efetuadoTsn !== undefined)
        ? `<span class="l1">${dataItem(it.efetuadoData, it.efetuadoMes) || '—'}</span>${it.efetuadoTsn !== null && it.efetuadoTsn !== undefined ? `<span class="l2">TSN ${R.fmtH(it.efetuadoTsn)}</span>` : ''}` : '—';
      const venc = sit === 'semregistro' ? '—'
        : `${r.vencData ? `<span class="l1 ${r.rege === 'data' ? 'rege' + (r.diasRest < 0 ? ' v' : '') : ''}">${dataItem(r.vencData, it.validade ? it.validadeMes : (it.efetuadoMes))}</span>` : ''}${r.vencTsn !== null ? `<span class="l2 ${r.rege === 'horas' ? 'rege' + (r.horasRest < 0 ? ' v' : '') : ''}">TSN ${R.fmtH(r.vencTsn)}</span>` : ''}`;
      const disp = sit === 'semregistro'
        ? `<button type="button" class="link" data-acao="cumprimento" data-id="${it.id}">Registrar o primeiro cumprimento</button>`
        : U.medidor(r);
      meio = `<td class="c-efe" data-rot="Último cumprimento">${efe}</td><td class="c-venc" data-rot="Vencimento">${venc}</td><td class="c-disp">${disp}</td>`;
    } else {
      let txt = '';
      if (sit === 'outro') {
        const alvo = it.refMapa && it.refMapa !== 'celula' ? a.mapas.find(m => m.tipo === it.refMapa) : null;
        txt = alvo ? `Controlado no mapa <button type="button" class="link" data-acao="irMapa" data-mapa="${alvo.id}">${esc(alvo.nome)}</button>`
          : it.refMapa === 'celula' ? 'Controlado em outro item deste mapa' : 'Controlado em documento próprio';
      } else if (sit === 'na') txt = 'Não aplicável a esta aeronave';
      else if (sit === 'oc') txt = 'Sob condição (O/C) — sem limite fixo';
      else if (sit === 'pendente') txt = 'Documento em regularização';
      meio = `<td class="c-largo" colspan="3">${txt}</td>`;
    }
    const apagada = ['na', 'outro'].includes(sit) ? ' apagada' : '';
    return `<tr class="linha s-${sit}${apagada}" data-acao="abrirItem" data-id="${it.id}">${nome}${lim}${meio}<td class="c-sit">${U.etiqueta(sit)}</td></tr>`;
  }

  /* ---------- tabela do mapa (redesenhada a cada filtro) ---------- */
  function filtrados() {
    const f = AC.estado.filtro;
    const q = f.busca.trim().toLowerCase();
    const termos = q ? q.split(/\s+/) : [];
    const doMapa = atual.itens.filter(i => i.mapa === atual.aba).sort((x, y) => (y.principal - x.principal) || x.ordem - y.ordem);
    const cont = { todos: 0, vencido: 0, atencao: 0, semregistro: 0, ok: 0, na: 0 };
    const vis = [];
    for (const it of doMapa) {
      const r = atual.s.calc.get(it.id);
      if (it.situacao === 'nota') { vis.push({ it, r, nota: true }); continue; }
      if (r.situacao === 'na') cont.na++;
      const naOculto = r.situacao === 'na' && !f.mostrarNA;
      const casaBusca = !termos.length || termos.every(t => `${it.nome} ${it.pn} ${it.ns} ${it.obs} ${it.grupo}`.toLowerCase().includes(t));
      if (!naOculto && casaBusca) { cont.todos++; if (cont[r.situacao] !== undefined) cont[r.situacao]++; }
      if (naOculto || !casaBusca) continue;
      if (f.sit !== 'todos' && r.situacao !== f.sit) continue;
      vis.push({ it, r });
    }
    return { vis, cont };
  }

  function corpoTabela() {
    const { vis, cont } = filtrados();
    const f = AC.estado.filtro;
    const soItens = vis.filter(v => !v.nota);
    let html = '', secao = null, grupo = null;
    const filtrando = f.sit !== 'todos' || f.busca.trim();
    for (const v of vis) {
      if (v.nota && filtrando) continue;
      const it = v.it;
      if (it.secao !== secao) { secao = it.secao; grupo = null; if (secao) html += `<tr class="secao"><td colspan="6">${esc(secao)}</td></tr>`; }
      if (it.grupo !== grupo) { grupo = it.grupo; if (grupo) html += `<tr class="grupo"><td colspan="6">${esc(grupo)}</td></tr>`; }
      html += linha(it, v.r, atual.a);
    }
    if (!soItens.length) {
      const temItens = atual.itens.some(i => i.mapa === atual.aba);
      html = `<tr><td colspan="6"><div class="vazio-tabela">${temItens
        ? `<strong>Nenhum item com esse filtro</strong>Troque o filtro de situação ou limpe a busca.`
        : `<strong>Este mapa ainda não tem itens</strong>Cadastre os itens um a um ou importe a planilha do MICCA.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="botao primario" data-acao="novoItem">${ic('mais')}Novo item</button><button type="button" class="botao" data-acao="importarCsv">${ic('subir')}Importar planilha</button></div>`}</div></td></tr>`;
    }
    return { html, cont };
  }

  function segmentos(cont) {
    const f = AC.estado.filtro;
    const seg = (v, rot, n, cls) => `<button type="button" data-acao="filtrarSit" data-v="${v}" aria-pressed="${f.sit === v}">${rot}<span class="n ${cls || ''}">${n}</span></button>`;
    return seg('todos', 'Todos', cont.todos) + seg('vencido', 'Vencidos', cont.vencido, cont.vencido ? 'n-venc' : '') + seg('atencao', 'Atenção', cont.atencao, cont.atencao ? 'n-aten' : '') + seg('semregistro', 'Sem lançamento', cont.semregistro) + seg('ok', 'Em dia', cont.ok);
  }

  function redesenharTabela() {
    const { html, cont } = corpoTabela();
    const tb = document.getElementById('corpo-mapa');
    if (tb) tb.innerHTML = html;
    const sg = document.getElementById('segmentos');
    if (sg) sg.innerHTML = segmentos(cont);
    const na = document.getElementById('cont-na');
    if (na) na.textContent = cont.na;
  }

  /* ---------- ficha técnica (célula, grandes componentes e situação) ---------- */
  function fichaTecnica(a, s, mudou) {
    const G = AC.graficos;
    const parado = s.diasSemHoras !== null && s.diasSemHoras > 15;
    const cel = `<div class="ft-col ft-celula"><span class="ft-rot">Célula · TSN</span>
      <span class="ft-num${mudou ? ' mudou' : ''}">${R.fmtH(a.tsn)}<small>h</small></span>
      <span class="ft-leg">TSO ${a.tso !== null && a.tso !== undefined ? R.fmtH(a.tso) : 'N/A'}${a.ciclos ? ` · ${a.ciclos} ciclos` : ''} · ${R.fmtH(s.util.porDia * 30.4375)} h/mês</span>
      <span class="ft-info${parado ? ' alerta' : ''}">${parado ? `Horas sem lançar há ${s.diasSemHoras} dias` : `Horas lançadas em ${R.fmtData(a.posicaoData)}`}</span></div>`;
    const grandes = a.mapas.filter(m => m.tipo !== 'celula').map(m => {
      const p = atual.itens.find(i => i.mapa === m.id && i.principal);
      const r = p ? s.calc.get(p.id) : null;
      let tempos = '', tbo = '';
      if (r) {
        tempos = `<span class="ft-tempos"><span>TSN <b>${r.tsnComp === 'IGN' ? 'IGN' : R.fmtH(r.tsnComp) || 'N/A'}</b></span><span>TSO <b>${r.tso === 'NOVO' ? 'NOVO' : R.fmtH(r.tso) || 'N/A'}</b></span></span>`;
        if (['vencido', 'atencao', 'ok'].includes(r.situacao)) {
          const f = Math.min(r.fracH ?? 1, r.fracD ?? 1);
          const rest = [r.horasRest !== null ? `${R.fmtH(r.horasRest)} h` : '', r.diasRest !== null ? R.prazoHumano(r.diasRest) : ''].filter(Boolean).join(' · ');
          tbo = `<div class="ft-tbo"><div class="ft-tbo-rot"><span>Até a revisão geral</span><b class="t-${r.situacao}">${rest}</b></div><span class="ft-barra m-${r.situacao}"><i style="--f:${f.toFixed(3)}"></i></span></div>`;
        }
      }
      return `<div class="ft-col"><span class="ft-rot">${esc(m.nome)}${m.fabricante ? ' · ' + esc(m.fabricante) : ''}</span>
        <span class="ft-mod">${esc(m.modelo || '—')}</span><span class="ft-sn">S/N ${esc(m.sn || '—')}</span>${tempos}${tbo}</div>`;
    }).join('');
    const sit = s.cont.vencido ? 'vencido' : s.cont.atencao ? 'atencao' : 'ok';
    const pct = s.cont.controlados ? s.cont.ok / s.cont.controlados : 0;
    const saude = `<div class="ft-col ft-saude">${G.anel(pct, sit, `${Math.floor(pct * 100)}% dos itens em dia`)}
      <div><span class="ft-rot">Itens em dia</span><ul class="ft-conts">
        <li><span class="ponto p-vencido"></span>${s.cont.vencido} ${s.cont.vencido === 1 ? 'vencido' : 'vencidos'}</li>
        <li><span class="ponto p-atencao"></span>${s.cont.atencao} em atenção</li>
        <li><span class="ponto p-semregistro"></span>${s.cont.semregistro} sem lançamento</li></ul></div></div>`;
    return `<section class="ficha-tecnica sobreposto" aria-label="Dados técnicos da aeronave">${cel}${grandes}${saude}</section>`;
  }

  /* ---------- histórico ---------- */
  async function historico(a) {
    const lans = await D.lancamentos.daAeronave(a.id);
    const cums = await D.cumprimentos.daAeronave(a.id);
    const nomeItem = id => atual.itens.find(i => i.id === id)?.nome || 'Item removido';
    const ultimoLanc = lans.find(l => l.tsnAntes !== undefined);
    const ultimosPorItem = new Set();
    const cumHtml = cums.map(c => {
      const podeDesfazer = !ultimosPorItem.has(c.itemId); ultimosPorItem.add(c.itemId);
      return `<li><span class="h-data">${R.fmtData(c.data) || '—'}</span>
        <span><b>${esc(nomeItem(c.itemId))}</b><br><span class="h-det">${c.tsn !== null && c.tsn !== undefined ? `TSN ${R.fmtH(c.tsn)} · ` : ''}${c.troca ? `troca: N/S ${esc(c.troca.nsAntes || '—')} → ${esc(c.troca.nsDepois || '—')} · ` : ''}${esc(c.obs || 'sem referência')}</span></span>
        ${podeDesfazer ? `<button type="button" class="botao pequeno sutil" data-acao="desfazerCumprimento" data-id="${c.id}" title="Desfazer este registro">${ic('desfazer')}<span class="so-leitor">Desfazer</span></button>` : '<span></span>'}</li>`;
    }).join('');
    const lanHtml = lans.map(l => `<li><span class="h-data">${R.fmtData(l.data)}</span>
        <span><b>+${R.fmtH(l.horas)} h</b> → TSN ${R.fmtH(l.tsnApos)}<br><span class="h-det">${l.pousos ? `${l.pousos} ${l.pousos === 1 ? 'pouso' : 'pousos'}` : ''}${l.pousos && l.obs ? ' · ' : ''}${esc(l.obs || '')}</span></span>
        ${ultimoLanc && l.id === ultimoLanc.id ? `<button type="button" class="botao pequeno sutil" data-acao="desfazerLancamento" title="Desfazer o último lançamento">${ic('desfazer')}<span class="so-leitor">Desfazer</span></button>` : '<span></span>'}</li>`).join('');
    return `<div class="hist-grade">
      <section class="lista-hist"><div class="bloco-tit"><h2>Horas voadas</h2><span>${lans.length} ${lans.length === 1 ? 'lançamento' : 'lançamentos'}</span></div>
        ${lans.length ? `<ol>${lanHtml}</ol>` : `<div class="vazio">Nenhum lançamento ainda. A posição atual veio do cadastro${a.origem ? ` (${esc(a.origem)})` : ''}. Use “Lançar horas” depois de cada voo ou no fechamento do diário de bordo.</div>`}</section>
      <section class="lista-hist"><div class="bloco-tit"><h2>Cumprimentos registrados</h2><span>${cums.length}</span></div>
        ${cums.length ? `<ol>${cumHtml}</ol>` : `<div class="vazio">Nenhum cumprimento registrado no sistema ainda. Os dados de “último cumprimento” vieram do MICCA importado.</div>`}</section>
    </div>`;
  }

  /* ---------- tela ---------- */
  AC.telas.aeronave = async (id, aba, ctx) => {
    const a = await D.aeronaves.obter(id);
    if (!a) return { titulo: 'Aeronave', html: `${U.faixa({ sobre: 'Aeronave', titulo: 'Aeronave não encontrada', sub: 'Ela pode ter sido excluída.', acoes: '<a class="botao ouro" href="#/painel">Voltar ao painel</a>' })}` };
    const itens = await D.itens.daAeronave(id);
    const lans = await D.lancamentos.todos();
    const s = R.resumoAeronave(a, itens, ctx, lans);
    const abaOk = aba === 'historico' || a.mapas.some(m => m.id === aba) ? aba : a.mapas[0].id;
    if (!atual || atual.a.id !== id || atual.aba !== abaOk) AC.estado.filtro = Object.assign({ sit: 'todos', busca: '' }, { mostrarNA: AC.estado.filtro.mostrarNA });
    atual = { a, s, itens, ctx, aba: abaOk };

    const mudou = !!(AC.estado.tsnAnterior && AC.estado.tsnAnterior.id === id);
    AC.estado.tsnAnterior = null;

    const abas = a.mapas.map(m => {
      const doMapa = itens.filter(i => i.mapa === m.id);
      const venc = doMapa.filter(i => s.calc.get(i.id)?.situacao === 'vencido').length;
      const ctrl = doMapa.filter(i => ['vencido', 'atencao', 'ok', 'semregistro'].includes(s.calc.get(i.id)?.situacao)).length;
      return `<a href="#/aeronave/${a.id}/${m.id}"${abaOk === m.id ? ' aria-current="page"' : ''}>${esc(m.nome)}<span class="cont">${ctrl}</span>${venc ? `<span class="cont-venc" title="${venc} vencido(s)">${venc}</span>` : ''}</a>`;
    }).join('') + `<a href="#/aeronave/${a.id}/historico"${abaOk === 'historico' ? ' aria-current="page"' : ''}>${ic('historico')}Histórico</a>`;

    let corpo;
    if (abaOk === 'historico') corpo = await historico(a);
    else {
      const { html, cont } = corpoTabela();
      corpo = `
        <div class="barra">
          <div class="segmentos" id="segmentos" role="group" aria-label="Filtrar por situação">${segmentos(cont)}</div>
          <label class="campo-busca">${ic('busca')}<span class="so-leitor">Buscar neste mapa</span><input type="search" data-filtro="busca" value="${esc(AC.estado.filtro.busca)}" placeholder="Buscar neste mapa"></label>
          <label class="alternar"><input type="checkbox" data-filtro="mostrarNA" ${AC.estado.filtro.mostrarNA ? 'checked' : ''}><span>Mostrar itens N/A (<span id="cont-na">${cont.na}</span>)</span></label>
          <div class="direita"><button type="button" class="botao" data-acao="novoItem">${ic('mais')}Novo item</button></div>
        </div>
        <div class="tabela-caixa"><table class="micca">
          <thead><tr><th scope="col">Item</th><th scope="col">Limite</th><th scope="col">Último cumprimento</th><th scope="col">Vencimento</th><th scope="col">Disponível</th><th scope="col" style="text-align:right">Situação</th></tr></thead>
          <tbody id="corpo-mapa">${html}</tbody></table></div>`;
    }

    const mapaAtual = a.mapas.find(m => m.id === abaOk);
    const acoes = `<button type="button" class="botao ouro" data-acao="lancarHoras" data-av="${a.id}">${ic('relogio')}Lançar horas</button>
      <a class="botao claro" href="#/imprimir/${a.id}/${mapaAtual ? mapaAtual.id : a.mapas[0].id}">${ic('imprimir')}Imprimir MICCA</a>
      <details class="menu"><summary class="botao icone claro" aria-label="Mais ações">${ic('pontos')}</summary>
        <div class="menu-lista">
          <button type="button" data-acao="editarAeronave" data-id="${a.id}">${ic('lapis')}Editar dados da aeronave</button>
          <button type="button" data-acao="novoItem">${ic('mais')}Novo item ${mapaAtual ? 'em ' + esc(mapaAtual.nome) : ''}</button>
          <button type="button" data-acao="importarCsv">${ic('subir')}Importar planilha</button>
          <button type="button" data-acao="exportarCsv">${ic('baixar')}Exportar ${mapaAtual ? esc(mapaAtual.nome) : 'mapa'} (CSV)</button>
          <button type="button" data-acao="novaAeronave" data-copiar="${a.id}">${ic('copiar')}Nova aeronave com esta estrutura</button>
          <hr><button type="button" class="perigo" data-acao="excluirAeronave" data-id="${a.id}">${ic('lixo')}Excluir aeronave</button>
        </div></details>`;
    const html = `
      ${U.faixa({
        migalha: `<a href="#/painel">Painel</a>${ic('seta')}<span>Aeronaves</span>${ic('seta')}<span aria-current="page">${esc(a.matricula)}</span>`,
        sobre: esc(a.fabricante), titulo: esc(a.matricula), tituloClasse: 'titulo-matricula',
        sub: `${esc(a.modelo)} · S/N ${esc(a.sn)}${a.ano ? ` · fabricada em ${esc(a.ano)}` : ''}${a.manualRef ? `<br>Manual de referência ${esc(a.manualRef)}${a.manualRev ? `, revisão de ${R.fmtData(a.manualRev)}` : ''}` : ''}${a.demo ? ' <span class="selo-ficticia claro">Fictícia</span>' : ''}`,
        acoes, alta: true
      })}
      <div class="pagina">
        ${fichaTecnica(a, s, mudou)}
        <nav class="abas" aria-label="Mapas da aeronave">${abas}</nav>
        ${corpo}
      </div>`;
    return {
      titulo: a.matricula, html,
      depois: () => {
        AC.telas.aoFiltrar = (campo, el) => {
          if (campo === 'busca') AC.estado.filtro.busca = el.value;
          if (campo === 'mostrarNA') AC.estado.filtro.mostrarNA = el.checked;
          redesenharTabela();
        };
      }
    };
  };

  AC.telas.aeronaveAtual = () => atual;

  /* ---------- folha lateral do item ---------- */
  async function abrirItem(el) {
    const it = await D.itens.obter(el.dataset.id);
    if (!it) return;
    const a = await D.aeronaves.obter(it.aeronaveId);
    const ctx = R.contexto(AC.cfg());
    const util = R.utilizacaoDia(a, await D.lancamentos.todos(), ctx.ref);
    const r = R.calcular(it, a, ctx, util.porDia);
    const hist = await D.cumprimentos.doItem(it.id);
    const mapa = a.mapas.find(m => m.id === it.mapa);
    const cap = t => t ? t.charAt(0) + t.slice(1).toLowerCase() : '';
    const local = [a.matricula, mapa?.nome, cap(it.secao), it.grupo].filter(Boolean).map(esc).join(' · ');
    const sit = r.situacao;

    let frase = '';
    if (sit === 'vencido') {
      const porData = r.diasRest !== null && r.diasRest < 0, porHoras = r.horasRest !== null && r.horasRest < 0;
      frase = `<b>Vencido</b>${porData ? ` por data em <b>${R.fmtData(r.vencData)}</b> (${R.prazoHumano(r.diasRest)})` : ''}${porData && porHoras ? ' e' : ''}${porHoras ? ` por horas com <b>${R.fmtH(r.vencTsn)} h</b> (${R.fmtH(-r.horasRest)} h além do limite)` : ''}.`;
    } else if (sit === 'ok' || sit === 'atencao') {
      const outro = r.rege === 'data' && r.vencTsn !== null ? ` ou com ${R.fmtH(r.vencTsn)} h` : r.rege === 'horas' && r.vencData ? ` ou em ${R.fmtData(r.vencData)}` : '';
      const principal = r.rege === 'horas' ? `com <b>${R.fmtH(r.vencTsn)} h</b> de célula — faltam <b>${R.fmtH(r.horasRest)} h</b>` : `em <b>${R.fmtData(r.vencData)}</b> — faltam <b>${R.prazoHumano(r.diasRest)}</b>`;
      frase = `Vence ${principal}${outro ? `${outro}, o que ocorrer primeiro` : ''}.`;
      if (r.horasRest !== null && util.porDia > 0 && r.previsao) frase += ` Na utilização média de ${R.fmtH(util.porDia * 30.4375)} h/mês, a previsão é <b>${R.fmtData(r.previsao)}</b>.`;
    } else if (sit === 'semregistro') frase = 'Ainda não há data de cumprimento. Registre o primeiro cumprimento para o sistema calcular o vencimento.';
    else if (sit === 'outro') frase = `Este item é controlado em outro lugar: <b>${esc(it.obs || nomeMapa(a, it.refMapa))}</b>.`;
    else if (sit === 'na') frase = `Não aplicável: <b>${esc(it.obs || 'sem motivo informado')}</b>.`;
    else if (sit === 'oc') frase = `Sob condição (O/C): não tem limite fixo de horas ou data.${it.obs ? ` <b>${esc(it.obs)}</b>` : ''}`;
    else if (sit === 'pendente') frase = `Documento em regularização${it.obs ? ` junto a <b>${esc(it.obs)}</b>` : ''}.`;
    else frase = esc(it.nome);

    const linhaFicha = (rot, val, txt) => val ? `<dt>${rot}</dt><dd${txt ? ' class="txt"' : ''}>${val}</dd>` : '';
    const ficha = `<dl class="ficha">
      ${linhaFicha('Limite', limites(it).replace(/<span class="t">/g, '<span>').replace(/<\/span><span>/g, '</span><br><span>'))}
      ${linhaFicha('Último cumprimento', it.efetuadoData || it.efetuadoTsn !== null ? `${dataItem(it.efetuadoData, it.efetuadoMes) || '—'}${it.efetuadoTsn !== null && it.efetuadoTsn !== undefined ? ` · TSN ${R.fmtH(it.efetuadoTsn)}` : ''}` : '')}
      ${linhaFicha('Vencimento', r.vencData || r.vencTsn !== null ? [r.vencData ? R.fmtData(r.vencData) : '', r.vencTsn !== null ? `TSN ${R.fmtH(r.vencTsn)}` : ''].filter(Boolean).join(' · ') : '')}
      ${linhaFicha('TSN do componente', r.tsnComp === 'IGN' ? 'IGN (ignorado)' : r.tsnComp !== null ? R.fmtH(r.tsnComp) : '')}
      ${linhaFicha('TSO', r.tso === 'NOVO' ? 'NOVO' : r.tso !== null ? R.fmtH(r.tso) : '')}
      ${linhaFicha('Referência', it.obs && ['vencido', 'atencao', 'ok', 'semregistro'].includes(sit) ? esc(it.obs) : '', true)}
    </dl>`;

    const histHtml = hist.length
      ? `<ol>${hist.map((c, k) => `<li><span><b>${R.fmtData(c.data) || '—'}</b>${c.tsn !== null && c.tsn !== undefined ? ` · TSN ${R.fmtH(c.tsn)}` : ''}<br><span class="motivo">${c.troca ? `Troca: N/S ${esc(c.troca.nsAntes || '—')} → ${esc(c.troca.nsDepois || '—')}. ` : ''}${esc(c.obs || 'sem referência')}</span></span>${k === 0 ? `<button type="button" class="botao pequeno sutil" data-acao="desfazerCumprimento" data-id="${c.id}">${ic('desfazer')}Desfazer</button>` : ''}</li>`).join('')}</ol>`
      : `<p class="vazio">Nenhum cumprimento registrado no sistema. ${it.efetuadoData || it.efetuadoTsn !== null ? 'O último cumprimento acima veio do MICCA importado.' : ''}</p>`;

    const podeCumprir = sit !== 'nota';
    U.abrirFolha(`<div class="dlg-caixa">
      <header class="dlg-cab"><div><div class="folha-local">${local}</div><h2 id="dlg-tit">${esc(it.nome)}</h2>
        ${it.pn || it.ns ? `<div class="pnns">${it.pn ? `<span>P/N ${esc(it.pn)}</span>` : ''}${it.ns ? `<span>N/S ${esc(it.ns)}</span>` : ''}</div>` : ''}</div>
        <button type="button" class="botao sutil icone" data-acao="fecharDialogo" aria-label="Fechar">${ic('fechar')}</button></header>
      <div class="dlg-corpo">
        <div class="resumo-venc">${U.etiqueta(sit) || ''}<p>${frase}</p>${['vencido', 'atencao', 'ok'].includes(sit) ? U.medidor(r) : ''}</div>
        ${ficha}
        <section class="hist-item"><h3>Histórico de cumprimentos</h3>${histHtml}</section>
      </div>
      <footer class="dlg-rodape">
        <button type="button" class="botao perigo esq" data-acao="excluirItem" data-id="${it.id}">${ic('lixo')}Excluir</button>
        <button type="button" class="botao" data-acao="editarItem" data-id="${it.id}">${ic('lapis')}Editar</button>
        ${podeCumprir && ['vencido', 'atencao', 'ok', 'semregistro'].includes(sit) ? `<button type="button" class="botao primario" data-acao="cumprimento" data-id="${it.id}">${ic('chave')}Registrar cumprimento</button>` : ''}
      </footer></div>`);
  }

  Object.assign(AC.acoes, {
    abrirItem,
    irMapa: el => { if (atual) location.hash = `#/aeronave/${atual.a.id}/${el.dataset.mapa}`; },
    filtrarSit: el => { AC.estado.filtro.sit = el.dataset.v; redesenharTabela(); }
  });
})();

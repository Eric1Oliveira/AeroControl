/* AeroControl — planilha.js
   Importar e exportar o MICCA em CSV (abre direto no Excel, separado por ";").
   O arquivo exportado é o próprio modelo de importação. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras;

  const COLUNAS = ['Mapa', 'Seção', 'Grupo', 'Nomenclatura', 'P/N', 'N/S', 'TLV data', 'TLV horas', 'TBO data', 'TBO horas', 'Validade',
    'Efetuado data', 'Efetuado TSN', 'TSN componente', 'TSO', 'Situação', 'Controlado em', 'OBS', 'Principal'];
  const CALCULADAS = ['Vencimento data', 'Vencimento TSN', 'Disponível dias', 'Disponível horas'];
  const SIT_TXT = { controlado: 'Controlado', na: 'N/A', outro: 'Outro controle', oc: 'O/C', pendente: 'Regularizando', nota: 'Nota' };
  const TIPO_TXT = { celula: 'Célula', motor: 'Motor', helice: 'Hélice' };

  const chave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const APELIDOS = { item: 'nomenclatura', nome: 'nomenclatura', descricao: 'nomenclatura', partnumber: 'pn', numerodeparte: 'pn', numerodeserie: 'ns', sn: 'ns', serie: 'ns', observacao: 'obs', observacoes: 'obs', referencia: 'obs', status: 'situacao' };

  /* ---------- CSV ---------- */
  function csv(linhas) {
    const cel = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
  }
  function ler(texto) {
    texto = texto.replace(/^﻿/, '');
    const primeira = texto.split(/\r?\n/)[0] || '';
    const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : (primeira.includes('\t') ? '\t' : ',');
    const linhas = []; let linha = [], campo = '', aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(l => l.some(c => c.trim() !== ''));
  }

  /* ---------- exportar ---------- */
  function exportarMapa(a, itens, mapaId, ctx, util) {
    const mapa = a.mapas.find(m => m.id === mapaId);
    const linhas = [COLUNAS.concat(CALCULADAS)];
    itens.filter(i => i.mapa === mapaId).sort((x, y) => (y.principal - x.principal) || x.ordem - y.ordem).forEach(it => {
      const r = R.calcular(it, a, ctx, util);
      const tsnComp = r.tsnComp === 'IGN' ? 'IGN' : r.tsnComp !== null ? R.fmtH(r.tsnComp) : 'N/A';
      const tso = it.tsoNovo ? 'NOVO' : r.tso !== null ? R.fmtH(r.tso) : 'N/A';
      linhas.push([
        mapa ? mapa.nome : mapaId, it.secao, it.grupo, it.nome, it.pn, it.ns,
        it.tlvData ? R.intervaloTxt(R.lerIntervalo(it.tlvData), true) : '', R.fmtH(it.tlvHoras), it.tboData ? R.intervaloTxt(R.lerIntervalo(it.tboData), true) : '', R.fmtH(it.tboHoras),
        it.validade ? R.fmtData(it.validade, it.validadeMes) : '', it.efetuadoData ? R.fmtData(it.efetuadoData, it.efetuadoMes) : '', R.fmtH(it.efetuadoTsn),
        tsnComp, tso, SIT_TXT[it.situacao] || 'Controlado', it.refMapa ? TIPO_TXT[it.refMapa] : '', it.obs, it.principal ? 'Sim' : '',
        R.fmtData(r.vencData), R.fmtH(r.vencTsn), r.diasRest ?? '', R.fmtH(r.horasRest)
      ]);
    });
    return csv(linhas);
  }

  /* ---------- importar ---------- */
  function lerData(txt) {
    const s = String(txt || '').trim();
    if (!s || /^(n\/?a|-|—)$/i.test(s)) return { iso: null, mes: false };
    let m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, mes: false };
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return { iso: `${m[2]}-${m[1].padStart(2, '0')}-01`, mes: true };
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return { iso: s, mes: false };
    return { erro: true };
  }
  function lerSituacao(txt) {
    if (/^\*+$/.test(String(txt || '').trim())) return 'outro';
    const k = chave(txt);
    if (!k || k.startsWith('controlad')) return 'controlado';
    if (k === 'na' || k.startsWith('naoaplic')) return 'na';
    if (k.startsWith('outro')) return 'outro';
    if (k === 'oc' || k.startsWith('sobcondic') || k.startsWith('oncondition')) return 'oc';
    if (k.startsWith('regulariz') || k.startsWith('pendent')) return 'pendente';
    if (k.startsWith('nota')) return 'nota';
    return null;
  }

  /* devolve { itens, erros, linhasLidas } — não grava nada */
  function interpretar(texto, a, mapaPadrao) {
    const linhas = ler(texto);
    if (linhas.length < 2) return { itens: [], erros: ['A planilha está vazia ou só tem o cabeçalho.'], linhasLidas: 0 };
    const cab = linhas[0].map(c => { const k = chave(c); return APELIDOS[k] || k; });
    if (!cab.includes('nomenclatura')) return { itens: [], erros: ['Não encontrei a coluna "Nomenclatura". Use o modelo exportado pelo AeroControl.'], linhasLidas: 0 };
    const pos = k => cab.indexOf(k);
    const erros = [], itens = [];
    linhas.slice(1).forEach((l, k) => {
      const n = k + 2;
      const g = col => { const p = pos(col); return p >= 0 ? (l[p] || '').trim() : ''; };
      const nome = g('nomenclatura');
      if (!nome) { erros.push(`Linha ${n}: falta a nomenclatura.`); return; }
      let mapa = mapaPadrao;
      if (g('mapa')) {
        const mk = chave(g('mapa'));
        const achado = a.mapas.find(m => chave(m.id) === mk || chave(m.nome) === mk) || a.mapas.find(m => chave(m.tipo) === mk);
        if (!achado) { erros.push(`Linha ${n}: mapa "${g('mapa')}" não existe nesta aeronave.`); return; }
        mapa = achado.id;
      }
      const situacao = lerSituacao(g('situacao'));
      if (!situacao) { erros.push(`Linha ${n}: situação "${g('situacao')}" não reconhecida (use Controlado, N/A, Outro controle, O/C, Regularizando ou Nota).`); return; }
      const ed = lerData(g('efetuadodata')), vd = lerData(g('validade'));
      if (ed.erro) { erros.push(`Linha ${n}: data de efetuado "${g('efetuadodata')}" inválida (use dd/mm/aaaa ou mm/aaaa).`); return; }
      if (vd.erro) { erros.push(`Linha ${n}: validade "${g('validade')}" inválida (use dd/mm/aaaa ou mm/aaaa).`); return; }
      const iv = txt => { const i = R.lerIntervalo(txt); return i ? `${i.n}${i.u}` : ''; };
      const et = R.lerNumero(g('efetuadotsn'));
      const tsnTxt = g('tsncomponente');
      let tsnBase = null;
      if (/^ign/i.test(tsnTxt)) tsnBase = 'IGN';
      else { const v = R.lerNumero(tsnTxt); if (v !== null) tsnBase = et !== null ? Math.round((v - (a.tsn - et)) * 10) / 10 : v; }
      const ref = chave(g('controladoem'));
      itens.push({
        aeronaveId: a.id, mapa, secao: g('secao'), grupo: g('grupo'), nome, pn: g('pn'), ns: g('ns'),
        tlvData: iv(g('tlvdata')), tlvHoras: R.lerNumero(g('tlvhoras')), tboData: iv(g('tbodata')), tboHoras: R.lerNumero(g('tbohoras')),
        validade: vd.iso, validadeMes: vd.mes, efetuadoData: ed.iso, efetuadoMes: ed.mes, efetuadoTsn: et,
        tsnBase, tsoNovo: /novo/i.test(g('tso')), situacao,
        refMapa: ref.startsWith('motor') ? 'motor' : ref.startsWith('helice') ? 'helice' : ref.startsWith('celula') ? 'celula' : null,
        obs: g('obs'), principal: /^(sim|s|x|1|true)$/i.test(g('principal'))
      });
    });
    return { itens, erros, linhasLidas: linhas.length - 1 };
  }

  AC.planilha = { csv, ler, exportarMapa, interpretar, COLUNAS };
})();

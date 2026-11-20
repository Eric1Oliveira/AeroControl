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
  /* nomes de coluna comuns (português e inglês da aviação) → campo do AeroControl */
  const APELIDOS = {
    item: 'nomenclatura', nome: 'nomenclatura', descricao: 'nomenclatura', description: 'nomenclatura', nomenclature: 'nomenclatura',
    componente: 'nomenclatura', component: 'nomenclatura', denominacao: 'nomenclatura',
    partnumber: 'pn', partno: 'pn', numerodeparte: 'pn',
    serialnumber: 'ns', serialno: 'ns', serial: 'ns', sn: 'ns', serie: 'ns', numerodeserie: 'ns', nserie: 'ns',
    observacao: 'obs', observacoes: 'obs', referencia: 'obs', remarks: 'obs', notes: 'obs', comentarios: 'obs',
    status: 'situacao',
    lastdone: 'efetuadodata', lastdonedate: 'efetuadodata', dataefetuado: 'efetuadodata', cumpridoem: 'efetuadodata', ultimocumprimento: 'efetuadodata',
    lastdonehours: 'efetuadotsn', lastdonetsn: 'efetuadotsn', tsnefetuado: 'efetuadotsn', efetuadohoras: 'efetuadotsn',
    tbo: 'tbohoras', tbohrs: 'tbohoras', tboh: 'tbohoras', tlv: 'tlvhoras', tlvh: 'tlvhoras', tlvhrs: 'tlvhoras',
    tsn: 'tsncomponente', tsncomp: 'tsncomponente',
    expira: 'validade', expiracao: 'validade', expirydate: 'validade',
    aeronave: 'matricula', prefixo: 'matricula', registration: 'matricula'
  };

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
    while (linhas.length && !linhas[linhas.length - 1].some(c => c.trim() !== '')) linhas.pop();
    return linhas;   // linhas em branco no meio ficam, para o número da linha bater com o Excel
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
  /* campos que a importação entende (chave → rótulo) e onde cada um cai no item */
  const CAMPOS = [['nomenclatura', 'Nomenclatura'], ['pn', 'P/N'], ['ns', 'N/S'], ['mapa', 'Mapa'], ['secao', 'Seção'], ['grupo', 'Grupo'],
    ['tlvdata', 'TLV data'], ['tlvhoras', 'TLV horas'], ['tbodata', 'TBO data'], ['tbohoras', 'TBO horas'], ['validade', 'Validade'],
    ['efetuadodata', 'Efetuado data'], ['efetuadotsn', 'Efetuado TSN'], ['tsncomponente', 'TSN componente'], ['tso', 'TSO'],
    ['situacao', 'Situação'], ['controladoem', 'Controlado em'], ['obs', 'OBS'], ['principal', 'Principal'], ['matricula', 'Matrícula']];
  const CAMPO_ITEM = { mapa: ['mapa'], secao: ['secao'], grupo: ['grupo'], nomenclatura: ['nome'], pn: ['pn'], ns: ['ns'],
    tlvdata: ['tlvData'], tlvhoras: ['tlvHoras'], tbodata: ['tboData'], tbohoras: ['tboHoras'], validade: ['validade', 'validadeMes'],
    efetuadodata: ['efetuadoData', 'efetuadoMes'], efetuadotsn: ['efetuadoTsn'], tsncomponente: ['tsnBase'], tso: ['tsoNovo'],
    situacao: ['situacao'], controladoem: ['refMapa'], obs: ['obs'], principal: ['principal'] };
  const ROTULO_ITEM = { nome: 'Nomenclatura', pn: 'P/N', ns: 'N/S', mapa: 'Mapa', secao: 'Seção', grupo: 'Grupo', tlvData: 'TLV data', tlvHoras: 'TLV horas',
    tboData: 'TBO data', tboHoras: 'TBO horas', validade: 'Validade', efetuadoData: 'Efetuado data', efetuadoTsn: 'Efetuado TSN', tsnBase: 'TSN componente',
    tsoNovo: 'TSO novo', situacao: 'Situação', refMapa: 'Controlado em', obs: 'OBS', principal: 'Principal' };
  const CONHECIDOS = new Set(CAMPOS.map(c => c[0]));
  const campoDe = titulo => { const k = chave(titulo); const c = APELIDOS[k] || k; return CONHECIDOS.has(c) ? c : ''; };

  /* o cabeçalho é a linha (entre as 15 primeiras) com mais colunas reconhecidas — pula títulos e linhas em branco do topo */
  function acharCabecalho(linhas) {
    let melhor = { i: 0, campos: (linhas[0] || []).map(campoDe), n: -1 };
    linhas.slice(0, 15).forEach((l, i) => {
      const campos = l.map(campoDe);
      const n = new Set(campos.filter(Boolean)).size + (campos.includes('nomenclatura') ? 2 : 0);
      if (n > melhor.n) melhor = { i, campos, n };
    });
    return melhor;
  }

  function lerData(txt) {
    const s = String(txt || '').trim();
    if (!s || /^(n\/?a|-|—)$/i.test(s)) return { iso: null, mes: false };
    let m;
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return { iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, mes: false };
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return { iso: `${m[2]}-${m[1].padStart(2, '0')}-01`, mes: true };
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return { iso: `${m[1]}-${m[2]}-${m[3]}`, mes: false };
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) {   // data do Excel guardada como número de dias
      return { iso: new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5).toISOString().slice(0, 10), mes: false };
    }
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

  /* lê o arquivo escolhido: devolve as abas [{ nome, linhas }] (CSV vira uma aba só) */
  async function abrir(arquivo) {
    const buf = await arquivo.arrayBuffer();
    const zip = new Uint8Array(buf.slice(0, 2));
    if (zip[0] === 0x50 && zip[1] === 0x4b) return AC.xlsx.ler(buf);
    if (/\.xls$/i.test(arquivo.name)) throw new Error('Arquivo .xls antigo: abra no Excel e salve como .xlsx.');
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { texto = new TextDecoder('windows-1252').decode(buf); }   // CSV comum do Excel em português
    return [{ nome: arquivo.name.replace(/\.[^.]+$/, ''), linhas: ler(texto) }];
  }

  /* interpreta uma aba. campos (opcional) = campo de cada coluna, quando a pessoa corrigiu na conferência.
     Devolve { titulos, campos, itens: [{ it, linha }], erros, linhasLidas, presentes } — não grava nada */
  function interpretar(linhas, a, mapaPadrao, campos) {
    const cab = acharCabecalho(linhas);
    campos = campos || cab.campos;
    const titulos = linhas[cab.i] || [];
    const presentes = new Set(['mapa']);
    campos.forEach(c => (CAMPO_ITEM[c] || []).forEach(f => presentes.add(f)));
    const temConteudo = l => l.some(c => String(c ?? '').trim());
    const res = { titulos, campos, itens: [], erros: [], linhasLidas: linhas.slice(cab.i + 1).filter(temConteudo).length, presentes };
    if (!campos.includes('nomenclatura')) { res.erros.push('Não achei a coluna com o nome do item. Em “Colunas”, diga qual é a Nomenclatura.'); return res; }
    linhas.slice(cab.i + 1).forEach((l, k) => {
      const n = cab.i + k + 2;
      const g = col => { const p = campos.indexOf(col); return p >= 0 ? String(l[p] ?? '').trim() : ''; };
      const nome = g('nomenclatura');
      if (!nome) { if (temConteudo(l)) res.erros.push(`Linha ${n}: falta a nomenclatura.`); return; }
      if (g('matricula') && chave(g('matricula')) !== chave(a.matricula)) { res.erros.push(`Linha ${n}: é da aeronave ${g('matricula')} — importe dentro dela.`); return; }
      let mapa = mapaPadrao;
      if (g('mapa')) {
        const mk = chave(g('mapa'));
        const achado = a.mapas.find(m => chave(m.id) === mk || chave(m.nome) === mk) || a.mapas.find(m => chave(m.tipo) === mk);
        if (!achado) { res.erros.push(`Linha ${n}: mapa “${g('mapa')}” não existe nesta aeronave.`); return; }
        mapa = achado.id;
      }
      const situacao = lerSituacao(g('situacao'));
      if (!situacao) { res.erros.push(`Linha ${n}: situação “${g('situacao')}” não reconhecida (use Controlado, N/A, Outro controle, O/C, Regularizando ou Nota).`); return; }
      const ed = lerData(g('efetuadodata')), vd = lerData(g('validade'));
      if (ed.erro) { res.erros.push(`Linha ${n}: data de efetuado “${g('efetuadodata')}” inválida (use dd/mm/aaaa ou mm/aaaa).`); return; }
      if (vd.erro) { res.erros.push(`Linha ${n}: validade “${g('validade')}” inválida (use dd/mm/aaaa ou mm/aaaa).`); return; }
      const iv = txt => { const i = R.lerIntervalo(txt); return i ? `${i.n}${i.u}` : ''; };
      const et = R.lerNumero(g('efetuadotsn'));
      const tsnTxt = g('tsncomponente');
      let tsnBase = null;
      if (/^ign/i.test(tsnTxt)) tsnBase = 'IGN';
      else { const v = R.lerNumero(tsnTxt); if (v !== null) tsnBase = et !== null ? Math.round((v - (a.tsn - et)) * 10) / 10 : v; }
      const ref = chave(g('controladoem'));
      res.itens.push({ linha: n, it: {
        aeronaveId: a.id, mapa, secao: g('secao'), grupo: g('grupo'), nome, pn: g('pn'), ns: g('ns'),
        tlvData: iv(g('tlvdata')), tlvHoras: R.lerNumero(g('tlvhoras')), tboData: iv(g('tbodata')), tboHoras: R.lerNumero(g('tbohoras')),
        validade: vd.iso, validadeMes: vd.mes, efetuadoData: ed.iso, efetuadoMes: ed.mes, efetuadoTsn: et,
        tsnBase, tsoNovo: /novo/i.test(g('tso')), situacao,
        refMapa: ref.startsWith('motor') ? 'motor' : ref.startsWith('helice') ? 'helice' : ref.startsWith('celula') ? 'celula' : null,
        obs: g('obs'), principal: /^(sim|s|x|1|true)$/i.test(g('principal'))
      } });
    });
    return res;
  }

  /* compara com o que já está cadastrado. Mesmo item = mesmo mapa + P/N + N/S; sem N/S, mesmo mapa + nome + P/N
     (em ordem, para itens iguais repetidos). Item que já existe só tem trocados os campos que vieram PREENCHIDOS
     na planilha — célula vazia não apaga o que está cadastrado.
     entrada: [{ it, linha, aba, presentes }] → [{ status: novo|atualiza|igual|repetida, it, antes, mud, linha, aba, chave }] */
  const temNS = it => !!chave(it.ns) && !/^(na|nd|sn|semns)$/.test(chave(it.ns));
  const kNS = it => `${it.mapa}|${chave(it.pn)}|${chave(it.ns)}`;
  const kNome = it => `${it.mapa}|${chave(it.nome)}|${chave(it.pn)}`;
  const vazio = v => v === null || v === undefined || v === '' || v === false;
  function igual(x, y) {
    if (vazio(x) && vazio(y)) return true;
    if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) < 0.05;
    return String(x ?? '').trim() === String(y ?? '').trim();
  }
  function conferir(entrada, existentes) {
    const porNS = new Map(), porNome = new Map();
    const pilha = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    existentes.forEach(e => { if (temNS(e)) pilha(porNS, kNS(e), e); pilha(porNome, kNome(e), e); });
    const cands = it => (temNS(it) && porNS.get(kNS(it))) || porNome.get(kNome(it)) || [];
    /* a mesma peça pode ter várias linhas de controle (ex.: Magneto LH e Magneto LH (inspeção)):
       repetida é só a linha com mesmo nome + P/N + N/S */
    const vistos = new Map();
    const linhas = entrada.map(e => {
      const r = { e, ex: null };
      if (temNS(e.it)) {
        const k = `${kNS(e.it)}|${chave(e.it.nome)}`;
        if (vistos.has(k)) r.igualA = vistos.get(k); else vistos.set(k, e.linha);
      }
      return r;
    });
    /* 1ª passada: item cadastrado de mesmo nome; 2ª: outro com o mesmo P/N + N/S (item renomeado) */
    const usados = new Set();
    [true, false].forEach(exato => linhas.forEach(r => {
      if (r.ex || r.igualA !== undefined) return;
      const ex = cands(r.e.it).find(c => !usados.has(c.id) && (!exato || chave(c.nome) === chave(r.e.it.nome)));
      if (ex) { usados.add(ex.id); r.ex = ex; }
    }));
    return linhas.map(({ e: { it, linha, aba, presentes }, ex, igualA }) => {
      const base = { linha, aba, chave: `${aba}|${linha}` };
      if (igualA !== undefined) return Object.assign(base, { status: 'repetida', it, mud: [], igualA });
      if (!ex) return Object.assign(base, { status: 'novo', it, mud: [] });
      const final = Object.assign({}, ex);
      presentes.forEach(f => { if (!vazio(it[f])) final[f] = it[f]; });
      const mud = Object.keys(ROTULO_ITEM).filter(f => presentes.has(f) && !igual(ex[f], final[f])).map(f => ({ campo: f, rotulo: ROTULO_ITEM[f], de: ex[f], para: final[f] }));
      return Object.assign(base, { status: mud.length ? 'atualiza' : 'igual', it: final, antes: ex, mud });
    });
  }

  AC.planilha = { csv, ler, exportarMapa, abrir, interpretar, conferir, lerData, COLUNAS, CAMPOS, SIT_TXT, TIPO_TXT };
})();


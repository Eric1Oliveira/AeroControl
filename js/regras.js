/* AeroControl — regras.js
   Toda a matemática do MICCA mora aqui: vencimento por data e por horas,
   "o que ocorrer primeiro", disponibilidade, TSN/TSO de componente e previsão
   pela utilização média. Sem DOM — roda igual no navegador e no Node (testes). */
(function (raiz) {
  'use strict';
  const AC = raiz.AC = raiz.AC || {};

  const DIA = 86400000;
  const UNID = { d: 'dia', m: 'mês', a: 'ano' };
  const UNID_PL = { d: 'dias', m: 'meses', a: 'anos' };
  const UNID_DIAS = { d: 1, m: 30.4375, a: 365.25 };

  /* ---------- datas (sempre ISO aaaa-mm-dd, sem fuso) ---------- */
  function partes(iso) { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; }
  function iso(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  function diasNoMes(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function utc(isoStr) { const p = partes(isoStr); return Date.UTC(p.y, p.m - 1, p.d); }
  function hojeISO() { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  function diffDias(de, ate) { return Math.round((utc(ate) - utc(de)) / DIA); }
  function somaDias(isoStr, n) { const t = new Date(utc(isoStr) + n * DIA); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function somaMeses(isoStr, n) {
    const p = partes(isoStr);
    let total = p.y * 12 + (p.m - 1) + n;
    const y = Math.floor(total / 12), m = total % 12 + 1;
    return iso(y, m, Math.min(p.d, diasNoMes(y, m)));
  }
  /* intervalo de calendário: { n: 12, u: 'm' } */
  function somaIntervalo(isoStr, iv) {
    if (iv.u === 'd') return somaDias(isoStr, iv.n);
    if (iv.u === 'm') return somaMeses(isoStr, iv.n);
    return somaMeses(isoStr, iv.n * 12);
  }
  function lerIntervalo(txt) {
    if (!txt) return null;
    if (typeof txt === 'object') return txt;
    const m = String(txt).trim().toLowerCase().match(/^(\d+)\s*([dma])/);
    return m ? { n: Number(m[1]), u: m[2] } : null;
  }
  function intervaloTxt(iv, curto) {
    if (!iv) return '';
    if (curto) return `${iv.n} ${iv.u}`;
    return `${iv.n} ${iv.n === 1 ? UNID[iv.u] : UNID_PL[iv.u]}`;
  }
  function intervaloEmDias(iv) { return iv ? iv.n * UNID_DIAS[iv.u] : null; }

  /* ---------- formatação pt-BR ---------- */
  function fmtData(isoStr, soMes) {
    if (!isoStr) return '';
    const p = partes(isoStr);
    return soMes ? `${String(p.m).padStart(2, '0')}/${p.y}` : `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
  }
  /* horas no padrão do MICCA: 1574,9 (sem separador de milhar) */
  function fmtH(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    const v = Math.round(Number(n) * 10) / 10;
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',');
  }
  function fmtInt(n) { return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('pt-BR'); }
  function lerNumero(txt) {
    if (txt === null || txt === undefined) return null;
    const s = String(txt).trim().replace(/\s/g, '');
    if (!s) return null;
    const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const v = Number(limpo);
    return isFinite(v) ? v : null;
  }
  /* "1 ano e 2 meses" — para leitura humana de prazos longos */
  function prazoHumano(dias) {
    const neg = dias < 0, d = Math.abs(dias);
    let txt;
    if (d < 45) txt = `${d} ${d === 1 ? 'dia' : 'dias'}`;
    else if (d < 365) { const m = Math.round(d / 30.4375); txt = `${m} ${m === 1 ? 'mês' : 'meses'}`; }
    else {
      const a = Math.floor(d / 365.25), m = Math.round((d - a * 365.25) / 30.4375);
      txt = `${a} ${a === 1 ? 'ano' : 'anos'}` + (m ? ` e ${m} ${m === 1 ? 'mês' : 'meses'}` : '');
    }
    return neg ? `há ${txt}` : txt;
  }

  /* ---------- situação ---------- */
  const SITUACOES = {
    vencido:     { rotulo: 'Vencido',        ordem: 0 },
    atencao:     { rotulo: 'Atenção',        ordem: 1 },
    semregistro: { rotulo: 'Sem lançamento', ordem: 2 },
    pendente:    { rotulo: 'Regularizando',  ordem: 3 },
    ok:          { rotulo: 'Em dia',         ordem: 4 },
    oc:          { rotulo: 'Sob condição',   ordem: 5 },
    outro:       { rotulo: 'Outro controle', ordem: 6 },
    na:          { rotulo: 'N/A',            ordem: 7 },
    nota:        { rotulo: '',               ordem: 8 }
  };

  /* contexto de cálculo: data de referência, limiares de alerta e utilização */
  function contexto(cfg) {
    cfg = cfg || {};
    return {
      ref: cfg.dataRef || hojeISO(),
      alertaDias: cfg.alertaDias ?? 30,
      alertaHoras: cfg.alertaHoras ?? 25
    };
  }

  /* utilização média (h/dia) — dos lançamentos recentes, senão do cadastro */
  function utilizacaoDia(aeronave, lancamentos, ref) {
    const recentes = (lancamentos || []).filter(l => l.aeronaveId === aeronave.id && l.data <= ref && diffDias(l.data, ref) <= 180);
    if (recentes.length >= 2) {
      const ini = recentes.reduce((a, l) => l.data < a ? l.data : a, ref);
      const span = Math.max(diffDias(ini, ref), 30);
      const horas = recentes.reduce((s, l) => s + (l.horas || 0), 0);
      if (horas > 0) return { porDia: horas / span, origem: 'lançamentos' };
    }
    return { porDia: (aeronave.utilMensal || 0) / 30.4375, origem: 'cadastro' };
  }

  /* núcleo: calcula tudo de um item */
  function calcular(item, aeronave, ctx, utilDia) {
    const r = {
      situacao: item.situacao || 'controlado', vencData: null, vencTsn: null, diasRest: null, horasRest: null,
      tsnComp: null, tso: null, rege: null, previsao: null, diasEquiv: Infinity,
      fracD: null, fracH: null, alertaD: false, alertaH: false, ivDias: null, ivHoras: null
    };
    const tsnCel = aeronave.tsn;

    /* tempos do componente */
    if (item.tsnBase === 'IGN') r.tsnComp = 'IGN';
    else if (item.tsnBase !== null && item.tsnBase !== undefined) {
      r.tsnComp = item.efetuadoTsn !== null && item.efetuadoTsn !== undefined
        ? item.tsnBase + (tsnCel - item.efetuadoTsn) : item.tsnBase;
    }
    if (item.tsoNovo) r.tso = 'NOVO';
    else if (item.tsnBase !== null && item.tsnBase !== undefined && item.efetuadoTsn !== null && item.efetuadoTsn !== undefined) r.tso = tsnCel - item.efetuadoTsn;

    if (r.situacao !== 'controlado') return r;

    const tbo = lerIntervalo(item.tboData), tlv = lerIntervalo(item.tlvData);
    const temCal = !!(tbo || tlv || item.validade);
    const horasLim = [item.tboHoras, item.tlvHoras].filter(v => v !== null && v !== undefined && v !== '');
    const temHoras = horasLim.length > 0;

    /* vencimento por data */
    if (item.validade) {
      r.vencData = item.validade;
    } else if (temCal && item.efetuadoData) {
      const datas = [tbo, tlv].filter(Boolean).map(iv => somaIntervalo(item.efetuadoData, iv));
      r.vencData = datas.sort()[0];
      r.ivDias = Math.min(...[tbo, tlv].filter(Boolean).map(intervaloEmDias));
    }
    if (r.vencData) {
      r.diasRest = diffDias(ctx.ref, r.vencData);
      if (r.ivDias) r.fracD = Math.max(0, Math.min(1, r.diasRest / r.ivDias));
      const lim = r.ivDias ? Math.min(ctx.alertaDias, r.ivDias * 0.25) : ctx.alertaDias;
      r.alertaD = r.diasRest <= lim;
    }

    /* vencimento por horas */
    if (temHoras && item.efetuadoTsn !== null && item.efetuadoTsn !== undefined) {
      r.ivHoras = Math.min(...horasLim.map(Number));
      r.vencTsn = item.efetuadoTsn + r.ivHoras;
      r.horasRest = Math.round((r.vencTsn - tsnCel) * 10) / 10;
      r.fracH = Math.max(0, Math.min(1, r.horasRest / r.ivHoras));
      r.alertaH = r.horasRest <= Math.min(ctx.alertaHoras, r.ivHoras * 0.25);
    }

    const faltaData = temCal && !r.vencData;
    const faltaHoras = temHoras && r.vencTsn === null;
    if ((faltaData && faltaHoras) || (faltaData && !temHoras) || (faltaHoras && !temCal) || (!temCal && !temHoras)) {
      r.situacao = 'semregistro';
      return r;
    }

    /* o que ocorrer primeiro */
    const diasPorHoras = r.horasRest !== null && utilDia > 0 ? r.horasRest / utilDia : null;
    const candidatos = [];
    if (r.diasRest !== null) candidatos.push({ por: 'data', dias: r.diasRest });
    if (diasPorHoras !== null) candidatos.push({ por: 'horas', dias: diasPorHoras });
    if (candidatos.length) {
      candidatos.sort((a, b) => a.dias - b.dias);
      r.rege = candidatos[0].por;
      r.diasEquiv = candidatos[0].dias;
      r.previsao = somaDias(ctx.ref, Math.floor(r.diasEquiv));
    } else if (r.horasRest !== null) {
      r.rege = 'horas';
      r.diasEquiv = r.horasRest < 0 ? -1 : 1e6 + r.horasRest;
    }
    /* sem utilização conhecida: horas negativas ainda mandam */
    if (r.horasRest !== null && r.horasRest < 0 && (r.diasRest === null || r.diasRest >= 0)) r.rege = 'horas';
    if (r.diasRest !== null && r.diasRest < 0 && (r.horasRest === null || r.horasRest >= 0)) r.rege = 'data';

    if ((r.diasRest !== null && r.diasRest < 0) || (r.horasRest !== null && r.horasRest < 0)) r.situacao = 'vencido';
    else if (r.alertaD || r.alertaH) r.situacao = 'atencao';
    else r.situacao = 'ok';
    return r;
  }

  /* resumo de uma aeronave inteira */
  function resumoAeronave(aeronave, itens, ctx, lancamentos) {
    const util = utilizacaoDia(aeronave, lancamentos, ctx.ref);
    const cont = { vencido: 0, atencao: 0, ok: 0, semregistro: 0, pendente: 0, oc: 0, outro: 0, na: 0, controlados: 0 };
    let proximo = null;
    const calc = new Map();
    for (const it of itens) {
      if (it.aeronaveId !== aeronave.id) continue;
      const r = calcular(it, aeronave, ctx, util.porDia);
      calc.set(it.id, r);
      if (r.situacao === 'nota') continue;
      cont[r.situacao] = (cont[r.situacao] || 0) + 1;
      if (['vencido', 'atencao', 'ok', 'semregistro'].includes(r.situacao)) cont.controlados++;
      if (r.situacao === 'atencao' || r.situacao === 'ok') {
        if (!proximo || r.diasEquiv < proximo.r.diasEquiv) proximo = { item: it, r };
      }
    }
    const diasSemHoras = aeronave.posicaoData ? diffDias(aeronave.posicaoData, ctx.ref) : null;
    return { cont, proximo, calc, util, diasSemHoras };
  }

  /* compara dois resultados por urgência (para ordenar listas) */
  function porUrgencia(a, b) {
    const oa = SITUACOES[a.situacao]?.ordem ?? 9, ob = SITUACOES[b.situacao]?.ordem ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.diasEquiv ?? Infinity) - (b.diasEquiv ?? Infinity);
  }

  AC.regras = {
    hojeISO, diffDias, somaDias, somaMeses, somaIntervalo, lerIntervalo, intervaloTxt, intervaloEmDias,
    fmtData, fmtH, fmtInt, lerNumero, prazoHumano, SITUACOES, contexto, utilizacaoDia, calcular,
    resumoAeronave, porUrgencia
  };
})(typeof window !== 'undefined' ? window : globalThis);

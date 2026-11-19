/* AeroControl — graficos.js
   Gráficos do painel em SVG/HTML puro (sem biblioteca): rosca da situação,
   colunas de vencimentos por mês, anel de % em dia, barra segmentada e a
   linha do tempo de 90 dias. Uma única dica flutuante serve todos eles. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pct = (v, t) => t ? (v / t * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '0%';

  /* cor de cada situação nos gráficos (validadas para daltonismo nos dois temas) */
  const COR = { ok: '--g-ok', atencao: '--g-aten', vencido: '--g-venc', semregistro: '--g-sem' };

  /* ---------- dica flutuante (valor em destaque, rótulo depois) ---------- */
  let dica = null;
  function caixaDica() {
    if (!dica) { dica = document.createElement('div'); dica.className = 'dica-grafico'; dica.setAttribute('role', 'tooltip'); dica.hidden = true; document.body.append(dica); }
    return dica;
  }
  function mostrar(alvo, x, y) {
    const d = caixaDica();
    d.textContent = '';
    const v = document.createElement('strong'); v.textContent = alvo.dataset.dicaV || '';
    const l = document.createElement('span'); l.textContent = alvo.dataset.dica || '';
    d.append(v, l);
    d.hidden = false;
    const r = d.getBoundingClientRect();
    const left = Math.max(8, Math.min(x + 14, innerWidth - r.width - 8));
    const top = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
    d.style.left = left + 'px'; d.style.top = top + 'px';
  }
  function esconder() { if (dica) dica.hidden = true; }
  document.addEventListener('pointermove', e => {
    const a = e.target.closest && e.target.closest('[data-dica]');
    if (a) mostrar(a, e.clientX, e.clientY); else esconder();
  });
  document.addEventListener('focusin', e => {
    const a = e.target.closest && e.target.closest('[data-dica]');
    if (a) { const r = a.getBoundingClientRect(); mostrar(a, r.left + r.width / 2, r.top); } else esconder();
  });
  document.addEventListener('scroll', esconder, { passive: true });
  window.addEventListener('hashchange', esconder);

  /* ---------- rosca: um todo em partes, com folga de 2px entre os segmentos ---------- */
  function rosca(partes, centro, rotuloAcessivel) {
    const total = partes.reduce((s, p) => s + p.valor, 0);
    const r = 62, C = 2 * Math.PI * r;
    const ativos = partes.filter(p => p.valor > 0);
    const folga = ativos.length > 1 ? 2 : 0;
    let acc = 0;
    const segs = ativos.map(p => {
      const len = p.valor / total * C;
      const traco = Math.max(len - folga, 1.2);
      const s = `<circle class="rosca-seg" cx="80" cy="80" r="${r}" style="stroke:var(${p.cor})" stroke-dasharray="${traco.toFixed(2)} ${(C - traco).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 80 80)" tabindex="0" data-dica="${esc(p.rotulo)}" data-dica-v="${p.valor.toLocaleString('pt-BR')} itens · ${pct(p.valor, total)}"></circle>`;
      acc += len;
      return s;
    }).join('');
    return `<svg class="rosca" viewBox="0 0 160 160" role="img" aria-label="${esc(rotuloAcessivel)}">
      <circle class="rosca-fundo" cx="80" cy="80" r="${r}"></circle>${segs}
      <text x="80" y="80" class="rosca-v">${esc(centro.valor)}</text>
      <text x="80" y="100" class="rosca-r">${esc(centro.rotulo)}</text></svg>`;
  }

  /* ---------- anel (medidor de uma proporção) ---------- */
  function anel(frac, sit, rotulo) {
    const r = 25, C = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, frac || 0));
    const cor = COR[sit] || COR.ok;
    return `<svg class="anel" viewBox="0 0 64 64" role="img" aria-label="${esc(rotulo)}" style="--m:var(${cor})">
      <circle class="anel-trilho" cx="32" cy="32" r="${r}"></circle>
      <circle class="anel-arco" cx="32" cy="32" r="${r}" stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 32 32)"></circle>
      <text x="32" y="36.5" class="anel-v">${Math.floor(f * 100)}%</text></svg>`;
  }

  /* ---------- barra segmentada fina (sem texto: os números ficam ao lado) ---------- */
  function segmentada(partes) {
    const total = partes.reduce((s, p) => s + p.valor, 0) || 1;
    return `<span class="seg-fino" aria-hidden="true">${partes.filter(p => p.valor > 0).map(p => `<i style="flex:${p.valor};background:var(${p.cor})"></i>`).join('')}</span>`;
  }

  /* ---------- colunas (uma série: itens previstos por mês) ---------- */
  function colunas(dados, rotuloAcessivel) {
    const max = Math.max(1, ...dados.map(d => d.valor));
    const cols = dados.map(d => `<div class="col" tabindex="0" data-dica="${esc(d.dica)}" data-dica-v="${d.valor} ${d.valor === 1 ? 'item' : 'itens'}">
        <span class="col-v">${d.valor || ''}</span>
        <span class="col-barra" style="--h:${d.valor ? Math.max(.03, d.valor / max).toFixed(3) : 0}"></span></div>`).join('');
    const eixo = dados.map(d => `<span>${esc(d.rotulo)}</span>`).join('');
    return `<div class="colunas-caixa" role="img" aria-label="${esc(rotuloAcessivel)}"><div class="colunas">${cols}</div><div class="colunas-eixo">${eixo}</div></div>`;
  }

  /* ---------- linha do tempo: cada aeronave numa faixa, próximos N dias ---------- */
  function linhaTempo(linhas, ref, dias) {
    const meses = [];
    let d = R.somaMeses(ref.slice(0, 8) + '01', 1);
    while (R.diffDias(ref, d) <= dias) {
      const [y, m] = d.split('-').map(Number);
      meses.push({ pos: R.diffDias(ref, d) / dias * 100, rot: MESES[m - 1] + (m === 1 ? `/${String(y).slice(2)}` : '') });
      d = R.somaMeses(d, 1);
    }
    const grade = meses.map(m => `<i class="lt-grade" style="left:${m.pos.toFixed(2)}%"></i>`).join('');
    const escala = `<div class="lt-linha lt-cab"><span class="lt-rot">Aeronave</span><span class="lt-venc-cab">Vencidos</span>
      <div class="lt-trilho"><span class="lt-tick lt-hoje-rot" style="left:0">${R.fmtData(ref).slice(0, 5)}</span>${meses.map(m => `<span class="lt-tick" style="left:${m.pos.toFixed(2)}%">${m.rot}</span>`).join('')}</div></div>`;
    const corpo = linhas.map(l => {
      const venc = l.vencidos.length
        ? `<button type="button" class="lt-marca losango" style="--m:var(${COR.vencido})" data-acao="abrirItem" data-id="${l.vencidos[0].it.id}" data-dica="${esc(l.a.matricula + ' · vencidos\n' + l.vencidos.slice(0, 4).map(x => x.it.nome).join('\n') + (l.vencidos.length > 4 ? `\ne mais ${l.vencidos.length - 4}` : ''))}" data-dica-v="${l.vencidos.length} ${l.vencidos.length === 1 ? 'item vencido' : 'itens vencidos'}" aria-label="${l.vencidos.length} vencidos"><span>${l.vencidos.length > 1 ? l.vencidos.length : ''}</span></button>`
        : '<span class="lt-nada" aria-hidden="true">—</span>';
      const marcas = l.marcas.map(m => {
        const nomes = m.itens.slice(0, 4).map(x => x.it.nome).join('\n') + (m.itens.length > 4 ? `\ne mais ${m.itens.length - 4}` : '');
        return `<button type="button" class="lt-marca m-${m.sit}${m.itens.length > 1 ? ' multi' : ''}" style="left:${(m.dia / dias * 100).toFixed(2)}%;--m:var(${COR[m.sit]})" data-acao="abrirItem" data-id="${m.itens[0].it.id}"
          data-dica="${esc(l.a.matricula + ' · ' + R.fmtData(R.somaDias(ref, m.dia)) + '\n' + nomes)}" data-dica-v="${m.itens.length} ${m.itens.length === 1 ? 'item' : 'itens'} em ${m.dia} ${m.dia === 1 ? 'dia' : 'dias'}" aria-label="${m.itens.length} itens em ${m.dia} dias"><span>${m.itens.length > 1 ? m.itens.length : ''}</span></button>`;
      }).join('');
      return `<div class="lt-linha"><a class="lt-rot" href="#/aeronave/${l.a.id}">${esc(l.a.matricula)}<small>${l.marcas.reduce((s, m) => s + m.itens.length, 0)} no período</small></a>
        <span class="lt-venc">${venc}</span><div class="lt-trilho">${grade}${marcas}</div></div>`;
    }).join('');
    return `<div class="lt">${escala}${corpo}</div>`;
  }

  AC.graficos = { COR, rosca, anel, segmentada, colunas, linhaTempo, pct };
})();

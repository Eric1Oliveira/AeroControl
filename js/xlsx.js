/* AeroControl — xlsx.js
   Lê planilhas do Excel (.xlsx) sem biblioteca: abre o zip, descompacta com o próprio
   navegador e devolve o texto de cada aba visível como linhas [{ nome, linhas: [[...]] }]. */
(function () {
  'use strict';
  const AC = window.AC;
  const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  async function abrirZip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let fim = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    if (fim < 0) throw new Error('Este arquivo não é uma planilha do Excel válida (.xlsx).');
    const arquivos = {};
    let p = dv.getUint32(fim + 16, true);
    for (let n = dv.getUint16(fim + 10, true); n > 0 && dv.getUint32(p, true) === 0x02014b50; n--) {
      const tamNome = dv.getUint16(p + 28, true);
      const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + tamNome));
      arquivos[nome] = { metodo: dv.getUint16(p + 10, true), tam: dv.getUint32(p + 20, true), local: dv.getUint32(p + 42, true) };
      p += 46 + tamNome + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    return async nome => {
      const f = arquivos[nome];
      if (!f) return null;
      const ini = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true);
      let dados = u8.subarray(ini, ini + f.tam);
      if (f.metodo === 8) dados = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else if (f.metodo !== 0) throw new Error('Compressão do Excel não suportada. Salve a planilha de novo no Excel.');
      return new TextDecoder().decode(dados);
    };
  }

  const xml = t => new DOMParser().parseFromString(t, 'application/xml');
  const tags = (el, nome) => [...el.getElementsByTagNameNS('*', nome)];
  const coluna = ref => { let n = 0; for (const c of ref.replace(/\d+/g, '')) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };

  async function ler(buf) {
    const pegar = await abrirZip(buf);
    const wbTxt = await pegar('xl/workbook.xml');
    if (!wbTxt) throw new Error('Este arquivo não é uma planilha do Excel válida (.xlsx).');
    const textos = [];
    const sst = await pegar('xl/sharedStrings.xml');
    if (sst) tags(xml(sst), 'si').forEach(si => textos.push(tags(si, 't').filter(t => !t.closest('rPh')).map(t => t.textContent).join('')));
    const alvos = {};
    tags(xml(await pegar('xl/_rels/workbook.xml.rels') || '<r/>'), 'Relationship').forEach(r => { alvos[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const abas = [];
    for (const s of tags(xml(wbTxt), 'sheet')) {
      if (s.getAttribute('state') && s.getAttribute('state') !== 'visible') continue;
      const alvo = alvos[s.getAttributeNS(NS_REL, 'id') || s.getAttribute('r:id')] || '';
      const txt = await pegar(alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo);
      if (!txt) continue;
      const linhas = [];   // cada linha na posição do Excel (linha 5 do Excel = linhas[4]), para os avisos citarem a linha certa
      tags(xml(txt), 'row').forEach(row => {
        const l = [];
        tags(row, 'c').forEach(c => {
          const tipo = c.getAttribute('t'), v = tags(c, 'v')[0];
          let val = '';
          if (tipo === 's') val = textos[+(v && v.textContent)] ?? '';
          else if (tipo === 'inlineStr') val = tags(c, 't').map(t => t.textContent).join('');
          else if (tipo === 'b') val = v && v.textContent === '1' ? 'Sim' : '';
          else if (tipo !== 'e' && v) {
            val = v.textContent;
            if (tipo !== 'str' && val !== '' && isFinite(val)) val = String(Math.round(+val * 1e6) / 1e6);   // tira o 0,30000000004 do Excel
          }
          const ref = c.getAttribute('r');
          l[ref ? coluna(ref) : l.length] = val;
        });
        const r = +row.getAttribute('r') || linhas.length + 1;
        linhas[r - 1] = Array.from(l, x => x ?? '');
      });
      abas.push({ nome: s.getAttribute('name') || 'Planilha', linhas: Array.from(linhas, l => l || []) });
    }
    return abas;
  }

  AC.xlsx = { ler };
})();

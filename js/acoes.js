/* AeroControl — acoes.js
   Formulários e ações que mudam dados: lançar horas, registrar cumprimento,
   cadastrar item/aeronave, importar planilha, data de referência e configurações. */
(function () {
  'use strict';
  const AC = window.AC, R = AC.regras, D = AC.dados, U = AC.ui;
  const { esc, ic } = U;

  const ctxAtual = () => R.contexto(AC.cfg());
  const val = (f, n) => (f.elements[n] ? String(f.elements[n].value).trim() : '');
  const marcado = (f, n) => !!(f.elements[n] && f.elements[n].checked);
  const opt = (v, rot, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(rot)}</option>`;
  const campo = (rot, html, cls, dica, id) => `<div class="campo ${cls || ''}"${id ? ` id="${id}"` : ''}>${rot ? `<label${html.includes('id="') ? ` for="${html.match(/id="([^"]+)"/)[1]}"` : ''}>${rot}</label>` : ''}${html}${dica ? `<span class="dica">${dica}</span>` : ''}</div>`;
  const temHoras = it => [it.tboHoras, it.tlvHoras].some(v => v !== null && v !== undefined && v !== '');

  async function aeronavePadrao(el) {
    if (el && el.dataset && el.dataset.av) return el.dataset.av;
    const at = AC.telas.aeronaveAtual && AC.telas.aeronaveAtual();
    if (at && location.hash.includes('/aeronave/')) return at.a.id;
    return '';
  }
  function exigirAeronaveAtual() {
    const at = AC.telas.aeronaveAtual && AC.telas.aeronaveAtual();
    if (!at || !location.hash.includes('/aeronave/')) throw new Error('Abra uma aeronave para usar esta ação.');
    return at;
  }

  /* =================== LANÇAR HORAS =================== */
  async function lancarHoras(el) {
    const avs = await D.aeronaves.listar();
    if (!avs.length) throw new Error('Cadastre uma aeronave antes de lançar horas.');
    const sel = await aeronavePadrao(el) || avs[0].id;
    const ctx = ctxAtual();
    U.abrirDialogo(U.moldura({
      titulo: 'Lançar horas voadas', sub: 'O TSN da célula e todos os itens controlados por horas são atualizados na hora.',
      form: 'lancarHoras', previa: 'lancarHoras',
      corpo: `<div class="form-grade">
        ${campo('Aeronave', `<select id="lh-av" name="av">${avs.map(a => opt(a.id, `${a.matricula} — TSN ${R.fmtH(a.tsn)} h`, a.id === sel)).join('')}</select>`, 'c6')}
        ${campo('Data do voo', `<input id="lh-data" name="data" type="date" value="${ctx.ref}" required>`, 'meia')}
        <div class="campo meia"><span class="rot">Informar</span><div class="opcoes-radio">
          <label><input type="radio" name="modo" value="horas" checked>Horas voadas</label>
          <label><input type="radio" name="modo" value="tsn">Novo TSN</label></div></div>
        ${campo('<span id="lh-rot-valor">Horas voadas</span>', `<input id="lh-valor" name="valor" inputmode="decimal" placeholder="Ex.: 2,3" autocomplete="off" autofocus>`, 'meia', 'Use vírgula para o décimo, como no diário de bordo.')}
        ${campo('Pousos (opcional)', `<input id="lh-pousos" name="pousos" inputmode="numeric" placeholder="Ex.: 1">`, 'meia')}
        ${campo('Observação (opcional)', `<input id="lh-obs" name="obs" placeholder="Ex.: SBRF–SBFZ, diário de bordo nº 12, pág. 34">`, 'c6')}
        <div class="previa" id="lh-previa" aria-live="polite"></div>
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('relogio')}Lançar horas</button>`
    }));
  }
  async function contaHoras(f) {
    const a = await D.aeronaves.obter(val(f, 'av'));
    const v = R.lerNumero(val(f, 'valor'));
    if (!a || v === null) return { a, horas: null };
    const horas = f.elements.modo.value === 'tsn' ? Math.round((v - a.tsn) * 10) / 10 : v;
    return { a, horas };
  }
  AC.previas.lancarHoras = async f => {
    const modoTsn = f.elements.modo.value === 'tsn';
    document.getElementById('lh-rot-valor').textContent = modoTsn ? 'Novo TSN da célula' : 'Horas voadas';
    f.elements.valor.placeholder = modoTsn ? 'Ex.: 1577,2' : 'Ex.: 2,3';
    const box = document.getElementById('lh-previa');
    const { a, horas } = await contaHoras(f);
    if (!a) return;
    if (horas === null) { box.innerHTML = `TSN atual do <b>${esc(a.matricula)}</b>: <b>${R.fmtH(a.tsn)} h</b>, atualizado em ${R.fmtData(a.posicaoData)}.`; return; }
    if (horas <= 0) { box.innerHTML = modoTsn ? `O novo TSN precisa ser maior que o atual (${R.fmtH(a.tsn)} h).` : 'Informe horas maiores que zero.'; return; }
    const ctx = ctxAtual();
    const itens = await D.itens.daAeronave(a.id);
    const lans = await D.lancamentos.todos();
    const antes = R.resumoAeronave(a, itens, ctx, lans);
    const depois = R.resumoAeronave(Object.assign({}, a, { tsn: a.tsn + horas }), itens, ctx, lans);
    const mudam = { atencao: [], vencido: [] };
    for (const it of itens) {
      const s0 = antes.calc.get(it.id)?.situacao, s1 = depois.calc.get(it.id)?.situacao;
      if (s0 !== s1 && mudam[s1]) mudam[s1].push(it.nome.length < 22 && it.secao ? `${it.nome} (${it.secao.charAt(0) + it.secao.slice(1).toLowerCase()})` : it.nome);
    }
    const lista = (t, l) => l.length ? `<br>${t}: <b>${l.length}</b><ul>${l.slice(0, 4).map(n => `<li>${esc(n)}</li>`).join('')}${l.length > 4 ? `<li>e mais ${l.length - 4}</li>` : ''}</ul>` : '';
    box.innerHTML = `Novo TSN: <b>${R.fmtH(a.tsn + horas)} h</b> (+${R.fmtH(horas)} h).` +
      (mudam.atencao.length || mudam.vencido.length ? lista('Passam a vencidos', mudam.vencido) + lista('Entram em atenção', mudam.atencao) : '<br>Nenhum item muda de situação.') +
      (horas > 24 && !modoTsn ? `<br><b>Confira:</b> mais de 24 h num único lançamento.` : '');
  };
  AC.forms.lancarHoras = async f => {
    const { a, horas } = await contaHoras(f);
    if (!a) throw new Error('Escolha a aeronave.');
    if (horas === null) throw new Error('Informe as horas voadas.');
    if (horas <= 0) throw new Error(f.elements.modo.value === 'tsn' ? `O novo TSN precisa ser maior que o atual (${R.fmtH(a.tsn)} h).` : 'As horas precisam ser maiores que zero.');
    const data = val(f, 'data');
    if (!data) throw new Error('Informe a data do voo.');
    const pousos = R.lerNumero(val(f, 'pousos'));
    const l = await D.lancamentos.registrar({ aeronaveId: a.id, data, horas: Math.round(horas * 10) / 10, pousos: pousos ? Math.round(pousos) : null, obs: val(f, 'obs') });
    AC.estado.tsnAnterior = { id: a.id, tsn: l.tsnAntes };
    U.fecharDialogo();
    U.aviso(`${a.matricula}: +${R.fmtH(l.horas)} h · TSN ${R.fmtH(l.tsnApos)}`, { acao: { rotulo: 'Desfazer', fn: async () => { await D.lancamentos.desfazerUltimo(a.id); U.aviso('Lançamento desfeito.'); AC.redesenhar(); } } });
    await AC.redesenhar();
  };

  /* =================== REGISTRAR CUMPRIMENTO =================== */
  async function cumprimento(el) {
    const it = await D.itens.obter(el.dataset.id);
    const a = await D.aeronaves.obter(it.aeronaveId);
    const ctx = ctxAtual();
    const usaTsn = temHoras(it) || (it.tsnBase !== null && it.tsnBase !== undefined);
    const componente = !!(it.pn || it.ns || it.tsoNovo);
    U.abrirDialogo(U.moldura({
      titulo: 'Registrar cumprimento', sub: esc(it.nome),
      form: 'cumprimento', previa: 'cumprimento',
      corpo: `<input type="hidden" name="id" value="${it.id}"><div class="form-grade">
        ${campo('Data do cumprimento', `<input id="cu-data" name="data" type="date" value="${ctx.ref}" max="${ctx.ref}" required>`, 'meia')}
        ${usaTsn ? campo('TSN da célula no cumprimento', `<input id="cu-tsn" name="tsn" inputmode="decimal" value="${R.fmtH(a.tsn)}">`, 'meia', `TSN atual: ${R.fmtH(a.tsn)} h`) : ''}
        ${campo('Referência (vai para a coluna OBS)', `<textarea id="cu-obs" name="obs" rows="2" placeholder="Oficina, COM/ANAC, caderneta e página. Ex.: AMÉRICA DO SUL, COM 199903-03/ANAC (Cad. Cel. # 02, pág. 077)"></textarea>`, 'c6')}
        ${componente ? `<label class="alternar" style="grid-column:1/-1"><input type="checkbox" name="troca">Houve troca do componente (novo P/N ou N/S)</label>
        <div id="cu-troca" class="form-grade" style="grid-column:1/-1" hidden>
          ${campo('P/N instalado', `<input id="cu-pn" name="pn" value="${esc(it.pn)}">`, 'meia')}
          ${campo('N/S instalado', `<input id="cu-ns" name="ns" value="">`, 'meia')}
          ${campo('TSN do componente instalado', `<input id="cu-tsnc" name="tsnc" inputmode="decimal" value="0,0">`, 'meia', 'Zero para componente novo. IGN se for desconhecido.')}
          <label class="alternar meia" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="novo" checked>Componente novo (TSO = NOVO)</label>
        </div>` : ''}
        <div class="previa" id="cu-previa" aria-live="polite"></div>
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('chave')}Registrar cumprimento</button>`
    }));
  }
  async function montarCumprimento(f) {
    const it = await D.itens.obter(val(f, 'id'));
    const a = await D.aeronaves.obter(it.aeronaveId);
    const data = val(f, 'data');
    const tsn = f.elements.tsn ? R.lerNumero(val(f, 'tsn')) : null;
    const troca = marcado(f, 'troca');
    const campos = { efetuadoData: data, efetuadoMes: false, obs: val(f, 'obs') };
    if (f.elements.tsn) campos.efetuadoTsn = tsn;
    if (troca) {
      const t = val(f, 'tsnc');
      campos.pn = val(f, 'pn'); campos.ns = val(f, 'ns');
      campos.tsnBase = /^ign/i.test(t) ? 'IGN' : (R.lerNumero(t) ?? 0);
      campos.tsoNovo = marcado(f, 'novo');
    } else if (f.elements.tsn && tsn !== null) {
      if (it.tsnBase === 'IGN') campos.tsnBase = 'IGN';
      else if (it.tsoNovo) campos.tsnBase = 0;                         // item de substituição: sai um, entra um novo
      else if (it.tsnBase === null || it.tsnBase === undefined) campos.tsnBase = temHoras(it) ? tsn : null;
      else campos.tsnBase = Math.round((it.tsnBase + (tsn - (it.efetuadoTsn ?? tsn))) * 10) / 10;
      if (!it.tsoNovo) campos.tsoNovo = false;
    }
    return { it, a, data, tsn, troca, campos };
  }
  AC.previas.cumprimento = async f => {
    const t = document.getElementById('cu-troca');
    if (t) t.hidden = !marcado(f, 'troca');
    const { it, a, campos } = await montarCumprimento(f);
    const box = document.getElementById('cu-previa');
    if (!campos.efetuadoData) { box.textContent = 'Informe a data do cumprimento.'; return; }
    const novo = Object.assign({}, it, campos, { validade: it.validade });
    const ctx = ctxAtual();
    const r = R.calcular(novo, a, ctx, R.utilizacaoDia(a, await D.lancamentos.todos(), ctx.ref).porDia);
    const partes = [r.vencData ? `<b>${R.fmtData(r.vencData)}</b>` : '', r.vencTsn !== null ? `<b>${R.fmtH(r.vencTsn)} h</b> de célula` : ''].filter(Boolean);
    box.innerHTML = partes.length ? `Próximo vencimento: ${partes.join(' ou ')}${partes.length > 1 ? ', o que ocorrer primeiro' : ''}.` : 'Este item não tem limite de horas nem de data para calcular o próximo vencimento.';
  };
  AC.forms.cumprimento = async f => {
    const { it, a, data, tsn, troca, campos } = await montarCumprimento(f);
    const ctx = ctxAtual();
    if (!data) throw new Error('Informe a data do cumprimento.');
    if (data > ctx.ref) throw new Error(`A data não pode ser depois de ${R.fmtData(ctx.ref)} (data de referência atual).`);
    if (f.elements.tsn) {
      if (tsn === null) throw new Error('Informe o TSN da célula no cumprimento.');
      if (tsn > a.tsn + 0.05) throw new Error(`O TSN informado (${R.fmtH(tsn)}) é maior que o TSN atual da célula (${R.fmtH(a.tsn)}). Lance as horas primeiro.`);
    }
    await D.cumprimentos.registrar(it, { efetuadoData: data, efetuadoTsn: tsn, obs: campos.obs, campos, troca: troca ? { pnAntes: it.pn, nsAntes: it.ns, pnDepois: campos.pn, nsDepois: campos.ns } : null });
    U.fecharDialogo(); U.fecharFolha();
    U.aviso(`Cumprimento registrado: ${it.nome.length > 48 ? it.nome.slice(0, 46) + '…' : it.nome}`);
    await AC.redesenhar();
  };
  async function desfazerCumprimento(el) {
    const ok = await U.confirmar({ titulo: 'Desfazer este cumprimento?', texto: 'O item volta a ter o último cumprimento anterior a este registro.', botao: 'Desfazer' });
    if (!ok) return;
    await D.cumprimentos.desfazer(el.dataset.id);
    U.fecharFolha(); U.aviso('Cumprimento desfeito.');
    await AC.redesenhar();
  }
  async function desfazerLancamento() {
    const at = exigirAeronaveAtual();
    const ok = await U.confirmar({ titulo: 'Desfazer o último lançamento?', texto: `O TSN do ${esc(at.a.matricula)} volta ao valor anterior.`, botao: 'Desfazer' });
    if (!ok) return;
    const l = await D.lancamentos.desfazerUltimo(at.a.id);
    U.aviso(`Lançamento de ${R.fmtH(l.horas)} h desfeito.`);
    await AC.redesenhar();
  }

  /* =================== ITEM (novo / editar) =================== */
  function campoIntervalo(nome, rot, valor) {
    const iv = R.lerIntervalo(valor);
    return campo(rot, `<div class="par"><input id="it-${nome}" name="${nome}N" inputmode="numeric" value="${iv ? iv.n : ''}" placeholder="—" aria-label="${rot}: quantidade">
      <select name="${nome}U" aria-label="${rot}: unidade">${opt('d', 'dias', iv && iv.u === 'd')}${opt('m', 'meses', iv && iv.u === 'm')}${opt('a', 'anos', !iv || iv.u === 'a')}</select></div>`, 'meia');
  }
  async function formItem(it, a) {
    const novo = !it.id;
    const ctx = ctxAtual();
    const r = R.calcular(it, a, ctx, 0);
    const itensAv = await D.itens.daAeronave(a.id);
    const doMapa = itensAv.filter(i => i.mapa === it.mapa);
    const secoes = [...new Set(itensAv.map(i => i.secao).filter(Boolean))];
    const grupos = [...new Set(doMapa.map(i => i.grupo).filter(Boolean))];
    const tsnHoje = r.tsnComp === 'IGN' ? 'IGN' : r.tsnComp !== null ? R.fmtH(r.tsnComp) : '';
    U.abrirDialogo(U.moldura({
      titulo: novo ? 'Novo item' : 'Editar item', sub: `${esc(a.matricula)} · os campos seguem as colunas do MICCA.`,
      form: 'item', previa: 'item',
      corpo: `<input type="hidden" name="id" value="${it.id || ''}"><input type="hidden" name="av" value="${a.id}">
      <datalist id="dl-secoes">${secoes.map(s => opt(s, s)).join('')}</datalist><datalist id="dl-grupos">${grupos.map(s => opt(s, s)).join('')}</datalist>
      <div class="form-grade">
        ${campo('Nomenclatura', `<textarea id="it-nome" name="nome" rows="2" required>${esc(it.nome || '')}</textarea>`, 'c6')}
        ${campo('Mapa', `<select id="it-mapa" name="mapa">${a.mapas.map(m => opt(m.id, m.nome, m.id === it.mapa)).join('')}</select>`, 'c2')}
        ${campo('Seção', `<input id="it-secao" name="secao" list="dl-secoes" value="${esc(it.secao || '')}" placeholder="Ex.: INSPEÇÕES ESPECIAIS">`, 'c2')}
        ${campo('Grupo', `<input id="it-grupo" name="grupo" list="dl-grupos" value="${esc(it.grupo || '')}" placeholder="Ex.: 500 horas">`, 'c2')}
        ${campo('P/N', `<input id="it-pn" name="pn" value="${esc(it.pn || '')}">`, 'meia')}
        ${campo('N/S', `<input id="it-ns" name="ns" value="${esc(it.ns || '')}">`, 'meia')}
        ${campo('Situação', `<select id="it-sit" name="situacao">${opt('controlado', 'Controlado (por horas e/ou data)', it.situacao === 'controlado')}${opt('na', 'N/A — não aplicável', it.situacao === 'na')}${opt('outro', 'Controlado em outro mapa/documento (**)', it.situacao === 'outro')}${opt('oc', 'Sob condição (O/C)', it.situacao === 'oc')}${opt('pendente', 'Regularizando', it.situacao === 'pendente')}${opt('nota', 'Nota (linha de texto)', it.situacao === 'nota')}</select>`, 'meia')}
        ${campo('Controlado em', `<select id="it-ref" name="refMapa">${opt('', 'Documento próprio (AD, boletim…)', !it.refMapa)}${opt('celula', 'Outro item da Célula', it.refMapa === 'celula')}${opt('motor', 'Mapa do Motor', it.refMapa === 'motor')}${opt('helice', 'Mapa da Hélice', it.refMapa === 'helice')}</select>`, 'meia', '', 'it-ref-c')}
        <div class="sep-form" data-grupo-lim>Limites — vence no que ocorrer primeiro</div>
        ${campo('TBO horas', `<input id="it-tboH" name="tboH" inputmode="decimal" value="${R.fmtH(it.tboHoras)}" placeholder="—">`, 'meia lim')}
        ${campoIntervalo('tbo', 'TBO data', it.tboData)}
        ${campo('TLV horas', `<input id="it-tlvH" name="tlvH" inputmode="decimal" value="${R.fmtH(it.tlvHoras)}" placeholder="—">`, 'meia lim')}
        ${campoIntervalo('tlv', 'TLV data', it.tlvData)}
        ${campo('Validade fixa (opcional)', `<input id="it-val" name="validade" type="date" value="${it.validade || ''}">`, 'meia lim', 'Para baterias, extintores, seguros: a data impressa.')}
        <div class="sep-form" data-grupo-lim>Último cumprimento</div>
        ${campo('Data', `<input id="it-ed" name="efetuadoData" type="date" value="${it.efetuadoData || ''}" max="${ctx.ref}">`, 'meia lim')}
        ${campo('TSN da célula', `<input id="it-et" name="efetuadoTsn" inputmode="decimal" value="${R.fmtH(it.efetuadoTsn)}" placeholder="—">`, 'meia lim')}
        ${campo('TSN do componente hoje', `<input id="it-tsnc" name="tsnc" value="${esc(tsnHoje)}" placeholder="N/A">`, 'meia lim', 'Número, IGN (ignorado) ou vazio (N/A).')}
        <label class="alternar meia lim" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="tsoNovo"${it.tsoNovo ? ' checked' : ''}>TSO = NOVO (instalado novo)</label>
        ${campo('OBS / referência', `<textarea id="it-obs" name="obs" rows="2">${esc(it.obs || '')}</textarea>`, 'c6')}
        ${a.mapas.find(m => m.id === it.mapa)?.tipo !== 'celula' ? `<label class="alternar" style="grid-column:1/-1"><input type="checkbox" name="principal"${it.principal ? ' checked' : ''}>Item principal do mapa (motor/hélice mostrado no painel da aeronave)</label>` : ''}
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('ok')}${novo ? 'Cadastrar item' : 'Salvar item'}</button>`
    }), 'largo');
  }
  AC.previas.item = f => {
    const sit = f.elements.situacao.value;
    document.getElementById('it-ref-c').hidden = sit !== 'outro';
    f.querySelectorAll('.lim, [data-grupo-lim]').forEach(el => { el.hidden = sit === 'nota'; });
    f.querySelectorAll('.par').forEach(el => { el.closest('.campo').hidden = sit === 'nota'; });
  };
  AC.forms.item = async f => {
    const a = await D.aeronaves.obter(val(f, 'av'));
    const id = val(f, 'id');
    const antigo = id ? await D.itens.obter(id) : {};
    const nome = val(f, 'nome');
    if (!nome) throw new Error('Informe a nomenclatura do item.');
    const iv = p => { const n = R.lerNumero(val(f, p + 'N')); return n ? `${Math.round(n)}${val(f, p + 'U')}` : ''; };
    const num = n => { const t = val(f, n); if (!t) return null; const v = R.lerNumero(t); if (v === null) throw new Error(`Valor inválido: "${t}". Use números como 1574,9.`); return v; };
    const et = num('efetuadoTsn');
    const tsnTxt = val(f, 'tsnc');
    let tsnBase = null;
    if (/^ign/i.test(tsnTxt)) tsnBase = 'IGN';
    else if (tsnTxt) { const v = num('tsnc'); tsnBase = et !== null ? Math.round((v - (a.tsn - et)) * 10) / 10 : v; }
    const item = Object.assign({}, antigo, {
      aeronaveId: a.id, mapa: val(f, 'mapa'), secao: val(f, 'secao'), grupo: val(f, 'grupo'), nome, pn: val(f, 'pn'), ns: val(f, 'ns'),
      situacao: val(f, 'situacao'), refMapa: val(f, 'situacao') === 'outro' ? (val(f, 'refMapa') || null) : null,
      tboHoras: num('tboH'), tboData: iv('tbo'), tlvHoras: num('tlvH'), tlvData: iv('tlv'),
      validade: val(f, 'validade') || null, validadeMes: val(f, 'validade') && antigo.validade === val(f, 'validade') ? !!antigo.validadeMes : false,
      efetuadoData: val(f, 'efetuadoData') || null, efetuadoMes: val(f, 'efetuadoData') && antigo.efetuadoData === val(f, 'efetuadoData') ? !!antigo.efetuadoMes : false,
      efetuadoTsn: et, tsnBase, tsoNovo: marcado(f, 'tsoNovo'), obs: val(f, 'obs'), principal: marcado(f, 'principal')
    });
    if (et !== null && et > a.tsn + 0.05) throw new Error(`O TSN do último cumprimento (${R.fmtH(et)}) é maior que o TSN atual da célula (${R.fmtH(a.tsn)}).`);
    if (antigo.mapa && antigo.mapa !== item.mapa) item.ordem = null;
    if (item.principal) {
      const outros = (await D.itens.daAeronave(a.id)).filter(i => i.mapa === item.mapa && i.principal && i.id !== item.id);
      for (const o of outros) await D.itens.salvar(Object.assign(o, { principal: false }));
    }
    await D.itens.salvar(item);
    U.fecharDialogo();
    U.aviso(id ? 'Item salvo.' : 'Item cadastrado.');
    if (id && document.getElementById('folha').open) await AC.acoes.abrirItem({ dataset: { id } });
    await AC.redesenhar();
  };
  async function novoItem() {
    const at = exigirAeronaveAtual();
    const mapa = at.aba === 'historico' ? at.a.mapas[0].id : at.aba;
    const ultimo = at.itens.filter(i => i.mapa === mapa).sort((x, y) => y.ordem - x.ordem)[0];
    await formItem({ aeronaveId: at.a.id, mapa, situacao: 'controlado', secao: ultimo?.secao || '', grupo: ultimo?.grupo || '', tsnBase: null, efetuadoTsn: null }, at.a);
  }
  async function editarItem(el) {
    const it = await D.itens.obter(el.dataset.id);
    await formItem(it, await D.aeronaves.obter(it.aeronaveId));
  }
  async function excluirItem(el) {
    const it = await D.itens.obter(el.dataset.id);
    const ok = await U.confirmar({ titulo: 'Excluir este item?', texto: `<b>${esc(it.nome)}</b> e o histórico de cumprimentos dele saem do MICCA.`, botao: 'Excluir item', perigo: true });
    if (!ok) return;
    await D.itens.excluir(it.id);
    U.fecharFolha();
    U.aviso('Item excluído.', { acao: { rotulo: 'Desfazer', fn: async () => { await D.itens.salvarVarios([it]); U.aviso('Item restaurado.'); AC.redesenhar(); } } });
    await AC.redesenhar();
  }

  /* =================== AERONAVE (nova / editar) =================== */
  function camposMapa(m, i) {
    return `<div class="sep-form">${esc(m.nome)}</div>
      <input type="hidden" name="m${i}id" value="${esc(m.id)}">
      ${campo('Fabricante', `<input id="m${i}fab" name="m${i}fab" value="${esc(m.fabricante || '')}" placeholder="${m.tipo === 'motor' ? 'Ex.: Lycoming' : 'Ex.: Hartzell'}">`, 'c2')}
      ${campo('Modelo', `<input id="m${i}mod" name="m${i}mod" value="${esc(m.modelo || '')}">`, 'c2')}
      ${campo('S/N', `<input id="m${i}sn" name="m${i}sn" value="${esc(m.sn || '')}">`, 'c2')}`;
  }
  async function formAeronave(a, copiarDe) {
    const novo = !a.id;
    const avs = await D.aeronaves.listar();
    const todos = await D.itens.todos();
    const ctx = ctxAtual();
    const contaItens = id => todos.filter(i => i.aeronaveId === id).length;
    U.abrirDialogo(U.moldura({
      titulo: novo ? 'Nova aeronave' : `Editar ${esc(a.matricula)}`,
      sub: novo ? 'Copie a estrutura de uma aeronave do mesmo modelo e só preencha as datas — os ~150 itens já vêm prontos.' : 'Dados do cabeçalho do MICCA.',
      form: 'aeronave', previa: 'aeronave',
      corpo: `<input type="hidden" name="id" value="${a.id || ''}"><div class="form-grade">
        ${campo('Matrícula', `<input id="av-mat" name="matricula" value="${esc(a.matricula || '')}" placeholder="PR-XXX" required style="text-transform:uppercase">`, 'c2')}
        ${campo('Fabricante', `<input id="av-fab" name="fabricante" value="${esc(a.fabricante || '')}" placeholder="Ex.: PIPER AIRCRAFT">`, 'c2')}
        ${campo('Modelo', `<input id="av-mod" name="modelo" value="${esc(a.modelo || '')}" placeholder="Ex.: PA-46R-350T">`, 'c2')}
        ${campo('S/N', `<input id="av-sn" name="sn" value="${esc(a.sn || '')}">`, 'c2')}
        ${campo('Ano de fabricação', `<input id="av-ano" name="ano" inputmode="numeric" value="${esc(a.ano || '')}">`, 'c2')}
        ${campo('Utilização média (h/mês)', `<input id="av-util" name="util" inputmode="decimal" value="${R.fmtH(a.utilMensal ?? 20)}">`, 'c2', 'Usada na previsão até os lançamentos de horas assumirem.')}
        ${campo('TSN da célula', `<input id="av-tsn" name="tsn" inputmode="decimal" value="${R.fmtH(a.tsn ?? 0)}">`, 'c2')}
        ${campo('TSO da célula', `<input id="av-tso" name="tso" inputmode="decimal" value="${R.fmtH(a.tso)}" placeholder="N/A">`, 'c2')}
        ${campo('Posição do TSN em', `<input id="av-pos" name="posicao" type="date" value="${a.posicaoData || ctx.ref}">`, 'c2')}
        ${campo('Manual de referência', `<input id="av-man" name="manual" value="${esc(a.manualRef || '')}" placeholder="Ex.: SM P/N 761-876">`, 'c4')}
        ${campo('Última revisão', `<input id="av-rev" name="revisao" type="date" value="${a.manualRev || ''}">`, 'c2')}
        ${novo ? `<div class="sep-form">Configuração e itens</div>
          <div class="campo c2"><span class="rot">Motores</span><div class="opcoes-radio"><label><input type="radio" name="motores" value="1" checked>Mono</label><label><input type="radio" name="motores" value="2">Bimotor</label></div></div>
          <label class="alternar c2" style="align-self:end;padding-bottom:10px;grid-column:span 2"><input type="checkbox" name="helice" checked>Possui hélice</label>
          ${campo('Copiar a estrutura de', `<select id="av-copiar" name="copiar">${opt('', 'Nenhuma — começar vazio', !copiarDe)}${avs.map(x => opt(x.id, `${x.matricula} (${x.modelo}) — ${contaItens(x.id)} itens`, x.id === copiarDe)).join('')}</select>`, 'c6', 'Copia nomenclatura, P/N, limites e aplicabilidade. N/S e datas de cumprimento ficam em branco para você preencher.')}
          <div id="av-mapas" class="form-grade" style="grid-column:1/-1"></div>`
        : a.mapas.filter(m => m.tipo !== 'celula').map(camposMapa).join('')}
      </div>`,
      rodape: `${!novo ? `<button type="button" class="botao perigo esq" data-acao="excluirAeronave" data-id="${a.id}">${ic('lixo')}Excluir aeronave</button>` : ''}<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('ok')}${novo ? 'Cadastrar aeronave' : 'Salvar'}</button>`
    }), 'largo');
  }
  function mapasNovos(f) {
    const n = Number(f.elements.motores?.value || 1), hel = marcado(f, 'helice');
    const mapas = [{ id: 'celula', tipo: 'celula', nome: 'Célula' }];
    if (n === 1) mapas.push({ id: 'motor', tipo: 'motor', nome: 'Motor' });
    else mapas.push({ id: 'motor-e', tipo: 'motor', nome: 'Motor esquerdo' }, { id: 'motor-d', tipo: 'motor', nome: 'Motor direito' });
    if (hel) {
      if (n === 1) mapas.push({ id: 'helice', tipo: 'helice', nome: 'Hélice' });
      else mapas.push({ id: 'helice-e', tipo: 'helice', nome: 'Hélice esquerda' }, { id: 'helice-d', tipo: 'helice', nome: 'Hélice direita' });
    }
    return mapas;
  }
  AC.previas.aeronave = f => {
    const box = document.getElementById('av-mapas');
    if (!box) return;
    const mapas = mapasNovos(f).filter(m => m.tipo !== 'celula');
    const chaveAtual = mapas.map(m => m.id).join();
    if (box.dataset.chave === chaveAtual) return;
    const guardados = {};
    box.querySelectorAll('input').forEach(i => { guardados[i.name] = i.value; });
    box.dataset.chave = chaveAtual;
    box.innerHTML = mapas.map(camposMapa).join('');
    box.querySelectorAll('input').forEach(i => { if (guardados[i.name] && i.type !== 'hidden') i.value = guardados[i.name]; });
  };
  AC.forms.aeronave = async f => {
    const id = val(f, 'id');
    const antigo = id ? await D.aeronaves.obter(id) : null;
    const matricula = val(f, 'matricula').toUpperCase();
    if (!/^[A-Z0-9]{1,3}-?[A-Z0-9]{2,5}$/.test(matricula)) throw new Error('Informe a matrícula no formato PR-XXX.');
    const tsn = R.lerNumero(val(f, 'tsn'));
    if (tsn === null || tsn < 0) throw new Error('Informe o TSN da célula (pode ser 0,0).');
    const mapas = antigo ? antigo.mapas.map(m => Object.assign({}, m)) : mapasNovos(f);
    mapas.forEach(m => {
      const i = [...f.querySelectorAll('input[name$="id"]')].find(x => /^m\d+id$/.test(x.name) && x.value === m.id);
      if (!i) return;
      const k = i.name.replace('id', '');
      m.fabricante = val(f, k + 'fab'); m.modelo = val(f, k + 'mod'); m.sn = val(f, k + 'sn');
    });
    const a = Object.assign({}, antigo || { ciclos: null, demo: false }, {
      id: id || undefined, matricula, fabricante: val(f, 'fabricante').toUpperCase(), modelo: val(f, 'modelo').toUpperCase(), sn: val(f, 'sn'),
      ano: R.lerNumero(val(f, 'ano')) || '', tsn, tso: R.lerNumero(val(f, 'tso')), posicaoData: val(f, 'posicao') || ctxAtual().ref,
      utilMensal: R.lerNumero(val(f, 'util')) ?? 0, manualRef: val(f, 'manual'), manualRev: val(f, 'revisao') || '', mapas
    });
    const salvo = await D.aeronaves.salvar(a);
    const itensAv = await D.itens.daAeronave(salvo.id);
    const sincronizar = [];
    /* mantém o item principal (Motor, Hélice) com o modelo e S/N do cabeçalho */
    for (const m of mapas) {
      const p = itensAv.find(i => i.mapa === m.id && i.principal);
      if (p && (p.pn !== m.modelo || p.ns !== m.sn)) sincronizar.push(Object.assign({}, p, { pn: m.modelo || p.pn, ns: m.sn || p.ns }));
    }
    const copiar = !antigo && val(f, 'copiar');
    let copiados = 0;
    if (copiar) {
      const base = await D.itens.daAeronave(copiar);
      const baseAv = await D.aeronaves.obter(copiar);
      for (const b of base) {
        const tipo = baseAv.mapas.find(m => m.id === b.mapa)?.tipo || 'celula';
        const alvos = mapas.filter(m => m.tipo === tipo);
        for (const alvo of alvos) {
          const novo = Object.assign({}, b, {
            id: undefined, aeronaveId: salvo.id, mapa: alvo.id, ns: '', efetuadoData: null, efetuadoMes: false, efetuadoTsn: null,
            tsnBase: b.tsnBase === 'IGN' ? 'IGN' : null
          });
          if (b.principal) { novo.pn = alvo.modelo || b.pn; novo.ns = alvo.sn || ''; }
          if (b.validade) novo.validade = null;
          if (b.situacao === 'controlado' && b.tsoNovo && b.efetuadoTsn === 0 && !b.efetuadoData) { novo.efetuadoTsn = 0; novo.tsnBase = 0; } // estrutura original de fábrica
          sincronizar.push(novo); copiados++;
        }
      }
    }
    if (sincronizar.length) await D.itens.salvarVarios(sincronizar);
    U.fecharDialogo();
    if (antigo) { U.aviso('Aeronave salva.'); await AC.redesenhar(); }
    else {
      U.aviso(copiados ? `${salvo.matricula} cadastrada com ${copiados} itens. Agora é só registrar os cumprimentos.` : `${salvo.matricula} cadastrada.`);
      location.hash = `#/aeronave/${salvo.id}`;
    }
  };
  async function excluirAeronave(el) {
    const a = await D.aeronaves.obter(el.dataset.id);
    const n = (await D.itens.daAeronave(a.id)).length;
    const ok = await U.confirmar({ titulo: `Excluir ${a.matricula}?`, texto: `A aeronave, os ${n} itens do MICCA, as horas lançadas e o histórico saem do sistema. Isso não pode ser desfeito — exporte um backup antes, se precisar.`, botao: 'Excluir aeronave', perigo: true });
    if (!ok) return;
    await D.aeronaves.excluir(a.id);
    U.fecharDialogo();
    U.aviso(`${a.matricula} excluída.`);
    location.hash = '#/frota';
  }

  /* =================== PLANILHA =================== */
  async function exportarCsv() {
    const at = exigirAeronaveAtual();
    const mapa = at.aba === 'historico' ? at.a.mapas[0].id : at.aba;
    const ctx = ctxAtual();
    const txt = AC.planilha.exportarMapa(at.a, at.itens, mapa, ctx, at.s.util.porDia);
    const nome = at.a.mapas.find(m => m.id === mapa).nome;
    U.baixar(`MICCA-${at.a.matricula}-${nome}.csv`.replace(/\s+/g, '-'), txt, 'text/csv;charset=utf-8');
    U.aviso(`Mapa ${nome} exportado. O mesmo arquivo serve de modelo para importar.`);
  }
  let importacao = null;
  async function importarCsv() {
    const at = exigirAeronaveAtual();
    const mapa = at.aba === 'historico' ? at.a.mapas[0].id : at.aba;
    importacao = null;
    U.abrirDialogo(U.moldura({
      titulo: 'Importar planilha do MICCA', sub: `Para ${esc(at.a.matricula)}. Use um CSV com as colunas do MICCA — o arquivo de “Exportar” é o modelo.`,
      form: 'importar', previa: 'importar',
      corpo: `<input type="hidden" name="av" value="${at.a.id}"><div class="form-grade">
        ${campo('Arquivo CSV', `<input id="im-arq" name="arquivo" type="file" accept=".csv,text/csv">`, 'c6', 'No Excel: Arquivo › Salvar como › CSV (separado por ponto e vírgula).')}
        ${campo('Mapa de destino', `<select id="im-mapa" name="mapa">${at.a.mapas.map(m => opt(m.id, m.nome, m.id === mapa)).join('')}</select>`, 'meia', 'Usado quando a planilha não tem a coluna Mapa.')}
        <div class="campo meia"><span class="rot">Itens que já existem</span><div class="opcoes-radio">
          <label><input type="radio" name="modo" value="somar" checked>Manter e somar</label>
          <label><input type="radio" name="modo" value="trocar">Substituir o mapa</label></div></div>
        <div class="previa" id="im-previa" aria-live="polite">Escolha o arquivo para ver o que será importado.</div>
        <p class="dica" style="grid-column:1/-1;margin:0;font-size:12.5px;color:var(--tinta-3)">Colunas reconhecidas: ${AC.planilha.COLUNAS.join(' · ')}</p>
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('subir')}Importar</button>`
    }), 'largo');
  }
  AC.previas.importar = async f => {
    const box = document.getElementById('im-previa');
    const arq = f.elements.arquivo.files[0];
    if (!arq) return;
    const a = await D.aeronaves.obter(val(f, 'av'));
    const texto = await arq.text();
    importacao = AC.planilha.interpretar(texto, a, val(f, 'mapa'));
    const porMapa = {};
    importacao.itens.forEach(i => { porMapa[i.mapa] = (porMapa[i.mapa] || 0) + 1; });
    box.innerHTML = `<b>${importacao.itens.length}</b> de ${importacao.linhasLidas} linhas prontas para importar` +
      (Object.keys(porMapa).length ? ` (${Object.entries(porMapa).map(([m, n]) => `${esc(a.mapas.find(x => x.id === m)?.nome)}: ${n}`).join(', ')})` : '') + '.' +
      (importacao.erros.length ? `<br><b>${importacao.erros.length} ${importacao.erros.length === 1 ? 'linha com problema' : 'linhas com problema'}</b> (serão ignoradas):<ul>${importacao.erros.slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('')}${importacao.erros.length > 6 ? `<li>e mais ${importacao.erros.length - 6}</li>` : ''}</ul>` : '');
  };
  AC.forms.importar = async f => {
    if (!importacao) throw new Error('Escolha o arquivo CSV.');
    if (!importacao.itens.length) throw new Error('Nenhuma linha válida para importar. Confira os avisos acima.');
    const a = await D.aeronaves.obter(val(f, 'av'));
    const mapas = [...new Set(importacao.itens.map(i => i.mapa))];
    if (f.elements.modo.value === 'trocar') {
      const ok = await U.confirmar({ titulo: 'Substituir os itens?', texto: `Os itens atuais de ${mapas.map(m => esc(a.mapas.find(x => x.id === m)?.nome)).join(', ')} serão apagados e trocados pelos ${importacao.itens.length} da planilha.`, botao: 'Substituir', perigo: true });
      if (!ok) return;
      for (const m of mapas) await D.itens.excluirDoMapa(a.id, m);
    }
    const existentes = await D.itens.daAeronave(a.id);
    const ordemBase = {};
    mapas.forEach(m => { ordemBase[m] = existentes.filter(i => i.mapa === m).reduce((x, i) => Math.max(x, i.ordem || 0), 0); });
    importacao.itens.forEach(i => { ordemBase[i.mapa] += 10; i.ordem = ordemBase[i.mapa]; });
    const n = await D.itens.salvarVarios(importacao.itens);
    importacao = null;
    U.fecharDialogo();
    U.aviso(`${n} itens importados para ${a.matricula}.`);
    await AC.redesenhar();
  };

  /* =================== DATA DE REFERÊNCIA =================== */
  async function abrirRef() {
    const cfg = AC.cfg();
    const ctx = ctxAtual();
    U.abrirDialogo(U.moldura({
      titulo: 'Data de referência', sub: 'Todos os prazos em dias são contados a partir desta data. No uso normal ela é sempre hoje; mude para conferir um MICCA antigo ou simular uma data futura.',
      form: 'ref',
      corpo: `<div class="form-grade">${campo('Calcular a situação em', `<input id="rf-data" name="data" type="date" value="${ctx.ref}" required>`, 'c6')}
        <div class="campo c6"><div class="opcoes-radio" style="gap:6px">
          <button type="button" class="botao pequeno" data-acao="usarHoje">Hoje (${R.fmtData(R.hojeISO())})</button>
          ${cfg.demo ? `<button type="button" class="botao pequeno" data-acao="usarDataMicca">Data do MICCA do PR-ELF (11/10/2023)</button>` : ''}
        </div></div></div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button><button type="submit" class="botao primario">${ic('calendario')}Usar esta data</button>`
    }), 'estreito');
  }
  async function definirRef(data) {
    await D.config.salvar({ dataRef: !data || data === R.hojeISO() ? null : data });
    U.fecharDialogo();
    U.aviso(!data || data === R.hojeISO() ? 'Calculando com a data de hoje.' : `Situação calculada em ${R.fmtData(data)}.`);
    await AC.redesenhar();
  }
  AC.forms.ref = async f => { const d = val(f, 'data'); if (!d) throw new Error('Escolha uma data.'); await definirRef(d); };

  /* =================== CONFIGURAÇÕES =================== */
  async function config() {
    const cfg = AC.cfg();
    const kb = Math.round(D.backup.tamanho() / 1024);
    U.abrirDialogo(U.moldura({
      titulo: 'Configurações', form: 'config',
      corpo: `<div class="form-grade">
        <div class="sep-form" style="margin-top:0;padding-top:0;border:0">Alertas</div>
        ${campo('Avisar com antecedência de (dias)', `<input id="cf-dias" name="dias" inputmode="numeric" value="${cfg.alertaDias ?? 30}">`, 'meia')}
        ${campo('ou de (horas)', `<input id="cf-horas" name="horas" inputmode="decimal" value="${R.fmtH(cfg.alertaHoras ?? 25)}">`, 'meia')}
        <p class="dica" style="grid-column:1/-1;margin:-4px 0 0;font-size:12.5px;color:var(--tinta-3)">Para itens de intervalo curto (30 dias, 50 h) o alerta usa no máximo 25% do intervalo, para não ficar sempre amarelo.</p>
        <div class="sep-form">Backup</div>
        <div class="campo c6"><span class="dica">Os dados ficam neste navegador (${kb} KB). Exporte um backup com frequência; na versão com servidor isso deixa de ser necessário.</span>
          <div class="opcoes-radio" style="gap:6px;margin-top:4px">
            <button type="button" class="botao pequeno" data-acao="exportarBackup">${ic('baixar')}Exportar backup</button>
            <label class="botao pequeno" style="cursor:pointer">${ic('subir')}Importar backup<input type="file" accept=".json,application/json" data-acao-arquivo="importarBackup" hidden></label>
          </div></div>
        ${cfg.demo ? `<div class="sep-form">Demonstração</div>
        <div class="campo c6"><span class="dica">Volta tudo ao estado inicial: PR-ELF com os dados do papel e a frota fictícia.</span>
          <div><button type="button" class="botao pequeno perigo" data-acao="restaurarDemo">${ic('desfazer')}Restaurar demonstração</button></div></div>` : ''}
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Fechar</button><button type="submit" class="botao primario">${ic('ok')}Salvar alertas</button>`
    }), 'estreito');
    const arq = document.querySelector('[data-acao-arquivo="importarBackup"]');
    arq.addEventListener('change', async () => {
      const file = arq.files[0]; if (!file) return;
      const ok = await U.confirmar({ titulo: 'Importar backup?', texto: 'Os dados atuais deste navegador serão substituídos pelos do arquivo.', botao: 'Importar', perigo: true });
      if (!ok) return;
      try { await D.backup.importar(await file.text()); U.fecharDialogo(); U.aviso('Backup importado.'); location.hash = '#/frota'; await AC.redesenhar(); }
      catch (e) { U.aviso(e.message || 'Arquivo inválido.', { tipo: 'erro' }); }
    });
  }
  AC.forms.config = async f => {
    const dias = R.lerNumero(val(f, 'dias')), horas = R.lerNumero(val(f, 'horas'));
    if (dias === null || dias < 0 || horas === null || horas < 0) throw new Error('Informe dias e horas de antecedência (zero ou mais).');
    await D.config.salvar({ alertaDias: Math.round(dias), alertaHoras: horas });
    U.fecharDialogo(); U.aviso('Alertas atualizados.');
    await AC.redesenhar();
  };

  Object.assign(AC.acoes, {
    lancarHoras, cumprimento, desfazerCumprimento, desfazerLancamento,
    novoItem, editarItem, excluirItem,
    novaAeronave: async el => formAeronave({ utilMensal: 20, tsn: 0 }, el && el.dataset ? el.dataset.copiar : ''),
    editarAeronave: async el => formAeronave(await D.aeronaves.obter(el.dataset.id)),
    excluirAeronave, exportarCsv, importarCsv,
    abrirRef, usarHoje: () => definirRef(null), usarDataMicca: () => definirRef('2023-10-11'),
    config,
    exportarBackup: async () => { U.baixar(`aerocontrol-backup-${R.hojeISO()}.json`, await D.backup.exportar(), 'application/json'); U.aviso('Backup exportado.'); },
    restaurarDemo: async () => {
      const ok = await U.confirmar({ titulo: 'Restaurar a demonstração?', texto: 'Tudo o que foi lançado ou cadastrado neste navegador será apagado.', botao: 'Restaurar', perigo: true });
      if (!ok) return;
      await D.backup.restaurarDemo(); U.fecharDialogo(); U.aviso('Demonstração restaurada.'); location.hash = '#/frota'; await AC.redesenhar();
    },
    fecharDemo: async () => { await D.config.salvar({ avisoDemo: false }); await AC.redesenhar(); }
  });
})();

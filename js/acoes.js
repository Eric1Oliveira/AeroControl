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
  /* ---- importar planilha: 1) escolher o arquivo  2) conferir  3) aplicar (só aí grava) ---- */
  let imp = null;
  const ST_IMP = { novo: 'Novo', atualiza: 'Atualiza', igual: 'Igual', repetida: 'Repetida' };
  async function importarCsv() {
    const at = exigirAeronaveAtual();
    const mapa = at.aba === 'historico' ? at.a.mapas[0].id : at.aba;
    imp = null;
    U.abrirDialogo(U.moldura({
      titulo: 'Importar planilha', sub: `Para ${esc(at.a.matricula)}. Você confere tudo antes de gravar.`,
      corpo: `<label class="soltar" for="im-arq">${ic('subir')}<b>Escolher planilha</b>
          <span>Excel (.xlsx) ou CSV. Colunas com outros nomes (Part Number, Descrição, Serial…) são reconhecidas sozinhas.</span>
          <input id="im-arq" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
        <p class="dica-imp">Dica: o arquivo de “Exportar” é o modelo completo. Planilha com várias abas (Célula, Motor, Hélice) entra de uma vez.</p>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button>`
    }), 'estreito');
    const inp = document.getElementById('im-arq');
    inp.addEventListener('change', async () => {
      const arq = inp.files[0];
      if (!arq) return;
      try { await abrirConferencia(arq, at.a.id, mapa); }
      catch (e) { console.error(e); U.aviso(e.message || 'Não foi possível ler a planilha.', { tipo: 'erro' }); inp.value = ''; }
    });
  }
  async function abrirConferencia(arq, avId, mapaPadrao) {
    const a = await D.aeronaves.obter(avId);
    const abas = (await AC.planilha.abrir(arq)).filter(x => x.linhas.some(l => l.some(c => String(c ?? '').trim())));
    if (!abas.length) throw new Error('A planilha está vazia.');
    const pelaAba = nome => { const k = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return a.mapas.find(m => k.includes(m.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) || k.includes(m.tipo))?.id; };
    imp = {
      arquivo: arq.name, a, filtro: 'todos', desmarcados: new Set(),
      existentes: JSON.parse(JSON.stringify(await D.itens.daAeronave(a.id))),
      util: R.utilizacaoDia(a, await D.lancamentos.todos(), ctxAtual().ref).porDia,
      abas: abas.map(x => ({ nome: x.nome, linhas: x.linhas, mapa: (abas.length > 1 && pelaAba(x.nome)) || mapaPadrao, campos: null }))
    };
    recalcular();
    desenharConferencia(true);
  }
  function recalcular() {
    const entrada = [];
    imp.erros = [];
    imp.abas.forEach(ab => {
      ab.res = null;
      if (!ab.mapa) return;   // "Não importar"
      const res = AC.planilha.interpretar(ab.linhas, imp.a, ab.mapa, ab.campos);
      ab.res = res; ab.campos = res.campos;
      res.itens.forEach(x => entrada.push({ it: x.it, linha: x.linha, aba: ab.nome, presentes: res.presentes }));
      res.erros.forEach(e => imp.erros.push(imp.abas.length > 1 ? `${ab.nome} · ${e}` : e));
    });
    imp.linhas = AC.planilha.conferir(entrada, imp.existentes);
  }
  const aplicaveis = () => imp.linhas.filter(l => (l.status === 'novo' || l.status === 'atualiza') && !imp.desmarcados.has(l.chave));
  const fmtValor = (campo, v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (campo === 'situacao') return AC.planilha.SIT_TXT[v] || v;
    if (campo === 'refMapa') return AC.planilha.TIPO_TXT[v] || v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return R.fmtData(v);
    if (typeof v === 'number') return R.fmtH(v);
    if (/^\d+[dma]$/.test(v)) return R.intervaloTxt(R.lerIntervalo(v));
    return String(v);
  };
  function controleTxt(it) {
    const p = [];
    if (it.tboHoras !== null && it.tboHoras !== undefined) p.push(`TBO ${R.fmtH(it.tboHoras)} h`);
    if (it.tboData) p.push(`TBO ${R.intervaloTxt(R.lerIntervalo(it.tboData))}`);
    if (it.tlvHoras !== null && it.tlvHoras !== undefined) p.push(`TLV ${R.fmtH(it.tlvHoras)} h`);
    if (it.tlvData) p.push(`TLV ${R.intervaloTxt(R.lerIntervalo(it.tlvData))}`);
    if (it.validade) p.push(`Validade ${R.fmtData(it.validade, it.validadeMes)}`);
    return p.join(' · ') || '—';
  }
  function linhaConferencia(l, ctx) {
    const it = l.it, a = imp.a;
    const mapa = a.mapas.find(m => m.id === it.mapa)?.nome || it.mapa;
    const r = R.calcular(it, a, ctx, imp.util);
    const venc = [r.vencData ? R.fmtData(r.vencData) : '', r.vencTsn !== null ? `${R.fmtH(r.vencTsn)} h` : ''].filter(Boolean).join(' · ');
    const pode = l.status === 'novo' || l.status === 'atualiza';
    const mud = l.mud.length ? `<ul class="cf-mud">${l.mud.slice(0, 4).map(m => `<li>${esc(m.rotulo)}: <s>${esc(fmtValor(m.campo, m.de))}</s> → <b>${esc(fmtValor(m.campo, m.para))}</b></li>`).join('')}${l.mud.length > 4 ? `<li>e mais ${l.mud.length - 4} campos</li>` : ''}</ul>` : '';
    return `<tr class="cf-${l.status}">
      <td class="cf-marca">${pode ? `<input type="checkbox" data-cf-marca="${esc(l.chave)}"${imp.desmarcados.has(l.chave) ? '' : ' checked'} aria-label="Aplicar ${esc(it.nome)}">` : ''}</td>
      <td><span class="cf-selo cf-${l.status}">${ST_IMP[l.status]}</span><small class="cf-lin">linha ${l.linha}</small></td>
      <td><b class="cf-nome">${esc(it.nome)}</b><small>${esc([mapa, it.secao, it.grupo].filter(Boolean).join(' · '))}</small>${mud}</td>
      <td class="cf-pn">${esc(it.pn || '—')}<small>${it.ns ? 'N/S ' + esc(it.ns) : ''}</small></td>
      <td>${esc(controleTxt(it))}</td>
      <td><span class="cf-venc">${esc(venc || '—')}</span>${U.etiqueta(r.situacao)}</td>
    </tr>`;
  }
  function desenharConferencia(primeira) {
    const L = imp.linhas, a = imp.a, ctx = ctxAtual();
    const n = { novo: 0, atualiza: 0, igual: 0, repetida: 0 };
    L.forEach(l => { n[l.status]++; });
    const nProb = imp.erros.length + n.repetida;
    const f = imp.filtro;
    const vis = f === 'todos' ? L.filter(l => l.status !== 'repetida') : L.filter(l => l.status === f);
    const seg = (v, rot, q, cls) => `<button type="button" data-cf-filtro="${v}" aria-pressed="${f === v}">${rot}<span class="n${cls ? ' ' + cls : ''}">${q}</span></button>`;
    const abas = imp.abas.map((ab, i) => {
      const reconh = (ab.campos || []).filter(Boolean).length, total = (ab.res?.titulos || ab.linhas[0] || []).length;
      const semNome = ab.res && !ab.campos.includes('nomenclatura');
      return `<div class="cf-aba">
        <div class="cf-aba-cab"><b>${esc(ab.nome)}</b><span>${ab.res ? `${ab.res.linhasLidas} ${ab.res.linhasLidas === 1 ? 'linha' : 'linhas'}` : 'fora da importação'}</span>
          <label>Mapa <select data-cf-aba="${i}">${a.mapas.map(m => opt(m.id, m.nome, m.id === ab.mapa)).join('')}${imp.abas.length > 1 ? opt('', 'Não importar esta aba', !ab.mapa) : ''}</select></label></div>
        ${ab.res ? `<details${semNome ? ' open' : ''}><summary>Colunas: ${reconh} reconhecidas${total - reconh > 0 ? `, ${total - reconh} ignoradas` : ''} <em>conferir ou corrigir</em></summary>
          <div class="cf-colunas">${ab.res.titulos.map((t, j) => `<label><span>${esc(String(t).trim() || 'Coluna ' + (j + 1))}</span>
            <select data-cf-aba="${i}" data-cf-col="${j}">${opt('', 'Ignorar', !ab.campos[j])}${AC.planilha.CAMPOS.map(([k, rot]) => opt(k, rot, ab.campos[j] === k)).join('')}</select></label>`).join('')}</div></details>` : ''}
      </div>`;
    }).join('');
    const corpoTabela = f === 'problemas'
      ? `<ul class="cf-problemas">${imp.erros.map(e => `<li>${ic('alerta')}${esc(e)}</li>`).join('')}${L.filter(l => l.status === 'repetida').map(l => `<li>${ic('alerta')}${imp.abas.length > 1 ? esc(l.aba) + ' · ' : ''}Linha ${l.linha}: ${esc(l.it.nome)} repete a linha ${l.igualA} (mesmo nome, P/N e N/S) — fica de fora.</li>`).join('')}${nProb ? '' : '<li class="ok">Nenhum problema encontrado.</li>'}</ul>`
      : vis.length ? `<div class="cf-rolagem"><table class="cf-tabela"><thead><tr><th class="cf-marca">${vis.some(l => l.status === 'novo' || l.status === 'atualiza') ? `<input type="checkbox" data-cf-todos aria-label="Marcar todos" checked>` : ''}</th><th>Importação</th><th>Item</th><th>P/N · N/S</th><th>Controle</th><th>Vencimento</th></tr></thead>
          <tbody>${vis.map(l => linhaConferencia(l, ctx)).join('')}</tbody></table></div>`
        : `<div class="vazio-bloco"><strong>Nada aqui</strong>Nenhuma linha neste filtro.</div>`;
    const qtd = aplicaveis().length;
    const html = U.moldura({
      titulo: 'Conferir importação', sub: `${esc(imp.arquivo)} → ${esc(a.matricula)}. Nada foi gravado ainda: confira e aplique.`, form: 'conferencia',
      corpo: `<div class="cf-abas">${abas}</div>
        <div class="segmentos cf-filtros" role="group" aria-label="Filtrar linhas">${seg('todos', 'Todos', n.novo + n.atualiza + n.igual)}${seg('novo', 'Novos', n.novo)}${seg('atualiza', 'Atualizam', n.atualiza)}${seg('igual', 'Iguais', n.igual)}${seg('problemas', 'Problemas', nProb, nProb ? 'n-venc' : '')}</div>
        ${corpoTabela}`,
      rodape: `<span class="esq cf-nota">Itens iguais não mudam nada. Os que já existem mantêm o histórico.</span>
        <button type="button" class="botao" data-acao="fecharDialogo">Cancelar</button>
        <button type="submit" class="botao primario" id="cf-aplicar"${qtd ? '' : ' disabled'}>${ic('ok')}Aplicar ${qtd} ${qtd === 1 ? 'item' : 'itens'}</button>`
    });
    const dlg = document.getElementById('dlg');
    const rol = dlg.querySelector('.dlg-corpo')?.scrollTop || 0;
    if (primeira || !dlg.open) U.abrirDialogo(html, 'enorme'); else dlg.innerHTML = html;
    if (!primeira) dlg.querySelector('.dlg-corpo').scrollTop = rol;
    ligarConferencia(dlg.querySelector('form'));
  }
  function ligarConferencia(form) {
    const contar = () => { const q = aplicaveis().length, b = form.querySelector('#cf-aplicar'); b.disabled = !q; b.lastChild.textContent = `Aplicar ${q} ${q === 1 ? 'item' : 'itens'}`; };
    form.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.cfMarca !== undefined) { if (t.checked) imp.desmarcados.delete(t.dataset.cfMarca); else imp.desmarcados.add(t.dataset.cfMarca); contar(); return; }
      if (t.dataset.cfTodos !== undefined) {
        form.querySelectorAll('[data-cf-marca]').forEach(c => { c.checked = t.checked; if (t.checked) imp.desmarcados.delete(c.dataset.cfMarca); else imp.desmarcados.add(c.dataset.cfMarca); });
        contar(); return;
      }
      if (t.dataset.cfAba !== undefined) {
        const ab = imp.abas[+t.dataset.cfAba];
        if (t.dataset.cfCol !== undefined) ab.campos[+t.dataset.cfCol] = t.value; else ab.mapa = t.value;
        recalcular(); desenharConferencia();
      }
    });
    form.addEventListener('click', e => {
      const b = e.target.closest('[data-cf-filtro]');
      if (b) { imp.filtro = b.dataset.cfFiltro; desenharConferencia(); }
    });
  }
  AC.forms.conferencia = async () => {
    const escolhidas = aplicaveis();
    if (!escolhidas.length) throw new Error('Nada para aplicar: marque ao menos um item novo ou que atualiza.');
    const a = imp.a, ordem = {};
    imp.existentes.forEach(i => { ordem[i.mapa] = Math.max(ordem[i.mapa] || 0, i.ordem || 0); });
    const novos = [], atualizados = [], antes = [];
    escolhidas.forEach(l => {
      if (l.status === 'novo') { ordem[l.it.mapa] = (ordem[l.it.mapa] || 0) + 10; novos.push(Object.assign({}, l.it, { id: D.novoId(), ordem: ordem[l.it.mapa] })); }
      else { atualizados.push(l.it); antes.push(l.antes); }
    });
    await D.itens.trocar([], novos.concat(atualizados));
    imp = null;
    U.fecharDialogo();
    const partes = [novos.length && `${novos.length} ${novos.length === 1 ? 'item novo' : 'itens novos'}`, atualizados.length && `${atualizados.length} ${atualizados.length === 1 ? 'atualizado' : 'atualizados'}`].filter(Boolean);
    U.aviso(`${a.matricula}: ${partes.join(' e ')}.`, { acao: { rotulo: 'Desfazer', fn: async () => { await D.itens.trocar(novos.map(i => i.id), antes); U.aviso('Importação desfeita.'); await AC.redesenhar(); } } });
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
    U.abrirDialogo(U.moldura({
      titulo: 'Configurações', form: 'config',
      corpo: `<div class="form-grade">
        <div class="sep-form" style="margin-top:0;padding-top:0;border:0">Alertas</div>
        ${campo('Avisar com antecedência de (dias)', `<input id="cf-dias" name="dias" inputmode="numeric" value="${cfg.alertaDias ?? 30}">`, 'meia')}
        ${campo('ou de (horas)', `<input id="cf-horas" name="horas" inputmode="decimal" value="${R.fmtH(cfg.alertaHoras ?? 25)}">`, 'meia')}
        <p class="dica" style="grid-column:1/-1;margin:-4px 0 0;font-size:12.5px;color:var(--tinta-3)">Para itens de intervalo curto (30 dias, 50 h) o alerta usa no máximo 25% do intervalo, para não ficar sempre amarelo.</p>
        <div class="sep-form">Backup</div>
        <div class="campo c6"><span class="dica">Os dados ficam no servidor, com acesso só para usuários autorizados. O backup baixa uma cópia de tudo; importar um backup substitui todos os dados do servidor.</span>
          <div class="opcoes-radio" style="gap:6px;margin-top:4px">
            <button type="button" class="botao pequeno" data-acao="exportarBackup">${ic('baixar')}Exportar backup</button>
            <label class="botao pequeno" style="cursor:pointer">${ic('subir')}Importar backup<input type="file" accept=".json,application/json" data-acao-arquivo="importarBackup" hidden></label>
          </div></div>
      </div>`,
      rodape: `<button type="button" class="botao" data-acao="fecharDialogo">Fechar</button><button type="submit" class="botao primario">${ic('ok')}Salvar alertas</button>`
    }), 'estreito');
    const arq = document.querySelector('[data-acao-arquivo="importarBackup"]');
    arq.addEventListener('change', async () => {
      const file = arq.files[0]; if (!file) return;
      const ok = await U.confirmar({ titulo: 'Importar backup?', texto: 'TODOS os dados do servidor (aeronaves, itens, horas e histórico) serão substituídos pelos do arquivo, para todos os usuários.', botao: 'Importar', perigo: true });
      if (!ok) return;
      try { await D.backup.importar(await file.text()); U.fecharDialogo(); U.aviso('Backup importado.'); location.hash = '#/painel'; await AC.redesenhar(); }
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
    abrirRef, usarHoje: () => definirRef(null),
    config,
    exportarBackup: async () => { U.baixar(`aerocontrol-backup-${R.hojeISO()}.json`, await D.backup.exportar(), 'application/json'); U.aviso('Backup exportado.'); }
  });
})();

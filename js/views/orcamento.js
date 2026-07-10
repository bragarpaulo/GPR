// views/orcamento.js — Orçamento de Despesas (grade editável) + metas derivadas.
import { getState, setOrcamento, isAggregated } from '../store.js';
import { GRUPOS } from '../config.js';
import { calcOrcamento } from '../calc.js';
import { pageHead, thMeses, moneyInput, exportToolbar, wireExport, collapseAllBtn, wireCollapse } from '../ui.js';
import { esc, num, fmtBRL0, anoAtivo } from '../util.js';

const GTITULO = Object.fromEntries(GRUPOS.map(g => [g.id, g.titulo.replace('(-) Total', 'Orçado').replace('(-)', 'Orçado')]));

// key: identificador da linha derivada (p/ atualizar in-place sem re-render). As células ganham
// data-dcell="<key>:<mesIdx>" e o total data-dcell="<key>:tot".
function linhaDerivada(label, arr, cls, { attrs = '', caret = false, key = '' } = {}) {
  const cells = arr.map((v, i) => `<td class="num" ${key ? `data-dcell="${key}:${i}"` : ''}>${fmtBRL0(v)}</td>`).join('');
  const tot = arr.reduce((a, b) => a + b, 0);
  const lbl = caret ? `<span class="grp-caret">▾</span> ${esc(label)}` : esc(label);
  return `<tr class="${cls}" ${attrs}><td>${lbl}</td>${cells}<td class="num" ${key ? `data-dcell="${key}:tot"` : ''}><strong>${fmtBRL0(tot)}</strong></td></tr>`;
}
// Mapa de todas as linhas derivadas → array mensal do calcOrcamento (p/ o update in-place).
function derivadasDe(o) {
  return {
    metaReceita: o.metaReceita,
    receitaLiquida: o.receitaLiquida, lucroBruto: o.lucroBruto, ebitda: o.ebitda, lucroAntesIR: o.lucroAntesIR, lucroLiquido: o.lucroLiquido,
    'grp:deducoes': o.grupos.deducoes, 'grp:custos': o.grupos.custos, 'grp:operacionais': o.grupos.operacionais, 'grp:financeiro': o.grupos.financeiro, 'grp:impostos_ir': o.grupos.impostos_ir,
  };
}

export function render(container) {
  const s = getState();
  const ano = anoAtivo(s);
  const o = calcOrcamento(s);
  const ro = isAggregated();   // consolidado: orçamento somado, só-leitura (edição é por empresa)

  const catRow = (cat, gid) => {
    const arr = o.orc(cat.id);
    const cells = arr.map((v, i) => `<td class="num">${ro ? fmtBRL0(v) : moneyInput(v, `data-cat-id="${cat.id}" data-mes="${i}"`, 110)}</td>`).join('');
    const tot = arr.reduce((a, b) => a + b, 0);
    return `<tr class="cat-row" data-grpcat="${gid}"><td>${esc(cat.nome)}</td>${cells}<td class="num" data-cattot="${cat.id}">${fmtBRL0(tot)}</td></tr>`;
  };

  const grupo = (gid) => {
    let h = linhaDerivada(GTITULO[gid], o.grupos[gid], 'grp-row', { attrs: `data-grp="${gid}"`, caret: true, key: `grp:${gid}` });
    for (const cat of s.categorias.filter(c => c.grupo === gid)) h += catRow(cat, gid);
    return h;
  };

  const body = [
    linhaDerivada('Meta de Receita', o.metaReceita, 'row-total', { key: 'metaReceita' }),
    grupo('deducoes'),
    linhaDerivada('(=) Meta de Receita Líquida', o.receitaLiquida, 'row-total', { key: 'receitaLiquida' }),
    grupo('custos'),
    linhaDerivada('(=) Meta de Lucro Bruto', o.lucroBruto, 'row-total', { key: 'lucroBruto' }),
    grupo('operacionais'),
    linhaDerivada('(=) Meta de Lucro Operacional (EBITDA)', o.ebitda, 'row-total', { key: 'ebitda' }),
    grupo('financeiro'),
    linhaDerivada('(=) Meta de Lucro Antes do IR', o.lucroAntesIR, 'row-total', { key: 'lucroAntesIR' }),
    grupo('impostos_ir'),
    linhaDerivada('(=) Meta de Lucro Líquido', o.lucroLiquido, 'row-total', { key: 'lucroLiquido' }),
  ].join('');

  container.innerHTML = `
    ${pageHead('Orçamento de Despesas', `Planejamento de ${ano} · Meta de Receita vem dos canais (Cadastro).`)}
    ${exportToolbar(collapseAllBtn())}
    <div class="callout">${ro ? '👁 <strong>Consolidado:</strong> somatório dos orçamentos das empresas selecionadas — somente leitura. Selecione 1 empresa no topo para editar.' : 'Edite os valores por categoria. Os grupos e metas são calculados automaticamente. Cada ano tem seu próprio orçamento.'}</div>
    <div class="table-wrap tbl-wide" style="margin-top:14px">
      <table>
        <thead><tr><th style="min-width:260px">Grupo / Categoria</th>${thMeses(ano)}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;

  if (!ro) container.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!t.dataset.catId || t.dataset.mes === undefined) return;
    // Salva SILENCIOSO (sem re-render → não perde o scroll horizontal) e atualiza só as linhas
    // derivadas + o total da categoria in-place (padrão do vendas/despesas).
    setOrcamento(ano, t.dataset.catId, Number(t.dataset.mes), num(t.value), { silent: true });
    atualizarDerivadas(container, getState(), t.dataset.catId);
  });
  wireCollapse(container);
  wireExport(container, 'Orcamento', { modo: 'tabela' });
}

// Recalcula o orçamento e atualiza no DOM apenas as células derivadas (grupos + metas + totais).
function atualizarDerivadas(container, s, catIdEditada) {
  const o = calcOrcamento(s);
  const derivadas = derivadasDe(o);
  for (const [key, arr] of Object.entries(derivadas)) {
    let tot = 0;
    arr.forEach((v, i) => { tot += v; const el = container.querySelector(`[data-dcell="${key}:${i}"]`); if (el) el.textContent = fmtBRL0(v); });
    const elTot = container.querySelector(`[data-dcell="${key}:tot"]`); if (elTot) elTot.innerHTML = `<strong>${fmtBRL0(tot)}</strong>`;
  }
  if (catIdEditada) { const arr = o.orc(catIdEditada); const elCat = container.querySelector(`[data-cattot="${catIdEditada}"]`); if (elCat) elCat.textContent = fmtBRL0(arr.reduce((a, b) => a + b, 0)); }
}

// views/dashboard.js — Dashboard GPR (KPIs + Caixa do Mês + Provisões + gráficos/drilldown).
import {
  getState, setPeriodoMeses, setUiCampo, setDespesasFiltro, setVendasFiltro,
  getAnos, getAnoAtivo, setAnoAtivo,
} from '../store.js';
import { calcDashboard } from '../calc.js';
import { pageHead, kpi, kpi2, mesesChips, seg } from '../ui.js';
import { fmtBRL0, fmtPct, esc } from '../util.js';
import * as charts from '../charts.js';

// --- Seleção de meses por clique (1 mês) ou arrastar (intervalo) ---
let _mesAnchor = null, _mesHover = null;
function rangeArr(a, b) { const lo = Math.min(a, b), hi = Math.max(a, b), r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; }
function highlightMeses(a, b) {
  const set = new Set(rangeArr(a, b));
  document.querySelectorAll('.chips [data-mes]').forEach(c => {
    if (c.dataset.mes === 'all') c.classList.remove('active');
    else c.classList.toggle('active', set.has(Number(c.dataset.mes)));
  });
}
document.addEventListener('mouseup', () => {
  if (_mesAnchor === null) return;
  const r = rangeArr(_mesAnchor, _mesHover ?? _mesAnchor);
  _mesAnchor = null; _mesHover = null;
  setPeriodoMeses(r);
});

function resumo(pairs) {
  return `<div class="chart-summary">` + pairs.map(([l, v, cls]) => `<span><b class="${cls || ''}">${v}</b>${esc(l)}</span>`).join('') + `</div>`;
}

function widget(titulo, view, data, segName, drillAttr) {
  const seguidor = seg(segName, [{ val: 'pizza', label: 'Pizza' }, { val: 'barras', label: 'Barras' }, { val: 'tabela', label: 'Tabela' }], view);
  let body;
  if (view === 'tabela') {
    const rows = data.map(d => `<tr class="row-click" ${drillAttr}="${d.id}">
      <td>${esc(d.label)}</td><td class="num">${fmtBRL0(d.valor)}</td><td class="num">${fmtPct(d.pct)}</td>
      <td style="width:110px"><div class="bar"><span style="width:${Math.min(100, d.pct * 100)}%"></span></div></td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>`;
    body = `<div class="table-wrap" style="box-shadow:none"><table>
      <thead><tr><th>Item</th><th class="num sortable" data-sort="${segName}">Valor ▼</th><th class="num">% Total</th><th>Part.</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  } else { body = `<div class="chart-canvas-wrap"><canvas id="cv-${segName}"></canvas></div>`; }
  return `<div class="card chart-box"><h3>${esc(titulo)} ${seguidor}</h3>${body}</div>`;
}

export function render(container) {
  const s = getState();
  const d = calcDashboard(s);
  const anos = getAnos();
  const catView = s.ui.dashCatView, canalView = s.ui.dashCanalView;
  const sortDir = (dir, arr) => dir === 'asc' ? [...arr].sort((a, b) => a.valor - b.valor) : arr;
  const catData = sortDir(s.ui.dashCatSort, d.catDespesas).map(c => ({ id: c.id, label: c.cat, valor: c.valor, pct: c.pct }));
  const canalData = sortDir(s.ui.dashCanalSort, d.canalTot).map(c => ({ id: c.id, label: c.canal, valor: c.valor, pct: c.pct }));
  const margem = d.receita ? d.lucro / d.receita : '';

  const anoSel = anos.length > 1
    ? `<label class="hint">Ano:</label><select id="dash-ano">${anos.map(a => `<option value="${a}" ${a === getAnoAtivo() ? 'selected' : ''}>${a}</option>`).join('')}</select>`
    : '';

  container.innerHTML = `
    ${pageHead('Dashboard', `Visão geral — ${d.periodoLabel}`)}
    <div class="toolbar">${anoSel}${mesesChips(s)}</div>
    <div class="hint" style="margin:-6px 0 12px">Dica: clique num mês ou <strong>arraste</strong> sobre os meses para um período.</div>

    <div class="grid kpis">
      ${kpi('Receita (Entradas)', fmtBRL0(d.receita), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('Recebido à vista', fmtBRL0(d.aVista), { variant: 'k-blue', route: 'vendas' })}
      ${kpi('Vendido a prazo', fmtBRL0(d.aPrazo), { variant: 'k-purple', route: 'vendas' })}
      ${kpi('Despesa', fmtBRL0(d.despesaTotal), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('Lucro Líquido', fmtBRL0(d.lucro), { variant: d.lucro >= 0 ? 'k-green' : 'k-red', cls: d.lucro >= 0 ? 'green' : 'red', route: 'dre' })}
    </div>

    <div class="section-title">Caixa do Mês</div>
    <div class="grid kpis">
      ${kpi('Saldo atual', fmtBRL0(d.saldoAtual), { variant: 'k-blue', cls: 'blue', route: 'fluxo' })}
      ${kpi('Recebimentos', fmtBRL0(d.recebimentos), { variant: 'k-green', cls: 'green', route: 'vendas' })}
      ${kpi('Pagamentos', fmtBRL0(d.pagamentos), { variant: 'k-red', cls: 'red', route: 'despesas' })}
      ${kpi('Caixa Gerado', fmtBRL0(d.geracaoCaixa), { variant: d.geracaoCaixa >= 0 ? 'k-green' : 'k-red', cls: d.geracaoCaixa >= 0 ? 'green' : 'red', route: 'fluxo' })}
    </div>

    <div class="section-title">Provisões</div>
    <div class="grid kpis">
      ${kpi2('Saldo Provisionado', [['Mês atual', fmtBRL0(d.saldoProvMes)], ['Próximos meses', fmtBRL0(d.saldoProvProx)]], { variant: 'k-purple', route: 'fluxo' })}
      ${kpi2('Contas a Receber', [['Mês atual', fmtBRL0(d.contasReceberMes)], ['Próximos meses', fmtBRL0(d.contasReceberProx)]], { variant: 'k-blue', route: 'fluxo' })}
      ${kpi2('Contas a Pagar', [['Mês atual', fmtBRL0(d.contasPagarMes)], ['Total', fmtBRL0(d.contasPagarTotal)]], { variant: 'k-red', route: 'fluxo' })}
      ${kpi('Inadimplência', fmtBRL0(d.inadimplencia), { variant: 'k-orange', cls: d.inadimplencia > 0 ? 'red' : '', route: 'vendas' })}
    </div>

    <div class="section-title">Gráficos</div>
    ${charts.chartOk() ? '' : '<div class="callout warn">Gráficos indisponíveis (Chart.js não carregou). Os números continuam corretos.</div>'}
    <div class="card chart-box">
      <h3>Receita × Despesa × Lucro (ano)<span class="total-anual">Total Anual<b>${fmtBRL0(d.totalAnualReceita)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recdesp"></canvas></div>
      ${resumo([[' Receita', fmtBRL0(d.receita), 'pos'], [' Despesa', fmtBRL0(d.despesaTotal), 'neg'], [' Lucro', fmtBRL0(d.lucro), d.lucro >= 0 ? 'pos' : 'neg'], [' Margem', margem === '' ? '—' : fmtPct(margem)]])}
    </div>
    <div class="card chart-box" style="margin-top:14px">
      <h3>Recebimentos × Pagamentos × Geração de Caixa (ano)<span class="total-anual">Geração no ano<b>${fmtBRL0(d.totalAnualGeracao)}</b></span></h3>
      <div class="chart-canvas-wrap"><canvas id="ch-recpag"></canvas></div>
      ${resumo([[' Recebimentos', fmtBRL0(d.recebimentos), 'pos'], [' Pagamentos', fmtBRL0(d.pagamentos), 'neg'], [' Geração', fmtBRL0(d.geracaoCaixa), d.geracaoCaixa >= 0 ? 'pos' : 'neg']])}
    </div>
    <div class="grid charts-grid" style="margin-top:14px">
      ${widget(`Faturamento por canal (${d.periodoLabel})`, canalView, canalData, 'canal', 'data-canal')}
      ${widget(`Despesas por categoria — competência (${d.periodoLabel})`, catView, catData, 'cat', 'data-cat')}
    </div>
    <p class="hint" style="margin-top:8px">💡 Clique nos indicadores e nos gráficos para abrir o detalhe (drilldown).</p>`;

  charts.receitaDespesa('ch-recdesp', d.serieMeses, d.serieReceita, d.serieDespesa, d.serieLucro, (i) => setPeriodoMeses([i]));
  charts.recebPag('ch-recpag', d.serieMeses, d.serieRecebimentos, d.seriePagamentos, d.serieGeracaoCaixa, (i) => setPeriodoMeses([i]));
  if (canalView === 'pizza') charts.pizza('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]));
  else if (canalView === 'barras') charts.barras('cv-canal', canalData.map(c => c.label), canalData.map(c => c.valor), (i) => drillCanal(canalData[i]), true);
  if (catView === 'pizza') charts.pizza('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]));
  else if (catView === 'barras') charts.barras('cv-cat', catData.map(c => c.label), catData.map(c => c.valor), (i) => drillCat(catData[i]), true);

  wire(container);
}

function drillCat(c) { if (!c) return; setDespesasFiltro({ categoria: c.id }); location.hash = '#despesas'; }
function drillCanal(c) { if (!c) return; setVendasFiltro({ canal: c.id }); location.hash = '#vendas'; }

function wire(container) {
  // Seleção de meses (clique = 1 mês; arrastar = intervalo)
  container.addEventListener('mousedown', (e) => {
    const chip = e.target.closest('[data-mes]'); if (!chip) return;
    if (chip.dataset.mes === 'all') { setPeriodoMeses([]); return; }
    e.preventDefault();
    _mesAnchor = Number(chip.dataset.mes); _mesHover = _mesAnchor;
    highlightMeses(_mesAnchor, _mesHover);
  });
  container.addEventListener('mouseover', (e) => {
    if (_mesAnchor === null) return;
    const chip = e.target.closest('[data-mes]'); if (!chip || chip.dataset.mes === 'all') return;
    _mesHover = Number(chip.dataset.mes); highlightMeses(_mesAnchor, _mesHover);
  });

  container.addEventListener('change', (e) => {
    if (e.target.id === 'dash-ano') setAnoAtivo(e.target.value);
  });

  container.addEventListener('click', (ev) => {
    const segBtn = ev.target.closest('.seg button');
    if (segBtn) { setUiCampo(segBtn.closest('.seg').dataset.seg === 'cat' ? 'dashCatView' : 'dashCanalView', segBtn.dataset.segVal); return; }
    const sortTh = ev.target.closest('[data-sort]');
    if (sortTh) { const w = sortTh.dataset.sort === 'cat' ? 'dashCatSort' : 'dashCanalSort'; setUiCampo(w, getState().ui[w] === 'asc' ? 'desc' : 'asc'); return; }
    const goto = ev.target.closest('[data-goto]');
    if (goto) { location.hash = '#' + goto.dataset.goto; return; }
    const catRow = ev.target.closest('[data-cat]');
    if (catRow) { setDespesasFiltro({ categoria: catRow.dataset.cat }); location.hash = '#despesas'; return; }
    const canalRow = ev.target.closest('[data-canal]');
    if (canalRow) { setVendasFiltro({ canal: canalRow.dataset.canal }); location.hash = '#vendas'; return; }
  });
}

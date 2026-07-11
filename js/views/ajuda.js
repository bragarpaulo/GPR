// views/ajuda.js — Central de Ajuda: manual do sistema (tela por tela, ilustrado) + envio de sugestão.
// Carregada sob demanda (lazy) pelo app.js. Conteúdo fiel ao comportamento implementado.
import { pageHead } from '../ui.js';
import { esc } from '../util.js';
import * as cloud from '../cloud.js';

// --- pequenas ilustrações reutilizáveis (usam o design system do GPR) ---
const pill = (txt, cls) => `<span class="help-pill ${cls}">${txt}</span>`;
const statusVenda = `<div class="help-illus help-pills">${pill('✅ Pago', 'ok')}${pill('🟡 Vence hoje', 'warn')}${pill('🔵 À pagar', 'info')}${pill('🔴 Atrasado', 'bad')}</div>`;
const miniKpis = (arr) => `<div class="help-illus help-kpis">${arr.map(([l, v]) => `<div class="help-kpi"><div class="help-kpi-l">${l}</div><div class="help-kpi-v">${v}</div></div>`).join('')}</div>`;
const dica = (h) => `<div class="help-box help-dica">💡 <span>${h}</span></div>`;
const regra = (h) => `<div class="help-box help-regra">📐 <span>${h}</span></div>`;
const atencao = (h) => `<div class="help-box help-atencao">⚠️ <span>${h}</span></div>`;
const passos = (arr) => `<ol class="help-passos">${arr.map(p => `<li>${p}</li>`).join('')}</ol>`;

// --- as seções do manual (id p/ o sumário, ícone, título e corpo HTML) ---
const SECOES = [
  { id: 'inicio-uso', ico: '🚀', tit: 'Começando', html: `
    <p>O GPR guarda seus dados <b>na nuvem</b>, ligados à sua conta — acesse de qualquer navegador com e-mail e senha.</p>
    ${passos([
      '<b>Crie sua conta</b> (e-mail + senha de 6+ caracteres) ou entre. Esqueceu a senha? Use "Esqueci a senha".',
      'Aceite os <b>Termos de Uso</b> no primeiro acesso.',
      'Complete seu perfil (nome, setor, Instagram) para personalizar.',
      'Cadastre sua empresa, contas e categorias em <b>Configurações</b> — ou <b>importe uma planilha</b> pronta.',
    ])}
    ${dica('Sem assinatura ativa, o app abre em <b>modo demonstração</b> (dados de exemplo, só leitura) para você explorar tudo antes.')}` },

  { id: 'conceitos', ico: '🧠', tit: 'O conceito-chave: competência × caixa', html: `
    <p>Quase tudo no GPR gira em torno de <b>duas visões do mesmo dinheiro</b>:</p>
    <div class="help-illus help-duo">
      <div class="help-duo-card"><div class="help-duo-h">📅 Competência</div><div>Quando o fato <b>aconteceu</b> — a venda foi feita, a despesa "pesa" no mês. Base da <b>DRE</b>, metas e orçamento.</div></div>
      <div class="help-duo-card"><div class="help-duo-h">💵 Caixa</div><div>Quando o dinheiro <b>entrou ou saiu</b> de fato. Base da <b>DFC</b> e do <b>Fluxo de Caixa</b>.</div></div>
    </div>
    <p>Toda venda e toda despesa tem um <b>status automático</b> conforme as datas:</p>
    ${statusVenda}
    ${regra('<b>Pago</b> = a data real (Recebimento / "Pago em") foi preenchida. Senão, o status vem do <b>vencimento</b>: futuro → À pagar; hoje → Vence Hoje; passado → Atrasado.')}
    ${regra('<b>Competência não conta o futuro:</b> no ano corrente, sem escolher mês, receita/despesa/lucro/metas somam só <b>até o mês atual</b> — provisões futuras não inflam o resultado. Quer ver o futuro? Selecione o mês na barra do topo.')}` },

  { id: 'tela', ico: '🧭', tit: 'A tela: topo, período e menu', html: `
    <p><b>Topo — empresas:</b> clique no nome para trocar de empresa. Marque <b>2+</b> para a <b>visão consolidada</b> (soma tudo, só leitura). Ao lado: ⚙️ configurar empresa e 🌙/☀️ tema.</p>
    <p><b>Barra de período (Ano e Mês):</b> vale para a tela inteira.</p>
    ${passos([
      '<b>Mês:</b> clique = só aquele mês · Ctrl/⌘+clique = vários · arraste = intervalo · "Todos" = ano inteiro.',
      '<b>Ano:</b> em Início e Dashboard dá pra marcar vários anos (somam). Nas demais telas, clicar troca o ano.',
    ])}
    ${dica('<b>Drilldown:</b> quase todo número/gráfico é clicável e leva à tela de origem, muitas vezes já filtrado. O 👁 nos gráficos mostra/oculta os valores; o ⬇ baixa o gráfico em PNG.')}` },

  { id: 'inicio', ico: '🏠', tit: 'Início — o resumo do dia', html: `
    <p>Sua fotografia financeira de relance:</p>
    ${miniKpis([['Saldo em caixa', 'R$ ••'], ['A receber', 'R$ ••'], ['A pagar', 'R$ ••'], ['Lucro do mês', 'R$ ••']])}
    <ul class="help-ul">
      <li><b>Saldo atual</b> + variação vs. mês anterior + minigráfico + medidor da meta de receita.</li>
      <li><b>Ações de hoje:</b> recebimentos e contas atrasados / vencendo hoje (clique para ir à lista).</li>
      <li><b>Previsão:</b> saldo previsto, a receber, a pagar e lucro projetado do ano, com uma frase de ritmo.</li>
      <li><b>Atalhos:</b> lançar venda, lançar despesa, Dashboard e Fluxo.</li>
    </ul>` },

  { id: 'dashboard', ico: '📊', tit: 'Dashboard', html: `
    <p>Visão geral do período. Dois blocos de indicadores:</p>
    <p><b>Econômico (competência):</b> Receita (faturamento), Recebido à vista, Vendido a prazo, Despesa e <b>Lucro Líquido</b> (resultado da DRE).</p>
    <p><b>Caixa & Provisões:</b> Saldo, Recebimentos, Pagamentos, Caixa Gerado; e Saldo Provisionado, Contas a Receber (só a vencer), Contas a Pagar (inclui vencidas) e Inadimplência.</p>
    ${regra('Venda <b>vencida e não recebida</b> NÃO entra em "Contas a Receber" — ela vira <b>Inadimplência</b> (indicador próprio). Já conta a pagar vencida <b>continua devida</b>.')}
    <p>Gráficos de Receita×Despesa×Lucro e de Lucro mês a mês; e os widgets <b>Faturamento por canal</b> e <b>Despesas por categoria</b>, que alternam entre <b>Pizza / Barras / Tabela</b> e são clicáveis.</p>` },

  { id: 'vendas', ico: '🛒', tit: 'Lançamento de Vendas', html: `
    <p>Uma linha por venda. As datas definem tudo:</p>
    ${regra('<b>Data da Venda</b> → mês de competência (aparece na DRE). <b>Vencimento</b> → mês previsto de recebimento. <b>Data Recebimento</b> preenchida → status vira <b>Pago</b> e entra no caixa (DFC/Fluxo).')}
    ${passos([
      '<b>+ Adicionar linha</b> anexa no fim e foca o cursor — a linha não muda de lugar enquanto você digita.',
      'Produto e Cliente têm <b>autocompletar</b>; nomes novos são cadastrados sozinhos.',
      '<b>⧉</b> duplica, <b>🗑</b> exclui. Caixas de seleção + "Excluir selecionadas" removem várias.',
      '<b>Chips de status</b> no topo, <b>busca</b> ao vivo e <b>▾</b> em cada coluna filtram os lançamentos.',
    ])}
    <p><b>Recorrência (🔁):</b> com a data preenchida, clique no 🔁, escolha a periodicidade (Mensal a Anual) e a data final — o app gera as repetições sozinho. Ao excluir uma recorrente, ele pergunta <b>"só esta"</b> ou <b>"esta e as próximas"</b>.</p>` },

  { id: 'despesas', ico: '🧾', tit: 'Lançamento de Despesas', html: `
    <p>Mesma mecânica das Vendas (linha fixa ao editar, chips, busca, filtros, recorrência 🔁, excluir em lote). A diferença são as datas:</p>
    ${regra('<b>Mês Competência</b> (selecionável, pode diferir do vencimento) → manda na DRE e no Orçado×Realizado. <b>"Pago em"</b> → status Pago + DFC/Fluxo. <b>Vencimento</b> → previsões (a pagar, aging, projeção).')}
    <p>Tem também Forma de Pagamento (PIX, Boleto, Cartão…), Recebedor (autocompletar) e Conta de saída.</p>` },

  { id: 'dre-dfc', ico: '📑', tit: 'DRE e DFC (anuais)', html: `
    <p>Os dois demonstrativos, 12 meses + Total, montados sozinhos a partir dos lançamentos — com a mesma estrutura de grupos:</p>
    <div class="help-illus help-duo">
      <div class="help-duo-card"><div class="help-duo-h">DRE — competência</div><div>Entradas pela <b>data da venda</b>; despesas pelo <b>Mês Competência</b>. Mostra o resultado <b>econômico</b> (Receita Líquida → Lucro Bruto → EBITDA → Lucro Líquido).</div></div>
      <div class="help-duo-card"><div class="help-duo-h">DFC — caixa</div><div>Só o que <b>entrou/saiu</b>: vendas <b>pagas</b> (mês do vencimento) e despesas <b>pagas</b> (mês do "Pago em").</div></div>
    </div>
    ${dica('Você pode <b>renomear categorias direto na DRE/DFC</b> (o cálculo não quebra — o vínculo é interno), recolher grupos e <b>exportar em PDF</b>.')}` },

  { id: 'fluxo', ico: '💧', tit: 'Fluxo de Caixa', html: `
    <p>A tela mais completa de caixa, de cima para baixo:</p>
    <ul class="help-ul">
      <li><b>Saldo atual</b> + variação + gráfico de saldo e geração de caixa.</li>
      <li><b>KPIs</b> de caixa e provisões (iguais aos do Dashboard).</li>
      <li><b>Projeção 30 dias</b> — dia a dia, partindo do caixa de hoje.</li>
      <li><b>Aging</b> — a receber e a pagar por prazo (Atrasado, Hoje, D+1…D+30, outros meses).</li>
      <li><b>Fluxo mensal do ano</b> (realizado + previsto) e <b>distribuição por conta</b>.</li>
      <li><b>Contas a receber atrasadas</b> por canal e <b>Realizado no mês</b> (o que entrou/saiu de fato).</li>
      <li><b>Anexo: plataformas</b> — listas editáveis de valores disponíveis para saque e a receber.</li>
    </ul>` },

  { id: 'metas', ico: '🎯', tit: 'Metas, Meta×Realizado e Orçado×Realizado', html: `
    <p><b>Controle de Metas:</b> três medidores (Receita, Lucro Líquido, Orçamento de Despesas) + tabela por canal com % atingido e <b>projeção do ano</b> (ritmo dos meses decorridos × 12).</p>
    <p><b>Meta de Receita × Realizado:</b> gráfico meta×realizado com atingimento acumulado, resumo por canal e a participação de cada <b>produto</b> e <b>cliente</b> na receita.</p>
    <p><b>Orçado × Realizado (despesas):</b> compara o orçamento com o gasto real (competência), por grupo e categoria — verde = dentro, vermelho = estourou.</p>
    ${regra('Status de meta: 🟢 ≥ 100% · 🟡 80–99% · 🔴 < 80% · ⚪ sem meta.')}` },

  { id: 'orcamento', ico: '🗓️', tit: 'Orçamento de Despesas', html: `
    <p>Grade <b>editável</b> de planejamento do ano — cada ano tem o seu. Digite o <b>orçado por categoria e por mês</b>; os totais e as linhas de meta recalculam na hora.</p>
    <p>A grade espelha a DRE (Meta de Receita → Deduções → Custos → Operacionais → … → <b>Meta de Lucro Líquido</b>) e alimenta o Controle de Metas e o Orçado×Realizado.</p>
    ${dica('A <b>Meta de Receita</b> (1ª linha) vem das metas dos canais nas Configurações — não se edita aqui.')}` },

  { id: 'config', ico: '⚙️', tit: 'Configurações', html: `
    <p>Tudo aqui é <b>por empresa</b>:</p>
    <ul class="help-ul">
      <li><b>Empresa & Anos</b> — nome, CNPJ; cada ano tem lançamentos/metas/orçamento próprios (dá para copiar de um ano ao criar outro).</li>
      <li><b>Contas correntes</b> — saldo + data-base ancoram o Fluxo de Caixa.</li>
      <li><b>Canais de venda & meta</b> — meta mês a mês por canal.</li>
      <li><b>Categorias</b> — nos 5 grupos da DRE; renomear e reordenar (⠿) é seguro.</li>
      <li><b>Clientes / Produtos / Recebedores</b> — alimentam o autocompletar.</li>
      <li><b>Importar planilha</b> — cria uma empresa nova a partir de um Excel. <b>Backup</b> — exporta/restaura todos os dados.</li>
      <li><b>Conta e dispositivo</b> — "Sair e limpar dispositivo" (máquina compartilhada) e "Limpar tudo".</li>
    </ul>` },
];

const sumario = `<div class="help-sumario">${SECOES.map(s => `<a href="#ajuda" data-goto-sec="${s.id}"><span>${s.ico}</span> ${esc(s.tit)}</a>`).join('')}</div>`;
const secaoHtml = (s) => `<details class="help-sec" id="sec-${s.id}" open><summary><span class="help-sec-ico">${s.ico}</span> ${esc(s.tit)}</summary><div class="help-sec-body">${s.html}</div></details>`;

const TIPOS = [
  { v: 'sugestao', t: '💡 Sugestão' },
  { v: 'melhoria', t: '⬆️ Melhoria' },
  { v: 'problema', t: '🐞 Problema / bug' },
  { v: 'duvida', t: '❓ Dúvida' },
];
const stTxt = { novo: 'Enviado', lido: 'Lido', resolvido: 'Resolvido' };

function manualHtml() {
  return `<div class="help-intro card card-pad">
      <div class="help-intro-h">📖 Manual do GPR</div>
      <p class="hint">Como funciona cada tela, passo a passo. Clique num item para pular; cada seção abre e fecha.</p>
      ${sumario}
    </div>
    ${SECOES.map(secaoHtml).join('')}`;
}
function feedbackHtml() {
  const opts = TIPOS.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
  const telas = ['(geral)', 'Início', 'Dashboard', 'Vendas', 'Despesas', 'DRE', 'DFC', 'Fluxo de Caixa', 'Metas', 'Orçamento', 'Configurações'];
  return `<div class="card card-pad" style="max-width:640px">
      <div class="help-intro-h">💬 Sua sugestão ajuda a melhorar o GPR</div>
      <p class="hint" style="margin-bottom:14px">Encontrou um problema? Tem uma ideia? Manda pra gente — a gente lê tudo.</p>
      <label class="cfg-field">Tipo <select id="fb-tipo">${opts}</select></label>
      <label class="cfg-field" style="margin-top:10px">Sobre qual tela? <select id="fb-tela">${telas.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label class="cfg-field" style="margin-top:10px">Sua mensagem
        <textarea id="fb-msg" rows="5" placeholder="Escreva aqui sua sugestão, melhoria ou o problema que encontrou…" style="resize:vertical"></textarea></label>
      <div class="toolbar" style="gap:8px;margin-top:12px"><button class="btn btn-primary" id="fb-enviar">Enviar</button><span id="fb-out" class="hint"></span></div>
    </div>
    <div class="card card-pad" style="max-width:640px;margin-top:14px">
      <div class="ig-sub">Suas mensagens enviadas</div>
      <div id="fb-lista"><div class="hint">carregando…</div></div>
    </div>`;
}

export function render(container) {
  container.innerHTML = `
    ${pageHead('Central de Ajuda', 'Manual do sistema e canal de sugestões')}
    <div class="seg help-tabs" style="margin-bottom:14px">
      <button class="active" data-tab="manual">📖 Manual</button>
      <button data-tab="feedback">💬 Enviar sugestão</button>
    </div>
    <div id="ajuda-body">${manualHtml()}</div>`;

  const body = container.querySelector('#ajuda-body');
  container.querySelectorAll('.help-tabs button').forEach(b => b.onclick = () => {
    container.querySelectorAll('.help-tabs button').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.tab === 'manual') { body.innerHTML = manualHtml(); wireManual(container); }
    else { body.innerHTML = feedbackHtml(); wireFeedback(container); }
  });
  wireManual(container);
}

function wireManual(container) {
  container.querySelectorAll('[data-goto-sec]').forEach(a => a.onclick = (e) => {
    e.preventDefault();
    const s = container.querySelector('#sec-' + a.dataset.gotoSec);
    if (s) { s.open = true; s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}

async function wireFeedback(container) {
  const out = container.querySelector('#fb-out');
  container.querySelector('#fb-enviar').onclick = async () => {
    const tipo = container.querySelector('#fb-tipo').value;
    const tela = container.querySelector('#fb-tela').value;
    const msg = container.querySelector('#fb-msg').value.trim();
    if (msg.length < 3) { out.textContent = 'Escreva sua mensagem antes de enviar.'; return; }
    const btn = container.querySelector('#fb-enviar'); btn.disabled = true; out.textContent = 'Enviando…';
    const r = await cloud.enviarFeedback(tipo, msg, tela === '(geral)' ? '' : tela);
    btn.disabled = false;
    if (r && r.ok) { out.textContent = '✅ Obrigado! Recebemos sua mensagem.'; container.querySelector('#fb-msg').value = ''; carregarLista(container); }
    else { out.textContent = 'Erro ao enviar: ' + ((r && r.error) || 'tente de novo.'); }
  };
  carregarLista(container);
}

async function carregarLista(container) {
  const el = container.querySelector('#fb-lista'); if (!el) return;
  const lista = await cloud.meusFeedbacks();
  if (!lista.length) { el.innerHTML = '<div class="hint">Você ainda não enviou nenhuma mensagem.</div>'; return; }
  const tt = { sugestao: '💡', melhoria: '⬆️', problema: '🐞', duvida: '❓' };
  el.innerHTML = lista.map(f => {
    const d = String(f.created_at || '').slice(0, 10).split('-').reverse().join('/');
    return `<div class="help-fb-item"><div class="help-fb-top">${tt[f.tipo] || '💬'} <b>${esc(f.tela || 'Geral')}</b> <span class="hint">· ${d}</span> <span class="help-fb-status s-${esc(f.status)}">${stTxt[f.status] || f.status}</span></div><div>${esc(f.mensagem)}</div></div>`;
  }).join('');
}

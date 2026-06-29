// views/admin.js — GPR Core: tela principal com métricas + CARDS; cada card abre um POPUP
// (Usuários e Planos com busca + paginação). Só admins chegam aqui (gate no app.js + RLS no banco).
import { pageHead } from '../ui.js';
import { esc } from '../util.js';
import * as cloud from '../cloud.js';

const WA_URL = 'https://qdioqeejcneijctotyft.supabase.co/functions/v1/whatsapp-webhook';
const GREEN_URL = 'https://qdioqeejcneijctotyft.supabase.co/functions/v1/green-webhook';
const kpiBox = (l, v) => `<div class="card kpi k-blue"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`;
const flash = (b, ok) => { const t = b.dataset._t || (b.dataset._t = b.textContent); b.textContent = ok ? '✓ Salvo' : 'Erro'; setTimeout(() => b.textContent = t, 1500); };

const CARDS = [
  { k: 'usuarios', ico: '👥', t: 'Usuários & assinaturas', d: 'Buscar, paginar e atribuir plano/status' },
  { k: 'planos', ico: '💳', t: 'Planos', d: 'Limites, preço, oferta Green e nicho' },
  { k: 'templates', ico: '🗂️', t: 'Templates de nicho', d: 'Pacotes por segmento (dentista, mentoria…)' },
  { k: 'integracoes', ico: '🔌', t: 'Integrações', d: 'Chaves Resend, Green e WhatsApp/IA' },
  { k: 'whatsapp', ico: '🤖', t: 'IA no WhatsApp', d: 'Números autorizados e uso de tokens' },
  { k: 'config', ico: '⚙️', t: 'Configurações', d: 'Cancelamento, plano padrão' },
];
const LOADERS = { usuarios: loadUsers, planos: loadPlans, templates: loadTemplates, integracoes: loadIntegracoes, whatsapp: loadWaNumbers, config: loadConfig };

export function render(container) {
  container.innerHTML = `
    ${pageHead('GPR Core', 'Administração do SaaS — clique num card para abrir')}
    <div id="gc-metrics" class="grid kpis"></div>
    <div class="gc-cards">
      ${CARDS.map(c => `<button class="gc-card" data-open="${c.k}"><span class="gc-card-ico">${c.ico}</span><span class="gc-card-t">${esc(c.t)}</span><span class="gc-card-d">${esc(c.d)}</span></button>`).join('')}
    </div>`;
  loadMetrics(container);
  container.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
    const c = CARDS.find(x => x.k === b.dataset.open);
    openModal(`${c.ico} ${c.t}`, LOADERS[c.k]);
  });
}

// ---- Popup genérico ----
function openModal(titulo, loader) {
  const ov = document.createElement('div');
  ov.className = 'gc-modal-overlay';
  ov.innerHTML = `<div class="gc-modal"><div class="gc-modal-head"><strong>${esc(titulo)}</strong><button class="gc-modal-x" aria-label="Fechar">✕</button></div><div class="gc-modal-body"><div class="hint">carregando…</div></div></div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }
  ov.querySelector('.gc-modal-x').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.addEventListener('keydown', onEsc);
  loader(ov.querySelector('.gc-modal-body'));
}

async function loadMetrics(c) {
  const m = await cloud.adminMetrics();
  c.querySelector('#gc-metrics').innerHTML = kpiBox('👥 Usuários', m.usuarios) + kpiBox('💳 Assinantes ativos', m.assinantes) + kpiBox('🗂️ Contas com dados', m.empresas);
}

// ---- Usuários (busca + paginação) ----
async function loadUsers(body) {
  const [users, plans] = [await cloud.adminListUsers(), await cloud.adminListPlans()];
  const planOpts = (sel) => ['<option value="">— sem —</option>'].concat(plans.map(p => `<option value="${esc(p.code)}" ${sel === p.code ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`)).join('');
  const stOpts = (sel) => ['pending', 'active', 'trialing', 'past_due', 'canceled'].map(s => `<option ${sel === s ? 'selected' : ''}>${s}</option>`).join('');
  const PAGE = 8; let q = '', page = 0;
  function draw() {
    const filt = users.filter(u => !q || (u.email || '').toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(filt.length / PAGE)); if (page >= pages) page = pages - 1;
    const slice = filt.slice(page * PAGE, page * PAGE + PAGE);
    const rows = slice.map(u => `<tr data-id="${u.id}">
      <td>${esc(u.email || '(sem e-mail)')} ${u.is_admin ? '<span class="emp-tag">admin</span>' : ''}</td>
      <td><select class="us-plan">${planOpts(u.sub && u.sub.plan_code)}</select></td>
      <td><select class="us-status">${stOpts((u.sub && u.sub.status) || 'pending')}</select></td>
      <td><button class="btn btn-sm btn-primary" data-saveu="${u.id}">Salvar</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nenhum usuário.</td></tr>';
    body.innerHTML = `
      <input id="us-q" class="gc-search" placeholder="🔎 Buscar e-mail…" value="${esc(q)}">
      <div class="table-wrap" style="box-shadow:none"><table>
        <thead><tr><th>E-mail</th><th>Plano</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="gc-pager"><button data-pg="prev" ${page <= 0 ? 'disabled' : ''}>‹</button><span>página ${page + 1}/${pages} · ${filt.length} usuário(s)</span><button data-pg="next" ${page >= pages - 1 ? 'disabled' : ''}>›</button></div>`;
    const qi = body.querySelector('#us-q');
    qi.oninput = () => { q = qi.value.toLowerCase().trim(); page = 0; draw(); const n = body.querySelector('#us-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    body.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { page += b.dataset.pg === 'next' ? 1 : -1; draw(); });
    body.querySelectorAll('[data-saveu]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); flash(b, await cloud.adminSetSubscription(b.dataset.saveu, tr.querySelector('.us-plan').value, tr.querySelector('.us-status').value)); });
  }
  draw();
}

// ---- Planos (busca) ----
async function loadPlans(body) {
  const plans = await cloud.adminListPlans();
  let q = '';
  function draw() {
    const filt = plans.filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    const rows = filt.map(p => `<tr data-code="${esc(p.code)}">
      <td><strong>${esc(p.code)}</strong></td>
      <td><input class="pl-nome" type="text" value="${esc(p.name)}" style="min-width:130px"></td>
      <td><input class="pl-max" type="number" value="${p.max_companies}" style="width:52px"></td>
      <td><input class="pl-preco" type="number" step="0.01" value="${(p.price_cents || 0) / 100}" style="width:78px"></td>
      <td><input class="pl-oferta" type="text" value="${esc(p.green_offer_id || '')}" placeholder="id da oferta" style="width:110px"></td>
      <td><input class="pl-niche" type="text" value="${esc(p.niche || '')}" placeholder="nicho" style="width:90px"></td>
      <td><button class="btn btn-sm btn-primary" data-savep="${esc(p.code)}">Salvar</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhum plano.</td></tr>';
    body.innerHTML = `
      <p class="hint" style="margin:0 0 8px">"Oferta Green" liga a compra ao plano.</p>
      <input id="pl-q" class="gc-search" placeholder="🔎 Buscar plano…" value="${esc(q)}">
      <div class="table-wrap" style="box-shadow:none"><table>
        <thead><tr><th>Cód</th><th>Nome</th><th>Empr.</th><th>R$/mês</th><th>Oferta Green</th><th>Nicho</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const qi = body.querySelector('#pl-q');
    qi.oninput = () => { q = qi.value.toLowerCase().trim(); draw(); const n = body.querySelector('#pl-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    body.querySelectorAll('[data-savep]').forEach(b => b.onclick = async () => {
      const tr = b.closest('tr');
      flash(b, await cloud.adminUpsertPlan({ code: b.dataset.savep, name: tr.querySelector('.pl-nome').value, max_companies: Number(tr.querySelector('.pl-max').value) || 1, price_cents: Math.round(Number(tr.querySelector('.pl-preco').value) * 100) || 0, green_offer_id: tr.querySelector('.pl-oferta').value.trim() || null, niche: tr.querySelector('.pl-niche').value.trim() || null }));
    });
  }
  draw();
}

// ---- Templates ----
async function loadTemplates(body) {
  const ts = await cloud.adminListTemplates();
  const rows = ts.map(t => `<tr data-id="${esc(t.id)}">
    <td><strong>${esc(t.id)}</strong></td>
    <td><input class="tp-nome" type="text" value="${esc(t.nome)}" style="min-width:130px"></td>
    <td><input class="tp-niche" type="text" value="${esc(t.niche || '')}" style="width:96px"></td>
    <td style="text-align:center"><input type="checkbox" class="tp-active" ${t.active ? 'checked' : ''}></td>
    <td><button class="btn btn-sm btn-primary" data-savet="${esc(t.id)}">Salvar</button></td></tr>`).join('');
  body.innerHTML = `
    <div class="table-wrap" style="box-shadow:none"><table>
      <thead><tr><th>ID</th><th>Nome</th><th>Nicho</th><th>Ativo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="margin-top:8px;gap:6px">
      <input id="tp-new-id" type="text" placeholder="slug (ex.: advogado)" style="width:140px">
      <input id="tp-new-nome" type="text" placeholder="Nome do template" style="min-width:150px">
      <button class="btn btn-sm" id="tp-add">+ Adicionar</button></div>`;
  body.querySelectorAll('[data-savet]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); flash(b, await cloud.adminUpsertTemplate({ id: b.dataset.savet, nome: tr.querySelector('.tp-nome').value, niche: tr.querySelector('.tp-niche').value, active: tr.querySelector('.tp-active').checked })); });
  body.querySelector('#tp-add').onclick = async () => {
    const id = (body.querySelector('#tp-new-id').value || '').trim().toLowerCase().replace(/\s+/g, '-'), nome = (body.querySelector('#tp-new-nome').value || '').trim();
    if (!id || !nome) { alert('Informe slug e nome.'); return; }
    if (await cloud.adminUpsertTemplate({ id, nome, active: true })) loadTemplates(body);
  };
}

// ---- Integrações ----
async function loadIntegracoes(body) {
  const cfg = await cloud.adminGetIntegrations();
  const copia = (id, url) => `<span style="display:flex;gap:6px"><input type="text" value="${esc(url)}" readonly style="flex:1"><button class="btn btn-sm" data-copy="${esc(url)}" id="${id}">Copiar</button></span>`;
  body.innerHTML = `
    <p class="hint" style="margin:0 0 12px">Plugue as chaves aqui — os webhooks usam direto. Guardadas só para o admin.</p>
    <div class="ig-sub">Cobrança (Green) + E-mail (Resend)</div>
    <label class="cfg-field">URL do webhook da Green ${copia('cp-green', GREEN_URL)}</label>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Resend — API key <input id="ig-resend" type="password" value="${esc(cfg.resend_api_key || '')}" placeholder="re_..."></label>
      <label class="cfg-field">Remetente (FROM_EMAIL) <input id="ig-from" type="text" value="${esc(cfg.from_email || '')}" placeholder="GPR <nao-responda@seudominio>"></label>
      <label class="cfg-field">URL do app (APP_URL) <input id="ig-app" type="text" value="${esc(cfg.app_url || '')}" placeholder="https://mapa-gestao-financeira.pages.dev/"></label>
      <label class="cfg-field">Green — segredo do webhook <input id="ig-green" type="password" value="${esc(cfg.green_webhook_secret || '')}" placeholder="segredo da Green"></label>
    </div>
    <div class="ig-sub" style="margin-top:16px">IA no WhatsApp</div>
    <label class="cfg-field">URL do webhook do WhatsApp (Meta) ${copia('cp-wa', WA_URL)}</label>
    <div class="grid grid-2" style="margin-top:10px">
      <label class="cfg-field">Anthropic — API key <input id="ig-anthropic" type="password" value="${esc(cfg.anthropic_api_key || '')}" placeholder="sk-ant-..."></label>
      <label class="cfg-field">Modelo de IA <input id="ig-model" type="text" value="${esc(cfg.ai_model || '')}" placeholder="claude-sonnet-4-6"></label>
      <label class="cfg-field">WhatsApp — token (Meta) <input id="ig-watoken" type="password" value="${esc(cfg.wa_token || '')}" placeholder="EAAG..."></label>
      <label class="cfg-field">WhatsApp — Phone Number ID <input id="ig-waphone" type="text" value="${esc(cfg.wa_phone_id || '')}" placeholder="1234567890"></label>
      <label class="cfg-field">WhatsApp — Verify Token <input id="ig-waverify" type="text" value="${esc(cfg.wa_verify_token || '')}" placeholder="defina um texto qualquer"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="ig-save" style="margin-top:14px">Salvar integrações</button>`;
  body.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); } catch (e) {} const t = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = t, 1300); });
  body.querySelector('#ig-save').onclick = async () => {
    const v = (id) => body.querySelector(id).value.trim();
    flash(body.querySelector('#ig-save'), await cloud.adminSetIntegrations({
      resend_api_key: v('#ig-resend'), from_email: v('#ig-from'), app_url: v('#ig-app'), green_webhook_secret: v('#ig-green'),
      anthropic_api_key: v('#ig-anthropic'), ai_model: v('#ig-model'), wa_token: v('#ig-watoken'), wa_phone_id: v('#ig-waphone'), wa_verify_token: v('#ig-waverify'),
    }));
  };
}

// ---- IA no WhatsApp (números) ----
async function loadWaNumbers(body) {
  const [nums, users, uso] = [await cloud.adminListWaNumbers(), await cloud.adminListUsers(), await cloud.adminAiUsage()];
  const userOpts = users.map(u => `<option value="${u.id}">${esc(u.email || u.id)}</option>`).join('');
  const emailDe = (id) => { const u = users.find(x => x.id === id); return u ? (u.email || id) : id; };
  const rows = nums.map(n => `<tr><td>${esc(n.phone)}</td><td>${esc(emailDe(n.owner_id))}</td><td><button class="btn btn-sm" data-delwa="${esc(n.phone)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Nenhum número autorizado.</td></tr>';
  body.innerHTML = `
    <p class="hint" style="margin:0 0 8px">Uso de IA: <b>${uso.i + uso.o}</b> tokens. A IA só responde a números autorizados.</p>
    <div class="table-wrap" style="box-shadow:none"><table>
      <thead><tr><th>Número (com DDI)</th><th>Usuário</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="toolbar" style="margin-top:8px;gap:6px">
      <input id="wa-new-phone" type="text" placeholder="5531999998888" style="width:160px">
      <select id="wa-new-user">${userOpts}</select>
      <button class="btn btn-sm" id="wa-add">+ Autorizar</button></div>`;
  body.querySelectorAll('[data-delwa]').forEach(b => b.onclick = async () => { await cloud.adminDelWaNumber(b.dataset.delwa); loadWaNumbers(body); });
  body.querySelector('#wa-add').onclick = async () => {
    const phone = (body.querySelector('#wa-new-phone').value || '').replace(/\D/g, ''), ownerId = body.querySelector('#wa-new-user').value;
    if (!phone || !ownerId) { alert('Informe número e usuário.'); return; }
    if (await cloud.adminAddWaNumber(phone, ownerId)) loadWaNumbers(body);
  };
}

// ---- Configurações ----
async function loadConfig(body) {
  const cfg = await cloud.adminGetConfig();
  body.innerHTML = `
    <div class="grid grid-2">
      <label class="cfg-field">Ao cancelar assinatura
        <select id="cfg-cancel"><option value="read_only" ${cfg.cancel_behavior === 'read_only' ? 'selected' : ''}>Somente leitura</option><option value="block" ${cfg.cancel_behavior === 'block' ? 'selected' : ''}>Bloquear acesso</option></select></label>
      <label class="cfg-field">Plano padrão (novo cliente)
        <input id="cfg-plano" type="text" value="${esc(cfg.plano_padrao || 'A')}" style="width:80px"></label>
    </div>
    <button class="btn btn-sm btn-primary" id="cfg-save" style="margin-top:12px">Salvar configurações</button>`;
  body.querySelector('#cfg-save').onclick = async () => { flash(body.querySelector('#cfg-save'), await cloud.adminSetConfig({ cancel_behavior: body.querySelector('#cfg-cancel').value, plano_padrao: body.querySelector('#cfg-plano').value })); };
}

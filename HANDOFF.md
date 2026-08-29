# HANDOFF — GPR (Gestão Para Resultado)

> Documento de passagem para uma sessão/pessoa nova (inclusive rodando na nuvem, SEM acesso ao Mac
> do Paulo). Escrito em 28/07/2026, estado = **v120**, commit `690e9cd`. Leia inteiro antes de mexer:
> a seção **Armadilhas** evita os erros que já custaram horas.

## 1. O que é o projeto

**GPR** é um SaaS de **gestão financeira para pequenos negócios** que substitui a planilha Excel
"Mapa da Gestão Financeira V.2" (produto do Wesley Schroeder, sócio do Paulo). O usuário lança
**vendas** e **despesas**; o sistema deriva tudo: DRE (competência), DFC (caixa), Fluxo de Caixa com
projeções e aging, Controle de Metas, Orçado×Realizado, dashboards. Regra de ouro herdada da planilha:
**os números têm que bater** — fidelidade de cálculo acima de tudo.

Fase atual: **beta com testadores reais** (contas de usuários de verdade em produção). Cadastro está
aberto: todo mundo que se registrar ganha acesso total grátis (flag `free_signup`, ver §4).

- **Produção:** https://gpr.p4gestao.com.br (espelho: https://bragarpaulo.github.io/GPR/)
- **Repo:** https://github.com/bragarpaulo/GPR (público — **nunca commitar segredos**)

## 2. Arquitetura

**Stack: vanilla JS, SEM build.** ES modules servidos crus; nenhum bundler, nenhum npm install para o
front. `index.html` + `js/` + `css/styles.css`. Libs por CDN (jsdelivr): Chart.js e supabase-js no boot;
SheetJS/jsPDF/html2canvas carregadas sob demanda por `js/lazylibs.js`.

```
index.html          shell + CSP (meta) + FAB do WhatsApp + boot-loader
js/app.js           bootstrap, rotas por hash (#dashboard…), topbar/period-bar, auth gate, scroll por aba
js/store.js         estado (root = {companies[], activeId, selectedIds}) + localStorage + nuvem (debounce)
js/calc.js          MOTOR de cálculo (DRE/DFC/fluxo/metas/dashboard) — puro, testável
js/cloud.js         Supabase: auth, user_data, admin*, feedback; getMyAccess (entitlements)
js/access.js        decideAccess() PURO (demo/free/pago/cancelado) — tabela-verdade no verify
js/import.js        importação/exportação .xlsx (modelo, modos novo/substituir/adicionar) + _wbEmpresa
js/version.js       GERADO por hook git (versão exibida no GPR Core) — não editar à mão
js/views/*.js       uma view por rota; admin.js/equipe.js/ajuda.js são LAZY (import() dinâmico)
css/styles.css      design system inteiro (tema claro/escuro via [data-theme])
test/verify.mjs     suíte de invariantes: `node test/verify.mjs` (83/83 hoje) — SEM framework
supabase/migrations 0001..0016 (fonte da verdade do schema; aplicadas via Management API)
supabase/functions  admin-actions, green-webhook, whatsapp-webhook (Deno Edge Functions)
.github/workflows   keepalive.yml (diário) + keepalive-watchdog.yml (2×/semana)
_headers            headers do Cloudflare Pages (CSP/HSTS/nosniff) — GitHub Pages IGNORA
```

**Persistência:** cada CONTA (dono + membros de equipe) tem **uma única linha** em `public.user_data`
com o estado inteiro num blob JSONB (`root`). O app salva com debounce (250ms local / 800ms nuvem),
**last-write-wins, sem merge**. localStorage é cache por usuário (`lsKey` com sufixo do uid). Não há
realtime (`cloudSubscribe` é no-op de propósito).

**Backend (Supabase, projeto "GPR", ref `qdioqeejcneijctotyft`, us-east-1, FREE tier):**
- Auth e-mail/senha (mín. 6, sem MFA). 1º usuário do sistema nasce admin (trigger).
- Tabelas com RLS em TUDO: `profiles`, `subscriptions`, `plans`, `user_data`, `members`, `templates`,
  `app_config`, `integrations` (segredos, só-admin), `feedback`, `keepalive(+_log)`, `whatsapp_numbers`,
  `ai_usage`, `terms(+acceptance)`, `billing_events`, `rate_limits` (+ `companies`/`company_states` legadas, sem uso).
- RPCs: `meu_dono()`, `is_admin()`, `metrics_counts()` (só-admin), `get_signup_config()`,
  `user_max_companies/seats()`, `keepalive_tick/health/watchdog()`, `rl_hit()`.
- **pg_cron (3 jobs ativos):** `gpr-keepalive-tick` 03:17 UTC, `gpr-keepalive-watchdog` 13:00 UTC,
  `gpr-keepalive-vacuum` dom 04:00 UTC.
- **Edge Functions:** `admin-actions` (auth-admin: criar/excluir usuário, senha, equipe — valida JWT+admin
  INTERNAMENTE, deployada com `--no-verify-jwt` por causa do preflight CORS), `green-webhook` (billing da
  Green, HMAC), `whatsapp-webhook` (IA no WhatsApp — **fail-safe: rejeita tudo** até configurarem
  `wa_app_secret` em `integrations`).

**Deploy:** `git push origin main` → auto-deploy no **Cloudflare Pages** (projeto interno chama-se
`mapa-gestao-financeira` — nome antigo, não renomeável por travas de cross-account; irrelevante, o
domínio real é `gpr.p4gestao.com.br`) e no **GitHub Pages** (espelho). Não há CI de testes — rode
`node test/verify.mjs` antes de push. A zona Cloudflare `p4gestao.com.br` tem **Browser Cache TTL =
"Respect Existing Headers"** (crítico! ver Armadilhas).

## 3. Estado atual (o que está NO AR e funcionando)

- App completo: 14 telas + GPR Core (admin) + Central de Ajuda (manual ilustrado + 2 vídeos do YouTube
  + canal de feedback que grava na tabela `feedback`).
- **Cadastro aberto**: sem assinatura paga → acesso total grátis (`app_config.geral.free_signup`,
  default ligado; toggle no GPR Core→Configurações). Assinantes pagos/cancelados/admin intactos.
- Regras financeiras centrais corrigidas nesta fase (ver §4): saldo ancorado na data-base, caixa pelo
  recebimento real, caixa realizado sem corte de competência.
- Importação/exportação Excel round-trip; backup só-Excel (um arquivo por empresa).
- Suporte via WhatsApp (FAB flutuante, wa.me/5545991099764); versão+commit visíveis no GPR Core.
- **Keep-alive do Supabase free ATIVO** (ciclo diário cria/remove empresa fictícia 2025–2027 + 2 vigias).
- Suíte: 83/83. Segurança: CSP+SRI, XSS auditado, rota #admin gateada, `metrics_counts` só-admin,
  RLS revisada tabela a tabela, webhooks com HMAC, rate-limit nas Edge Functions.

## 4. O que foi feito nesta fase — decisões e PORQUÊS

**Liberação grátis geral (`js/access.js`).** O gate de acesso era "sem assinatura = demo só-leitura".
Para o beta, o Paulo quis todo cadastro com acesso total. Decisão: flag global `free_signup` em
`app_config.geral` (default LIGADO; desligar = voltar a cobrar), lógica extraída para `decideAccess()`
puro com tabela-verdade em teste. **Entitlements são 100% client-side** (o RLS de `user_data` não olha
assinatura) — aceito conscientemente no beta; endurecer é o maior item do backlog.

**Segurança (auditoria multi-agente + fixes).** Um testador abriu `#admin` pela URL e viu o painel.
Dados sempre estiveram protegidos por RLS, mas: rota agora gateada em `_isAdmin`, `metrics_counts`
filtrado por `is_admin()` (vazava contagens), CSP+SRI adicionados (CDNs fixados por hash),
`app_config`/`plans` restritos a autenticados, webhook do WhatsApp ganhou HMAC fail-safe. A revisão
adversarial também pegou 3 bugs meus antes do deploy (ex.: `_demo` preso após relogin SPA — `setAccess`
agora sempre reavalia `_demo`; e `cloudLoad` que retornava null em ERRO de rede, fazendo `initCloud`
semear estado em branco POR CIMA de dados reais — hoje `cloudLoad` LANÇA em erro e null significa
apenas "linha não existe").

**Regras financeiras (bugs achados pelo Paulo usando de verdade):**
- *Saldo ancorado na data-base* (`cutoffCaixa` em calc.js): o saldo informado na conta vale NA data-base
  dela; movimento ANTERIOR já está embutido nele e não soma de novo (100k lançados hoje mostravam 152k).
  Só o SALDO usa as séries filtradas (`entradasCx/saidasCx`); os KPIs "Recebimentos/Pagamentos" seguem
  completos — são perguntas diferentes.
- *Caixa pelo recebimento real* (`vendaDerivada`): venda recebida entra no mês da `dataRecebimento`;
  em aberto continua prevista pelo vencimento (previsto/atrasado/inadimplência intactos).
- *Caixa realizado sem corte* (`pickCx` no `calcDashboard`): o corte "competência não conta o futuro"
  NÃO se aplica a recebimento/pagamento com data preenchida — "aconteceu, conta", mesmo registrado num
  mês à frente. Competência (receita/despesa/lucro) mantém o corte.

**Status de vendas renomeados** (Pago→**Recebido**, À pagar→**À receber**; despesas inalteradas).
Armadilha resolvida junto: filtros salvos guardam o TEXTO do status → `migrarCompany` remapeia os
valores antigos, senão a tela do usuário ficaria vazia sem explicação.

**Importação com modos** (novo/substituir/adicionar + escolha da empresa-alvo): antes toda importação
criava empresa nova — confuso. `resetDadosEmpresa()` zera uma empresa preservando identidade. O modelo
de download é GERADO por código reutilizando o exportador (`_wbEmpresa`) → round-trip garantido. Mês
Competência é normalizado (`normComp`: "Jan/2026", "01/2026", vazio→mês do vencimento).

**Keep-alive do Supabase** (free pausa por inatividade): ciclo diário que ALTERNA criar/remover uma
empresa fictícia (36 vendas+36 despesas, 2025–2027) via RPC `keepalive_tick`. **Decisão de segurança:
tabela isolada `keepalive`, nunca o `user_data` real** (blob last-write-wins seria sobrescrito). Duas
camadas de execução (GitHub Actions diário — tráfego de API é o critério de atividade do Supabase — e
pg_cron interno) + dois vigias (workflow que FALHA de propósito se o ciclo parar >48h → e-mail nativo
do GitHub; e watchdog interno que enviaria via Resend, hoje degrada para só-log porque o Resend não
está configurado). VACUUM semanal via pg_cron.

**UX diversos:** scroll restaurado por aba (`_scrollRota` em app.js), TAB sem piscar em Configurações
(saves `{silent:true}` + update in-place do topo), recorrência por Nº TOTAL DE PARCELAS (popover
converte N→dataFim; motor intacto), excluir empresa com re-auth por senha (`cloud.signIn` do próprio
dono) + flag por assinante (`profiles.allow_delete_company`, admin controla no GPR Core), dashboard
com vendas por cliente/produto, filtro "Próx. 7 dias" nas despesas, versão+commit no GPR Core (vN do
hook local + sha buscado da API do GitHub em runtime — hash do próprio commit é impossível gravar
dentro dele).

## 5. ARMADILHAS e comportamentos não óbvios (leia antes de tocar no código)

1. **`user_data` é um blob last-write-wins.** Nunca escreva nele fora do fluxo do app (jobs, scripts).
   Corrida = perda de dados do usuário. Foi por isso que o keep-alive usa tabela própria.
2. **`update(mutator, {silent})`** (store.js): sem `silent`, todo save re-renderiza a view inteira
   (innerHTML) → input perde foco/scroll ("a tela pisca"). Edição de célula SEMPRE silent + atualização
   in-place da derivada. `update()` é NO-OP em consolidado/read-only (exceto `updateUI`).
3. **Formatos internos são strings exatas:** mês competência `jan/2026` (minúsculo!); status são os
   TEXTOS de `STATUS_VENDA/STATUS_DESPESA` usados como valor E rótulo — filtros persistidos guardam o
   texto (qualquer rename exige remap em `migrarCompany`).
4. **CSP vive em DOIS lugares:** `_headers` (Cloudflare) e `<meta>` no index.html (vale no GitHub Pages
   e preview). Mudou um, mude o outro. `frame-src` só youtube-nocookie; `connect-src` supabase + api.github.com.
5. **Cache:** a zona Cloudflare precisa de Browser Cache TTL = "Respect Existing Headers". Se alguém
   reverter para 4h, deploys "não chegam" e um app.js velho + index novo pode quebrar listeners (por
   isso os `?.` nos getElementById do boot). O sw.js é um KILL-SWITCH (index desregistra SWs) — não
   reative service worker sem repensar tudo.
6. **`js/version.js` é gerado por um hook `.git/hooks/pre-commit` LOCAL do Mac do Paulo** (não
   versionado!). Numa máquina nova/nuvem, os commits NÃO atualizam a versão sozinhos. Recrie o hook
   (conteúdo: rev-list --count+1 + data → escreve js/version.js e `git add`) ou atualize o arquivo à mão
   no commit. Se esquecer, o GPR Core mostra versão velha (confunde o diagnóstico de deploy).
7. **Edge Functions**: deploy com `supabase functions deploy <nome> --project-ref qdioqeejcneijctotyft
   --no-verify-jwt`. A flag é OBRIGATÓRIA (preflight OPTIONS sem token; a função valida JWT sozinha).
   Migrations vão pelo endpoint `POST /v1/projects/<ref>/database/query` da Management API (PAT).
8. **PostgREST safeupdate:** DELETE/UPDATE sem WHERE falham via REST — sempre `where true` ou WHERE real.
9. **`getMyAccess`/boot:** membro herda assinatura do DONO (`meu_dono()`); `_isOwner` só no app.js;
   views detectam dono comparando `currentUser().id === getMeuDono()`.
10. **verify.mjs** roda em Node puro (sem DOM). Testes com data usam o relógio real — alguns têm guardas
    (ex.: "pulado se hoje ≤ 05/jan"). Rode SEMPRE antes de push; 0 falha é o esperado.
11. **Testes de browser** (se tiver como rodar o site): stub `window.alert` (nativo trava automação);
    após login, ESPERE o initCloud aplicar o remoto antes de criar empresas de teste (senão o estado da
    nuvem substitui o root e "some" com o que você criou); descrições de lançamentos ficam em `value`
    de `<input>` (textContent não vê). Conta `bragarpaulo@gmail.com` é a de DEV (admin; empresas de teste
    mudam sem aviso); os dados reais do Paulo/Wesley estão em outras contas — não mexa nelas.
12. **keepalive:** throttle de 1h entre ticks; para re-testar o ciclo:
    `update keepalive_log set at = at - interval '2 hours' where true;` antes de chamar a RPC.

## 6. Pendências e próximos passos (em ordem de valor)

1. **Entitlement server-side** (o maior): RLS/trigger em `user_data` cruzando `subscriptions` para o
   plano valer no servidor (hoje um usuário técnico contorna o limite client-side). Pensar em como o
   modo grátis (`free_signup`) entra nessa checagem.
2. **Configurar o Resend** (GPR Core→Integrações): sem ele NÃO SAEM e-mails de convite de equipe,
   credenciais de assinante e o alerta interno do watchdog (que hoje só loga). Precisa de API key +
   domínio remetente verificado.
3. **Feedback dos testadores**: chegam na tabela `feedback`; revisar no GPR Core→card Feedback
   (marcar lido/resolvido). É a fila natural de trabalho.
4. **Backlog de performance consciente** (docs/PLANO-MELHORIA.md): migrar lançamentos do blob p/
   tabelas relacionais (blob >1MB com ~4k lançamentos), bundler/minificação, virtual scroll nas tabelas.
5. **Auth hardening:** senha mínima >6 e MFA (painel do Supabase), leaked-password protection.
6. **IA no WhatsApp** está DESLIGADA de propósito (flag `WHATSAPP_IA_ATIVO=false` em equipe.js +
   webhook fail-safe). Para ligar: colar o App Secret da Meta em Integrações e flipar a flag.

## 7. O que a sessão de nuvem NÃO terá (dependências fora do repo)

**Nenhum valor de credencial está neste repo (ele é público). Peça ao Paulo o que precisar:**

| Recurso | Para quê | Onde está/como obter |
|---|---|---|
| **Supabase Management API PAT** (`sbp_…`) | aplicar migrations via `database/query`, renomear projeto, ler config | Paulo tem; gera em supabase.com → Account → Access Tokens |
| **SUPABASE_ACCESS_TOKEN + CLI** | `supabase functions deploy … --no-verify-jwt` | mesmo PAT; CLI local (no Mac já instalada, 2.109.0) |
| **Painel Supabase** (projeto GPR) | Auth settings, SQL Editor, logs das functions | conta do Paulo |
| **GitHub `gh` autenticado** (conta bragarpaulo) | push, Actions, gerenciar repo | na nuvem: exportar GH_TOKEN com repo+workflow scopes |
| **Cloudflare** (conta com a zona `p4gestao.com.br` + projeto Pages) | cache, domínio, _headers efetivos | painel do Paulo — atenção: há DUAS contas CF (a do projeto Pages não é a mesma da zona) |
| **Contas de teste do app** (dev/admin) | testar logado | e-mails/senhas com o Paulo — NÃO estão no repo |
| **Chave anon do Supabase** | chamadas REST públicas | pública por design, está em `js/cloud.js` |
| **Resend API key** | e-mails (pendência §6.2) | ainda não existe — criar em resend.com |
| **Meta WhatsApp App Secret** | ligar a IA no WhatsApp | Meta for Developers do Paulo |
| **Hook pre-commit da versão** | carimbar js/version.js | NÃO versionado — recriar (ver Armadilha 6) |

**Rotina de trabalho usada até aqui** (recomendo manter): mudança → `node test/verify.mjs` verde →
testar a tela REAL logado (nunca só o teste) → commit descritivo em main → push (auto-deploy) →
confirmar no domínio (`curl` no asset + GPR Core mostra a versão nova) → registrar armadilhas novas
neste arquivo.

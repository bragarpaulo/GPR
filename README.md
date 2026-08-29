# GPR — Gestão Para Resultado

SaaS de **gestão financeira para pequenos negócios**: o usuário lança **vendas** e **despesas**, e o
sistema deriva o resto — DRE (competência), DFC (caixa), Fluxo de Caixa com projeção e aging, Controle
de Metas, Orçado×Realizado, dashboards. É a digitalização da planilha *"Mapa da Gestão Financeira V.2"*,
e a regra de ouro herdada dela é **os números têm que bater**: fidelidade de cálculo acima de tudo.

**Fase atual: beta com testadores reais** (contas de verdade em produção). O cadastro está aberto —
quem se registra ganha acesso total grátis enquanto a flag `free_signup` estiver ligada.

- **Produção:** <https://gpr.p4gestao.com.br> · espelho: <https://bragarpaulo.github.io/GPR/>
- **Contexto completo (leia antes de mexer):** [`HANDOFF.md`](HANDOFF.md) — arquitetura, decisões,
  e a seção **Armadilhas**, que documenta os comportamentos não óbvios que já custaram horas.

> ⚠️ **Este repositório é público.** Nenhum segredo entra aqui. A chave `anon` do Supabase em
> `js/cloud.js` é pública por design; qualquer outra credencial (PAT, API key, App Secret) fica fora.

## Como rodar

Por usar ES modules, precisa ser servido por HTTP (abrir via `file://` não funciona):

```bash
python3 serve.py            # ou: npm run serve  →  http://127.0.0.1:8080
```

Não há `npm install`: o front não tem build nem dependências. As libs vêm por CDN.

## Testes

```bash
node test/verify.mjs        # ou: npm run verify   →  esperado: 83/83, 0 falhou
```

`test/verify.mjs` é uma suíte de invariantes **sem framework**, em Node puro (sem DOM), que trava as
regras financeiras do motor (`js/calc.js`) e a tabela-verdade de acesso (`js/access.js`). **Rode sempre
antes do push** — não há CI de testes. Alguns casos usam o relógio real e têm guardas de data.

Teste automatizado não substitui abrir a tela logado: o fluxo recomendado é `verify.mjs` verde →
conferir a tela real → commit → push → confirmar a versão nova no GPR Core.

## Como funciona

**Sem build.** ES modules servidos crus (`index.html` + `js/` + `css/styles.css`). Chart.js e supabase-js
vêm do jsDelivr no boot, com versão fixa e SRI; SheetJS/jsPDF/html2canvas são carregadas sob demanda por
`js/lazylibs.js`.

**Persistência — leia com atenção, é a maior fonte de bugs.** Cada conta (dono + membros da equipe) tem
**uma única linha** em `public.user_data`, com o estado inteiro num blob JSONB. O salvamento é com
debounce (250 ms local / 800 ms nuvem) e **last-write-wins, sem merge**:

- **Não há sincronização em tempo real.** `cloudSubscribe()` é um no-op deliberado — duas abas abertas
  na mesma conta não convergem, a última a salvar vence.
- **Nunca escreva em `user_data` fora do fluxo do app** (jobs, scripts, migrations de dados). Uma corrida
  apaga dados de usuário. Foi por isso que o keep-alive ganhou tabela própria (`keepalive`).
- O `localStorage` é só cache por usuário (chave com sufixo do uid), não a fonte da verdade.

**Backend:** Supabase (Auth e-mail/senha, Postgres com **RLS em todas as tabelas**, Edge Functions em
Deno para billing/admin/webhooks). O schema é versionado em `supabase/migrations/`. Entitlements
(demo / grátis / plano pago / cancelado) são decididos em `js/access.js` — hoje **no cliente**; fechar
isso no servidor é o item nº 1 do backlog.

## Estrutura

```
index.html            shell + CSP (<meta>) + boot-loader
js/
  app.js              bootstrap, rotas por hash (#dashboard…), auth gate, topbar
  store.js            estado + localStorage + nuvem (debounce, last-write-wins)
  calc.js             MOTOR de cálculo (DRE/DFC/fluxo/metas/dashboard) — puro e testável
  cloud.js            Supabase: auth, user_data, admin, feedback, entitlements
  access.js           decideAccess() PURO — tabela-verdade coberta no verify.mjs
  import.js           importação/exportação .xlsx (modos novo/substituir/adicionar)
  config.js           plano de contas, status, meses, abas
  version.js          GERADO pelo hook pre-commit — não editar à mão
  views/              uma view por rota (admin/equipe/ajuda são lazy via import() dinâmico)
css/styles.css        design system (tema claro/escuro via [data-theme])
scripts/              utilitários de manutenção (carimbo de versão, carga)
test/verify.mjs       suíte de invariantes
supabase/             migrations (fonte da verdade do schema) + Edge Functions
docs/                 auditoria de segurança/performance e notas de infra
```

São **13 abas** na barra lateral (Início, Dashboard, Vendas, Despesas, DRE, DFC, Fluxo de Caixa,
Controle de Metas, Meta×Real, Orçado×Realizado, Orçamento, Configurações, Central de Ajuda), mais a tela
de **Equipe** e o **GPR Core** (painel de admin, rota gateada), que ficam fora dela.

## Regras de negócio (fiéis à planilha)

- **Vendas:** receita reconhecida pelo *Mês da Venda*. Status: **Recebido**, **À receber**, **Vence Hoje**,
  **Atrasado** — derivados da data. Os textos desses status são usados como valor *e* rótulo, e ficam
  gravados nos filtros salvos do usuário: renomear qualquer um exige remap em `migrarCompany`.
- **Despesas:** custo pelo *Mês Competência* (DRE); caixa pelo *Mês do Pagamento* quando pago (DFC/Fluxo).
  Status: **Pago**, **À pagar**, **Vence Hoje**, **Atrasado**.
- **DRE** (competência) e **DFC** (caixa) com a mesma cascata de subtotais da planilha.
- **Caixa** — três regras corrigidas na fase atual, todas cobertas por teste:
  - *Saldo ancorado na data-base:* o saldo informado na conta vale **na data-base dela**; movimento
    anterior já está embutido e não soma de novo. Só o saldo usa as séries filtradas — os KPIs
    "Recebimentos/Pagamentos" seguem completos, porque são perguntas diferentes.
  - *Entrada pelo recebimento real:* venda recebida entra no mês da `dataRecebimento`; em aberto, segue
    prevista pelo vencimento.
  - *Realizado não sofre corte de competência:* recebimento/pagamento com data preenchida conta mesmo
    se registrado num mês à frente — "aconteceu, conta". A competência mantém o corte.

Formatos internos são strings exatas: mês de competência é `jan/2026` (minúsculo).

## Deploy

`git push origin main` publica automaticamente no **Cloudflare Pages** (domínio `gpr.p4gestao.com.br`)
e no **GitHub Pages** (espelho). Como os arquivos não têm hash de versão, o cache depende de
revalidação: `_headers` manda `Cache-Control: no-cache`, e a zona do Cloudflare precisa estar em
**Browser Cache TTL = "Respect Existing Headers"**. Se isso for revertido, deploys "não chegam".

A CSP vive em **dois lugares** — `_headers` (header real do Cloudflare) e a `<meta>` do `index.html`
(que é o que vale no GitHub Pages e nos previews). **Mudou um, mude o outro.**

### Carimbo de versão

`js/version.js` é gerado por um hook `pre-commit` e é o que o GPR Core mostra — é assim que se confirma
que um deploy chegou. O hook vive em `.git/hooks/`, que **não** é versionado, então **todo clone novo
precisa reinstalá-lo**:

```bash
npm run hook:install        # node scripts/bump-version.mjs --install-hook
```

Sem isso os commits passam sem carimbar, o GPR Core segue exibindo a versão antiga depois do deploy, e o
diagnóstico aponta para o lado errado. O script é seguro em **clone raso** (`git clone --depth`, comum em
CI e sessões na nuvem), onde a contagem de commits vem menor que a real e um hook ingênuo faria a versão
*andar para trás*.

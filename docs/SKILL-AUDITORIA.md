---
name: auditoria-performance-seguranca
description: >-
  Auditoria profunda de SEGURANÇA, BANCO DE DADOS e PERFORMANCE de qualquer sistema (web, API,
  mobile, backend), com plano de melhoria por fases. Use quando o pedido for "audite/revise a
  segurança", "melhore a performance/velocidade", "meu sistema está lento", "está seguro?",
  "boas práticas", "hardening", ou antes de colocar algo em produção. Genérica p/ qualquer
  linguagem/stack. Escrita em português.
---

# Skill: Auditoria de Segurança + Banco + Performance (qualquer sistema)

Você é um(a) engenheiro(a) de software sênior, poliglota (JS/TS, Python, Go, Rust, Java, PHP, SQL,
etc.), com experiência em segurança de aplicações (OWASP), bancos de dados e performance web/backend.
Sua missão: **auditar o sistema, achar problemas REAIS com evidência, e entregar um plano de melhoria
acionável por fases** — sem inventar, sem alarmismo, priorizando por impacto.

## Como usar (cole em qualquer IA)
1. Aponte a pasta/repositório do projeto (ou cole os arquivos).
2. Diga o alvo: "segurança", "performance", "banco" ou "tudo".
3. Peça: **"Rode a skill auditoria-performance-seguranca"**.
A IA deve seguir o PROCESSO abaixo e devolver no FORMATO DE SAÍDA padronizado.

## Princípios (inegociáveis)
- **Evidência sempre**: cada achado cita `arquivo:linha` e 1–2 linhas do trecho. Nunca reporte o que
  não viu no código.
- **Sem falso positivo**: se não conseguir confirmar, marque como "a verificar", não como falha.
- **Priorize por impacto real**, não por quantidade. 1 crítico > 20 cosméticos.
- **Correção de 1 linha** por achado (o "o que fazer"), objetiva.
- **Não quebre o que funciona**: proponha a mudança de menor risco que resolve. Em app financeiro/saúde,
  correção que introduz risco de dado errado (ex.: cache stale) NÃO vale um ganho de milissegundos —
  documente como backlog e explique o porquê.
- **Defesa em profundidade**: gate de UI é conveniência; a proteção REAL é no servidor (authz/RLS/validação).

## Processo
1. **Mapear** a stack: linguagem, framework, banco, hospedagem, autenticação, o que roda no cliente vs
   servidor, o que é público vs autenticado. Liste os pontos de entrada (rotas, endpoints, webhooks, jobs).
2. **Varrer** cada eixo com os checklists abaixo. Prefira ferramentas de busca (grep) para achados
   sistemáticos (ex.: todo `innerHTML` sem escaping; toda função sem authz).
3. **Confirmar** o que der: RLS/policies no catálogo do banco, headers via `curl -I`, tamanho de assets,
   nº de round-trips no boot. Distinga "erro" de "ausência" (ex.: numa consulta que volta vazia).
4. **Priorizar** por severidade e esforço.
5. **Entregar** no formato de saída + (se pedido) executar por fases, cada fase com teste + prova.

---

## CHECKLIST — SEGURANÇA (AppSec / OWASP)
**Injeção & XSS**
- [ ] Toda saída em HTML escapa dado do usuário? (procure `innerHTML`/`dangerouslySetInnerHTML`/template
      sem escape). Cuidado com **contexto de atributo** (`title="..."`, `href`, `style`) e handlers inline.
- [ ] SQL/NoSQL sempre parametrizado (nunca string concatenada). ORM configurado contra injeção.
- [ ] Uploads: valida tipo/tamanho, não confia no `Content-Type`, não executa o que sobe.
**Autenticação & Autorização**
- [ ] Authz checada **no servidor** em TODA rota/endpoint sensível (não só esconder o botão na UI).
- [ ] IDOR: o backend confere que o recurso pertence ao usuário (não confia em id vindo do cliente).
- [ ] Sessão: token em storage adequado (HttpOnly cookie > localStorage); expiração; logout real;
      rotação; opção "limpar dispositivo" em máquina compartilhada. MFA disponível. Política de senha forte.
**Segredos & Config**
- [ ] Nenhum segredo hardcoded no código/repo (grep por `api_key`, `secret`, `token`, `password`,
      prefixos `sk-`, `sbp_`, `AKIA`, `-----BEGIN`). Só chaves **públicas por design** podem aparecer.
- [ ] Segredos em variáveis de ambiente/cofre; `.env` no `.gitignore`.
**Cabeçalhos & Transporte**
- [ ] `Content-Security-Policy` (idealmente sem `unsafe-inline` em script), `X-Frame-Options`/
      `frame-ancestors` (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
      `Strict-Transport-Security`. HTTPS obrigatório.
- [ ] Scripts de CDN com **SRI** (`integrity`) e **versão fixada** (não flutuante).
**Webhooks & Integrações**
- [ ] Todo webhook valida **assinatura/HMAC** do provedor (Stripe/Meta/etc.), com o corpo CRU, em
      **tempo constante**. **Fail-safe**: sem segredo configurado, REJEITA.
- [ ] CORS restrito à(s) origem(ns) do app quando houver credenciais; `*` só com auth por Bearer.
**Abuso**
- [ ] Rate limiting em login, reset de senha, endpoints caros e webhooks (por IP/usuário).
- [ ] Sem enumeração de usuário (mensagens de erro genéricas).
**Privacidade/LGPD**
- [ ] Não vaza dado de terceiros; logs sem PII/segredos; contagens/métricas não expõem o negócio a quem
      não é admin.

## CHECKLIST — BANCO DE DADOS
- [ ] **RLS/row-level security ligada** em todas as tabelas com dado de usuário; política clara por
      tabela (quem lê/escreve). Faça um **resumo tabela-por-tabela**. `select using(true)` ou
      `auth.uid() is not null` costuma ser frouxo demais para dado sensível.
- [ ] Funções `SECURITY DEFINER`/stored procs: `search_path` fixo; `revoke execute` de anon/authenticated
      quando não deve ser chamada direta; não vazam mais do que o necessário.
- [ ] **Índices** nas colunas de filtro/junção/ordenação; sem full-scan em tabela grande.
- [ ] **N+1**: nada de query dentro de laço; use join/batch. Paginação em listas grandes.
- [ ] **Blob vs relacional**: guardar tudo num JSON gigante por usuário é simples mas escala mal (cada
      save reenvia o blob inteiro). Avalie normalizar quando crescer.
- [ ] Migrations idempotentes e versionadas; backup/rollback; timeouts e connection pool.
- [ ] Nunca dado sensível em URL/query string.

## CHECKLIST — PERFORMANCE (web/app)
**Carga inicial**
- [ ] Medir **bytes do 1º load** (HTML+CSS+JS+libs) e nº de requisições. Libs minificadas. Nada de dev
      build em produção. Comprimir imagens (webp/avif), `loading="lazy"`.
- [ ] **Code-splitting**: só carregar no boot o que a 1ª tela precisa; rotas/telas pesadas sob demanda
      (`import()` dinâmico). Bundler/minify/tree-shaking se não houver.
- [ ] CSS/JS render-blocking mínimos; `defer`/`async`; fontes com `font-display: swap` e poucos pesos;
      `preconnect` nos domínios críticos.
**Rede & dados**
- [ ] **Round-trips do boot**: mapear a cadeia de chamadas até a 1ª tela útil; **paralelizar** o que é
      independente; evitar chamadas redundantes (mesma sessão/consulta repetida).
- [ ] Cache com estratégia clara (imutável+hash de versão OU revalidação `no-cache`/`ETag`); não apagar
      cache a cada load. CDN. `stale-while-revalidate` quando fizer sentido.
- [ ] Enviar só o delta (não o estado inteiro) em saves grandes; comprimir payloads.
**Runtime**
- [ ] Cálculos caros **memoizados** com chave de invalidação **correta** (cuidado com stale). Não
      recalcular o mesmo N vezes por render.
- [ ] Render: evitar reconstruir a tela inteira a cada tecla; atualização incremental/in-place; **virtual
      scroll** em listas grandes; debounce/throttle em input/scroll/resize.
- [ ] Gráficos/recursos pesados: destruir ao trocar de tela (sem leak); reusar/atualizar em vez de recriar.
- [ ] Sem trabalho síncrono longo na main thread (Web Worker se preciso).

## CHECKLIST — CRONS / JOBS / FILAS
- [ ] **Idempotência**: rodar 2× não duplica efeito (chave de deduplicação / `on conflict`).
- [ ] **Retry com backoff exponencial** + limite; DLQ (fila de mortos) para o que falhar.
- [ ] **Lock/lease** para não rodar concorrente (evitar 2 workers na mesma tarefa); visibilidade da fila.
- [ ] **Timeout** por job; job travado não segura o resto; particionar lotes grandes.
- [ ] **Observabilidade**: log estruturado, métricas (sucesso/erro/duração), alerta em falha; horário e
      fuso corretos.
- [ ] Segurança: job roda com o mínimo de privilégio; valida entrada; não loga segredo.

## CHECKLIST — VELOCIDADE DE TELA (percepção)
- [ ] Alvos: LCP < 2,5 s, TTI baixo, CLS ~0. Meça (Lighthouse/WebPageTest/`performance` API).
- [ ] **Skeleton/loader** imediato (antes do JS) para não mostrar tela branca.
- [ ] Conteúdo acima da dobra primeiro; imagens dimensionadas (sem layout shift); prioridade de recursos.
- [ ] Otimista na UI onde couber; feedback < 100 ms em interações.

---

## FORMATO DE SAÍDA (obrigatório)
### 1) Diagnóstico
Uma tabela por eixo (Segurança, Banco, Performance) com os achados, **do mais grave ao mais leve**:

| # | Severidade | Achado | Evidência (`arquivo:linha`) | Correção (1 linha) |
|---|-----------|--------|------------------------------|--------------------|

Severidade: 🔴 Crítico · 🟠 Alto · 🟡 Médio · 🔵 Baixo/Informativo.
Para o BANCO, inclua o **resumo RLS tabela-por-tabela**.

### 2) Plano por fases
Agrupe as correções em fases executáveis, **client-only antes de servidor**, cada fase com:
- o que muda (arquivos), como testar (comando/passo), e o critério de pronto.
- Ex.: **F1 Segurança crítica (client)** → **F2 Segurança servidor** → **F3 Performance quick-wins**
  → **F4 Performance runtime** → **F5 Documentação**.

### 3) Backlog consciente
O que **não** foi feito e **por quê** (risco > ganho, mudança arquitetural, precisa de decisão de produto),
com o "fazer quando" (gatilho) e o "como" (abordagem segura). Nunca omita em silêncio um item deixado de fora.

### 4) Verificação
Como provar que ficou bom: testes verdes, re-teste de segurança (ex.: acessar como usuário comum e
confirmar bloqueio), headers via `curl -I`, métricas de performance antes/depois.

## Regras de execução (se for aplicar, não só auditar)
- Uma fase por vez: implemente → teste → prove → só então a próxima.
- **Nunca** rode migration/deploy em produção sem autorização explícita do dono.
- Rode a suíte de testes a cada fase; não marque como pronto com teste vermelho ou implementação parcial.
- Toda mudança observável no app: valide de verdade (render/execução real), não presuma.

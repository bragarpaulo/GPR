-- GPR — flag por assinante: permitir "Excluir empresa" (com senha) nas Configurações.
-- DEFAULT LIGADO (pedido do Paulo). É um gate de CONSENTIMENTO/UX, não barreira de segurança:
-- o dono já pode apagar os próprios dados via "Limpar tudo" (profiles_self_upd permite o próprio
-- usuário alterar a flag via API — aceitável por design). Admin liga/desliga no GPR Core. Idempotente.
alter table public.profiles add column if not exists allow_delete_company boolean not null default true;

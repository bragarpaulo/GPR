-- GPR — Onboarding: campos de perfil (setor + instagram) preenchidos no 1º acesso. Idempotente.
alter table public.profiles add column if not exists setor text;
alter table public.profiles add column if not exists instagram text;

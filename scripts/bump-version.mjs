#!/usr/bin/env node
// bump-version.mjs — carimba js/version.js (a versão exibida no GPR Core).
//
// POR QUE ISSO É UM SCRIPT VERSIONADO (e não só um hook):
// o hook vive em .git/hooks/, que NÃO vai no git. Em máquina nova (ou numa sessão na nuvem) os
// commits passavam sem carimbar a versão, e o GPR Core seguia mostrando a versão velha depois do
// deploy — falso-negativo justamente no diagnóstico que o carimbo existe pra dar. Com o script no
// repo, qualquer clone reinstala o hook com um comando:
//
//   node scripts/bump-version.mjs --install-hook     (ou: npm run hook:install)
//
// Uso:
//   node scripts/bump-version.mjs                 carimba a PRÓXIMA versão e faz `git add`
//   node scripts/bump-version.mjs --no-add        carimba sem mexer no index (uso avulso)
//   node scripts/bump-version.mjs --print         só imprime qual seria a próxima versão
//   node scripts/bump-version.mjs --install-hook  (re)instala .git/hooks/pre-commit
//
// CLONE RASO (a pegadinha que motivou o max() abaixo): `git rev-list --count HEAD` conta só o que
// foi clonado. Num clone `--depth` (Codespaces, CI, Claude na nuvem) isso dá um número MENOR que o
// real — a receita antiga escreveria v51 onde produção está em v121, ou seja, a versão ANDARIA PRA
// TRÁS. Por isso o contador é max(commits, versão já gravada) + 1: num clone completo os dois
// concordam; num raso o arquivo (que é versionado, logo sempre correto no HEAD) manda.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const ARQ_VERSAO = join(RAIZ, 'js', 'version.js');
const HOOK = join(RAIZ, '.git', 'hooks', 'pre-commit');

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

/** Commits alcançáveis no HEAD. Em clone raso vem baixo de propósito — ver nota no topo. */
function commitsNoHead() {
  try { return Number(git('rev-list', '--count', 'HEAD')) || 0; } catch { return 0; }  // repo sem commit ainda
}

/** Número da versão já gravada em js/version.js (0 se o arquivo não existir / não casar). */
function versaoGravada() {
  try { return Number(/v(\d+)/.exec(readFileSync(ARQ_VERSAO, 'utf8'))?.[1]) || 0; } catch { return 0; }
}

/** "29/08/2026 14:07" no fuso do projeto — o carimbo tem que dizer a mesma coisa no Mac e na nuvem. */
function agoraBR() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function proximaVersao() {
  return `v${Math.max(commitsNoHead(), versaoGravada()) + 1}`;
}

function carimbar({ add }) {
  const versao = `${proximaVersao()} · ${agoraBR()}`;
  writeFileSync(ARQ_VERSAO,
    '// Gerado automaticamente por scripts/bump-version.mjs (hook pre-commit) — NÃO editar à mão.\n' +
    `export const VERSION = '${versao}';\n`);
  if (add) git('add', '--', ARQ_VERSAO);
  return versao;
}

function instalarHook() {
  mkdirSync(dirname(HOOK), { recursive: true });
  writeFileSync(HOOK, '#!/bin/sh\n' +
    '# Instalado por scripts/bump-version.mjs --install-hook. Carimba js/version.js a cada commit.\n' +
    '# Se o node não estiver no PATH, não trava o commit — só avisa (a versão fica velha).\n' +
    'command -v node >/dev/null 2>&1 || { echo "pre-commit: node ausente, versão NÃO carimbada"; exit 0; }\n' +
    'exec node "$(git rev-parse --show-toplevel)/scripts/bump-version.mjs"\n');
  chmodSync(HOOK, 0o755);
  return HOOK;
}

const flags = process.argv.slice(2);
if (flags.includes('--install-hook')) {
  console.log(`hook instalado: ${instalarHook()}\npróximo commit carimbará ${proximaVersao()}`);
} else if (flags.includes('--print')) {
  console.log(proximaVersao());
} else {
  console.log(`versão carimbada: ${carimbar({ add: !flags.includes('--no-add') })}`);
}

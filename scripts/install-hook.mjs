#!/usr/bin/env node
// Setup: install Bun (for accurate hashing) + Stop hook for auto-swap
import { readFileSync, writeFileSync, existsSync, copyFileSync, symlinkSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { saveInstallContext, maskUserId } from '../src/context.mjs';
import { resolveBunExecutable } from '../src/bun-runtime.mjs';
import { resolvePwshExecutable } from '../src/shell-runtime.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const SETTINGS = resolve(HOME, '.claude', 'settings.json');
const SWAP_SRC = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'buddy-swap.mjs');
const SWAP_DST = resolve(HOME, '.claude', 'buddy-swap.mjs');
const HOOK_CMD = `node ${SWAP_DST.replace(/\\/g, '/')}`;

try {
  // 1. Install Bun if not present (needed for accurate Bun.hash)
  try {
    const bunExecutable = resolveBunExecutable();
    if (!bunExecutable) throw new Error('bun missing');
    execSync(`"${bunExecutable}" --version`, { stdio: 'pipe' });
    console.log(`✓ Bun already installed (${bunExecutable})`);
  } catch {
    console.log('⏳ Installing Bun (for accurate buddy prediction)...');
    try {
      if (process.platform === 'win32') {
        const pwsh = resolvePwshExecutable();
        execSync(`"${pwsh}" -NoLogo -NoProfile -Command "irm bun.sh/install.ps1 | iex"`, { stdio: 'inherit', timeout: 60000 });
      } else {
        execSync('curl -fsSL https://bun.sh/install | bash', { stdio: 'inherit', timeout: 60000 });
      }
      const bunExecutable = resolveBunExecutable();
      if (!bunExecutable) {
        throw new Error('Bun installed but executable was not found in standard locations');
      }
      console.log(`✓ Bun installed (${bunExecutable})`);
    } catch {
      console.log('✗ Bun install failed — accurate buddy prediction requires Bun.hash');
      console.log('  Manual install: https://bun.sh/docs/installation');
      process.exit(1);
    }
  }

  // 2. Create CLI symlinks (buddy, bdy) so plugin users get CLI too
  const CLI_SRC = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'src', 'cli.mjs');
  const BIN_DIR = resolve(HOME, '.local', 'bin');
  for (const name of ['buddy', 'bdy']) {
    const ext = process.platform === 'win32' ? '.cmd' : '';
    const target = resolve(BIN_DIR, name + ext);
    try {
      if (existsSync(target)) unlinkSync(target);
      if (process.platform === 'win32') {
        // Windows: create .cmd shim since symlinks need admin
        writeFileSync(target, `@echo off\r\nnode "${CLI_SRC}" %*\r\n`);
      } else {
        // Unix: symlink works
        writeFileSync(target, `#!/bin/sh\nexec node "${CLI_SRC}" "$@"\n`);
        execSync(`chmod +x "${target}"`, { stdio: 'pipe' });
      }
      console.log(`✓ ${name} CLI → ${target}`);
    } catch (e) {
      console.log(`⚠ ${name} CLI 생성 실패 (${e.message}) — npm i -g 로 설치하세요`);
    }
  }

  // 3. Copy swap script
  copyFileSync(SWAP_SRC, SWAP_DST);
  console.log('✓ buddy-swap.mjs copied to ~/.claude/');

  const context = saveInstallContext();
  console.log(`✓ Runtime context saved: ${context.path}`);
  console.log(`  Install: ${context.install?.type ?? 'not-found'}`);
  console.log(`  User: ${maskUserId(context.userId)}`);
  console.log(`  SALT: ${context.currentSalt}`);

  // Read settings
  let settings = {};
  if (existsSync(SETTINGS)) {
    settings = JSON.parse(readFileSync(SETTINGS, 'utf-8'));
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  // Check if already installed
  const existing = settings.hooks.Stop.find(entry =>
    entry.hooks?.some(h => h.command?.includes('buddy-swap'))
  );

  if (existing) {
    console.log('✓ Hook already installed');
    process.exit(0);
  }

  // Find the wildcard matcher entry, or create one
  let wildcardEntry = settings.hooks.Stop.find(e => e.matcher === '*');
  if (!wildcardEntry) {
    wildcardEntry = { matcher: '*', hooks: [] };
    settings.hooks.Stop.push(wildcardEntry);
  }

  // Add hook
  wildcardEntry.hooks.push({
    type: 'command',
    command: HOOK_CMD,
    timeout: 5,
  });

  writeFileSync(SETTINGS, JSON.stringify(settings, null, 2), 'utf-8');
  console.log('✓ Stop hook added to settings.json');
  console.log('  Claude Code 종료 시 buddy 패치가 자동 적용됩니다!');
} catch (err) {
  console.error('✗ Hook install failed:', err.message);
  process.exit(1);
}

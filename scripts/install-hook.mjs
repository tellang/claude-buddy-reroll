#!/usr/bin/env node
// Setup: install Bun (for accurate hashing) + Stop hook for auto-swap
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { saveInstallContext, maskUserId } from '../src/context.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const SETTINGS = resolve(HOME, '.claude', 'settings.json');
const SWAP_SRC = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'buddy-swap.mjs');
const SWAP_DST = resolve(HOME, '.claude', 'buddy-swap.mjs');
const HOOK_CMD = `node ${SWAP_DST.replace(/\\/g, '/')}`;

try {
  // 1. Install Bun if not present (needed for accurate Bun.hash)
  try {
    execSync('bun --version', { stdio: 'pipe' });
    console.log('✓ Bun already installed');
  } catch {
    console.log('⏳ Installing Bun (for accurate buddy prediction)...');
    try {
      if (process.platform === 'win32') {
        execSync('powershell -c "irm bun.sh/install.ps1 | iex"', { stdio: 'inherit', timeout: 60000 });
      } else {
        execSync('curl -fsSL https://bun.sh/install | bash', { stdio: 'inherit', timeout: 60000 });
      }
      console.log('✓ Bun installed');
    } catch {
      console.log('✗ Bun install failed — accurate buddy prediction requires Bun.hash');
      console.log('  Manual install: https://bun.sh/docs/installation');
      process.exit(1);
    }
  }

  // 2. Copy swap script
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

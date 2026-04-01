#!/usr/bin/env node
// Adds buddy-swap Stop hook to Claude Code settings.json
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const SETTINGS = resolve(HOME, '.claude', 'settings.json');
const SWAP_SRC = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'buddy-swap.sh');
const SWAP_DST = resolve(HOME, '.claude', 'buddy-swap.sh');
const HOOK_CMD = `bash ${SWAP_DST.replace(/\\/g, '/')}`;

try {
  // Copy swap script
  copyFileSync(SWAP_SRC, SWAP_DST);
  console.log('✓ buddy-swap.sh copied to ~/.claude/');

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

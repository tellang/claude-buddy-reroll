// SALT patcher for Claude Code cli.js
// Replaces the buddy companion SALT to reroll your buddy

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { ORIGINAL_SALT } from './engine.mjs';

// Find Claude Code's cli.js location
export function findCliJs() {
  const candidates = [];

  // npm global install
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    candidates.push(resolve(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js'));
  } catch {}

  // Common npm paths (Windows)
  const home = process.env.USERPROFILE || process.env.HOME || '';
  candidates.push(
    resolve(home, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    resolve(home, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
  );

  // Unix paths
  candidates.push(
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js',
  );

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Read current SALT from cli.js
export function readCurrentSalt(cliJsPath) {
  const content = readFileSync(cliJsPath, 'utf-8');
  // The SALT variable pattern: fk_="<salt>"  or  var fk_="<salt>"
  // In the bundle it appears as: fk_="friend-2026-401"
  // But after patching it could be anything of 15 chars
  // We search for the pattern in the companion system context
  const match = content.match(/companionReaction[\s\S]{0,5000}?fk_="([^"]{10,20})"/);
  if (match) return match[1];

  // Fallback: search for original SALT
  if (content.includes(ORIGINAL_SALT)) return ORIGINAL_SALT;

  // Fallback: search for any buddy-reroll salt
  const rerollMatch = content.match(/"(buddy-reroll-[a-z0-9]{2})"/);
  if (rerollMatch) return rerollMatch[1];

  return null;
}

// Patch SALT in cli.js
export function patchSalt(cliJsPath, currentSalt, newSalt) {
  if (newSalt.length !== currentSalt.length) {
    // Pad or trim to match length (safety)
    newSalt = newSalt.padEnd(currentSalt.length, '0').slice(0, currentSalt.length);
  }

  // Backup first
  const backupPath = cliJsPath + '.buddy-backup';
  if (!existsSync(backupPath)) {
    copyFileSync(cliJsPath, backupPath);
  }

  const content = readFileSync(cliJsPath, 'utf-8');
  const patched = content.replaceAll(`"${currentSalt}"`, `"${newSalt}"`);

  if (patched === content) {
    return { success: false, error: 'SALT not found in file' };
  }

  writeFileSync(cliJsPath, patched, 'utf-8');
  return { success: true, backupPath };
}

// Restore original SALT from backup
export function restoreOriginal(cliJsPath) {
  const backupPath = cliJsPath + '.buddy-backup';
  if (!existsSync(backupPath)) {
    return { success: false, error: 'No backup found' };
  }
  copyFileSync(backupPath, cliJsPath);
  return { success: true };
}

// SALT patcher for Claude Code — supports both native binary and npm installs
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { ORIGINAL_SALT } from './engine.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';

// ─── Install Detection ──────────────────────────────

export function detectInstall() {
  const native = findNativeBinary();
  const npm = findNpmCliJs();
  if (native) return { type: 'native', path: native };
  if (npm) return { type: 'npm', path: npm };
  return null;
}

function findNativeBinary() {
  const candidates = [
    resolve(HOME, '.local', 'bin', 'claude.exe'),
    resolve(HOME, '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Try `which`
  try {
    const out = execSync('which claude', { encoding: 'utf-8' }).trim();
    if (out && existsSync(out) && !out.includes('node_modules')) return out;
  } catch {}
  return null;
}

function findNpmCliJs() {
  const candidates = [];
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    candidates.push(resolve(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js'));
  } catch {}
  candidates.push(
    resolve(HOME, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    resolve(HOME, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
  );
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

// ─── SALT Read ──────────────────────────────────────

export function readCurrentSalt(install) {
  if (!install) return null;
  const content = readFileSync(install.path);

  // Search for current SALT (could be original or already patched)
  const textContent = install.type === 'npm'
    ? content.toString('utf-8')
    : content.toString('binary');

  if (textContent.includes(ORIGINAL_SALT)) return ORIGINAL_SALT;

  // Check for patched salt
  const match = textContent.match(/buddy-reroll-[a-z0-9]{2}/);
  if (match) return match[0];

  return null;
}

// ─── SALT Patch ─────────────────────────────────────

export function patchSalt(install, currentSalt, newSalt) {
  if (!install || !currentSalt) {
    return { success: false, error: 'Install or current SALT not found' };
  }

  // Validate salt characters
  if (!/^[a-z0-9-]+$/.test(newSalt)) {
    return { success: false, error: 'Invalid salt characters (a-z, 0-9, - only)' };
  }

  // Enforce same length
  if (newSalt.length !== currentSalt.length) {
    newSalt = newSalt.padEnd(currentSalt.length, '0').slice(0, currentSalt.length);
  }

  // Backup
  const backupPath = install.path + '.buddy-backup';
  if (!existsSync(backupPath)) {
    copyFileSync(install.path, backupPath);
  }

  if (install.type === 'npm') {
    return patchNpm(install.path, currentSalt, newSalt, backupPath);
  } else {
    return patchNative(install.path, currentSalt, newSalt, backupPath);
  }
}

function patchNpm(filePath, currentSalt, newSalt, backupPath) {
  // npm: text-based replacement in cli.js
  const content = readFileSync(filePath, 'utf-8');
  const patched = content.replaceAll(`"${currentSalt}"`, `"${newSalt}"`);
  if (patched === content) {
    return { success: false, error: 'SALT not found in cli.js' };
  }
  writeFileSync(filePath, patched, 'utf-8');
  return { success: true, backupPath, type: 'npm' };
}

function patchNative(filePath, currentSalt, newSalt, backupPath) {
  // native: binary-safe Buffer replacement
  const buf = readFileSync(filePath);
  const oldBytes = Buffer.from(currentSalt, 'utf-8');
  const newBytes = Buffer.from(newSalt, 'utf-8');

  let count = 0, offset = 0;
  while (true) {
    const idx = buf.indexOf(oldBytes, offset);
    if (idx === -1) break;
    newBytes.copy(buf, idx);
    count++;
    offset = idx + oldBytes.length;
  }

  if (count === 0) {
    return { success: false, error: 'SALT not found in binary' };
  }

  // native binary may be locked if running — write to temp then instruct swap
  const patchedPath = filePath + '.patched';
  writeFileSync(patchedPath, buf);
  return {
    success: true,
    backupPath,
    type: 'native',
    patchedPath,
    count,
    needsSwap: true,
    swapCommand: process.platform === 'win32'
      ? `mv "${filePath}" "${filePath}.old" && mv "${patchedPath}" "${filePath}"`
      : `mv "${patchedPath}" "${filePath}"`,
  };
}

// ─── Soul (name/personality) ────────────────────────

export function clearSoul() {
  const configPath = resolve(HOME, '.claude.json');
  if (!existsSync(configPath)) return { success: false, error: '.claude.json not found' };

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const old = config.companion;
  if (!old) return { success: true, oldName: null };

  delete config.companion;
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return { success: true, oldName: old.name, oldPersonality: old.personality };
}

// ─── Restore ────────────────────────────────────────

export function restoreOriginal() {
  const install = detectInstall();
  if (!install) return { success: false, error: 'Claude Code not found' };

  const backupPath = install.path + '.buddy-backup';
  if (!existsSync(backupPath)) {
    return { success: false, error: 'No backup found' };
  }

  if (install.type === 'npm') {
    copyFileSync(backupPath, install.path);
    return { success: true, type: 'npm' };
  } else {
    // Native might be locked — write restore script
    const restorePath = install.path;
    try {
      copyFileSync(backupPath, restorePath);
      return { success: true, type: 'native' };
    } catch {
      return {
        success: false,
        type: 'native',
        error: 'Binary locked (Claude running). Close Claude Code first, then run:',
        command: `cp "${backupPath}" "${restorePath}"`,
      };
    }
  }
}

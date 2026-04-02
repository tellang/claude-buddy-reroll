import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

function windowsExe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function lookupOnPath(command) {
  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    const out = execSync(`${locator} ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const first = out.split(/\r?\n/).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

export function getBunCandidates(env = process.env) {
  const home = env.USERPROFILE || env.HOME || '';
  const localAppData = env.LOCALAPPDATA || '';
  const bunInstall = env.BUN_INSTALL || resolve(home, '.bun');
  const exeName = windowsExe('bun');

  return [
    env.BUN_EXE,
    resolve(bunInstall, 'bin', exeName),
    resolve(bunInstall, 'bin', 'bun'),
    localAppData ? resolve(localAppData, 'Programs', 'Bun', exeName) : null,
    localAppData ? resolve(localAppData, 'bun', 'bin', exeName) : null,
    lookupOnPath('bun'),
  ].filter(Boolean);
}

export function resolveBunExecutable(env = process.env) {
  for (const candidate of getBunCandidates(env)) {
    if (candidate === 'bun') return candidate;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

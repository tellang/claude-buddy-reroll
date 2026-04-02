import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

function lookupOnPath(command) {
  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    const out = execSync(`${locator} ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return out.split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

export function resolvePwshExecutable(env = process.env) {
  const programFiles = env['ProgramFiles'] || 'C:\\Program Files';
  const windowsPowerShell = env.WINDIR ? resolve(env.WINDIR, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : null;
  const candidates = [
    lookupOnPath('pwsh'),
    lookupOnPath('powershell'),
    resolve(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    resolve(programFiles, 'PowerShell', '6', 'pwsh.exe'),
    windowsPowerShell,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.endsWith('.exe')) {
      if (existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'powershell' : 'sh';
}

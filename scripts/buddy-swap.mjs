#!/usr/bin/env node
// Auto-swap buddy-patched binary on Claude Code exit
// Works on cmd, PowerShell, bash — no shell dependency
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const ext = process.platform === 'win32' ? '.exe' : '';
const patched = resolve(HOME, '.local', 'bin', `claude-patched${ext}`);
const target = resolve(HOME, '.local', 'bin', `claude${ext}`);

if (!existsSync(patched)) process.exit(0);

// Retry copy — binary may still be locked briefly after Claude exits
let ok = false;
for (let i = 0; i < 10; i++) {
  try {
    copyFileSync(patched, target);
    ok = true;
    break;
  } catch {
    await new Promise(r => setTimeout(r, 2000));
  }
}

if (ok) {
  try { unlinkSync(patched); } catch {}
}

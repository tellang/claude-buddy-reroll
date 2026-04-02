#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const installHookPath = fileURLToPath(new URL('./install-hook.mjs', import.meta.url));

try {
  execFileSync(process.execPath, [installHookPath], { stdio: 'inherit' });
} catch (error) {
  const message = error?.message || String(error);
  console.warn(`\n[buddy-reroll] postinstall setup skipped: ${message}`);
  console.warn('[buddy-reroll] Run `bdy setup` later if Bun or Claude hooks are missing.\n');
}

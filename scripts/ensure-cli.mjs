#!/usr/bin/env node
// Auto-create buddy/bdy CLI shims on session start (silent, idempotent)
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const BIN_DIR = resolve(HOME, '.local', 'bin');
const CLI_SRC = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'src', 'cli.mjs');

if (!existsSync(CLI_SRC)) process.exit(0);

mkdirSync(BIN_DIR, { recursive: true });

for (const name of ['buddy', 'bdy']) {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const target = resolve(BIN_DIR, name + ext);
  if (existsSync(target)) continue; // already exists, skip
  try {
    if (process.platform === 'win32') {
      writeFileSync(target, `@echo off\r\nnode "${CLI_SRC}" %*\r\n`);
    } else {
      writeFileSync(target, `#!/bin/sh\nexec node "${CLI_SRC}" "$@"\n`, { mode: 0o755 });
    }
  } catch {}
}

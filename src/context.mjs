import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { compareVersions, detectInstall, readCurrentSalt, readInstallVersion } from './patcher.mjs';
import { ORIGINAL_SALT } from './engine.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const CLAUDE_CONFIG_PATH = resolve(HOME, '.claude.json');
const CLAUDE_DIR = resolve(HOME, '.claude');
const INSTALL_CONTEXT_PATH = resolve(CLAUDE_DIR, 'buddy-reroll-install.json');
export const MIN_SUPPORTED_CLAUDE_VERSION = '2.1.89';

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function readClaudeConfig() {
  return readJson(CLAUDE_CONFIG_PATH);
}

export function readUserId(config = readClaudeConfig()) {
  if (!config) {
    return readJson(INSTALL_CONTEXT_PATH)?.userId ?? 'anon';
  }
  return (
    config.oauthAccount?.accountUuid ??
    config.oauthAccount?.id ??
    config.userID ??
    config.userId ??
    config.accountUuid ??
    'anon'
  );
}

export function maskUserId(userId) {
  if (!userId || userId === 'anon') return 'anonymous';
  return `${userId.slice(0, 8)}...`;
}

export function resolveClaudeContext() {
  const stored = readJson(INSTALL_CONTEXT_PATH);
  const install = detectInstall();
  const installVersion = (install ? readInstallVersion(install) : null) ?? stored?.installVersion ?? null;
  const currentSalt = (install ? readCurrentSalt(install) : null) ?? stored?.currentSalt ?? ORIGINAL_SALT;
  const userId = readUserId();
  const patchSupported = !installVersion || compareVersions(installVersion, MIN_SUPPORTED_CLAUDE_VERSION) >= 0;
  return { install, installVersion, patchSupported, userId, currentSalt };
}

export function saveInstallContext() {
  const context = resolveClaudeContext();
  mkdirSync(CLAUDE_DIR, { recursive: true });
  writeFileSync(
    INSTALL_CONTEXT_PATH,
    JSON.stringify(
      {
        detectedAt: new Date().toISOString(),
        install: context.install,
        installVersion: context.installVersion,
        userId: context.userId,
        currentSalt: context.currentSalt,
      },
      null,
      2,
    ),
    'utf-8',
  );
  return { ...context, path: INSTALL_CONTEXT_PATH };
}

export function updatePatchedSalt(newSalt) {
  const stored = readJson(INSTALL_CONTEXT_PATH) || {};
  stored.currentSalt = newSalt;
  stored.patchedAt = new Date().toISOString();
  mkdirSync(CLAUDE_DIR, { recursive: true });
  writeFileSync(INSTALL_CONTEXT_PATH, JSON.stringify(stored, null, 2), 'utf-8');
}

export { INSTALL_CONTEXT_PATH };

#!/usr/bin/env node

// Claude Buddy Reroll — Gacha simulator + SALT patcher
// Supports both native binary and npm installs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { roll, multiRoll, ORIGINAL_SALT, EYES, HATS, STATS, RARITY_STARS } from './engine.mjs';
import { patchSalt, clearSoul, restoreOriginal } from './patcher.mjs';
import { resolveClaudeContext, updatePatchedSalt } from './context.mjs';
import { renderCard, renderMiniCard } from './display.mjs';
import { addBatchToCollection, renderCollection } from './collection.mjs';
import { playHatchAnimation } from './animation.mjs';
import { createInterface } from 'readline';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const STATE_PATH = resolve(HOME, '.claude', 'buddy-reroll-state.json');
const BASE_LIMIT = 3;
const STAR_BONUS = 1; // starred users get 1 extra roll (4 total = 40 pulls)
const DEFAULT_PULLS = 10;
const APOLOGY_EVENT = {
  id: 'apology-2026-04-bun-fix',
  bonusRuns: 2,
  pullsPerRun: 5,
};

// ─── Star check ─────────────────────────────────────

let _starCache = null;

async function isStarred() {
  if (_starCache !== null) return _starCache;

  // Check persisted state first — once starred, never call gh again
  try {
    const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf-8')) : {};
    if (state.starred === true) {
      _starCache = true;
      return true;
    }
  } catch {}

  try {
    const { execSync } = await import('child_process');
    const out = execSync('gh api user --jq .login', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] }).trim();
    if (!out) { _starCache = false; return false; }
    const stars = execSync('gh api repos/tellang/claude-buddy-reroll/stargazers --jq ".[].login"', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] });
    _starCache = stars.includes(out);
    // Persist so we never call gh again
    if (_starCache) {
      try {
        const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf-8')) : {};
        state.starred = true;
        state.starredAt = new Date().toISOString();
        saveState(state);
      } catch {}
    }
    return _starCache;
  } catch {
    _starCache = false;
    return false;
  }
}

async function getDailyLimit() {
  const starred = await isStarred();
  return starred ? BASE_LIMIT + STAR_BONUS : BASE_LIMIT;
}

// ─── State (daily gacha limit) ──────────────────────

function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
      return {
        rolls: [],
        bestRarity: 'common',
        eventUses: [],
        ...parsed,
      };
    }
  } catch {}
  return { rolls: [], bestRarity: 'common', eventUses: [] };
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getRollsToday(state) {
  const today = todayKey();
  return (state.rolls || []).filter(r => r.date === today).length;
}

function getApologyEventUses(state) {
  return (state.eventUses || []).filter(event => event.id === APOLOGY_EVENT.id).length;
}

function getApologyEventRemaining(state) {
  return Math.max(0, APOLOGY_EVENT.bonusRuns - getApologyEventUses(state));
}

function recordRoll(state, mode = 'daily') {
  if (mode === 'event') {
    if (!state.eventUses) state.eventUses = [];
    state.eventUses.push({ id: APOLOGY_EVENT.id, ts: Date.now() });
  } else {
    if (!state.rolls) state.rolls = [];
    state.rolls.push({ date: todayKey(), ts: Date.now() });
  }
  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 86400000;
  state.rolls = state.rolls.filter(r => r.ts > cutoff);
  state.eventUses = (state.eventUses || []).filter(r => r.ts > cutoff);
  saveState(state);
}

async function getRollAllowance(state, options = {}) {
  const supportsEvent = options.supportsEvent ?? false;
  const limit = await getDailyLimit();
  const used = getRollsToday(state);
  const starred = await isStarred();
  const eventRemaining = getApologyEventRemaining(state);

  if (used < limit) {
    return {
      allowed: true,
      mode: 'daily',
      pullCount: DEFAULT_PULLS,
      limit,
      used,
      starred,
      eventRemaining,
    };
  }

  if (supportsEvent && eventRemaining > 0) {
    return {
      allowed: true,
      mode: 'event',
      pullCount: APOLOGY_EVENT.pullsPerRun,
      limit,
      used,
      starred,
      eventRemaining,
    };
  }

  return {
    allowed: false,
    mode: 'blocked',
    pullCount: 0,
    limit,
    used,
    starred,
    eventRemaining,
  };
}

async function checkLimit(state, options = {}) {
  const allowance = await getRollAllowance(state, options);
  const { allowed, mode, pullCount, limit, used, starred, eventRemaining } = allowance;

  if (!allowed) {
    console.log(`\n${YELLOW}  ⚠ 오늘 가챠 ${limit}회 소진! 내일 다시 도전하세요.${RESET}`);
    if (eventRemaining === 0) {
      console.log(`${DIM}  이벤트 보상 5연차 2회도 모두 사용했습니다.${RESET}`);
    }
    if (!starred) console.log(`${DIM}  💡 GitHub Star 찍으면 +1회 보너스! (30뽑 → 40뽑)${RESET}`);
    console.log(`${DIM}  (${used}/${limit} used today)${RESET}\n`);
    return allowance;
  }

  const tag = starred ? ' ⭐' : '';
  if (mode === 'event') {
    console.log(`${DIM}  이벤트 보상 사용 가능: ${eventRemaining}/${APOLOGY_EVENT.bonusRuns} | 이번 차수 ${pullCount}연차${RESET}`);
  } else {
    console.log(`${DIM}  가챠 잔여: ${limit - used}/${limit}${tag}${RESET}`);
    if (eventRemaining > 0) {
      console.log(`${DIM}  이벤트 보상: 5연차 ${eventRemaining}회 남음${RESET}`);
    }
  }
  return allowance;
}

// ─── Rarity helpers ─────────────────────────────────

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

function isUpgrade(oldRarity, newRarity) {
  return RARITY_ORDER[newRarity] > RARITY_ORDER[oldRarity];
}

// ─── Star request (Speaki style) ────────────────────

function speakiStarRequest(species, rarity) {
  const msgs = [
    `흐헤헤~ ${species} ${RARITY_STARS[rarity]} 뽑았다!! 축하축하~!`,
    `이 정도면 GitHub Star 하나쯤은... 괜찮지 않을까? 👉👈`,
    ``,
    `  ${CYAN}gh repo star tellang/claude-buddy-reroll${RESET}`,
    ``,
    `별 하나만... 제발... ${species}(이)가 기뻐할 거예요...! ⭐`,
  ];
  console.log();
  for (const m of msgs) console.log(`${MAGENTA}  ${m}${RESET}`);
  console.log();
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()); }));
}

function requireClaudeContext(options = {}) {
  const { needsInstall = false, needsSalt = false } = options;
  const context = resolveClaudeContext();

  if (!context.userId || context.userId === 'anon') {
    console.log(`\n${RED}  ✗ Claude account ID를 ~/.claude.json 에서 찾지 못했습니다.${RESET}`);
    console.log(`${DIM}  oauthAccount.accountUuid 또는 userID가 필요합니다.${RESET}\n`);
    return null;
  }

  if (needsInstall && !context.install) {
    console.log(`\n${RED}  ✗ Claude Code 설치를 찾지 못했습니다.${RESET}\n`);
    return null;
  }

  if (needsSalt && !context.currentSalt) {
    console.log(`\n${RED}  ✗ 설치된 Claude Code에서 현재 SALT를 동적으로 읽지 못했습니다.${RESET}`);
    console.log(`${DIM}  install-hook을 다시 실행하거나 설치 경로를 확인해 주세요.${RESET}\n`);
    return null;
  }

  return context;
}

// ─── Commands ───────────────────────────────────────

async function cmdCheck() {
  const context = requireClaudeContext();
  if (!context) return;
  const { userId, install, currentSalt } = context;

  console.log(`\n${DIM}Account: ${userId === 'anon' ? 'anonymous' : userId.slice(0, 8) + '...'}${RESET}`);

  if (install) {
    console.log(`${DIM}Install: ${install.type} (${install.path})${RESET}`);
    const patched = currentSalt && currentSalt !== ORIGINAL_SALT;
    console.log(`${DIM}SALT: ${currentSalt}${patched ? ' (patched!)' : ' (original)'}${RESET}`);
    const result = roll(userId, currentSalt);
    console.log(renderCard(result));
  } else {
    console.log(`${DIM}Claude Code not found — using original SALT${RESET}`);
    console.log(renderCard(roll(userId, ORIGINAL_SALT)));
  }

  const state = loadState();
  const limit = await getDailyLimit();
  const used = getRollsToday(state);
  const starred = await isStarred();
  const tag = starred ? ' ⭐' : '';
  console.log(`${DIM}오늘 가챠: ${used}/${limit}${tag}${RESET}\n`);
  const eventRemaining = getApologyEventRemaining(state);
  if (eventRemaining > 0) {
    console.log(`${DIM}이벤트 보상: 5연차 ${eventRemaining}/${APOLOGY_EVENT.bonusRuns} 남음${RESET}\n`);
  }
}

async function cmdGacha(count = 10) {
  const state = loadState();
  const allowance = await checkLimit(state, { supportsEvent: true });
  if (!allowance.allowed) return;

  const context = requireClaudeContext();
  if (!context) return;
  const { userId } = context;
  const rollCount = allowance.mode === 'event' ? allowance.pullCount : count;
  console.log(`\n${BOLD}  🎰 BUDDY GACHA — Rolling ${rollCount}x...${RESET}\n`);

  const results = multiRoll(userId, rollCount);

  for (let i = 0; i < results.length; i++) {
    console.log(renderMiniCard(results[i], i));
  }

  // Stats summary
  const rarityCount = {};
  for (const r of results) {
    rarityCount[r.bones.rarity] = (rarityCount[r.bones.rarity] || 0) + 1;
  }
  console.log(`\n${DIM}  Results: ${Object.entries(rarityCount).map(([k, v]) => `${k}:${v}`).join(' ')}${RESET}`);

  // Best pull
  const best = results.reduce((a, b) =>
    RARITY_ORDER[a.bones.rarity] >= RARITY_ORDER[b.bones.rarity] ? a : b
  );
  const bestIdx = results.indexOf(best);

  console.log(`\n${BOLD}  Best pull: #${bestIdx + 1}${RESET}`);
  await playHatchAnimation(best.bones);
  console.log(renderCard(best, { showSalt: true, index: bestIdx }));

  // Record roll + save to collection
  recordRoll(state, allowance.mode);
  addBatchToCollection(results);

  // Check upgrade → star request
  if (isUpgrade(state.bestRarity || 'common', best.bones.rarity)) {
    state.bestRarity = best.bones.rarity;
    saveState(state);
    speakiStarRequest(best.bones.species, best.bones.rarity);
  }

  // View details
  const answer = await ask(`  View details? (1-${rollCount}) or 'q': `);
  if (answer && answer !== 'q') {
    const idx = parseInt(answer) - 1;
    if (idx >= 0 && idx < results.length) {
      console.log(renderCard(results[idx], { showSalt: true, index: idx }));
    }
  }
}

async function cmdReroll() {
  const state = loadState();
  const allowance = await checkLimit(state, { supportsEvent: false });
  if (!allowance.allowed) return;

  const context = requireClaudeContext({ needsInstall: true, needsSalt: true });
  if (!context) return;
  const { userId, install, currentSalt } = context;

  console.log(`\n${BOLD}  🔄 BUDDY REROLL${RESET}`);
  console.log(`${DIM}  Install: ${install.type} | SALT: ${currentSalt}${RESET}\n`);

  console.log(`${BOLD}  Current buddy:${RESET}`);
  console.log(renderCard(roll(userId, currentSalt)));

  // Roll candidates
  const count = allowance.pullCount;
  console.log(`${BOLD}  Rolling ${count} candidates...${RESET}\n`);
  const candidates = multiRoll(userId, count);

  for (let i = 0; i < candidates.length; i++) {
    console.log(renderMiniCard(candidates[i], i));
  }

  const choice = await ask(`\n  Pick (1-${count}), 'more', or 'q': `);

  if (choice === 'more') return cmdReroll();
  if (choice === 'q' || !choice) {
    console.log(`${DIM}  Cancelled.${RESET}\n`);
    return;
  }

  const idx = parseInt(choice) - 1;
  if (idx < 0 || idx >= candidates.length) {
    console.log(`${RED}  Invalid${RESET}`);
    return;
  }

  const selected = candidates[idx];
  console.log(`\n${BOLD}  Selected:${RESET}`);
  console.log(renderCard(selected, { showSalt: true, index: idx }));

  const confirm = await ask(`  ${YELLOW}Apply? [y/N]: ${RESET}`);
  if (confirm.toLowerCase() !== 'y') {
    console.log(`${DIM}  Cancelled.${RESET}\n`);
    return;
  }

  // Patch SALT
  const result = patchSalt(install, currentSalt, selected.salt);
  if (!result.success) {
    console.log(`\n${RED}  ✗ Patch failed: ${result.error}${RESET}\n`);
    return;
  }

  // Save new salt so subsequent patches can find it
  updatePatchedSalt(selected.salt);

  // Clear soul (name/personality) so it regenerates
  const soulResult = clearSoul();

  // Record
  recordRoll(state, allowance.mode);

  // Report based on install type
  if (result.type === 'npm') {
    console.log(`\n${GREEN}  ✓ Patched! (npm cli.js)${RESET}`);
    if (soulResult.oldName) console.log(`${DIM}  Soul cleared: ${soulResult.oldName} → (regenerates)${RESET}`);
    console.log(`${DIM}  Restart Claude Code to meet your new buddy.${RESET}\n`);
  } else {
    // Native binary — might need manual swap
    if (result.needsSwap) {
      console.log(`\n${GREEN}  ✓ Patched binary created!${RESET}`);
      if (soulResult.oldName) console.log(`${DIM}  Soul cleared: ${soulResult.oldName} → (regenerates)${RESET}`);
      console.log(`\n${YELLOW}  Native binary is locked (Claude running).${RESET}`);
      console.log(`  Close Claude Code, then run:\n`);
      console.log(`  ${CYAN}${result.swapCommand}${RESET}\n`);
    } else {
      console.log(`\n${GREEN}  ✓ Patched! (native binary)${RESET}`);
      if (soulResult.oldName) console.log(`${DIM}  Soul cleared: ${soulResult.oldName} → (regenerates)${RESET}`);
      console.log(`${DIM}  Restart Claude Code to meet your new buddy.${RESET}\n`);
    }
  }

  // Check upgrade → star request
  const oldRarity = state.bestRarity || 'common';
  if (isUpgrade(oldRarity, selected.bones.rarity)) {
    state.bestRarity = selected.bones.rarity;
    saveState(state);
    speakiStarRequest(selected.bones.species, selected.bones.rarity);
  }
}

async function cmdRestore() {
  const result = restoreOriginal();
  if (result.success) {
    clearSoul();
    console.log(`\n${GREEN}  ✓ Original buddy restored. (${result.type})${RESET}`);
    console.log(`${DIM}  Restart Claude Code.${RESET}\n`);
  } else {
    console.log(`\n${RED}  ✗ ${result.error}${RESET}`);
    if (result.command) console.log(`  ${CYAN}${result.command}${RESET}`);
    console.log();
  }
}

async function cmdDex() {
  // Show collection view
  console.log(renderCollection());

  // Also show game info
  console.log(`${BOLD}  Eyes:${RESET} ${EYES.join('  ')}`);
  console.log(`${BOLD}  Hats:${RESET} ${HATS.filter(h => h !== 'none').join(', ')}`);
  console.log(`${BOLD}  Stats:${RESET} ${STATS.join(', ')}`);
  console.log(`  ${DIM}Shiny chance: 1%${RESET}`);
  const limit = await getDailyLimit();
  const starred = await isStarred();
  const eventRemaining = getApologyEventRemaining(loadState());
  console.log(`  ${DIM}Daily gacha limit: ${limit}${starred ? ' (⭐ star bonus!)' : ' (+1 with GitHub star)'}${RESET}`);
  console.log(`  ${DIM}Apology event: +${APOLOGY_EVENT.bonusRuns} extra ${APOLOGY_EVENT.pullsPerRun}-pulls (${eventRemaining} left)${RESET}\n`);
}

function showHelp() {
  console.log(`
${BOLD}claude-buddy-reroll${RESET} — Reroll your Claude Code buddy companion

${BOLD}Usage:${RESET}
  buddy-reroll check             Show your current buddy
  buddy-reroll gacha [count]     Roll random buddies (default: 10)
  buddy-reroll reroll            Interactive reroll with SALT patch
  buddy-reroll restore           Restore original buddy
  buddy-reroll dex               All species and rarities

${BOLD}Limits:${RESET}
  Daily gacha: ${BASE_LIMIT}x/day (resets at midnight)
  Event bonus: +${APOLOGY_EVENT.bonusRuns} extra gacha runs at ${APOLOGY_EVENT.pullsPerRun} pulls each

${BOLD}Install support:${RESET}
  native binary  ~/.local/bin/claude(.exe) — binary patch
  npm install    node_modules cli.js — text patch

${DIM}Backup created before any patch. 'restore' to undo.${RESET}
`);
}

// ─── Main ───────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'check':   await cmdCheck(); break;
  case 'gacha':   await cmdGacha(Math.min(Math.max(1, parseInt(args[0]) || 10), 100)); break;
  case 'reroll':  await cmdReroll(); break;
  case 'restore': await cmdRestore(); break;
  case 'dex':     await cmdDex(); break;
  case '--help': case '-h': case 'help': showHelp(); break;
  default: showHelp(); break;
}

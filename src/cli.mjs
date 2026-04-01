#!/usr/bin/env node

// Claude Buddy Reroll — Gacha simulator + SALT patcher
// Supports both native binary and npm installs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { roll, multiRoll, randomSalt, ORIGINAL_SALT, SPECIES, EYES, HATS, STATS, RARITIES, RARITY_WEIGHTS, RARITY_STARS } from './engine.mjs';
import { detectInstall, readCurrentSalt, patchSalt, clearSoul, restoreOriginal } from './patcher.mjs';
import { renderCard, renderMiniCard } from './display.mjs';
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

// ─── Star check ─────────────────────────────────────

let _starCache = null;

async function isStarred() {
  if (_starCache !== null) return _starCache;
  try {
    const { execSync } = await import('child_process');
    const out = execSync('gh api user --jq .login', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] }).trim();
    if (!out) { _starCache = false; return false; }
    const stars = execSync('gh api repos/tellang/claude-buddy-reroll/stargazers --jq ".[].login"', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] });
    _starCache = stars.includes(out);
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
    if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {}
  return { rolls: [], bestRarity: 'common' };
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

function recordRoll(state) {
  if (!state.rolls) state.rolls = [];
  state.rolls.push({ date: todayKey(), ts: Date.now() });
  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 86400000;
  state.rolls = state.rolls.filter(r => r.ts > cutoff);
  saveState(state);
}

async function checkLimit(state) {
  const limit = await getDailyLimit();
  const used = getRollsToday(state);
  const starred = await isStarred();
  if (used >= limit) {
    console.log(`\n${YELLOW}  ⚠ 오늘 가챠 ${limit}회 소진! 내일 다시 도전하세요.${RESET}`);
    if (!starred) console.log(`${DIM}  💡 GitHub Star 찍으면 +1회 보너스! (30뽑 → 40뽑)${RESET}`);
    console.log(`${DIM}  (${used}/${limit} used today)${RESET}\n`);
    return false;
  }
  const tag = starred ? ' ⭐' : '';
  console.log(`${DIM}  가챠 잔여: ${limit - used}/${limit}${tag}${RESET}`);
  return true;
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

// ─── User utils ─────────────────────────────────────

function getUserId() {
  const configPath = resolve(HOME, '.claude.json');
  if (!existsSync(configPath)) return 'anon';
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.oauthAccount?.accountUuid ?? config.userID ?? 'anon';
  } catch { return 'anon'; }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()); }));
}

// ─── Commands ───────────────────────────────────────

async function cmdCheck() {
  const userId = getUserId();
  const install = detectInstall();

  console.log(`\n${DIM}Account: ${userId === 'anon' ? 'anonymous' : userId.slice(0, 8) + '...'}${RESET}`);

  if (install) {
    console.log(`${DIM}Install: ${install.type} (${install.path})${RESET}`);
    const salt = readCurrentSalt(install);
    const patched = salt && salt !== ORIGINAL_SALT;
    console.log(`${DIM}SALT: ${salt}${patched ? ' (patched!)' : ' (original)'}${RESET}`);
    const result = roll(userId, salt || ORIGINAL_SALT);
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
}

async function cmdGacha(count = 10) {
  const state = loadState();
  if (!checkLimit(state)) return;

  const userId = getUserId();
  console.log(`\n${BOLD}  🎰 BUDDY GACHA — Rolling ${count}x...${RESET}\n`);

  const results = multiRoll(userId, count);

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
  console.log(renderCard(best, { showSalt: true, index: bestIdx }));

  // Record roll
  recordRoll(state);

  // Check upgrade → star request
  if (isUpgrade(state.bestRarity || 'common', best.bones.rarity)) {
    state.bestRarity = best.bones.rarity;
    saveState(state);
    speakiStarRequest(best.bones.species, best.bones.rarity);
  }

  // View details
  const answer = await ask(`  View details? (1-${count}) or 'q': `);
  if (answer && answer !== 'q') {
    const idx = parseInt(answer) - 1;
    if (idx >= 0 && idx < results.length) {
      console.log(renderCard(results[idx], { showSalt: true, index: idx }));
    }
  }
}

async function cmdReroll() {
  const state = loadState();
  if (!checkLimit(state)) return;

  const install = detectInstall();
  if (!install) {
    console.log(`\n${RED}  ✗ Claude Code not found${RESET}`);
    console.log(`${DIM}  native: ~/.local/bin/claude(.exe)${RESET}`);
    console.log(`${DIM}  npm:    npm i -g @anthropic-ai/claude-code${RESET}\n`);
    return;
  }

  const userId = getUserId();
  const currentSalt = readCurrentSalt(install) || ORIGINAL_SALT;

  console.log(`\n${BOLD}  🔄 BUDDY REROLL${RESET}`);
  console.log(`${DIM}  Install: ${install.type} | SALT: ${currentSalt}${RESET}\n`);

  console.log(`${BOLD}  Current buddy:${RESET}`);
  console.log(renderCard(roll(userId, currentSalt)));

  // Roll candidates
  const count = 10;
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

  // Clear soul (name/personality) so it regenerates
  const soulResult = clearSoul();

  // Record
  recordRoll(state);

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
  console.log(`\n${BOLD}  📖 BUDDY DEX${RESET}`);
  console.log(`  ${'─'.repeat(34)}\n`);

  console.log(`${BOLD}  Species (${SPECIES.length})${RESET}`);
  for (let i = 0; i < SPECIES.length; i++) {
    console.log(`    ${String(i + 1).padStart(2)}. ${SPECIES[i]}`);
  }

  console.log(`\n${BOLD}  Rarities${RESET}`);
  for (const r of RARITIES) {
    console.log(`    ${RARITY_STARS[r].padEnd(6)} ${r.padEnd(10)} (${RARITY_WEIGHTS[r]}%)`);
  }

  console.log(`\n${BOLD}  Eyes:${RESET} ${EYES.join('  ')}`);
  console.log(`${BOLD}  Hats:${RESET} ${HATS.filter(h => h !== 'none').join(', ')}`);
  console.log(`${BOLD}  Stats:${RESET} ${STATS.join(', ')}`);
  console.log(`  ${DIM}Shiny chance: 1%${RESET}`);
  const limit = await getDailyLimit();
  const starred = await isStarred();
  console.log(`  ${DIM}Daily gacha limit: ${limit}${starred ? ' (⭐ star bonus!)' : ' (+1 with GitHub star)'}${RESET}\n`);
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
  Daily gacha: ${DAILY_LIMIT}x/day (resets at midnight)

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

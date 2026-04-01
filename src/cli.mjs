#!/usr/bin/env node

// Claude Buddy Reroll — Gacha simulator + SALT patcher
// Usage:
//   buddy-reroll check          — Show your current buddy
//   buddy-reroll gacha [N]      — Roll N random buddies (default: 10)
//   buddy-reroll reroll          — Interactive reroll with SALT patch
//   buddy-reroll dex             — Show all species/rarities
//   buddy-reroll restore         — Restore original SALT

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { roll, multiRoll, randomSalt, ORIGINAL_SALT, SPECIES, EYES, HATS, STATS, RARITIES, RARITY_WEIGHTS, RARITY_STARS } from './engine.mjs';
import { findCliJs, readCurrentSalt, patchSalt, restoreOriginal } from './patcher.mjs';
import { renderCard, renderMiniCard } from './display.mjs';
import { createInterface } from 'readline';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

function getUserId() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const configPath = resolve(home, '.claude.json');
  if (!existsSync(configPath)) return 'anon';
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.oauthAccount?.accountUuid ?? config.userID ?? 'anon';
  } catch {
    return 'anon';
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()); }));
}

// ─── Commands ────────────────────────────────

async function cmdCheck() {
  const userId = getUserId();
  console.log(`\n${DIM}Account: ${userId === 'anon' ? 'anonymous' : userId.slice(0, 8) + '...'}${RESET}`);

  // Check current SALT
  const cliJs = findCliJs();
  let currentSalt = ORIGINAL_SALT;
  if (cliJs) {
    const detected = readCurrentSalt(cliJs);
    if (detected) currentSalt = detected;
    console.log(`${DIM}SALT: ${currentSalt}${currentSalt !== ORIGINAL_SALT ? ' (patched!)' : ' (original)'}${RESET}`);
  } else {
    console.log(`${DIM}cli.js not found — using original SALT for preview${RESET}`);
  }

  const result = roll(userId, currentSalt);
  console.log(renderCard(result));
}

async function cmdGacha(count = 10) {
  const userId = getUserId();
  console.log(`\n${BOLD}  🎰 BUDDY GACHA — Rolling ${count}x...${RESET}\n`);

  const results = multiRoll(userId, count);

  // Show mini cards
  for (let i = 0; i < results.length; i++) {
    console.log(renderMiniCard(results[i], i));
  }

  // Stats summary
  const rarityCount = {};
  for (const r of results) {
    const rarity = r.bones.rarity;
    rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
  }
  console.log(`\n${DIM}  Results: ${Object.entries(rarityCount).map(([k, v]) => `${k}:${v}`).join(' ')}${RESET}`);

  // Highlight best
  const best = results.reduce((a, b) => {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    return order.indexOf(a.bones.rarity) >= order.indexOf(b.bones.rarity) ? a : b;
  });
  const bestIdx = results.indexOf(best);

  console.log(`\n${BOLD}  Best pull: #${bestIdx + 1}${RESET}`);
  console.log(renderCard(best, { showSalt: true, index: bestIdx }));

  // Ask to view details
  const answer = await ask(`\n  View details? Enter number (1-${count}) or 'q' to quit: `);
  if (answer && answer !== 'q') {
    const idx = parseInt(answer) - 1;
    if (idx >= 0 && idx < results.length) {
      console.log(renderCard(results[idx], { showSalt: true, index: idx }));
    }
  }
}

async function cmdReroll() {
  const cliJs = findCliJs();
  if (!cliJs) {
    console.log(`\n${RED}  ✗ Claude Code cli.js not found${RESET}`);
    console.log(`${DIM}  Install via npm: npm i -g @anthropic-ai/claude-code@latest${RESET}`);
    console.log(`${DIM}  Or use 'gacha' command to preview without patching${RESET}\n`);
    return;
  }

  const userId = getUserId();
  const currentSalt = readCurrentSalt(cliJs) || ORIGINAL_SALT;

  console.log(`\n${BOLD}  🔄 BUDDY REROLL${RESET}`);
  console.log(`${DIM}  Current SALT: ${currentSalt}${RESET}`);
  console.log(`${DIM}  cli.js: ${cliJs}${RESET}\n`);

  console.log(`${BOLD}  Current buddy:${RESET}`);
  console.log(renderCard(roll(userId, currentSalt)));

  // Roll candidates
  const count = 10;
  console.log(`${BOLD}  Rolling ${count} candidates...${RESET}\n`);
  const candidates = multiRoll(userId, count);

  for (let i = 0; i < candidates.length; i++) {
    console.log(renderMiniCard(candidates[i], i));
  }

  // Select
  const choice = await ask(`\n  Pick one to apply (1-${count}), 'more' for 10 more, or 'q' to cancel: `);

  if (choice === 'more') {
    return cmdReroll(); // Recursive reroll
  }

  if (choice === 'q' || !choice) {
    console.log(`\n${DIM}  Cancelled.${RESET}\n`);
    return;
  }

  const idx = parseInt(choice) - 1;
  if (idx < 0 || idx >= candidates.length) {
    console.log(`${RED}  Invalid selection${RESET}`);
    return;
  }

  const selected = candidates[idx];
  console.log(`\n${BOLD}  Selected:${RESET}`);
  console.log(renderCard(selected, { showSalt: true, index: idx }));

  const confirm = await ask(`  ${YELLOW}Apply this buddy? This will patch cli.js [y/N]: ${RESET}`);
  if (confirm.toLowerCase() !== 'y') {
    console.log(`\n${DIM}  Cancelled.${RESET}\n`);
    return;
  }

  // Patch!
  const result = patchSalt(cliJs, currentSalt, selected.salt);
  if (result.success) {
    console.log(`\n${GREEN}  ✓ Patched! Your new buddy is ready.${RESET}`);
    console.log(`${DIM}  Backup saved to: ${result.backupPath}${RESET}`);
    console.log(`${DIM}  Restart Claude Code to see your new buddy.${RESET}\n`);
  } else {
    console.log(`\n${RED}  ✗ Patch failed: ${result.error}${RESET}\n`);
  }
}

async function cmdRestore() {
  const cliJs = findCliJs();
  if (!cliJs) {
    console.log(`\n${RED}  ✗ Claude Code cli.js not found${RESET}\n`);
    return;
  }

  const result = restoreOriginal(cliJs);
  if (result.success) {
    console.log(`\n${GREEN}  ✓ Original buddy restored.${RESET}`);
    console.log(`${DIM}  Restart Claude Code to see your original buddy.${RESET}\n`);
  } else {
    console.log(`\n${RED}  ✗ ${result.error}${RESET}\n`);
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
  console.log(`  ${DIM}Shiny chance: 1%${RESET}\n`);
}

function showHelp() {
  console.log(`
${BOLD}claude-buddy-reroll${RESET} — Reroll your Claude Code buddy companion

${BOLD}Usage:${RESET}
  buddy-reroll check             Show your current buddy
  buddy-reroll gacha [count]     Roll random buddies (default: 10)
  buddy-reroll reroll            Interactive reroll with SALT patch
  buddy-reroll restore           Restore original buddy
  buddy-reroll dex               Show all species and rarities

${BOLD}How it works:${RESET}
  Your buddy is determined by: hash(accountId + SALT)
  By changing the SALT in Claude Code's cli.js, you get a different buddy.
  The 'reroll' command lets you preview candidates and pick your favorite.

${DIM}Backup is created before any patch. Use 'restore' to undo.${RESET}
`);
}

// ─── Main ────────────────────────────────

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'check':   await cmdCheck(); break;
  case 'gacha':   await cmdGacha(parseInt(args[0]) || 10); break;
  case 'reroll':  await cmdReroll(); break;
  case 'restore': await cmdRestore(); break;
  case 'dex':     await cmdDex(); break;
  case '--help': case '-h': case 'help': showHelp(); break;
  default: showHelp(); break;
}

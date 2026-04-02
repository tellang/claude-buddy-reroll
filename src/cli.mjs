#!/usr/bin/env node

// Claude Buddy Reroll — Gacha simulator + SALT patcher
// Supports both native binary and npm installs

// Enable ANSI colors on Windows cmd/pwsh
if (process.platform === 'win32') {
  try { const { execSync } = await import('child_process'); execSync('', { stdio: 'ignore' }); } catch {}
  // Force UTF-8 output
  if (process.stdout.isTTY) process.stdout.setDefaultEncoding?.('utf-8');
}

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { roll, multiRoll, ORIGINAL_SALT, EYES, HATS, STATS, RARITY_STARS, SPECIES, RARITIES, RARITY_WEIGHTS, applyTenPullGuarantee, generateGuaranteedEpicRoll, isEpicOrBetter } from './engine.mjs';
import { patchSalt, clearSoul, restoreOriginal } from './patcher.mjs';
import { MIN_SUPPORTED_CLAUDE_VERSION, resolveClaudeContext, updatePatchedSalt } from './context.mjs';
import { renderCard, renderMiniCard } from './display.mjs';
import { addBatchToCollection, getCollection, getPreferredVariant, renderCollection, resyncCollection } from './collection.mjs';
import { select } from './selector.mjs';
import { playHatchAnimation } from './animation.mjs';
import { createInterface, emitKeypressEvents } from 'readline';
import { findDexBuddy } from './dex.mjs';
import { renderHomeScreen, renderCheckScreen, renderQuotaSummary, renderSearchStatus } from './ui.mjs';
import { shouldGuaranteeEventRun } from './event-state.mjs';
import { compareVersions } from './patcher.mjs';
import { findNextHighlightIndex, getRevealAction } from './gacha-reveal.mjs';
import { listKnownProfiles, loadProfileState, resolveKnownProfile, saveProfileState } from './profile-state.mjs';
import { buildDexPreview, buildProfileLensItems, getDexPreviewModel, resolveDexFocusIndex, stepDexFocusIndex } from './dex-ui.mjs';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

const BASE_LIMIT = 3;
const STAR_BONUS = 1; // starred users get 1 extra roll (4 total = 40 pulls)
const DEFAULT_PULLS = 10;
const APOLOGY_EVENT = {
  id: 'launch-2026-04-10x3',
  bonusRuns: 3,
  pullsPerRun: 10,
};

// ─── Flag parsing ────────────────────────────────────

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--json') { flags.json = true; }
  else if (argv[i] === '--pick' && argv[i + 1]) { flags.pick = parseInt(argv[++i]); }
  else if (argv[i] === '--dry-run') { flags.dryRun = true; }
  else if (argv[i] === '--fields' && argv[i + 1]) { flags.fields = argv[++i].split(','); }
  else if (argv[i] === '--limit' && argv[i + 1]) { flags.limit = parseInt(argv[++i]); }
  else { positional.push(argv[i]); }
}
const [cmd, ...args] = positional;

// ─── Output helpers ──────────────────────────────────

function filterFields(obj, fields) {
  if (Array.isArray(obj)) return obj.map(item => filterFields(item, fields));
  const result = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
    // support nested: "bones.rarity"
    if (f.includes('.')) {
      const [parent, child] = f.split('.');
      if (obj[parent] && child in obj[parent]) {
        if (!result[parent]) result[parent] = {};
        result[parent][child] = obj[parent][child];
      }
    }
  }
  return result;
}

function output(data) {
  if (flags.fields) {
    data = filterFields(data, flags.fields);
  }
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function log(...logArgs) {
  // In JSON mode, logs go to stderr. In normal mode, to stdout.
  if (flags.json) {
    process.stderr.write(logArgs.join(' ') + '\n');
  } else {
    console.log(...logArgs);
  }
}

function errorJson(code, message) {
  output({ error: { code, message } });
  process.exit(1);
}

function mapResult(result, index = null) {
  return {
    ...(index !== null ? { index: index + 1 } : {}),
    salt: result.salt,
    species: result.bones.species,
    rarity: result.bones.rarity,
    stars: RARITY_STARS[result.bones.rarity],
    eye: result.bones.eye,
    hat: result.bones.hat,
    shiny: result.bones.shiny,
    stats: result.bones.stats,
  };
}

function formatProfileBadge(userId) {
  return userId === 'anon' ? 'anonymous' : `${userId.slice(0, 8)}...`;
}

function getDexPreviewState(entry, options = {}) {
  const species = entry?.variants?.[0]?.bones?.species || entry?.species || 'duck';
  return getDexPreviewModel(species, entry, options);
}

function handleDexFocusInput(entry, currentFocusIndex, input) {
  const previewState = getDexPreviewState(entry, { focusIndex: currentFocusIndex });
  const variantCount = previewState.orderedVariants.length;
  if (variantCount === 0) return { handled: false, focusIndex: null };

  if (input === '[') {
    return {
      handled: true,
      focusIndex: stepDexFocusIndex(previewState.focusIndex, variantCount, -1),
    };
  }

  if (input === ']') {
    return {
      handled: true,
      focusIndex: stepDexFocusIndex(previewState.focusIndex, variantCount, 1),
    };
  }

  if (input === '0') {
    return { handled: true, focusIndex: null };
  }

  const slot = Number.parseInt(input, 10);
  if (Number.isNaN(slot) || slot < 1 || slot > 4) {
    return { handled: false, focusIndex: currentFocusIndex };
  }

  return {
    handled: true,
    focusIndex: resolveDexFocusIndex(variantCount, previewState.galleryStart + slot - 1),
  };
}

async function chooseProfileLens(currentUserId, title = 'Choose Profile Lens', activeProfileLensId = currentUserId) {
  const items = buildProfileLensItems({
    detectedUserId: currentUserId,
    knownProfiles: listKnownProfiles(),
  });
  if (items.length <= 1) return currentUserId;

  const choice = await select({
    title,
    fullscreen: true,
    columns: 1,
    items,
    selected: Math.max(0, items.findIndex((item) => item.value === activeProfileLensId)),
    footer: (item) => [
      `${CYAN}▶${RESET} ${item.label}`,
      `${DIM}${item.description}${RESET}`,
      `${DIM}Detected account stays ${formatProfileBadge(currentUserId)} • Enter choose • Esc cancel${RESET}`,
    ],
  });

  return choice?.value || null;
}

function resolveActiveProfileLens(currentUserId, requestedLensId = null) {
  const known = new Set([currentUserId, ...listKnownProfiles()]);
  return requestedLensId && known.has(requestedLensId) ? requestedLensId : currentUserId;
}

async function cmdProfiles(currentUserId, activeProfileLensId = null) {
  const startingLens = resolveActiveProfileLens(currentUserId, activeProfileLensId);
  const lens = await chooseProfileLens(currentUserId, 'Profile Lenses', startingLens);
  if (!lens) return;

  const lensChoice = await select({
    title: 'Profile Lens Action',
    fullscreen: true,
    columns: 1,
    items: [
      { label: `${GREEN}Inspect${RESET}`, description: 'Open doctor summary for this profile', value: 'inspect' },
      { label: `${GREEN}Browse Dex${RESET}`, description: 'Browse dex using this profile data lens', value: 'dex' },
    ],
    footer: (item) => [
      `${CYAN}▶${RESET} ${item.label}  ${DIM}${item.description}${RESET}`,
      `${DIM}Viewing ${formatProfileBadge(lens)} • Detected account ${formatProfileBadge(currentUserId)}${RESET}`,
    ],
  });

  if (!lensChoice) return;
  if (lensChoice.value === 'inspect') {
    await cmdDoctor('profile', lens);
    return lens;
  }

  await cmdDex({ profileLensId: lens, skipLensPrompt: true });
  return lens;
}

// ─── Star check ─────────────────────────────────────

const _starCache = new Map();

async function isStarred(userId = 'anon') {
  if (_starCache.has(userId)) return _starCache.get(userId);

  // Check persisted state first — once starred, never call gh again
  try {
    const state = loadProfileState(userId);
    if (state.starred === true) {
      _starCache.set(userId, true);
      return true;
    }
  } catch {}

  try {
    const { execSync } = await import('child_process');
    const out = execSync('gh api user --jq .login', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] }).trim();
    if (!out) { _starCache.set(userId, false); return false; }
    const stars = execSync('gh api repos/tellang/claude-buddy-reroll/stargazers --jq ".[].login"', { encoding: 'utf-8', timeout: 5000, stdio: ['pipe','pipe','pipe'] });
    const starred = stars.includes(out);
    _starCache.set(userId, starred);
    // Persist so we never call gh again
    if (starred) {
      try {
        const state = loadProfileState(userId);
        state.starred = true;
        state.starredAt = new Date().toISOString();
        saveProfileState(userId, state);
      } catch {}
    }
    return starred;
  } catch {
    _starCache.set(userId, false);
    return false;
  }
}

async function getDailyLimit(userId = 'anon') {
  const starred = await isStarred(userId);
  return starred ? BASE_LIMIT + STAR_BONUS : BASE_LIMIT;
}

// ─── State (daily gacha limit) ──────────────────────

function loadState(userId = 'anon') {
  return loadProfileState(userId);
}

function saveState(userId, state) {
  saveProfileState(userId || 'anon', state);
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

function maybeApplyEventGuarantee(state, allowance, userId, results) {
  if (!shouldGuaranteeEventRun({
    state,
    eventId: APOLOGY_EVENT.id,
    mode: allowance.mode,
    eventRemaining: allowance.eventRemaining,
    results,
    isEpicResult: isEpicOrBetter,
  })) {
    return results;
  }
  return applyTenPullGuarantee(results, () => generateGuaranteedEpicRoll(userId));
}

function recordRoll(userId, state, mode = 'daily', metadata = {}) {
  if (mode === 'event') {
    if (!state.eventUses) state.eventUses = [];
    state.eventUses.push({ id: APOLOGY_EVENT.id, ts: Date.now(), hadEpic: metadata.hadEpic === true });
  } else {
    if (!state.rolls) state.rolls = [];
    state.rolls.push({ date: todayKey(), ts: Date.now() });
  }
  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 86400000;
  state.rolls = state.rolls.filter(r => r.ts > cutoff);
  state.eventUses = (state.eventUses || []).filter(r => r.ts > cutoff);
  saveState(userId, state);
}

async function getRollAllowance(userId, state, options = {}) {
  const supportsEvent = options.supportsEvent ?? false;
  const limit = await getDailyLimit(userId);
  const used = getRollsToday(state);
  const starred = await isStarred(userId);
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
  const allowance = await getRollAllowance(options.userId || 'anon', state, options);
  const { allowed, mode, pullCount, limit, used, starred, eventRemaining } = allowance;

  if (!allowed) {
    log(`\n${YELLOW}  ⚠ 오늘 가챠 ${limit}회 소진! 내일 다시 도전하세요.${RESET}`);
    if (eventRemaining === 0) {
      log(`${DIM}  이벤트 보상 10연차 ${APOLOGY_EVENT.bonusRuns}회도 모두 사용했습니다.${RESET}`);
    }
    if (!starred) log(`${DIM}  💡 GitHub Star 찍으면 +1회 보너스! (30뽑 → 40뽑)${RESET}`);
    log(`${DIM}  (${used}/${limit} used today)${RESET}\n`);
    return allowance;
  }

  const tag = starred ? ' ⭐' : '';
  if (mode === 'event') {
    log(`${DIM}  이벤트 보상 사용 가능: ${eventRemaining}/${APOLOGY_EVENT.bonusRuns} | 이번 차수 ${pullCount}연차${RESET}`);
  } else {
    log(`${DIM}  가챠 잔여: ${limit - used}/${limit}${tag}${RESET}`);
    if (eventRemaining > 0) {
      log(`${DIM}  이벤트 보상: ${APOLOGY_EVENT.pullsPerRun}연차 ${eventRemaining}회 남음${RESET}`);
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
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode?.(false); } catch {}
    process.stdin.resume();
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()); }));
}

function requireClaudeContext(options = {}) {
  const { needsInstall = false, needsSalt = false, needsPatchSupport = false } = options;
  const context = resolveClaudeContext();

  if (!context.userId || context.userId === 'anon') {
    if (flags.json) {
      errorJson('NO_ACCOUNT', 'Claude account ID not found in ~/.claude.json');
    }
    console.log(`\n${RED}  ✗ Claude account ID를 ~/.claude.json 에서 찾지 못했습니다.${RESET}`);
    console.log(`${DIM}  oauthAccount.accountUuid 또는 userID가 필요합니다.${RESET}\n`);
    return null;
  }

  if (needsInstall && !context.install) {
    if (flags.json) {
      errorJson('NO_INSTALL', 'Claude Code installation not found');
    }
    console.log(`\n${RED}  ✗ Claude Code 설치를 찾지 못했습니다.${RESET}\n`);
    return null;
  }

  if (needsSalt && !context.currentSalt) {
    if (flags.json) {
      errorJson('NO_SALT', 'Could not read current SALT from Claude Code installation');
    }
    console.log(`\n${RED}  ✗ 설치된 Claude Code에서 현재 SALT를 동적으로 읽지 못했습니다.${RESET}`);
    console.log(`${DIM}  install-hook을 다시 실행하거나 설치 경로를 확인해 주세요.${RESET}\n`);
    return null;
  }

  if (needsPatchSupport && context.installVersion && compareVersions(context.installVersion, MIN_SUPPORTED_CLAUDE_VERSION) < 0) {
    if (flags.json) {
      errorJson('UNSUPPORTED_VERSION', `Claude Code ${context.installVersion} is below the supported patching version ${MIN_SUPPORTED_CLAUDE_VERSION}`);
    }
    console.log(`\n${RED}  ✗ Claude Code ${context.installVersion}에서는 버디 변경을 지원하지 않습니다.${RESET}`);
    console.log(`${DIM}  최소 지원 버전: ${MIN_SUPPORTED_CLAUDE_VERSION}${RESET}\n`);
    return null;
  }

  return context;
}

function buildTamagotchiPreview(species, entry, options = {}) {
  return buildDexPreview(species, entry, {
    focusIndex: options.focusIndex ?? null,
    tick: options.tick ?? 0,
    viewedProfileId: options.viewedProfileId ?? options.profileLensId ?? 'anon',
    currentUserId: options.currentUserId ?? options.detectedProfileId ?? 'anon',
  });
}

function clearRenderedBlock(lineCount) {
  if (lineCount <= 0) return;
  process.stdout.write(`\x1b[${lineCount}A`);
  for (let i = 0; i < lineCount; i++) {
    process.stdout.write('\x1b[2K');
    if (i < lineCount - 1) process.stdout.write('\x1b[1B');
  }
  if (lineCount > 1) process.stdout.write(`\x1b[${lineCount - 1}A`);
  process.stdout.write('\r');
}

async function revealGachaPulls(results) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;

  const HIDE_CURSOR = '\x1b[?25l';
  const SHOW_CURSOR = '\x1b[?25h';
  let currentIndex = 0;
  let renderedLines = 0;
  let frame = 0;
  let autoPausedOnHighlight = false;
  let timer = null;
  let handlingKey = false;

  function renderCurrent() {
    const result = results[currentIndex];
    const header = `${BOLD}  Pull ${currentIndex + 1}/${results.length}${RESET}`;
    const note = autoPausedOnHighlight
      ? `${YELLOW}  Epic+ hit. Enter: continue  S: skip rest  Q: summary${RESET}`
      : `${DIM}  Enter: next  S: skip all  Q: summary${RESET}`;
    const card = renderCard(result, { showSalt: true, index: currentIndex, frame });
    const block = [header, card, note].join('\n');

    if (renderedLines > 0) clearRenderedBlock(renderedLines);
    process.stdout.write(block);
    renderedLines = block.split('\n').length;
  }

  function startAnimation() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      frame++;
      renderCurrent();
    }, 450);
  }

  function stopAnimation() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return new Promise((resolve) => {
    emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(HIDE_CURSOR);

    function cleanup() {
      stopAnimation();
      clearRenderedBlock(renderedLines + 2);
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      process.stdout.write(SHOW_CURSOR);
      renderedLines = 0;
    }

    function finish() {
      cleanup();
      resolve();
    }

    async function showCurrent({ animateHighlight = false } = {}) {
      const result = results[currentIndex];
      if (animateHighlight && isEpicOrBetter(result)) {
        stopAnimation();
        if (renderedLines > 0) {
          clearRenderedBlock(renderedLines + 2);
          renderedLines = 0;
        }
        await playHatchAnimation(result.bones);
      }
      renderCurrent();
      startAnimation();
    }

    async function advanceOne() {
      autoPausedOnHighlight = false;
      currentIndex++;
      if (currentIndex >= results.length) {
        finish();
        return;
      }
      await showCurrent({ animateHighlight: true });
    }

    async function skipAll() {
      const nextHighlight = findNextHighlightIndex(results, currentIndex + 1, isEpicOrBetter);
      if (nextHighlight === -1) {
        finish();
        return;
      }

      currentIndex = nextHighlight;
      autoPausedOnHighlight = true;
      await showCurrent({ animateHighlight: true });
    }

    async function onKey(str, key) {
      if (handlingKey) return;
      const action = getRevealAction(str, key);
      if (!action) return;
      handlingKey = true;
      if (action === 'quit') {
        finish();
        handlingKey = false;
        return;
      }
      if (action === 'skip') {
        await skipAll();
        handlingKey = false;
        return;
      }
      await advanceOne();
      handlingKey = false;
    }

    process.stdin.on('keypress', onKey);
    showCurrent({ animateHighlight: isEpicOrBetter(results[currentIndex]) }).catch(() => finish());
  });
}

// ─── Commands ───────────────────────────────────────

async function cmdCheck() {
  const context = requireClaudeContext();
  if (!context) return;
  const { userId, install, currentSalt } = context;
  const salt = currentSalt || ORIGINAL_SALT;
  const buddy = roll(userId, salt);
  const state = loadState(userId);
  const limit = await getDailyLimit(userId);
  const used = getRollsToday(state);
  const starred = await isStarred(userId);
  const eventRemaining = getApologyEventRemaining(state);

  if (flags.json) {
    output({
      command: 'check',
      account: userId.slice(0, 8),
      profiles: listKnownProfiles(),
      install: install ? { type: install.type, path: install.path } : null,
      salt: salt,
      patched: salt !== ORIGINAL_SALT,
      buddy: buddy.bones,
      quota: { used, limit, remaining: limit - used, starred, eventRemaining },
    });
    return;
  }

  const accountLabel = userId === 'anon' ? 'anonymous' : `${userId.slice(0, 8)}...`;
  const installLabel = install ? `${install.type} (${install.path})` : 'not found (previewing original salt)';
  console.log(renderCheckScreen({
    accountLabel,
    installLabel,
    salt,
    patched: salt !== ORIGINAL_SALT,
    quotaLines: renderQuotaSummary({ used, limit, starred, eventRemaining }),
    profileLine: `${DIM}Detected${RESET} ${formatProfileBadge(userId)}  ${DIM}Saved${RESET} ${listKnownProfiles().length}`,
    buddyCard: renderCard(buddy, { showSalt: true }),
  }));
}

async function cmdGacha(count = 10) {
  const context = requireClaudeContext();
  if (!context) return;
  const { userId } = context;
  const state = loadState(userId);
  const allowance = await checkLimit(state, { supportsEvent: true, userId });
  if (!allowance.allowed) {
    if (flags.json) errorJson('QUOTA_EXCEEDED', `Daily limit reached (${allowance.used}/${allowance.limit})`);
    return;
  }
  const rollCount = allowance.mode === 'event' ? allowance.pullCount : count;

  if (flags.json) {
    const rawResults = multiRoll(userId, rollCount);
    const results = maybeApplyEventGuarantee(state, allowance, userId, rawResults);
    recordRoll(userId, state, allowance.mode, { hadEpic: results.some(isEpicOrBetter) });
    addBatchToCollection(results, userId);

    const mapped = results.map((result, index) => mapResult(result, index));

    // Check upgrade
    const best = results.reduce((a, b) => RARITY_ORDER[a.bones.rarity] >= RARITY_ORDER[b.bones.rarity] ? a : b);
    if (isUpgrade(state.bestRarity || 'common', best.bones.rarity)) {
      state.bestRarity = best.bones.rarity;
      saveState(userId, state);
    }

    output({
      command: 'gacha',
      count: rollCount,
      results: mapped,
      best: mapped[results.indexOf(best)],
      quota: allowance,
    });
    return;
  }

  console.log(`\n${BOLD}  🎰 BUDDY GACHA — Rolling ${rollCount}x...${RESET}\n`);

  const rawResults = multiRoll(userId, rollCount);
  const results = maybeApplyEventGuarantee(state, allowance, userId, rawResults);

  await revealGachaPulls(results);

  console.log(`${BOLD}  Pull summary${RESET}`);
  for (let i = 0; i < results.length; i++) {
    console.log(renderMiniCard(results[i], i));
  }

  const rarityCount = {};
  for (const r of results) {
    rarityCount[r.bones.rarity] = (rarityCount[r.bones.rarity] || 0) + 1;
  }
  console.log(`\n${DIM}  Results: ${Object.entries(rarityCount).map(([k, v]) => `${k}:${v}`).join(' ')}${RESET}`);

  // Record roll + save to collection
  recordRoll(userId, state, allowance.mode, { hadEpic: results.some(isEpicOrBetter) });
  addBatchToCollection(results, userId);

  // Check upgrade → star request
  const best = results.reduce((a, b) =>
    RARITY_ORDER[a.bones.rarity] >= RARITY_ORDER[b.bones.rarity] ? a : b
  );
  if (isUpgrade(state.bestRarity || 'common', best.bones.rarity)) {
    state.bestRarity = best.bones.rarity;
    saveState(userId, state);
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
  const context = requireClaudeContext({ needsInstall: true, needsSalt: true, needsPatchSupport: true });
  if (!context) return;
  const { userId, install, currentSalt } = context;
  const state = loadState(userId);
  const allowance = await checkLimit(state, { supportsEvent: false, userId });
  if (!allowance.allowed) {
    if (flags.json) errorJson('QUOTA_EXCEEDED', `Daily limit reached (${allowance.used}/${allowance.limit})`);
    return;
  }

  if (flags.json) {
    const count = allowance.pullCount;
    const candidates = multiRoll(userId, count);
    const mapped = candidates.map((candidate, index) => mapResult(candidate, index));

    if (flags.pick != null) {
      const idx = flags.pick - 1;
      if (idx < 0 || idx >= candidates.length) {
        errorJson('INVALID_PICK', `Pick must be 1-${candidates.length}`);
      }
      const selected = candidates[idx];

      if (flags.dryRun) {
        output({
          command: 'reroll',
          dryRun: true,
          current: { salt: currentSalt, buddy: roll(userId, currentSalt).bones },
          selected: mapped[idx],
          action: 'patch_salt',
          install: { type: install.type, path: install.path },
        });
        return;
      }

      // Actually patch
      const result = patchSalt(install, currentSalt, selected.salt);
      if (!result.success) errorJson('PATCH_FAILED', result.error);
      updatePatchedSalt(selected.salt);
      const soulResult = clearSoul();
      recordRoll(userId, state, allowance.mode);

      output({
        command: 'reroll',
        success: true,
        selected: mapped[idx],
        patch: { type: result.type, needsSwap: result.needsSwap || false, swapCommand: result.swapCommand },
        soulCleared: soulResult.oldName || null,
      });
      return;
    }

    // No pick — just output candidates for agent to choose
    output({
      command: 'reroll',
      current: { salt: currentSalt, buddy: roll(userId, currentSalt).bones },
      candidates: mapped,
      quota: allowance,
      hint: 'Use --pick N to select, add --dry-run to preview',
    });
    return;
  }

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
  recordRoll(userId, state, allowance.mode);

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
    saveState(userId, state);
    speakiStarRequest(selected.bones.species, selected.bones.rarity);
  }
}

async function cmdRestore() {
  const context = requireClaudeContext({ needsInstall: true, needsPatchSupport: true });
  if (!context) return;

  if (flags.json) {
    const result = restoreOriginal();
    if (result.success) {
      clearSoul();
      output({ command: 'restore', success: true, type: result.type });
    } else {
      output({ command: 'restore', success: false, error: result.error, restoreCommand: result.command });
    }
    return;
  }

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

async function cmdDex(options = {}) {
  if (flags.json) {
    const context = requireClaudeContext();
    if (!context) return;

    if (flags.pick != null) {
      const idx = flags.pick - 1;
      if (idx < 0 || idx >= SPECIES.length) {
        errorJson('INVALID_PICK', `Pick must be 1-${SPECIES.length}`);
      }
      const targetSpecies = SPECIES[idx];
      const applyContext = requireClaudeContext({ needsInstall: true, needsSalt: true, needsPatchSupport: true });
      if (!applyContext) return;
      const viewedProfileId = options.profileLensId || context.userId;
      const collection = getCollection(viewedProfileId);
      const search = findDexBuddy({
        userId: applyContext.userId,
        targetSpecies,
        entry: collection[targetSpecies],
      });

      if (!search.found) {
        const rarityHint = search.criteria.rarity ? ` (${search.criteria.rarity})` : '';
        errorJson('NOT_FOUND', `Could not find ${targetSpecies}${rarityHint} in ${search.attempts} rolls`);
      }

      const found = search.found;

      if (flags.dryRun) {
        output({
          command: 'dex-pick',
          dryRun: true,
          target: targetSpecies,
          viewedProfile: viewedProfileId,
          detectedProfile: applyContext.userId,
          found: mapResult(found),
          criteria: search.criteria,
        });
        return;
      }

      // Apply
      const patchResult = patchSalt(applyContext.install, applyContext.currentSalt, found.salt);
      if (!patchResult.success) errorJson('PATCH_FAILED', patchResult.error);
      updatePatchedSalt(found.salt);
      clearSoul();

      output({
        command: 'dex-pick',
        success: true,
        target: targetSpecies,
        viewedProfile: viewedProfileId,
        detectedProfile: applyContext.userId,
        result: mapResult(found),
        criteria: search.criteria,
        patch: { type: patchResult.type, needsSwap: patchResult.needsSwap || false },
      });
      return;
    }
    const state = loadState(context.userId);
    const limit = await getDailyLimit(context.userId);
    const starred = await isStarred(context.userId);
    const eventRemaining = getApologyEventRemaining(state);
    output({
      command: 'dex',
      viewedProfile: options.profileLensId || context.userId,
      detectedProfile: context.userId,
      species: SPECIES,
      eyes: EYES,
      hats: HATS.filter(h => h !== 'none'),
      stats: STATS,
      rarities: RARITIES,
      rarityWeights: RARITY_WEIGHTS,
      shinyChance: 0.01,
      quota: { limit, starred, eventRemaining },
    });
    return;
  }

  const previewContext = resolveClaudeContext();
  const profileLensId = options.profileLensId
    || (options.skipLensPrompt
      ? previewContext.userId
      : await chooseProfileLens(previewContext.userId, 'Choose Dex Profile Lens'))
    || null;
  if (!profileLensId) return { promptReturn: false };

  // Show collection view
  console.log(renderCollection(profileLensId));
  console.log(`${DIM}  Detected Claude account: ${formatProfileBadge(previewContext.userId)}${RESET}`);
  console.log(`${DIM}  Viewing profile data: ${formatProfileBadge(profileLensId)} | Known profiles: ${listKnownProfiles().length}${RESET}`);

  // Also show game info
  console.log(`${BOLD}  Eyes:${RESET} ${EYES.join('  ')}`);
  console.log(`${BOLD}  Hats:${RESET} ${HATS.filter(h => h !== 'none').join(', ')}`);
  console.log(`${BOLD}  Stats:${RESET} ${STATS.join(', ')}`);
  console.log(`  ${DIM}Shiny chance: 1%${RESET}`);
  const limit = await getDailyLimit(previewContext.userId);
  const starred = await isStarred(previewContext.userId);
  const eventRemaining = getApologyEventRemaining(loadState(previewContext.userId));
  console.log(`  ${DIM}Daily gacha limit: ${limit}${starred ? ' (⭐ star bonus!)' : ' (+1 with GitHub star)'}${RESET}`);
  console.log(`  ${DIM}Apology event: +${APOLOGY_EVENT.bonusRuns} extra ${APOLOGY_EVENT.pullsPerRun}-pulls (${eventRemaining} left)${RESET}\n`);

  // Interactive pick with arrow keys
  const RARITY_COLOR_MAP = {
    common: '\x1b[37m', uncommon: '\x1b[32m', rare: '\x1b[36m',
    epic: '\x1b[35m', legendary: '\x1b[33;1m',
  };

  const col = getCollection(profileLensId);
  const selectorItems = SPECIES.map((sp) => {
    const entry = col[sp];
    const previewState = getDexPreviewState(entry);
    const discovered = !!previewState.focusedVariant;
    const bestVariant = previewState.preferredVariant;
    const rColor = discovered && bestVariant ? (RARITY_COLOR_MAP[bestVariant.bones.rarity] || '') : '';
    const stars = discovered && bestVariant ? ` ${RARITY_STARS[bestVariant.bones.rarity]}` : '';
    return {
      label: discovered ? `${rColor}${sp}${stars}${RESET}` : `${DIM}???${RESET}`,
      description: discovered ? `${bestVariant.bones.rarity} • ${previewState.orderedVariants.length} forms • x${entry.count}` : 'undiscovered',
      value: sp,
    };
  });

  const choice = await select({
    title: 'Speaki Dex Targets',
    items: selectorItems,
    columns: 3,
    fullscreen: true,
    previewHeight: 30,
    animationIntervalMs: 450,
    state: { focusBySpecies: {} },
    onKey: (str, key, meta) => {
      const entry = col[meta.item.value];
      const currentFocusIndex = meta.state?.focusBySpecies?.[meta.item.value] ?? null;
      const next = handleDexFocusInput(entry, currentFocusIndex, String(str || '').toLowerCase());
      if (!next.handled) return null;
      const focusBySpecies = { ...(meta.state?.focusBySpecies || {}) };
      if (next.focusIndex == null) delete focusBySpecies[meta.item.value];
      else focusBySpecies[meta.item.value] = next.focusIndex;
      return { handled: true, state: { ...(meta.state || {}), focusBySpecies } };
    },
    preview: (item, meta) => buildTamagotchiPreview(item.value, col[item.value], {
      tick: meta.tick,
      viewedProfileId: profileLensId,
      detectedUserId: previewContext.userId,
      focusIndex: meta.state?.focusBySpecies?.[item.value] ?? null,
    }),
    footer: (item, meta) => {
      const previewState = getDexPreviewState(col[item.value], {
        focusIndex: meta.state?.focusBySpecies?.[item.value] ?? null,
      });
      return [
        `${CYAN}▶${RESET} ${item.label}  ${item.description ? `${DIM}${item.description}${RESET}` : ''}`,
        `${DIM}Detected ${formatProfileBadge(previewContext.userId)} • Viewing ${formatProfileBadge(profileLensId)}${RESET}`,
        `${DIM}Arrows move • [ ] cycle • 1-4 visible • 0 reset • Enter inspect/apply • Esc back${previewState.orderedVariants.length > 1 ? '' : ' • one form'}${RESET}`,
      ];
    },
  });

  if (!choice) return { promptReturn: false };

  const targetSpecies = choice.value;
  const targetEntry = col[targetSpecies];

  if (!targetEntry) {
    console.log(`\n${YELLOW}  ${targetSpecies.toUpperCase()} is not in your dex yet.${RESET}`);
    console.log(`${DIM}  Find it in gacha first, then come back to apply a collected form.${RESET}\n`);
    return { promptReturn: true };
  }

  console.log(`\n${BOLD}  Target: ${targetSpecies.toUpperCase()}${RESET}`);
  const preferredVariant = getPreferredVariant(targetEntry);
  const actionPrompt = profileLensId === previewContext.userId
    ? (preferredVariant?.salt
      ? `  Apply your collected ${targetSpecies} form? [y/N]: `
      : `  Recover a matching ${targetSpecies} form from your dex data? [y/N]: `)
    : (preferredVariant?.salt
      ? `  Apply a ${targetSpecies} form from ${formatProfileBadge(profileLensId)} to the current account? [y/N]: `
      : `  Recover a matching ${targetSpecies} form from ${formatProfileBadge(profileLensId)}'s dex data? [y/N]: `);
  const confirmApplyFromDex = await ask(actionPrompt);
  if (confirmApplyFromDex.toLowerCase() !== 'y') return { promptReturn: true };

  const context = requireClaudeContext({ needsInstall: true, needsSalt: true, needsPatchSupport: true });
  if (!context) return;

  const search = findDexBuddy({
    userId: context.userId,
    targetSpecies,
    entry: targetEntry,
  });

  console.log(renderSearchStatus({ targetSpecies, criteria: search.criteria, attempts: search.attempts }));

  if (!search.found) {
    console.log(`${RED}  Could not find ${targetSpecies}${search.criteria.rarity ? ` (${search.criteria.rarity})` : ''} in ${search.attempts} attempts${RESET}\n`);
    return { promptReturn: true };
  }

  const found = search.found;
  console.log(`${GREEN}  Found ${targetSpecies}${search.criteria.rarity ? ` @ ${search.criteria.rarity}` : ''}!${RESET}\n`);
  await playHatchAnimation(found.bones);
  console.log(renderCard(found, { showSalt: true }));

  const confirmApply = await ask(`  ${YELLOW}Apply this ${targetSpecies}? [y/N]: ${RESET}`);
  if (confirmApply.toLowerCase() !== 'y') {
    console.log(`${DIM}  Cancelled.${RESET}\n`);
    return { promptReturn: true };
  }

  const patchResult = patchSalt(context.install, context.currentSalt, found.salt);
  if (!patchResult.success) {
    console.log(`\n${RED}  ✗ Patch failed: ${patchResult.error}${RESET}\n`);
    return { promptReturn: true };
  }

  updatePatchedSalt(found.salt);
  clearSoul();

  if (patchResult.needsSwap) {
    console.log(`\n${GREEN}  ✓ Patched! (needs swap on exit)${RESET}`);
    console.log(`  ${CYAN}${patchResult.swapCommand}${RESET}\n`);
  } else {
    console.log(`\n${GREEN}  ✓ ${targetSpecies} applied! Restart Claude Code.${RESET}\n`);
  }
  return { promptReturn: true };
}

function cmdSchema(subCmd) {
  const schemas = {
    check: {
      command: 'check',
      description: 'Show current buddy',
      args: [],
      flags: ['--json', '--fields'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'check' },
          account: { type: 'string' },
          install: { type: 'object', nullable: true },
          salt: { type: 'string' },
          patched: { type: 'boolean' },
          buddy: { $ref: '#/definitions/bones' },
          quota: { $ref: '#/definitions/quota' },
        },
      },
    },
    gacha: {
      command: 'gacha',
      description: 'Roll random buddies',
      args: [{ name: 'count', type: 'number', default: 10, max: 100 }],
      flags: ['--json', '--fields', '--limit'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'gacha' },
          count: { type: 'number' },
          results: { type: 'array', items: { $ref: '#/definitions/result' } },
          best: { $ref: '#/definitions/result' },
          quota: { $ref: '#/definitions/quota' },
        },
      },
    },
    reroll: {
      command: 'reroll',
      description: 'Roll candidates and optionally patch SALT',
      args: [],
      flags: ['--json', '--pick N', '--dry-run', '--fields'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'reroll' },
          current: { type: 'object' },
          candidates: { type: 'array', items: { $ref: '#/definitions/result' } },
        },
      },
    },
    restore: {
      command: 'restore',
      description: 'Restore original buddy',
      args: [],
      flags: ['--json'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'restore' },
          success: { type: 'boolean' },
        },
      },
    },
    dex: {
      command: 'dex',
      description: 'Game data and collection',
      args: [],
      flags: ['--json', '--fields'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'dex' },
          species: { type: 'array' },
          rarities: { type: 'array' },
        },
      },
    },
    update: {
      command: 'update',
      description: 'Self-update to latest version',
      args: [],
      flags: ['--json'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'update' },
          previous: { type: 'string' },
          current: { type: 'string' },
          updated: { type: 'boolean' },
          setup: { type: 'boolean' },
        },
      },
    },
    doctor: {
      command: 'doctor',
      description: 'Inspect current profile or compare dex preview vs apply result',
      args: [{ name: 'scope', type: 'string', optional: true }, { name: 'pick', type: 'number', optional: true }],
      flags: ['--json'],
      response: {
        type: 'object',
        properties: {
          command: { type: 'string', const: 'doctor' },
          scope: { type: 'string' },
        },
      },
    },
  };

  const definitions = {
    bones: {
      type: 'object',
      properties: {
        rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
        species: { type: 'string' },
        eye: { type: 'string' },
        hat: { type: 'string' },
        shiny: { type: 'boolean' },
        stats: { type: 'object' },
      },
    },
    result: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        salt: { type: 'string' },
        species: { type: 'string' },
        rarity: { type: 'string' },
        stars: { type: 'string' },
        eye: { type: 'string' },
        hat: { type: 'string' },
        shiny: { type: 'boolean' },
        stats: { type: 'object' },
      },
    },
    quota: {
      type: 'object',
      properties: {
        used: { type: 'number' },
        limit: { type: 'number' },
        remaining: { type: 'number' },
        starred: { type: 'boolean' },
        eventRemaining: { type: 'number' },
      },
    },
  };

  if (subCmd && schemas[subCmd]) {
    output({ ...schemas[subCmd], definitions });
  } else {
    output({ commands: Object.values(schemas), definitions });
  }
}

async function cmdUpdate() {
  const { execSync } = await import('child_process');
  const context = resolveClaudeContext();

  if (flags.json) {
    try {
      log('Checking for updates...');
      const current = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version;
      execSync('npm install -g claude-buddy-reroll@latest', { stdio: 'pipe' });
      runRuntimeSetup({ stdio: 'pipe' });
      resyncCollection(context.userId);
      const updated = execSync('npm info claude-buddy-reroll version', { encoding: 'utf-8' }).trim();
      output({ command: 'update', previous: current, current: updated, updated: current !== updated, setup: true, resynced: true });
    } catch (e) {
      errorJson('UPDATE_FAILED', e.message);
    }
    return;
  }

  console.log(`\n${MAGENTA}${BOLD}  쪼아요~! 스피키가 업데이트 확인할게요!${RESET}\n`);
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(`${DIM}  현재 버전: v${pkg.version}${RESET}`);
    console.log(`${DIM}  업데이트 중...${RESET}\n`);
    execSync('npm install -g claude-buddy-reroll@latest', { stdio: 'inherit' });
    console.log(`\n${DIM}  런타임 셋업 확인 중...${RESET}`);
    runRuntimeSetup({ stdio: 'inherit' });
    console.log(`${DIM}  현재 계정 도감 정합성 재검증 중...${RESET}`);
    resyncCollection(context.userId);
    const newVer = execSync('npm info claude-buddy-reroll version', { encoding: 'utf-8' }).trim();
    if (newVer !== pkg.version) {
      console.log(`\n${GREEN}  ✓ v${pkg.version} → v${newVer} 업데이트 완료! 도감도 갱신했어요.${RESET}\n`);
    } else {
      console.log(`\n${GREEN}  ✓ 이미 최신이에요! (v${pkg.version}) 도감 정합성만 다시 맞췄어요.${RESET}\n`);
    }
  } catch (e) {
    console.log(`\n${RED}  ✗ 업데이트 실패: ${e.message}${RESET}`);
    console.log(`${DIM}  수동: npm install -g claude-buddy-reroll@latest${RESET}\n`);
  }
}

function runRuntimeSetup({ stdio = 'inherit' } = {}) {
  const installHookPath = fileURLToPath(new URL('../scripts/install-hook.mjs', import.meta.url));
  return execFileSync(process.execPath, [installHookPath], { stdio });
}

async function cmdSetup() {
  const context = resolveClaudeContext();
  if (flags.json) {
    try {
      runRuntimeSetup({ stdio: 'pipe' });
      resyncCollection(context.userId);
      output({ command: 'setup', success: true, resynced: true });
    } catch (error) {
      errorJson('SETUP_FAILED', error?.message || String(error));
    }
    return;
  }

  console.log(`\n${MAGENTA}${BOLD}  쪼아요~! 런타임 셋업 확인할게요.${RESET}\n`);
  try {
    runRuntimeSetup({ stdio: 'inherit' });
    console.log(`${DIM}  현재 계정 도감 정합성 재검증 중...${RESET}`);
    resyncCollection(context.userId);
    console.log(`\n${GREEN}  ✓ setup complete${RESET}\n`);
  } catch (error) {
    console.log(`\n${RED}  ✗ setup failed: ${error?.message || String(error)}${RESET}\n`);
  }
}

async function cmdDoctor(subCmd, subArg) {
  const context = requireClaudeContext();
  if (!context) return;
  const { userId, install, currentSalt, installVersion } = context;
  const targetProfile = resolveKnownProfile(subCmd === 'profile' ? subArg || '' : '') || userId;
  const profile = loadState(targetProfile);

  if (subCmd === 'dex') {
    const idx = Math.max(1, parseInt(subArg || '0', 10)) - 1;
    if (idx < 0 || idx >= SPECIES.length) {
      if (flags.json) errorJson('INVALID_PICK', `Pick must be 1-${SPECIES.length}`);
      console.log(`\n${RED}  ✗ Pick must be 1-${SPECIES.length}${RESET}\n`);
      return;
    }

    const targetSpecies = SPECIES[idx];
    const collection = getCollection(userId);
    const entry = collection[targetSpecies] || null;
    const preferred = entry ? getPreferredVariant(entry, userId) : null;
    const search = entry ? findDexBuddy({ userId, targetSpecies, entry }) : null;

    const payload = {
      command: 'doctor',
      scope: 'dex',
      account: userId,
      install: install ? { type: install.type, path: install.path, version: installVersion } : null,
      current: { salt: currentSalt, buddy: roll(userId, currentSalt).bones },
      target: targetSpecies,
      profile: { knownProfiles: listKnownProfiles(), currentProfile: userId },
      stored: preferred ? mapResult(preferred) : null,
      apply: search?.found ? mapResult(search.found) : null,
      criteria: search?.criteria || null,
    };

    if (flags.json) {
      output(payload);
      return;
    }

    console.log(`\n${BOLD}  DEX DOCTOR${RESET}`);
    console.log(`${DIM}  profile: ${formatProfileBadge(userId)} | install: ${installVersion || 'unknown'}${RESET}`);
    console.log(`${DIM}  target: ${targetSpecies}${RESET}\n`);
    console.log(`${BOLD}  Current buddy${RESET}`);
    console.log(renderCard({ salt: currentSalt, ...roll(userId, currentSalt) }, { showSalt: true }));
    console.log(`${BOLD}  Stored preview${RESET}`);
    if (preferred) console.log(renderCard(preferred, { showSalt: true }));
    else console.log(`${DIM}  No stored form for this species in the current profile.${RESET}\n`);
    console.log(`${BOLD}  Apply candidate${RESET}`);
    if (search?.found) console.log(renderCard(search.found, { showSalt: true }));
    else console.log(`${DIM}  No apply candidate found.${RESET}\n`);
    return;
  }

  const payload = {
    command: 'doctor',
    scope: 'profile',
    account: targetProfile,
    install: install ? { type: install.type, path: install.path, version: installVersion } : null,
    profile: {
      currentProfile: userId,
      inspectedProfile: targetProfile,
      knownProfiles: listKnownProfiles(),
      bestRarity: profile.bestRarity,
      rollsToday: getRollsToday(profile),
      eventRemaining: getApologyEventRemaining(profile),
      collectedSpecies: Object.keys(profile.collection || {}).length,
    },
  };

  if (flags.json) {
    output(payload);
    return;
  }

  console.log(`\n${BOLD}  PROFILE DOCTOR${RESET}`);
  console.log(`${DIM}  current: ${formatProfileBadge(userId)}${RESET}`);
  console.log(`${DIM}  inspecting: ${formatProfileBadge(targetProfile)}${RESET}`);
  console.log(`${DIM}  known profiles: ${listKnownProfiles().join(', ') || '(none)'}${RESET}`);
  console.log(`${DIM}  install: ${installVersion || 'unknown'}${RESET}`);
  console.log(`${DIM}  best rarity: ${profile.bestRarity}${RESET}`);
  console.log(`${DIM}  rolls today: ${getRollsToday(profile)} | event remaining: ${getApologyEventRemaining(profile)}${RESET}`);
  console.log(`${DIM}  collected species: ${Object.keys(profile.collection || {}).length}${RESET}\n`);
}

async function promptReturnToHome() {
  const answer = await ask(`  ${DIM}Press Enter to go back to home, or type q to quit: ${RESET}`);
  return answer.toLowerCase() !== 'q';
}

async function cmdHome() {
  if (!process.stdin.isTTY || flags.json) {
    showHelp();
    return;
  }

  let activeProfileLensId = null;

  while (true) {
    console.log(renderHomeScreen());
    const currentContext = resolveClaudeContext();
    const knownProfiles = listKnownProfiles();
    activeProfileLensId = resolveActiveProfileLens(currentContext.userId, activeProfileLensId);
    console.log(`${DIM}Detected Claude account: ${formatProfileBadge(currentContext.userId)} | Saved profiles: ${knownProfiles.length}${RESET}`);
    console.log(`${DIM}Active profile lens: ${formatProfileBadge(activeProfileLensId)}${activeProfileLensId === currentContext.userId ? ' (live)' : ' (saved data)'}${RESET}\n`);
    const choice = await select({
      title: 'Speaki Quick Actions',
      columns: 2,
      fullscreen: true,
      items: [
        { label: `${GREEN}Check${RESET}`, description: '현재 버디 / 설치 상태 보기', value: 'check' },
        { label: `${GREEN}Gacha 10x${RESET}`, description: '기본 10연차 바로 실행', value: 'gacha' },
        { label: `${GREEN}Reroll${RESET}`, description: '후보 뽑고 바로 적용', value: 'reroll' },
        { label: `${GREEN}Dex${RESET}`, description: '도감 탐색하고 바로 적용', value: 'dex' },
        { label: `${GREEN}Doctor${RESET}`, description: '프로필/도감 진단', value: 'doctor' },
        { label: `${GREEN}Profiles${RESET}`, description: '저장 프로필 렌즈 선택', value: 'profiles' },
        { label: `${GREEN}Restore${RESET}`, description: '원래 버디로 복원', value: 'restore' },
        { label: `${GREEN}Setup${RESET}`, description: 'Bun / 런타임 셋업 복구', value: 'setup' },
        { label: `${GREEN}Update${RESET}`, description: '업데이트 후 셋업까지 실행', value: 'update' },
        { label: `${RED}Quit${RESET}`, description: '홈 종료', value: 'quit' },
      ],
      footer: (item) => [
        `${CYAN}▶${RESET} ${item.label}  ${item.description ? `${DIM}${item.description}${RESET}` : ''}`,
        `${DIM}Arrows move • Enter select • Esc back • Lens ${formatProfileBadge(activeProfileLensId)}${RESET}`,
      ],
    });

    if (!choice || choice.value === 'quit') {
      console.log(`${DIM}  Bye.${RESET}\n`);
      return;
    }

    switch (choice.value) {
      case 'check':
        await cmdCheck();
        break;
      case 'gacha':
        await cmdGacha(DEFAULT_PULLS);
        break;
      case 'reroll':
        await cmdReroll();
        break;
      case 'dex':
        {
          const dexResult = await cmdDex({ profileLensId: activeProfileLensId, skipLensPrompt: true });
          if (dexResult?.promptReturn === false) {
            continue;
          }
        }
        break;
      case 'doctor':
        await cmdDoctor('profile', activeProfileLensId);
        break;
      case 'profiles':
        activeProfileLensId = await cmdProfiles(currentContext.userId, activeProfileLensId) || activeProfileLensId;
        break;
      case 'restore':
        await cmdRestore();
        break;
      case 'setup':
        await cmdSetup();
        break;
      case 'update':
        await cmdUpdate();
        break;
      default:
        return;
    }

    const shouldContinue = await promptReturnToHome();
    if (!shouldContinue) {
      console.log(`${DIM}  Bye.${RESET}\n`);
      return;
    }
  }
}

function showHelp() {
  console.log(renderHomeScreen());
  console.log(`${BOLD}Flags${RESET}`);
  console.log(`  ${GREEN}--json${RESET}      stdout JSON, logs on stderr`);
  console.log(`  ${GREEN}--pick N${RESET}    auto-select candidate or dex target`);
  console.log(`  ${GREEN}--dry-run${RESET}   preview without patching`);
  console.log(`  ${GREEN}--fields a,b${RESET} filter JSON output fields`);
  console.log(`  ${GREEN}--limit N${RESET}   gacha pull count override`);
  console.log();
  console.log(`${BOLD}Setup${RESET}`);
  console.log(`  ${GREEN}bdy setup${RESET}    install Bun/runtime hook support if missing`);
  console.log(`  ${GREEN}bdy update${RESET}   update package and rerun runtime setup`);
  console.log(`  ${GREEN}bdy doctor${RESET}   inspect current profile or dex apply candidate`);
  console.log();
  console.log(`${DIM}Daily quota: ${BASE_LIMIT} (+1 with GitHub star) | Event bonus: ${APOLOGY_EVENT.pullsPerRun}-pull x${APOLOGY_EVENT.bonusRuns}${RESET}\n`);
}

// ─── Main ───────────────────────────────────────────

switch (cmd) {
  case 'check':   await cmdCheck(); break;
  case 'gacha':   await cmdGacha(Math.min(Math.max(1, parseInt(args[0]) || flags.limit || 10), 100)); break;
  case 'reroll':  await cmdReroll(); break;
  case 'restore': await cmdRestore(); break;
  case 'dex':     await cmdDex(); break;
  case 'setup':   await cmdSetup(); break;
  case 'doctor':  await cmdDoctor(args[0], args[1]); break;
  case 'schema':  cmdSchema(args[0]); break;
  case 'update':  await cmdUpdate(); break;
  case '--help': case '-h': case 'help': showHelp(); break;
  default: await cmdHome(); break;
}

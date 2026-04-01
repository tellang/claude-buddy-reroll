---
name: buddy-reroll
description: Reroll your Claude Code /buddy companion. Gacha simulator + SALT patcher. Preview, reroll, and pick your favorite buddy. Supports both native binary and npm installs. Daily 3-roll limit with star request on rarity upgrade. Use when user says "buddy reroll", "버디 리롤", "가챠", "buddy gacha", "buddy check", "buddy dex", "내 버디", "버디 뽑기", "reroll", "리롤".
---

# buddy-reroll — Claude Code Buddy Reroller

Reroll your Claude Code buddy companion with a gacha-style simulator.

## Commands

Run all commands from the skill's base directory via Bash.

### check — Show current buddy

```bash
node {SKILL_DIR}/src/cli.mjs check
```

### gacha [N] — Roll N random buddies (daily limit: 3)

```bash
node {SKILL_DIR}/src/cli.mjs gacha [N]
```

Rolls N buddies (default 10). Highlights best pull. If rarity upgrades from previous best, prompts a Speaki-style GitHub star request.

### reroll — Interactive reroll with SALT patch

```bash
node {SKILL_DIR}/src/cli.mjs reroll
```

Shows current buddy, rolls candidates, picks one, patches SALT + clears soul. Handles native binary (binary-safe patch + swap instructions) and npm (direct text patch) automatically.

### dex — Pokédex

```bash
node {SKILL_DIR}/src/cli.mjs dex
```

### restore — Restore original buddy

```bash
node {SKILL_DIR}/src/cli.mjs restore
```

## How it works

- Buddy = `hash(accountId + SALT)` via FNV-1a + Mulberry32 (exact replica of v2.1.89)
- Changing the SALT → completely different buddy (species, rarity, stats, hat, eyes)
- Clearing `.claude.json` companion → new name + personality on restart
- Native binary: binary-safe Buffer patch, requires Claude exit for swap
- npm install: direct text replacement in cli.js

## Limits

- 3 gacha rolls per day (resets at midnight, stored in `~/.claude/buddy-reroll-state.json`)
- On rarity upgrade, a Speaki-style star request appears. Consider invoking `/star-prompt` skill if user agrees.

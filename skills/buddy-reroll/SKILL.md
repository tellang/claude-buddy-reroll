---
name: buddy-reroll
description: Reroll your Claude Code /buddy companion. Gacha simulator + SALT patcher. Preview, reroll, and pick your favorite buddy. Supports both native binary and npm installs. Daily 3-roll limit with star request on rarity upgrade. Use when user says "buddy reroll", "버디 리롤", "가챠", "buddy gacha", "buddy check", "buddy dex", "내 버디", "버디 뽑기", "reroll", "리롤".
allowed-tools: [Bash, Read, Glob]
---

# buddy-reroll — Claude Code Buddy Reroller

Reroll your Claude Code buddy companion with a gacha-style simulator.

## Commands

All commands use the `src/` directory relative to the plugin root.

### check — Show current buddy

```bash
node {{PLUGIN_DIR}}/src/cli.mjs check
```

### gacha [N] — Roll N random buddies (daily limit: 3)

```bash
node {{PLUGIN_DIR}}/src/cli.mjs gacha [N]
```

If rarity upgrades from previous best, a Speaki-style GitHub star request appears.

### reroll — Interactive reroll with SALT patch

```bash
node {{PLUGIN_DIR}}/src/cli.mjs reroll
```

Patches SALT + clears soul. Native binary: binary-safe patch + swap instructions. npm: direct text patch.

### dex — Pokédex

```bash
node {{PLUGIN_DIR}}/src/cli.mjs dex
```

### restore — Restore original buddy

```bash
node {{PLUGIN_DIR}}/src/cli.mjs restore
```

## How it works

- Buddy = `hash(accountId + SALT)` via FNV-1a + Mulberry32 (exact replica of v2.1.89)
- Changing the SALT → completely different buddy
- Clearing `.claude.json` companion → new name + personality on restart
- Native binary: binary-safe Buffer patch, requires Claude exit for swap
- npm install: direct text replacement in cli.js

## Limits

- 3 gacha rolls per day (resets at midnight)
- On rarity upgrade, consider invoking `/star-prompt` if user agrees

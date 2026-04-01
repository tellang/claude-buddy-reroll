---
name: buddy-reroll
description: Reroll your Claude Code /buddy companion. Gacha simulator + SALT patcher. Preview, reroll, and pick your favorite buddy.
---

# buddy-reroll — Claude Code Buddy Reroller

Reroll your Claude Code buddy companion with a gacha-style simulator.

## Commands

When the user says "buddy reroll", "버디 리롤", "가챠", "buddy gacha", "buddy check", "buddy dex", "내 버디", "버디 뽑기", execute the appropriate command below.

### check — Show current buddy

Run: `node ~/.claude/skills/buddy-reroll/src/cli.mjs check`

Shows the user's current buddy based on their accountUuid and the active SALT.

### gacha [N] — Roll N random buddies

Run: `node ~/.claude/skills/buddy-reroll/src/cli.mjs gacha [N]`

Rolls N (default 10) random buddies with different SALTs. Shows a mini-card list and highlights the best pull.

### reroll — Interactive reroll with SALT patch

Run: `node ~/.claude/skills/buddy-reroll/src/cli.mjs reroll`

Interactive mode: shows current buddy, rolls 10 candidates, lets user pick one, then patches the SALT in Claude Code's cli.js. Requires npm-installed Claude Code (not native binary).

### dex — Show all species and rarities

Run: `node ~/.claude/skills/buddy-reroll/src/cli.mjs dex`

Shows all 18 species, 5 rarity tiers, eyes, hats, and stats.

### restore — Restore original buddy

Run: `node ~/.claude/skills/buddy-reroll/src/cli.mjs restore`

Restores the original SALT from backup, giving you back your original buddy.

## How it works

Your buddy is determined by: `hash(accountId + SALT)`

By changing the SALT in Claude Code's cli.js, you get a completely different buddy.
The algorithm (FNV-1a + Mulberry32) is an exact replica of Claude Code v2.1.89's implementation.

## Requirements

- Node.js >= 18
- Claude Code installed via npm (for reroll/patch features)

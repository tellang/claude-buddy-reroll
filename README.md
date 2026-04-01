# claude-buddy-reroll

> Reroll your Claude Code `/buddy` companion

Your buddy is locked to your account ID. This plugin changes that.

## Install

```bash
claude plugin add --marketplace https://github.com/tellang/claude-buddy-reroll.git
claude plugin install buddy-reroll
```

Or manual:
```bash
git clone https://github.com/tellang/claude-buddy-reroll ~/.claude/skills/buddy-reroll
```

## Usage

Inside Claude Code, just say:

- **"가챠"** / **"buddy gacha"** — roll 10 random buddies (3x/day limit)
- **"내 버디"** / **"buddy check"** — show your current buddy
- **"버디 도감"** / **"buddy dex"** — browse all 18 species

When you find one you like, note the `salt` value, close Claude Code, and run:

```bash
# Backup + patch (one-time)
cp ~/.local/bin/claude.exe ~/.local/bin/claude.exe.bak
node ~/.claude/skills/buddy-reroll/src/cli.mjs reroll
```

## How it works

```
Buddy = hash(your_account_id + SALT)
```

Same algorithm as Claude Code v2.1.89 (FNV-1a + Mulberry32). Change the SALT, get a different buddy. Supports both native binary and npm installs.

## What you get

```
  BUDDY GACHA — Rolling 10x...

 1. · rabbit     ★★
 2. × octopus    ★
 3. ◉ chonk      ★
 4. ✦ ghost      ★★
 5. ° cat        ★
 6. × octopus    ★★★    ← Best!
 ...
```

**18 species**: duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

**5 rarities**: Common (60%) · Uncommon (25%) · Rare (10%) · Epic (4%) · Legendary (1%)

**Plus**: 6 eyes, 8 hats, 5 stats, 1% shiny chance

## Limits

- 3 gacha rolls per day (resets at midnight)
- Rarity upgrade triggers a star request

## Safety

- Backup created before any patch
- `restore` command reverts instantly
- Only changes a 15-char string — nothing else touched

## License

MIT

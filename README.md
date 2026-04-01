# claude-buddy-reroll 🎰

> Reroll your Claude Code `/buddy` companion — gacha simulator + SALT patcher

Claude Code's buddy system generates a permanent companion from your account ID. **You can't choose.** This tool changes that.

## How it works

Your buddy = `hash(accountId + SALT)`. We swap the SALT → completely different buddy.

```
Original:  hash("you" + "friend-2026-401") → 🐢 turtle (common)
Patched:   hash("you" + "buddy-reroll-0t") → 🐙 octopus (rare ★★★)
```

Algorithm is an exact replica of Claude Code v2.1.89 (FNV-1a + Mulberry32).

## Install

```bash
# As Claude Code skill
git clone https://github.com/tellang/claude-buddy-reroll ~/.claude/skills/buddy-reroll

# Or global CLI
npm i -g claude-buddy-reroll
```

## Usage

```bash
buddy-reroll check          # Show your current buddy
buddy-reroll gacha 20       # 20-pull gacha
buddy-reroll reroll         # Interactive reroll + SALT patch
buddy-reroll restore        # Undo — restore original buddy
buddy-reroll dex            # Pokédex of all 18 species
```

## Gacha Preview

```
  🎰 BUDDY GACHA — Rolling 10x...

 1. · rabbit     ★★
 2. × octopus    ★
 3. @ octopus    ★
 4. ◉ chonk      ★
 5. · cactus     ★
 6. ✦ ghost      ★★
 7. ° cat        ★
 8. × octopus    ★★★    ← Best pull!
 9. × mushroom   ★
10. × duck       ★
```

## Species (18)

duck · goose · blob · cat · dragon · octopus · owl · penguin · turtle · snail · ghost · axolotl · capybara · cactus · robot · rabbit · mushroom · chonk

## Rarities

| Tier | Chance | Stars |
|------|--------|-------|
| Common | 60% | ★ |
| Uncommon | 25% | ★★ |
| Rare | 10% | ★★★ |
| Epic | 4% | ★★★★ |
| Legendary | 1% | ★★★★★ |

Plus: 6 eye types, 8 hats, 5 stats (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK), 1% shiny chance.

## Requirements

- Node.js >= 18
- Claude Code installed via npm (for SALT patching)
  - Native binary patching: coming when buddy ships to stable channel

## Safety

- Backup is created before any patch (`cli.js.buddy-backup`)
- `restore` command reverts to original instantly
- Only modifies a 15-character string — no other code is touched

## License

MIT

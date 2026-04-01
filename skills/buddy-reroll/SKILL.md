---
name: buddy-reroll
description: Reroll your Claude Code /buddy companion. Gacha simulator + SALT patcher. Preview, reroll, and pick your favorite buddy. Supports both native binary and npm installs. Daily 3-roll limit with star request on rarity upgrade. Use when user says "buddy reroll", "버디 리롤", "가챠", "buddy gacha", "buddy check", "buddy dex", "내 버디", "버디 뽑기", "reroll", "리롤".
allowed-tools: [Bash, Read, Glob, AskUserQuestion]
---

# buddy-reroll — 스피키의 버디 가챠!

쪼아요 쪼아요~ 맘에 안 드는 버디? 스피키가 다시 뽑아줄 거예요!

## 첫 실행 시 셋업

플러그인 설치 후 **처음 한 번만** 훅을 설치하세요:

```bash
bun {{PLUGIN_DIR}}/scripts/install-hook.mjs
```

이러면 Claude Code 종료 시 패치 바이너리가 자동 스왑돼요!

## 가챠 플로우 (핵심)

사용자가 "가챠", "뽑기", "buddy gacha" 등을 말하면 이 순서로 진행하세요:

### Step 1: 가챠 실행 (5연차)

gh 인증 체크와 **동시에** 실행:

```bash
# 포그라운드 — 가챠
echo "q" | bun {{PLUGIN_DIR}}/src/cli.mjs gacha 5

# 백그라운드 (run_in_background=true) — gh 체크
gh auth status 2>&1 | head -3
```

### Step 2: 결과 요약 → AskUserQuestion

가챠 결과를 파싱해서 AskUserQuestion으로 선택지를 보여주세요.
**5개 결과를 옵션으로** 만들어요:

```
question: "쪼아요~ 어떤 버디로 바꿀래요?"
header: "가챠 결과"
options:
  - label: "#1 OWL ★★★"
    description: "@ eyes, wizard hat | WIS:82 CHA:33 | salt: buddy-reroll-kl"
  - label: "#2 DRAGON ★★"
    description: "◉ eyes, crown | DEB:45 PAT:60 | salt: buddy-reroll-ab"
  - label: "#3 GHOST ★★"
    description: "× eyes, halo | CHA:55 SNK:40 | salt: buddy-reroll-cd"
  - label: "패스 (다음에 뽑을래요)"
    description: "이번 결과는 넘기고 나중에 다시 도전!"
```

### Step 3: 선택 → 자동 패치

사용자가 버디를 선택하면:

1. **바이너리 패치** — 선택한 salt로 패치 바이너리 생성:
```bash
node -e "
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
const home = process.env.USERPROFILE || process.env.HOME;
const bin = resolve(home, '.local', 'bin', 'claude.exe');
const buf = readFileSync(bin);
const oldB = Buffer.from('{현재SALT}', 'utf-8');
const newB = Buffer.from('{선택한SALT}', 'utf-8');
let o = 0; while (true) { const i = buf.indexOf(oldB, o); if (i === -1) break; newB.copy(buf, i); o = i + oldB.length; }
writeFileSync(resolve(home, '.local', 'bin', 'claude-patched.exe'), buf);
"
```

2. **Soul 삭제** — 이름/성격 리셋:
```bash
node -e "
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
const p = resolve(process.env.USERPROFILE || process.env.HOME, '.claude.json');
const c = JSON.parse(readFileSync(p, 'utf-8'));
delete c.companion;
writeFileSync(p, JSON.stringify(c, null, 2), 'utf-8');
"
```

3. **안내**:
> 쪼아요~! {종} {레어도} 선택했어요!
> Claude Code 다시 시작하면 새 버디가 나와요!
> (Stop 훅이 자동으로 바이너리 교체해줄 거예요!)

"패스"를 선택하면:
> 괜찮아요~ 내일 또 뽑으면 돼요! 쪼아요!

### Step 4: 등급 업 → 스타 요청

가챠 결과에서 이전보다 높은 등급이 나왔으면 **Step 2의 AskUserQuestion 전에** gh 인증 결과를 확인하고:

**gh 인증 있으면** → AskUserQuestion에 스타 옵션 추가:
```
- label: "⭐ 스타 찍고 #{best} 선택!"
  description: "gh repo star tellang/claude-buddy-reroll → 보너스 +1회!"
```

이 옵션 선택 시 `gh repo star tellang/claude-buddy-reroll` 실행 후 패치 진행.

**gh 인증 없으면** → 패치 후 안내:
> 스타 하나만... https://github.com/tellang/claude-buddy-reroll ⭐

## 기타 명령

### "내 버디" / "buddy check"
```bash
bun {{PLUGIN_DIR}}/src/cli.mjs check
```

### "도감" / "buddy dex"
```bash
bun {{PLUGIN_DIR}}/src/cli.mjs dex
```

### "복원" / "restore"
```bash
bun {{PLUGIN_DIR}}/src/cli.mjs restore
```

### "셋업" / "setup"
```bash
bun {{PLUGIN_DIR}}/scripts/install-hook.mjs
```

## 제한

- 하루 3번! (스타 보너스 +1 = 4번) 자정 리셋
- 5연차 x 3회 = 하루 15뽑 (스타 유저: 20뽑)
- Stop 훅으로 종료 시 자동 바이너리 스왑

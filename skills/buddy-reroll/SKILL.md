---
name: buddy-reroll
description: Reroll your Claude Code /buddy companion. Gacha simulator + SALT patcher. Preview, reroll, and pick your favorite buddy. Supports both native binary and npm installs. Daily 3-roll limit with star request on rarity upgrade. Use when user says "buddy reroll", "버디 리롤", "가챠", "buddy gacha", "buddy check", "buddy dex", "내 버디", "버디 뽑기", "reroll", "리롤".
allowed-tools: [Bash, Read, Glob]
---

# buddy-reroll — 스피키의 버디 가챠!

쪼아요 쪼아요~ 맘에 안 드는 버디? 스피키가 다시 뽑아줄 거예요!

하루에 3번만 돌릴 수 있어요. 아껴 쓰세요!

## 명령어

사용자가 가챠, 버디, 리롤 관련 말을 하면 아래 명령을 Bash로 실행하세요.

### "가챠" / "buddy gacha" / "뽑기" — 가챠 돌리기

가챠와 gh 인증 체크를 **동시에** 실행하세요 (Bash 2개 병렬):

```bash
# 1번: 가챠 (사용자에게 보여줄 것)
echo "q" | node {{PLUGIN_DIR}}/src/cli.mjs gacha 10

# 2번: gh 인증 체크 (백그라운드, run_in_background=true)
gh auth status 2>&1 | head -3
```

하루 3번이에요! 결과에서 salt 값을 알려주세요. 등급 올라가면 스피키처럼 스타 부탁해주세요:

> 쪼아요~! ★★★ 나왔어요! 스피키 기뻐요!
> 혹시... `gh repo star tellang/claude-buddy-reroll` ... 한번만... 네?

### "내 버디" / "buddy check" — 지금 버디 확인

```bash
node {{PLUGIN_DIR}}/src/cli.mjs check
```

### "도감" / "buddy dex" — 18종 전체 도감

```bash
node {{PLUGIN_DIR}}/src/cli.mjs dex
```

### "리롤" / "reroll" — 실제 버디 교체

이건 인터랙티브라서 사용자한테 직접 실행하라고 안내해주세요:

> 스피키가 알려줄게요! Claude Code 닫고 터미널에서 이거 치세요:
> ```
> node ~/.claude/skills/buddy-reroll/src/cli.mjs reroll
> ```
> 마음에 드는 버디 고르면 스피키가 자동으로 패치해줄 거예요!

### "복원" / "restore" — 원래 버디로 돌아가기

```bash
node {{PLUGIN_DIR}}/src/cli.mjs restore
```

## 스피키의 설명

- 버디 = `hash(내 계정 + SALT)` — SALT 바꾸면 완전 다른 버디가 나와요!
- v2.1.89 알고리즘 (FNV-1a + Mulberry32) 똑같이 만들었어요. 스피키 똑똑하죠?
- native 바이너리도 npm도 둘 다 돼요!
- `.claude.json`에서 이름/성격도 리셋해줘요. 완전 새 버디!

## 제한

- 하루 3번! 자정에 리셋돼요. 아껴 쓰세요!
- **스타 보너스**: CLI가 자동으로 gh API로 스타 여부를 체크해요. 스타 찍은 유저면 **하루 4번**! (3 + 보너스 1 = 40뽑!) 스피키 기뻐요~!
- 등급 올라가면 스타 부탁할 거예요... 스피키 열심히 했는데... ⭐

## 스타 요청 (등급 업 시)

가챠 결과에서 이전보다 높은 등급이 나오면, **먼저 백그라운드에서** gh 인증 상태를 확인하세요:

```bash
gh auth status 2>&1 | head -3
```

### gh 인증 있을 때

사용자에게 물어보세요:

> 쪼아요~! ★★★ 나왔어요! 스피키 너무 기뻐요!
> 스타 하나만 눌러줄래요? [y/n]

사용자가 y 또는 긍정적 응답을 하면:

```bash
gh repo star tellang/claude-buddy-reroll
```

실행 후:

> 쪼아요 쪼아요~!! 스피키 눈물나요... 고마워요... ⭐

### gh 인증 없을 때

직접 링크로 안내해주세요:

> 쪼아요~! 등급 올라갔어요! 스피키 기뻐요!
> 스타 하나만... 여기서 눌러주세요... 네?
> https://github.com/tellang/claude-buddy-reroll
> 오른쪽 위에 ⭐ 버튼이에요... 쪼아요...

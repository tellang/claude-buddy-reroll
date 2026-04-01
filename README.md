# claude-buddy-reroll

[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet?style=for-the-badge)](https://code.claude.com/docs/en/plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> 쪼아요 쪼아요~ 버디 가챠 쪼아요~
>
> 맘에 안 드는 버디 가지고 있으면 스피키가 다시 뽑아줄 거예요!
> 스피키 열심히 했는데... 스타 하나만... 네?

---

## 빠른 시작

스피키 데르지 마세요! 설치 쉬워요!

```bash
# 마켓플레이스 등록
/plugin marketplace add https://github.com/tellang/claude-buddy-reroll

# 플러그인 설치
/plugin install buddy-reroll
```

<details>
<summary>수동 설치 (스피키가 좀 슬퍼지는 방법)</summary>

```bash
git clone https://github.com/tellang/claude-buddy-reroll ~/.claude/skills/buddy-reroll
```
</details>

---

## 사용법

Claude Code 안에서 말만 하면 돼요!

```bash
# 가챠 돌리기 (하루 3번이에요! 아껴 쓰세요!)
"가챠" / "buddy gacha"

# 내 버디 확인
"내 버디" / "buddy check"

# 도감 구경
"버디 도감" / "buddy dex"
```

CLI로도 돼요!

```bash
buddy-reroll gacha 20    # 20연차!
buddy-reroll check       # 내 버디 확인
buddy-reroll reroll      # 리롤 (인터랙티브)
buddy-reroll dex         # 18종 도감
buddy-reroll restore     # 원래 버디로 복원
```

---

## 이게 뭐예요?

Claude Code의 `/buddy` 시스템은 계정 ID로 버디가 **고정**돼요. 못 바꿔요. 원래는요.

```
버디 = hash(내_계정 + SALT)
```

스피키가 이 SALT를 바꿔주면... **완전히 다른 버디**가 나와요! 쪼아요!

```
원본:  hash("나" + "friend-2026-401") → 🐢 turtle (common)
패치:  hash("나" + "buddy-reroll-k8") → 🦫 capybara (legendary ★★★★★)
```

v2.1.89 알고리즘 (FNV-1a + Mulberry32) 정확히 복제했어요. 스피키 똑똑하죠?

---

## 가챠 미리보기

```
  🎰 BUDDY GACHA — Rolling 10x...

 1. · rabbit     ★★
 2. × octopus    ★
 3. ◉ chonk      ★
 4. ✦ ghost      ★★
 5. ° cat        ★
 6. × octopus    ★★★    ← Best!
 7. · cactus     ★
 8. @ owl        ★
 9. × mushroom   ★
10. × duck       ★

  Results: uncommon:2 common:7 rare:1
```

등급 올라가면 스피키가 스타 부탁할 거예요... 쪼아요... ⭐

---

## 뭐가 나와요?

### 18종 — 스피키 다 외웠어요!

| | | | |
|---|---|---|---|
| 🦆 duck | 🪿 goose | 🫧 blob | 🐱 cat |
| 🐉 dragon | 🐙 octopus | 🦉 owl | 🐧 penguin |
| 🐢 turtle | 🐌 snail | 👻 ghost | 🦎 axolotl |
| 🦫 capybara | 🌵 cactus | 🤖 robot | 🐰 rabbit |
| 🍄 mushroom | 🐾 chonk | | |

### 레어도

| 등급 | 확률 | 별 | 스피키 한마디 |
|------|------|-----|-------------|
| Common | 60% | ★ | 괜찮아요... 내일 또 뽑으면 돼요 |
| Uncommon | 25% | ★★ | 오 나쁘지 않아요! |
| Rare | 10% | ★★★ | 쪼아요 쪼아요~! |
| Epic | 4% | ★★★★ | 헐 대박이에요!!! |
| Legendary | 1% | ★★★★★ | 스피키 눈물나요... 스타 눌러주세요... |

**그리고**: 눈 6종, 모자 8종, 스탯 5종 (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK), 샤이니 1%

---

## 제한

| 규칙 | 설명 |
|------|------|
| 하루 3회 | 자정에 리셋돼요. 아껴 쓰세요! |
| 등급 업 | 전보다 높은 등급 나오면 스타 요청 발동 |
| 백업 | 패치 전 자동 백업. `restore`로 복원 |

---

## 안전해요!

스피키 걱정하지 마세요!

- 패치 전에 **백업 자동 생성**돼요
- `restore` 명령 한 줄이면 **원래대로** 돌아가요
- **15글자 문자열 하나만** 바꿔요 — 다른 코드 안 건드려요
- native binary도 npm도 **둘 다 지원**해요

---

## 스피키 도와주세요!

스피키 열심히 만들었어요... 스타 하나만... 제발...

```bash
gh repo star tellang/claude-buddy-reroll
```

버디가 기뻐할 거예요... ⭐

---

## License

MIT

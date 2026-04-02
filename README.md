# claude-buddy-reroll

[![npm](https://img.shields.io/npm/v/claude-buddy-reroll?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/claude-buddy-reroll)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> 쪼아요 쪼아요~ 버디 가챠 쪼아요~
>
> 맘에 안 드는 버디? 스피키가 npm 터미널에서 다시 뽑아줄 거예요!

---

## 설치

```bash
npm i -g claude-buddy-reroll
```

설치하면 `buddy`와 `bdy` 명령어가 생겨요.

기본 화면은 스피키 스타일의 리치 터미널 홈으로 시작하고, `dex`는 발견한 개체를 다시 적용할 수 있게 설계돼 있어요.
지금은 `fullscreen dex`, `animated preview`, `form collection`, `one-by-one gacha reveal`까지 들어가 있어요.
여러 Claude 계정이 있어도 현재 계정을 직접 읽어서 계정별 프로필 상태를 따로 저장해요.

처음 설치할 때 런타임 셋업이 자동으로 Bun과 Claude 연동을 준비해요. 자동 셋업이 실패했거나 `Bun is required` 에러가 보이면 아래를 한 번 실행하세요.

```bash
bdy setup
```

`bdy update`도 업데이트 후 같은 셋업을 자동으로 다시 확인해요.
그리고 현재 계정 기준으로 도감 정합성도 다시 맞춰요.

---

## CLI 사용법

```bash
bdy                    # 스피키 홈 / 명령 요약
bdy check              # 내 버디 확인
bdy gacha              # 10연차 가챠!
bdy gacha 20           # 20연차!
bdy reroll             # 리롤 (인터랙티브 버디 교체)
bdy dex                # fullscreen 도감 + 상세 패널 + 발견 개체 재적용
bdy doctor             # profile / dex apply 진단
bdy restore            # 원래 버디로 복원
bdy setup              # Bun / 런타임 셋업 복구
```

## 지금 버전의 방향

- npm-only 제품 표면
- 스피키 감성의 richer terminal UI
- species-only가 아니라 discovered variant를 우선 재적용하는 dex
- species progress와 form collection을 분리한 도감
- 10연차 one-by-one reveal + highlight-aware skip
- 오른쪽 상세 패널에 animated preview / flavor text / rarity track / form gallery
- 현재 Claude 계정을 매번 직접 읽고 계정별 프로필 상태를 분리 저장
- `doctor`로 profile / dex preview vs apply 후보 비교 가능
- JSON 모드는 유지해서 에이전트/스크립트 자동화도 가능

### Agent DX (JSON 모드)

에이전트/스크립트에서 쓸 때:

```bash
bdy check --json                          # 구조화된 JSON 출력
bdy gacha 5 --json --fields species,rarity # 필드 필터링
bdy reroll --json                          # 후보만 출력
bdy reroll --json --pick 3                 # 3번 자동 선택 + 패치
bdy reroll --json --pick 3 --dry-run       # 미리보기만
bdy doctor --json                          # 현재 profile 진단
bdy doctor dex 13 --json                   # 특정 도감 항목 preview/apply 비교
bdy schema                                 # 전체 커맨드 JSON Schema
bdy schema gacha                           # 특정 커맨드 스키마
```

| 플래그 | 설명 |
|--------|------|
| `--json` | stdout에 JSON, 로그는 stderr |
| `--pick N` | N번째 자동 선택 (readline 스킵) |
| `--dry-run` | 패치 미리보기 (reroll 전용) |
| `--fields a,b` | 출력 필드 필터링 |
| `--limit N` | 가챠 횟수 지정 |

## 이게 뭐예요?

Claude Code의 `/buddy`는 계정 ID로 버디가 **고정**돼요.

```
버디 = hash(내_계정 + SALT)
```

스피키가 SALT를 바꿔주면 **완전히 다른 버디**가 나와요!

```
원본:  hash("나" + "friend-2026-401") → 🐢 turtle (common ★)
패치:  hash("나" + "buddy-reroll-k8") → 🦫 capybara (legendary ★★★★★)
```

Bun.hash(wyhash) + Mulberry32 알고리즘을 정확히 복제했고, 도감에는 발견한 변형 정보를 저장해서 재적용할 수 있게 했어요.

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
```

---

## 뭐가 나와요?

### 18종

| | | | |
|---|---|---|---|
| 🦆 duck | 🪿 goose | 🫧 blob | 🐱 cat |
| 🐉 dragon | 🐙 octopus | 🦉 owl | 🐧 penguin |
| 🐢 turtle | 🐌 snail | 👻 ghost | 🦎 axolotl |
| 🦫 capybara | 🌵 cactus | 🤖 robot | 🐰 rabbit |
| 🍄 mushroom | 🐾 chonk | | |

### 레어도

| 등급 | 확률 | 별 |
|------|------|-----|
| Common | 60% | ★ |
| Uncommon | 25% | ★★ |
| Rare | 10% | ★★★ |
| Epic | 4% | ★★★★ |
| Legendary | 1% | ★★★★★ |

눈 6종, 모자 8종, 스탯 5종, 샤이니 1%

---

## 제한

| 규칙 | 설명 |
|------|------|
| 하루 3회 | 자정 리셋 (스타 유저 +1) |
| 이벤트 보너스 | 10연차 x3회 추가 |
| 백업 | 패치 전 자동 백업, `bdy restore`로 복원 |

---

## 스피키 도와주세요!

```bash
gh repo star tellang/claude-buddy-reroll
```

별 하나만... 제발... 버디가 기뻐할 거예요... ⭐

---

## License

MIT

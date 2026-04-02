---
name: buddy-doctor
description: Diagnose and fix buddy-reroll installation issues. Use when buddy reroll doesn't work, shows errors, or the binary swap fails. Triggers on "buddy doctor", "버디 진단", "buddy fix", "버디 안돼", "buddy error", "reroll 에러", "buddy setup", "셋업".
allowed-tools: [Bash, Read, Glob, AskUserQuestion]
---

# buddy-doctor — 버디 리롤 진단 도구

설치 문제를 진단하고 자동 수리합니다.

## 진단 플로우

### Step 1: 환경 체크 (모두 병렬 실행)

```bash
# Bun 설치 확인
bun --version 2>&1 || echo "BUN_MISSING"

# Node 버전
node --version

# Claude 바이너리 위치
ls -la "$HOME/.local/bin/claude.exe" 2>/dev/null || ls -la "$HOME/.local/bin/claude" 2>/dev/null || echo "NATIVE_MISSING"

# npm 설치 확인
npm root -g 2>/dev/null

# gh CLI 확인
gh auth status 2>&1 | head -3 || echo "GH_MISSING"
```

```bash
# 상태 파일들
cat "$HOME/.claude/buddy-reroll-state.json" 2>/dev/null || echo "STATE_MISSING"
cat "$HOME/.claude/buddy-reroll-install.json" 2>/dev/null || echo "CONTEXT_MISSING"
```

```bash
# Stop hook 확인
grep -c "buddy-swap" "$HOME/.claude/settings.json" 2>/dev/null || echo "HOOK_MISSING"

# 패치 대기 파일 확인
ls -la "$HOME/.local/bin/claude-patched"* 2>/dev/null || echo "NO_PENDING_PATCH"
ls -la "$HOME/.local/bin/claude.exe.old" 2>/dev/null || echo "NO_OLD_BINARY"
```

### Step 2: 결과 분석 → AskUserQuestion

진단 결과를 파싱해서 문제 목록과 수리 옵션을 제시:

```
question: "진단 결과입니다. 어떻게 할까요?"
options:
  - label: "전체 자동 수리"
    description: "발견된 모든 문제를 자동으로 수정합니다"
  - label: "Bun만 설치"
    description: "Bun이 없어서 해시 계산이 안 됩니다"
  - label: "Stop hook 재설치"
    description: "바이너리 스왑 훅이 없습니다"
  - label: "대기 중인 패치 강제 적용"
    description: "claude-patched 파일이 있지만 스왑되지 않았습니다"
  - label: "상태 초기화"
    description: "state/context 파일을 리셋합니다"
  - label: "취소"
```

### Step 3: 수리 실행

선택에 따라:

#### Bun 설치
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/install-hook.mjs
```

#### Stop hook 재설치
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/install-hook.mjs
```

#### 대기 패치 강제 적용
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/buddy-swap.mjs
```

#### 상태 초기화
```bash
node -e "
import { writeFileSync } from 'fs';
import { resolve } from 'path';
const home = process.env.USERPROFILE || process.env.HOME;
writeFileSync(resolve(home, '.claude', 'buddy-reroll-state.json'), JSON.stringify({ rolls: [], bestRarity: 'common', eventUses: [] }, null, 2));
console.log('State reset complete');
"
```

#### 전체 자동 수리
위 항목 중 문제가 발견된 것만 순서대로 실행.

### Step 4: 결과 보고

수리 후 다시 Step 1 진단을 실행하여 모든 항목이 통과하는지 확인.

통과 시:
> 모든 진단 통과! buddy reroll 명령을 다시 시도해 보세요.

실패 시:
> 일부 항목이 아직 문제입니다. 수동 조치가 필요할 수 있습니다.

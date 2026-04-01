#!/bin/bash
# Auto-swap buddy-patched binary on Claude Code exit
PATCHED="$HOME/.local/bin/claude-patched.exe"
TARGET="$HOME/.local/bin/claude.exe"

if [ -f "$PATCHED" ]; then
  nohup bash -c '
    sleep 3
    PATCHED="$HOME/.local/bin/claude-patched.exe"
    TARGET="$HOME/.local/bin/claude.exe"
    for i in $(seq 1 10); do
      cp "$PATCHED" "$TARGET" 2>/dev/null && break
      sleep 2
    done
    rm -f "$PATCHED" 2>/dev/null
  ' >/dev/null 2>&1 &
fi

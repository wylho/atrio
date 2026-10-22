#!/usr/bin/env bash
# Copia as skills compartilhadas (a versão principal mora aqui, em .claude/skills) para os dois apps, que as carregam
# do próprio repositório. Uso: scripts/sync-skills.sh   (IDEARIO_DIR e NODO_DIR mudam onde estão os apps)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
base="$(dirname "$here")"
IDEARIO_DIR="${IDEARIO_DIR:-$base/wylho/ideario}"
NODO_DIR="${NODO_DIR:-$base/mapist}"
for dir in "$IDEARIO_DIR" "$NODO_DIR"; do
  for s in "$here"/.claude/skills/*/; do
    name="$(basename "$s")"
    mkdir -p "$dir/.claude/skills/$name"
    cp -R "$s." "$dir/.claude/skills/$name/"
    echo "$dir/.claude/skills/$name"
  done
done

#!/usr/bin/env bash
# Leva os DOIS apps para uma tag do Atrio, juntos (regra: nenhum app fica numa tag velha).
# Espera o CI criar a tag, troca a referência no npm/pnpm e no Cargo de cada app, instala e atualiza o lockfile.
# Uso: scripts/apps-up.sh 0.12.0   (IDEARIO_DIR e NODO_DIR mudam onde estão os apps)
set -euo pipefail
v="v${1:?uso: scripts/apps-up.sh X.Y.Z}"
here="$(cd "$(dirname "$0")/.." && pwd)"
base="$(dirname "$here")"
IDEARIO_DIR="${IDEARIO_DIR:-$base/wylho/ideario}"
NODO_DIR="${NODO_DIR:-$base/mapist}"

echo "Esperando a tag $v no GitHub (o CI do Atrio cria)…"
for _ in $(seq 1 60); do
  git -C "$here" ls-remote --exit-code --tags origin "refs/tags/$v" >/dev/null 2>&1 && break
  sleep 10
done
git -C "$here" ls-remote --exit-code --tags origin "refs/tags/$v" >/dev/null || { echo "a tag $v não apareceu: ver o CI do Atrio"; exit 1; }

# Troca `atrio#vA.B.C` (npm) e `atrio = { git = …, tag = "vA.B.C" }` (Cargo) em todos os manifestos de um app.
retag() {
  local dir="$1"
  grep -rlE --include=package.json --include=Cargo.toml 'wylho/atrio' "$dir" \
    --exclude-dir=node_modules --exclude-dir=target | while read -r f; do
    sed -i.bak -E "s#(wylho/atrio\#)v[0-9]+\.[0-9]+\.[0-9]+#\1$v#; /wylho\/atrio/ s#tag = \"v[0-9]+\.[0-9]+\.[0-9]+\"#tag = \"$v\"#" "$f"
    rm -f "$f.bak"
    echo "  $f"
  done
}

for dir in "$IDEARIO_DIR" "$NODO_DIR"; do
  [ -d "$dir" ] || { echo "app não encontrado: $dir"; exit 1; }
  echo "== $dir"
  retag "$dir"
  # Instala onde houver package.json com o Atrio (npm ou pnpm, pelo lockfile).
  grep -rl --include=package.json 'wylho/atrio' "$dir" --exclude-dir=node_modules | while read -r pkg; do
    d="$(dirname "$pkg")"
    if [ -f "$d/pnpm-lock.yaml" ]; then (cd "$d" && pnpm install --silent); else (cd "$d" && npm install --silent); fi
  done
  # Lockfile do Cargo, se o app usa a crate.
  for ws in $(grep -rl --include=Cargo.toml 'wylho/atrio' "$dir" --exclude-dir=target | xargs -r -n1 dirname | sort -u); do
    root="$ws"; while [ "$root" != "$dir" ] && [ ! -f "$root/Cargo.lock" ]; do root="$(dirname "$root")"; done
    [ -f "$root/Cargo.lock" ] && (cd "$root" && cargo metadata --format-version 1 >/dev/null) || true
  done
done
echo "Pronto: os dois apps em $v. Falta verificar cada um (ver a skill atrio-hub)."

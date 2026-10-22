#!/usr/bin/env bash
# Sobe a versão do Atrio: package.json e crate Rust juntos (o CI cria a tag vX.Y.Z no push do main).
# Uso: scripts/bump.sh 0.12.0
set -euo pipefail
v="${1:?uso: scripts/bump.sh X.Y.Z}"
cd "$(dirname "$0")/.."
node -e "const f='package.json',p=require('./'+f);p.version='$v';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
sed -i.bak -E "0,/^version = \".*\"/s//version = \"$v\"/" crates/atrio/Cargo.toml && rm crates/atrio/Cargo.toml.bak
cargo metadata --format-version 1 >/dev/null
echo "Atrio $v: package.json e crates/atrio/Cargo.toml"

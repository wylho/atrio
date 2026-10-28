# Simulação do navegador sem regra própria do card

Status: needs-triage
Repos: ideario, nodo

## Pergunta

O mock do Ideario (`src/lib/api/mock`) e a prévia do Nodo (`lib/preview.ts`) ainda montam a prévia do card em
TypeScript, ao lado do `atrio::projection`. Vale manter o `markdown.ts` do Atrio como espelho testado contra o Rust
(teste de igualdade) ou compilar a projeção para WASM?

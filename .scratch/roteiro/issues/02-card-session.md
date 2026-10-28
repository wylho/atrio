# Card aberto: CardSession

Status: needs-triage
Repos: atrio, nodo, ideario

## Pergunta

Defeitos 8 e 9 do `UNIFICACAO.md`, conferidos no código em 28/10: o `NodeNote.svelte` do Nodo não chama `settle()`
ao fechar (gravação em curso pode se perder) e não há trava comum dos atalhos do app com o card aberto. Proposta da
unificação: `CardSession` no Atrio (`flush`/`settle`/`close` + trava de atalhos), usado pelos dois apps.
Começar por um teste que reproduz a perda do áudio (skill `diagnosing-bugs`/`tdd`).

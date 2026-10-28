# Roteiro dos três projetos (Atrio, Ideario, Nodo)

Status: needs-triage

## Destino

Um lugar só para ver tudo o que falta nos três projetos, em ordem de prioridade escolhida pelo usuário. Mora no Atrio
porque ele é o hub: a pendência de um app que for peça comum vira tarefa do Atrio (skill `atrio-hub`).

## Notas

- Cada tarefa é um arquivo em `issues/NN-<assunto>.md` com `Status:` (os cinco estados de
  `docs/agents/triage-labels.md`) e `Repos:` (atrio, ideario, nodo).
- Pendência só de um app, sem nada do Atrio, pode ir para o `.scratch/` daquele app; aqui fica o link.
- Fontes deste levantamento (28/10/2026): `docs/UNIFICACAO.md` (fases 4 a 7 e os defeitos), a seção "Próximo" do
  `CLAUDE.md` do Nodo e as pendências do `CLAUDE.md` do Ideario. Conferido no código o que estava marcado como aberto.
- Antes de começar uma tarefa grande: `/grill-me` ou `/to-spec` (vira `spec.md` na pasta da tarefa) e `/to-tickets`.

## Tarefas

| Nº | Tarefa | Repos | Status |
|---|---|---|---|
| 01 | Atualizar o `UNIFICACAO.md` (fase 3 feita, o que sobrou) | atrio | ready-for-agent |
| 02 | Card aberto: `CardSession` (salvar, `settle`, trava de atalhos) | atrio, nodo, ideario | needs-triage |
| 03 | Área de transferência v2 (lembrete, status, anexos) | atrio, ambos | needs-triage |
| 04 | Unificação fase 4: casca da interface | atrio, ambos | needs-triage |
| 05 | Unificação fase 5: MCP comum | atrio, ambos | needs-triage |
| 06 | Unificação fase 6: build, release e site comuns (Ideario em pnpm) | atrio, ambos | needs-triage |
| 07 | Unificação fase 7: limpeza (`ideario.css`, regras e skills comuns) | atrio, ambos | needs-triage |
| 08 | Simulação do navegador sem regra própria do card | ideario, nodo | needs-triage |
| 09 | Nodo: Apresentação, 2ª versão | nodo | needs-triage |
| 10 | Nodo: estruturas e formatos do XMind que faltam | nodo | needs-triage |
| 11 | Ideario: sync com conta Google real, cache LRU, só no Wi-Fi | ideario | needs-info |
| 12 | Ideario: Android (backup, importar Keep, widget) | ideario | needs-triage |
| 13 | Limpar o "Próximo" do `CLAUDE.md` do Nodo (itens já feitos) | nodo | ready-for-agent |

## Decisões até aqui

## Ainda sem forma

- Traduzir as mensagens do núcleo Rust e do MCP (`UNIFICACAO.md`, "Idiomas e SEO").
- SEO dos sites (dados estruturados, `sitemap.xml`).

## Fora do escopo

- Atalho global no Ideario (decisão do usuário).

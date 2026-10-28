# Área de transferência v2

Status: ready-for-agent
Repos: atrio, ideario, nodo

## Pergunta

Defeito 11: copiar um card entre os apps perde lembrete, status e anexos (`CARD_FORMAT` ainda é 1). Subir para 2
lendo a 1 (regra do `CLAUDE.md`). Anexos: levar o arquivo junto ou só o hash? Decidir com o usuário.

## Decisão (28/10/2026)

O usuário escolheu **levar os arquivos junto**, até um limite (25 MB no total por cópia); acima disso vai o texto e um
aviso com o que ficou de fora.

## Spec

- `CARD_FORMAT` 2. O `ClipCard` ganha lembrete e status (`reminderAt`, `reminderRepeat`, `reminderDone`,
  `reminderDoing`, `statusOn`) e `files` (`hash`, `name`, `mime`, `data` em base64). A v1 continua sendo lida (sem os
  campos novos); um app velho lê a v2 e ignora o que não conhece.
- `attachCardFiles(cards, fetchFile, limit)`: acha os anexos citados no Markdown (`ideario://att/<hash>`), busca os
  bytes pelo app e põe no card enquanto couber no limite (o mesmo arquivo citado duas vezes vai uma vez); devolve
  também os nomes que ficaram de fora.
- `importCardFiles(card, importFile)`: ao colar, entrega cada arquivo ao app e troca no Markdown o hash antigo pelo
  que o app devolveu (o pipeline de fotos pode mudar o hash); sem arquivo junto, o Markdown fica como veio.
- `writeCards` aceita uma promessa de cards: o copiar acontece no gesto (o `ClipboardItem` recebe promessas), e os
  arquivos são buscados depois.
- Ideario (`note_card`/`create_from_card` e o mock) e Nodo (`cardOf`, `pasteCard(s)`, `add_topic`/`apply_edits`)
  levam e recebem lembrete, status e anexos.

# Atrio — design system e componentes do Ideario e do Nodo

Biblioteca compartilhada pelos dois apps do usuário (pedido dele: "quando você muda um card num, muda também no
outro"). Svelte 5 + TypeScript, distribuída como código-fonte por dependência git com tag.

## Regras
- **Fonte da verdade do visual.** O `src/atrio.css` veio de `ideario/src/app.css`. Mudança de token, cor ou
  componente compartilhado se faz **aqui**, e os dois apps sobem a tag. Não editar cópias nos apps.
- **Compatibilidade entre os apps é requisito**, não detalhe: o mesmo card, as mesmas regras de prévia
  (`src/card/markdown.ts` espelha `ideario/src-tauri/src/projection.rs`) e o mesmo formato de área de transferência
  (`src/clipboard.ts`, `CARD_FORMAT`). Mudou o formato: subir `CARD_FORMAT` e continuar lendo a versão anterior.
- UI em **português do Brasil**; código e identificadores em inglês. Dados de exemplo sempre fictícios (repositório
  público).
- Antes de dizer pronto: `pnpm run check` e `pnpm run test`. Testes para regra nova (e provar que o teste pega o erro).
- Versão: só subir a `version` do `package.json`; o workflow `CI` testa e cria a tag `vX.Y.Z` no GitHub (daqui o
  proxy não deixa empurrar tag). Os apps apontam para a tag.
- Git: commit e push no `main` ao terminar cada tarefa.

## Estado atual
- **0.1.0**: `atrio.css` (cópia do `app.css` do Ideario, ainda inteiro: inclui estilos que só o Ideario usa; separar
  aos poucos), `CardBody.svelte` (miolo do `NoteCard` do Ideario), `previewFromMarkdown`/`previewOf` (limites 24
  blocos, 12 tarefas, 1200 caracteres, 8 linhas de código), `watchClip`, `withHashtags`, `FILE_ICONS`,
  `NOTE_COLORS`, e o card na área de transferência (`cardToClipboard`, `cardFromHtml`, `readCard`, `writeCard`,
  `readClipboardCard`). Testes em `tests/atrio.test.ts`.
- **0.2.0**: `CardBody` aceita `children` (entre a prévia e as pílulas).
- **Próximo:** o Ideario e o Nodo passarem a usar o Atrio (CSS, `CardBody`, copiar e colar card).

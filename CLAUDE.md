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
- **0.3.0** (passos 1 e parte do 2–3 do rumo): contrato `CardFeatures`/`features()`/`CardHost`/`CardMeta`
  (`src/card/features.ts`); `@wylho/atrio/editor` com as extensões TipTap do Ideario (`noteExtensions`, blocos, link,
  mídia, `Recorder`; `field` do Y.Doc é opção); `@wylho/atrio/emoji` (`EmojiPicker`, lista carregada sob demanda); peças
  de interface (`MenuAt`, `MenuList`, `ContextMenu`, `Picker`, `StatusToggle`, `ReminderPopover`, `TagInput` com
  `known`, `MediaBlock` com `src`/`ondownload`, `AudioPlayer`, `CameraDialog`); utilidades (`util/format`,
  `util/reminders`, `SEP`/`MenuEntry`, `setNotifier`/`say` para o toast do app). TipTap, Yjs e emojibase são
  dependências opcionais (só quem importa o editor ou o emoji precisa). Correção: repetir "todo mês" de 31/jan vai a
  28/fev, como o núcleo do Ideario (antes a interface calculava 3/mar).
- Em uso: o Ideario (v0.2.0) e o Nodo (v0.1.0) já usam o `atrio.css`, o `CardBody` e o card na área de
  transferência (copiar no Ideario e colar no Nodo funciona, e o contrário).

## Rumo (pedido do usuário)
O Atrio não é só estilo: é **código compartilhado que funciona em vários programas**. O card de nota inteiro mora aqui
— o editor de texto com Markdown (o TipTap do Ideario), etiquetas, categorias, data e lembrete, status, anexos,
gravações — e cada app liga ou desliga o que faz sentido para ele (**chaves por app**; no Nodo, por enquanto, a
categoria fica desligada e o resto ligado). Ordem prevista:
1. Contrato do card: um tipo `CardFeatures` (as chaves) e um adaptador `CardHost` que o app implementa (salvar o
   corpo, ler e gravar anexos, listar etiquetas e categorias), para o componente não saber de SQLite, Y.Doc ou arquivo.
2. (Peças feitas na 0.3.0; falta o componente.) Levar o editor do Ideario (`src/components/Editor.svelte` e `src/lib/editor/`) para cá, atrás do `CardHost`.
3. Pílulas e seletores (etiquetas, data/lembrete, status, cor, emoji) como componentes daqui.
4. Anexos e gravações (mídia), por último: dependem do núcleo de cada app.
5. Separar do `atrio.css` o que é só do Ideario.

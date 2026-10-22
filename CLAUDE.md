# Atrio — design system e componentes do Ideario e do Nodo

Biblioteca compartilhada pelos dois apps do usuário (pedido dele: "quando você muda um card num, muda também no
outro"). Svelte 5 + TypeScript, distribuída como código-fonte por dependência git com tag, mais uma crate Rust (`crates/atrio`)
para o que os dois núcleos compartilham (dependência git do Cargo, na mesma tag).

## Regras
- **Fonte da verdade do visual.** O `src/atrio.css` veio de `ideario/src/app.css`. Mudança de token, cor ou
  componente compartilhado se faz **aqui**, e os dois apps sobem a tag. Não editar cópias nos apps.
- **Compatibilidade entre os apps é requisito**, não detalhe: o mesmo card, as mesmas regras de prévia
  (`src/card/markdown.ts` espelha `ideario/src-tauri/src/projection.rs`) e o mesmo formato de área de transferência
  (`src/clipboard.ts`, `CARD_FORMAT`). Mudou o formato: subir `CARD_FORMAT` e continuar lendo a versão anterior.
- UI em **português do Brasil**; código e identificadores em inglês. Dados de exemplo sempre fictícios (repositório
  público).
- Antes de dizer pronto: `pnpm run check`, `pnpm run test` e, na crate, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. Testes para regra nova (e provar que o teste pega o erro).
- Versão: subir a `version` do `package.json` e a do `crates/atrio/Cargo.toml` juntas; o workflow `CI` testa e cria a tag `vX.Y.Z` no GitHub (daqui o
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
- **0.4.0**: **temas do Atrio** (`src/theme/palettes.ts`, pedido do usuário: o tema é da biblioteca, não de um app).
  Sistema, Atrio (a paleta-base, que antes se chamava Ideario num app e Nodo no outro), Papel, Grafite, Floresta,
  cada um claro e escuro; `DESKTOPS` (GNOME, KDE, Windows, macOS), `GNOME_ACCENTS`, `fitAccent`, `cssVars`,
  `NOTE_COLOR_TOKENS`/`resolveNoteColor` e `normalizePaletteId` (lê `ideario`, `nodo` e `mapist` gravados como `atrio`).
  O estado do tema (claro/escuro, ler o sistema) continua em cada app, porque cada núcleo lê o sistema do seu jeito.
- **0.5.0**: **o card inteiro** (`src/card/NoteEditor.svelte`, em `@wylho/atrio/editor`): capa com emoji, título,
  texto em blocos (alça, arrastar, menu de cada bloco, tarefas em níveis, tabela, link, Markdown colado), fotos e
  anexos, gravador e câmera, categoria, lembrete, status, etiquetas, cor e a barra de formatação. Cada parte segue as
  chaves (`CardFeatures`) e pede ao app pelo `CardHost` (anexos, etiquetas, categorias, prévia de link, perguntar um
  texto, depois de importar…). Texto num Y.Doc (`ydoc` + `field`) ou num documento comum (`content` + `onbody`).
  O app usa por `bind:this`: `addFiles`, `settle`, `startRecording`, `openCamera`, `reminder`, `status`,
  `chooseEmoji`, `hasMedia`, `isEmpty`, `getEditor`; `top` é a barra do app; `onready` sai logo depois da montagem.
  Regras do card em `src/card/meta.ts` (`CardMeta`, `emptyMeta`, `setReminder`, `setStatus`, `STATUS`, `statusOf`,
  `hasStatus`). O Ideario usa o card na nota aberta, com tudo ligado (130 e2e).
- **0.6.0**: **crate Rust `atrio`** (`crates/atrio`, pedido do usuário: tudo o que der para ser comum entre os apps):
  `markdown` (corpo da nota ↔ Markdown, o `markdown.rs` do Ideario, com proptest de ida e volta) e `canon` (forma
  canônica do documento). Versão da crate = versão do `package.json`. O CI testa Svelte e Rust.
- **0.7.0**: `atrio::text` (`normalize_tag`, `clean_tags`, `clean_emoji`, `REPEATS`), as regras do Ideario.
- **0.8.0**: `CardPills` (as pílulas do fim do card: lembrete ou status, categoria, anexos, etiquetas; cliques
  opcionais) e `CardDialog` (a janela do card aberto: tela cheia no celular, diálogo na janela larga, `doc` = modo
  documento). Os dois apps abrem o card do mesmo jeito.
- **0.9.0**: `CardPills` com `onstatus`: o card que tem status (ou lembrete) mostra o seletor de três cores e muda
  ali mesmo (pedido do usuário: mudar o status na lista, sem abrir a nota).
- **0.10.0**: a prévia em Markdown trata anexos como o Ideario: a primeira linha de fotos vira a capa
  (`coverFromMarkdown`, os hashes) e sai do texto; `[📎 nome](ideario://att/…)` vira o bloco de arquivo com o ícone
  do tipo (pela extensão do nome).
- Em uso: o Ideario (card inteiro, `NoteEditor`) e o Nodo (o nó é o card: `CardBody` + `CardPills` no mapa,
  `CardDialog` + `NoteEditor` ao abrir, com `features({ category: false, attachments: false, capture: false, links: false })`).
  Copiar no Ideario e colar no Nodo funciona, e o contrário.

## Rumo (pedido do usuário)
O Atrio é o **hub**: tudo o que puder ser compartilhado sai daqui, e mudar aqui muda em todos os apps ligados a ele
(componentes, temas, formatos). Antes de criar algo num app, ver se não é do Atrio.

O Atrio não é só estilo: é **código compartilhado que funciona em vários programas**. O card de nota inteiro mora aqui
— o editor de texto com Markdown (o TipTap do Ideario), etiquetas, categorias, data e lembrete, status, anexos,
gravações — e cada app liga ou desliga o que faz sentido para ele (**chaves por app**; no Nodo, por enquanto, a
categoria fica desligada e o resto ligado). Ordem prevista:
1. Contrato do card: um tipo `CardFeatures` (as chaves) e um adaptador `CardHost` que o app implementa (salvar o
   corpo, ler e gravar anexos, listar etiquetas e categorias), para o componente não saber de SQLite, Y.Doc ou arquivo.
2. (Feito na 0.5.0: `NoteEditor`.) Levar o editor do Ideario (`src/components/Editor.svelte` e `src/lib/editor/`) para cá, atrás do `CardHost`.
3. (Feito na 0.5.0, dentro do card.) Pílulas e seletores (etiquetas, data/lembrete, status, cor, emoji) como componentes daqui.
4. Anexos e gravações (mídia), por último: dependem do núcleo de cada app.
5. Separar do `atrio.css` o que é só do Ideario.

## Próximos passos do card
- O Nodo usar o `NoteEditor` com `features({ category: false })`: precisa dos campos do nó no núcleo do Nodo
  (etiquetas, lembrete, status, emoji, anexos) e da conversão entre o documento do TipTap e o Markdown da nota.
- A miniatura do card (`NoteCard` do Ideario: capa, alfinete, seleção) também pode vir para cá.

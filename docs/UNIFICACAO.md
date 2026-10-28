# Unificação: o que sai dos apps e vem para o Atrio

Análise de 22/10/2026 sobre o Ideario, o Nodo e o Atrio. Foram quatro varreduras (o card, os núcleos em Rust e o MCP,
a casca da interface, e build/CI/site), mais o grafo de código do Graphify cruzando os três repositórios.

**Regra do usuário:** o que os dois apps têm em comum mora **só** aqui. O card é **um só**: não parecido, exatamente
o mesmo. O fluxo de cada mudança está na skill `atrio-hub`.

## Onde estamos

Atualizado em 28/10/2026. Os dois apps estão no Atrio **0.22.0** (o mesmo `v0.22.0` no `package.json` e no Cargo).
As fases 1 a 3 estão feitas: o núcleo dos dois usa a crate (`markdown`, `canon`, `text`, `attach`, `media`, `card`,
`projection`), e o card é um só (`NoteCard`, `CardBody`, `CardPills`, `CardDialog`, `CardTopBar`, `NoteEditor`,
`AttachmentViewer`), também em inglês e português (`i18n`). Faltam a casca da interface, o MCP, o build e a limpeza
(fases 4 a 7), mais dois pedaços que eram da fase 3 (`CardSession` e `CARD_FORMAT` 2).

As pendências, com estado, ficam em `.scratch/roteiro/` (uma tarefa por arquivo).

## Defeitos que a duplicação já causou (corrigir junto com a unificação)

Estado em 28/10/2026, conferido no código: **corrigidos** 1 a 5 (fase 2) e, das lacunas do 12, o `.nodo` no Finder,
a licença do Ideario e a página de privacidade. **Abertos** 6, 7, 10, 11 (8 e 9 corrigidos na 0.23.0) e, do 12, o atualizador do Nodo e a
checagem de versão do Ideario.

1. ✅ **Status com lembrete que repete.** No Ideario e no card do Atrio, "feito" leva o lembrete à próxima data. No
   núcleo do Nodo só marca feito, e o MCP do Nodo faz diferente da tela do Nodo (`nodo-core/src/model.rs`).
2. ✅ **Prévia do card.** São três implementações: `projection.rs` no Ideario, `markdown.ts` no Atrio e o `notedoc.ts`
   da prévia do Nodo. Elas discordam em:
   - card de link: título + site, ou só texto;
   - tipo do arquivo;
   - capa: até 4 fotos de qualquer lugar, ou só a primeira linha;
   - recuo de lista numerada dentro de lista, e o número inicial;
   - citação;
   - contagem com emoji;
   - `&nbsp;` e `\|` aparecendo como texto;
   - `<br>` em título;
   - foto dentro de item de lista.
3. ✅ **Anexos.** O mesmo arquivo recebe hash diferente em cada app: 64 hex no Ideario, 32 no Nodo. As tabelas de tipo e
   de MIME também divergem: `.mkv`, `.flac` e `.aac` viram "outro" no Nodo.
4. ✅ **#etiquetas no texto** viram pílula no Ideario e não no Nodo.
5. ✅ **Busca sem acento:** "acao" acha "Ação" no Ideario, não no Nodo.
6. **Tema "Sistema"** no Nodo não lê a cor de destaque nem o esquema do KDE: o `systemAccent` existe, mas ninguém o preenche.
   Também não tem a fonte do sistema.
7. **Avisos do card** (erro de microfone ou câmera) não aparecem no Nodo: falta ligar o `setNotifier`.
8. **Atalhos do mapa** (⌘S/⌘W/Ctrl+Tab…) continuam valendo atrás do card aberto no Nodo (`onKeydown` do
   `App.svelte` não olha `notes.opened`). O Ideario desliga.
9. **Fechar o card** durante uma gravação perde o áudio no Nodo: o `NodeNote.svelte` não chama o `settle()`.
10. **Dicas de atalho** no Ideario dizem `Ctrl+` também no macOS.
11. **Copiar e colar card** entre os apps perde lembrete, status e anexos: o `ClipCard` só leva título, texto, cor,
    emoji e etiquetas (`CARD_FORMAT` ainda é 1).
12. **Lacunas de cada app** (não são duplicação, mas apareceram na varredura):
    - ✅ Nodo: o `.nodo` não abria com duplo clique no macOS (`RunEvent::Opened`, Nodo 0.6.1);
    - Nodo: o atualizador pode reiniciar com mapa não salvo (`update_install` chama `app.restart()` sem perguntar);
    - ✅ Ideario: sem arquivo de licença (GPL-3.0-or-later desde 22/10);
    - Ideario: sem checagem de versão no CI;
    - ✅ Nodo: a página de privacidade falava em `.minder`.

## O que vem para o Atrio, por camada

### 1. O card (prioridade máxima: tem de ser o mesmo)

| Peça | Hoje | No Atrio |
|---|---|---|
| Prévia | `projection.rs` (Ideario) × `markdown.ts` (Nodo) | **`atrio::projection`** (Rust) sobre o documento do editor. O Nodo faz Markdown → documento → projeção no núcleo e manda no snapshot. Sai o `blocksFromMarkdown`/`coverFromMarkdown`. |
| Miniatura | moldura do `NoteCard` do Ideario × `div.map-card` + `MapCard` do Nodo | **`NoteCard.svelte`**: moldura, capa com proporção real e `+N`, card só-arquivo, marcar, fixar, seleção |
| Capa e arquivo | miniatura, `FilePreview` e `previews` só no Ideario | `CardCover` e `FilePreview` no Atrio; `CardHost.thumbUrl(hash)` |
| Pílulas | `fileCount`, categoria e #etiquetas só no Ideario | `cardPills(resumo)`: etiquetas = manuais ∪ #etiquetas do texto |
| Cor | `c-{cor}` × tinta do ramo misturada em linha | a cor do card e a do tópico são a mesma `NoteColor` da paleta do tema do Atrio (`.c-*`) |
| Card aberto | Ideario copia o `Dialog`; Nodo usa `CardDialog` | os dois usam o `CardDialog` |
| Barra do card aberto | duas barras e dois menus ⋮ | **`CardTopBar`** + `cardMenu()`: status, emoji, documento, lembrete embutidos; cada app acrescenta as suas ações |
| Salvar e fechar | 400 ms + retentativa + `settle` × dois relógios, sem `settle` | **`CardSession`** (`flush`/`settle`/`close`) e a trava de atalhos com o card aberto |
| Modo documento | por nota, guardado (Ideario) × um só, perdido (Nodo) | `docMode` do Atrio, guardado por card |
| Visualizar anexo | `Lightbox` e `PdfViewer` (Ideario) × abre no programa do sistema (Nodo) | `Lightbox`, `PdfViewer` e `FilePreview` em `atrio/ui` |
| Menu do clique direito | `noteMenu` × `nodeMenu` | `cardMenu()` com abrir, lembrete, status, cor (`NOTE_COLORS`), emoji, copiar como card, copiar texto |
| Exportar (Nodo) | um terceiro desenho do card no canvas (`cardtext.ts`) | exportar a partir do próprio `NoteCard` (DOM → imagem), sem desenho paralelo |
| Notas soltas (Nodo) | um quarto card (`.ncard`, textarea) | o mesmo card (**decisão do usuário**) |
| Área de transferência | `ClipCard` v1 | `CARD_FORMAT` 2: lembrete, status, anexos (lendo a v1) |

### 2. Núcleos em Rust (`crates/atrio`, com features para não pesar)

| Módulo | Sai de | Observação |
|---|---|---|
| `markdown`, `canon`, `testdoc` | cópias idênticas no Ideario | o Ideario passa a depender da crate (mesma tag do Nodo) |
| `text`: `fold`, `hash_tags`, `clean` | Ideario `text.rs`, `store.rs`, `mcp/tools.rs` (cópias de `clean_tags`/`clean_emoji`/`REPEATS`) | o Nodo passa a buscar sem acento |
| `card`: `CardMeta`, `set_status`, `clear_status`, `cleaned`, `validate`; `next_occurrence` (feature `chrono`) | Ideario `reminders.rs` × Nodo `model.rs` | corrige o defeito 1; o MCP dos dois recusa entrada inválida igual |
| `projection` | Ideario `projection.rs` | ver o card |
| `attach`: `mime_of`, `kind_of`, `safe_file_name`, `referenced`, `hash_hex` (feature `hash`) | 3–4 cópias divergentes | **hash único = SHA-256 inteiro (64 hex)**; o Nodo continua lendo os de 32 |
| `att`: `parse_range`, `percent_decode`, `respond` (feature `tauri`) | cópias idênticas | o Nodo ganha leitura por pedaço do arquivo, em vez de tudo na memória |
| `fs`: `write_atomic`, `write_once`, `unique_path` | Nodo `write_atomic` × quatro versões no Ideario | com `fsync` |
| `html`: documento → HTML | Ideario `export.rs` | o HTML do Nodo deixa de mostrar `**negrito**` cru |
| `mcp`: laço JSON-RPC, `ToolDef` com anotações, `Args`, `ToolOut` (texto, JSON, imagem) | Ideario `mcp/mod.rs` × Nodo `nodo-mcp/src/lib.rs` | o comportamento do Ideario (lotes, `resources/list`) vale para os dois |
| `mcp::setup` | Ideario `mcp/setup.rs` × Nodo `setup.rs` | registro no Claude Desktop, com nomes antigos |
| `tauri::updates` (feature `updater`) | cópias quase iguais | gancho `before_restart` para não perder mapa |
| `tauri::window`: `mac_lights_width`, `linux_media`, `titlebar_script` | cópias idênticas | |
| `desktop`: tema, fontes e GTK do sistema (feature `desktop`) | só no Ideario | corrige o defeito 6 |
| `link::valid_url` (feature `url`) | Ideario `link.rs` × regex no Nodo | |

### 3. Casca da interface (`@wylho/atrio`)

- **Tema:** `createTheme({ prefix, legacy, systemGlobal })` e `systemColors` com KDE no Atrio. Saem os dois
  `theme.svelte.ts` e o `palettes.ts` de cada app.
- **Configurações:** o `SettingsSheet` vira uma moldura, com seções prontas:
  - `AppearanceSection`;
  - `ClaudeSection`;
  - `ShortcutsSection`;
  - `AboutFooter` (versão + atualização).

  Cada app só acrescenta as seções dele.
- **Atualização:** `createUpdates()` e `<UpdateNotice appName>`.
- **Diálogos e toast:** `createUi()` com `say` (com ação), `confirm`/`ask`/`choose` (três saídas), mais `<Toast>` e
  `<ConfirmDialog>`. O `setNotifier` fica ligado sozinho.
- **Partida (`main.ts`):** `bootShell()`. Faz o bloqueio do menu do navegador, os botões do macOS e a tela cheia
  (uma variável só, `--lights-w`) e a fonte do sistema.
- **Teclado:** `util/keys.ts` com `MOD`, `kbd('mod+shift+e')`, `isTyping`, `isMod`. Saem sete cópias do `mod` no
  Nodo e o `Ctrl+` fixo do Ideario.
- **Barra de cima:** `<TopBar>` (área de arrastar, esquerda e ações) e `<SearchField>`.
- **Acesso ao app:** `host.ts` com `hasHost`, `isPreview`, `withProgress`, `attUrl` e os comandos comuns (MCP,
  atualização, versão). Os dados de simulação continuam em cada app, mas **sem reimplementar regra do Atrio**.
- **Preferências:** `createStore(prefix, { legacy })`.
- **Peças genéricas do Ideario:**
  - `Drawer`, `Empty`;
  - `FileDrop`;
  - `androidBack`.
- **CSS:**
  - vêm do `map.css` do Nodo: `.keys`/`kbd`, `.preview-tag`, `.field`, `.sheet-sub`, `.key-hint`, `.md`;
  - sai do `atrio.css` para um `ideario.css` o que é só do Ideario: masonry, FAB, lembretes, arquivos, moodboard,
    PDF, filtros e outros.
- **Apagar:**
  - no Ideario: `clip.ts`, `file-kinds.ts` e `status.ts` (cópias mortas), e os reexports `format`, `emoji`,
    `reminders`, `menu`, `palettes` (importar direto do Atrio);
  - tipos repetidos: `NoteColor`, `AttachmentKind`, `PreviewBlock`, `McpInfo`, `UpdateInfo`.
- **Configuração:** `vite.config.ts`, `svelte.config.js` e `tsconfig.json` iguais nos dois, a partir do Atrio.

### 4. Build, release e site

- **Workflows reutilizáveis** (`workflow_call`) hospedados em `wylho/atrio`:
  - `tauri-release` (matriz macOS, Windows, Linux; Android opcional);
  - `tauri-bundle`;
  - `linux-repos` (apt/dnf, com o script `linux-repos.sh` parametrizado);
  - `check-secrets` (com a checagem de GPG do Ideario);
  - `delete-release`;
  - `cf-pages-deploy`.
- Ação composta `setup-tauri`: pnpm, node, rust, cache e dependências do WebKitGTK. Hoje aparece umas oito vezes.
- **Versão:** um script só de checar e subir a versão. O Ideario ganha a checagem que não tem.
- **Site:**
  - o `style.css` mora no Atrio e é copiado no deploy (hoje é cópia à mão);
  - o `site-shots` vira ajudante comum;
  - `index` e `privacidade` continuam de cada app.
- **Base comum:**
  - `tauri.release.conf.json` (idêntico);
  - permissões básicas de `capabilities`;
  - perfil de release (decidir `panic = "abort"`);
  - `rustfmt.toml`/`.editorconfig`.
- **Ideario passa a usar pnpm**, como o Nodo e o Atrio: os workflows comuns ficam mais simples.
- **Lixo para remover:** `crates/mapist-app/ui/.vite/deps` versionado no Nodo.

### 5. Regras, skills e memória

Já feito hoje:
- regra do hub nos três `CLAUDE.md`;
- skill `atrio-hub`;
- `scripts/bump.sh`, `scripts/apps-up.sh` e `scripts/sync-skills.sh` (as skills principais moram aqui: `atrio-hub`,
  `rust-testing`, `rust-patterns`).

Falta:
- levar ao Atrio as regras repetidas nos dois `CLAUDE.md` (pt-BR, dados fictícios, git, fases), com uma linha de
  referência em cada app;
- unir o `sync-site` (uma skill com um bloco de fatos por app);
- unir o `RELEASE.md`;
- **conferir duplicação com o Graphify** a cada fase. Instalar com `pip install graphifyy`, rodar `graphify update .
  --no-cluster` em cada repositório (`graphify-out/` fica no `.git/info/exclude`) e cruzar os rótulos dos três
  `graph.json`. É o que mostra rápido se sobrou função com o mesmo nome dos dois lados.

## Andamento

- **Fase 1 — feita (Atrio 0.12.0):** o Ideario usa a crate; saíram as cópias de `markdown`, `canon`, `testdoc` e
  `text`.
- **Fase 2 — feita (Atrio 0.13.0):** `atrio::attach`, `atrio::media`, `atrio::card`, `atrio::projection`.
  - O Ideario usa as quatro; saíram `media.rs` e `projection.rs`.
  - O Nodo passou a fazer como o Ideario:
    - anexos com hash único e pipeline de fotos, com miniatura no `.nodo`;
    - status com repetição, inclusive pelo MCP;
    - a prévia vem do núcleo;
    - `#tags` e contagem de anexos nas pílulas;
    - busca sem acento.
  - Corrige os defeitos 1 a 5.
  - Ficou para a fase 3: `hashTags` do TypeScript não tirava repetidas (corrigido na 0.14.0); os backends simulados do
    navegador (`lib/api/mock` do Ideario e `lib/preview.ts` do Nodo) ainda montam a prévia em TypeScript (tarefa 08
    do roteiro).
- **Fase 3 — feita (Atrio 0.14.0 a 0.17.1):** `NoteCard` (0.14.0), `nearestNoteColor` (0.15.0), `CardTopBar`
  (0.16.0), `AttachmentViewer` em `@wylho/atrio/viewer` (0.17.0/0.17.1), exportar o card pelo DOM no Nodo
  (`lib/domcard.ts`), notas soltas como o card padrão. Ficaram para depois: `CardSession` (defeitos 8 e 9), o
  Ideario no `CardDialog` (o `Editor.svelte` ainda monta o próprio `Dialog` do bits-ui) e o `CARD_FORMAT` 2
  (defeito 11), tarefas 02 e 03 do roteiro.
- **Depois da fase 3:** idiomas (0.18.0/0.18.1), licença GPL (0.18.2), vários cards na área de transferência
  (0.19.0), tabela na prévia (0.20.0/0.21.0), PDF da nota com o card no topo (0.22.0).
- **Próxima:** fase 4 (casca), depois de `CardSession` e `CARD_FORMAT` 2.

## Ordem proposta

Cada fase termina com os dois apps na mesma tag e verificados.

1. **Base do Rust:** o Ideario depende da crate `atrio` e apaga as cópias de `markdown`, `canon`, `testdoc` e
   `text`. A tela não muda.
2. **O card, dados:** `atrio::projection`, `atrio::card` (status e repetição), #etiquetas e `atrio::attach` (hash
   único). Corrige os defeitos 1 a 5.
3. **O card, tela:**
   - `NoteCard` (miniatura), `CardTopBar` + `cardMenu`, `CardSession`;
   - o Ideario no `CardDialog`;
   - `Lightbox`/`PdfViewer`/`FilePreview`;
   - exportar o card pelo DOM;
   - `ClipCard` v2.

   Corrige os defeitos 7 a 9 e 11. A partir daqui o card é um só.
4. **Casca:** tema e sistema (`desktop`), Configurações, atualizador, diálogos e toast, teclado, `bootShell`. Corrige
   os defeitos 6 e 10.
5. **MCP:** laço, definição das ferramentas e registro no Claude Desktop comuns.
6. **Build e site:** workflows reutilizáveis, `setup-tauri`, versão, `style.css`, o Ideario em pnpm.
7. **Limpeza:** `ideario.css` separado, regras e skills comuns, licença do Ideario.

## Idiomas e SEO (pedido do usuário, 22/10)

- **Inglês é a língua principal** do GitHub (README) e do site; o português fica numa subpágina (`/pt/`) e no
  `README.pt-BR.md`, com o mesmo conteúdo. Vale para o Ideario e o Nodo.
- **Os dois apps em inglês e português.** Como os componentes do Atrio (card, editor, menus, diálogos) têm texto, a
  tradução é do Atrio: um `i18n` no Atrio (dicionários `en`/`pt-BR`, o idioma escolhido ou o do sistema), que os
  componentes do Atrio usam e os apps estendem com os textos deles. O núcleo em Rust (MCP, mensagens de erro) segue o
  mesmo: textos com chave, `en` e `pt-BR`.
- **SEO:** palavras-chave estratégicas usadas com naturalidade no texto (não uma lista no fim): título, descrição,
  `og:`/Twitter cards, `hreflang` entre as duas línguas, dados estruturados (`SoftwareApplication`), `sitemap.xml` e
  `robots.txt`; no GitHub, descrição e tópicos do repositório.
- Ordem: entra depois da fase 3 (o card já único), para traduzir uma vez só o que é do Atrio.

## Decisões do usuário

1. ~~Cor do card no Nodo~~ **Decidido (22/10):** os temas são do Atrio, e a paleta também. A cor do card e a cor
   do tópico no mapa saem da mesma paleta (`NOTE_COLORS`/tokens do tema do Atrio), em tudo.
2. ~~Abrir o card~~ **Decidido:** é experiência de cada app, não da biblioteca: um clique no Ideario, duplo clique
   (ou ⌘Enter) no Nodo. O `NoteCard` do Atrio recebe `onopen` e cada app liga ao gesto dele.
3. ~~Notas soltas~~ **Decidido:** "Nova nota aqui" cria o card padrão (o mapa é um canvas; a nota é a nota padrão).
4. ~~Hash dos anexos~~ **Decidido:** o código dos anexos é **do Atrio** (`atrio::attach`), partindo da versão pronta
   do Ideario (SHA-256 inteiro, tabelas de tipo/MIME, nomes, protocolo com Range e miniatura), usada igual em tudo.
5. ~~Ideario em pnpm~~ **Decidido:** sim.

<p align="center"><img src="assets/icon.svg" width="72" alt="Atrio"></p>

# Atrio

Biblioteca de componentes e design system compartilhada pelo [Ideario](https://github.com/wylho/ideario) e pelo
[Nodo](https://github.com/wylho/nodo). É a fonte única dos tokens, dos estilos e dos componentes comuns aos dois
aplicativos, e define os formatos de dados que eles trocam entre si.

| | |
|---|---|
| Pacote | `@wylho/atrio` |
| Distribuição | código-fonte Svelte 5 + TypeScript, por dependência git com tag |
| Dependências do consumidor | `svelte` ^5.57, `@lucide/svelte` ≥ 1.0 |
| Licença | MIT |

## Instalação

```sh
pnpm add github:wylho/atrio#v0.4.0
# ou
npm install github:wylho/atrio#v0.4.0
```

```ts
import '@wylho/atrio/atrio.css'
import { CardBody, previewFromMarkdown, readCard, writeCard } from '@wylho/atrio'
```

Os módulos são entregues sem compilação; o Vite do consumidor (com `@sveltejs/vite-plugin-svelte`) compila os
componentes junto com o aplicativo.

## Conteúdo

### Estilos — `@wylho/atrio/atrio.css`

Tokens de cor (claro e escuro, cores de nota `--n-*`), tipografia (fonte do sistema), sombras e raios, e as classes do
design system: `.topbar`, `.icon-btn`, `.btn`, `.seg`, `.pill`, `.card`, `.preview`/`.pv-*`, `.sheet`, `.menu`,
`.toast`, entre outras. Na versão atual o arquivo ainda reproduz o `app.css` do Ideario por inteiro.

### Temas

Os mesmos em todos os apps: Sistema (imita GNOME, KDE, Windows ou macOS, com o destaque do sistema), **Atrio**
(paleta-base), Papel, Grafite e Floresta, cada um claro e escuro. `PALETTES`, `DESKTOPS`, `cssVars(colors, mode)`
(as variáveis do `atrio.css`), `fitAccent`, `mix`, `contrast`, `NOTE_COLOR_TOKENS`, `resolveNoteColor` e
`normalizePaletteId` (aceita os nomes antigos da paleta-base). O estado do tema fica em cada app.

### Componentes

| Exportação | Descrição |
|---|---|
| `CardBody` | Corpo do card de nota: emoji, título, prévia estruturada e linha de pílulas. Props: `title`, `emoji`, `blocks: PreviewBlock[]`; snippets `meta`, `file` e `children`. O consumidor fornece o contêiner `.card`. |

### Contrato do card

| Exportação | Descrição |
|---|---|
| `CardFeatures`, `features(off)`, `ALL_FEATURES` | Chaves por app: o que o card mostra (etiquetas, categoria, lembrete, status, cor, emoji, anexos, captura, links, texto rico). `features({ category: false })` liga tudo menos a categoria. |
| `CardHost` | Interface que o app implementa: etiquetas e categorias existentes, anexos (endereço, importar, baixar), prévia de link, Markdown → documento, imagem da área de transferência. |
| `CardMeta` | Metadados do card comuns aos apps. |

### Peças de interface

`MenuAt`, `MenuList`, `ContextMenu` (menus a partir de `MenuEntry`), `Picker`, `StatusToggle`, `ReminderPopover`,
`TagInput` (sugestões a partir de `known`), `MediaBlock`, `AudioPlayer`, `CameraDialog`. O toast é do app:
`setNotifier(fn)`.

### Editor — `@wylho/atrio/editor`

`noteExtensions(opts)` (TipTap: listas, tarefas em níveis, tabela, código, fotos lado a lado, anexos, bloco de link,
colar Markdown, Y.Doc opcional), funções de blocos e mídia, `Recorder`. Requer os pacotes `@tiptap/*` e `yjs`.

### Emoji — `@wylho/atrio/emoji`

`EmojiPicker` e as funções da lista (`emojibase-data`, em português, carregada ao abrir).

### Prévia de nota

| Exportação | Descrição |
|---|---|
| `blocksFromMarkdown(md)` | Converte Markdown em `PreviewBlock[]`, sem formatação de linha, seguindo as regras de `projection.rs` do Ideario. |
| `previewOf(blocks)` | Aplica os limites da prévia: 24 blocos, 12 tarefas, 1200 caracteres; tarefas excedentes viram `{ kind: 'more' }`. |
| `previewFromMarkdown(md)` | `previewOf(blocksFromMarkdown(md))`. |
| `withHashtags(text)` | Separa `#hashtags` para destaque. |
| `watchClip(el)` | Marca `[data-clipped]` quando o conteúdo excede a altura máxima. |
| `NOTE_COLORS`, `FILE_ICONS` | Cores de nota e ícones por tipo de anexo. |
| `PreviewBlock`, `NoteColor`, `AttachmentKind` | Tipos. |

### Área de transferência

| Exportação | Descrição |
|---|---|
| `cardToClipboard(card)` | Serializa um `ClipCard` em `{ html, text }`. |
| `cardFromHtml(html)` / `readCard(dataTransfer)` | Lê um card de HTML colado; `null` se não houver. |
| `writeCard(card)` / `readClipboardCard()` | Escreve e lê pela API assíncrona de área de transferência. |

## Formato do card na área de transferência

Versão `CARD_FORMAT = 1`. Um card é gravado em dois tipos MIME simultaneamente:

- **`text/html`**: `<div data-atrio-card="BASE64">…</div>`, em que `BASE64` é o JSON abaixo codificado em UTF-8 e
  base64. O conteúdo do `div` é uma representação legível (título em `<h3>`, uma linha por `<p>`), usada por
  aplicativos que não conhecem o formato.
- **`text/plain`**: Markdown — `# Título`, linha em branco, corpo.

```json
{
  "atrio": 1,
  "title": "string",
  "markdown": "string",
  "color": "none | sand | sage | sky | rose | lilac | butter",
  "emoji": "string | null",
  "tags": ["string"]
}
```

Campos opcionais: `color`, `emoji`, `tags`. Um leitor ignora campos desconhecidos e aceita versões maiores lendo os
campos que conhece. Mudanças incompatíveis exigem nova versão de `CARD_FORMAT` e leitura da anterior.

## Versionamento

Versionamento semântico. A versão é definida em `package.json`; o workflow `CI` executa a verificação a cada push no
`main` e cria a tag `vX.Y.Z` correspondente se ela ainda não existir. Os consumidores referenciam sempre uma tag.

## Desenvolvimento

```sh
pnpm install
pnpm run check   # svelte-check
pnpm run test    # vitest (jsdom)
```

## Licença

MIT. Ver [LICENSE](LICENSE).

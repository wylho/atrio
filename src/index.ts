// Atrio: o design system e os componentes que o Ideario e o Nodo compartilham.
// O CSS entra à parte: `import '@wylho/atrio/atrio.css'`.

export { default as CardBody } from './card/CardBody.svelte'
export { watchClip } from './card/clip'
export { withHashtags } from './card/hashtags'
export { FILE_ICONS } from './card/icons'
export { blocksFromMarkdown, plainInline, previewFromMarkdown, previewOf } from './card/markdown'
export { NOTE_COLORS, type AttachmentKind, type NoteColor, type PreviewBlock } from './card/types'
export {
  CARD_FORMAT,
  cardFromHtml,
  cardToClipboard,
  readCard,
  readClipboardCard,
  writeCard,
  type ClipCard,
} from './clipboard'

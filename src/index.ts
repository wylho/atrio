// Atrio: o design system e os componentes que o Ideario e o Nodo compartilham.
// O CSS entra à parte: `import '@wylho/atrio/atrio.css'`. O editor de texto fica em `@wylho/atrio/editor` e o seletor de
// emoji em `@wylho/atrio/emoji`, para só carregarem quando usados.

export { default as CardBody } from './card/CardBody.svelte'
export { watchClip } from './card/clip'
export { withHashtags } from './card/hashtags'
export { FILE_ICONS, FILE_LABELS } from './card/icons'
export { blocksFromMarkdown, coverFromMarkdown, plainInline, previewFromMarkdown, previewOf } from './card/markdown'
export { nearestNoteColor, NOTE_COLORS, type CardSummary, type CoverPhoto } from './card/types'
export type { AttachmentKind, Attachment, LinkPreview, Millis, NoteColor, PreviewBlock, ReminderStatus, RepeatKind, TagCount, Tone } from './types'
export { ALL_FEATURES, features, type CardFeatures, type CardHost, type DroppedFile } from './card/features'
export { emptyMeta, hasStatus, setReminder, setStatus, STATUS, statusOf, type CardMeta } from './card/meta'
export {
  CARD_FORMAT,
  cardFromHtml,
  cardToClipboard,
  readCard,
  readClipboardCard,
  writeCard,
  type ClipCard,
} from './clipboard'

// Peças de interface do card
export { default as CardDialog } from './card/CardDialog.svelte'
export { default as CardPills } from './card/CardPills.svelte'
export { default as NoteCard } from './card/NoteCard.svelte'
export { default as AudioPlayer } from './ui/AudioPlayer.svelte'
export { default as CameraDialog } from './ui/CameraDialog.svelte'
export { default as ContextMenu } from './ui/ContextMenu.svelte'
export { default as MediaBlock } from './ui/MediaBlock.svelte'
export { default as MenuAt } from './ui/MenuAt.svelte'
export { default as MenuList } from './ui/MenuList.svelte'
export { default as Picker } from './ui/Picker.svelte'
export { default as ReminderPopover } from './ui/ReminderPopover.svelte'
export { default as StatusToggle } from './ui/StatusToggle.svelte'
export { default as TagInput } from './ui/TagInput.svelte'

// Utilidades
export * from './util/format'
export * from './util/reminders'
export { SEP, type MenuEntry } from './util/menu'
export { say, setNotifier } from './util/notify'

// Temas (os mesmos em todos os apps; a paleta-base é a Atrio)
export {
  contrast,
  cssVars,
  DESKTOPS,
  fitAccent,
  GNOME_ACCENTS,
  mix,
  normalizePaletteId,
  NOTE_COLOR_TOKENS,
  PALETTES,
  resolveNoteColor,
  type Colors,
  type DesktopId,
  type Mode,
  type PaletteId,
} from './theme/palettes'

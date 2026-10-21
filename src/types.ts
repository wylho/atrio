// Tipos comuns do card e das peças do editor (os mesmos de ideario/src/lib/types.ts).

/** Epoch em milissegundos. */
export type Millis = number
/** Repetição do lembrete (todo dia, semana, mês, ano). */
export type RepeatKind = 'day' | 'week' | 'month' | 'year'
/** Status: a fazer (vermelho), em andamento (amarelo), concluído (verde). */
export type ReminderStatus = 'todo' | 'doing' | 'done'
export type Tone = 'quente' | 'frio' | 'verde' | 'rosa' | 'neutro'
export type { AttachmentKind, NoteColor, PreviewBlock } from './card/types'
import type { AttachmentKind } from './card/types'

/** Anexo de uma nota, endereçado pelo hash do conteúdo. */
export interface Attachment {
  hash: string
  kind: AttachmentKind
  mime: string
  name: string
  bytes: number
  origBytes: number | null
  width: number | null
  height: number | null
  palette: string[] | null
  tone: Tone | null
  addedAt: Millis
}

/** Prévia de um link colado (bloco de link). */
export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  site: string | null
  /** Miniatura da imagem da página, como data:image/webp. */
  image: string | null
}

/** Uma etiqueta e quantas notas a usam (para sugerir). */
export interface TagCount {
  name: string
  count: number
}

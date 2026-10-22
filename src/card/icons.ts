// Ícone de cada tipo de anexo (os mesmos de ideario/src/lib/file-kinds.ts).
import { File, FileAudio, FileSpreadsheet, FileText, FileVideoCamera, Image } from '@lucide/svelte'
import type { AttachmentKind } from './types'

/** Nome de cada tipo, em português (é a chave): quem mostra usa `t(FILE_LABELS[kind])`. */
export const FILE_LABELS: Record<AttachmentKind, string> = {
  image: 'Imagem', pdf: 'PDF', doc: 'Documento', sheet: 'Planilha', audio: 'Áudio', video: 'Vídeo', other: 'Arquivo',
}

export const FILE_ICONS: Record<AttachmentKind, typeof File> = {
  image: Image, pdf: FileText, doc: File, sheet: FileSpreadsheet, audio: FileAudio, video: FileVideoCamera, other: File,
}

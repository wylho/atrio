// Tipos do card de nota, os mesmos do Ideario (`PreviewBlock` em ideario/src/lib/types.ts e `Block` em
// ideario/src-tauri/src/projection.rs). Mudou lá, muda aqui: este é agora o lugar deles.

import type { Millis, RepeatKind } from '../types'

export type NoteColor = 'none' | 'sand' | 'sage' | 'sky' | 'rose' | 'lilac' | 'butter'

/** Cores de nota, na ordem dos menus, com a variável CSS de cada uma (`atrio.css`). */
export const NOTE_COLORS: { id: NoteColor; label: string; css: string }[] = [
  { id: 'none', label: 'Padrão', css: 'var(--surface)' },
  { id: 'sand', label: 'Areia', css: 'var(--n-sand)' },
  { id: 'sage', label: 'Sálvia', css: 'var(--n-sage)' },
  { id: 'sky', label: 'Céu', css: 'var(--n-sky)' },
  { id: 'rose', label: 'Rosa', css: 'var(--n-rose)' },
  { id: 'lilac', label: 'Lilás', css: 'var(--n-lilac)' },
  { id: 'butter', label: 'Manteiga', css: 'var(--n-butter)' },
]

export type AttachmentKind = 'image' | 'pdf' | 'doc' | 'sheet' | 'audio' | 'video' | 'other'

/**
 * Bloco da prévia do card, na ordem do documento. Preserva a estrutura (título, parágrafo,
 * tópico, lista numerada, tarefa) em vez de achatar tudo num texto corrido.
 */
export type PreviewBlock =
  | { kind: 'heading' | 'text'; text: string }
  | { kind: 'bullet'; text: string; depth: number }
  | { kind: 'ordered'; text: string; n: number; depth: number }
  | { kind: 'task'; text: string; done: boolean; depth: number }
  /** Anexo no meio do texto (vídeo, áudio, PDF…): mostrado como uma linha com ícone. */
  | { kind: 'file'; text: string; fileKind: AttachmentKind; hash: string }
  /** Bloco de código: as primeiras linhas, sem formatação. */
  | { kind: 'code'; text: string }
  /** Cartão de link: título (ou endereço) e o site. */
  | { kind: 'link'; text: string; url: string; site: string }
  /** Tarefas que não couberam na prévia, ou texto cortado. */
  | { kind: 'more'; count: number }

/** Uma foto da capa, com o tamanho (a capa guarda a proporção antes de a foto carregar). */
export interface CoverPhoto {
  hash: string
  width: number | null
  height: number | null
}

/** O que o card mostra (o resumo que cada núcleo projeta pela regra do Atrio). */
export interface CardSummary {
  title: string
  emoji: string | null
  color: NoteColor
  preview: PreviewBlock[]
  cover: CoverPhoto[]
  /** Fotos na nota (a capa mostra até 4; o resto vira "+N"). */
  imageCount: number
  /** Anexos que não são foto. */
  fileCount: number
  tags: string[]
  reminderAt: Millis | null
  reminderRepeat: RepeatKind | null
  reminderDone: boolean
  reminderDoing: boolean
  statusOn: boolean
  pinned?: boolean
}

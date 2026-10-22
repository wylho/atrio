// Tipos do card de nota, os mesmos do Ideario (`PreviewBlock` em ideario/src/lib/types.ts e `Block` em
// ideario/src-tauri/src/projection.rs). Mudou lá, muda aqui: este é agora o lugar deles.

import type { Millis, RepeatKind } from '../types'

export type NoteColor = 'none' | 'sand' | 'sage' | 'sky' | 'rose' | 'lilac' | 'butter'

/** Cores de nota, na ordem dos menus, com a variável CSS de cada uma (`atrio.css`). O nome fica em português (é a
 *  chave): quem mostra usa `t(c.label)`. */
export const NOTE_COLORS: { id: NoteColor; label: string; css: string }[] = [
  { id: 'none', label: 'Padrão', css: 'var(--surface)' },
  { id: 'sand', label: 'Areia', css: 'var(--n-sand)' },
  { id: 'sage', label: 'Sálvia', css: 'var(--n-sage)' },
  { id: 'sky', label: 'Céu', css: 'var(--n-sky)' },
  { id: 'rose', label: 'Rosa', css: 'var(--n-rose)' },
  { id: 'lilac', label: 'Lilás', css: 'var(--n-lilac)' },
  { id: 'butter', label: 'Manteiga', css: 'var(--n-butter)' },
]

/**
 * A cor de nota mais próxima de uma cor qualquer (`#rrggbb`), pelo tom: vermelho e rosa → rosa, laranja e marrom →
 * areia, amarelo → manteiga, verde e verde-azulado → sálvia, azul → céu, roxo → lilás; cinza (pouca saturação) ou
 * inválida → padrão. A mesma ideia do Ideario ao importar as cores do Keep, para um tópico do Nodo pintado de qualquer
 * cor ganhar o card padrão na cor mais próxima.
 */
export function nearestNoteColor(hex: string | null | undefined): NoteColor {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '')
  if (!m) return 'none'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (s < 0.15) return 'none'
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 18 || h >= 330) return 'rose'
  if (h < 42) return 'sand'
  if (h < 70) return 'butter'
  if (h < 185) return 'sage'
  if (h < 255) return 'sky'
  if (h < 300) return 'lilac'
  return 'rose'
}

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
  /**
   * Tabela: as primeiras linhas (até 8), célula por célula; `header` quando a primeira linha é de títulos; `more` =
   * linhas que ficaram de fora. `text` é a tabela em texto ("a · b" por linha), para a busca e o tamanho da prévia.
   */
  | { kind: 'table'; rows: string[][]; header: boolean; more: number; text: string }
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

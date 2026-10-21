// O contrato do card inteiro: o que cada app liga (as chaves) e o que cada app fornece (o anfitrião).
// O card do Atrio não sabe de SQLite, Y.Doc nem arquivo: pede ao `CardHost` do app. Assim o mesmo card serve ao
// Ideario (notas no banco, com sync) e ao Nodo (nota de um nó, dentro do arquivo do mapa).

import type { Attachment, LinkPreview, Millis, NoteColor, ReminderStatus, RepeatKind, TagCount } from '../types'

/** O que o card mostra e deixa mudar neste app. Desligado = nem aparece (nada de controle que não faz sentido). */
export interface CardFeatures {
  /** Editor rico (títulos, listas, tarefas, tabela, código). Desligado: só texto. */
  richText: boolean
  /** Etiquetas (`#palavra` e as escolhidas). */
  tags: boolean
  /** Categoria (só o Ideario tem categorias, por enquanto). */
  category: boolean
  /** Data e lembrete. */
  reminder: boolean
  /** Status (a fazer, em andamento, concluído). */
  status: boolean
  /** Cor da nota. */
  color: boolean
  /** Emoji de capa. */
  emoji: boolean
  /** Fotos e anexos no texto. */
  attachments: boolean
  /** Gravar áudio e tirar foto pela câmera. */
  capture: boolean
  /** Bloco de link com prévia. */
  links: boolean
}

/** Tudo ligado: o card do Ideario. */
export const ALL_FEATURES: CardFeatures = {
  richText: true,
  tags: true,
  category: true,
  reminder: true,
  status: true,
  color: true,
  emoji: true,
  attachments: true,
  capture: true,
  links: true,
}

/** Liga tudo menos o que o app desligar: `features({ category: false })`. */
export function features(off: Partial<CardFeatures> = {}): CardFeatures {
  return { ...ALL_FEATURES, ...off }
}

/** Os metadados de um card, os mesmos nos dois apps. */
export interface CardMeta {
  title: string
  color: NoteColor
  emoji: string | null
  tags: string[]
  categoryId: string | null
  reminderAt: Millis | null
  reminderRepeat: RepeatKind | null
  status: ReminderStatus | null
}

/** O que o app fornece ao card. Os métodos de uma função desligada podem faltar. */
export interface CardHost {
  /** Etiquetas que já existem, para sugerir. */
  tags?: () => TagCount[]
  /** Categorias para escolher (só com `category`). */
  categories?: () => { id: string; name: string; color: string }[]
  /** Endereço para mostrar ou tocar um anexo; vazio se o conteúdo não está aqui. */
  mediaUrl?: (hash: string) => string
  /** Guarda um arquivo (foto, gravação, documento) e devolve o anexo pronto para entrar no texto. */
  importFile?: (file: Blob, name: string) => Promise<Attachment>
  /** Dados dos anexos já no texto. */
  attachments?: (hashes: string[]) => Promise<Attachment[]>
  /** Baixar um anexo. */
  download?: (a: Attachment) => void
  /** Prévia de um link colado. */
  linkPreview?: (url: string) => Promise<LinkPreview>
  /** Abrir um endereço no navegador do sistema. */
  openUrl?: (url: string) => void
  /** Markdown colado → corpo do editor; null onde não há conversor. */
  markdownToDoc?: (md: string) => Promise<{ content?: unknown[] } | null>
  /** Imagem da área de transferência do sistema (print colado); null se não houver. */
  clipboardImage?: () => Promise<File | null>
}

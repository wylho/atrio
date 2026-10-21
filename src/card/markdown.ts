// Prévia do card a partir de Markdown, para quem guarda a nota como texto (o Nodo). O Ideario projeta do documento
// do editor no Rust (`projection.rs`); as regras aqui são as mesmas, para o card sair igual nos dois:
// texto sem formatação (negrito, itálico e links viram texto), linhas seguidas formam um parágrafo, listas e tarefas
// com profundidade, código com até 8 linhas, e os limites de `preview_of`.

import type { PreviewBlock } from './types'

const MAX_BLOCKS = 24
const MAX_TASKS = 12
const MAX_CHARS = 1200
const MAX_CODE_LINES = 8

/** Tira a marcação de linha: a prévia do Ideario também mostra só o texto. */
export function plainInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?:|mailto:)[^>]+)>/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^*\w])[*_]([^*_\s][^*_]*?)[*_](?=$|[^*\w])/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Todos os blocos da nota, na ordem. */
export function blocksFromMarkdown(md: string): PreviewBlock[] {
  const out: PreviewBlock[] = []
  let para: string[] = []
  let code: string[] | null = null
  const flush = () => {
    const text = para.map(plainInline).filter(Boolean).join('\n')
    if (text) out.push({ kind: 'text', text })
    para = []
  }
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      if (code) {
        const text = code.join('\n').trimEnd().split('\n').slice(0, MAX_CODE_LINES).join('\n')
        if (text.trim()) out.push({ kind: 'code', text })
        code = null
      } else {
        flush()
        code = []
      }
      continue
    }
    if (code) {
      code.push(raw)
      continue
    }
    const indent = (raw.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '  ').length
    const depth = Math.floor(indent / 2)
    const line = raw.trim()
    let m: RegExpMatchArray | null
    if (!line || /^([-*_])(\s*\1){2,}$/.test(line)) {
      flush()
    } else if ((m = line.match(/^#{1,6}\s+(.*?)\s*#*$/))) {
      flush()
      const text = plainInline(m[1])
      if (text) out.push({ kind: 'heading', text })
    } else if ((m = line.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/))) {
      flush()
      out.push({ kind: 'task', text: plainInline(m[2]), done: m[1] !== ' ', depth })
    } else if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      flush()
      const text = plainInline(m[1])
      if (text) out.push({ kind: 'bullet', text, depth })
    } else if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) {
      flush()
      const text = plainInline(m[2])
      if (text) out.push({ kind: 'ordered', text, n: Number(m[1]), depth })
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      para.push(m[1])
    } else if (line.startsWith('|')) {
      // Tabela: uma linha da prévia por linha da tabela ("Arroz · 2 kg"); a linha de traços some.
      flush()
      const cells = line.split('|').map((c) => plainInline(c)).filter(Boolean)
      if (cells.length && !cells.every((c) => /^:?-{2,}:?$/.test(c))) out.push({ kind: 'text', text: cells.join(' · ') })
    } else {
      para.push(line)
    }
  }
  if (code) {
    const text = code.join('\n').trimEnd().split('\n').slice(0, MAX_CODE_LINES).join('\n')
    if (text.trim()) out.push({ kind: 'code', text })
  }
  flush()
  return out
}

/** Prévia do card, na ordem do documento, com os limites do Ideario (o card corta pela altura). */
export function previewOf(blocks: PreviewBlock[]): PreviewBlock[] {
  const out: PreviewBlock[] = []
  let tasks = 0
  let chars = 0
  let hidden = 0
  let afterTask: number | null = null
  for (const b of blocks) {
    const len = 'text' in b ? b.text.length : 0
    const full = out.length >= MAX_BLOCKS || chars >= MAX_CHARS
    if (b.kind === 'task') {
      if (tasks >= MAX_TASKS || full) {
        hidden++
        continue
      }
      tasks++
      out.push(b)
      afterTask = out.length
    } else if (!full) out.push(b)
    chars += len
  }
  if (hidden > 0) out.splice(afterTask ?? out.length, 0, { kind: 'more', count: hidden })
  return out
}

/** Atalho: a prévia de uma nota em Markdown. */
export const previewFromMarkdown = (md: string) => previewOf(blocksFromMarkdown(md))

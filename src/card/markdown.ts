// Prévia do card a partir de Markdown, para quem guarda a nota como texto (o Nodo). O Ideario projeta do documento
// do editor no Rust (`projection.rs`); as regras aqui são as mesmas, para o card sair igual nos dois:
// texto sem formatação (negrito e itálico viram texto; prompt e link na palavra vão também em `parts`), linhas seguidas formam um parágrafo, listas e tarefas
// com profundidade, código com até 8 linhas, e os limites de `preview_of`.

import type { AttachmentKind, PreviewBlock, PreviewPart } from './types'

/** Endereço dos anexos no Markdown das notas (o mesmo de `atrio::markdown::ATT`). */
const ATT = 'ideario://att/'
const IMAGE = /!\[[^\]]*\]\(ideario:\/\/att\/([0-9a-f]+)\)/g
/** Uma linha só de fotos (uma, ou uma fileira lado a lado). */
const IMAGE_LINE = /^(?:!\[[^\]]*\]\(ideario:\/\/att\/[0-9a-f]+\)\s*)+$/
/** Um anexo que não é foto: `[📎 nome](ideario://att/<hash>)`. */
const FILE_LINE = /^\[📎\s*(.*?)\]\(ideario:\/\/att\/([0-9a-f]+)\)$/

/** O tipo de um anexo pela extensão do nome (no Markdown só vem o nome). */
function kindOfName(name: string): AttachmentKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'].includes(ext)) return 'image'
  if (['mp3', 'm4a', 'ogg', 'oga', 'wav', 'aac', 'flac'].includes(ext)) return 'audio'
  if (['mp4', 'm4v', 'mov', 'webm', 'mkv'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'ods', 'csv', 'numbers'].includes(ext)) return 'sheet'
  return 'other'
}

/** A capa do card, como no Ideario: a primeira foto ou a primeira fileira de fotos da nota (os hashes). */
export function coverFromMarkdown(md: string): string[] {
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (line.startsWith(`![`) && line.includes(ATT) && IMAGE_LINE.test(line)) return [...line.matchAll(IMAGE)].map((m) => m[1])
  }
  return []
}

const MAX_BLOCKS = 24
const MAX_TASKS = 12
const MAX_CHARS = 1200
const MAX_CODE_LINES = 8
/** Linhas de uma tabela na prévia, como `MAX_TABLE_ROWS` em projection.rs. */
const MAX_TABLE_ROWS = 8

/** Tira a marcação de linha: a prévia do Ideario também mostra só o texto (o prompt e o link ficam em `parts`). */
export function plainInline(s: string): string {
  return bare(s).replace(/[ \t]+/g, ' ').trim()
}

/** A marcação tirada, sem mexer nos espaços (para os pedaços juntarem do jeito certo). */
function bare(s: string): string {
  return s
    .replace(/<\/?prompt>/gi, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<((?:https?:|mailto:)[^>]+)>/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^*\w])[*_]([^*_\s][^*_]*?)[*_](?=$|[^*\w])/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
}

/** `<prompt>…</prompt>` e `[palavra](endereço)` no meio da linha (fora as fotos, os anexos e o cartão de link). */
const RICH = /<prompt>([\s\S]*?)<\/prompt>|(?<!!)\[((?:\\.|[^\]\\])+)\]\((?!ideario:\/\/att\/)(<[^>]*>|[^)\s]*)\)/gi

/**
 * Os pedaços de uma ou mais linhas quando há prompt ou link na palavra, como `parts_of` em projection.rs: o texto de
 * cada pedaço sem a marcação, os espaços repetidos juntos e nada nas pontas. Sem prompt nem link, nenhum.
 */
export function inlineParts(lines: string[]): PreviewPart[] {
  const raw: PreviewPart[] = []
  lines.forEach((line, i) => {
    if (i > 0) raw.push({ text: '\n' })
    const pieces = (s: string, prompt: boolean) => {
      let at = 0
      for (const m of s.matchAll(RICH)) {
        if (m.index! > at) raw.push({ text: bare(s.slice(at, m.index)), ...(prompt ? { prompt } : {}) })
        if (m[1] !== undefined) pieces(m[1], true)
        else raw.push({ text: bare(m[2]), ...(prompt ? { prompt } : {}), href: m[3].replace(/^<|>$/g, '') })
        at = m.index! + m[0].length
      }
      if (at < s.length) raw.push({ text: bare(s.slice(at)), ...(prompt ? { prompt } : {}) })
    }
    pieces(line, false)
  })
  return cleanParts(raw)
}

/** Um nó do documento do editor (o JSON do TipTap), o bastante para a prévia. */
type DocNode = { type?: string; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: DocNode[] }

/** Os pedaços de um parágrafo, título ou item do documento do editor, como `parts_of` em projection.rs (para quem
 *  monta a prévia do documento em TypeScript, como o backend simulado do Ideario). Sem prompt nem link, nenhum. */
export function partsOf(node: DocNode): PreviewPart[] {
  const raw: PreviewPart[] = []
  const walk = (n: DocNode) => {
    if (n.type === 'text') {
      const prompt = !!n.marks?.some((m) => m.type === 'prompt')
      const href = n.marks?.find((m) => m.type === 'link')?.attrs?.href
      raw.push({ text: n.text ?? '', ...(prompt ? { prompt } : {}), ...(typeof href === 'string' && href ? { href } : {}) })
    } else if (n.type === 'hardBreak') raw.push({ text: '\n' })
    else n.content?.forEach(walk)
  }
  walk(node)
  return cleanParts(raw)
}

function cleanParts(raw: PreviewPart[]): PreviewPart[] {
  if (!raw.some((p) => p.prompt || p.href)) return []
  // A regra do `clean` letra por letra, como no Rust: o espaço entre dois pedaços fica no pedaço onde estava.
  const chars: [string, number][] = []
  let pending: number | null = null
  raw.forEach((p, i) => {
    for (const c of p.text) {
      if (c === ' ' || c === '\t') pending ??= i
      else if (c === '\n') {
        while (chars.at(-1)?.[0] === ' ') chars.pop()
        chars.push(['\n', i])
        pending = null
      } else {
        if (pending !== null && chars.length && chars.at(-1)![0] !== '\n') chars.push([' ', pending])
        pending = null
        chars.push([c, i])
      }
    }
  })
  while (chars.length && /\s/.test(chars.at(-1)![0])) chars.pop()
  while (chars.length && /\s/.test(chars[0][0])) chars.shift()
  const out: PreviewPart[] = []
  for (const [c, i] of chars) {
    const { prompt, href } = raw[i]
    const last = out.at(-1)
    if (last && !!last.prompt === !!prompt && last.href === href) last.text += c
    else out.push({ text: c, ...(prompt ? { prompt: true } : {}), ...(href ? { href } : {}) })
  }
  return out
}

/** `parts` só quando há o que mostrar (como o `skip_serializing_if` do Rust). */
const withParts = (lines: string[]) => {
  const parts = inlineParts(lines)
  return parts.length ? { parts } : {}
}

/** Todos os blocos da nota, na ordem. */
export function blocksFromMarkdown(md: string): PreviewBlock[] {
  const out: PreviewBlock[] = []
  let para: string[] = []
  let code: string[] | null = null
  const flush = () => {
    const lines = para.filter((l) => plainInline(l))
    const text = lines.map(plainInline).join('\n')
    if (text) out.push({ kind: 'text', text, ...withParts(lines) })
    para = []
  }
  // Tabela em andamento: as linhas lidas e se a segunda foi a de traços (a primeira é de títulos).
  let table: string[][] | null = null
  let tableHeader = false
  const flushTable = () => {
    if (!table) return
    const all = table.filter((cells) => cells.some(Boolean))
    if (all.length) {
      const text = all.map((cells) => cells.filter(Boolean).join(' · ')).join('\n')
      out.push({ kind: 'table', rows: all.slice(0, MAX_TABLE_ROWS), header: tableHeader, more: Math.max(0, all.length - MAX_TABLE_ROWS), text })
    }
    table = null
    tableHeader = false
  }
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (!code && !raw.trim().startsWith('|')) flushTable()
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
    } else if (IMAGE_LINE.test(line)) {
      // Fotos não entram na prévia: a primeira vira a capa (`coverFromMarkdown`), como no Ideario.
      flush()
    } else if ((m = line.match(FILE_LINE))) {
      flush()
      out.push({ kind: 'file', text: plainInline(m[1]) || 'arquivo', fileKind: kindOfName(m[1]), hash: m[2] })
    } else if ((m = line.match(/^#{1,6}\s+(.*?)\s*#*$/))) {
      flush()
      const text = plainInline(m[1])
      if (text) out.push({ kind: 'heading', text, ...withParts([m[1]]) })
    } else if ((m = line.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/))) {
      flush()
      out.push({ kind: 'task', text: plainInline(m[2]), done: m[1] !== ' ', depth, ...withParts([m[2]]) })
    } else if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      flush()
      const text = plainInline(m[1])
      if (text) out.push({ kind: 'bullet', text, depth, ...withParts([m[1]]) })
    } else if ((m = line.match(/^(\d+)[.)]\s+(.*)$/))) {
      flush()
      const text = plainInline(m[2])
      if (text) out.push({ kind: 'ordered', text, n: Number(m[1]), depth, ...withParts([m[2]]) })
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      para.push(m[1])
    } else if (line.startsWith('|')) {
      // Tabela: aparece como tabela no card; a linha de traços diz que a primeira é de títulos.
      flush()
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => plainInline(c))
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        if (table?.length === 1) tableHeader = true
      } else (table ??= []).push(cells)
    } else {
      para.push(line)
    }
  }
  if (code) {
    const text = code.join('\n').trimEnd().split('\n').slice(0, MAX_CODE_LINES).join('\n')
    if (text.trim()) out.push({ kind: 'code', text })
  }
  flushTable()
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

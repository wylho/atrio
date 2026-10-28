// Um card na área de transferência, do jeito que o Ideario e o Nodo entendem: copiar uma nota no Ideario e colar no
// Nodo vira um nó com a mesma nota, e o contrário também.
//
// Vão dois formatos juntos, porque a área de transferência dos sistemas só garante texto e HTML:
//   text/html   o card legível (título e texto) num <div data-atrio-card="…">, com o card inteiro em JSON (base64)
//               no atributo. Um app do Atrio lê o JSON; um editor qualquer cola o título e o texto.
//   text/plain  Markdown: "# Título", linha em branco, a nota. Cola bem em qualquer lugar.
//
// Versão 2: o card leva também lembrete, status e os arquivos dos anexos (os bytes, em base64, até um limite), para
// colar no outro app com tudo funcionando. A versão 1 continua sendo lida.

import type { NoteColor } from './card/types'
import type { RepeatKind } from './types'

/** Versão do formato. Um app que recebe uma versão maior lê o que conhece e ignora o resto. */
export const CARD_FORMAT = 2

/** Um anexo que vai junto com o card: o hash com que o Markdown o cita, o nome, o tipo e os bytes em base64. */
export interface ClipFile {
  hash: string
  name: string
  mime: string
  data: string
}

export interface ClipCard {
  title: string
  /** O corpo da nota em Markdown (o Ideario converte do editor; o Nodo guarda assim). */
  markdown: string
  color?: NoteColor
  emoji?: string | null
  tags?: string[]
  /** Lembrete (milissegundos) e repetição. Desde a versão 2. */
  reminderAt?: number | null
  reminderRepeat?: RepeatKind | null
  /** Status: verde, amarelo, e se foi posto pelo menu (nota sem lembrete). Desde a versão 2. */
  reminderDone?: boolean
  reminderDoing?: boolean
  statusOn?: boolean
  /** Os arquivos dos anexos citados no Markdown. Desde a versão 2. */
  files?: ClipFile[]
}

/** Limite dos arquivos que vão junto numa cópia (somados): acima disso vai o texto, com a referência. */
export const CLIP_FILES_LIMIT = 25 * 1024 * 1024

const ATTR = 'data-atrio-card'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function toBase64(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(s: string): string {
  return new TextDecoder().decode(bytesFromBase64(s))
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  // Em pedaços: `String.fromCharCode(...bytes)` estoura a pilha num arquivo grande.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function bytesFromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const REPEAT_KINDS: readonly string[] = ['day', 'week', 'month', 'year']
const ATT_LINK = /(!?)\[([^\]]*)\]\(ideario:\/\/att\/([0-9a-f]+)\)/g

/** O card nos dois formatos. */
export function cardToClipboard(card: ClipCard): { html: string; text: string } {
  const payload = toBase64(JSON.stringify({ atrio: CARD_FORMAT, ...card }))
  const title = card.title.trim()
  const body = card.markdown.trim()
  const lines = body ? body.split('\n').map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '')).join('') : ''
  return {
    html: `<div ${ATTR}="${payload}">${title ? `<h3>${esc(title)}</h3>` : ''}${lines}</div>`,
    text: [title && `# ${title}`, body].filter(Boolean).join('\n\n'),
  }
}

/** Vários cards de uma vez (uma seleção): um `<div data-atrio-card>` por card, e o Markdown de todos em sequência. Um
 * app que só lê um card pega o primeiro. */
export function cardsToClipboard(cards: ClipCard[]): { html: string; text: string } {
  const parts = cards.map(cardToClipboard)
  return { html: parts.map((p) => p.html).join(''), text: parts.map((p) => p.text).filter(Boolean).join('\n\n') }
}

/** Lê um card de um HTML colado, ou `null` se não houver card do Atrio nele. */
export function cardFromHtml(html: string): ClipCard | null {
  return cardsFromHtml(html)[0] ?? null
}

/** Todos os cards do Atrio num HTML colado, na ordem (nenhum: lista vazia). */
export function cardsFromHtml(html: string): ClipCard[] {
  if (!html.includes(ATTR)) return []
  const els = new DOMParser().parseFromString(html, 'text/html').querySelectorAll(`[${ATTR}]`)
  return [...els].map((el) => parseCard(el.getAttribute(ATTR))).filter((c): c is ClipCard => c !== null)
}

function parseCard(raw: string | null): ClipCard | null {
  if (!raw) return null
  try {
    const o = JSON.parse(fromBase64(raw)) as Record<string, unknown>
    if (typeof o.atrio !== 'number' || typeof o.title !== 'string') return null
    const files = Array.isArray(o.files) ? o.files.filter(isClipFile) : []
    return {
      title: o.title,
      markdown: typeof o.markdown === 'string' ? o.markdown : '',
      color: o.color as NoteColor | undefined,
      emoji: typeof o.emoji === 'string' ? o.emoji : null,
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
      reminderAt: typeof o.reminderAt === 'number' && Number.isFinite(o.reminderAt) ? o.reminderAt : null,
      reminderRepeat: typeof o.reminderRepeat === 'string' && REPEAT_KINDS.includes(o.reminderRepeat) ? (o.reminderRepeat as RepeatKind) : null,
      reminderDone: o.reminderDone === true,
      reminderDoing: o.reminderDoing === true,
      statusOn: o.statusOn === true,
      files,
    }
  } catch {
    return null
  }
}

function isClipFile(f: unknown): f is ClipFile {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  return typeof o.hash === 'string' && typeof o.name === 'string' && typeof o.mime === 'string' && typeof o.data === 'string'
}

/** Os anexos citados no Markdown, na ordem, um por hash (com o nome da primeira vez que aparece). */
function citedFiles(markdown: string): { hash: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const m of markdown.matchAll(ATT_LINK)) {
    const name = m[2].replace(/^📎\s*/u, '').trim()
    if (!seen.has(m[3])) seen.set(m[3], name)
  }
  return [...seen].map(([hash, name]) => ({ hash, name }))
}

/**
 * Põe nos cards os arquivos dos anexos que o Markdown cita, buscados pelo app (`fetchFile`), enquanto a soma couber no
 * `limit`. Devolve os cards e os nomes que ficaram de fora (grandes demais ou que o app não achou).
 */
export async function attachCardFiles(
  cards: ClipCard[],
  fetchFile: (hash: string) => Promise<Blob | null>,
  limit = CLIP_FILES_LIMIT,
): Promise<{ cards: ClipCard[]; skipped: string[] }> {
  let used = 0
  const skipped: string[] = []
  const out: ClipCard[] = []
  for (const card of cards) {
    const files: ClipFile[] = []
    for (const { hash, name } of citedFiles(card.markdown)) {
      const blob = await fetchFile(hash).catch(() => null)
      if (!blob || used + blob.size > limit) {
        skipped.push(name || hash.slice(0, 8))
        continue
      }
      used += blob.size
      files.push({ hash, name, mime: blob.type || 'application/octet-stream', data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) })
    }
    out.push({ ...card, files })
  }
  return { cards: out, skipped }
}

/**
 * Ao colar: entrega cada arquivo que veio junto ao app (`importFile`) e troca, no Markdown, o hash antigo pelo que o
 * app devolveu (o pipeline das fotos pode mudar o hash). Arquivo que o app recusou fica com a referência antiga.
 */
export async function importCardFiles(
  card: ClipCard,
  importFile: (file: Blob, name: string) => Promise<{ hash: string }>,
): Promise<ClipCard> {
  const renamed = new Map<string, string>()
  for (const f of card.files ?? []) {
    try {
      const { hash } = await importFile(new Blob([bytesFromBase64(f.data)], { type: f.mime }), f.name)
      if (hash !== f.hash) renamed.set(f.hash, hash)
    } catch {
      // Segue com a referência antiga: o texto entra mesmo assim.
    }
  }
  const markdown = renamed.size
    ? card.markdown.replace(ATT_LINK, (all, bang: string, label: string, hash: string) =>
        renamed.has(hash) ? `${bang}[${label}](ideario://att/${renamed.get(hash)})` : all,
      )
    : card.markdown
  return { ...card, markdown, files: [] }
}

/** O card de um evento de colar (`ClipboardEvent.clipboardData`), se houver. */
export function readCard(data: DataTransfer | null | undefined): ClipCard | null {
  return readCards(data)[0] ?? null
}

/** Todos os cards de um evento de colar. */
export function readCards(data: DataTransfer | null | undefined): ClipCard[] {
  return data ? cardsFromHtml(data.getData('text/html')) : []
}

/** Copia o card. Sem `ClipboardItem` (navegador antigo), copia só o Markdown. */
export async function writeCard(card: ClipCard | Promise<ClipCard>): Promise<void> {
  return writeCards(Promise.resolve(card).then((c) => [c]))
}

/**
 * Copia vários cards de uma vez. Aceita a promessa dos cards: a cópia começa no gesto (o `ClipboardItem` recebe
 * promessas, e o navegador só deixa copiar durante o gesto) e os arquivos dos anexos chegam depois.
 */
export async function writeCards(cards: ClipCard[] | Promise<ClipCard[]>): Promise<void> {
  const parts = Promise.resolve(cards).then(cardsToClipboard)
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': parts.then(({ html }) => new Blob([html], { type: 'text/html' })),
        'text/plain': parts.then(({ text }) => new Blob([text], { type: 'text/plain' })),
      }),
    ])
  } else {
    await navigator.clipboard.writeText((await parts).text)
  }
}

/** O card guardado na área de transferência agora (para o "Colar" de um menu, que não tem evento de colar). */
export async function readClipboardCard(): Promise<ClipCard | null> {
  return (await readClipboardCards())[0] ?? null
}

/** Todos os cards guardados na área de transferência agora. */
export async function readClipboardCards(): Promise<ClipCard[]> {
  try {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes('text/html')) return cardsFromHtml(await (await item.getType('text/html')).text())
    }
  } catch {
    // Sem permissão para ler (navegador): o colar pelo teclado continua funcionando, pelo evento.
  }
  return []
}

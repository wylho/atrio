// Um card na área de transferência, do jeito que o Ideario e o Nodo entendem: copiar uma nota no Ideario e colar no
// Nodo vira um nó com a mesma nota, e o contrário também.
//
// Vão dois formatos juntos, porque a área de transferência dos sistemas só garante texto e HTML:
//   text/html   o card legível (título e texto) num <div data-atrio-card="…">, com o card inteiro em JSON (base64)
//               no atributo. Um app do Atrio lê o JSON; um editor qualquer cola o título e o texto.
//   text/plain  Markdown: "# Título", linha em branco, a nota. Cola bem em qualquer lugar.

import type { NoteColor } from './card/types'

/** Versão do formato. Um app que recebe uma versão maior lê o que conhece e ignora o resto. */
export const CARD_FORMAT = 1

export interface ClipCard {
  title: string
  /** O corpo da nota em Markdown (o Ideario converte do editor; o Nodo guarda assim). */
  markdown: string
  color?: NoteColor
  emoji?: string | null
  tags?: string[]
}

const ATTR = 'data-atrio-card'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function toBase64(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(s: string): string {
  const bin = atob(s)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

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

/** Lê um card de um HTML colado, ou `null` se não houver card do Atrio nele. */
export function cardFromHtml(html: string): ClipCard | null {
  if (!html.includes(ATTR)) return null
  const el = new DOMParser().parseFromString(html, 'text/html').querySelector(`[${ATTR}]`)
  const raw = el?.getAttribute(ATTR)
  if (!raw) return null
  try {
    const o = JSON.parse(fromBase64(raw)) as Partial<ClipCard> & { atrio?: number }
    if (typeof o.atrio !== 'number' || typeof o.title !== 'string') return null
    return {
      title: o.title,
      markdown: typeof o.markdown === 'string' ? o.markdown : '',
      color: o.color,
      emoji: o.emoji ?? null,
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    }
  } catch {
    return null
  }
}

/** O card de um evento de colar (`ClipboardEvent.clipboardData`), se houver. */
export function readCard(data: DataTransfer | null | undefined): ClipCard | null {
  return data ? cardFromHtml(data.getData('text/html')) : null
}

/** Copia o card. Sem `ClipboardItem` (navegador antigo), copia só o Markdown. */
export async function writeCard(card: ClipCard): Promise<void> {
  const { html, text } = cardToClipboard(card)
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } else {
    await navigator.clipboard.writeText(text)
  }
}

/** O card guardado na área de transferência agora (para o "Colar" de um menu, que não tem evento de colar). */
export async function readClipboardCard(): Promise<ClipCard | null> {
  try {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes('text/html')) return cardFromHtml(await (await item.getType('text/html')).text())
    }
  } catch {
    // Sem permissão para ler (navegador): o colar pelo teclado continua funcionando, pelo evento.
  }
  return null
}

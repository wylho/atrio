// Datas, tamanhos e texto no jeito do Ideario e do Nodo, no idioma escolhido (`intlLocale`). Veio de
// ideario/src/lib/format.ts.
import { intlLocale, t } from '../i18n.svelte'
import type { Millis } from '../types'

const HOUR = 3_600_000
const DAY = 86_400_000

/** Diferença em dias de calendário entre `ms` e hoje (0 = hoje, 1 = amanhã, -1 = ontem). */
export function dayDiff(ms: Millis, now = Date.now()): number {
  const a = new Date(ms)
  a.setHours(0, 0, 0, 0)
  const b = new Date(now)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / DAY)
}

export const fmtTime = (ms: Millis) => new Date(ms).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })

export function fmtReminder(ms: Millis): string {
  const hora = fmtTime(ms)
  const dd = dayDiff(ms)
  if (dd === 0) return t('Hoje, {hora}', { hora })
  if (dd === 1) return t('Amanhã, {hora}', { hora })
  if (dd === -1) return t('Ontem, {hora}', { hora })
  const dia = new Date(ms).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  return t('{dia}, {hora}', { dia, hora })
}

export const fmtShortDate = (ms: Millis) => new Date(ms).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })

export const isOverdue = (n: { reminderAt: Millis | null; reminderDone: boolean }, now = Date.now()) =>
  n.reminderAt != null && !n.reminderDone && n.reminderAt < now

/** Tamanho em KB ou MB, com a vírgula ou o ponto decimal do idioma. */
export function fmtBytes(bytes: number): string {
  const kb = Math.round(bytes / 1024)
  if (kb >= 1024) {
    const mb = (kb / 1024).toFixed(1)
    return `${intlLocale() === 'pt-BR' ? mb.replace('.', ',') : mb} MB`
  }
  return `${kb} KB`
}

/** "agora", "há 5 min", "há 3 h", "há 2 d". */
export function ago(ms: Millis, now = Date.now()): string {
  const diff = Math.max(0, now - ms)
  if (diff < 60_000) return t('agora')
  if (diff < HOUR) return t('há {n} min', { n: Math.floor(diff / 60_000) })
  if (diff < DAY) return t('há {n} h', { n: Math.floor(diff / HOUR) })
  return t('há {n} d', { n: Math.round(diff / DAY) })
}

/** "hoje" ou "há N d", usado na lista de arquivos. */
export function daysAgo(ms: Millis, now = Date.now()): string {
  const d = -dayDiff(ms, now)
  return d <= 0 ? t('hoje') : t('há {n} d', { n: d })
}

/** Data local às `hour`:00, `dayOffset` dias a partir de hoje. */
export function atLocal(dayOffset: number, hour: number, minute = 0): Millis {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

/** Valor para `<input type="datetime-local">`. */
export function toLocalInput(ms: Millis): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Remove acentos e caixa, como o tokenizer `unicode61 remove_diacritics 2` do FTS5. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Tags digitadas como `#palavra` no texto. */
/** As `#tags` do texto, em minúsculas, na ordem, sem repetir (como `atrio::text::hash_tags`). */
export const hashTags = (text: string) => [
  ...new Set([...text.matchAll(/(?:^|[^\p{L}\d_])#([\p{L}\d_-]+)/gu)].map((m) => m[1].toLowerCase())),
]

export const normalizeTag = (raw: string) => raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase()

export { withHashtags } from '../card/hashtags'

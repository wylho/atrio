// Atalhos e repetição de lembretes (veio de ideario/src/lib/reminders.ts).
import { t } from '../i18n.svelte'
import { atLocal } from './format'
import type { Millis, RepeatKind } from '../types'

/** Atalhos de lembrete, recalculados na hora (para "Hoje à noite" não ficar no passado). */
export function quickTimes(now = new Date()): [string, Millis][] {
  const toMonday = (8 - now.getDay()) % 7 || 7
  return [
    [t('Hoje à noite'), atLocal(now.getHours() >= 18 ? 1 : 0, 18)],
    [t('Amanhã de manhã'), atLocal(1, 9)],
    [t('Segunda que vem'), atLocal(toMonday, 9)],
  ]
}

/** Adiar: daqui a 1 hora, mais os atalhos. */
export function snoozeTimes(now = new Date()): [string, Millis][] {
  return [[t('Daqui a 1 hora'), now.getTime() + 3_600_000], ...quickTimes(now)]
}

/**
 * `base` mais `n` meses, no dia de `base` ou no último dia do mês quando ele é mais curto (31/jan + 1 mês = 28/fev),
 * como o `checked_add_months` do núcleo. O `setMonth` puro estouraria para 3/mar.
 */
function addMonths(d: Date, base: Date, n: number) {
  const month = base.getMonth() + n
  const last = new Date(base.getFullYear(), month + 1, 0).getDate()
  d.setDate(1)
  d.setFullYear(base.getFullYear(), month, Math.min(base.getDate(), last))
}

/** Próxima vez de um lembrete que se repete, depois de agora (mês e ano contam da data original, como no núcleo). */
export function nextOccurrence(at: Millis, repeat: RepeatKind, now = Date.now()): Millis {
  const base = new Date(at)
  let next = at
  for (let k = 1; next <= Math.max(now, at); k++) {
    const d = new Date(base)
    if (repeat === 'day') d.setDate(base.getDate() + k)
    else if (repeat === 'week') d.setDate(base.getDate() + 7 * k)
    else addMonths(d, base, repeat === 'month' ? k : 12 * k)
    next = d.getTime()
  }
  return next
}

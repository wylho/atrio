// Os metadados do card e as regras de lembrete e status, as mesmas em todos os apps (vieram do editor do Ideario).

import type { Millis, NoteColor, ReminderStatus, RepeatKind } from '../types'
import { nextOccurrence } from '../util/reminders'

/** O que todo card tem além do texto. O app pode guardar mais coisas no mesmo objeto (o Ideario: fixada, arquivada…). */
export interface CardMeta {
  title: string
  categoryId: string | null
  color: NoteColor
  emoji: string | null
  /** Etiquetas escolhidas à mão; as `#palavra` do texto aparecem junto, sem entrar aqui. */
  tags: string[]
  reminderAt: Millis | null
  reminderRepeat: RepeatKind | null
  reminderDone: boolean
  /** Em andamento (amarelo). */
  reminderDoing: boolean
  /** Tem status mesmo sem lembrete (posto pelo menu). Com lembrete, o status existe sempre. */
  statusOn: boolean
}

/** Um card vazio (nota nova). */
export function emptyMeta(over: Partial<CardMeta> = {}): CardMeta {
  return {
    title: '', categoryId: null, color: 'none', emoji: null, tags: [],
    reminderAt: null, reminderRepeat: null, reminderDone: false, reminderDoing: false, statusOn: false,
    ...over,
  }
}

/** Nome e cor de cada status (seletor de três cores, colunas do Kanban). */
export const STATUS: Record<ReminderStatus, { label: string; color: string }> = {
  todo: { label: 'A fazer', color: 'var(--st-todo)' },
  doing: { label: 'Em andamento', color: 'var(--st-doing)' },
  done: { label: 'Concluído', color: 'var(--st-done)' },
}

export const statusOf = (n: { reminderDone: boolean; reminderDoing: boolean }): ReminderStatus =>
  n.reminderDone ? 'done' : n.reminderDoing ? 'doing' : 'todo'

/** O card tem status: todo card com lembrete, e os que ganharam status pelo menu. */
export const hasStatus = (n: { reminderAt: Millis | null; statusOn: boolean }) => n.reminderAt != null || n.statusOn

/** Marca (ou tira) o lembrete. Sem lembrete não há repetição, e o status vai junto, a não ser que tenha sido posto pelo
 *  menu. Devolve se um lembrete foi marcado (o app pode sugerir ficar na bandeja, por exemplo). */
export function setReminder(meta: CardMeta, at: Millis | null): boolean {
  meta.reminderAt = at
  if (at == null) {
    meta.reminderRepeat = null
    if (!meta.statusOn) (meta.reminderDone = false), (meta.reminderDoing = false)
    return false
  }
  meta.reminderDone = false
  return true
}

/** Seletor de três cores. Verde num lembrete que se repete vale por esta vez: pula para a próxima. Devolve o aviso
 *  a mostrar, se houver. */
export function setStatus(meta: CardMeta, to: ReminderStatus | 'none', now = Date.now()): string | null {
  if (to === 'none') {
    meta.statusOn = false
    if (meta.reminderAt == null) (meta.reminderDone = false), (meta.reminderDoing = false)
    return null
  }
  if (meta.reminderAt == null) meta.statusOn = true
  let msg: string | null = null
  if (to === 'done' && meta.reminderAt != null && meta.reminderRepeat) {
    meta.reminderAt = nextOccurrence(meta.reminderAt, meta.reminderRepeat, now)
    meta.reminderDone = false
    msg = 'Feito por esta vez'
  } else meta.reminderDone = to === 'done'
  meta.reminderDoing = to === 'doing'
  return msg
}

import { describe, expect, it } from 'vitest'
import { addMessages, i18n, setLocale, systemLocale, t, tn } from '../src/index'

describe('idiomas', () => {
  it('o texto em português é a chave; sem tradução, aparece em português', () => {
    addMessages('en', { 'Apagar nota': 'Delete note', 'Editada {quando}': 'Edited {quando}', '{n} nota': '{n} note', '{n} notas': '{n} notes' })
    setLocale('pt-BR')
    expect(t('Apagar nota')).toBe('Apagar nota')
    setLocale('en')
    expect(i18n.locale).toBe('en')
    expect(t('Apagar nota')).toBe('Delete note')
    expect(t('Editada {quando}', { quando: '2 min' })).toBe('Edited 2 min')
    expect(t('Sem tradução ainda')).toBe('Sem tradução ainda')
    expect([tn(1, '{n} nota', '{n} notas'), tn(3, '{n} nota', '{n} notas')]).toEqual(['1 note', '3 notes'])
    expect(document.documentElement.lang).toBe('en')
    setLocale('auto')
  })

  it('automático: português para qualquer português, inglês para o resto', () => {
    expect(systemLocale(['pt-PT'])).toBe('pt-BR')
    expect(systemLocale(['fr-FR', 'pt-BR'])).toBe('pt-BR')
    expect(systemLocale(['es-ES', 'en-US'])).toBe('en')
    expect(systemLocale([])).toBe('en')
  })
})

describe('o Atrio em inglês', () => {
  it('pílulas, visualizador, lembrete e datas trocam de idioma, e voltam', async () => {
    const { flushSync, mount, unmount } = await import('svelte')
    const { CardPills, fmtBytes, fmtReminder, ago, quickTimes, setStatus, emptyMeta, STATUS, atLocal } = await import('../src/index')
    const { AttachmentViewer } = await import('../src/viewer')
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
    setLocale('en')
    try {
      // pílula de status: o nome continua em português no dado (é a chave) e aparece em inglês
      const target = document.createElement('div')
      const pills = mount(CardPills, { target, props: { statusOn: true, reminderDoing: true } })
      flushSync()
      expect(target.textContent).toContain('In progress')
      expect(STATUS.doing.label).toBe('Em andamento')
      // o idioma muda com o card aberto
      setLocale('pt-BR')
      flushSync()
      expect(target.textContent).toContain('Em andamento')
      setLocale('en')
      flushSync()
      unmount(pills)

      const viewer = mount(AttachmentViewer, {
        target: document.body,
        props: {
          att: { hash: 'cd34', kind: 'sheet', mime: 'application/vnd.ms-excel', name: 'contas.xlsx', bytes: 2048, origBytes: null, width: null, height: null, palette: null, tone: null, addedAt: 1 },
          imageUrl: () => '', mediaUrl: () => 'x', onclose: () => {}, ondownload: () => {},
        },
      })
      flushSync()
      expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Download'))).toBe(true)
      expect(document.querySelector('.lb-opt b')?.textContent).toBe('Spreadsheet · 2 KB')
      unmount(viewer)

      // datas e números
      expect(fmtReminder(atLocal(0, 9))).toMatch(/^Today, /)
      expect(fmtReminder(atLocal(1, 9))).toMatch(/^Tomorrow, /)
      expect(ago(Date.now() - 5 * 60_000)).toBe('5 min ago')
      expect(fmtBytes(1_572_864)).toBe('1.5 MB')
      expect(quickTimes().map(([l]) => l)).toEqual(['Tonight', 'Tomorrow morning', 'Next Monday'])
      const meta = emptyMeta({ reminderAt: Date.now() - 1000, reminderRepeat: 'day' })
      expect(setStatus(meta, 'done')).toBe('Done for this time')
    } finally {
      setLocale('pt-BR')
    }
    expect(fmtBytes(1_572_864)).toBe('1,5 MB')
    expect(ago(Date.now() - 5 * 60_000)).toBe('há 5 min')
  })
})

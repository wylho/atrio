import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { emptyMeta, features, hasStatus, setReminder, setStatus, statusOf } from '../src/index'
import { NoteEditor } from '../src/editor'
import Harness from './NoteEditorHarness.svelte'

// O jsdom não tem matchMedia (o card pergunta se a tela é de toque) nem ResizeObserver (o título cresce com o texto).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
globalThis.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia

describe('regras do card', () => {
  it('lembrete: tirar leva o status junto, a não ser que tenha sido posto pelo menu', () => {
    const m = emptyMeta()
    expect(setReminder(m, Date.now() + 1000)).toBe(true)
    expect(hasStatus(m)).toBe(true)
    setStatus(m, 'doing')
    setReminder(m, null)
    expect(hasStatus(m)).toBe(false)
    expect(m.reminderDoing).toBe(false)

    setStatus(m, 'doing')
    expect(m.statusOn).toBe(true)
    setReminder(m, Date.now() + 1000)
    setReminder(m, null)
    expect(statusOf(m)).toBe('doing')
  })

  it('verde num lembrete que se repete vale por esta vez', () => {
    const at = new Date(2026, 0, 31, 9).getTime()
    const m = emptyMeta({ reminderAt: at, reminderRepeat: 'month' })
    expect(setStatus(m, 'done', new Date(2026, 1, 1).getTime())).toBe('Feito por esta vez')
    expect(m.reminderDone).toBe(false)
    expect(new Date(m.reminderAt!).getDate()).toBe(28)
  })
})

describe('NoteEditor', () => {
  it('mostra só o que o app liga, e avisa a cada mudança do texto sem Y.Doc', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const bodies: string[] = []
    const app = mount(Harness, {
      target,
      props: {
        features: features({ category: false }),
        content: '<p>oi</p>',
        onbody: (text: string) => bodies.push(text),
      },
    })
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    expect(target.querySelector('#titulo')).not.toBeNull()
    expect(target.querySelector('#categoria')).toBeNull()
    expect(target.querySelector('.ed-tags input')).not.toBeNull()
    expect(target.querySelector('[aria-label="Cor da nota"]')).not.toBeNull()
    expect(target.querySelector('#corpo')?.textContent).toBe('oi')
    ;(app as unknown as { type: (t: string) => void }).type(' mundo #ideia')
    flushSync()
    expect(bodies.at(-1)).toBe('oi mundo #ideia')
    // A etiqueta do texto aparece junto das escolhidas.
    expect([...target.querySelectorAll('.ed-tags .pill')].map((p) => p.textContent)).toContain('#ideia')
    unmount(app)
  })

  it('com tudo ligado, a categoria aparece', () => {
    const target = document.createElement('div')
    const app = mount(Harness, { target, props: { features: features(), content: '' } })
    flushSync()
    expect(target.querySelector('#categoria')).not.toBeNull()
    unmount(app)
  })

  it('é exportado pelo @wylho/atrio/editor', () => {
    expect(NoteEditor).toBeTypeOf('function')
  })
})

describe('pílulas do card', () => {
  it('lembrete tem precedência sobre o status; sem lembrete, o status aparece; etiquetas por último', async () => {
    const { CardPills } = await import('../src/index')
    const target = document.createElement('div')
    let app = mount(CardPills, { target, props: { statusOn: true, reminderDoing: true, tags: ['viagem'] } })
    flushSync()
    expect(target.textContent).toContain('Em andamento')
    expect(target.querySelector('.pill.tag')?.textContent).toBe('#viagem')
    unmount(app)
    app = mount(CardPills, { target, props: { reminderAt: Date.now() - 60_000, statusOn: true } })
    flushSync()
    expect(target.querySelector('.pill.late')).not.toBeNull()
    expect(target.textContent).not.toContain('A fazer')
    unmount(app)
  })
})

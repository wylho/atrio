import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { CardTopBar, emptyMeta, features, hashTags, nearestNoteColor, hasStatus, NoteCard, setReminder, setStatus, statusOf, type CardSummary } from '../src/index'
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

  it('no papel, o topo é o card da nota: cor, emoji, o título inteiro e as pílulas (opção C)', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const title = 'Roteiro da viagem para a serra no feriado prolongado de novembro'
    const app = mount(Harness, {
      target,
      props: {
        features: features(),
        content: '<p>Levar casaco. #frio</p>',
        init: { title, emoji: '🏔️', color: 'sky', categoryId: 'c1', tags: ['viagem'], statusOn: true, reminderDoing: true },
      },
    })
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const card = target.querySelector('.ed-print-card')!
    expect(card.getAttribute('data-color')).toBe('sky')
    expect(card.getAttribute('aria-hidden')).toBe('true')
    expect(card.querySelector('.pc-emoji')?.textContent).toBe('🏔️')
    // o título vai inteiro, como texto (o campo de texto cortava no papel)
    expect(card.querySelector('h1.pc-title')?.textContent).toBe(title)
    const pills = [...card.querySelectorAll('.pc-pills span')].map((s) => s.textContent)
    expect(pills).toEqual(['Trabalho', 'Em andamento', '#viagem', '#frio'])
    expect(card.querySelector('.pc-st.doing')).not.toBeNull()
    unmount(app)
    target.remove()
  })

  it('no papel, sem título nem pílulas, o card tem só o que existe', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const app = mount(Harness, { target, props: { features: features({ category: false }), content: '<p>só texto</p>', init: { title: '  ' } } })
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const card = target.querySelector('.ed-print-card')!
    expect(card.getAttribute('data-color')).toBe('none')
    expect(card.querySelector('.pc-title')).toBeNull()
    expect(card.querySelector('.pc-pills')).toBeNull()
    unmount(app)
    target.remove()
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

describe('status na lista', () => {
  it('com onstatus, o card que tem status mostra o seletor e muda por ele; sem status, nada aparece', async () => {
    const { CardPills } = await import('../src/index')
    const target = document.createElement('div')
    const got: string[] = []
    let app = mount(CardPills, { target, props: { statusOn: true, onstatus: (s: string) => got.push(s) } })
    flushSync()
    expect(target.querySelector('.status-toggle')).not.toBeNull()
    expect(target.textContent).not.toContain('A fazer')
    ;(target.querySelector('.st-done') as HTMLButtonElement).click()
    expect(got).toEqual(['done'])
    unmount(app)
    app = mount(CardPills, { target, props: { tags: ['x'], onstatus: () => {} } })
    flushSync()
    expect(target.querySelector('.status-toggle')).toBeNull()
    unmount(app)
  })
})

describe('anexo no card', () => {
  it('com o cursor numa lista, a foto entra depois da lista, como bloco do texto (não dentro do item)', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const content = { type: 'doc', content: [{ type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reservar hotel' }] }] },
    ] }] }
    const app = mount(Harness, { target, props: { features: features(), content } })
    await new Promise((r) => setTimeout(r, 50))
    flushSync()
    const h = app as unknown as { caretAtEnd(): void; addFiles(f: { blob: Blob; name: string }[]): void; json(): { content: { type: string }[] } }
    h.caretAtEnd()
    h.addFiles([{ blob: new Blob(['abc'], { type: 'image/png' }), name: 'praia.png' }])
    await new Promise((r) => setTimeout(r, 50))
    expect(h.json().content.map((n) => n.type)).toEqual(['taskList', 'noteImage', 'paragraph'])
    unmount(app)
  })
})

describe('o card (miniatura), o mesmo em todos os apps', () => {
  const base: CardSummary = {
    title: 'Viagem', emoji: null, color: 'sky', preview: [{ kind: 'text', text: 'Levar protetor' }], cover: [],
    imageCount: 0, fileCount: 0, tags: [], reminderAt: null, reminderRepeat: null, reminderDone: false,
    reminderDoing: false, statusOn: false,
  }
  function show(props: Record<string, unknown>) {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(NoteCard, { target, props: { thumb: (h: string) => `thumb/${h}`, ...props } as never })
    flushSync()
    return { el: target.firstElementChild as HTMLElement, done: () => unmount(app) }
  }

  it('capa na proporção de cada foto, com +N para as que não cabem', () => {
    const { el, done } = show({ card: { ...base, cover: [{ hash: 'a1', width: 800, height: 600 }], imageCount: 3 } })
    expect(el.className).toContain('c-sky')
    const img = el.querySelector('.card-media img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('thumb/a1')
    expect(img.style.aspectRatio).toMatch(/^1\.333/)
    expect(el.querySelector('.card-media .more')?.textContent).toBe('+2')
    done()
  })

  it('nota que é só um anexo vira a miniatura do arquivo, com o nome', () => {
    const card = { ...base, preview: [{ kind: 'file', text: 'roteiro.pdf', fileKind: 'pdf', hash: 'f1' }], fileCount: 1 }
    const { el, done } = show({ card, fileThumb: (h: string) => `prev/${h}` })
    expect(el.querySelector('.card-file.t-pdf img.file-preview')?.getAttribute('src')).toBe('prev/f1')
    expect(el.querySelector('.card-file-name')?.textContent).toBe('roteiro.pdf')
    expect(el.querySelector('.card-meta'), 'o anexo não conta como pílula no card só-arquivo').toBeNull()
    done()
  })

  it('abrir e marcar são do app; sem as funções, o card não mostra a marca nem o alfinete', () => {
    const calls: string[] = []
    const a = show({ card: base, onopen: () => calls.push('abrir') })
    expect(a.el.querySelector('.card-check')).toBeNull()
    expect(a.el.querySelector('.card-pin')).toBeNull()
    a.el.click()
    a.done()
    const b = show({ card: base, onopen: () => calls.push('abrir'), onmark: () => calls.push('marcar'), onpin: () => calls.push('fixar'), selecting: true })
    b.el.click()
    ;(b.el.querySelector('.card-check') as HTMLElement).click()
    expect(b.el.querySelector('.card-pin'), 'com seleção em andamento, sem alfinete').toBeNull()
    b.done()
    expect(calls).toEqual(['abrir', 'marcar', 'marcar'])
  })

  it('#tags do texto: na ordem, sem repetir (como o núcleo)', () => {
    expect(hashTags('Ver #Casa e #casa, #compras')).toEqual(['casa', 'compras'])
  })
})

describe('cor de nota mais próxima', () => {
  it('cada tom vai para a cor do Atrio mais parecida; cinza fica no padrão', () => {
    expect(['#e8c547', '#f0a36b', '#e5818d', '#5aa0f2', '#a78bfa', '#5bb974', '#888888', 'nada'].map(nearestNoteColor)).toEqual([
      'butter', 'sand', 'rose', 'sky', 'lilac', 'sage', 'none', 'none',
    ])
  })
})

describe('barra do card aberto, a mesma nos dois apps', () => {
  function bar(props: Record<string, unknown>) {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(CardTopBar, { target, props: { meta: emptyMeta(), card: undefined, ...props } as never })
    flushSync()
    return { el: target, done: () => unmount(app) }
  }

  it('voltar sempre; modo documento só na janela larga; fixar só no app que fixa', () => {
    let back = 0
    const a = bar({ onback: () => back++, ondoc: () => {} })
    ;(a.el.querySelector('[aria-label="Voltar"]') as HTMLElement).click()
    expect(back).toBe(1)
    expect(a.el.querySelector('[aria-label="Abrir como documento"]'), 'janela estreita').toBeNull()
    expect(a.el.querySelector('[aria-label="Fixar"]')).toBeNull()
    expect(a.el.querySelector('[aria-label="Mais opções"]')).not.toBeNull()
    a.done()
    const b = bar({ onback: () => {}, wide: true, ondoc: () => {}, onpin: () => {}, pinned: true })
    expect(b.el.querySelector('[aria-label="Abrir como documento"]')).not.toBeNull()
    expect(b.el.querySelector('[aria-label="Desafixar"]')).not.toBeNull()
    b.done()
  })
})


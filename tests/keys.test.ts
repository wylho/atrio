import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { Editor } from '@tiptap/core'
import { AllSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { noteExtensions } from '../src/editor/extensions'
import { headingAt } from '../src/editor/heading'
import { fillPreview, linkTarget } from '../src/editor/link'
import { features } from '../src/index'
import Harness from './NoteEditorHarness.svelte'

// Teclado, colar e links do card (os dois apps).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
globalThis.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia
const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 })
for (const proto of [Element.prototype, Range.prototype] as unknown as Record<string, unknown>[]) {
  proto.getClientRects ??= () => []
  proto.getBoundingClientRect ??= rect
}

function ed(content: unknown, markdown?: (md: string) => Promise<{ content?: unknown[] } | null>) {
  const el = document.createElement('div')
  document.body.append(el)
  return new Editor({ element: el, extensions: noteExtensions({ markdown }), content: content as object })
}
const doc = (...c: unknown[]) => ({ type: 'doc', content: c })
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const task = (text: string, checked = false, sub?: unknown[]) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text), ...(sub ? [{ type: 'taskList', content: sub }] : [])],
})
const key = (e: Editor, k: string, shift = false) =>
  e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key: k, shiftKey: shift }))) ?? false
const at = (e: Editor, text: string) => {
  let pos = -1
  e.state.doc.descendants((n, p) => {
    if (pos < 0 && n.isText && n.text === text) pos = p
  })
  return pos
}

describe('Tab e Shift+Tab', () => {
  it('Shift+Tab num item do primeiro nível não tira o item da lista; num subitem, volta um nível', () => {
    const e = ed(doc({ type: 'taskList', content: [task('a', true, [task('b')])] }))
    e.commands.setTextSelection(at(e, 'a') + 1)
    expect(key(e, 'Tab', true)).toBe(true)
    expect(e.state.doc.firstChild!.type.name).toBe('taskList')
    expect(e.state.doc.firstChild!.firstChild!.attrs.checked).toBe(true)
    e.commands.setTextSelection(at(e, 'b') + 1)
    key(e, 'Tab', true)
    expect(e.state.doc.firstChild!.childCount).toBe(2)
  })

  it('Tab onde não dá para recuar fica no texto (não leva o foco embora)', () => {
    const e = ed(doc(p('um'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('primeiro')] }] }))
    const before = JSON.stringify(e.getJSON())
    e.commands.setTextSelection(2)
    expect(key(e, 'Tab')).toBe(true)
    e.commands.setTextSelection(at(e, 'primeiro') + 1)
    expect(key(e, 'Tab')).toBe(true)
    expect(JSON.stringify(e.getJSON())).toBe(before)
  })
})

describe('botão H', () => {
  it('com a nota toda escolhida (Ctrl+A), vê o título do começo', () => {
    const e = ed(doc({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] }, p('x')))
    e.view.dispatch(e.state.tr.setSelection(new AllSelection(e.state.doc)))
    expect(headingAt(e)).toBe(1)
  })
})

describe('colar Markdown', () => {
  const paste = (e: Editor, text: string, html = '') =>
    e.view.someProp('handlePaste', (f) =>
      f(e.view, { clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : t === 'text/html' ? html : '') }, preventDefault() {} } as unknown as ClipboardEvent, null as never),
    ) ?? false
  const convert = async () => ({ content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'instala' }] }] })

  it('o que veio do próprio editor (ou de código) cola como veio, não como Markdown', () => {
    const e = ed(doc({ type: 'paragraph' }), convert)
    expect(paste(e, '# instala\nnpm i', '<pre data-pm-slice="0 0 []"><code># instala\nnpm i</code></pre>')).toBe(false)
    expect(paste(e, 'use **negrito**', '<p>use <code>**negrito**</code></p>')).toBe(false)
  })

  it('link na palavra e prompt também são Markdown', () => {
    const e = ed(doc({ type: 'paragraph' }), convert)
    expect(paste(e, 'Veja [o site](https://exemplo.com) agora')).toBe(true)
    expect(paste(e, 'faça <prompt>resuma</prompt>')).toBe(true)
    expect(paste(e, 'texto comum, sem nada')).toBe(false)
  })

  it('uma lista colada num item da mesma lista entra ao lado, não como subitens', async () => {
    const list = { type: 'taskList', content: [task('x'), task('y')] }
    const e = ed(doc({ type: 'taskList', content: [task('abcd')] }), async () => ({ content: [list] }))
    e.commands.setTextSelection(at(e, 'abcd') + 1)
    paste(e, '- [ ] x\n- [ ] y')
    await new Promise((r) => setTimeout(r, 0))
    const items: string[] = []
    e.state.doc.firstChild!.forEach((i) => items.push(i.textContent))
    expect(items).toEqual(['ax', 'ybcd'])
  })
})

describe('links', () => {
  it('endereço digitado: só o que parece endereço', () => {
    expect(linkTarget('exemplo.com/x')).toBe('https://exemplo.com/x')
    expect(linkTarget('https://exemplo.com')).toBe('https://exemplo.com/')
    expect(linkTarget('mailto:ana@exemplo.com')).toBe('mailto:ana@exemplo.com')
    expect(linkTarget('localhost:3000')).toBe('https://localhost:3000/')
    expect(linkTarget('abc')).toBeNull()
    expect(linkTarget('olá')).toBeNull()
    expect(linkTarget('javascript:alert(1)')).toBeNull()
  })

  it('"Atualizar prévia" sem rede deixa o cartão como estava; a prévia não entra no desfazer', async () => {
    const card = { type: 'linkCard', attrs: { url: 'https://exemplo.com/a', title: 'Antigo', description: 'd' } }
    const e = ed(doc(card, { type: 'paragraph' }))
    fillPreview(e.view, 'https://exemplo.com/a', async () => ({ title: null, description: null, site: null, image: null }), true)
    await new Promise((r) => setTimeout(r, 0))
    expect(e.state.doc.firstChild!.attrs.title).toBe('Antigo')

    const f = ed(doc({ type: 'paragraph' }))
    f.commands.insertContent({ type: 'linkCard', attrs: { url: 'https://exemplo.com/b' } })
    // a prévia chega bem depois (fora do grupo do desfazer de quem colou)
    f.view.dispatch(closeHistory(f.state.tr))
    fillPreview(f.view, 'https://exemplo.com/b', async () => ({ title: 'Novo', description: null, site: null, image: null }))
    await new Promise((r) => setTimeout(r, 0))
    expect(f.state.doc.firstChild!.attrs.title).toBe('Novo')
    f.commands.undo()
    expect(f.state.doc.firstChild!.type.name).toBe('paragraph')
  })

  it('a lista "Links" mostra o texto da primeira vez de cada endereço', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const app = mount(Harness, {
      target,
      props: { features: features(), content: '<p>o <a href="https://exemplo.com/m">manual</a> e</p><p>o <a href="https://exemplo.com/m">documento</a></p>' },
    })
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const rows = [...target.querySelectorAll('.ed-links .ed-link-row:not(.add)')].map((r) => r.textContent)
    expect(rows).toEqual(['manualexemplo.com'])
    unmount(app)
  })
})

import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '../src/editor/extensions'
import { convertBlock, deleteNode, duplicateNode, moveNode, moveNodeTo, checkAll } from '../src/editor/blocks'

// O menu de cada bloco (a alça ⋮⋮) e o CheckCascade, sem Y.Doc: o modo `content` do Nodo.
// O jsdom não mede: o scrollIntoView do ProseMirror só precisa de retângulos vazios.
const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 })
for (const proto of [Element.prototype, Range.prototype] as unknown as Record<string, unknown>[]) {
  proto.getClientRects ??= () => []
  proto.getBoundingClientRect ??= rect
}
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

function ed(content: unknown) {
  const el = document.createElement('div')
  document.body.append(el)
  return new Editor({ element: el, extensions: noteExtensions({}), content: content as object })
}
const ti = (text: string, checked: boolean, sub?: unknown[]) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, ...(sub ? [{ type: 'taskList', content: sub }] : [])],
})
const li = (text: string) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const doc = (...c: unknown[]) => ({ type: 'doc', content: c })
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
/** "A:x B:_" — o texto e o marcado de cada item, na ordem do documento. */
const states = (e: Editor) => {
  const out: string[] = []
  e.state.doc.descendants((n) => {
    if (n.type.name === 'taskItem') out.push(`${n.firstChild?.textContent}:${n.attrs.checked ? 'x' : '_'}`)
  })
  return out.join(' ')
}
const posOf = (e: Editor, text: string, type = 'taskItem') => {
  let at = -1
  e.state.doc.descendants((n, pos) => {
    if (at < 0 && n.type.name === type && n.firstChild?.textContent === text) at = pos
  })
  return at
}

describe('checklist: marcar o item marca os subitens, e só isso', () => {
  it('marcar o pai marca os subitens; desmarcar um subitem não mexe no resto', () => {
    const e = ed(doc({ type: 'taskList', content: [ti('P', false, [ti('S1', false), ti('S2', true)])] }))
    e.view.dispatch(e.state.tr.setNodeMarkup(posOf(e, 'P'), undefined, { checked: true }))
    expect(states(e)).toBe('P:x S1:x S2:x')
    e.view.dispatch(e.state.tr.setNodeMarkup(posOf(e, 'S1'), undefined, { checked: false }))
    expect(states(e)).toBe('P:x S1:_ S2:x')
  })

  it('mover, arrastar ou duplicar um item leva os subitens como estavam', () => {
    let e = ed(doc({ type: 'taskList', content: [ti('A', false), ti('B', true, [ti('B1', false)])] }))
    moveNode(e.view, posOf(e, 'B'), -1)
    expect(states(e)).toBe('B:x B1:_ A:_')

    e = ed(doc({ type: 'taskList', content: [ti('B', false, [ti('B1', true)]), ti('A', true)] }))
    moveNode(e.view, posOf(e, 'B'), 1)
    expect(states(e)).toBe('A:x B:_ B1:x')

    e = ed(doc({ type: 'taskList', content: [ti('A', false), ti('C', false), ti('B', true, [ti('B1', false)])] }))
    moveNodeTo(e.view, posOf(e, 'B'), posOf(e, 'A'))
    expect(states(e)).toBe('B:x B1:_ A:_ C:_')

    e = ed(doc({ type: 'taskList', content: [ti('B', true, [ti('B1', false)]), ti('A', false)] }))
    duplicateNode(e.view, posOf(e, 'B'))
    expect(states(e)).toBe('B:x B1:_ B:x B1:_ A:_')
  })

  it('desfazer a marcação do pai devolve os subitens como estavam', () => {
    const e = ed(doc({ type: 'taskList', content: [ti('P', false, [ti('S1', true), ti('S2', false)])] }))
    e.view.dispatch(e.state.tr.setNodeMarkup(posOf(e, 'P'), undefined, { checked: true }))
    expect(states(e)).toBe('P:x S1:x S2:x')
    e.commands.undo()
    expect(states(e)).toBe('P:_ S1:x S2:_')
    e.commands.redo()
    expect(states(e)).toBe('P:x S1:x S2:x')

    const f = ed(doc({ type: 'taskList', content: [ti('P', false, [ti('S', true)]), ti('Q', false)] }))
    checkAll(f.view, 0, true)
    f.commands.undo()
    expect(states(f)).toBe('P:_ S:x Q:_')
  })
})

describe('menu do bloco', () => {
  it('mover, duplicar e apagar devolvem o foco ao editor (o Ctrl+Z desfaz a ação, não a digitação)', () => {
    for (const act of [
      (e: Editor) => moveNode(e.view, 0, 1),
      (e: Editor) => duplicateNode(e.view, 0),
      (e: Editor) => deleteNode(e.view, 0),
    ]) {
      const e = ed(doc(p('um'), p('dois')))
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(e.view.hasFocus()).toBe(false)
      act(e)
      expect(e.view.hasFocus()).toBe(true)
    }
  })

  it('apagar o único item de uma lista tira a lista', () => {
    const e = ed(doc(p('x'), { type: 'bulletList', content: [li('só')] }))
    deleteNode(e.view, posOf(e, 'só', 'listItem'))
    expect(e.getJSON().content).toEqual([p('x')])
    const f = ed(doc({ type: 'taskList', content: [ti('A', false, [ti('A1', false)])] }))
    deleteNode(f.view, posOf(f, 'A1'))
    expect(states(f)).toBe('A:_')
    expect(f.state.doc.firstChild!.firstChild!.childCount).toBe(1)
  })

  it('transformar uma checklist em texto, título ou código não perde fotos e anexos dos itens', () => {
    const photo = { type: 'noteImage', attrs: { hash: 'f0a1' } }
    const list = { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('A'), photo] }, ti('B', false)] }
    for (const to of ['paragraph', 'heading', 'code'] as const) {
      const e = ed(doc(list))
      convertBlock(e.view, 0, to)
      const names = e.getJSON().content!.map((n) => n.type)
      expect(names).toContain('noteImage')
      expect(e.state.doc.textContent).toContain('A')
      expect(e.state.doc.textContent).toContain('B')
    }
    const e = ed(doc(list))
    convertBlock(e.view, 0, 'paragraph')
    expect(e.getJSON().content!.map((n) => n.type)).toEqual(['paragraph', 'noteImage', 'paragraph'])
  })

  it('transformar em código mantém as quebras de linha do parágrafo', () => {
    const e = ed(doc({ type: 'paragraph', content: [{ type: 'text', text: 'linha1' }, { type: 'hardBreak' }, { type: 'text', text: 'linha2' }] }))
    convertBlock(e.view, 0, 'code')
    expect(e.state.doc.firstChild!.textContent).toBe('linha1\nlinha2')
  })

  it('transformar em título um título mantém o tamanho', () => {
    const e = ed(doc({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] }))
    convertBlock(e.view, 0, 'heading')
    expect(e.getJSON().content![0].attrs!.level).toBe(1)
  })

  it('lista numerada é uma forma própria: vira lista e volta a numerada com os níveis', () => {
    const e = ed(doc({ type: 'orderedList', content: [li('a'), li('b')] }))
    convertBlock(e.view, 0, 'bullet')
    expect(e.state.doc.firstChild!.type.name).toBe('bulletList')
    convertBlock(e.view, 0, 'ordered')
    expect(e.state.doc.firstChild!.type.name).toBe('orderedList')
    convertBlock(e.view, 0, 'task')
    convertBlock(e.view, 0, 'ordered')
    expect(e.state.doc.firstChild!.type.name).toBe('orderedList')
    expect(e.state.doc.textContent).toBe('ab')
  })
})

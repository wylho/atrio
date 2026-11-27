import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { NodeSelection } from '@tiptap/pm/state'
import { features } from '../src/index'
import { Recorder } from '../src/editor/capture.svelte'
import Harness from './NoteEditorHarness.svelte'
import DialogHarness from './CardDialogHarness.svelte'

// Fotos, arquivos e gravações entrando no card (os dois apps), e fechar o card sem perder o que entrava.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
globalThis.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia
const rect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 })
for (const proto of [Element.prototype, Range.prototype] as unknown as Record<string, unknown>[]) {
  proto.getClientRects ??= () => []
  proto.getBoundingClientRect ??= rect
}

type Ed = {
  editor: () => import('@tiptap/core').Editor | undefined
  json: () => any
  addFiles: (f: { blob: Blob; name: string }[], pos?: number) => Promise<unknown> | undefined
}
const file = () => ({ blob: new Blob(['x'], { type: 'image/png' }), name: 'foto.png' })
const types = (doc: any): string[] => doc.content.map((n: any) => n.type)

async function card(content: string, gate?: () => Promise<void>) {
  const target = document.createElement('div')
  document.body.append(target)
  const app = mount(Harness, { target, props: { features: features(), content, gate } }) as unknown as Ed
  flushSync()
  await new Promise((r) => setTimeout(r, 0))
  return { app, done: () => unmount(app) }
}

describe('anexo entrando no texto', () => {
  it('com uma foto escolhida, a nova entra depois dela (não no lugar)', async () => {
    const { app, done } = await card('<p>antes</p><img data-hash="a1">')
    const ed = app.editor()!
    let at = -1
    ed.state.doc.forEach((n, pos) => n.type.name === 'noteImage' && (at = pos))
    ed.view.dispatch(ed.state.tr.setSelection(NodeSelection.create(ed.state.doc, at)))
    await app.addFiles([file()])
    const images = app.json().content.filter((n: any) => n.type === 'noteImage')
    expect(images.map((n: any) => n.attrs.hash)).toEqual(['a1', 'f0f0f0f0'])
    done()
  })

  it('colado ou solto dentro de uma checklist, entra depois dela, não dentro do item', async () => {
    const { app, done } = await card('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>item um</p></li></ul><p>fim</p>')
    await app.addFiles([file()], 4)
    expect(types(app.json())).toEqual(['taskList', 'noteImage', 'paragraph', 'paragraph'])
    done()
  })

  it('o ponto escolhido acompanha o que se digita enquanto a foto importa', async () => {
    let release!: () => void
    const gate = () => new Promise<void>((r) => (release = r))
    const { app, done } = await card('<p>primeira linha</p><p>segunda</p>', gate)
    const ed = app.editor()!
    const job = app.addFiles([file()], ed.state.doc.content.size - 1) // no fim de "segunda"
    await new Promise((r) => setTimeout(r, 0))
    ed.commands.insertContentAt(1, 'ABCDEFGHIJ ')
    release()
    await job
    const json = app.json()
    expect(json.content[0].content[0].text).toBe('ABCDEFGHIJ primeira linha')
    expect(types(json)).toEqual(['paragraph', 'paragraph', 'noteImage', 'paragraph'])
    done()
  })
})

describe('fechar o card', () => {
  it('Esc só pede para fechar: o card continua na tela até o app tirá-lo', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const onclose = vi.fn()
    const app = mount(DialogHarness, { target, props: { onclose } })
    flushSync()
    const content = document.querySelector('.editor')!
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    await new Promise((r) => setTimeout(r, 50))
    flushSync()
    expect(onclose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.editor')).not.toBeNull()
    unmount(app)
  })
})

describe('gravador', () => {
  class FakeRecorder {
    mimeType = 'audio/webm'
    onstop: (() => void) | null = null
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    start() {}
    stop() {
      setTimeout(() => this.onstop?.(), 5)
    }
  }
  const track = () => ({ stopped: false, stop() { this.stopped = true } })
  function fakeMic(wait?: Promise<void>) {
    const tracks = [track()]
    const stream = { getTracks: () => tracks }
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => (await wait, stream) },
    })
    return tracks
  }

  it('parar duas vezes (o Parar e o fechar do card) devolve a mesma gravação', async () => {
    fakeMic()
    const r = new Recorder()
    await r.start()
    const [a, b] = await Promise.all([r.stop(), r.stop()])
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('cancelar enquanto guarda não perde a gravação', async () => {
    fakeMic()
    const r = new Recorder()
    await r.start()
    const saving = r.stop()
    r.cancel()
    expect(await saving).not.toBeNull()
  })

  it('cancelar enquanto o microfone é pedido desliga o microfone quando ele chegar', async () => {
    let allow!: () => void
    const tracks = fakeMic(new Promise<void>((r) => (allow = r)))
    const r = new Recorder()
    const started = r.start()
    r.cancel()
    allow()
    expect(await started).toBe(false)
    expect(tracks[0].stopped).toBe(true)
    expect(r.recording).toBe(false)
  })
})

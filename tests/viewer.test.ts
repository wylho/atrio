import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { AttachmentViewer } from '../src/viewer'
import type { Attachment } from '../src/index'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

const photo: Attachment = {
  hash: 'ab12', kind: 'image', mime: 'image/webp', name: 'praia.webp', bytes: 600_000, origBytes: 6_000_000,
  width: 2048, height: 1536, palette: ['#112233', '#445566'], tone: 'frio', addedAt: 1,
}

describe('visualizador de anexos, o mesmo nos dois apps', () => {
  it('foto inteira, paleta, quanto o WebP economizou, e baixar', () => {
    const got: string[] = []
    const app = mount(AttachmentViewer, {
      target: document.body,
      props: { att: photo, imageUrl: (h: string) => `full/${h}`, mediaUrl: () => '', onclose: () => {}, ondownload: (a: Attachment) => got.push(a.hash) },
    })
    flushSync()
    expect(document.querySelector('.lb-img')?.getAttribute('src')).toBe('full/ab12')
    expect([...document.querySelectorAll('.lb-pal code')].map((c) => c.textContent)).toEqual(['#112233', '#445566'])
    expect(document.querySelector('.lb-opt .good')?.textContent).toBe('−90%')
    ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Baixar'))!.click()
    expect(got).toEqual(['ab12'])
    unmount(app)
  })

  it('arquivo sem visualização mostra o ícone e o tipo', () => {
    const app = mount(AttachmentViewer, {
      target: document.body,
      props: { att: { ...photo, kind: 'sheet', name: 'contas.xlsx', palette: null, origBytes: null, bytes: 2048 }, imageUrl: () => '', mediaUrl: () => 'x', onclose: () => {}, ondownload: () => {} },
    })
    flushSync()
    expect(document.querySelector('.lb-opt b')?.textContent).toBe('Planilha · 2 KB')
    expect(document.querySelector('.lb-media p')?.textContent).toContain('baixe para abrir')
    unmount(app)
  })
})

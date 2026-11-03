import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { blocksFromMarkdown, CardBody, features } from '../src/index'
import Harness from './NoteEditorHarness.svelte'

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
globalThis.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia

type Ed = { editor: () => import('@tiptap/core').Editor | undefined; json: () => any }

describe('prompt e link na palavra no card aberto', () => {
  it('o prompt e o link entram no documento; o link guarda só o endereço e vai para a lista de links', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const app = mount(Harness, {
      target,
      props: {
        features: features(),
        content: '<p>Revisar <span data-prompt>resuma em 3 tópicos</span> e ver a <a href="https://www.exemplo.com/p">Apresentação</a></p>',
      },
    }) as unknown as Ed
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const p = app.json().content[0].content
    expect(p[1]).toMatchObject({ text: 'resuma em 3 tópicos', marks: [{ type: 'prompt' }] })
    // Só o endereço tem valor: o resto (target, rel, class, title) fica vazio e o Markdown/canon não leva.
    const { href, ...rest } = p[3].marks[0].attrs
    expect(href).toBe('https://www.exemplo.com/p')
    expect(Object.values(rest).every((v) => v == null)).toBe(true)
    expect(target.querySelector('#corpo .ed-prompt')?.textContent).toBe('resuma em 3 tópicos')
    const rows = [...target.querySelectorAll('.ed-links .ed-link-row:not(.add)')].map((r) => r.textContent)
    expect(rows).toEqual(['Apresentaçãoexemplo.com'])

    // O botão Prompt marca a seleção (e desmarca de novo).
    const ed = app.editor()!
    ed.commands.setTextSelection({ from: 1, to: 8 })
    ;(target.querySelector('button[aria-label="Prompt"]') as HTMLButtonElement).click()
    flushSync()
    expect(app.json().content[0].content[0]).toMatchObject({ text: 'Revisar', marks: [{ type: 'prompt' }] })

    // Tirar o link da palavra a tira da lista.
    ed.chain().selectAll().unsetLink().run()
    flushSync()
    expect(target.querySelector('.ed-links')).toBeNull()
    unmount(app as never)
    target.remove()
  })
})

describe('prompt e link no card fechado', () => {
  it('a prévia em Markdown divide o texto em pedaços, como o Rust', () => {
    const [b] = blocksFromMarkdown('Revisar  o orçamento <prompt>resuma em 3 tópicos</prompt> e ver a [Apresentação](https://exemplo.com/p)')
    expect(b).toEqual({
      kind: 'text',
      text: 'Revisar o orçamento resuma em 3 tópicos e ver a Apresentação',
      parts: [
        { text: 'Revisar o orçamento ' },
        { text: 'resuma em 3 tópicos', prompt: true },
        { text: ' e ver a ' },
        { text: 'Apresentação', href: 'https://exemplo.com/p' },
      ],
    })
    // Sem prompt nem link, sem pedaços; o cartão de link e os anexos continuam como eram.
    expect(blocksFromMarkdown('só texto')[0]).toEqual({ kind: 'text', text: 'só texto' })
    expect(blocksFromMarkdown('- [ ] ligar <prompt>pergunte o horário</prompt>')[0]).toMatchObject({ kind: 'task', parts: [{ text: 'ligar ' }, { text: 'pergunte o horário', prompt: true }] })
  })

  it('o card desenha o prompt marcado e o link sublinhado', () => {
    const target = document.createElement('div')
    const app = mount(CardBody, {
      target,
      props: { title: 'Plano', blocks: blocksFromMarkdown('Fazer <prompt>resuma</prompt> com [o site](https://x.y)') },
    })
    flushSync()
    expect(target.querySelector('.pv-prompt')?.textContent).toBe('resuma')
    expect(target.querySelector('.pv-ilink')?.textContent).toBe('o site')
    unmount(app)
  })
})

describe('partsOf (o documento do editor, como projection.rs)', () => {
  it('dá os mesmos pedaços que o Rust', async () => {
    const { partsOf } = await import('../src/index')
    const p = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Revisar  o orçamento ' },
        { type: 'text', text: 'resuma em 3 tópicos', marks: [{ type: 'prompt' }] },
        { type: 'text', text: ' e ver a ' },
        { type: 'text', text: 'Apresentação', marks: [{ type: 'link', attrs: { href: 'https://exemplo.com/p', target: null } }] },
      ],
    }
    expect(partsOf(p)).toEqual([
      { text: 'Revisar o orçamento ' },
      { text: 'resuma em 3 tópicos', prompt: true },
      { text: ' e ver a ' },
      { text: 'Apresentação', href: 'https://exemplo.com/p' },
    ])
    expect(partsOf({ type: 'paragraph', content: [{ type: 'text', text: 'só texto' }] })).toEqual([])
  })
})

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

describe('link na palavra pelo ⌘K', () => {
  it('o link vai para a palavra escolhida, mesmo que a seleção mude enquanto o endereço é pedido', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let app: Ed
    app = mount(Harness, {
      target,
      props: {
        features: features(),
        content: '<p>mandar a apresentação</p>',
        // O diálogo do app tira o foco do editor: no WebKit e no Chromium a seleção do editor muda nesse meio-tempo.
        askText: async () => {
          app.editor()!.commands.setTextSelection(20)
          return 'exemplo.com/apresentacao'
        },
      },
    }) as unknown as Ed
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const ed = app.editor()!
    ed.commands.setTextSelection({ from: 10, to: 22 })
    expect(ed.state.doc.textBetween(10, 22)).toBe('apresentação')
    ;(target.querySelector('button[aria-label="Link na palavra"]') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    flushSync()
    const nodes = app.json().content[0].content
    expect(nodes.map((n: { text: string }) => n.text)).toEqual(['mandar a ', 'apresentação'])
    expect(nodes[1].marks[0].attrs.href).toBe('https://exemplo.com/apresentacao')
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

describe('títulos pelo botão H', () => {
  it('escolher o mesmo tamanho ou Texto volta a texto, mesmo com a seleção passando do título', async () => {
    const { chooseHeading, headingAt } = await import('../src/editor/heading')
    const target = document.createElement('div')
    document.body.append(target)
    const app = mount(Harness, { target, props: { features: features(), content: '<p>Aqui estão os links</p><p>Segunda linha</p>' } }) as unknown as Ed
    flushSync()
    await new Promise((r) => setTimeout(r, 0))
    const ed = app.editor()!
    const kinds = () => app.json().content.map((n: { type: string; attrs?: { level?: number } }) => (n.type === 'heading' ? `h${n.attrs!.level}` : n.type))
    ed.commands.setTextSelection(3)
    chooseHeading(ed, 2)
    expect(kinds()).toEqual(['h2', 'paragraph'])
    // a seleção começa no título e entra na linha de baixo: o título ainda é reconhecido, e o mesmo tamanho desfaz
    ed.commands.setTextSelection({ from: 2, to: 25 })
    expect(headingAt(ed)).toBe(2)
    chooseHeading(ed, 2)
    expect(kinds()).toEqual(['paragraph', 'paragraph'])
    // "Texto" (0) sempre volta, para qualquer tamanho e em todos os blocos da seleção
    ed.chain().selectAll().setHeading({ level: 1 }).run()
    expect(kinds()).toEqual(['h1', 'h1'])
    chooseHeading(ed, 0)
    expect(kinds()).toEqual(['paragraph', 'paragraph'])
    // "Texto" só desfaz títulos: uma lista na seleção continua lista
    ed.commands.setContent('<h2>Links</h2><ul><li><p>um</p></li><li><p>dois</p></li></ul>')
    // seleção de texto do começo ao fim (é o que o Ctrl+A do card faz), não a seleção do documento inteiro
    ed.commands.setTextSelection({ from: 1, to: ed.state.doc.content.size - 1 })
    chooseHeading(ed, 0)
    expect(kinds()).toEqual(['paragraph', 'bulletList'])
    expect(app.json().content[1].content).toHaveLength(2)
    // e sem título nenhum na seleção, "Texto" não mexe em nada (antes desmanchava a lista)
    ed.commands.setTextSelection({ from: 1, to: ed.state.doc.content.size - 1 })
    chooseHeading(ed, 0)
    expect(kinds()).toEqual(['paragraph', 'bulletList'])
    expect(app.json().content[1].content).toHaveLength(2)
    unmount(app as never)
    target.remove()
  })
})

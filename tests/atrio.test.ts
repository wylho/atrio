import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { CardBody, blocksFromMarkdown, cardFromHtml, cardsFromHtml, cardsToClipboard, cardToClipboard, previewFromMarkdown, previewOf } from '../src/index'

describe('prévia de Markdown (as regras do Ideario)', () => {
  it('estrutura, sem formatação, linhas seguidas num parágrafo', () => {
    const md = [
      '## Plano',
      'Primeira linha com **negrito** e [link](https://exemplo.com)',
      'segunda linha',
      '',
      '- Tópico',
      '  - Filho',
      '1. Um',
      '- [x] Feita',
      '- [ ] Aberta',
      '```',
      'código',
      '```',
      '| Arroz | 2 kg |',
      '|---|---|',
    ].join('\n')
    expect(blocksFromMarkdown(md)).toEqual([
      { kind: 'heading', text: 'Plano' },
      { kind: 'text', text: 'Primeira linha com negrito e link\nsegunda linha' },
      { kind: 'bullet', text: 'Tópico', depth: 0 },
      { kind: 'bullet', text: 'Filho', depth: 1 },
      { kind: 'ordered', text: 'Um', n: 1, depth: 0 },
      { kind: 'task', text: 'Feita', done: true, depth: 0 },
      { kind: 'task', text: 'Aberta', done: false, depth: 0 },
      { kind: 'code', text: 'código' },
      { kind: 'table', rows: [['Arroz', '2 kg']], header: true, more: 0, text: 'Arroz · 2 kg' },
    ])
  })

  it('tarefas além de 12 viram "+N itens" logo depois da última mostrada', () => {
    const md = Array.from({ length: 15 }, (_, i) => `- [ ] T${i}`).join('\n') + '\n\nfim'
    const p = previewFromMarkdown(md)
    expect(p.filter((b) => b.kind === 'task')).toHaveLength(12)
    expect(p[12]).toEqual({ kind: 'more', count: 3 })
    expect(p[13]).toEqual({ kind: 'text', text: 'fim' })
  })

  it('para de juntar blocos depois de 24', () => {
    expect(previewOf(Array.from({ length: 40 }, (_, i) => ({ kind: 'text' as const, text: `${i}` })))).toHaveLength(24)
  })
})

describe('card na área de transferência', () => {
  it('ida e volta pelo HTML, com acentos e emoji', () => {
    const card = { title: 'Ideias — lançamento ✨', markdown: '- [ ] Revisar\n- **Prazo**: sexta', color: 'sky' as const, emoji: '🚀', tags: ['beta'] }
    const { html, text } = cardToClipboard(card)
    expect(cardFromHtml(html)).toMatchObject(card)
    expect(text).toBe('# Ideias — lançamento ✨\n\n- [ ] Revisar\n- **Prazo**: sexta')
    // Legível para quem não é do Atrio, e sem HTML do usuário solto.
    expect(cardToClipboard({ title: '<b>x</b>', markdown: '' }).html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('vários cards de uma vez: todos voltam, na ordem, e quem lê um só pega o primeiro', () => {
    const a = { title: 'Feira', markdown: '- Banca', color: 'sky' as const, emoji: null, tags: [] }
    const b = { title: 'Vídeos', markdown: '', emoji: '🎬', tags: ['canal'] }
    const { html, text } = cardsToClipboard([a, b])
    expect(cardsFromHtml(html)).toMatchObject([a, { ...b, color: undefined }])
    expect(cardFromHtml(html)).toMatchObject(a)
    expect(text).toBe('# Feira\n\n- Banca\n\n# Vídeos')
    expect(cardsFromHtml('<p>nada</p>')).toEqual([])
  })

  it('HTML qualquer não é card', () => {
    expect(cardFromHtml('<p>texto</p>')).toBeNull()
    expect(cardFromHtml('<div data-atrio-card="não-é-base64">x</div>')).toBeNull()
  })
})

describe('CardBody', () => {
  it('tabela: as primeiras 8 linhas como tabela, com a de títulos; o resto conta', () => {
    const md = ['| Produto | Preço |', '|---|:--|', ...Array.from({ length: 10 }, (_, i) => `| Item ${i + 1} | R$ ${i} |`), '', 'Fim.'].join('\n')
    const [table, after] = blocksFromMarkdown(md)
    expect(table).toMatchObject({ kind: 'table', header: true, more: 3 })
    expect(table.kind === 'table' && table.rows[0]).toEqual(['Produto', 'Preço'])
    expect(table.kind === 'table' && table.rows).toHaveLength(8)
    expect(table.kind === 'table' && table.text).toContain('Item 10 · R$ 9')
    expect(after).toEqual({ kind: 'text', text: 'Fim.' })
  })

  it('o card fechado mostra só o resumo da tabela (colunas, linhas e os nomes das colunas)', () => {
    const target = document.createElement('div')
    const app = mount(CardBody, { target, props: { title: 'Produtos', blocks: previewFromMarkdown('| A | B |\n|---|---|\n| 1 | 2 |') } })
    flushSync()
    expect(target.querySelector('.pv-table')).toBeNull()
    expect(target.querySelector('.pv-tsum-size')?.textContent).toBe('Tabela · 2 colunas × 1 linha')
    expect(target.querySelector('.pv-tsum-cols')?.textContent).toBe('A · B')
    unmount(app)
  })

  it('o resumo conta as linhas que ficaram de fora da prévia', () => {
    const rows = Array.from({ length: 11 }, (_, i) => `| Item ${i + 1} | R$ ${i} | ok |`).join('\n')
    const target = document.createElement('div')
    const app = mount(CardBody, { target, props: { title: 'Lista', blocks: previewFromMarkdown(`| Produto | Preço | Status |\n|---|---|---|\n${rows}`) } })
    flushSync()
    expect(target.querySelector('.pv-tsum-size')?.textContent).toBe('Tabela · 3 colunas × 11 linhas')
    unmount(app)
  })

  it('tabela sem cabeçalho: só o tamanho, sem nomes de coluna', () => {
    const target = document.createElement('div')
    const blocks = [{ kind: 'table' as const, rows: [['a', 'b'], ['c', 'd']], header: false, more: 0, text: 'a · b\nc · d' }]
    const app = mount(CardBody, { target, props: { title: 'Solta', blocks } })
    flushSync()
    expect(target.querySelector('.pv-tsum-size')?.textContent).toBe('Tabela · 2 colunas × 2 linhas')
    expect(target.querySelector('.pv-tsum-cols')).toBeNull()
    unmount(app)
  })

  it('mostra título, blocos e hashtags com a marcação do card do Ideario', () => {
    const target = document.createElement('div')
    const app = mount(CardBody, { target, props: { title: 'Descoberta', blocks: previewFromMarkdown('- 12 entrevistas #pesquisa\n- [x] Roteiro') } })
    flushSync()
    expect(target.querySelector('.card-body > h3')?.textContent).toBe('Descoberta')
    expect(target.querySelector('.pv-li')?.getAttribute('data-mark')).toBe('•')
    expect(target.querySelector('.hashtag')?.textContent).toBe('#pesquisa')
    expect(target.querySelector('.pv-task.done .box svg')).not.toBeNull()
    unmount(app)
  })
})

describe('anexos na prévia em Markdown (o Nodo)', () => {
  it('a primeira linha de fotos vira a capa; arquivo vira linha com ícone; foto não vira texto', async () => {
    const { coverFromMarkdown } = await import('../src/index')
    const md = [
      'Roteiro da viagem',
      '',
      '![praia.jpg](ideario://att/aaaa1111) ![serra.jpg](ideario://att/bbbb2222)',
      '',
      '[📎 passagens.pdf](ideario://att/cccc3333)',
      '',
      '![depois.jpg](ideario://att/dddd4444)',
    ].join('\n')
    expect(coverFromMarkdown(md)).toEqual(['aaaa1111', 'bbbb2222'])
    expect(coverFromMarkdown('só texto')).toEqual([])
    expect(blocksFromMarkdown(md)).toEqual([
      { kind: 'text', text: 'Roteiro da viagem' },
      { kind: 'file', text: 'passagens.pdf', fileKind: 'pdf', hash: 'cccc3333' },
    ])
  })
})

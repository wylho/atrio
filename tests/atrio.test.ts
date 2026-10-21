import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { CardBody, blocksFromMarkdown, cardFromHtml, cardToClipboard, previewFromMarkdown, previewOf } from '../src/index'

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
      { kind: 'text', text: 'Arroz · 2 kg' },
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
    expect(cardFromHtml(html)).toEqual(card)
    expect(text).toBe('# Ideias — lançamento ✨\n\n- [ ] Revisar\n- **Prazo**: sexta')
    // Legível para quem não é do Atrio, e sem HTML do usuário solto.
    expect(cardToClipboard({ title: '<b>x</b>', markdown: '' }).html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('HTML qualquer não é card', () => {
    expect(cardFromHtml('<p>texto</p>')).toBeNull()
    expect(cardFromHtml('<div data-atrio-card="não-é-base64">x</div>')).toBeNull()
  })
})

describe('CardBody', () => {
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

import { describe, expect, it } from 'vitest'
import { attachCardFiles, CARD_FORMAT, cardFromHtml, cardToClipboard, importCardFiles, type ClipCard } from '../src/index'

const HA = 'a'.repeat(64)
const HB = 'b'.repeat(64)
const blob = (text: string, type = 'image/webp') => new Blob([text], { type })

describe('card na área de transferência, versão 2', () => {
  it('leva lembrete e status de um app para o outro', () => {
    const card: ClipCard = {
      title: 'Consulta',
      markdown: 'Levar os exames',
      reminderAt: Date.UTC(2026, 10, 3, 12),
      reminderRepeat: 'month',
      reminderDone: false,
      reminderDoing: true,
      statusOn: false,
    }
    const back = cardFromHtml(cardToClipboard(card).html)!
    expect(CARD_FORMAT).toBe(2)
    expect(back.reminderAt).toBe(card.reminderAt)
    expect(back.reminderRepeat).toBe('month')
    expect(back.reminderDoing).toBe(true)
    expect(back.reminderDone).toBe(false)
  })

  it('continua lendo a versão 1 (um app que ainda não subiu)', () => {
    const v1 = btoa(JSON.stringify({ atrio: 1, title: 'Antigo', markdown: 'texto', tags: ['a'] }))
    const back = cardFromHtml(`<div data-atrio-card="${v1}"><h3>Antigo</h3></div>`)!
    expect(back).toMatchObject({ title: 'Antigo', markdown: 'texto', tags: ['a'], reminderAt: null, files: [] })
  })

  it('valores estranhos no lembrete e no status não entram', () => {
    const raw = btoa(JSON.stringify({ atrio: 2, title: 'x', reminderAt: 'amanhã', reminderRepeat: 'sempre', statusOn: 'sim', files: [{ hash: 1 }] }))
    const back = cardFromHtml(`<div data-atrio-card="${raw}"></div>`)!
    expect(back.reminderAt).toBeNull()
    expect(back.reminderRepeat).toBeNull()
    expect(back.statusOn).toBe(false)
    expect(back.files).toEqual([])
  })
})

describe('anexos junto com o card', () => {
  const card: ClipCard = {
    title: 'Viagem',
    markdown: `![praia](ideario://att/${HA}) ![praia de novo](ideario://att/${HA})\n\n[📎 roteiro.pdf](ideario://att/${HB})`,
  }

  it('copiar leva os bytes de cada anexo citado (uma vez só), e colar troca o hash pelo que o app devolveu', async () => {
    const fetched: string[] = []
    const { cards, skipped } = await attachCardFiles([card], async (h) => {
      fetched.push(h)
      return h === HA ? blob('foto') : blob('pdf', 'application/pdf')
    })
    expect(skipped).toEqual([])
    expect(fetched).toEqual([HA, HB])
    const files = cards[0].files!
    expect(files.map((f) => [f.hash, f.name, f.mime])).toEqual([
      [HA, 'praia', 'image/webp'],
      [HB, 'roteiro.pdf', 'application/pdf'],
    ])

    // Passa pela área de transferência e volta.
    const pasted = cardFromHtml(cardToClipboard(cards[0]).html)!
    const imported: [string, string][] = []
    const out = await importCardFiles(pasted, async (b, name) => {
      imported.push([name, await b.text()])
      return { hash: name === 'praia' ? 'c'.repeat(64) : HB }
    })
    expect(imported).toEqual([['praia', 'foto'], ['roteiro.pdf', 'pdf']])
    expect(out.markdown).toBe(`![praia](ideario://att/${'c'.repeat(64)}) ![praia de novo](ideario://att/${'c'.repeat(64)})\n\n[📎 roteiro.pdf](ideario://att/${HB})`)
    expect(out.files).toEqual([])
  })

  it('acima do limite vai só o texto, e diz o que ficou de fora', async () => {
    const { cards, skipped } = await attachCardFiles([card], async (h) => (h === HA ? blob('12345') : blob('1234567890')), 8)
    expect(cards[0].files!.map((f) => f.name)).toEqual(['praia'])
    expect(skipped).toEqual(['roteiro.pdf'])
    expect(cards[0].markdown).toBe(card.markdown)
  })

  it('anexo que o app não acha fica só como referência', async () => {
    const { cards, skipped } = await attachCardFiles([card], async () => null)
    expect(cards[0].files).toEqual([])
    expect(skipped).toEqual(['praia', 'roteiro.pdf'])
  })

  it('um arquivo que não entrou no app colado mantém o hash original', async () => {
    const withFile: ClipCard = { ...card, files: [{ hash: HA, name: 'praia', mime: 'image/webp', data: btoa('foto') }] }
    const out = await importCardFiles(withFile, async () => {
      throw new Error('disco cheio')
    })
    expect(out.markdown).toBe(card.markdown)
  })
})

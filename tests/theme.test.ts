import { describe, expect, it } from 'vitest'
import { DESKTOPS, NOTE_COLOR_TOKENS, PALETTES, contrast, cssVars, fitAccent, normalizePaletteId, resolveNoteColor } from '../src/index'

describe('temas do Atrio', () => {
  it('a paleta-base é a Atrio, e os nomes antigos de cada app levam a ela', () => {
    expect(PALETTES.atrio.label).toBe('Atrio')
    for (const old of ['ideario', 'nodo', 'mapist', null, '', 'inventado']) expect(normalizePaletteId(old)).toBe('atrio')
    for (const id of ['system', 'atrio', 'papel', 'grafite', 'floresta']) expect(normalizePaletteId(id)).toBe(id)
  })

  it('todo tema tem as duas versões, com seis cores de nota', () => {
    for (const p of [...Object.values(PALETTES), ...Object.values(DESKTOPS)])
      for (const m of ['light', 'dark'] as const) expect(p[m].notes).toHaveLength(NOTE_COLOR_TOKENS.length)
  })

  it('o destaque do sistema fica legível sobre o fundo', () => {
    const surface = PALETTES.atrio.dark.surface
    expect(contrast(fitAccent('#1a1a40', 'dark', surface), surface)).toBeGreaterThanOrEqual(3)
  })

  it('token de cor de nota vira a cor do tema; outra cor passa direto', () => {
    expect(resolveNoteColor('--n-sky', PALETTES.atrio.light)).toBe(PALETTES.atrio.light.notes[2])
    expect(resolveNoteColor('#123456', PALETTES.atrio.light)).toBe('#123456')
    expect(cssVars(PALETTES.atrio.light, 'light')['--n-sky']).toBe(PALETTES.atrio.light.notes[2])
  })
})

import { describe, expect, it } from 'vitest'
import { addMessages, i18n, setLocale, systemLocale, t, tn } from '../src/index'

describe('idiomas', () => {
  it('o texto em português é a chave; sem tradução, aparece em português', () => {
    addMessages('en', { 'Apagar nota': 'Delete note', 'Editada {quando}': 'Edited {quando}', '{n} nota': '{n} note', '{n} notas': '{n} notes' })
    setLocale('pt-BR')
    expect(t('Apagar nota')).toBe('Apagar nota')
    setLocale('en')
    expect(i18n.locale).toBe('en')
    expect(t('Apagar nota')).toBe('Delete note')
    expect(t('Editada {quando}', { quando: '2 min' })).toBe('Edited 2 min')
    expect(t('Sem tradução ainda')).toBe('Sem tradução ainda')
    expect([tn(1, '{n} nota', '{n} notas'), tn(3, '{n} nota', '{n} notas')]).toEqual(['1 note', '3 notes'])
    expect(document.documentElement.lang).toBe('en')
    setLocale('auto')
  })

  it('automático: português para qualquer português, inglês para o resto', () => {
    expect(systemLocale(['pt-PT'])).toBe('pt-BR')
    expect(systemLocale(['fr-FR', 'pt-BR'])).toBe('pt-BR')
    expect(systemLocale(['es-ES', 'en-US'])).toBe('en')
    expect(systemLocale([])).toBe('en')
  })
})

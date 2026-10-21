import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { Editor } from '@tiptap/core'
import { ALL_FEATURES, TagInput, features, fmtBytes, nextOccurrence, normalizeTag, setNotifier, say } from '../src/index'
import { noteExtensions } from '../src/editor'

describe('chaves do card', () => {
  it('liga tudo menos o que o app desligar', () => {
    const nodo = features({ category: false })
    expect(nodo.category).toBe(false)
    expect(nodo.tags && nodo.reminder && nodo.status && nodo.attachments).toBe(true)
    expect(features()).toEqual(ALL_FEATURES)
  })
})

describe('utilidades', () => {
  it('datas, tamanhos e etiquetas como no Ideario', () => {
    expect(fmtBytes(1536 * 1024)).toBe('1,5 MB')
    expect(normalizeTag('  #Lista de Compras ')).toBe('lista-de-compras')
    const jan31 = new Date(2026, 0, 31, 9).getTime()
    // Mês conta da data original: 31/jan → 28/fev → 31/mar.
    expect(new Date(nextOccurrence(jan31, 'month', new Date(2026, 1, 1).getTime())).getDate()).toBe(28)
    expect(new Date(nextOccurrence(jan31, 'month', new Date(2026, 1, 28, 12).getTime())).getDate()).toBe(31)
    const leap = new Date(2028, 1, 29, 9).getTime()
    expect(new Date(nextOccurrence(leap, 'year', leap + 1)).toDateString()).toBe(new Date(2029, 1, 28, 9).toDateString())
  })

  it('o aviso vai para o app que ligou o seu', () => {
    const got: string[] = []
    setNotifier((m) => got.push(m))
    say('Sem acesso ao microfone')
    expect(got).toEqual(['Sem acesso ao microfone'])
  })
})

describe('TagInput', () => {
  it('sugere as etiquetas que o app passa, sem as que a nota já tem', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    const picked: string[] = []
    const app = mount(TagInput, {
      target,
      props: { exclude: ['casa'], known: [{ name: 'casa', count: 3 }, { name: 'mercado', count: 2 }], onpick: (t: string) => picked.push(t) },
    })
    flushSync()
    const input = target.querySelector('input')!
    input.dispatchEvent(new FocusEvent('focus'))
    flushSync()
    const options = [...target.querySelectorAll('[role=option]')].map((o) => o.textContent?.trim())
    expect(options).toEqual(['mercado2'])
    unmount(app)
  })
})

describe('editor', () => {
  it('as extensões do Ideario montam um editor com tarefas e tabela', () => {
    const el = document.createElement('div')
    const ed = new Editor({ element: el, extensions: noteExtensions({ placeholder: 'Escreva…' }), content: '<p>oi</p>' })
    ed.commands.toggleTaskList()
    expect(ed.getJSON().content?.[0]?.type).toBe('taskList')
    ed.commands.insertTable({ rows: 2, cols: 2 })
    expect(JSON.stringify(ed.getJSON())).toContain('"table"')
    ed.destroy()
  })
})

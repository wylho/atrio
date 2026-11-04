/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { atrioOptimizeDeps } from '../src/vite.js'

/** O código do Atrio, arquivo por arquivo. */
const sources = import.meta.glob('../src/**/*.{ts,svelte,js}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Os pacotes de fora que o código do Atrio importa (`from '…'` que não começa com ponto). */
function imports(): Set<string> {
  const out = new Set<string>()
  for (const code of Object.values(sources)) for (const m of code.matchAll(/from '([^'.][^']*)'/g)) out.add(m[1])
  return out
}

describe('Vite dos apps (o Atrio vem como código-fonte)', () => {
  it('o Atrio fica fora do pré-empacotamento, e todo o editor que ele usa entra junto, numa leva só', () => {
    const deps = atrioOptimizeDeps()
    expect(deps.exclude).toContain('@wylho/atrio')
    // Uma peça do TipTap ou do ProseMirror fora da lista vem crua e traz uma segunda cópia do ProseMirror no `npm run
    // dev` ("Adding different instances of a keyed plugin"): o editor quebra só na prévia do navegador.
    const editor = [...imports()].filter((m) => /^(@tiptap\/|prosemirror-|yjs$|y-)/.test(m))
    expect(editor.length).toBeGreaterThan(5)
    for (const m of editor) expect(deps.include, m).toContain(m)
  })

  it('o app pode somar os pacotes dele', () => {
    const deps = atrioOptimizeDeps({ include: ['jspdf'], exclude: ['@tauri-apps/api'] })
    expect(deps.include).toContain('jspdf')
    expect(deps.include).toContain('@tiptap/core')
    expect(deps.exclude).toEqual(['@wylho/atrio', '@tauri-apps/api'])
  })
})

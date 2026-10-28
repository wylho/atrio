import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { CardSession, cardOpen } from '../src/index'
import DialogHarness from './CardDialogHarness.svelte'

describe('CardSession', () => {
  it('fecha na ordem: espera os arquivos (e a gravação), salva e só então avisa o app', async () => {
    const steps: string[] = []
    let finishRecording!: () => void
    const recording = new Promise<void>((r) => (finishRecording = r))
    const s = new CardSession({
      settle: async () => {
        steps.push('settle:start')
        await recording
        steps.push('settle:end')
      },
      save: () => void steps.push('save'),
      onclose: () => void steps.push('close'),
    })
    const closing = s.close()
    await Promise.resolve()
    // A gravação ainda não terminou: nada foi salvo, o card continua aberto.
    expect(steps).toEqual(['settle:start'])
    expect(s.closing).toBe(true)
    finishRecording()
    expect(await closing).toBe(true)
    expect(steps).toEqual(['settle:start', 'settle:end', 'save', 'close'])
  })

  it('fechar duas vezes (Esc e o botão de voltar juntos) fecha uma vez só', async () => {
    let closed = 0
    const s = new CardSession({ onclose: () => void closed++ })
    const [a, b] = await Promise.all([s.close(), s.close()])
    expect([a, b]).toEqual([true, false])
    expect(closed).toBe(1)
  })

  it('se não salvou, o card continua aberto e dá para tentar de novo', async () => {
    let ok = false
    let closed = 0
    const s = new CardSession({ save: async () => ok, onclose: () => void closed++ })
    expect(await s.close()).toBe(false)
    expect(closed).toBe(0)
    expect(s.closing).toBe(false)
    ok = true
    expect(await s.close()).toBe(true)
    expect(closed).toBe(1)
  })
})

describe('cardOpen', () => {
  it('vale enquanto um CardDialog está na tela (os atalhos do app param atrás do card)', () => {
    expect(cardOpen()).toBe(false)
    const target = document.createElement('div')
    document.body.append(target)
    const a = mount(DialogHarness, { target })
    const b = mount(DialogHarness, { target })
    flushSync()
    expect(cardOpen()).toBe(true)
    unmount(a)
    flushSync()
    // Ainda há um aberto (um card abrindo enquanto o outro fecha).
    expect(cardOpen()).toBe(true)
    unmount(b)
    flushSync()
    expect(cardOpen()).toBe(false)
    target.remove()
  })
})

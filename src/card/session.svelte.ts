// A sessão do card aberto, a mesma nos dois apps: fechar espera a gravação e os arquivos que ainda estão entrando
// (`NoteEditor.settle`), salva e só então some. E um sinal de "há um card aberto" para os atalhos do app pararem
// atrás dele (⌘W não fecha a aba do mapa, ⌘N não cria nota com o card na frente).

let open = $state(0)

/** Há um card aberto (um `CardDialog` na tela). Os atalhos e o copiar/colar do app param enquanto valer. */
export function cardOpen(): boolean {
  return open > 0
}

/** O `CardDialog` chama ao aparecer; a função devolvida, ao sumir. */
export function trackCardOpen(): () => void {
  open++
  let done = false
  return () => {
    if (done) return
    done = true
    open--
  }
}

export type CardSessionOptions = {
  /** Espera a gravação e os arquivos que ainda entram (normalmente `card?.settle()`). */
  settle?: () => Promise<unknown> | undefined
  /** Salva o que faltar. `false` = não salvou: o card continua aberto. */
  save?: () => Promise<boolean | void> | boolean | void
  /** Tira o card da tela (o app). */
  onclose: () => void
}

/** Fechar o card na ordem certa: esperar, salvar, sumir. Fechar duas vezes ao mesmo tempo fecha uma só. */
export class CardSession {
  closing = $state(false)
  #o: CardSessionOptions

  constructor(o: CardSessionOptions) {
    this.#o = o
  }

  /** Devolve se fechou (falso quando já estava fechando ou quando não salvou). */
  async close(): Promise<boolean> {
    if (this.closing) return false
    this.closing = true
    try {
      await this.#o.settle?.()
      if ((await this.#o.save?.()) === false) {
        this.closing = false
        return false
      }
    } catch (e) {
      this.closing = false
      throw e
    }
    this.#o.onclose()
    return true
  }
}

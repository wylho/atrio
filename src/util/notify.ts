// Aviso curto (toast) do app que usa o Atrio. Cada app liga o seu na partida: `setNotifier((m) => app.say(m))`.
let notifier: (msg: string) => void = (msg) => console.warn(msg)

export function setNotifier(fn: (msg: string) => void) {
  notifier = fn
}

/** Mostra um aviso pelo app (ou no console, se o app não ligou nenhum). */
export function say(msg: string) {
  notifier(msg)
}

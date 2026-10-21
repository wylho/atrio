// O editor de texto do card (TipTap), em `@wylho/atrio/editor`: separado do pacote principal porque traz o TipTap e
// o Yjs, que só quem edita a nota precisa carregar.

export * from './blocks'
export * from './extensions'
export * from './link'
export * from './media'
export * from './capture.svelte'

// O card inteiro, editável (precisa do TipTap): o app põe em volta a janela e o jeito de guardar.
export { default as NoteEditor } from '../card/NoteEditor.svelte'

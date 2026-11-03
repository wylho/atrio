// Prompt: um trecho do texto marcado como instrução para a IA (e para os agentes pelo MCP), no meio da frase, como um
// negrito. Na tela aparece entre colchetes, com fundo suave (os colchetes são do CSS, não do texto); no Markdown é
// `<prompt>…</prompt>` (`atrio::markdown`).
import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    prompt: {
      /** Marca ou desmarca a seleção como prompt. */
      togglePrompt: () => ReturnType
    }
  }
}

export const Prompt = Mark.create({
  name: 'prompt',
  parseHTML() {
    return [{ tag: 'span[data-prompt]' }, { tag: 'prompt' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-prompt': '', class: 'ed-prompt' }), 0]
  },
  addCommands() {
    return { togglePrompt: () => ({ commands }) => commands.toggleMark(this.name) }
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-p': () => this.editor.commands.togglePrompt() }
  },
})

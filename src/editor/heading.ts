// Títulos da barra de formatação (o botão H): o tamanho de título do bloco onde a seleção começa, e escolher um tamanho.
// Escolher o tamanho que já está marcado volta a texto, e "Texto" sempre volta: assim dá para desfazer um título
// mesmo com a seleção passando do título para o bloco de baixo (antes o editor não via o título e não desfazia).
import type { Editor } from '@tiptap/core'

export type HeadingLevel = 1 | 2 | 3

/** Tamanho do título do bloco onde a seleção começa (0 = não é título). */
export function headingAt(editor: Editor | null | undefined): HeadingLevel | 0 {
  const node = editor?.state.selection.$from.parent
  return node?.type.name === 'heading' ? ((node.attrs.level as HeadingLevel) ?? 0) : 0
}

/** Aplica o tamanho escolhido (0 = texto). O mesmo tamanho de novo volta a texto. */
export function chooseHeading(editor: Editor, level: HeadingLevel | 0) {
  if (level === 0 || headingAt(editor) === level) toText(editor)
  else editor.chain().focus().setHeading({ level }).run()
}

/** Volta a texto só os títulos da seleção (e o do bloco onde ela começa): listas, citações e o resto ficam como estão. */
function toText(editor: Editor) {
  const { state } = editor
  const { $from, to } = state.selection
  const paragraph = state.schema.nodes.paragraph
  const tr = state.tr
  state.doc.nodesBetween(Math.max(0, $from.start() - 1), Math.max(to, $from.end()), (node, pos) => {
    if (node.type.name !== 'heading') return true
    tr.setNodeMarkup(pos, paragraph)
    return false
  })
  if (tr.docChanged) editor.view.dispatch(tr)
  editor.commands.focus()
}

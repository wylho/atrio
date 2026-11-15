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
  const chain = editor.chain().focus()
  if (level === 0 || headingAt(editor) === level) chain.setParagraph().run()
  else chain.setHeading({ level }).run()
}

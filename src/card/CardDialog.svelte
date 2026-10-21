<script lang="ts">
  // A janela do card aberto, a mesma em todos os apps: no celular ocupa a tela, na janela larga é um diálogo um pouco
  // maior que o card, e o modo documento (`doc`) leva a página inteira, com coluna de leitura. O conteúdo é o
  // `NoteEditor` do app (com a barra do topo dele).
  import type { Snippet } from 'svelte'
  import { Dialog } from 'bits-ui'
  import type { NoteColor } from './types'

  let {
    color = 'none',
    doc = false,
    onclose,
    children,
  }: {
    color?: NoteColor
    /** Modo documento (página inteira). O app decide quando vale (o Ideario: só na janela larga). */
    doc?: boolean
    onclose: () => void
    children: Snippet
  } = $props()
</script>

<Dialog.Root open onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay ed-overlay" />
    <Dialog.Content
      class="editor c-{color}"
      data-doc={doc ? '' : undefined}
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

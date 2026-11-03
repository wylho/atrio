<script lang="ts">
  // A janela do card aberto, a mesma em todos os apps: no celular ocupa a tela, na janela larga é um diálogo um pouco
  // maior que o card, e o modo documento (`doc`) leva a página inteira, com coluna de leitura. O conteúdo é o
  // `NoteEditor` do app (com a barra do topo dele).
  import { onMount, type Snippet } from 'svelte'
  import { Dialog } from 'bits-ui'
  import type { NoteColor } from './types'
  import { trackCardOpen } from './session.svelte'

  let {
    color = 'none',
    doc = false,
    window: own = false,
    onclose,
    children,
  }: {
    color?: NoteColor
    /** Modo documento (página inteira). O app decide quando vale (o Ideario: só na janela larga). */
    doc?: boolean
    /** O card numa janela só dele ("Abrir em nova janela"): ocupa a janela inteira, sem o escuro atrás. */
    window?: boolean
    onclose: () => void
    children: Snippet
  } = $props()

  // Enquanto o card está na tela, `cardOpen()` vale: os atalhos do app param atrás dele.
  onMount(() => trackCardOpen())
</script>

<Dialog.Root open onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    {#if !own}<Dialog.Overlay class="overlay ed-overlay" />{/if}
    <Dialog.Content
      class="editor c-{color}"
      data-doc={doc ? '' : undefined}
      data-window={own ? '' : undefined}
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      {@render children()}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<script lang="ts">
  // Um app de mentira em volta do card, para os testes: meta em $state, anfitrião mínimo.
  import { NoteEditor } from '../src/editor'
  import { emptyMeta, type CardFeatures } from '../src/index'

  let { features, content, onbody }: { features: CardFeatures; content: unknown; onbody?: (text: string) => void } = $props()
  const meta = $state(emptyMeta({ title: 'Plano' }))
  let card: NoteEditor | undefined = $state()

  export function type(text: string) {
    card?.getEditor()?.commands.insertContentAt(card.getEditor()!.state.doc.content.size - 1, text)
  }
</script>

<NoteEditor
  bind:this={card}
  {meta}
  {features}
  {content}
  host={{ tags: () => [{ name: 'casa', count: 2 }], categories: () => [{ id: 'c1', name: 'Trabalho', color: '#36c' }] }}
  onbody={(ed) => onbody?.(ed.getText())}
/>

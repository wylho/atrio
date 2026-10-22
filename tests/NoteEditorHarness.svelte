<script lang="ts">
  // Um app de mentira em volta do card, para os testes: meta em $state, anfitrião mínimo.
  import { NoteEditor } from '../src/editor'
  import { emptyMeta, type CardFeatures } from '../src/index'

  let { features, content, onbody }: { features: CardFeatures; content: unknown; onbody?: (text: string) => void } = $props()
  const meta = $state(emptyMeta({ title: 'Plano' }))
  let card: NoteEditor | undefined = $state()

  export function addFiles(files: { blob: Blob; name: string }[]) {
    card?.addFiles(files)
  }

  export function json() {
    return card?.getEditor()?.getJSON()
  }

  export function caretAtEnd() {
    const ed = card?.getEditor()
    ed?.commands.setTextSelection(ed.state.doc.content.size - 2)
  }

  export function type(text: string) {
    card?.getEditor()?.commands.insertContentAt(card.getEditor()!.state.doc.content.size - 1, text)
  }
</script>

<NoteEditor
  bind:this={card}
  {meta}
  {features}
  {content}
  host={{
    tags: () => [{ name: 'casa', count: 2 }],
    categories: () => [{ id: 'c1', name: 'Trabalho', color: '#36c' }],
    importFile: async (_blob, name) => ({
      hash: 'f0f0f0f0', name, mime: 'image/png', kind: 'image', bytes: 3, origBytes: null,
      width: null, height: null, palette: null, tone: null, addedAt: 0,
    }),
  }}
  onbody={(ed) => onbody?.(ed.getText())}
/>

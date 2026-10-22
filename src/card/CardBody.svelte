<script lang="ts">
  // Corpo do card de nota: emoji, título, a prévia estruturada e a linha de pílulas. É o miolo do card do Ideario,
  // agora num lugar só: o Ideario põe em volta a capa, o alfinete e a seleção; o Nodo põe o card no lugar do nó.
  import type { Snippet } from 'svelte'
  import { Check, Link2 } from '@lucide/svelte'
  import { tn } from '../i18n.svelte'
  import { watchClip } from './clip'
  import { withHashtags } from './hashtags'
  import { FILE_ICONS } from './icons'
  import type { PreviewBlock } from './types'

  let {
    title = '',
    emoji = null,
    blocks,
    /** Linha de cada anexo; sem ela, o ícone do tipo e o nome. */
    file,
    /** Pílulas do fim do card (lembrete, categoria, etiquetas…). */
    meta,
    /** O que o app põe entre a prévia e as pílulas (o Ideario: o nome do arquivo de uma nota que é só um anexo). */
    children,
  }: {
    title?: string
    emoji?: string | null
    blocks: PreviewBlock[]
    file?: Snippet<[Extract<PreviewBlock, { kind: 'file' }>]>
    meta?: Snippet
    children?: Snippet
  } = $props()
</script>

{#snippet rich(text: string)}{#each withHashtags(text) as s, i (i)}{#if s.tag}<span class="hashtag">{s.text}</span>{:else}{s.text}{/if}{/each}{/snippet}

<div class="card-body">
  {#if emoji}<div class="card-emoji" aria-hidden="true">{emoji}</div>{/if}
  {#if title}<h3>{title}</h3>{/if}
  {#if blocks.length}
    <!-- Prévia na ordem e na estrutura do documento. -->
    <div
      class="preview"
      class:big={!title && blocks.length === 1 && blocks[0].kind === 'text'}
      {@attach (el) => (void blocks, watchClip(el))}
    >
      {#each blocks as b, i (i)}
        {#if b.kind === 'more'}
          <p class="pv-more">{tn(b.count, '+{n} item', '+{n} itens')}</p>
        {:else if b.kind === 'task'}
          <p class="pv-task" class:done={b.done} style:--depth={b.depth}>
            <span class="box">{#if b.done}<Check size={10} strokeWidth={3} />{/if}</span><span>{@render rich(b.text)}</span>
          </p>
        {:else if b.kind === 'file'}
          {#if file}{@render file(b)}{:else}
            {@const Icon = FILE_ICONS[b.fileKind]}
            <p class="pv-file"><Icon size={14} /><span>{b.text}</span></p>
          {/if}
        {:else if b.kind === 'link'}
          <p class="pv-link"><Link2 size={14} /><span class="pv-link-t">{b.text}</span><span class="pv-link-s">{b.site}</span></p>
        {:else if b.kind === 'code'}
          <pre class="pv-code">{b.text}</pre>
        {:else if b.kind === 'bullet' || b.kind === 'ordered'}
          <p class="pv-li" style:--depth={b.depth} data-mark={b.kind === 'ordered' ? `${b.n}.` : '•'}>{@render rich(b.text)}</p>
        {:else}
          <p class={b.kind === 'heading' ? 'pv-h' : 'pv-p'}>{@render rich(b.text)}</p>
        {/if}
      {/each}
    </div>
  {/if}
  {@render children?.()}
  {#if meta}<div class="card-meta">{@render meta()}</div>{/if}
</div>

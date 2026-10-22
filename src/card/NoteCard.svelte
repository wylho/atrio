<script lang="ts">
  // O card de nota inteiro, como aparece na lista do Ideario e no mapa do Nodo: a moldura (cor, seleção), a capa (a
  // primeira foto ou a primeira linha de fotos, na proporção de cada uma, com "+N"), a nota que é só um anexo (a
  // miniatura quadrada do arquivo), o miolo (`CardBody`) e as pílulas (`CardPills`). Um componente só para todos os
  // apps: o que cada app faz ao abrir, marcar, fixar ou mudar o status chega pelas funções; o resto das propriedades
  // (o gatilho de um `ContextMenu`, `style`, `data-*`) vai para a moldura.
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { Check, Pin, PinOff } from '@lucide/svelte'
  import CardBody from './CardBody.svelte'
  import CardPills from './CardPills.svelte'
  import { FILE_ICONS } from './icons'
  import type { AttachmentKind, ReminderStatus } from '../types'
  import type { CardSummary, CoverPhoto } from './types'

  let {
    card,
    thumb,
    fileThumb,
    category = null,
    selected = false,
    selecting = false,
    label,
    class: extra = '',
    onopen,
    onselect,
    onpin,
    onstatus,
    ontag,
    oncategory,
    children,
    ...rest
  }: {
    card: CardSummary
    /** Endereço da miniatura de uma foto. */
    thumb: (hash: string) => string
    /** Prévia de um PDF ou vídeo (primeira página, um quadro); vazio = só o ícone. */
    fileThumb?: (hash: string, kind: AttachmentKind) => string
    category?: { name: string; color: string } | null
    selected?: boolean
    /** Há seleção múltipla em andamento: o clique marca em vez de abrir. */
    selecting?: boolean
    label?: string
    class?: string
    /** Abrir o card (o gesto é do app: um clique no Ideario, duplo clique no Nodo). */
    onopen?: (e: MouseEvent | KeyboardEvent) => void
    /** Marcar ou desmarcar (seleção múltipla); sem ela, o card não tem a marca. */
    onselect?: (e: MouseEvent | KeyboardEvent) => void
    /** Fixar ou desafixar; sem ela, o card não tem o alfinete. */
    onpin?: () => void
    onstatus?: (to: ReminderStatus) => void
    ontag?: (tag: string) => void
    oncategory?: () => void
    /** Depois do miolo (o app acrescenta o que é dele). */
    children?: Snippet
  } & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> = $props()

  // Nota que é só um anexo (um áudio, um PDF…): o card vira a miniatura quadrada do arquivo, como na visão Arquivos.
  const solo = $derived(
    !card.cover.length && card.preview.length === 1 && card.preview[0].kind === 'file' ? card.preview[0] : null,
  )
  const hasMeta = $derived(
    card.reminderAt != null || card.statusOn || !!category || card.tags.length > 0 || (card.fileCount > 0 && !solo),
  )
  const ratio = (c: CoverPhoto) => (c.width && c.height ? c.width / c.height : 16 / 10)
  let failed = $state('')
  const soloThumb = $derived(solo && fileThumb && (solo.fileKind === 'pdf' || solo.fileKind === 'video') ? fileThumb(solo.hash, solo.fileKind) : '')

  // Com seleção ativa, tocar no card marca ou desmarca; Ctrl/⌘+clique e Shift+clique também, como numa pasta.
  function activate(e: MouseEvent | KeyboardEvent) {
    if (onselect && (selecting || e.shiftKey || e.ctrlKey || e.metaKey)) onselect(e)
    else onopen?.(e)
  }
</script>

{#snippet pills()}
  <CardPills
    reminderAt={card.reminderAt}
    reminderRepeat={card.reminderRepeat}
    reminderDone={card.reminderDone}
    reminderDoing={card.reminderDoing}
    statusOn={card.statusOn}
    {category}
    fileCount={solo ? 0 : card.fileCount}
    tags={card.tags}
    {oncategory}
    {ontag}
    {onstatus}
  />
{/snippet}

<div
  {...rest}
  class="card c-{card.color} {extra}"
  class:selected
  onclick={activate}
  onkeydown={(e) => e.key === 'Enter' && e.target === e.currentTarget && activate(e)}
  tabindex="0"
  role="button"
  aria-label={label ?? card.title}
>
  {#if onselect}
    <!-- Só com mouse por cima (ou já selecionada): marcar para seleção múltipla. -->
    <button
      class="card-check"
      aria-label={selected ? 'Desmarcar nota' : 'Selecionar nota'}
      aria-pressed={selected}
      onclick={(e) => {
        e.stopPropagation()
        onselect(e)
      }}><Check size={11} strokeWidth={3.2} /></button
    >
  {/if}
  {#if onpin && !selecting}
    <button
      class="card-pin"
      aria-label={card.pinned ? 'Desafixar' : 'Fixar'}
      title={card.pinned ? 'Desafixar' : 'Fixar'}
      onclick={(e) => {
        e.stopPropagation()
        onpin()
      }}
    >
      {#if card.pinned}<PinOff size={16} />{:else}<Pin size={16} />{/if}
    </button>
  {/if}
  {#if card.cover.length}
    <!-- Uma foto, ou a primeira linha de fotos lado a lado: mesma altura, larguras pela proporção de cada uma. -->
    <div class="card-media" class:row={card.cover.length > 1}>
      {#each card.cover as c (c.hash)}
        <img src={thumb(c.hash)} alt="" style:aspect-ratio={ratio(c)} style:flex-grow={ratio(c)} decoding="async" />
      {/each}
      {#if card.imageCount > card.cover.length}<span class="more">+{card.imageCount - card.cover.length}</span>{/if}
    </div>
  {/if}
  {#if solo}
    {@const Icon = FILE_ICONS[solo.fileKind]}
    <div class="card-file t-{solo.fileKind}">
      <Icon size={34} strokeWidth={1.6} />
      {#if soloThumb && failed !== soloThumb}
        <img
          class="file-preview"
          class:video={solo.fileKind === 'video'}
          src={soloThumb}
          alt=""
          decoding="async"
          onerror={() => (failed = soloThumb)}
        />
      {/if}
    </div>
  {/if}
  <CardBody title={card.title} emoji={card.emoji} blocks={solo ? [] : card.preview} meta={hasMeta ? pills : undefined}>
    {#if solo}<p class="card-file-name">{solo.text}</p>{/if}
    {@render children?.()}
  </CardBody>
</div>

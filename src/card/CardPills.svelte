<script lang="ts">
  // As pílulas do fim do card (lembrete ou status, categoria, anexos, etiquetas), as mesmas em todos os apps. Vão no
  // `meta` do `CardBody`. Os cliques são do app (o Ideario filtra pela categoria ou pela etiqueta); sem eles, as
  // pílulas são só texto.
  import { Bell, Paperclip, Repeat } from '@lucide/svelte'
  import { fmtReminder, isOverdue } from '../util/format'
  import { STATUS, statusOf } from './meta'
  import type { Millis, RepeatKind } from '../types'

  let {
    reminderAt = null,
    reminderRepeat = null,
    reminderDone = false,
    reminderDoing = false,
    statusOn = false,
    category = null,
    fileCount = 0,
    tags = [],
    oncategory,
    ontag,
  }: {
    reminderAt?: Millis | null
    reminderRepeat?: RepeatKind | null
    reminderDone?: boolean
    reminderDoing?: boolean
    statusOn?: boolean
    category?: { name: string; color: string } | null
    fileCount?: number
    tags?: string[]
    oncategory?: () => void
    ontag?: (tag: string) => void
  } = $props()

  const n = $derived({ reminderAt, reminderDone, reminderDoing })
</script>

{#if reminderAt != null}
  <span class="pill" class:late={isOverdue(n)} class:done={reminderDone} class:doing={reminderDoing && !reminderDone}><Bell size={11} />{fmtReminder(reminderAt)}{#if reminderRepeat}<Repeat size={11} aria-label="se repete" />{/if}</span>
{:else if statusOn}
  {@const st = statusOf(n)}
  <span class="pill"><i class="dot" style:background={STATUS[st].color}></i>{STATUS[st].label}</span>
{/if}
{#if category}
  {#if oncategory}
    <button class="pill cat" title="Filtrar por {category.name}" onclick={(e) => { e.stopPropagation(); oncategory() }}>
      <i class="dot" style:background={category.color}></i>{category.name.split(' ')[0]}
    </button>
  {:else}
    <span class="pill cat"><i class="dot" style:background={category.color}></i>{category.name.split(' ')[0]}</span>
  {/if}
{/if}
{#if fileCount}<span class="pill"><Paperclip size={11} />{fileCount}</span>{/if}
{#each tags as t (t)}
  {#if ontag}
    <button class="pill tag" onclick={(e) => { e.stopPropagation(); ontag(t) }}>#{t}</button>
  {:else}
    <span class="pill tag">#{t}</span>
  {/if}
{/each}

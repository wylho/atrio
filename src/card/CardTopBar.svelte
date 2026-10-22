<script lang="ts">
  // A barra do topo do card aberto, a mesma nos dois apps: voltar, o rótulo (o app diz o que é: "Editada há 2 min",
  // "Tópico"…), modo documento (só na janela larga), fixar (quando o app tem), lembrete e o menu ⋮ com Status e Emoji
  // de capa. O que é de cada app entra no menu pelos snippets: `menuStart` (antes de Status, ex.: Exportar) e
  // `menuEnd` (depois do emoji, ex.: Arquivar, Lixeira, Apagar tópico). `menu` troca o menu inteiro (nota na lixeira).
  // Vai no snippet `top` do `NoteEditor`; `card` é o próprio `NoteEditor` (lembrete, status, emoji passam por ele).
  import type { Snippet } from 'svelte'
  import { DropdownMenu } from 'bits-ui'
  import { ArrowLeft, BookOpen, Check, ChevronRight, CircleDashed, Minimize2, MoreVertical, Pin, PinOff, SmilePlus } from '@lucide/svelte'
  import ReminderPopover from '../ui/ReminderPopover.svelte'
  import { t } from '../i18n.svelte'
  import { hasStatus, STATUS, statusOf, type CardMeta } from './meta'
  import type { Millis, ReminderStatus } from '../types'

  /** O que a barra pede ao card aberto (o `NoteEditor`). */
  interface CardActions {
    reminder: (at: Millis | null) => void
    status: (to: ReminderStatus | 'none') => void
    chooseEmoji: () => void
  }

  let {
    meta,
    card,
    onback,
    backLabel,
    label,
    wide = false,
    docMode = false,
    ondoc,
    pinned = false,
    onpin,
    menuStart,
    menuEnd,
    menu,
  }: {
    meta: CardMeta
    card: CardActions | undefined
    onback: () => void
    backLabel?: string
    /** O rótulo ao lado de voltar. */
    label?: Snippet
    /** Janela larga: mostra o botão do modo documento (na estreita o card já ocupa a tela). */
    wide?: boolean
    docMode?: boolean
    ondoc?: () => void
    pinned?: boolean
    /** Fixar ou desafixar; sem ela, não há o botão. */
    onpin?: () => void
    menuStart?: Snippet
    menuEnd?: Snippet
    menu?: Snippet
  } = $props()
</script>

<div class="ed-top">
  <button class="icon-btn" aria-label={backLabel ?? t('Voltar')} onclick={onback}><ArrowLeft size={20} /></button>
  <span class="ed-saved">{@render label?.()}</span>
  {#if wide && ondoc}<button
      class="icon-btn"
      aria-pressed={docMode}
      aria-label={docMode ? t('Voltar ao card') : t('Abrir como documento')}
      title={docMode ? t('Voltar ao card') : t('Abrir como documento (página inteira)')}
      onclick={ondoc}
    >
      {#if docMode}<Minimize2 size={19} />{:else}<BookOpen size={19} />{/if}
    </button>{/if}
  {#if onpin}
    <button class="icon-btn" aria-label={pinned ? t('Desafixar') : t('Fixar')} aria-pressed={pinned} onclick={onpin}>
      {#if pinned}<PinOff size={19} />{:else}<Pin size={19} />{/if}
    </button>
  {/if}
  <ReminderPopover
    value={meta.reminderAt}
    repeat={meta.reminderRepeat}
    onchange={(v) => card?.reminder(v)}
    onrepeat={(r) => (meta.reminderRepeat = r)}
  />
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="icon-btn" aria-label={t('Mais opções')}><MoreVertical size={19} /></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="menu" align="end" sideOffset={6}>
        {#if menu}
          {@render menu()}
        {:else}
          {@render menuStart?.()}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger class="menu-item"><CircleDashed size={16} /><span class="grow">{t('Status')}</span><ChevronRight size={16} /></DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="menu" sideOffset={4}>
              {#each ['todo', 'doing', 'done'] as const as st (st)}
                <DropdownMenu.Item class="menu-item" onSelect={() => card?.status(st)}>
                  <i class="menu-swatch" style:background={STATUS[st].color}></i><span class="grow">{t(STATUS[st].label)}</span>
                  {#if hasStatus(meta) && statusOf(meta) === st}<span class="menu-check"><Check size={15} /></span>{/if}
                </DropdownMenu.Item>
              {/each}
              {#if meta.statusOn && meta.reminderAt == null}
                <DropdownMenu.Separator class="menu-sep" />
                <DropdownMenu.Item class="menu-item" onSelect={() => card?.status('none')}><span class="grow">{t('Sem status')}</span></DropdownMenu.Item>
              {/if}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Item class="menu-item" onSelect={() => card?.chooseEmoji()}><SmilePlus size={16} />{meta.emoji ? t('Mudar emoji de capa') : t('Emoji de capa')}</DropdownMenu.Item>
          {@render menuEnd?.()}
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

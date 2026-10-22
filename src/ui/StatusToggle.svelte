<script lang="ts">
  import type { ReminderStatus } from '../types'
  import { t } from '../i18n.svelte'

  // Status do lembrete num seletor de três cores (vermelho, amarelo, verde): cada bolinha é um botão.
  let { value, onchange, label }: { value: ReminderStatus; onchange: (s: ReminderStatus) => void; label?: string } = $props()

  const STATES = $derived<[ReminderStatus, string][]>([['todo', t('A fazer')], ['doing', t('Em andamento')], ['done', t('Concluído')]])
</script>

<!-- Setas do teclado andam entre as três cores, como num grupo de opções. -->
<span
  class="status-toggle"
  role="radiogroup"
  tabindex="-1"
  aria-label={label ?? t('Status do lembrete')}
  onkeydown={(e) => {
    const i = STATES.findIndex(([s]) => s === value)
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : -1
    if (to < 0 || to > 2 || e.key === 'Tab') return
    e.preventDefault()
    e.stopPropagation()
    onchange(STATES[to][0])
    ;(e.currentTarget.children[to] as HTMLElement).focus()
  }}
>
  {#each STATES as [s, name] (s)}
    <button
      type="button"
      role="radio"
      class="st-dot st-{s}"
      class:on={value === s}
      aria-checked={value === s}
      tabindex={value === s ? 0 : -1}
      aria-label={name}
      title={name}
      onclick={(e) => {
        e.stopPropagation()
        if (value !== s) onchange(s)
      }}
      onpointerdown={(e) => e.stopPropagation()}
    ></button>
  {/each}
</span>

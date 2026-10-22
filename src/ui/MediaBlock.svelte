<script lang="ts">
  import { Download } from '@lucide/svelte'
  import { t } from '../i18n.svelte'
  import { fmtBytes } from '../util/format'
  import { FILE_ICONS as KIND_ICONS, FILE_LABELS as KIND_LABELS } from '../card/icons'
  import AudioPlayer from './AudioPlayer.svelte'
  import type { Attachment } from '../types'

  // Anexo no meio do texto: vídeo com player, áudio com player compacto, documentos como cartão.
  let { a, src, onopen, ondownload }: {
    a: Attachment
    /** Endereço para tocar ou mostrar (vazio quando o conteúdo não está aqui). */
    src: string
    onopen?: () => void
    ondownload?: () => void
  } = $props()
  const Icon = $derived(KIND_ICONS[a.kind])
</script>

{#if a.kind === 'video'}
  <figure class="nf-video">
    {#if src}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video {src} controls preload="metadata" playsinline></video>
    {:else}
      <div class="nf-video-empty"><Icon size={28} /><span>{t('Vídeo de exemplo, sem conteúdo nesta prévia')}</span></div>
    {/if}
    <figcaption><span class="nf-name">{a.name}</span><small>{fmtBytes(a.bytes)}</small></figcaption>
  </figure>
{:else}
  <div class="nf-card">
    <button class="nf-open" onclick={onopen} aria-label={t('Abrir {nome}', { nome: a.name })} title={t('Abrir')}><span class="f-ico t-{a.kind}"><Icon size={20} /></span></button>
    <div class="nf-text">
      {#if a.kind === 'audio'}
        <span class="nf-name">{a.name}</span>
      {:else}
        <button class="nf-name nf-link" onclick={onopen} title={t('Abrir')}>{a.name}</button>
      {/if}
      {#if a.kind === 'audio'}
        <AudioPlayer {src} label={a.name} />
      {:else}
        <small>{t(KIND_LABELS[a.kind])} · {fmtBytes(a.bytes)}</small>
      {/if}
    </div>
    <button class="icon-btn sm" aria-label={t('Baixar {nome}', { nome: a.name })} title={t('Baixar')} onclick={() => ondownload?.()}><Download size={16} /></button>
  </div>
{/if}

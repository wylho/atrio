<script lang="ts">
  // O visualizador de anexos dos dois apps (veio do Ideario): a foto grande com a paleta (clicar copia a cor) e quanto
  // o WebP economizou, o leitor de PDF próprio (o mesmo nos três sistemas), vídeo, áudio, e para o resto o ícone do
  // tipo. Baixar sempre; o app acrescenta o que é dele em `actions` (o Ideario: "Abrir nota").
  import type { Snippet } from 'svelte'
  import { Dialog } from 'bits-ui'
  import { Download, X } from '@lucide/svelte'
  import AudioPlayer from '../ui/AudioPlayer.svelte'
  import PdfViewer from './PdfViewer.svelte'
  import { FILE_ICONS, FILE_LABELS } from '../card/icons'
  import { fmtBytes } from '../util/format'
  import { say } from '../util/notify'
  import type { Attachment } from '../types'

  let {
    att,
    imageUrl,
    mediaUrl,
    onclose,
    ondownload,
    actions,
  }: {
    /** O anexo aberto, ou null (fechado). */
    att: Attachment | null
    /** A foto inteira (não a miniatura). */
    imageUrl: (hash: string) => string
    /** O arquivo para tocar ou ler (vídeo, áudio, PDF); vazio = sem conteúdo (prévia com dados de exemplo). */
    mediaUrl: (hash: string) => string
    onclose: () => void
    ondownload: (a: Attachment) => void
    actions?: Snippet<[Attachment]>
  } = $props()

  /** "image/jpeg" → "JPG", "image/svg+xml" → "SVG". */
  const formatOf = (mime: string) => (mime.split('/')[1] ?? '').split('+')[0].replace('jpeg', 'jpg').toUpperCase() || 'Arquivo'

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      say(`${hex} copiado`)
    } catch {
      say(hex)
    }
  }
</script>

<Dialog.Root open={!!att} onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="overlay dark" />
    <Dialog.Content class="lightbox" aria-describedby={undefined}>
      {#if att}
        {@const media = mediaUrl(att.hash)}
        <div class="lb-top">
          <Dialog.Close class="icon-btn on-dark" aria-label="Fechar"><X size={20} /></Dialog.Close>
          <Dialog.Title class="lb-title">{att.name}</Dialog.Title>
        </div>
        {#if att.kind === 'image'}
          <img class="lb-img" src={imageUrl(att.hash)} alt="" />
        {:else if att.kind === 'pdf' && media}
          <PdfViewer src={media} name={att.name} />
        {:else if att.kind === 'video' && media}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video class="lb-img" src={media} controls autoplay playsinline></video>
        {:else}
          {@const Icon = FILE_ICONS[att.kind]}
          <div class="lb-media">
            <span class="lb-media-ico"><Icon size={40} /></span>
            {#if att.kind === 'audio'}<div class="lb-audio"><AudioPlayer src={media} label={att.name} /></div>{/if}
            {#if att.kind === 'video'}<p>Vídeo de exemplo, sem conteúdo nesta prévia</p>{/if}
            {#if att.kind !== 'audio' && att.kind !== 'video'}
              <p>{media ? 'Sem visualização para este tipo: baixe para abrir no aplicativo do sistema.' : 'Arquivo de exemplo, sem conteúdo nesta prévia.'}</p>
            {/if}
          </div>
        {/if}
        <div class="lb-sheet">
          {#if att.palette}
            <div class="lb-pal">
              {#each att.palette as p, i (i)}
                <button onclick={() => copy(p)} aria-label="Copiar {p}">
                  <i style:background={p}></i>
                  <code>{p}</code>
                </button>
              {/each}
            </div>
          {/if}
          <p class="lb-opt">
            {#if att.kind !== 'image'}
              <b>{FILE_LABELS[att.kind]} · {fmtBytes(att.bytes)}</b>
            {:else if att.origBytes}
              <span>Original {fmtBytes(att.origBytes)}</span>
              <span class="arrow">→</span>
              <b>WebP {fmtBytes(att.bytes)}</b>
              <span class="good">−{Math.round((1 - att.bytes / att.origBytes) * 100)}%</span>
            {:else}
              <!-- não foi convertida (qualidade Original, GIF…): o formato é o que veio -->
              <b>{formatOf(att.mime)} {fmtBytes(att.bytes)}</b>
            {/if}
          </p>
          <div class="lb-actions">
            <button class="btn ghost" onclick={() => ondownload(att)}><Download size={16} />Baixar</button>
            {@render actions?.(att)}
          </div>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

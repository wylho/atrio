<script lang="ts">
  // O card inteiro, editável: emoji de capa, título, texto em blocos (alça para arrastar e menu de cada bloco), fotos e
  // anexos, gravador e câmera, categoria, lembrete, status, etiquetas, cor e a barra de formatação. Veio do editor do
  // Ideario. Cada app liga o que faz sentido (`features`) e fornece o que o card pede (`host`); a janela em volta, o
  // jeito de guardar e as ações de arquivo (arquivar, lixeira, exportar) ficam no app.
  //
  // O texto mora num Y.Doc (`ydoc`, o Ideario: com desfazer do Yjs e sync) ou num documento comum (`content` +
  // `onbody`, para quem guarda a nota de outro jeito).
  import { mount, untrack, unmount, type Snippet } from 'svelte'
  import { Editor as TipTap, type ChainedCommands } from '@tiptap/core'
  import { NodeSelection } from '@tiptap/pm/state'
  import { Dialog, DropdownMenu, Popover, Select } from 'bits-ui'
  import type * as Y from 'yjs'
  import {
    Bold, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Heading, Image, Italic, List, ListChecks, Mic,
    SquareCode, Palette, Table, TextQuote, Minus, BetweenHorizontalStart, BetweenVerticalStart, Paperclip, Plus, Redo2,
    Rows2, Square, Tag, Trash2, Undo2, X, ArrowDown, ArrowUp, Copy, CopyPlus, Download, Eye, GripVertical, ListTodo,
    Pilcrow, Scissors, SquareCheck, SquareDashed, ExternalLink, ListIndentDecrease, ListIndentIncrease, Link2, RefreshCw,
  } from '@lucide/svelte'
  import { bareUrl, fillPreview, insertLinkCard } from '../editor/link'
  import {
    blockAt, canIndent, canMove, checkAll, checkCount, clipNode, convertBlock, deleteChecked, deleteNode, duplicateNode,
    moveNode, shapeOf, dropTargetAt, moveNodeTo, type BlockHit, type Shape,
  } from '../editor/blocks'
  import { imageActions, leaveRow, placeBeside } from '../editor/media'
  import { canRecord, fmtSeconds, hasCamera, photoName, Recorder } from '../editor/capture.svelte'
  import { noteExtensions } from '../editor/extensions'
  import { EmojiPicker } from '../emoji'
  import MenuAt from '../ui/MenuAt.svelte'
  import MediaBlock from '../ui/MediaBlock.svelte'
  import CameraDialog from '../ui/CameraDialog.svelte'
  import ReminderPopover from '../ui/ReminderPopover.svelte'
  import StatusToggle from '../ui/StatusToggle.svelte'
  import TagInput from '../ui/TagInput.svelte'
  import { SEP, type MenuEntry } from '../util/menu'
  import { fmtReminder, hashTags } from '../util/format'
  import { t } from '../i18n.svelte'
  import { say } from '../util/notify'
  import type { Attachment } from '../types'
  import { NOTE_COLORS } from './types'
  import { hasStatus, setReminder, setStatus, STATUS, statusOf, type CardMeta } from './meta'
  import type { CardFeatures, CardHost, DroppedFile } from './features'

  let {
    meta,
    features,
    host,
    ydoc,
    field = 'body',
    content,
    onbody,
    known = [],
    files = [],
    autofocus = false,
    placeholder,
    dialogTitle = false,
    top,
    onready,
    ondestroy,
  }: {
    /** Os metadados do card. Precisa ser `$state` do app: o card muda os campos direto. */
    meta: CardMeta
    features: CardFeatures
    host: CardHost
    /** O Y.Doc da nota: o texto vive no campo `field` dele (com o desfazer do Yjs). */
    ydoc?: Y.Doc
    field?: string
    /** Sem Y.Doc: o documento inicial (JSON do TipTap ou HTML), e `onbody` a cada mudança do texto. */
    content?: unknown
    onbody?: (editor: TipTap) => void
    /** Anexos que o texto já usa (fotos e players desenham sem esperar). */
    known?: Attachment[]
    /** Anexos antigos, fora do texto (o Ideario os mostra embaixo). */
    files?: Attachment[]
    /** Já abre com o cursor no texto (nota nova). */
    autofocus?: boolean
    placeholder?: string
    /** O título é o título de um `Dialog` do bits-ui (o card aberto numa janela). */
    dialogTitle?: boolean
    /** O que o app põe acima do card (a barra com voltar, fixar, mais opções…). */
    top?: Snippet
    /** O editor de texto nasceu (para o app pôr o que veio junto: arquivos, um link compartilhado…). */
    onready?: (editor: TipTap) => void
    /** O editor de texto vai sumir (para o app salvar o que faltar). */
    ondestroy?: () => void
  } = $props()

  let emojiOpen = $state(false)
  let editor = $state.raw<TipTap | null>(null)
  let tick = $state(0)
  let bodyTags = $state<string[]>([])
  /** Anexos usados no corpo, para desenhar fotos e players sem esperar. */
  const media = new Map<string, Attachment>(untrack(() => known.map((a) => [a.hash, a] as const)))
  const recorder = new Recorder()
  let cameraOpen = $state(false)
  let cameraAvailable = $state(false)
  hasCamera().then((v) => (cameraAvailable = v))
  let photoInput: HTMLInputElement | undefined = $state()
  let fileInput: HTMLInputElement | undefined = $state()

  const categories = $derived(features.category ? (host.categories?.() ?? []) : [])
  const cat = $derived(categories.find((c) => c.id === meta.categoryId))
  const extraTags = $derived([...new Set(bodyTags)].filter((t) => !meta.tags.includes(t)))
  const active = $derived.by(() => {
    void tick
    // Só destaca a formatação enquanto se escreve.
    const e = editor?.isFocused ? editor : null
    return {
      bold: !!e?.isActive('bold'), italic: !!e?.isActive('italic'),
      heading: ([1, 2, 3] as const).find((level) => e?.isActive('heading', { level })) ?? 0,
      list: !!e?.isActive('bulletList'), check: !!e?.isActive('taskList'), code: !!e?.isActive('codeBlock'),
      undo: !!editor?.can().undo(), redo: !!editor?.can().redo(),
    }
  })

  // ---------- o que o app usa por `bind:this` ----------

  /** O editor de texto (TipTap), quando já existe. */
  export function getEditor() {
    return editor
  }

  /** Sem título nem texto. */
  export function isEmpty() {
    return !meta.title.trim() && !!editor?.isEmpty
  }

  /** O texto tem foto ou anexo. */
  export function hasMedia() {
    let found = false
    editor?.state.doc.descendants((n) => {
      if (n.type.name === 'noteImage' || n.type.name === 'noteFile') found = true
      return !found
    })
    return found
  }

  /** Está gravando áudio. */
  export function isRecording() {
    return recorder.recording
  }

  /** Começa a gravar (atalho do app). */
  export function startRecording() {
    void recorder.start()
  }

  /** Abre a câmera (atalho do app). */
  export function openCamera() {
    cameraOpen = true
  }

  /** Para de gravar e põe a gravação no texto. */
  export async function stopRecording() {
    const rec = await recorder.stop()
    if (rec) await addFiles([rec])
  }

  /** Joga fora a gravação em andamento. */
  export function cancelRecording() {
    recorder.cancel()
  }

  /** Espera os arquivos que ainda estão entrando (fechar a nota não perde nenhum). */
  export async function settle() {
    if (recorder.recording) await stopRecording()
    await Promise.allSettled([...imports])
  }

  /** Lembrete marcado (ou tirado). */
  export function reminder(v: number | null) {
    if (setReminder(meta, v)) host.onReminderSet?.()
  }

  /** Muda o status (três cores, ou 'none'). */
  export function status(to: Parameters<typeof setStatus>[1]) {
    const msg = setStatus(meta, to)
    if (msg) say(msg)
  }

  /** Abre o seletor de emoji de capa. */
  export function chooseEmoji() {
    emojiOpen = true
  }

  /** Põe arquivos no texto (do computador, arrastados, colados, da câmera ou do gravador), no ponto `pos` ou no fim. */
  export function addFiles(list: (DroppedFile | { blob: Blob; name: string })[], pos?: number) {
    const job = importFiles(list, pos)
    imports.add(job)
    return job.finally(() => imports.delete(job))
  }

  // ---------- link ----------
  /** "+ Link…": pede o endereço e põe o cartão onde está o cursor (a prévia chega depois). */
  async function askLink() {
    const text = host.askText
      ? await host.askText({ title: t('Inserir link'), label: t('Endereço (https://…)'), confirm: t('Inserir') })
      : window.prompt(t('Endereço (https://…)'))
    if (text == null) return
    const url = bareUrl(text) ?? bareUrl(`https://${text}`)
    if (!url || !editor) {
      say(t('Isso não parece um endereço'))
      return
    }
    // numa linha vazia, o cartão toma o lugar dela; no meio do texto, entra logo abaixo do bloco
    const at = editor.state.selection.$from
    if (at.depth === 0) insertLinkCard(editor.view, url, at.pos, at.pos)
    else {
      const block = at.node(1)
      const empty = block.type.name === 'paragraph' && block.content.size === 0
      insertLinkCard(editor.view, url, empty ? at.before(1) : at.after(1), at.after(1))
    }
    if (host.linkPreview) fillPreview(editor.view, url, (u) => host.linkPreview!(u))
  }

  const NEW_CATEGORY = '__new'
  /** Seletor de categoria; "Nova categoria…" cria e já põe o card nela. */
  function pickCategory(v: string) {
    if (v === NEW_CATEGORY) host.newCategory?.((id) => (meta.categoryId = id))
    // "Sem categoria" ou clicar de novo na marcada (allowDeselect devolve '')
    else meta.categoryId = v === 'none' || !v ? null : v
  }

  // ---------- TipTap ----------
  function mountEditor(el: HTMLElement) {
    return untrack(() => {
      const full = (h: string) => host.imageUrl?.(h, 'full') ?? ''
      const ed = new TipTap({
        element: el,
        extensions: noteExtensions({
          media: (h) => ({ src: full(h), width: media.get(h)?.width, height: media.get(h)?.height }),
          load: async (h) => {
            const a = media.get(h) ?? (await loadMedia(h))
            return a ? { src: full(h), width: a.width, height: a.height } : null
          },
          renderFile: (h, dom) => {
            let c: ReturnType<typeof mount> | null = null
            let gone = false
            const show = (a: Attachment) =>
              !gone &&
              (c = mount(MediaBlock, {
                target: dom,
                props: { a, src: host.mediaUrl?.(a.hash) ?? '', onopen: () => host.openAttachment?.(a), ondownload: () => host.download?.(a) },
              }))
            const k = media.get(h)
            // Colado de outra nota: busca os dados do anexo e desenha quando chegarem.
            if (k) show(k)
            else void loadMedia(h).then((a) => a && show(a))
            return () => {
              gone = true
              if (c) void unmount(c)
            }
          },
          onFiles: (list, pos) => void (features.attachments && addFiles(list, pos)),
          onMenu: (pos, e) => openNodeMenu(pos, e.clientX, e.clientY, e.target as Element),
          clipboardImage: features.attachments && host.clipboardImage ? () => host.clipboardImage!().catch(() => null) : undefined,
          markdown: host.markdownToDoc ? (md) => host.markdownToDoc!(md).catch(() => null) : undefined,
          placeholder: placeholder ?? t('Escreva… use #tag para marcar'),
          ydoc,
          field,
          link: features.links ? { preview: (u) => host.linkPreview!(u), open: (u) => host.openUrl?.(u) } : undefined,
        }),
        ...(ydoc ? {} : { content: (content as object | string | undefined) ?? '' }),
        editorProps: {
          attributes: { id: 'corpo', role: 'textbox', 'aria-multiline': 'true', 'aria-label': t('Texto da nota'), spellcheck: 'true' },
        },
        onTransaction: () => tick++,
        onSelectionUpdate: () => handleAtCaret(),
        onFocus: () => handleAtCaret(),
        // Com Y.Doc, o app salva pelas atualizações dele; sem, avisamos a cada mudança.
        onUpdate: ({ editor }) => {
          bodyTags = hashTags(editor.getText())
          onbody?.(editor)
        },
      })
      bodyTags = hashTags(ed.getText())
      editor = ed
      // Nota nova: cursor no corpo já na montagem, para não perder as primeiras teclas.
      if (autofocus) ed.commands.focus('end', { scrollIntoView: false })
      // Logo depois da montagem: o app já tem o `bind:this` do card para pôr arquivos, gravar etc.
      queueMicrotask(() => !ed.isDestroyed && onready?.(ed))
      return () => {
        if (recorder.recording) recorder.cancel()
        ondestroy?.()
        ed.destroy()
      }
    })
  }

  const run = (fn: (c: ReturnType<TipTap['chain']>) => ReturnType<TipTap['chain']>) => editor && fn(editor.chain().focus()).run()

  // ---------- mídia ----------
  async function loadMedia(h: string) {
    const [a] = (await host.attachments?.([h])) ?? []
    if (a) media.set(h, a)
    return a
  }

  async function copyImage(h: string) {
    try {
      const img = new globalThis.Image()
      img.src = host.imageUrl?.(h, 'full') ?? ''
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
      if (!blob) throw new Error('png')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      say(t('Imagem copiada'))
    } catch {
      say(t('Não foi possível copiar a imagem'))
    }
  }

  // ---------- blocos ----------
  /** Altura do título acompanha o texto (a WebKitGTK não tem `field-sizing`). */
  function autosize(el: HTMLTextAreaElement, _title: string) {
    let width = 0
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) (width = el.clientWidth), fit()
    })
    ro.observe(el)
    fit()
    return { update: () => queueMicrotask(fit), destroy: () => ro.disconnect() }
  }

  let blockMenu: MenuAt | undefined = $state()
  let hover = $state.raw<BlockHit | null>(null)
  let blocksEl: HTMLElement | undefined = $state()
  let handleDragging = false

  /** Toque: sem "passar o mouse", a alça fica no bloco (ou item) onde está o cursor. */
  const touchOnly = matchMedia('(hover: none)').matches
  function handleAtCaret() {
    if (!editor || !touchOnly || handleDragging) return
    const view = editor.view
    if (!view.hasFocus()) return
    try {
      const c = view.coordsAtPos(view.state.selection.from)
      hover = blockAt(view, (c.top + c.bottom) / 2, c.left)
    } catch {
      hover = null
    }
  }

  function onBodyMove(e: PointerEvent) {
    if (!editor || e.pointerType !== 'mouse' || handleDragging || e.buttons) return
    if ((e.target as Element).closest('.blk-handle')) return
    hover = blockAt(editor.view, e.clientY, e.clientX)
  }
  const topOf = (dom: HTMLElement) => (blocksEl ? dom.getBoundingClientRect().top - blocksEl.getBoundingClientRect().top : 0)
  /** Logo à esquerda do começo do bloco ou item (a caixinha do checklist, o marcador da lista). */
  function handleLeft(dom: HTMLElement, isItem: boolean) {
    if (!blocksEl) return 8
    const marker = isItem && dom.parentElement?.getAttribute('data-type') !== 'taskList' ? parseFloat(getComputedStyle(dom.parentElement!).paddingLeft) || 0 : 0
    return Math.max(4, dom.getBoundingClientRect().left - blocksEl.getBoundingClientRect().left - marker - 26)
  }

  /** Linha que mostra onde o bloco ou item arrastado vai cair (relativa à área dos blocos). */
  let dropLine = $state.raw<{ top: number; left: number; width: number } | null>(null)
  let justDragged = false

  /** Arrastar pela alça com o ponteiro: apertar, mover (a linha mostra onde cai) e soltar. Sem mover, é clique (menu).
   *  Não usa o arrastar do HTML: no macOS e no Windows a janela do Tauri fica com ele para receber arquivos. */
  function handleDown(e: PointerEvent, pos: number) {
    if (!editor || e.button !== 0) return
    const view = editor.view
    const [x0, y0] = [e.clientX, e.clientY]
    const scroller = blocksEl?.closest('.ed-scroll') as HTMLElement | null
    let started = false
    let target: number | null = null
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return
        started = handleDragging = true
        document.body.classList.add('blk-grabbing')
      }
      ev.preventDefault()
      if (scroller) {
        const r = scroller.getBoundingClientRect()
        if (ev.clientY < r.top + 40) scroller.scrollTop -= 14
        else if (ev.clientY > r.bottom - 40) scroller.scrollTop += 14
      }
      const t = dropTargetAt(view, pos, ev.clientY)
      target = t?.pos ?? null
      const base = blocksEl?.getBoundingClientRect()
      dropLine = t && base ? { top: t.line.top - base.top, left: t.line.left - base.left, width: t.line.width } : null
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.classList.remove('blk-grabbing')
      if (started) {
        justDragged = true
        setTimeout(() => (justDragged = false), 0)
        if (target != null) moveNodeTo(view, pos, target)
        hover = null
        if (touchOnly) setTimeout(handleAtCaret)
      }
      handleDragging = false
      dropLine = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const TEXTISH = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'codeBlock'])
  function transform(pos: number, to: Shape) {
    if (editor) convertBlock(editor.view, pos, to)
  }

  const copyText = (text: string, done: string) => void navigator.clipboard.writeText(text).then(() => say(done))

  /** Menu de um bloco (ou de um item de lista), com as ações gerais e as do tipo. */
  function nodeEntries(pos: number, clicked?: Element): MenuEntry[] {
    const view = editor?.view
    const node = view?.state.doc.nodeAt(pos)
    if (!view || !node) return []
    const name = node.type.name
    const isItem = name === 'taskItem' || name === 'listItem'
    const out: MenuEntry[] = []
    // foto clicada (sozinha ou dentro de uma linha)
    const imgEl = clicked?.closest('img[data-hash]')
    const imgHash = imgEl?.getAttribute('data-hash') ?? (name === 'noteImage' ? node.attrs.hash : null)
    if (imgHash) {
      const a = media.get(imgHash)
      out.push(
        { label: t('Ver'), icon: Eye, onSelect: () => a && host.openAttachment?.(a) },
        { label: t('Baixar'), icon: Download, onSelect: () => a && host.download?.(a) },
        { label: t('Copiar imagem'), icon: Copy, onSelect: () => void copyImage(imgHash) },
        SEP,
      )
    }
    if (name === 'linkCard') {
      const url: string = node.attrs.url
      out.push(
        { label: t('Abrir link'), icon: ExternalLink, onSelect: () => host.openUrl?.(url) },
        { label: t('Copiar endereço'), icon: Copy, onSelect: () => copyText(url, t('Endereço copiado')) },
        {
          label: t('Atualizar prévia'), icon: RefreshCw,
          onSelect: () => {
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, title: null }))
            if (host.linkPreview) fillPreview(view, url, (u) => host.linkPreview!(u))
          },
        },
        SEP,
      )
    }
    if (name === 'noteFile') {
      const a = media.get(node.attrs.hash)
      out.push(
        { label: t('Abrir'), icon: ExternalLink, onSelect: () => a && host.openAttachment?.(a) },
        { label: t('Baixar'), icon: Download, onSelect: () => a && host.download?.(a) },
        { label: t('Copiar nome'), icon: Copy, onSelect: () => a && copyText(a.name, t('Nome copiado')) },
        SEP,
      )
    }
    if (isItem) {
      // Subitens: recuar vira subitem do item de cima; voltar sobe um nível (Tab e Shift+Tab fazem o mesmo).
      out.push(
        { label: t('Aumentar recuo'), icon: ListIndentIncrease, hint: 'Tab', disabled: !canIndent(view, pos, 1), onSelect: () => indent(pos, 1) },
        { label: t('Diminuir recuo'), icon: ListIndentDecrease, hint: '⇧ Tab', disabled: !canIndent(view, pos, -1), onSelect: () => indent(pos, -1) },
        SEP,
      )
    }
    if (name === 'taskList') {
      const [checked, total] = checkCount(node)
      out.push(
        { label: t('Marcar todos'), icon: SquareCheck, disabled: checked === total, onSelect: () => checkAll(view, pos, true) },
        { label: t('Desmarcar todos'), icon: SquareDashed, disabled: checked === 0, onSelect: () => checkAll(view, pos, false) },
        { label: t('Apagar itens marcados'), icon: Trash2, disabled: checked === 0, onSelect: () => deleteChecked(view, pos) },
        SEP,
      )
    }
    out.push(
      { label: t('Copiar'), icon: Copy, onSelect: () => clipNode(view, pos, 'copy') },
      { label: t('Recortar'), icon: Scissors, onSelect: () => clipNode(view, pos, 'cut') },
      { label: t('Duplicar'), icon: CopyPlus, onSelect: () => duplicateNode(view, pos) },
      SEP,
      { label: t('Mover para cima'), icon: ArrowUp, disabled: !canMove(view, pos, -1), onSelect: () => moveNode(view, pos, -1) },
      { label: t('Mover para baixo'), icon: ArrowDown, disabled: !canMove(view, pos, 1), onSelect: () => moveNode(view, pos, 1) },
    )
    if (name === 'table') {
      // Na linha/coluna do cursor, se ele está nesta tabela; senão, na primeira célula.
      const at = (fn: (c: ChainedCommands) => ChainedCommands) => () => {
        if (!editor) return
        const { from } = editor.state.selection
        const inside = from > pos && from < pos + node.nodeSize
        const chain = editor.chain().focus()
        fn(inside ? chain : chain.setTextSelection(pos + 4)).run()
      }
      out.push(
        SEP,
        { label: t('Linha abaixo'), icon: BetweenHorizontalStart, onSelect: at((c) => c.addRowAfter()) },
        { label: t('Coluna à direita'), icon: BetweenVerticalStart, onSelect: at((c) => c.addColumnAfter()) },
        { label: t('Apagar linha'), icon: Minus, onSelect: at((c) => c.deleteRow()) },
        { label: t('Apagar coluna'), icon: Minus, onSelect: at((c) => c.deleteColumn()) },
      )
    }
    if (TEXTISH.has(name)) {
      const cur = shapeOf(name)
      const opt = (label: string, icon: typeof Pilcrow, to: Shape): MenuEntry => ({ label, icon, checked: cur === to, onSelect: () => transform(pos, to) })
      out.push({
        label: t('Transformar em'), icon: Pilcrow,
        sub: [opt(t('Texto'), Pilcrow, 'paragraph'), opt(t('Título'), Heading, 'heading'), opt(t('Lista'), List, 'bullet'), opt(t('Checklist'), ListTodo, 'task'), opt(t('Código'), SquareCode, 'code')],
      })
    }
    if (isItem) {
      // A lista ou checklist inteira (marcar todos, mover, transformar…) fica num submenu do item.
      const listPos = view.state.doc.resolve(pos).before()
      const list = view.state.doc.nodeAt(listPos)
      if (list) out.push(SEP, { label: list.type.name === 'taskList' ? t('Checklist inteira') : t('Lista inteira'), icon: list.type.name === 'taskList' ? ListTodo : List, sub: nodeEntries(listPos) })
    }
    out.push(SEP, { label: isItem ? t('Apagar item') : t('Apagar'), icon: Trash2, danger: true, onSelect: () => deleteNode(view, pos) })
    return out
  }

  /** Recua (vira subitem do item de cima) ou volta um nível. */
  function indent(pos: number, dir: 1 | -1) {
    const node = editor?.state.doc.nodeAt(pos)
    if (!editor || !node) return
    editor.chain().focus().setTextSelection(pos + 2).run()
    if (dir > 0) editor.commands.sinkListItem(node.type.name)
    else editor.commands.liftListItem(node.type.name)
  }

  function openNodeMenu(pos: number, x: number, y: number, clicked?: Element) {
    blockMenu?.openAt(x, y, nodeEntries(pos, clicked))
  }

  /** Importações em andamento: fechar a nota espera por elas. */
  const imports = new Set<Promise<unknown>>()

  async function importFiles(list: (DroppedFile | { blob: Blob; name: string })[], pos?: number) {
    if (!editor || !list.length) return
    // Até 3 de uma vez (cada foto passa pelo pipeline do app), na ordem em que vieram.
    const results: (Attachment | null)[] = new Array(list.length).fill(null)
    let next = 0
    const worker = async () => {
      while (next < list.length) {
        const i = next++
        const f = list[i]
        try {
          if (f instanceof File) results[i] = (await host.importFile?.(f, f.name)) ?? null
          else if ('path' in f) results[i] = (await host.importPath?.(f.path)) ?? null
          else results[i] = (await host.importFile?.(f.blob, f.name)) ?? null
        } catch (e) {
          say(t('Não foi possível anexar: {erro}', { erro: String(e) }))
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker))
    if (!editor || editor.isDestroyed) return
    const added = results.filter((a): a is Attachment => !!a)
    for (const a of added) media.set(a.hash, a)
    if (!added.length) return
    host.afterImport?.(added)
    // Várias fotos de uma vez entram lado a lado (até 4 por linha); o resto, um bloco cada.
    const photos = added.filter((a) => a.kind === 'image')
    const nodes: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }[] = []
    for (let i = 0; i < photos.length; i += 4) {
      const row = photos.slice(i, i + 4).map((a) => ({ type: 'noteImage', attrs: { hash: a.hash } }))
      nodes.push(row.length > 1 ? { type: 'imageRow', content: row } : row[0])
    }
    for (const a of added) if (a.kind !== 'image') nodes.push({ type: 'noteFile', attrs: { hash: a.hash } })
    nodes.push({ type: 'paragraph' })
    if (pos != null) {
      editor.chain().focus().setTextSelection(pos).insertContent(nodes).run()
      return
    }
    // Anexo é sempre um bloco do texto: com o cursor numa lista (ou citação, tabela), entra logo depois dela, não
    // dentro do item.
    const from = editor.state.selection.$from
    if (from.depth > 1) editor.chain().focus().insertContentAt(from.after(1), nodes).run()
    else editor.chain().focus().insertContent(nodes).run()
  }

  function pick(input: HTMLInputElement | undefined) {
    if (!input) return
    input.value = ''
    input.click()
  }

  // Foto selecionada: botões para pôr ao lado da de cima, mover na linha e separar (toque e teclado).
  const selectedImage = $derived.by(() => {
    void tick
    const sel = editor?.state.selection
    // Só com o editor em foco: ao abrir uma nota que começa com foto, a seleção inicial cai nela sem ninguém clicar.
    if (!editor?.isFocused || !(sel instanceof NodeSelection) || sel.node.type.name !== 'noteImage') return null
    const dom = editor.view.nodeDOM(sel.from) as HTMLElement | null
    const acts = imageActions(editor.state, sel.from)
    if (!dom || !acts) return null
    // Posição relativa ao editor (o diálogo é a referência dos botões), sem sair das bordas.
    const box = dom.closest('.editor')?.getBoundingClientRect()
    const r = dom.getBoundingClientRect()
    if (!box) return null
    const half = 110
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, half + 8), box.width - half - 8)
    return { pos: sel.from, ...acts, top: Math.max(r.top - box.top, 56), x }
  })
  function apply(tr: ReturnType<typeof placeBeside>) {
    if (tr && editor) editor.view.dispatch(tr)
    editor?.view.focus()
  }

  const insertMedia = $derived(features.attachments || features.capture)
</script>

{#snippet titleField(props: Record<string, unknown>)}
  <!-- Título longo quebra em várias linhas (e não rola de lado); continua sendo uma linha só de texto. -->
  <textarea
    {...props}
    id="titulo"
    class="ed-title"
    rows="1"
    placeholder={t('Título')}
    autocomplete="off"
    bind:value={meta.title}
    use:autosize={meta.title}
    oninput={(e) => /\n/.test(e.currentTarget.value) && (meta.title = e.currentTarget.value.replace(/\s*\n\s*/g, ' '))}
    onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), editor?.commands.focus('start'))}
  ></textarea>
{/snippet}

{@render top?.()}

<div class="ed-scroll" onscroll={() => tick++}>
  <!-- Só no papel (escolha do usuário, opção C): o topo do PDF é o card da nota, na cor dela, com o emoji, o título
       inteiro (o campo de texto cortava o título ao imprimir) e as pílulas. Na tela, o editor de sempre. -->
  <div class="ed-print-card" data-color={meta.color ?? 'none'} aria-hidden="true">
    {#if features.emoji && meta.emoji}<div class="pc-emoji">{meta.emoji}</div>{/if}
    {#if meta.title.trim()}<h1 class="pc-title">{meta.title}</h1>{/if}
    {#if cat || (features.reminder && meta.reminderAt != null) || (features.status && hasStatus(meta)) || (features.tags && (meta.tags.length || extraTags.length))}
      <div class="pc-pills">
        {#if cat}<span><i style:background={cat.color}></i>{cat.name}</span>{/if}
        {#if features.reminder && meta.reminderAt != null}<span>{t('Lembrete: {quando}', { quando: fmtReminder(meta.reminderAt) })}</span>{/if}
        {#if features.status && hasStatus(meta)}<span><i class="pc-st {statusOf(meta)}"></i>{t(STATUS[statusOf(meta)].label)}</span>{/if}
        {#if features.tags}{#each [...meta.tags, ...extraTags] as tag (tag)}<span>#{tag}</span>{/each}{/if}
      </div>
    {/if}
  </div>
  {#if features.emoji}
    <div class="ed-cover" class:has={!!meta.emoji}>
      <EmojiPicker value={meta.emoji} onchange={(v) => (meta.emoji = v)} bind:open={emojiOpen} />
    </div>
  {/if}
  {#if dialogTitle}
    <Dialog.Title>
      {#snippet child({ props })}{@render titleField(props)}{/snippet}
    </Dialog.Title>
  {:else}
    {@render titleField({})}
  {/if}
  <!-- Blocos: com o mouse por cima, a alça ⋮⋮ à esquerda arrasta o bloco e abre o menu dele.
       Em listas e checklists, cada item tem a própria alça (reordenar como no Keep). -->
  <div
    class="ed-blocks"
    role="presentation"
    bind:this={blocksEl}
    onpointermove={onBodyMove}
    onpointerleave={(e) => e.pointerType === 'mouse' && !handleDragging && (hover = null)}
    onkeydowncapture={() => !touchOnly && (hover = null)}
  >
    <div class="ed-body prose" {@attach mountEditor}></div>
    {#if hover}
      <!-- Uma alça só: dentro de uma lista ou checklist ela é do item (a lista inteira fica no menu dele);
           fora, do bloco. Sempre logo à esquerda do que ela move, na altura da primeira linha. -->
      {@const h = hover.item ?? hover.block}
      {@const isItem = !!hover.item}
      <button
        class="blk-handle"
        class:item={isItem}
        style:top="{topOf(h.dom)}px"
        style:left="{handleLeft(h.dom, isItem)}px"
        aria-label={isItem ? t('Item: arraste para reordenar ou clique para o menu') : t('Bloco: arraste para mover ou clique para o menu')}
        title={isItem ? t('Arraste para reordenar · clique para o menu') : t('Arraste para mover · clique para o menu')}
        onpointerdown={(e) => handleDown(e, h.pos)}
        onmousedown={(e) => touchOnly && e.preventDefault()}
        onclick={(e) => !justDragged && openNodeMenu(h.pos, e.clientX, e.clientY)}
      ><GripVertical size={16} /></button>
    {/if}
    {#if dropLine}
      <div class="blk-drop" style:top="{dropLine.top - 1}px" style:left="{dropLine.left}px" style:width="{dropLine.width}px"></div>
    {/if}
  </div>
  <MenuAt bind:this={blockMenu} />

  {#if files.length}
    <!-- Anexos antigos, fora do corpo: mesmo cartão dos anexos do texto. -->
    <div class="ed-files">
      {#each files as f (f.hash)}
        <MediaBlock a={f} src={host.mediaUrl?.(f.hash) ?? ''} onopen={() => host.openAttachment?.(f)} ondownload={() => host.download?.(f)} />
      {/each}
    </div>
  {/if}

  {#if features.category || (features.reminder && meta.reminderAt != null) || (features.status && hasStatus(meta))}
    <div class="ed-meta">
      {#if features.category}
        <Select.Root
          type="single"
          allowDeselect
          items={[{ value: 'none', label: t('Sem categoria') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          bind:value={() => meta.categoryId ?? 'none', pickCategory}
        >
          <Select.Trigger id="categoria" class="picker" aria-label={t('Categoria')}>
            {#if cat}<i class="dot" style:background={cat.color}></i>{:else}<Tag size={14} />{/if}
            <span>{cat?.name ?? t('Sem categoria')}</span>
            <ChevronDown size={15} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content class="menu menu-scroll" sideOffset={6} collisionPadding={8}>
              <Select.Viewport>
                <Select.Item value="none" label={t('Sem categoria')} class="menu-item">{t('Sem categoria')}</Select.Item>
                {#each categories as c (c.id)}
                  <Select.Item value={c.id} label={c.name} class="menu-item">
                    {#snippet children({ selected })}
                      <i class="dot" style:background={c.color}></i>{c.name}
                      {#if selected}<span class="menu-check"><Check size={15} /></span>{/if}
                    {/snippet}
                  </Select.Item>
                {/each}
                {#if host.newCategory}
                  <div class="menu-sep" role="separator"></div>
                  <Select.Item value={NEW_CATEGORY} label={t('Nova categoria')} class="menu-item"><Plus size={16} />{t('Nova categoria…')}</Select.Item>
                {/if}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      {/if}
      {#if features.reminder && meta.reminderAt != null}
        <ReminderPopover
          variant="pill"
          value={meta.reminderAt}
          done={meta.reminderDone}
          repeat={meta.reminderRepeat}
          onchange={reminder}
          onrepeat={(r) => (meta.reminderRepeat = r)}
        />
      {/if}
      {#if features.status && hasStatus(meta)}
        <StatusToggle value={statusOf(meta)} onchange={status} />
      {/if}
    </div>
  {/if}

  {#if features.tags}
    <div class="ed-tags">
      {#each meta.tags as tag (tag)}
        <span class="pill tag">#{tag}<button aria-label={t('Remover {tag}', { tag })} onclick={() => (meta.tags = meta.tags.filter((x) => x !== tag))}><X size={12} /></button></span>
      {/each}
      {#each extraTags as tag (tag)}
        <span class="pill tag" title={t('Tag vinda do texto')}>#{tag}</span>
      {/each}
      <TagInput exclude={[...meta.tags, ...extraTags]} known={host.tags?.() ?? []} onpick={(tag) => !meta.tags.includes(tag) && meta.tags.push(tag)} />
    </div>
  {/if}
</div>

{#if selectedImage}
  <div class="img-tools" role="toolbar" aria-label={t('Foto')} style:top="{selectedImage.top}px" style:left="{selectedImage.x}px">
    {#if selectedImage.joinTarget != null}
      <button onmousedown={(e) => e.preventDefault()} onclick={() => editor && apply(placeBeside(editor.state, selectedImage.pos, selectedImage.joinTarget!, 'right'))} aria-label={t('Pôr ao lado da foto de cima')} title={t('Pôr ao lado da foto de cima')}><Columns2 size={17} /></button>
    {/if}
    {#if selectedImage.left != null}
      <button onmousedown={(e) => e.preventDefault()} onclick={() => editor && apply(placeBeside(editor.state, selectedImage.pos, selectedImage.left!, 'left'))} aria-label={t('Mover para a esquerda')} title={t('Mover para a esquerda')}><ChevronLeft size={17} /></button>
    {/if}
    {#if selectedImage.right != null}
      <button onmousedown={(e) => e.preventDefault()} onclick={() => editor && apply(placeBeside(editor.state, selectedImage.pos, selectedImage.right!, 'right'))} aria-label={t('Mover para a direita')} title={t('Mover para a direita')}><ChevronRight size={17} /></button>
    {/if}
    {#if selectedImage.inRow}
      <button onmousedown={(e) => e.preventDefault()} onclick={() => editor && apply(leaveRow(editor.state, selectedImage.pos))} aria-label={t('Tirar da linha')} title={t('Tirar da linha')}><Rows2 size={17} /></button>
    {/if}
    <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.deleteSelection())} aria-label={t('Remover foto')} title={t('Remover foto')}><Trash2 size={17} /></button>
  </div>
{/if}

{#if features.attachments}
  <input bind:this={photoInput} type="file" accept="image/*" multiple hidden onchange={(e) => void addFiles([...(e.currentTarget.files ?? [])])} />
  <input bind:this={fileInput} type="file" multiple hidden onchange={(e) => void addFiles([...(e.currentTarget.files ?? [])])} />
{/if}
{#if features.capture}
  <CameraDialog bind:open={cameraOpen} oncapture={(b) => void addFiles([{ blob: b, name: photoName() }])} />
{/if}

{#if recorder.recording}
  <div class="ed-tools rec-bar" role="toolbar" aria-label={t('Gravação')}>
    <span class="rec-dot" aria-hidden="true"></span>
    <span class="rec-time" aria-live="polite">{t('Gravando · {tempo}', { tempo: fmtSeconds(recorder.seconds) })}</span>
    <button class="btn ghost sm" onclick={() => recorder.cancel()}>{t('Cancelar')}</button>
    <button class="btn sm rec-stop" onclick={stopRecording}><Square size={13} fill="currentColor" />{t('Parar')}</button>
  </div>
{:else}
<div class="ed-tools" role="toolbar" aria-label={t('Formatação')}>
  {#if insertMedia || features.links || features.richText}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label={t('Inserir')} title={t('Inserir')}><Plus size={19} /></DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu" side="top" align="start" sideOffset={10} onCloseAutoFocus={(e) => e.preventDefault()}>
          {#if features.attachments}
            <DropdownMenu.Item class="menu-item" onSelect={() => pick(photoInput)}><Image size={16} />{t('Foto')}</DropdownMenu.Item>
          {/if}
          {#if features.capture && cameraAvailable}
            <DropdownMenu.Item class="menu-item" onSelect={() => (cameraOpen = true)}><Camera size={16} />{t('Câmera')}</DropdownMenu.Item>
          {/if}
          {#if features.attachments}
            <DropdownMenu.Item class="menu-item" onSelect={() => pick(fileInput)}><Paperclip size={16} />{t('Arquivo')}</DropdownMenu.Item>
          {/if}
          {#if features.capture && canRecord()}
            <DropdownMenu.Item class="menu-item" onSelect={() => void recorder.start()}><Mic size={16} />{t('Gravar áudio')}</DropdownMenu.Item>
          {/if}
          {#if insertMedia}<DropdownMenu.Separator class="menu-sep" />{/if}
          {#if features.links}
            <DropdownMenu.Item class="menu-item" onSelect={() => void askLink()}><Link2 size={16} />{t('Link…')}</DropdownMenu.Item>
          {/if}
          {#if features.richText}
            <DropdownMenu.Item class="menu-item" onSelect={() => run((c) => c.toggleCodeBlock())}><SquareCode size={16} />{t('Bloco de código')}</DropdownMenu.Item>
            <DropdownMenu.Item class="menu-item" onSelect={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}><Table size={16} />{t('Tabela')}</DropdownMenu.Item>
            <DropdownMenu.Item class="menu-item" onSelect={() => run((c) => c.toggleBlockquote())}><TextQuote size={16} />{t('Citação')}</DropdownMenu.Item>
            <DropdownMenu.Item class="menu-item" onSelect={() => run((c) => c.setHorizontalRule())}><Minus size={16} />{t('Linha divisória')}</DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <span class="ed-tools-sep" aria-hidden="true"></span>
  {/if}
  {#if features.richText}
    <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.toggleBold())} aria-label={t('Negrito')} aria-pressed={active.bold}><Bold size={18} /></button>
    <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.toggleItalic())} aria-label={t('Itálico')} aria-pressed={active.italic}><Italic size={18} /></button>
    <!-- Títulos como no Markdown: # grande, ## médio, ### pequeno. -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label={t('Título')} title={t('Título')} aria-pressed={!!active.heading} onmousedown={(e) => e.preventDefault()}><Heading size={18} /></DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu" side="top" align="start" sideOffset={10} onCloseAutoFocus={(e) => e.preventDefault()}>
          {#each [[1, 'Título grande', '#'], [2, 'Título médio', '##'], [3, 'Título pequeno', '###']] as const as [level, label, md] (level)}
            <DropdownMenu.Item class="menu-item" onSelect={() => run((c) => c.toggleHeading({ level }))}>
              <span class="grow">{t(label)}</span><small class="menu-hint">{md}</small>
              {#if active.heading === level}<span class="menu-check"><Check size={15} /></span>{/if}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.toggleBulletList())} aria-label={t('Lista')} aria-pressed={active.list}><List size={18} /></button>
    <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.toggleTaskList())} aria-label={t('Checklist')} aria-pressed={active.check}><ListChecks size={18} /></button>
  {/if}
  {#if features.color}
    <Popover.Root>
      <Popover.Trigger aria-label={t('Cor da nota')}><Palette size={18} /></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="pop" side="top" sideOffset={10}>
          <p class="pop-title">{t('Cor da nota')}</p>
          <div class="color-row">
            {#each NOTE_COLORS as c (c.id)}
              <button
                class="swatch c-{c.id}"
                class:on={meta.color === c.id}
                aria-label={t(c.label)}
                aria-pressed={meta.color === c.id}
                onclick={() => (meta.color = c.id)}
              >
                {#if meta.color === c.id}<Check size={14} />{/if}
              </button>
            {/each}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  {/if}
  <span class="ed-tools-sep" aria-hidden="true"></span>
  <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.undo())} aria-label={t('Desfazer')} title={t('Desfazer (Ctrl+Z)')} disabled={!active.undo}><Undo2 size={18} /></button>
  <button onmousedown={(e) => e.preventDefault()} onclick={() => run((c) => c.redo())} aria-label={t('Refazer')} title={t('Refazer (Ctrl+Shift+Z)')} disabled={!active.redo}><Redo2 size={18} /></button>
</div>
{/if}

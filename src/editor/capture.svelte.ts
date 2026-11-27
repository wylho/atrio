// Gravador de voz e câmera, para a nota. Só aparecem onde o aparelho tem microfone ou câmera.
import { say } from '../util/notify'
import { t } from '../i18n.svelte'

export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Há câmera? (sem pedir permissão: a lista de dispositivos diz o tipo mesmo sem os nomes). */
export async function hasCamera() {
  try {
    return (await navigator.mediaDevices?.enumerateDevices())?.some((d) => d.kind === 'videoinput') ?? false
  } catch {
    return false
  }
}

const ext = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm')
const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`
}

export class Recorder {
  recording = $state(false)
  seconds = $state(0)
  private rec: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  private stopping: Promise<{ blob: Blob; name: string } | null> | null = null
  /** Pedindo o microfone (o primeiro pedido espera a pessoa responder). */
  private starting = false
  /** Cancelado enquanto pedia: o microfone que chegar é desligado na hora. */
  private abandoned = false

  async start() {
    if (this.recording || this.starting) return false
    this.starting = true
    this.abandoned = false
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      say(t('Sem acesso ao microfone'))
      return false
    } finally {
      this.starting = false
    }
    if (this.abandoned) {
      stream.getTracks().forEach((t) => t.stop())
      return false
    }
    this.stream = stream
    this.chunks = []
    this.rec = new MediaRecorder(this.stream)
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data)
    this.rec.start(250)
    const started = Date.now()
    this.seconds = 0
    this.timer = setInterval(() => (this.seconds = Math.floor((Date.now() - started) / 1000)), 250)
    this.recording = true
    return true
  }

  /** Para e devolve o áudio, com um nome como "Gravação 09-10 15h42.webm". */
  stop(): Promise<{ blob: Blob; name: string } | null> {
    // Parar duas vezes (o botão Parar e o fechar do card) devolve a mesma gravação, uma vez só.
    if (this.stopping) return this.stopping
    const rec = this.rec
    if (!rec) return Promise.resolve(null)
    this.stopping = new Promise((resolve) => {
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        this.cleanup()
        this.stopping = null
        resolve({ blob: new Blob(this.chunks, { type }), name: `${t('Gravação {quando}', { quando: stamp() })}.${ext(type)}` })
      }
      rec.stop()
    })
    return this.stopping
  }

  /** Joga fora a gravação (e desliga o microfone, também o que ainda está sendo pedido). Uma gravação que já está
   *  sendo guardada (`stop`) continua. */
  cancel() {
    if (this.starting) this.abandoned = true
    if (this.stopping) return
    if (this.rec) {
      this.rec.onstop = () => this.cleanup()
      this.rec.stop()
    }
  }

  private cleanup() {
    clearInterval(this.timer)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.rec = null
    this.recording = false
  }
}

export const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
export const photoName = () => `${t('Foto {quando}', { quando: stamp() })}.jpg`

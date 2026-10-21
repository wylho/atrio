/** Separa as #hashtags do texto, para a prévia destacá-las (a mesma regra do Ideario). */
export function withHashtags(text: string): { text: string; tag: boolean }[] {
  const out: { text: string; tag: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(/(^|[^\p{L}\d_])(#[\p{L}\d_-]+)/gu)) {
    const start = m.index! + m[1].length
    if (start > last) out.push({ text: text.slice(last, start), tag: false })
    out.push({ text: m[2], tag: true })
    last = start + m[2].length
  }
  if (last < text.length) out.push({ text: text.slice(last), tag: false })
  return out
}

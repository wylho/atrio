// Idiomas dos apps (pedido do usuário: inglês e português, para o app ser usado no mundo). O texto em português,
// que é o que está escrito no código, é a própria chave: `t('Apagar nota')` mostra "Apagar nota" em português e
// "Delete note" em inglês, pelo dicionário. Texto sem tradução aparece em português (nunca some). Cada app e o Atrio
// registram os seus dicionários com `addMessages`; a escolha fica no aparelho (`localStorage`), e "Automático" segue
// o idioma do sistema.

import { EN } from './i18n/en'

export type Locale = 'en' | 'pt-BR'
/** A escolha da pessoa: um idioma ou o do sistema. */
export type LocalePref = Locale | 'auto'

/** Os rótulos ficam como estão (English e Português são o nome de cada idioma nele mesmo); "Automático" se mostra
 *  com `t(label)`. */
export const LOCALES: { id: LocalePref; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'en', label: 'English' },
  { id: 'pt-BR', label: 'Português' },
]

const KEY = 'atrio.locale'

/** O idioma do sistema: português para quem usa português (de qualquer país), inglês para o resto. */
export function systemLocale(langs: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  return langs.some((l) => l?.toLowerCase().startsWith('pt')) ? 'pt-BR' : 'en'
}

function readPref(): LocalePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'pt-BR' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

const initial = readPref()

/** O estado do idioma, reativo: os componentes que chamam `t` se redesenham quando ele muda. */
export const i18n = $state<{ pref: LocalePref; locale: Locale }>({
  pref: initial,
  locale: initial === 'auto' ? systemLocale() : initial,
})

// Inglês: texto em português → texto em inglês. Português: só o que não for o próprio texto (raro).
const dicts: Record<Locale, Map<string, string>> = { en: new Map(), 'pt-BR': new Map() }

/** Registra traduções (o Atrio registra as dele; cada app, as suas). Uma chave repetida fica com a última. */
export function addMessages(locale: Locale, messages: Record<string, string>) {
  for (const [k, v] of Object.entries(messages)) dicts[locale].set(k, v)
}

// O inglês do próprio Atrio (os apps registram os deles por cima).
addMessages('en', EN)

/** Muda o idioma (e guarda a escolha no aparelho). */
export function setLocale(pref: LocalePref) {
  i18n.pref = pref
  i18n.locale = pref === 'auto' ? systemLocale() : pref
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // sem armazenamento (navegação privada): vale só nesta sessão
  }
  if (typeof document !== 'undefined') document.documentElement.lang = i18n.locale
}

/**
 * O texto no idioma atual. `key` é o texto em português; `{nome}` é trocado por `vars.nome`.
 * Ex.: `t('Editada {quando}', { quando: ago(ms) })`.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = dicts[i18n.locale].get(key) ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text
}

/**
 * Plural: `tn(n, '{n} nota', '{n} notas')` escolhe pelo número (o inglês e o português pluralizam do mesmo jeito:
 * 1 é singular). As duas formas são chaves, como em `t`.
 */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : other, { n, ...vars })
}

/** O idioma para `Intl` e `toLocaleString` (datas, números). */
export const intlLocale = () => i18n.locale

if (typeof document !== 'undefined') document.documentElement.lang = i18n.locale

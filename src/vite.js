// Vite dos apps (`vite.config.ts`): `optimizeDeps: atrioOptimizeDeps()`.
//
// O Atrio vem como código-fonte (Svelte e `.svelte.ts`), então fica fora do pré-empacotamento. O que só ele importa
// (o TipTap, o ProseMirror) o Vite deixaria cru, enquanto o que o app também importa (o `@tiptap/core`) vai empacotado
// com uma cópia do ProseMirror dentro: duas cópias no `npm run dev`, e o editor quebra ("Adding different instances of
// a keyed plugin"). Pondo o editor inteiro na lista, ele é empacotado junto, numa leva só, e há uma cópia de cada.
// JavaScript puro: a config do Vite roda no Node, que não lê TypeScript de dentro do node_modules.

/** O editor do card: tudo o que o Atrio importa do TipTap, do ProseMirror e do Yjs (`tests/vite.test.ts` confere). */
export const ATRIO_EDITOR_DEPS = [
  '@tiptap/core',
  '@tiptap/starter-kit',
  '@tiptap/extension-collaboration',
  '@tiptap/extension-list',
  '@tiptap/extension-table',
  '@tiptap/extensions',
  '@tiptap/y-tiptap',
  '@tiptap/pm/state',
  '@tiptap/pm/view',
  '@tiptap/pm/model',
  '@tiptap/pm/transform',
  'yjs',
]

/**
 * O `optimizeDeps` do Vite para um app que usa o Atrio; `extra` soma o que é do app.
 * @param {{ include?: string[]; exclude?: string[] }} [extra]
 * @returns {{ include: string[]; exclude: string[] }}
 */
export function atrioOptimizeDeps(extra = {}) {
  return {
    exclude: ['@wylho/atrio', ...(extra.exclude ?? [])],
    include: [...ATRIO_EDITOR_DEPS, ...(extra.include ?? [])],
  }
}

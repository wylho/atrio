/** O editor do card: tudo o que o Atrio importa do TipTap, do ProseMirror e do Yjs. */
export declare const ATRIO_EDITOR_DEPS: string[]
/** O `optimizeDeps` do Vite para um app que usa o Atrio; `extra` soma o que é do app. */
export declare function atrioOptimizeDeps(extra?: { include?: string[]; exclude?: string[] }): {
  include: string[]
  exclude: string[]
}

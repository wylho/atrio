// `import x from '…?url'` (Vite, que os dois apps usam): o endereço do arquivo no pacote.
declare module '*?url' {
  const src: string
  export default src
}

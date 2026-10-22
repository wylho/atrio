// O visualizador de anexos (foto, PDF, vídeo, áudio). Separado do pacote principal porque traz o pdf.js
// (`pdfjs-dist`, carregado só quando um PDF abre).
export { default as AttachmentViewer } from './AttachmentViewer.svelte'
export { default as PdfViewer } from './PdfViewer.svelte'
export { openPdf } from './pdf'

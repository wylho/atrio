//! Atrio, a parte em Rust: o que os núcleos do Ideario e do Nodo compartilham, como a interface compartilha os
//! componentes Svelte do mesmo repositório.
//!
//! - [`markdown`]: o corpo de uma nota (documento do editor, o JSON do TipTap) ↔ Markdown, ida e volta sem perda.
//!   É o que o MCP dos dois apps lê e escreve, e como o Nodo guarda a nota de cada tópico.
//! - [`projection`]: a prévia do card (blocos, capa, anexos, `#tags`), a mesma nos dois apps.
//! - [`text`]: etiquetas (`#tag` no texto também), emoji de capa, repetições de lembrete, comparar sem acento
//!   (`fold`) e limpar espaços, com as regras da interface.
//! - [`attach`]: anexos (hash, tipo, MIME, nomes, citações na nota, trechos do player; com `media`, o preparo).
//! - `media` (feature `media`): o pipeline das fotos do Ideario (WebP, miniatura, paleta e tom).
//! - [`card`]: status de três cores e lembrete que se repete (as regras de `src/card/meta.ts`).
//! - [`canon`]: a forma canônica desse documento, para comparar dois que o editor mostra igual.

pub mod attach;
pub mod canon;
pub mod card;
pub mod markdown;
#[cfg(feature = "media")]
pub mod media;
pub mod projection;
/// Gerador de documentos para testes de propriedade (dos apps também, com a feature `testdoc`).
#[cfg(any(test, feature = "testdoc"))]
pub mod testdoc;
pub mod text;

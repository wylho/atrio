//! Atrio, a parte em Rust: o que os núcleos do Ideario e do Nodo compartilham, como a interface compartilha os
//! componentes Svelte do mesmo repositório.
//!
//! - [`markdown`]: o corpo de uma nota (documento do editor, o JSON do TipTap) ↔ Markdown, ida e volta sem perda.
//!   É o que o MCP dos dois apps lê e escreve, e como o Nodo guarda a nota de cada tópico.
//! - [`canon`]: a forma canônica desse documento, para comparar dois que o editor mostra igual.

pub mod canon;
pub mod markdown;
#[cfg(test)]
mod testdoc;

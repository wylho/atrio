//! Regras de texto do card, as mesmas nos dois núcleos (vieram do Ideario).

/// Repetições de lembrete aceitas (todo dia, semana, mês, ano).
pub const REPEATS: [&str; 4] = ["day", "week", "month", "year"];

/// Como a interface normaliza uma etiqueta digitada: sem `#`, espaços viram hífen, minúsculas.
pub fn normalize_tag(raw: &str) -> String {
    raw.trim()
        .trim_start_matches('#')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-")
        .to_lowercase()
}

/// Etiquetas normalizadas, sem vazias nem repetidas, na ordem em que vieram.
pub fn clean_tags<S: AsRef<str>>(tags: &[S]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for t in tags
        .iter()
        .map(|t| normalize_tag(t.as_ref()))
        .filter(|t| !t.is_empty())
    {
        if !out.contains(&t) {
            out.push(t);
        }
    }
    out
}

/// Emoji de capa aceito: um emoji só (sequências com ZWJ, tom de pele, bandeiras e teclas incluídas), sem letras nem
/// espaços. Qualquer outra coisa vira "sem emoji".
pub fn clean_emoji(s: &str) -> Option<String> {
    let s = s.trim();
    let ok = !s.is_empty()
        && s.len() <= 32
        && !s.is_ascii()
        && !s
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || c.is_ascii_alphabetic());
    ok.then(|| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tags_like_the_interface() {
        assert_eq!(normalize_tag("  #Lista de Compras "), "lista-de-compras");
        assert_eq!(
            clean_tags(&["#Casa", "casa", " ", "Mercado"]),
            vec!["casa", "mercado"]
        );
    }

    #[test]
    fn one_emoji_only() {
        assert_eq!(clean_emoji(" 🚀 ").as_deref(), Some("🚀"));
        assert_eq!(clean_emoji("👩🏽‍💻").as_deref(), Some("👩🏽‍💻"));
        assert_eq!(clean_emoji("a🚀"), None);
        assert_eq!(clean_emoji("🚀 🌱"), None);
        assert_eq!(clean_emoji(""), None);
    }
}

//! Anexos do card, iguais nos dois apps (vieram do Ideario): o hash que dá nome ao anexo (SHA-256 do conteúdo),
//! o tipo e o MIME pelo nome, nomes seguros para gravar, os anexos citados numa nota (`ideario://att/<hash>`), os
//! trechos pedidos pelo player (Range) e, com a feature `media`, o preparo do arquivo: fotos passam pelo
//! [`crate::media`] (WebP, miniatura, paleta e tom); o resto fica como veio.
//!
//! Onde os bytes moram é de cada app (pasta de dados no Ideario, dentro do `.nodo` no Nodo); o que se sabe de um
//! anexo ([`Attachment`]) e as regras são daqui.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// O que se sabe de um anexo (o que a interface recebe; camelCase, como no `CardHost`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub hash: String,
    /// `image`, `video`, `audio`, `pdf`, `sheet`, `doc` ou `other` ([`kind_of`]).
    pub kind: String,
    pub mime: String,
    pub name: String,
    pub bytes: i64,
    /// Tamanho de antes do pipeline, quando ele economizou (a interface soma `orig_bytes - bytes`).
    #[serde(default)]
    pub orig_bytes: Option<i64>,
    #[serde(default)]
    pub width: Option<i64>,
    #[serde(default)]
    pub height: Option<i64>,
    /// 5 cores em `#rrggbb`, da mais presente para a menos (fotos).
    #[serde(default)]
    pub palette: Option<Vec<String>>,
    /// `quente`, `frio`, `verde`, `rosa` ou `neutro` (fotos).
    #[serde(default)]
    pub tone: Option<String>,
    /// Quando entrou, em milissegundos Unix.
    pub added_at: i64,
}

/// O nome do anexo: SHA-256 do conteúdo, em hexadecimal (64 caracteres). Conteúdo igual, anexo igual.
pub fn hash_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn ext_of(name: &str) -> String {
    name.rsplit_once('.')
        .map(|(_, e)| e.to_lowercase())
        .unwrap_or_default()
}

/// Tipo do anexo pelo MIME e pela extensão.
pub fn kind_of(mime: &str, name: &str) -> &'static str {
    let ext = ext_of(name);
    let has = |words: &[&str]| words.iter().any(|w| mime.contains(w));
    if mime.starts_with("image/") {
        "image"
    } else if mime.starts_with("video/") {
        "video"
    } else if mime.starts_with("audio/") {
        "audio"
    } else if mime == "application/pdf" || ext == "pdf" {
        "pdf"
    } else if has(&["sheet", "excel", "csv"])
        || ["xls", "xlsx", "ods", "csv"].contains(&ext.as_str())
    {
        "sheet"
    } else if has(&["word", "document", "text", "rtf"])
        || ["doc", "docx", "odt", "txt", "md", "rtf"].contains(&ext.as_str())
    {
        "doc"
    } else {
        "other"
    }
}

/// Tipo MIME pela extensão (arquivo que chega pelo caminho, ou sem tipo).
pub fn mime_of(name: &str) -> &'static str {
    match ext_of(name).as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "heif" => "image/heif",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "tif" | "tiff" => "image/tiff",
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "wav" => "audio/wav",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "flac" => "audio/flac",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "odt" => "application/vnd.oasis.opendocument.text",
        "ods" => "application/vnd.oasis.opendocument.spreadsheet",
        "rtf" => "application/rtf",
        _ => "application/octet-stream",
    }
}

/// Um nome que pode ser gravado em qualquer sistema: sem pastas, sem os caracteres que o Windows recusa, sem
/// controles e sem pontos nas pontas. Vazio vira `anexo`.
pub fn safe_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let clean: String = base
        .chars()
        .map(|c| {
            if "<>:\"|?*".contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    let clean = clean.trim().trim_matches('.').trim();
    if clean.is_empty() {
        "anexo".to_string()
    } else {
        clean.to_string()
    }
}

/// O nome com outra extensão (`foto.jpg` → `foto.webp`).
pub fn with_extension(name: &str, ext: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, _)) if !stem.is_empty() => format!("{stem}.{ext}"),
        _ => format!("{name}.{ext}"),
    }
}

/// Onde gravar `name` em `dir` sem sobrescrever nada: `nome.pdf`, `nome (1).pdf`, `nome (2).pdf`…
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let safe = safe_name(name);
    let (stem, ext) = match safe.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (safe.clone(), String::new()),
    };
    let mut dest = dir.join(&safe);
    let mut i = 1;
    while dest.exists() {
        dest = dir.join(format!("{stem} ({i}){ext}"));
        i += 1;
    }
    dest
}

/// Os anexos citados num texto de nota (`ideario://att/<hash>`), na ordem, sem repetir.
pub fn referenced(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for part in text.split(crate::markdown::ATT).skip(1) {
        let hash: String = part.chars().take_while(char::is_ascii_hexdigit).collect();
        if !hash.is_empty() && !out.contains(&hash) {
            out.push(hash);
        }
    }
    out
}

/// O hash pedido em `att://localhost/<hash>` (o caminho da URL; só os dígitos hexadecimais).
pub fn hash_from_path(path: &str) -> String {
    path.trim_start_matches('/')
        .chars()
        .filter(char::is_ascii_hexdigit)
        .collect()
}

/// Pedido de miniatura (`att://localhost/<hash>?thumb`).
pub fn wants_thumb(query: Option<&str>) -> bool {
    query.is_some_and(|q| q.split('&').any(|p| p == "thumb"))
}

/// Pedaço máximo para um pedido aberto ("bytes=N-"): o player pede o resto aos poucos, sem ler um vídeo de 500 MB
/// inteiro a cada salto.
pub const CHUNK: u64 = 4 * 1024 * 1024;

/// "bytes=a-b", "bytes=a-" (até [`CHUNK`]) ou "bytes=-n" (os últimos n) → (início, fim) inclusivos.
pub fn parse_range(v: &str, len: u64) -> Option<(u64, u64)> {
    let (a, b) = v
        .strip_prefix("bytes=")?
        .split(',')
        .next()?
        .split_once('-')?;
    let last = len.checked_sub(1)?;
    let (start, end) = match (a.trim(), b.trim()) {
        ("", n) => (len.saturating_sub(n.parse().ok()?), last),
        (a, "") => {
            let a: u64 = a.parse().ok()?;
            (a, a.saturating_add(CHUNK - 1).min(last))
        }
        (a, b) => (a.parse().ok()?, b.parse::<u64>().ok()?.min(last)),
    };
    (start <= end && start < len).then_some((start, end))
}

/// `encodeURIComponent` de volta a texto (nome de arquivo com acento e espaço, vindo num cabeçalho).
pub fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = |b: u8| (b as char).to_digit(16);
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Anexo pronto para gravar: já passou pelo pipeline (fotos) e tem o hash do conteúdo final.
#[cfg(feature = "media")]
pub struct Prepared {
    pub bytes: Vec<u8>,
    /// Miniatura WebP (fotos).
    pub thumb: Option<Vec<u8>>,
    pub att: Attachment,
}

/// O trabalho pesado, sem gravar nada: fotos passam pelo pipeline ([`crate::media::process`]); o resto fica
/// exatamente como veio. `now` é a hora de entrada (milissegundos Unix).
#[cfg(feature = "media")]
pub fn prepare(
    bytes: Vec<u8>,
    name: &str,
    mime: &str,
    quality: crate::media::Quality,
    now: i64,
) -> Prepared {
    let name = safe_name(name);
    let mime = if mime.is_empty() || mime == "application/octet-stream" {
        mime_of(&name)
    } else {
        mime
    };
    let kind = kind_of(mime, &name);
    let orig_len = bytes.len() as i64;
    let processed = if kind == "image" {
        crate::media::process(&bytes, mime, quality).ok()
    } else {
        None
    };
    let (bytes, thumb, att) = match processed {
        Some(p) => {
            let converted = p.mime != mime;
            let smaller = (p.bytes.len() as i64) < orig_len;
            // Virou WebP: o nome acompanha, para o arquivo baixado abrir no programa certo.
            let name = if converted {
                with_extension(&name, "webp")
            } else {
                name
            };
            let att = Attachment {
                hash: String::new(),
                kind: kind.into(),
                mime: p.mime,
                name,
                bytes: p.bytes.len() as i64,
                orig_bytes: (converted && smaller).then_some(orig_len),
                width: Some(i64::from(p.width)),
                height: Some(i64::from(p.height)),
                palette: Some(p.palette),
                tone: Some(p.tone.as_str().into()),
                added_at: now,
            };
            (p.bytes, Some(p.thumb), att)
        }
        None => {
            // Não é foto, ou a foto não pôde ser lida (HEIC, SVG…): guarda como veio.
            let (width, height) = match (kind, imagesize::blob_size(&bytes)) {
                ("image", Ok(s)) => (Some(s.width as i64), Some(s.height as i64)),
                _ => (None, None),
            };
            let att = Attachment {
                hash: String::new(),
                kind: kind.into(),
                mime: mime.into(),
                name,
                bytes: orig_len,
                orig_bytes: None,
                width,
                height,
                palette: None,
                tone: None,
                added_at: now,
            };
            (bytes, None, att)
        }
    };
    let hash = hash_hex(&bytes);
    Prepared {
        bytes,
        thumb,
        att: Attachment { hash, ..att },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_the_full_sha256() {
        let h = hash_hex(b"abc");
        assert_eq!(
            h,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(hash_hex(b"abc"), h, "mesmo conteúdo, mesmo anexo");
    }

    #[test]
    fn kinds() {
        assert_eq!(kind_of("image/png", "a.png"), "image");
        assert_eq!(kind_of("", "Contrato.PDF"), "pdf");
        assert_eq!(
            kind_of(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "x.xlsx"
            ),
            "sheet"
        );
        assert_eq!(kind_of("", "notas.md"), "doc");
        assert_eq!(kind_of("application/zip", "a.zip"), "other");
        assert_eq!(kind_of(mime_of("Foto.JPG"), "Foto.JPG"), "image");
        assert_eq!(kind_of(mime_of("aula.m4a"), "aula.m4a"), "audio");
        assert_eq!(kind_of(mime_of("show.mkv"), "show.mkv"), "video");
        assert_eq!(kind_of(mime_of("faixa.flac"), "faixa.flac"), "audio");
        assert_eq!(kind_of(mime_of("slides.pptx"), "slides.pptx"), "doc");
    }

    #[test]
    fn ranges() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=900-", 1000), Some((900, 999)));
        assert_eq!(
            parse_range("bytes=0-", 100 * 1024 * 1024),
            Some((0, CHUNK - 1)),
            "aberto: só um pedaço"
        );
        assert_eq!(parse_range("bytes=-10", 1000), Some((990, 999)));
        assert_eq!(parse_range("bytes=0-5000", 1000), Some((0, 999)));
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("bytes=0-", 0), None);
        assert_eq!(parse_range("lixo", 1000), None);
    }

    #[test]
    fn names_are_safe_and_never_overwrite() {
        assert_eq!(safe_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_name("C:\\fotos\\a:b?.png"), "a_b_.png");
        assert_eq!(safe_name("..."), "anexo");
        assert_eq!(with_extension("IMG_1.JPG", "webp"), "IMG_1.webp");
        let dir = std::env::temp_dir().join(format!("atrio-unique-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(unique_path(&dir, "a.txt").ends_with("a.txt"));
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        assert!(unique_path(&dir, "a.txt").ends_with("a (1).txt"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn names_with_accents_come_back_and_bad_codes_do_not_panic() {
        assert_eq!(
            percent_decode("F%C3%A9rias%20na%20praia.jpg"),
            "Férias na praia.jpg"
        );
        assert_eq!(percent_decode("sem-codigo.png"), "sem-codigo.png");
        assert_eq!(percent_decode("cortado%2"), "cortado%2");
        assert_eq!(
            percent_decode("%é"),
            "%é",
            "% seguido de letra acentuada não quebra"
        );
        assert_eq!(percent_decode("fim%"), "fim%");
    }

    #[test]
    fn referenced_finds_each_attachment_once() {
        let note = "![praia](ideario://att/abc123) e [📎 roteiro.pdf](ideario://att/def456)\n\n![](ideario://att/abc123)";
        assert_eq!(referenced(note), ["abc123", "def456"]);
        assert_eq!(hash_from_path("/abc123"), "abc123");
        assert!(wants_thumb(Some("thumb")) && wants_thumb(Some("a=1&thumb")) && !wants_thumb(None));
    }

    #[cfg(feature = "media")]
    #[test]
    fn photos_go_through_the_pipeline_and_files_stay_as_they_came() {
        use crate::media::{tests::camera_jpeg, Quality};
        let jpg = camera_jpeg(2400, 1800, 1);
        let p = prepare(
            jpg.clone(),
            "IMG_0042.JPG",
            "image/jpeg",
            Quality::Balanced,
            7,
        );
        assert_eq!(
            (p.att.mime.as_str(), p.att.name.as_str()),
            ("image/webp", "IMG_0042.webp")
        );
        assert_eq!(
            (p.att.width, p.att.height),
            (Some(2048), Some(1536)),
            "Equilibrada: lado maior 2048"
        );
        assert_eq!(p.att.orig_bytes, Some(jpg.len() as i64));
        assert_eq!(p.att.palette.as_ref().map(Vec::len), Some(5));
        assert!(p.thumb.is_some() && p.att.tone.is_some());
        assert_eq!(
            p.att.hash,
            hash_hex(&p.bytes),
            "o hash é do conteúdo guardado"
        );
        assert_eq!(p.att.added_at, 7);
        let f = prepare(b"0123456789".to_vec(), "a.txt", "", Quality::Balanced, 1);
        assert_eq!(
            (f.att.kind.as_str(), f.att.mime.as_str(), f.bytes.as_slice()),
            ("doc", "text/plain", &b"0123456789"[..])
        );
        assert!(f.thumb.is_none());
    }
}

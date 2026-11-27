//! Corpo da nota ↔ Markdown: o MCP dos apps lê e escreve notas como texto, e o Nodo guarda assim a nota de cada tópico.
//!
//! O que o editor tem e como fica aqui:
//! - parágrafo, títulos `#` a `###`, **negrito**, *itálico*, ~~tachado~~, `código`, quebra de linha (uma linha nova
//!   dentro do parágrafo);
//! - citação (`>`), linha divisória (`---`) e tabela (a do GitHub: a primeira linha é o cabeçalho);
//! - listas com marcador, numeradas e checklist (`- [ ]`, `- [x]`), com subitens recuados em vários níveis;
//! - bloco de código (```);
//! - foto `![nome](ideario://att/<hash>)` (várias na mesma linha = fotos lado a lado) e anexo
//!   `[📎 nome](ideario://att/<hash>)`, sozinhos na linha;
//! - parágrafo vazio = `&nbsp;` (sem isso o Markdown perde as linhas em branco da nota);
//! - cartão de link = `[🔗 título](endereço)` sozinho na linha (descrição e imagem ficam guardadas na nota);
//! - prompt (instrução para a IA no meio do texto) = `<prompt>…</prompt>`; link na palavra = `[palavra](endereço)`.
//!
//! O que o editor não tem vira texto: HTML → o texto dele.
//! Ida e volta (nota → Markdown → nota) devolve a mesma nota: é o que deixa o MCP editar um pedaço do texto sem
//! mexer no resto (ver os testes de propriedade).

use pulldown_cmark::{CodeBlockKind, Event, Options, Parser, Tag, TagEnd};
use serde_json::{json, Value};

/// Endereço dos anexos no Markdown: `ideario://att/<hash>` (o esquema nasceu no Ideario e ficou, para não mudar os
/// textos já gravados; o Nodo usa o mesmo).
pub const ATT: &str = "ideario://att/";
const EMPTY_PARAGRAPH: &str = "&nbsp;";
/// Marca do cartão de link no texto do link.
const LINK: &str = "🔗";

/// Endereço como destino de link (entre `<>` se tiver espaço ou parênteses). O Markdown lê entidades e barras
/// invertidas também no endereço: `&` que formaria uma entidade vira `&amp;` e a barra vai dobrada.
fn link_dest(url: &str) -> String {
    let chars: Vec<char> = url.chars().collect();
    let mut safe = String::with_capacity(url.len());
    for (i, c) in chars.iter().enumerate() {
        match c {
            '&' if entity_at(&chars[i..]) => safe.push_str("&amp;"),
            '\\' => safe.push_str("\\\\"),
            _ => safe.push(*c),
        }
    }
    if url.contains([' ', '(', ')', '<', '>']) {
        format!("<{}>", safe.replace('<', "\\<").replace('>', "\\>"))
    } else {
        safe
    }
}
const NBSP: &str = "\u{a0}";

// ---------- nota → Markdown ----------

/// `name` dá o nome do anexo pelo hash (para o texto da foto e do arquivo).
pub fn to_markdown(body: &Value, name: &dyn Fn(&str) -> Option<String>) -> String {
    blocks(children(body), name)
        .into_iter()
        .map(|(_, md)| md)
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Blocos em Markdown, cada um com o tipo. Duas listas seguidas do mesmo tipo virariam uma só: a segunda usa o
/// outro marcador (`*` em vez de `-`, `)` em vez de `.`).
fn blocks<'a>(nodes: &'a [Value], name: &dyn Fn(&str) -> Option<String>) -> Vec<(&'a str, String)> {
    let family = |k: &str| match k {
        "bulletList" | "taskList" => Some('-'),
        "orderedList" => Some('.'),
        _ => None,
    };
    let mut out = Vec::new();
    let mut prev: Option<(char, bool)> = None;
    for n in nodes {
        let fam = family(kind(n));
        let alt = match (fam, prev) {
            (Some(f), Some((p, alt))) if f == p => !alt,
            _ => false,
        };
        prev = fam.map(|f| (f, alt));
        out.push((kind(n), block(n, name, alt)));
    }
    out
}

fn children(node: &Value) -> &[Value] {
    node.get("content")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn kind(node: &Value) -> &str {
    node.get("type").and_then(Value::as_str).unwrap_or("")
}

fn block(node: &Value, name: &dyn Fn(&str) -> Option<String>, alt: bool) -> String {
    match kind(node) {
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|a| a.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(3)
                .clamp(1, 3) as usize;
            format!("{} {}", "#".repeat(level), inline(children(node), true))
        }
        "blockquote" => {
            let inner = blocks(children(node), name)
                .into_iter()
                .map(|(_, md)| md)
                .collect::<Vec<_>>()
                .join("\n\n");
            let inner = if inner.is_empty() {
                EMPTY_PARAGRAPH.to_string()
            } else {
                inner
            };
            inner
                .split('\n')
                .map(|l| {
                    if l.is_empty() {
                        ">".to_string()
                    } else {
                        format!("> {l}")
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
        "horizontalRule" => "---".into(),
        "table" => table(node, name),
        "bulletList" | "orderedList" | "taskList" => list(node, name, alt),
        "codeBlock" => code(node),
        "noteImage" => image(node, name),
        "imageRow" => children(node)
            .iter()
            .map(|i| image(i, name))
            .collect::<Vec<_>>()
            .join(" "),
        "noteFile" => {
            let hash = attr_str(node, "hash");
            format!(
                "[📎 {}]({ATT}{hash})",
                esc_label(&name(hash).unwrap_or_else(|| "arquivo".into()))
            )
        }
        "linkCard" => {
            let url = attr_str(node, "url");
            let title = attr_str(node, "title");
            format!(
                "[{LINK} {}]({})",
                esc(if title.is_empty() { url } else { title }, false, false),
                link_dest(url)
            )
        }
        "paragraph" if children(node).is_empty() => EMPTY_PARAGRAPH.into(),
        // parágrafo (e qualquer outro bloco de texto)
        _ => inline(children(node), false),
    }
}

fn attr_str<'a>(node: &'a Value, key: &str) -> &'a str {
    node.get("attrs")
        .and_then(|a| a.get(key))
        .and_then(Value::as_str)
        .unwrap_or("")
}

fn image(node: &Value, name: &dyn Fn(&str) -> Option<String>) -> String {
    let hash = attr_str(node, "hash");
    format!(
        "![{}]({ATT}{hash})",
        esc_label(&name(hash).unwrap_or_else(|| "foto".into()))
    )
}

fn code(node: &Value) -> String {
    let text: String = children(node)
        .iter()
        .filter_map(|t| t.get("text").and_then(Value::as_str))
        .collect();
    let lang = attr_str(node, "language");
    // A cerca é maior que qualquer sequência de crases do código.
    let longest = text.split(|c| c != '`').map(str::len).max().unwrap_or(0);
    let fence = "`".repeat(longest.max(2) + 1);
    if text.is_empty() {
        format!("{fence}{lang}\n{fence}")
    } else {
        format!("{fence}{lang}\n{text}\n{fence}")
    }
}

fn list(node: &Value, name: &dyn Fn(&str) -> Option<String>, alt: bool) -> String {
    let bullet = if alt { "*" } else { "-" };
    let delim = if alt { ")" } else { "." };
    let start = node
        .get("attrs")
        .and_then(|a| a.get("start"))
        .and_then(Value::as_i64)
        .unwrap_or(1);
    let items: Vec<String> = children(node)
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let marker = match kind(node) {
                "orderedList" => format!("{}{delim} ", start + i as i64),
                "taskList" => {
                    let done = item
                        .get("attrs")
                        .and_then(|a| a.get("checked"))
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    format!("{bullet} [{}] ", if done { "x" } else { " " })
                }
                _ => format!("{bullet} "),
            };
            // O conteúdo do item fica recuado até a coluna do texto do marcador (no checklist, a do "- ").
            let pad = if kind(node) == "taskList" {
                2
            } else {
                marker.len()
            };
            let mut parts: Vec<String> = Vec::new();
            let kids = children(item);
            for (j, (k, text)) in blocks(kids, name).into_iter().enumerate() {
                // Um segundo parágrafo no mesmo item precisa de linha em branco antes; listas e código, não. Lista
                // numerada que não começa no 1 também (senão continua o parágrafo de cima).
                let late_start = k == "orderedList"
                    && kids[j]
                        .get("attrs")
                        .and_then(|a| a.get("start"))
                        .and_then(Value::as_i64)
                        .unwrap_or(1)
                        != 1;
                // Linha divisória logo depois do texto faria dele um título (`a` + `---`); a tabela também precisa.
                if j > 0
                    && (k == "paragraph" || k == "horizontalRule" || k == "table" || late_start)
                {
                    parts.push(String::new());
                }
                parts.push(text);
            }
            let body = if parts.is_empty() {
                String::new()
            } else {
                parts.join("\n")
            };
            let body = if body.is_empty() && kind(node) != "taskList" {
                EMPTY_PARAGRAPH.to_string()
            } else {
                body
            };
            format!("{}{}", marker, indent(&body, pad))
        })
        .collect();
    items.join("\n")
}

/// Recua as linhas depois da primeira (as linhas vazias ficam vazias).
fn indent(s: &str, n: usize) -> String {
    let pad = " ".repeat(n);
    s.split('\n')
        .enumerate()
        .map(|(i, l)| {
            if i == 0 || l.is_empty() {
                l.to_string()
            } else {
                format!("{pad}{l}")
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// O que embrulha um trecho inteiro (vários nós de texto seguidos): o prompt e o link na palavra.
#[derive(PartialEq)]
struct Wrap {
    prompt: bool,
    href: Option<String>,
}

fn wrap_of(n: &Value) -> Wrap {
    let marks = n.get("marks").and_then(Value::as_array);
    let has = |t: &str| marks.is_some_and(|ms| ms.iter().any(|m| m["type"] == t));
    let href = marks
        .and_then(|ms| ms.iter().find(|m| m["type"] == "link"))
        .and_then(|m| m["attrs"]["href"].as_str())
        .filter(|h| !h.is_empty())
        .map(str::to_string);
    Wrap {
        prompt: kind(n) == "text" && has("prompt"),
        href: if kind(n) == "text" { href } else { None },
    }
}

/// Texto com negrito/itálico, prompt (`<prompt>…</prompt>`), link na palavra (`[palavra](endereço)`) e quebras de
/// linha. Trechos seguidos com o mesmo prompt ou o mesmo link saem num embrulho só.
fn inline(nodes: &[Value], heading: bool) -> String {
    let mut out = String::new();
    let mut line_start = true;
    let mut i = 0;
    while i < nodes.len() {
        let wrap = wrap_of(&nodes[i]);
        let mut j = i + 1;
        while j < nodes.len() && wrap_of(&nodes[j]) == wrap {
            j += 1;
        }
        let group = &nodes[i..j];
        i = j;
        if !wrap.prompt && wrap.href.is_none() {
            plain_inline(group, heading, &mut line_start, &mut out);
            continue;
        }
        let mut inner = String::new();
        plain_inline(group, heading, &mut false, &mut inner);
        // Os espaços nas pontas ficam dentro do prompt ou do link (o texto de fora não começa nem acaba ali).
        let mut piece = inner;
        if let Some(href) = &wrap.href {
            // "!" logo antes do "[" faria uma foto
            if out.ends_with('!') && !out.ends_with("\\!") {
                out.pop();
                out.push_str("\\!");
            }
            piece = format!("[{piece}]({})", link_dest(href));
        }
        if wrap.prompt {
            piece = format!("<prompt>{piece}</prompt>");
        }
        out.push_str(&piece);
        line_start = false;
    }
    // espaço no fim do parágrafo some no Markdown
    if out.ends_with([' ', '\t']) {
        encode_edge(&mut out, false);
    }
    out
}

/// Marca que abre e fecha com um delimitador (o código é um trecho inteiro, não entra na pilha).
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
enum Mark {
    Strike,
    Bold,
    Italic,
}

/// Pedaço do Markdown de uma linha de texto: texto já escapado, um delimitador (marca e par) ou a quebra de linha
/// (`true` = linha nova; `false` = `<br>`).
enum Tok {
    Text(String),
    Open(Mark, usize),
    Close(Mark, usize),
    Line(bool),
}

/// Trecho de texto com as marcas dele, ou uma quebra de linha.
enum Seg {
    Text(String, Vec<Mark>, bool),
    Break,
}

fn is_ws(c: Option<char>) -> bool {
    c.map_or(true, char::is_whitespace)
}

/// Pontuação para o CommonMark (a ASCII e os símbolos e sinais do Unicode).
fn is_punct(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_ascii_punctuation() || (!c.is_alphanumeric() && !c.is_whitespace()))
}

/// O caractere como entidade numérica: o Markdown lê de volta o mesmo caractere, mas para as regras de abrir e
/// fechar negrito ele conta como pontuação (`&` e `;`).
fn entity(c: char) -> String {
    format!("&#{};", c as u32)
}

/// Troca o primeiro (ou o último) caractere de um texto por entidade, se for letra ou espaço (o que vem escapado já é
/// pontuação e fica como está).
fn encode_edge(s: &mut String, first: bool) -> bool {
    let c = if first {
        s.chars().next()
    } else {
        s.chars().last()
    };
    match c {
        Some(c) if !is_punct(Some(c)) => {
            if first {
                s.replace_range(..c.len_utf8(), &entity(c));
            } else {
                let at = s.len() - c.len_utf8();
                s.replace_range(at.., &entity(c));
            }
            true
        }
        _ => false,
    }
}

/// Os nós de texto com as marcas simples (negrito, itálico, tachado, código). Uma marca que continua no trecho
/// seguinte fica aberta (`~~comprar **leite** hoje~~`); onde as regras do CommonMark não deixariam o delimitador abrir
/// ou fechar (colado numa letra de um lado e numa pontuação do outro, ou num espaço), o vizinho vira entidade. Na
/// quebra de linha todas as marcas fecham e reabrem depois.
fn plain_inline(nodes: &[Value], heading: bool, line_start: &mut bool, out: &mut String) {
    let mut segs: Vec<Seg> = Vec::new();
    // Trechos seguidos com as mesmas marcas são um só (dois códigos colados viram um só, como no editor).
    let push = |segs: &mut Vec<Seg>, piece: &str, marks: &Vec<Mark>, code: bool| {
        if let Some(Seg::Text(t, ms, c)) = segs.last_mut() {
            if ms == marks && *c == code {
                t.push_str(piece);
                return;
            }
        }
        segs.push(Seg::Text(piece.to_string(), marks.clone(), code));
    };
    for n in nodes {
        match kind(n) {
            "hardBreak" => segs.push(Seg::Break),
            "text" => {
                let text = n.get("text").and_then(Value::as_str).unwrap_or("");
                let names: Vec<&str> = n
                    .get("marks")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|m| m.get("type").and_then(Value::as_str))
                    .collect();
                let mut marks = Vec::new();
                for (name, m) in [
                    ("strike", Mark::Strike),
                    ("bold", Mark::Bold),
                    ("italic", Mark::Italic),
                ] {
                    if names.contains(&name) {
                        marks.push(m);
                    }
                }
                let code = names.contains(&"code");
                // Linhas dentro do trecho (texto colado com "\n"): cada uma como quebra de linha.
                for (k, piece) in text.split('\n').enumerate() {
                    if k > 0 {
                        segs.push(Seg::Break);
                    }
                    if !piece.is_empty() {
                        push(&mut segs, piece, &marks, code);
                    }
                }
            }
            _ => {}
        }
    }

    // Pedaços, com a pilha das marcas abertas.
    let mut toks: Vec<Tok> = Vec::new();
    let mut stack: Vec<(Mark, usize)> = Vec::new();
    let mut pairs = 0usize;
    let mut esc_start = *line_start;
    let mut has_text = !*line_start;
    let close_all = |stack: &mut Vec<(Mark, usize)>, toks: &mut Vec<Tok>| {
        while let Some((m, id)) = stack.pop() {
            toks.push(Tok::Close(m, id));
        }
    };
    for (i, seg) in segs.iter().enumerate() {
        match seg {
            Seg::Break => {
                close_all(&mut stack, &mut toks);
                let next_text = matches!(segs.get(i + 1), Some(Seg::Text(..)));
                let newline = !heading && has_text && next_text;
                toks.push(Tok::Line(newline));
                if newline {
                    esc_start = true;
                    has_text = false;
                }
            }
            Seg::Text(text, marks, code) => {
                // Fecha do topo até a primeira marca aberta que este trecho não tem.
                if let Some(k) = stack.iter().position(|(m, _)| !marks.contains(m)) {
                    while stack.len() > k {
                        if let Some((m, id)) = stack.pop() {
                            toks.push(Tok::Close(m, id));
                        }
                    }
                }
                // Abre as que faltam, primeiro as que duram mais (ficam por fora).
                let lasting = |m: Mark| {
                    segs[i..]
                        .iter()
                        .take_while(|s| matches!(s, Seg::Text(_, ms, _) if ms.contains(&m)))
                        .count()
                };
                let mut new: Vec<Mark> = marks
                    .iter()
                    .copied()
                    .filter(|m| !stack.iter().any(|(o, _)| o == m))
                    .collect();
                new.sort_by_key(|m| (std::cmp::Reverse(lasting(*m)), *m));
                for m in new {
                    toks.push(Tok::Open(m, pairs));
                    stack.push((m, pairs));
                    pairs += 1;
                    esc_start = false;
                }
                let piece = if *code {
                    code_span(text)
                } else {
                    esc(text, esc_start, heading)
                };
                toks.push(Tok::Text(piece));
                esc_start = false;
                has_text = true;
            }
        }
    }
    close_all(&mut stack, &mut toks);

    // O itálico que está dentro de um negrito, tem um dentro ou encosta nele vai com `_`: `*` e `**` juntos podem
    // se casar errado (um `*` colado em pontuação dos dois lados abre e fecha ao mesmo tempo, e fecharia o negrito
    // de fora).
    let mut under = vec![false; pairs];
    let at = |want: &dyn Fn(&Tok) -> bool| toks.iter().position(want);
    for (id, slot) in under.iter_mut().enumerate() {
        let (Some(open), Some(close)) = (
            at(&|t| matches!(t, Tok::Open(Mark::Italic, i) if *i == id)),
            at(&|t| matches!(t, Tok::Close(Mark::Italic, i) if *i == id)),
        ) else {
            continue;
        };
        let bold = |t: &Tok| matches!(t, Tok::Open(Mark::Bold, _) | Tok::Close(Mark::Bold, _));
        let inside = toks[open..=close].iter().any(bold);
        let around = toks[..open]
            .iter()
            .filter(|t| matches!(t, Tok::Open(Mark::Bold, _)))
            .count()
            > toks[..open]
                .iter()
                .filter(|t| matches!(t, Tok::Close(Mark::Bold, _)))
                .count();
        let touching = [open.checked_sub(1), Some(close + 1)]
            .into_iter()
            .flatten()
            .any(|j| toks.get(j).is_some_and(bold));
        *slot = inside || around || touching;
    }
    let delim = |t: &Tok, under: &[bool]| -> Option<(&'static str, bool)> {
        match t {
            Tok::Open(m, id) | Tok::Close(m, id) => Some((
                match m {
                    Mark::Strike => "~~",
                    Mark::Bold => "**",
                    Mark::Italic if under[*id] => "_",
                    Mark::Italic => "*",
                },
                matches!(t, Tok::Open(..)),
            )),
            _ => None,
        }
    };
    // Regras de abrir e fechar do CommonMark: onde falham, o vizinho vira entidade.
    let first = |t: &Tok, under: &[bool]| match t {
        Tok::Text(s) => s.chars().next(),
        Tok::Line(nl) => Some(if *nl { '\n' } else { '<' }),
        _ => delim(t, under).and_then(|(d, _)| d.chars().next()),
    };
    let last = |t: &Tok, under: &[bool]| match t {
        Tok::Text(s) => s.chars().last(),
        Tok::Line(nl) => Some(if *nl { '\n' } else { '>' }),
        _ => delim(t, under).and_then(|(d, _)| d.chars().last()),
    };
    for _ in 0..4 {
        let mut changed = false;
        for i in 0..toks.len() {
            let Some((d, open)) = delim(&toks[i], &under) else {
                continue;
            };
            let p = if i == 0 {
                out.chars().last()
            } else {
                last(&toks[i - 1], &under)
            };
            let n = toks.get(i + 1).and_then(|t| first(t, &under));
            let alnum = |c: Option<char>| !is_ws(c) && !is_punct(c);
            // (codificar o anterior, codificar o seguinte)
            let fix = if open {
                if is_ws(n) {
                    (false, true)
                } else if alnum(p) && (is_punct(n) || d == "_") {
                    (true, false)
                } else {
                    (false, false)
                }
            } else if is_ws(p) && p.is_some() {
                (true, false)
            } else if alnum(n) && (is_punct(p) || d == "_") {
                (false, true)
            } else {
                (false, false)
            };
            if fix.0 {
                changed |= if i == 0 {
                    // o anterior já está no texto de fora (só letra ou espaço cru vira entidade)
                    out.chars().last().is_some_and(|c| !is_punct(Some(c)))
                        && encode_edge(out, false)
                } else if let Tok::Text(s) = &mut toks[i - 1] {
                    encode_edge(s, false)
                } else {
                    false
                };
            }
            if fix.1 {
                if let Some(Tok::Text(s)) = toks.get_mut(i + 1) {
                    changed |= encode_edge(s, true);
                }
            }
        }
        if !changed {
            break;
        }
    }

    for t in &toks {
        match t {
            Tok::Text(s) => out.push_str(s),
            Tok::Line(true) => {
                // espaço no fim da linha some no Markdown
                if out.ends_with([' ', '\t']) {
                    encode_edge(out, false);
                }
                out.push('\n');
            }
            Tok::Line(false) => out.push_str("<br>"),
            _ => {
                if let Some((d, _)) = delim(t, &under) {
                    out.push_str(d);
                }
            }
        }
    }
    *line_start = esc_start && !has_text;
}

/// `código` no meio do texto: a cerca de crases é maior que qualquer sequência de crases de dentro; com crase nas
/// pontas, um espaço de cada lado (que o Markdown tira).
fn code_span(text: &str) -> String {
    let longest = text.split(|c| c != '`').map(str::len).max().unwrap_or(0);
    let fence = "`".repeat(longest + 1);
    // O Markdown tira um espaço de cada ponta quando há nas duas (e o trecho não é só espaço): repõe.
    let spaced = text.starts_with(' ') && text.ends_with(' ') && !text.trim_matches(' ').is_empty();
    if text.starts_with('`') || text.ends_with('`') || spaced {
        format!("{fence} {text} {fence}")
    } else {
        format!("{fence}{text}{fence}")
    }
}

/// As linhas de uma célula da tabela. A célula do Markdown é uma linha só e não leva blocos: uma lista, um código
/// ou uma citação dentro dela viram linhas de texto (`- item`, `- [x] feito`, o código em `trechos`), separadas por
/// `<br>`. A estrutura vira texto, mas nada do que está escrito some. Fotos, anexos e cartões vão como são.
fn cell_lines(node: &Value, name: &dyn Fn(&str) -> Option<String>, out: &mut Vec<String>) {
    match kind(node) {
        "bulletList" | "orderedList" | "taskList" => {
            let start = node
                .get("attrs")
                .and_then(|a| a.get("start"))
                .and_then(Value::as_i64)
                .unwrap_or(1);
            for (i, item) in children(node).iter().enumerate() {
                let marker = match kind(node) {
                    "orderedList" => format!("{}. ", start + i as i64),
                    "taskList" if item["attrs"]["checked"].as_bool() == Some(true) => {
                        "- \\[x\\] ".into()
                    }
                    "taskList" => "- \\[ \\] ".into(),
                    _ => "- ".into(),
                };
                let mut inner = Vec::new();
                for c in children(item) {
                    cell_lines(c, name, &mut inner);
                }
                let mut inner = inner.into_iter();
                out.push(format!("{marker}{}", inner.next().unwrap_or_default()));
                out.extend(inner);
            }
        }
        "blockquote" => {
            for c in children(node) {
                cell_lines(c, name, out);
            }
        }
        "codeBlock" => {
            let text: String = children(node)
                .iter()
                .filter_map(|t| t.get("text").and_then(Value::as_str))
                .collect();
            out.extend(text.split('\n').filter(|l| !l.is_empty()).map(code_span));
        }
        "horizontalRule" => {}
        "noteImage" | "imageRow" | "noteFile" | "linkCard" => out.push(block(node, name, false)),
        _ => out.push(inline(children(node), true)),
    }
}

/// Tabela do GitHub. A primeira linha é o cabeçalho; cada célula é uma linha só (quebra = `<br>`, `|` escapado).
fn table(node: &Value, name: &dyn Fn(&str) -> Option<String>) -> String {
    let rows: Vec<Vec<String>> = children(node)
        .iter()
        .map(|row| {
            children(row)
                .iter()
                .map(|cell| {
                    let mut lines = Vec::new();
                    for c in children(cell) {
                        cell_lines(c, name, &mut lines);
                    }
                    lines.join("<br>").replace('|', "\\|")
                })
                .collect()
        })
        .collect();
    let cols = rows.iter().map(Vec::len).max().unwrap_or(1).max(1);
    let line = |cells: &[String]| {
        let mut cells = cells.to_vec();
        cells.resize(cols, String::new());
        format!("| {} |", cells.join(" | "))
    };
    let mut out = vec![line(rows.first().map(Vec::as_slice).unwrap_or(&[]))];
    out.push(format!("|{}", " --- |".repeat(cols)));
    out.extend(rows.iter().skip(1).map(|r| line(r)));
    out.join("\n")
}

/// Escapa o que o Markdown leria como formatação. No começo da linha, também o que abriria um bloco (título, lista,
/// citação…); num título, todo `#` (senão os do fim somem).
fn esc(text: &str, line_start: bool, heading: bool) -> String {
    let mut out = String::with_capacity(text.len());
    let chars: Vec<char> = text.chars().collect();
    let mut at_start = line_start;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\r' {
            // o Markdown leria como fim de linha
            out.push_str(&entity(c));
            i += 1;
            continue;
        }
        if at_start && (c == ' ' || c == '\t') {
            // espaço (ou tab) no começo da linha some no Markdown (ou abre um bloco de código): guarda como entidade
            out.push_str(&entity(c));
            i += 1;
            continue;
        }
        let special = matches!(c, '\\' | '`' | '*' | '_' | '[' | ']' | '<' | '~')
            || (heading && c == '#')
            || (at_start && matches!(c, '#' | '-' | '+' | '>' | '=' | '|'))
            || (c == '&' && entity_at(&chars[i..]))
            || (c == '!' && chars.get(i + 1) == Some(&'['));
        if at_start && c.is_ascii_digit() {
            // "1." ou "1)" no começo da linha abre lista numerada
            let mut j = i;
            while j < chars.len() && chars[j].is_ascii_digit() {
                j += 1;
            }
            out.extend(&chars[i..j]);
            if matches!(chars.get(j), Some('.') | Some(')')) {
                out.push('\\');
                out.push(chars[j]);
                j += 1;
            }
            i = j;
            at_start = false;
            continue;
        }
        if special {
            out.push('\\');
        }
        out.push(c);
        at_start = false;
        i += 1;
    }
    out
}

/// `&nome;`, `&#123;` ou `&#x1F;` começando aqui (o Markdown trocaria pelo caractere).
fn entity_at(chars: &[char]) -> bool {
    let rest: String = chars.iter().skip(1).take(33).collect();
    let body = rest.split(';').next().unwrap_or("");
    rest.contains(';')
        && !body.is_empty()
        && body.chars().all(|c| c.is_ascii_alphanumeric() || c == '#')
}

/// Texto solto (um título) escapado para uma linha de Markdown.
pub fn escape_line(text: &str) -> String {
    esc(text, true, true)
}

fn esc_label(s: &str) -> String {
    s.chars()
        .flat_map(|c| {
            if matches!(c, '[' | ']' | '\\' | '*' | '_' | '`' | '<') {
                vec!['\\', c]
            } else {
                vec![c]
            }
        })
        .collect()
}

/// O Markdown do cartão de link só leva endereço e título: ao reescrever uma nota (MCP), a descrição, o site e a imagem
/// dos cartões com o mesmo endereço voltam da versão anterior.
pub fn keep_link_meta(old: &Value, new: &mut Value) {
    fn collect<'a>(v: &'a Value, out: &mut Vec<&'a Value>) {
        if kind(v) == "linkCard" {
            out.push(v);
        }
        for c in children(v) {
            collect(c, out);
        }
    }
    fn fill(v: &mut Value, old: &[&Value]) {
        if kind(v) == "linkCard" {
            let url = attr_str(v, "url").to_string();
            if let Some(prev) = old.iter().find(|o| attr_str(o, "url") == url) {
                for k in ["title", "description", "site", "image"] {
                    let missing = v
                        .get("attrs")
                        .and_then(|a| a.get(k))
                        .map_or(true, Value::is_null);
                    if let (true, Some(val)) = (
                        missing,
                        prev.get("attrs")
                            .and_then(|a| a.get(k))
                            .filter(|x| !x.is_null()),
                    ) {
                        v["attrs"][k] = val.clone();
                    }
                }
            }
        }
        if let Some(cs) = v.get_mut("content").and_then(Value::as_array_mut) {
            for c in cs {
                fill(c, old);
            }
        }
    }
    let mut prev = Vec::new();
    collect(old, &mut prev);
    if !prev.is_empty() {
        fill(new, &prev);
    }
}

// ---------- Markdown → nota ----------

/// Bloco em construção.
enum Frame {
    Doc(Vec<Value>),
    Paragraph(Vec<Piece>),
    Heading(u8, Vec<Piece>),
    Quote(Vec<Value>),
    Table(Vec<Value>),
    /// Linha da tabela: se é a do cabeçalho e as células prontas.
    Row(bool, Vec<Value>),
    Cell(Vec<Piece>),
    List {
        ordered: Option<u64>,
        items: Vec<(Option<bool>, Vec<Value>)>,
    },
    Item {
        task: Option<bool>,
        content: Vec<Value>,
        /// O item é um "- [ ]" sem texto, escrito assim (o Markdown não lê como tarefa; `\[ \]` é texto).
        raw_box: Option<bool>,
    },
    Code {
        lang: String,
        text: String,
    },
    /// Link ou imagem: o texto de dentro e o endereço.
    Link {
        url: String,
        image: bool,
        inner: Vec<Piece>,
    },
}

/// Pedaço de texto de um parágrafo.
#[derive(Clone)]
enum Piece {
    /// Texto, as marcas simples e o link na palavra (o endereço).
    Text(String, Vec<&'static str>, Option<String>),
    Break,
    Image(String),
    File(String),
    /// Cartão de link: endereço e título (vazio = sem título).
    Link(String, String),
}

/// Lê Markdown e devolve o corpo no formato do editor (JSON do TipTap, forma canônica).
pub fn from_markdown(md: &str) -> Value {
    let mut stack: Vec<Frame> = vec![Frame::Doc(Vec::new())];
    let mut marks: Vec<&'static str> = Vec::new();
    for (ev, range) in Parser::new_ext(
        md,
        Options::ENABLE_TASKLISTS | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES,
    )
    .into_offset_iter()
    {
        match ev {
            Event::Start(tag) => match tag {
                Tag::Paragraph => stack.push(Frame::Paragraph(Vec::new())),
                Tag::Heading { level, .. } => {
                    // título num item "apertado": fecha o texto do item antes (senão vai junto)
                    close_implicit(&mut stack);
                    stack.push(Frame::Heading((level as u8).clamp(1, 3), Vec::new()))
                }
                Tag::BlockQuote(_) => {
                    close_implicit(&mut stack);
                    stack.push(Frame::Quote(Vec::new()))
                }
                Tag::Table(_) => {
                    close_implicit(&mut stack);
                    stack.push(Frame::Table(Vec::new()))
                }
                Tag::TableHead => stack.push(Frame::Row(true, Vec::new())),
                Tag::TableRow => stack.push(Frame::Row(false, Vec::new())),
                Tag::TableCell => stack.push(Frame::Cell(Vec::new())),
                Tag::Strikethrough => marks.push("strike"),
                Tag::List(start) => {
                    close_implicit(&mut stack);
                    stack.push(Frame::List {
                        ordered: start,
                        items: Vec::new(),
                    })
                }
                Tag::Item => stack.push(Frame::Item {
                    task: None,
                    content: Vec::new(),
                    raw_box: raw_box(md.get(range).unwrap_or("")),
                }),
                Tag::CodeBlock(k) => {
                    close_implicit(&mut stack);
                    let lang = match k {
                        CodeBlockKind::Fenced(info) => {
                            info.split_whitespace().next().unwrap_or("").to_string()
                        }
                        CodeBlockKind::Indented => String::new(),
                    };
                    stack.push(Frame::Code {
                        lang,
                        text: String::new(),
                    })
                }
                Tag::Emphasis => marks.push("italic"),
                Tag::Strong => marks.push("bold"),
                Tag::Link { dest_url, .. } => {
                    open_inline(&mut stack);
                    stack.push(Frame::Link {
                        url: dest_url.to_string(),
                        image: false,
                        inner: Vec::new(),
                    })
                }
                Tag::Image { dest_url, .. } => {
                    open_inline(&mut stack);
                    stack.push(Frame::Link {
                        url: dest_url.to_string(),
                        image: true,
                        inner: Vec::new(),
                    })
                }
                // HTML e o resto: só o conteúdo
                _ => {}
            },
            Event::End(end) => match end {
                TagEnd::Paragraph => {
                    if let Some(Frame::Paragraph(p)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Paragraph(_)))
                    {
                        let blocks = paragraph_blocks(p);
                        push_blocks(&mut stack, blocks);
                    }
                }
                TagEnd::Heading(_) => {
                    if let Some(Frame::Heading(level, p)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Heading(..)))
                    {
                        let node = json!({"type": "heading", "attrs": {"level": level}, "content": inline_nodes(&p)});
                        push_blocks(&mut stack, vec![node]);
                    }
                }
                TagEnd::BlockQuote(_) => {
                    if let Some(Frame::Quote(c)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Quote(_)))
                    {
                        push_blocks(&mut stack, vec![quote_node(c)]);
                    }
                }
                TagEnd::TableCell => {
                    if let Some(Frame::Cell(p)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Cell(_)))
                    {
                        if let Some(Frame::Row(header, cells)) = stack.last_mut() {
                            cells.push(cell_node(*header, &p));
                        }
                    }
                }
                TagEnd::TableHead | TagEnd::TableRow => {
                    if let Some(Frame::Row(_, cells)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Row(..)))
                    {
                        if let Some(Frame::Table(rows)) = stack.last_mut() {
                            rows.push(json!({"type": "tableRow", "content": cells}));
                        }
                    }
                }
                TagEnd::Table => {
                    if let Some(Frame::Table(rows)) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Table(_)))
                    {
                        if !rows.is_empty() {
                            push_blocks(
                                &mut stack,
                                vec![json!({"type": "table", "content": rows})],
                            );
                        }
                    }
                }
                TagEnd::Strikethrough => remove_last(&mut marks, "strike"),
                TagEnd::Item => {
                    close_implicit(&mut stack);
                    if let Some(Frame::Item {
                        task,
                        content,
                        raw_box,
                    }) = pop_if(&mut stack, |f| matches!(f, Frame::Item { .. }))
                    {
                        if let Some(Frame::List { items, .. }) = stack.last_mut() {
                            items.push(item_done(task, content, raw_box));
                        }
                    }
                }
                TagEnd::List(_) => {
                    if let Some(Frame::List { ordered, items }) =
                        pop_if(&mut stack, |f| matches!(f, Frame::List { .. }))
                    {
                        let node = list_node(ordered, items);
                        push_blocks(&mut stack, vec![node]);
                    }
                }
                TagEnd::CodeBlock => {
                    if let Some(Frame::Code { lang, text }) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Code { .. }))
                    {
                        let text = text.strip_suffix('\n').unwrap_or(&text).to_string();
                        let mut node = json!({"type": "codeBlock"});
                        if !lang.is_empty() {
                            node["attrs"] = json!({"language": lang});
                        }
                        if !text.is_empty() {
                            node["content"] = json!([{"type": "text", "text": text}]);
                        }
                        push_blocks(&mut stack, vec![node]);
                    }
                }
                TagEnd::Emphasis => remove_last(&mut marks, "italic"),
                TagEnd::Strong => remove_last(&mut marks, "bold"),
                TagEnd::Link | TagEnd::Image => {
                    if let Some(Frame::Link { url, image, inner }) =
                        pop_if(&mut stack, |f| matches!(f, Frame::Link { .. }))
                    {
                        let pieces = link_pieces(url, image, inner);
                        for p in pieces {
                            push_piece(&mut stack, p);
                        }
                    }
                }
                _ => {}
            },
            Event::Text(t) => {
                if let Some(Frame::Code { text, .. }) = stack.last_mut() {
                    text.push_str(&t);
                } else {
                    push_text(&mut stack, &t, &marks);
                }
            }
            Event::InlineHtml(t) if is_br(&t) => push_piece(&mut stack, Piece::Break),
            // o prompt no meio do texto: uma marca, como o negrito
            Event::InlineHtml(t) if prompt_tag(&t) == Some(true) => marks.push("prompt"),
            Event::InlineHtml(t) if prompt_tag(&t) == Some(false) => {
                remove_last(&mut marks, "prompt")
            }
            Event::Code(t) => {
                let mut with_code = marks.clone();
                with_code.push("code");
                push_text(&mut stack, &t, &with_code)
            }
            // HTML no meio do texto: o texto como está
            Event::InlineHtml(t) | Event::InlineMath(t) | Event::DisplayMath(t) => {
                push_text(&mut stack, &t, &marks)
            }
            Event::Rule => {
                close_implicit(&mut stack);
                push_blocks(&mut stack, vec![json!({"type": "horizontalRule"})]);
            }
            // parágrafo que é só quebra de linha: o Markdown lê `<br>` sozinho na linha como bloco de HTML
            Event::Html(t) if br_count(&t) > 0 => {
                for _ in 0..br_count(&t) {
                    push_piece(&mut stack, Piece::Break);
                }
            }
            Event::Html(t) => {
                let t = t.trim_end_matches('\n').to_string();
                push_text(&mut stack, &t, &marks)
            }
            Event::SoftBreak | Event::HardBreak => push_piece(&mut stack, Piece::Break),
            Event::TaskListMarker(done) => {
                if let Some(Frame::Item { task, .. }) = find_item(&mut stack) {
                    *task = Some(done);
                }
            }
            _ => {}
        }
    }
    // Markdown malformado não deixa nada para trás: fecha o que ficou aberto.
    while stack.len() > 1 {
        close_implicit(&mut stack);
        if stack.len() > 1 {
            let top = stack.pop();
            let blocks = match top {
                Some(Frame::Paragraph(p)) => paragraph_blocks(p),
                Some(Frame::Heading(level, p)) => vec![
                    json!({"type": "heading", "attrs": {"level": level}, "content": inline_nodes(&p)}),
                ],
                Some(Frame::Quote(c)) => vec![quote_node(c)],
                Some(Frame::Cell(p)) => {
                    if let Some(Frame::Row(header, cells)) = stack.last_mut() {
                        cells.push(cell_node(*header, &p));
                    }
                    vec![]
                }
                Some(Frame::Row(_, cells)) => {
                    if let Some(Frame::Table(rows)) = stack.last_mut() {
                        rows.push(json!({"type": "tableRow", "content": cells}));
                    }
                    vec![]
                }
                Some(Frame::Table(rows)) if !rows.is_empty() => {
                    vec![json!({"type": "table", "content": rows})]
                }
                Some(Frame::List { ordered, items }) => vec![list_node(ordered, items)],
                Some(Frame::Item {
                    task,
                    content,
                    raw_box,
                }) => {
                    if let Some(Frame::List { items, .. }) = stack.last_mut() {
                        items.push(item_done(task, content, raw_box));
                    }
                    vec![]
                }
                Some(Frame::Code { text, .. }) => {
                    vec![json!({"type": "codeBlock", "content": [{"type": "text", "text": text}]})]
                }
                Some(Frame::Link { url, image, inner }) => {
                    for p in link_pieces(url, image, inner) {
                        push_piece(&mut stack, p);
                    }
                    vec![]
                }
                _ => vec![],
            };
            push_blocks(&mut stack, blocks);
        }
    }
    let content = match stack.pop() {
        Some(Frame::Doc(c)) if !c.is_empty() => c,
        _ => vec![json!({"type": "paragraph"})],
    };
    crate::canon::canon(&json!({"type": "doc", "content": content}))
}

/// Citação: os blocos de dentro (pelo menos um parágrafo, o editor exige).
fn quote_node(content: Vec<Value>) -> Value {
    let content = if content.is_empty() {
        vec![json!({"type": "paragraph"})]
    } else {
        content
    };
    json!({"type": "blockquote", "content": content})
}

/// Célula da tabela: o texto num parágrafo (cabeçalho na primeira linha); fotos e anexos da célula, os blocos deles.
fn cell_node(header: bool, pieces: &[Piece]) -> Value {
    let content = paragraph_blocks(pieces.to_vec());
    json!({"type": if header { "tableHeader" } else { "tableCell" }, "attrs": {"colspan": 1, "rowspan": 1}, "content": content})
}

/// Quantos `<br>` há num bloco de HTML feito só deles (0 se há outra coisa).
fn br_count(html: &str) -> usize {
    let t: String = html
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_ascii_lowercase()
        .replace("<br/>", "<br>");
    let n = t.matches("<br>").count();
    if n > 0 && t.len() == n * 4 {
        n
    } else {
        0
    }
}

fn is_br(html: &str) -> bool {
    let t: String = html
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_ascii_lowercase();
    matches!(t.as_str(), "<br>" | "<br/>")
}

fn remove_last(marks: &mut Vec<&'static str>, m: &str) {
    if let Some(i) = marks.iter().rposition(|x| *x == m) {
        marks.remove(i);
    }
}

fn pop_if(stack: &mut Vec<Frame>, f: impl Fn(&Frame) -> bool) -> Option<Frame> {
    close_implicit_unless(stack, &f);
    if stack.last().is_some_and(&f) {
        stack.pop()
    } else {
        None
    }
}

/// Item de lista "apertada": o texto vem sem parágrafo. Abre um parágrafo implícito para ele.
fn open_inline(stack: &mut Vec<Frame>) {
    if matches!(
        stack.last(),
        Some(Frame::Item { .. }) | Some(Frame::Doc(_)) | Some(Frame::Quote(_))
    ) {
        stack.push(Frame::Paragraph(Vec::new()));
    }
}

/// Fecha o parágrafo implícito aberto por `open_inline` (antes de um bloco ou do fim do item).
fn close_implicit(stack: &mut Vec<Frame>) {
    close_implicit_unless(stack, &|_| false)
}

fn close_implicit_unless(stack: &mut Vec<Frame>, keep: &dyn Fn(&Frame) -> bool) {
    let implicit = stack.len() >= 2
        && matches!(stack.last(), Some(Frame::Paragraph(_)))
        && matches!(
            stack.get(stack.len() - 2),
            Some(Frame::Item { .. }) | Some(Frame::Doc(_)) | Some(Frame::Quote(_))
        )
        && !stack.last().is_some_and(keep);
    if implicit {
        if let Some(Frame::Paragraph(p)) = stack.pop() {
            let blocks = paragraph_blocks(p);
            push_blocks(stack, blocks);
        }
    }
}

fn find_item(stack: &mut [Frame]) -> Option<&mut Frame> {
    stack
        .iter_mut()
        .rev()
        .find(|f| matches!(f, Frame::Item { .. }))
}

fn push_text(stack: &mut Vec<Frame>, t: &str, marks: &[&'static str]) {
    // Linhas dentro de um texto (HTML, código inline com quebra): quebras de linha.
    for (i, line) in t.split('\n').enumerate() {
        if i > 0 {
            push_piece(stack, Piece::Break);
        }
        if !line.is_empty() {
            push_piece(stack, Piece::Text(line.to_string(), marks.to_vec(), None));
        }
    }
}

fn push_piece(stack: &mut Vec<Frame>, p: Piece) {
    open_inline(stack);
    match stack.last_mut() {
        Some(Frame::Paragraph(v))
        | Some(Frame::Heading(_, v))
        | Some(Frame::Link { inner: v, .. })
        | Some(Frame::Cell(v)) => v.push(p),
        Some(Frame::Code { text, .. }) => {
            if let Piece::Text(t, ..) = p {
                text.push_str(&t)
            }
        }
        _ => {}
    }
}

fn push_blocks(stack: &mut [Frame], blocks: Vec<Value>) {
    match stack.last_mut() {
        Some(Frame::Doc(c)) | Some(Frame::Item { content: c, .. }) | Some(Frame::Quote(c)) => {
            c.extend(blocks)
        }
        // bloco dentro de algo que só leva texto (não acontece com Markdown bem formado): vira texto
        Some(Frame::Paragraph(v)) | Some(Frame::Heading(_, v)) | Some(Frame::Cell(v)) => {
            for b in blocks {
                let text = plain(&b);
                if !text.is_empty() {
                    v.push(Piece::Text(text, vec![], None));
                }
            }
        }
        _ => {}
    }
}

fn plain(node: &Value) -> String {
    match node.get("text").and_then(Value::as_str) {
        Some(t) => t.to_string(),
        None => children(node)
            .iter()
            .map(plain)
            .collect::<Vec<_>>()
            .join(" "),
    }
}

/// `<prompt>` abre (`Some(true)`), `</prompt>` fecha (`Some(false)`); outra coisa, `None`.
fn prompt_tag(html: &str) -> Option<bool> {
    match html.trim().to_ascii_lowercase().as_str() {
        "<prompt>" => Some(true),
        "</prompt>" => Some(false),
        _ => None,
    }
}

/// Link e imagem: anexo do Ideario vira foto/arquivo; o resto, o link na palavra.
fn link_pieces(url: String, image: bool, inner: Vec<Piece>) -> Vec<Piece> {
    if let Some(hash) = url.strip_prefix(ATT) {
        let hash = hash.trim_end_matches('/').to_string();
        return vec![if image {
            Piece::Image(hash)
        } else {
            Piece::File(hash)
        }];
    }
    let label: String = inner
        .iter()
        .filter_map(|p| {
            if let Piece::Text(t, ..) = p {
                Some(t.as_str())
            } else {
                None
            }
        })
        .collect();
    if let Some(title) = label.strip_prefix(LINK) {
        if !image && !url.is_empty() {
            let title = title.trim();
            return vec![Piece::Link(
                url.clone(),
                if title == url {
                    String::new()
                } else {
                    title.to_string()
                },
            )];
        }
    }
    let mut out: Vec<Piece> = inner
        .into_iter()
        .filter(|p| !matches!(p, Piece::Image(_) | Piece::File(_)))
        .collect();
    if out.is_empty() {
        out.push(Piece::Text(url.clone(), vec![], None));
    }
    // O link fica na palavra (uma imagem de fora não é anexo da nota: fica só o texto).
    if !url.is_empty() && !image {
        for p in &mut out {
            if let Piece::Text(_, _, link) = p {
                *link = Some(url.clone());
            }
        }
    }
    out
}

/// Parágrafo → blocos: fotos e anexos sozinhos viram os blocos deles; texto com foto no meio se divide.
fn paragraph_blocks(pieces: Vec<Piece>) -> Vec<Value> {
    let mut out = Vec::new();
    let mut text: Vec<Piece> = Vec::new();
    let mut images: Vec<String> = Vec::new();
    // Quebras de linha em volta de uma foto, um anexo ou um cartão não contam (separam o texto do bloco); as do
    // texto, sim (`<br>` no começo ou no fim do parágrafo).
    let mut after_block = false;
    let flush_text =
        |text: &mut Vec<Piece>, out: &mut Vec<Value>, before_block: bool, after_block: bool| {
            while before_block && matches!(text.last(), Some(Piece::Break)) {
                text.pop();
            }
            while after_block && matches!(text.first(), Some(Piece::Break)) {
                text.remove(0);
            }
            let blank = text
                .iter()
                .all(|p| matches!(p, Piece::Text(t, ..) if t.trim().is_empty()));
            if !text.is_empty() && !blank {
                out.push(json!({"type": "paragraph", "content": inline_nodes(text)}));
            }
            text.clear();
        };
    let flush_images = |images: &mut Vec<String>, out: &mut Vec<Value>| {
        for chunk in images.chunks(4) {
            let imgs: Vec<Value> = chunk
                .iter()
                .map(|h| json!({"type": "noteImage", "attrs": {"hash": h}}))
                .collect();
            out.push(if imgs.len() == 1 {
                imgs[0].clone()
            } else {
                json!({"type": "imageRow", "content": imgs})
            });
        }
        images.clear();
    };
    let only_space = |pieces: &[Piece]| {
        pieces.iter().all(|p| {
            matches!(p, Piece::Break) || matches!(p, Piece::Text(t, ..) if t.trim().is_empty())
        })
    };
    // parágrafo vazio da nota
    if pieces.len() == 1 && matches!(&pieces[0], Piece::Text(t, ..) if t == NBSP) {
        return vec![json!({"type": "paragraph"})];
    }
    for p in pieces {
        match p {
            Piece::Image(h) => {
                if !only_space(&text) {
                    flush_text(&mut text, &mut out, true, after_block);
                }
                text.clear();
                images.push(h);
                after_block = true;
            }
            Piece::File(h) => {
                flush_images(&mut images, &mut out);
                flush_text(&mut text, &mut out, true, after_block);
                out.push(json!({"type": "noteFile", "attrs": {"hash": h}}));
                after_block = true;
            }
            Piece::Link(url, title) => {
                flush_images(&mut images, &mut out);
                flush_text(&mut text, &mut out, true, after_block);
                after_block = true;
                let mut attrs = json!({"url": url});
                if !title.is_empty() {
                    attrs["title"] = json!(title);
                }
                out.push(json!({"type": "linkCard", "attrs": attrs}));
            }
            other => {
                // espaço entre fotos da mesma linha não quebra a linha de fotos
                let space = matches!(&other, Piece::Text(t, ..) if t.trim().is_empty());
                if !(space && !images.is_empty()) {
                    flush_images(&mut images, &mut out);
                    text.push(other);
                }
            }
        }
    }
    flush_images(&mut images, &mut out);
    flush_text(&mut text, &mut out, false, after_block);
    if out.is_empty() {
        out.push(json!({"type": "paragraph"}));
    }
    out
}

fn inline_nodes(pieces: &[Piece]) -> Vec<Value> {
    let mut out = Vec::new();
    for p in pieces {
        match p {
            Piece::Text(t, marks, link) => {
                let mut node = json!({"type": "text", "text": t});
                let mut ms: Vec<&str> = marks.clone();
                if link.is_some() {
                    ms.push("link");
                }
                ms.sort_unstable();
                ms.dedup();
                if !ms.is_empty() {
                    node["marks"] = Value::Array(
                        ms.iter()
                            .map(|m| match (*m, link) {
                                ("link", Some(href)) => {
                                    json!({"type": "link", "attrs": {"href": href}})
                                }
                                _ => json!({"type": m}),
                            })
                            .collect(),
                    );
                }
                out.push(node);
            }
            Piece::Break => out.push(json!({"type": "hardBreak"})),
            _ => {}
        }
    }
    out
}

/// Linha do item no Markdown, sem o marcador: `[ ]` ou `[x]` sozinhos são a caixinha de um item de checklist sem
/// texto (o Markdown não lê assim; escapado, `\[ \]`, é o texto de um item comum).
fn raw_box(src: &str) -> Option<bool> {
    let line = src.lines().next().unwrap_or("").trim_start();
    let rest = line.strip_prefix(['-', '*', '+']).unwrap_or_else(|| {
        line.trim_start_matches(|c: char| c.is_ascii_digit())
            .trim_start_matches(['.', ')'])
    });
    match rest.trim() {
        "[ ]" => Some(false),
        "[x]" | "[X]" => Some(true),
        _ => None,
    }
}

/// O item pronto: um "- [ ]" sem texto vira o item de checklist vazio.
fn item_done(
    task: Option<bool>,
    content: Vec<Value>,
    raw_box: Option<bool>,
) -> (Option<bool>, Vec<Value>) {
    let only_box = matches!(content.as_slice(), [p] if kind(p) == "paragraph"
        && matches!(children(p).iter().filter_map(|t| t.get("text").and_then(Value::as_str)).collect::<String>().as_str(), "[ ]" | "[x]" | "[X]"));
    match (task, raw_box) {
        (None, Some(done)) if only_box => (Some(done), vec![json!({"type": "paragraph"})]),
        _ => (task, content),
    }
}

fn list_node(ordered: Option<u64>, items: Vec<(Option<bool>, Vec<Value>)>) -> Value {
    let task = items.iter().any(|(t, _)| t.is_some());
    let items: Vec<Value> = items
        .into_iter()
        .map(|(done, mut content)| {
            // o item começa sempre com um parágrafo (o editor exige)
            if content.first().map(kind) != Some("paragraph") {
                content.insert(0, json!({"type": "paragraph"}));
            }
            if task {
                json!({"type": "taskItem", "attrs": {"checked": done.unwrap_or(false)}, "content": content})
            } else {
                json!({"type": "listItem", "content": content})
            }
        })
        .collect();
    match (task, ordered) {
        (true, _) => json!({"type": "taskList", "content": items}),
        (false, Some(start)) => {
            json!({"type": "orderedList", "attrs": {"start": start}, "content": items})
        }
        (false, None) => json!({"type": "bulletList", "content": items}),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(h: &str) -> Option<String> {
        Some(format!("arquivo-{}", &h[..4.min(h.len())]))
    }

    fn back(body: &Value) -> Value {
        from_markdown(&to_markdown(body, &names))
    }

    #[test]
    fn reads_what_people_write() {
        let md = "Mercado da semana\n\n### Hortifruti\n\n- [ ] Tomate\n- [x] Cebola\n  - [ ] Roxa\n\n1. um\n2. dois\n\n- solto\n\nlinha 1\nlinha 2";
        let doc = from_markdown(md);
        let c = doc["content"].as_array().unwrap();
        assert_eq!(
            c[0],
            json!({"type":"paragraph","content":[{"type":"text","text":"Mercado da semana"}]})
        );
        assert_eq!(
            c[1],
            json!({"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Hortifruti"}]})
        );
        assert_eq!(c[2]["type"], "taskList");
        assert_eq!(c[2]["content"][1]["attrs"]["checked"], true);
        assert_eq!(
            c[2]["content"][1]["content"][1]["type"], "taskList",
            "subitem"
        );
        assert_eq!(
            c[3],
            json!({"type":"orderedList","attrs":{"start":1},"content":[
            {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"um"}]}]},
            {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"dois"}]}]}]})
        );
        assert_eq!(c[4]["type"], "bulletList");
        assert_eq!(
            c[5],
            json!({"type":"paragraph","content":[{"type":"text","text":"linha 1"},{"type":"hardBreak"},{"type":"text","text":"linha 2"}]})
        );
    }

    #[test]
    fn photos_and_files_by_hash() {
        let md = "![praia](ideario://att/aaaa1111) ![sol](ideario://att/bbbb2222)\n\n![](ideario://att/cccc3333)\n\n[📎 contrato.pdf](ideario://att/dddd4444)";
        let doc = from_markdown(md);
        assert_eq!(
            doc["content"][0],
            json!({"type":"imageRow","content":[{"type":"noteImage","attrs":{"hash":"aaaa1111"}},{"type":"noteImage","attrs":{"hash":"bbbb2222"}}]})
        );
        assert_eq!(
            doc["content"][1],
            json!({"type":"noteImage","attrs":{"hash":"cccc3333"}})
        );
        assert_eq!(
            doc["content"][2],
            json!({"type":"noteFile","attrs":{"hash":"dddd4444"}})
        );
        assert_eq!(to_markdown(&doc, &names), "![arquivo-aaaa](ideario://att/aaaa1111) ![arquivo-bbbb](ideario://att/bbbb2222)\n\n![arquivo-cccc](ideario://att/cccc3333)\n\n[📎 arquivo-dddd](ideario://att/dddd4444)");
    }

    #[test]
    fn what_the_editor_lacks_becomes_text() {
        let doc = from_markdown(
            "Veja [o site](https://ideario.app) e <https://x.y>\n\n<b>negrito</b> em HTML",
        );
        let c = doc["content"].as_array().unwrap();
        // O link fica na palavra (antes virava "o site (https://ideario.app)").
        assert_eq!(
            c[0]["content"],
            json!([
                {"type":"text","text":"Veja "},
                {"type":"text","text":"o site","marks":[{"type":"link","attrs":{"href":"https://ideario.app"}}]},
                {"type":"text","text":" e "},
                {"type":"text","text":"https://x.y","marks":[{"type":"link","attrs":{"href":"https://x.y"}}]},
            ])
        );
        assert_eq!(
            c[1]["content"][0]["text"], "<b>negrito</b> em HTML",
            "HTML fica como texto"
        );
    }

    #[test]
    fn prompt_in_the_middle_of_the_text_goes_and_comes_back() {
        let p = |text: &str, marks: Value| json!({"type":"text","text":text,"marks":marks});
        let doc = json!({"type":"doc","content":[{"type":"paragraph","content":[
            {"type":"text","text":"Revisar o orçamento "},
            p("resuma em ", json!([{"type":"prompt"}])),
            p("3 tópicos", json!([{"type":"bold"},{"type":"prompt"}])),
            {"type":"text","text":" antes."},
        ]}]});
        let md = to_markdown(&doc, &|_: &str| None);
        assert_eq!(
            md,
            "Revisar o orçamento <prompt>resuma em **3 tópicos**</prompt> antes."
        );
        assert_eq!(from_markdown(&md), crate::canon::canon(&doc));
        // Texto comum com colchetes e com a palavra "prompt" não vira prompt.
        let plain = json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"[rascunho] <prompt>"}]}]});
        assert_eq!(
            from_markdown(&to_markdown(&plain, &|_: &str| None)),
            crate::canon::canon(&plain)
        );
    }

    #[test]
    fn link_on_a_word_goes_and_comes_back() {
        let l = |text: &str, href: &str| json!({"type":"text","text":text,"marks":[{"type":"link","attrs":{"href":href}}]});
        let doc = json!({"type":"doc","content":[{"type":"paragraph","content":[
            {"type":"text","text":"Ver a "},
            l("Apresentação", "https://exemplo.com/p/3fe9"),
            {"type":"text","text":" e o "},
            l("roteiro (v2)", "https://exemplo.com/a b(1)"),
            {"type":"text","text":"!"},
        ]}]});
        let md = to_markdown(&doc, &|_: &str| None);
        assert!(
            md.starts_with("Ver a [Apresentação](https://exemplo.com/p/3fe9) e o "),
            "{md}"
        );
        assert_eq!(from_markdown(&md), crate::canon::canon(&doc));
        // O cartão de link (sozinho na linha) continua sendo o cartão.
        let card = from_markdown("[🔗 Planilha](https://exemplo.com/s)");
        assert_eq!(card["content"][0]["type"], "linkCard");
    }

    #[test]
    fn titles_quotes_rules_strike_and_code() {
        let doc = from_markdown("# Grande\n\n## Médio\n\n> citação\n> - item\n\n~~riscado~~ e `código`\n\n---\n\n#### Pequeno demais");
        let c = doc["content"].as_array().unwrap();
        assert_eq!(
            c[0],
            json!({"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Grande"}]})
        );
        assert_eq!(c[1]["attrs"]["level"], 2);
        assert_eq!(c[2]["type"], "blockquote");
        assert_eq!(c[2]["content"][0]["content"][0]["text"], "citação");
        assert_eq!(c[2]["content"][1]["type"], "bulletList");
        assert_eq!(
            c[3]["content"][0],
            json!({"type":"text","text":"riscado","marks":[{"type":"strike"}]})
        );
        assert_eq!(
            c[3]["content"][2],
            json!({"type":"text","text":"código","marks":[{"type":"code"}]})
        );
        assert_eq!(c[4], json!({"type":"horizontalRule"}));
        assert_eq!(
            c[5]["attrs"]["level"], 3,
            "#### vira o menor título que o editor tem"
        );
    }

    #[test]
    fn tables() {
        let md = "| Item | Qtd |\n| --- | --- |\n| Arroz | 2 kg |\n| Feijão \\| preto |  |";
        let doc = from_markdown(md);
        let t = &doc["content"][0];
        assert_eq!(t["type"], "table");
        assert_eq!(t["content"][0]["content"][0]["type"], "tableHeader");
        assert_eq!(
            t["content"][1]["content"][1]["content"][0]["content"][0]["text"],
            "2 kg"
        );
        assert_eq!(
            t["content"][2]["content"][0]["content"][0]["content"][0]["text"],
            "Feijão | preto"
        );
        assert_eq!(
            t["content"][2]["content"][1]["content"][0],
            json!({"type":"paragraph"}),
            "célula vazia"
        );
        assert_eq!(to_markdown(&doc, &names), md);
    }

    #[test]
    fn empty_lines_of_the_note_survive() {
        let doc = json!({"type":"doc","content":[
            {"type":"paragraph","content":[{"type":"text","text":"a"}]},{"type":"paragraph"},{"type":"paragraph"},
            {"type":"paragraph","content":[{"type":"text","text":"b"}]}]});
        assert_eq!(to_markdown(&doc, &names), "a\n\n&nbsp;\n\n&nbsp;\n\nb");
        assert_eq!(back(&doc), doc);
    }

    #[test]
    fn text_that_looks_like_markdown_stays_text() {
        for t in [
            "# não é título",
            "- nem lista",
            "1. nem número",
            "**nem negrito**",
            "a_b_c",
            "[x] colchete",
            "&amp; literal",
            "> nem citação",
            "`crase`",
            "<b>tag</b>",
            "fim #",
        ] {
            let doc = json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":t}]}]});
            assert_eq!(back(&doc), doc, "{t:?} → {:?}", to_markdown(&doc, &names));
        }
    }

    #[test]
    fn link_cards() {
        let md = "[🔗 Receita de bolo](https://exemplo.com/bolo)\n\n[🔗 https://x.y/z](https://x.y/z)\n\nveja [o site](https://a.b)";
        let doc = from_markdown(md);
        assert_eq!(
            doc["content"][0],
            json!({"type":"linkCard","attrs":{"url":"https://exemplo.com/bolo","title":"Receita de bolo"}})
        );
        assert_eq!(
            doc["content"][1],
            json!({"type":"linkCard","attrs":{"url":"https://x.y/z"}})
        );
        assert_eq!(
            doc["content"][2]["type"], "paragraph",
            "link no meio do texto continua texto"
        );
        // reescrever pelo MCP não perde a descrição nem a imagem
        let old = json!({"type":"doc","content":[{"type":"linkCard","attrs":{"url":"https://exemplo.com/bolo","title":"Receita","description":"A melhor","image":"data:image/webp;base64,AAA"}}]});
        let mut new = from_markdown("Antes\n\n[🔗 Receita de bolo](https://exemplo.com/bolo)");
        keep_link_meta(&old, &mut new);
        assert_eq!(
            new["content"][1]["attrs"],
            json!({"url":"https://exemplo.com/bolo","title":"Receita de bolo","description":"A melhor","image":"data:image/webp;base64,AAA"})
        );
        assert_eq!(
            to_markdown(&old, &names),
            "[🔗 Receita](https://exemplo.com/bolo)"
        );
    }

    #[test]
    fn nothing_is_an_empty_note() {
        assert_eq!(
            from_markdown(""),
            json!({"type":"doc","content":[{"type":"paragraph"}]})
        );
        assert_eq!(
            from_markdown("- [ ]"),
            json!({"type":"doc","content":[{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph"}]}]}]})
        );
    }

    fn tx(s: &str) -> Value {
        json!({"type":"text","text":s})
    }
    fn mk(s: &str, marks: &[&str]) -> Value {
        json!({"type":"text","text":s,"marks": marks.iter().map(|k| json!({"type":k})).collect::<Vec<_>>()})
    }
    fn para(c: Vec<Value>) -> Value {
        json!({"type":"paragraph","content":c})
    }
    fn one(c: Vec<Value>) -> Value {
        json!({"type":"doc","content":c})
    }
    fn br() -> Value {
        json!({"type":"hardBreak"})
    }
    /// Ida e volta igual; devolve o Markdown para conferir a forma.
    fn same(label: &str, doc: Value) -> String {
        let md = to_markdown(&doc, &names);
        assert_eq!(
            from_markdown(&md),
            crate::canon::canon(&doc),
            "{label}: {md:?}"
        );
        md
    }

    #[test]
    fn marks_glued_to_letters_and_punctuation_come_back() {
        same(
            "negrito com dois-pontos",
            one(vec![para(vec![mk("Nota:", &["bold"]), tx("texto")])]),
        );
        same(
            "letra antes de negrito com %",
            one(vec![para(vec![tx("dez"), mk("%", &["bold"])])]),
        );
        same(
            "tachado com !",
            one(vec![para(vec![mk("feito!", &["strike"]), tx("ok")])]),
        );
        same(
            "itálico com aspas",
            one(vec![para(vec![
                tx("ver "),
                mk("“livro”", &["italic"]),
                tx("s"),
            ])]),
        );
        same(
            "negrito começando com *",
            one(vec![para(vec![tx("x"), mk("*a", &["bold"])])]),
        );
        same(
            "negrito e itálico vizinhos",
            one(vec![para(vec![mk("a", &["bold"]), mk("b", &["italic"])])]),
        );
        same(
            "itálico e negrito vizinhos",
            one(vec![para(vec![mk("a", &["italic"]), mk("b", &["bold"])])]),
        );
        same(
            "negrito e negrito+itálico",
            one(vec![para(vec![
                mk("a", &["bold"]),
                mk("b", &["bold", "italic"]),
            ])]),
        );
        same(
            "negrito+código ao lado",
            one(vec![para(vec![tx("um"), mk("dois", &["bold", "code"])])]),
        );
        same(
            "tachado e tachado+negrito",
            one(vec![para(vec![
                mk("um", &["strike"]),
                mk("dois", &["strike", "bold"]),
            ])]),
        );
        same(
            "negrito no meio da palavra",
            one(vec![para(vec![tx("pre"), mk("fix", &["bold"]), tx("o")])]),
        );
        same(
            "itálico no meio da palavra",
            one(vec![para(vec![tx("pre"), mk("fix", &["italic"]), tx("o")])]),
        );
        same(
            "código e negrito",
            one(vec![para(vec![mk("x", &["code"]), mk("y", &["bold"])])]),
        );
        // O espaço dentro de uma marca de fora continua marcado.
        let md = same(
            "espaços dentro do tachado",
            one(vec![para(vec![
                mk("comprar ", &["strike"]),
                mk("leite", &["strike", "bold"]),
                mk(" hoje", &["strike"]),
            ])]),
        );
        assert_eq!(md, "~~comprar **leite** hoje~~");
        // O comum continua limpo, sem entidades.
        let md = same(
            "comum",
            one(vec![para(vec![
                tx("a "),
                mk("b", &["bold"]),
                tx(" c "),
                mk("d", &["italic"]),
                tx("."),
            ])]),
        );
        assert_eq!(md, "a **b** c *d*.");
    }

    #[test]
    fn line_breaks_spaces_and_tabs_come_back() {
        same(
            "duas quebras",
            one(vec![para(vec![tx("a"), br(), br(), tx("b")])]),
        );
        same("quebra no fim", one(vec![para(vec![tx("a"), br()])]));
        same("quebra no começo", one(vec![para(vec![br(), tx("a")])]));
        same("só uma quebra", one(vec![para(vec![br()])]));
        same(
            "espaço antes da quebra",
            one(vec![para(vec![tx("a "), br(), tx("b")])]),
        );
        same("espaço no fim", one(vec![para(vec![tx("a ")])]));
        same("tab no começo", one(vec![para(vec![tx("\tindentado")])]));
        same(
            "tab depois da quebra",
            one(vec![para(vec![tx("a"), br(), tx("\tb")])]),
        );
        same(
            "negrito em duas linhas",
            one(vec![para(vec![
                mk("a", &["bold"]),
                br(),
                mk("b", &["bold"]),
            ])]),
        );
        same("nbsp no texto", one(vec![para(vec![tx("10\u{a0}km")])]));
        same("\\r no texto", one(vec![para(vec![tx("x\ry")])]));
        same(
            "\\r no título",
            one(vec![
                json!({"type":"heading","attrs":{"level":1},"content":[tx("x\ry")]}),
            ]),
        );
        assert_eq!(
            to_markdown(&one(vec![para(vec![tx("a"), br(), tx("b")])]), &names),
            "a\nb"
        );
    }

    #[test]
    fn blocks_inside_items_come_back() {
        let item = |c: Vec<Value>| json!({"type":"bulletList","content":[{"type":"listItem","content":c}]});
        same(
            "linha divisória no item",
            one(vec![item(vec![
                para(vec![tx("a")]),
                json!({"type":"horizontalRule"}),
                json!({"type":"paragraph"}),
            ])]),
        );
        same(
            "título no item",
            one(vec![item(vec![
                para(vec![tx("a")]),
                json!({"type":"heading","attrs":{"level":3},"content":[tx("h")]}),
            ])]),
        );
        let doc = from_markdown("- Tarefa\n  ### Detalhe");
        assert_eq!(
            doc["content"][0]["content"][0]["content"][1]["type"],
            "heading"
        );
        // Item comum cujo texto é "[ ]" continua item comum.
        same("item [ ]", one(vec![item(vec![para(vec![tx("[ ]")])])]));
        same("item [x]", one(vec![item(vec![para(vec![tx("[x]")])])]));
    }

    #[test]
    fn link_addresses_come_back_as_they_were() {
        let l = |href: &str| {
            one(vec![para(vec![
                json!({"type":"text","text":"v","marks":[{"type":"link","attrs":{"href":href}}]}),
            ])])
        };
        same("&amp; no endereço", l("https://exemplo.com/?a=1&amp;b=2"));
        same("&copy no endereço", l("https://exemplo.com/a&copy;b"));
        same("< e > no endereço", l("https://exemplo.com/<a> b"));
        same(
            "cartão com &amp;",
            one(vec![
                json!({"type":"linkCard","attrs":{"url":"https://exemplo.com/?x=&lt;"}}),
            ]),
        );
    }

    #[test]
    fn blocks_inside_table_cells_keep_their_text() {
        let cell = |k: &str, c: Vec<Value>| json!({"type":k,"attrs":{"colspan":1,"rowspan":1},"content":c});
        let table = |c: Vec<Value>| {
            one(vec![json!({"type":"table","content":[
                {"type":"tableRow","content":[cell("tableHeader", vec![para(vec![tx("H")])]), cell("tableHeader", vec![para(vec![tx("I")])])]},
                {"type":"tableRow","content":[cell("tableCell", c), cell("tableCell", vec![para(vec![tx("z")])])]}]})])
        };
        let texts = |doc: &Value| -> String {
            let cell = &doc["content"][0]["content"][1]["content"][0];
            plain(cell)
        };
        let cases = [
            table(vec![
                json!({"type":"bulletList","content":[{"type":"listItem","content":[para(vec![tx("um")])]},{"type":"listItem","content":[para(vec![mk("dois", &["bold"])])]}]}),
            ]),
            table(vec![
                json!({"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[para(vec![tx("um")])]}]}),
            ]),
            table(vec![json!({"type":"codeBlock","content":[tx("l1\nl2")]})]),
            table(vec![
                json!({"type":"blockquote","content":[para(vec![tx("dito")])]}),
            ]),
            table(vec![para(vec![tx("a")]), para(vec![tx("b")])]),
        ];
        let want = ["- um - dois", "- [x] um", "l1 l2", "dito", "a b"];
        for (doc, want) in cases.iter().zip(want) {
            let md = to_markdown(doc, &names);
            let back = from_markdown(&md);
            assert_eq!(
                back["content"].as_array().unwrap().len(),
                1,
                "a tabela não racha: {md:?}"
            );
            let rows = back["content"][0]["content"].as_array().unwrap();
            assert_eq!(rows.len(), 2, "{md:?}");
            assert_eq!(
                texts(&back)
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" "),
                want,
                "{md:?}"
            );
            assert_eq!(plain(&rows[1]["content"][1]), "z", "{md:?}");
        }
        // A marca do texto da lista fica.
        let md = to_markdown(&cases[0], &names);
        let back = from_markdown(&md);
        let cell = &back["content"][0]["content"][1]["content"][0]["content"][0]["content"];
        assert!(
            cell.as_array()
                .unwrap()
                .iter()
                .any(|t| t["text"] == "dois" && t["marks"][0]["type"] == "bold"),
            "{md:?}"
        );
    }

    proptest::proptest! {
        #![proptest_config(proptest::prelude::ProptestConfig::with_cases(400))]
        #[test]
        fn note_to_markdown_and_back_is_the_same_note(doc in crate::testdoc::doc(true)) {
            let md = to_markdown(&doc, &names);
            proptest::prop_assert_eq!(from_markdown(&md), crate::canon::canon(&doc), "\n--- markdown ---\n{}\n---", md);
        }

        #[test]
        fn any_text_reads_without_panicking(md in "(?s).{0,300}") {
            let doc = from_markdown(&md);
            proptest::prop_assert_eq!(doc["type"].as_str(), Some("doc"));
            proptest::prop_assert!(!doc["content"].as_array().unwrap().is_empty());
        }
    }
}

//! Forma canônica de um documento do editor (JSON do TipTap/ProseMirror): sem atributos nulos, marcas em ordem,
//! textos com as mesmas marcas juntos e sem textos vazios. Dois documentos que o editor mostra igual ficam iguais
//! aqui, o que permite comparar o que veio do Markdown com o que estava guardado.

use serde_json::{json, Map, Value};

/// Filho de um nó como o Y guarda: um elemento, ou um texto (os nós de texto seguidos do JSON viram um só).
pub enum Unit<'a> {
    Text(&'a [Value]),
    El(&'a Value),
}

/// Os filhos de um nó agrupados como o Y guarda.
pub fn units(nodes: &[Value]) -> Vec<Unit<'_>> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < nodes.len() {
        if nodes[i].get("type").and_then(Value::as_str) == Some("text") {
            let start = i;
            while i < nodes.len() && nodes[i].get("type").and_then(Value::as_str) == Some("text") {
                i += 1;
            }
            out.push(Unit::Text(&nodes[start..i]));
        } else {
            out.push(Unit::El(&nodes[i]));
            i += 1;
        }
    }
    out
}

/// Forma canônica para comparar um filho do JSON com um do Y: sem atributos nulos, marcas em ordem, textos com as
/// mesmas marcas juntos e sem textos vazios (como a leitura do Y devolve).
pub fn canon_unit(u: &Unit) -> Value {
    match u {
        Unit::Text(nodes) => Value::Array(canon_texts(nodes)),
        Unit::El(node) => canon_el(node),
    }
}

/// Trechos de texto na forma canônica.
pub fn canon_texts(nodes: &[Value]) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    for n in nodes {
        let text = n.get("text").and_then(Value::as_str).unwrap_or("");
        if text.is_empty() {
            continue;
        }
        let mut marks: Vec<Value> = n
            .get("marks")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .map(|m| {
                let mut m = m.clone();
                if let Some(o) = m.as_object_mut() {
                    if o.get("attrs")
                        .is_some_and(|a| a.is_null() || a.as_object().is_some_and(|a| a.is_empty()))
                    {
                        o.remove("attrs");
                    }
                }
                m
            })
            .collect();
        marks.sort_by(|a, b| a["type"].as_str().cmp(&b["type"].as_str()));
        match out.last_mut() {
            Some(last)
                if last.get("marks").cloned().unwrap_or(Value::Array(vec![]))
                    == Value::Array(marks.clone()) =>
            {
                let joined = format!("{}{text}", last["text"].as_str().unwrap_or(""));
                last["text"] = Value::from(joined);
            }
            _ => {
                let mut t = json!({ "type": "text", "text": text });
                if !marks.is_empty() {
                    t["marks"] = Value::Array(marks);
                }
                out.push(t);
            }
        }
    }
    out
}

/// O corpo na forma canônica (para comparar dois corpos que o editor mostra igual).
pub fn canon(body: &Value) -> Value {
    canon_el(body)
}

/// Um elemento na forma canônica.
pub fn canon_el(node: &Value) -> Value {
    let mut out = Map::new();
    out.insert(
        "type".into(),
        node.get("type")
            .cloned()
            .unwrap_or_else(|| Value::from("paragraph")),
    );
    let attrs: Map<String, Value> = node
        .get("attrs")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
        .filter(|(_, v)| !v.is_null())
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    if !attrs.is_empty() {
        out.insert("attrs".into(), Value::Object(attrs));
    }
    let empty = vec![];
    let content: Vec<Value> = units(
        node.get("content")
            .and_then(Value::as_array)
            .unwrap_or(&empty),
    )
    .iter()
    .flat_map(|u| match canon_unit(u) {
        Value::Array(texts) => texts,
        el => vec![el],
    })
    .collect();
    if !content.is_empty() {
        out.insert("content".into(), Value::Array(content));
    }
    Value::Object(out)
}

# Prompt, link na palavra e card em nova janela

Status: resolved

Pedido do usuário (03/11/2026), para o card dos dois apps (o mesmo card, então mora no Atrio).

## 1. Prompt (formatação nova)

Um trecho do texto marcado como **instrução para a IA**, no meio da frase, como um negrito. Cada parte do texto pode
ter a sua. Nome no código e na interface: **Prompt**.

- **Na tela:** o trecho aparece entre colchetes, `[resuma em 3 tópicos]`, com um fundo suave na cor de destaque
  (escolha do usuário: prefere os colchetes). Os colchetes são do desenho (CSS), não do texto.
- **No arquivo:** `<prompt>…</prompt>` no Markdown (MCP, exportar, área de transferência). Escolha do usuário: os
  colchetes no arquivo confundiriam com texto comum vindo de fora.
- Botão "Prompt" na barra de formatação e atalho (⌘⇧P / Ctrl+Shift+P); marca do TipTap `prompt`.
- **Card fechado:** o prompt aparece marcado, como no editor (a prévia leva onde estão os trechos).
- O MCP dos dois apps diz o que é o `<prompt>`.

## 2. Link na palavra + lista de links

- Selecionar uma palavra e pôr um link nela (botão, ⌘K); a marca `link` do TipTap, só com `href`.
- Markdown `[palavra](endereço)` vai e volta sem perder (hoje vira "palavra (endereço)").
- **Lista automática** no fim do card (escolha do usuário): seção "Links" com todos os links da nota, os das palavras
  entram sozinhos, e dá para pôr um link só na lista (o cartão de link de hoje). Tirar o link da palavra o tira da
  lista.
- Colar ou importar Markdown com links mantém o link na palavra.

## 3. Abrir o card numa nova janela

- "Abrir em nova janela" no menu do card e na barra do card aberto, nos dois apps. Várias janelas, uma por card; o
  que se escreve numa aparece na outra.
- Ideario: a janela abre a nota pelo id (o Y.Doc já se junta pelo núcleo). Nodo: a janela abre o tópico do mapa da aba.

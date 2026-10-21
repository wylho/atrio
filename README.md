# Atrio

O design system e os componentes que o [Ideario](https://github.com/wylho/ideario) e o
[Nodo](https://github.com/wylho/nodo) compartilham. Mudou aqui, muda nos dois.

## O que tem

- **`atrio.css`**: tokens (cores claras e escuras, cores de nota, sombras, raios, fonte do sistema) e os estilos do
  design system: botões, pílulas, folhas, menus e o card de nota.
- **`CardBody`**: o miolo do card de nota (emoji, título, prévia estruturada com tópicos, tarefas, código, links e
  #hashtags, e a linha de pílulas). O Ideario põe em volta a capa, o alfinete e a seleção; o Nodo põe o card no
  lugar do nó do mapa.
- **Prévia a partir de Markdown** (`previewFromMarkdown`): as mesmas regras e limites da projeção do Ideario, para
  quem guarda a nota como texto.
- **Card na área de transferência** (`writeCard`, `readCard`): copiar uma nota no Ideario e colar no Nodo vira um nó
  com a mesma nota, e o contrário também. Vai como HTML (com o card em JSON num atributo `data-atrio-card`) e como
  Markdown, então também cola bem em qualquer outro app.

## Como usar

```sh
pnpm add github:wylho/atrio#v0.1.0     # ou npm install github:wylho/atrio#v0.1.0
```

```ts
import '@wylho/atrio/atrio.css'
import { CardBody, previewFromMarkdown, readCard, writeCard } from '@wylho/atrio'
```

Os componentes vão como código-fonte Svelte 5: o Vite do app compila junto. Precisa de `svelte` 5 e
`@lucide/svelte` no app.

## Versões

Cada mudança que um app vai usar ganha uma tag (`v0.1.0`, `v0.2.0`…). Os apps apontam para uma tag, não para o
`main`, para uma mudança aqui nunca quebrar o build de um deles sem querer. Para levar uma mudança aos dois: tag
nova aqui e a dependência atualizada lá.

## Licença

MIT. Permissiva de propósito: o Nodo é GPL e o Ideario não, e os dois precisam poder usar.

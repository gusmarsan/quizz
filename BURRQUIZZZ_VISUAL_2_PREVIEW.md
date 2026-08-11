# Burrquizzz Visual 2.0 — Preview visual

Quero criar apenas um **protótipo visual estático do Burrquizzz Visual 2.0**, para avaliação.

**Não altere nem implemente nada no app atual.**

Crie arquivos separados, preferencialmente:
- `visual-2-preview.html`
- `visual-2-preview.css`
- `visual-2-preview.js`

Use a imagem de look & feel fornecida como **North Star visual**. Quero que o preview fique muito próximo dela em direção de arte, atmosfera, composição, tipografia, proporções, componentes e acabamento.

## Não inventar funcionalidades

O Burrquizzz **NÃO terá por enquanto**:
- escolha de categorias
- level
- XP
- streak
- trophies
- badges
- perfil elaborado
- ranking geral
- leaderboard
- quests
- shop
- navegação inferior fictícia

Não implemente nada disso.

## Tela 1 — Home
Mostrar:
- identidade Burrquizzz forte
- atmosfera de quiz night / pub / arcade sofisticado
- logo em grande destaque
- uma frase curta com personalidade
- um único CTA dominante para começar o jogo

Não mostrar categorias, estatísticas, XP, level ou ranking.

## Tela 2 — Partida
Esta é a tela hero.

Mostrar:
- dois jogadores e seus placares no topo
- sensação clara de confronto / VS
- rodada
- timer circular destacado
- pergunta como elemento central
- quatro respostas grandes e fáceis de tocar
- exemplo de resposta correta

As respostas devem parecer quase **botões físicos de um game show contemporâneo**.

## Tela 3 — Resultado
Mostrar:
- vencedor
- os dois jogadores
- placar final
- mensagem curta, espirituosa e adulta
- CTA para jogar novamente
- CTA para voltar à home

Não criar ranking ou leaderboard.

## Direção de arte
Seguir de perto a imagem de referência.

Paleta-base:
- `#08151D` fundo principal
- `#10242D` e `#172F38` superfícies
- `#F5F0E6` texto principal
- `#E2A93B` dourado principal
- `#F1C45C` dourado de destaque
- `#C86931` laranja queimado
- `#23855A` acerto
- `#A9433D` erro

O dourado é cor de assinatura, não deve aparecer em tudo.

## Público e personalidade
O jogo é para amigos nerds por volta dos 45 anos.

Quero:
- adulto
- sofisticado
- divertido
- nerd
- competitivo
- levemente retrô
- pub quiz
- game show contemporâneo
- arcade sofisticado

Não quero:
- aparência infantil
- candy colors
- estética de app educacional
- dashboard SaaS
- glassmorphism genérico
- neon exagerado
- emojis como identidade
- excesso de cards
- gamificação sem função

## Tipografia e componentes
- logo/títulos com personalidade
- interface em sans-serif muito legível
- pergunta grande
- placar e timer fortes
- cards com radius de 14–16 px
- respostas com 10–12 px
- bordas discretas
- sombras pequenas
- glow controlado

## Microinterações do preview
Pode usar JavaScript apenas para demonstrar:
- alternar entre Home, Partida e Resultado
- pressionar resposta
- estado correto/errado
- pequenas transições

Animações geralmente entre 150 e 300 ms.

## Responsividade
Mobile-first, mas bem apresentado também no navegador do computador.

## Segurança do app atual
Não:
- conectar Firebase
- usar dados reais
- alterar HTML/JS atual
- substituir arquivos existentes
- refatorar o app
- fazer commit
- publicar

Crie apenas o preview isolado.

## Critério final
Ao abrir, quero pensar:

**“Agora o Burrquizzz parece um produto desenhado profissionalmente para uma noite de quiz entre adultos nerds.”**

A imagem fornecida junto deste briefing é a principal referência visual.

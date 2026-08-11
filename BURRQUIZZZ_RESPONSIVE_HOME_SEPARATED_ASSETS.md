# Burrquizzz — Home responsiva com fundo separado e logo separado

Leia estas instruções e execute **somente no preview visual**, sem alterar o app real.

## Objetivo desta rodada

Quero reorganizar a Home do preview pensando corretamente em **mobile e desktop**.

A Home **não deve ser tratada como um pôster fixo** nem como uma única imagem fechada que só funciona no celular.

Quero que a Home seja montada com **camadas separadas**:

1. **uma imagem de fundo / cena de pub quiz**
2. **um elemento separado para o logo / lettering Burrquizzz**
3. **conteúdo de interface por cima**, como frase e CTA

O objetivo é que a Home funcione bem tanto em **mobile** quanto em **desktop**.

---

## Regra principal

Preserve tudo o que já estiver aprovado no preview, **mas reestruture a Home** com esta lógica:

- **background atmosférico separado**
- **logo separado**
- **texto e CTA em container responsivo**
- **sem alterar o app real**
- **sem inventar novas funcionalidades**

---

## Estrutura desejada

Quero a Home organizada mais ou menos assim:

### Camada 1 — Fundo
Uma cena de pub quiz / bar / arcade sofisticado funcionando como **background da Home**.

Esse fundo deve:
- ser escuro
- atmosférico
- premium
- com luzes quentes suaves
- ter silhuetas discretas de pessoas
- ter profundidade
- nunca competir com o conteúdo principal

Essa cena deve funcionar como **imagem de fundo**, não como layout completo da tela.

### Camada 2 — Overlay
Aplicar por cima do fundo:
- overlay escuro
- vinheta sutil
- controle de contraste
- eventualmente um glow muito discreto

O objetivo é manter legibilidade do logo e do botão.

### Camada 3 — Conteúdo
Por cima disso, posicionar:
- logo Burrquizzz / lettering
- frase curta
- botão principal “Começar partida”

Tudo isso deve ficar dentro de um **container responsivo**, e não colado nas bordas da tela.

---

## Importante: separar cena e logo

Não use uma única arte fechada como solução completa da Home.

Quero que:

- o **fundo de pub quiz** seja um ativo de background
- o **logo Burrquizzz** seja um elemento separado
- os textos e o CTA sejam elementos HTML/CSS normais

Se já houver uma imagem única sendo usada como solução completa, substitua essa abordagem pela estrutura separada acima.

---

## Comportamento no mobile

No mobile, a Home deve ser:

- vertical
- compacta
- focada
- atmosférica

### No mobile:
- o fundo deve ocupar a tela
- o conteúdo principal deve aparecer bem centralizado
- o logo deve ter destaque
- a frase deve ficar logo abaixo
- o CTA deve ser muito claro
- a composição deve ficar limpa e forte

A sensação deve ser de uma abertura elegante do jogo.

---

## Comportamento no desktop

No desktop, a Home **não pode parecer só o celular ampliado**.

Quero que ela funcione como uma espécie de **hero section centralizada do jogo**.

### No desktop:
- o fundo continua cobrindo a tela
- o conteúdo deve ficar em um container central com largura máxima controlada
- o logo pode crescer
- frase e CTA devem se posicionar de forma equilibrada
- o uso do espaço horizontal deve ser melhor
- o layout deve respirar mais
- não quero elementos perdidos ou “boiando” no vazio

A sensação deve ser de uma landing hero do Burrquizzz, não de um print esticado.

---

## Diretrizes técnicas

Use a separação visual de forma técnica e robusta.

Se necessário, use:
- `background-image`
- `background-size: cover`
- `background-position: center`
- controle de `focal point`
- overlay com pseudo-elemento
- `max-width` no container principal
- ajustes específicos por breakpoint
- responsividade real, não scaling

Se precisar criar uma estrutura como:
- `.home-hero`
- `.home-hero__background`
- `.home-hero__overlay`
- `.home-hero__content`
- `.home-hero__logo`
- `.home-hero__cta`

pode fazer, desde que seja apenas no preview.

---

## Direção visual

A direção continua a mesma já aprovada:

- adulto
- nerd
- premium
- quiz night
- pub quiz
- arcade sofisticado
- midnight / petrol escuro
- off-white
- dourado como acento, não como decoração excessiva

### Reforço:
- o dourado pode aparecer no logo e em destaques
- não quero a tela inteira decorada de dourado
- o foco funcional da Home continua sendo o botão principal

---

## O que não fazer

- não usar uma única imagem fechada para resolver tudo
- não transformar a Home em uma peça estática que só funciona no mobile
- não esticar a composição do celular no desktop
- não inventar categorias, ranking, XP ou outras features
- não mexer no app real
- não alterar as outras telas além do necessário para preservar consistência

---

## Entrega esperada

Ao terminar:

1. me diga quais arquivos do preview foram alterados
2. explique brevemente como a Home ficou estruturada
3. mostre a Home atualizada
4. garanta que ela funciona melhor em mobile e desktop

---

## Critério de sucesso

Quero que a Home:

- mantenha a atmosfera visual aprovada
- fique mais robusta tecnicamente
- funcione melhor em desktop
- continue forte no mobile
- pareça uma abertura profissional do Burrquizzz

O ponto principal é:

**separar fundo, logo e conteúdo para montar uma Home verdadeiramente responsiva.**

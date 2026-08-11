# Burrquizzz — Recomendações visuais para Prepare-se e Sala pronta

> Escopo: somente as telas **Prepare-se / contagem regressiva** e **Sala pronta / lobby do duelo online**. Este documento não propõe alterações em gameplay, Firebase, networking, salas, regras, textos dinâmicos ou comportamento atual.

## 1. Diagnóstico geral

As duas telas já pertencem claramente ao universo visual do Burrquizzz. Azul-petróleo quase preto, creme, dourado, Fraunces e DM Sans criam uma identidade reconhecível de pub noturno e espetáculo de quiz, sem aparência corporativa, neon ou arcade.

- **Prepare-se** está próxima do nível visual desejado. É memorável, teatral e tem hierarquia clara. Precisa principalmente de refinamento responsivo e acabamento.
- **Sala pronta** tem bons componentes e excelente coerência cromática, mas sua hierarquia favorece o slogan acima da tarefa principal: compartilhar o convite, acompanhar os jogadores e compreender o estado da sala.

A direção recomendada é preservar completamente a identidade existente e melhorar composição, hierarquia, responsividade e clareza operacional.

### Evidência técnica resumida

- Fraunces está corretamente reservada para display; DM Sans permanece responsável pela interface.
- Dourado e creme possuem contraste forte sobre os fundos escuros.
- Os principais problemas estão em hierarquia, tamanho de textos auxiliares, responsividade vertical e clareza de elementos acionáveis.

## 2. Prepare-se — problemas encontrados

### 2.1 Dependência de telas altas

A composição funciona muito bem em celulares altos, mas combina conteúdo monumental, `100dvh` e `overflow: hidden`. Em landscape, telas baixas ou zoom elevado, estrela, número ou mensagem podem ser cortados.

### 2.2 Centro óptico ligeiramente baixo

Existe uma distância grande entre a estrela e “PREPARE-SE”. O núcleo formado por eyebrow, número e mensagem parece ligeiramente abaixo do centro óptico.

### 2.3 Relevo do número pesado

Os vários níveis de sombra criam presença, mas podem competir com a forma do algarismo. O risco aumenta no estado “JÁ”, que possui uma massa tipográfica mais compacta.

### 2.4 Mensagem sem adaptação por comprimento

“Vai começar o caos enciclopédico” funciona muito bem em duas linhas e deve ser preservado. Mensagens dinâmicas mais longas podem quebrar em três linhas e desequilibrar o conjunto.

### 2.5 Número e mensagem com dominância próxima

O número vence pela escala, mas a mensagem também usa Fraunces muito pesada. Ela poderia funcionar melhor como fechamento da composição, com um pouco menos de competição visual.

### 2.6 Comunicação acessível da contagem

A atualização `3–2–1–JÁ` não possui uma região semântica específica de status ou timer. A melhoria deve preservar integralmente duração, transição e comportamento.

### 2.7 Pontos com aparência pouco consolidada

- Proteções de movimento reduzido distribuídas por diferentes arquivos.
- Mesmo tratamento visual para mensagens de extensões diferentes.
- Dependência de `overflow: hidden`.
- Mesmo relevo aplicado a algarismos e “JÁ”.

## 3. Prepare-se — recomendações

### Manter

- Conceito de palco com holofotes, confete, estrela e piso.
- Número monumental.
- “PREPARE-SE” em DM Sans, caixa alta e dourado.
- “Vai começar o caos enciclopédico” em Fraunces.
- Paleta escura, creme e dourada.
- Ausência de navegação e controles durante a contagem.
- Lógica e ritmo atuais da contagem.
- Relação visual com a tela de Resultado, formando abertura e encerramento do espetáculo.

### Refinar

1. Subir o núcleo da composição aproximadamente 4–7% em celulares altos.
2. Aproximar discretamente estrela, eyebrow e número.
3. Criar uma composição específica para baixa altura e landscape.
4. Reduzir espaço cenográfico superior em viewports curtos.
5. Escalar o número também pela altura disponível, não somente pela largura.
6. Permitir uma saída segura quando zoom ou viewport excederem a composição.
7. Preservar o relevo, mas reduzir um nível de sombra ou seus deslocamentos.
8. Aplicar uma versão de relevo mais leve ao estado “JÁ”.
9. Definir escalas visuais para mensagens curtas, médias e longas.
10. Buscar no máximo duas linhas para a mensagem sempre que possível.
11. Reduzir levemente a dominância da frase em relação ao número.
12. Centralizar as regras de movimento reduzido.
13. Comunicar semanticamente a contagem sem mudar timing ou transição automática.

### Redesenhar

Não é necessário redesenho estrutural. A tela pede apenas refinamento responsivo, tipográfico e de composição.

## 4. Sala pronta — problemas encontrados

### 4.1 Hierarquia invertida

“Convide quem vai perder” deve permanecer, mas domina a tela. A ação essencial — compartilhar o convite — aparece abaixo com menor força operacional.

### 4.2 Convite com affordance fraca

O cartão inteiro é acionável, mas parece um painel de informação. “Compartilhar link” é pequeno, cinza e sem ícone.

Também existe divergência entre apresentação e comportamento:

- HTML-base: “Código da sala” e “Toque para copiar”.
- Runtime: “Convite da sala” e “Compartilhar link”.
- Atributo `title`: “Copiar código”.
- Comportamento: compartilhamento nativo com cópia como fallback.

### 4.3 Excesso de molduras concêntricas

Moldura externa, superfície, painel, convite, jogadores e divisórias usam fundos, bordas e raios semelhantes. O resultado é mais pesado que Home, Perguntas e Resultado.

### 4.4 Estados dos jogadores pouco explícitos

O bloco unificado é bom, mas ainda há limitações:

- O status depende parcialmente da cor.
- “Jogador 1” e “Jogador 2” têm corpo muito pequeno.
- “Aguardando…” funciona simultaneamente como nome e estado.
- O papel do anfitrião não fica explícito.
- Nomes longos são truncados sem forma de revelar o nome completo.

### 4.5 Instrução inferior fraca

“Compartilhe o convite. O jogo começa assim que a outra pessoa entrar.” explica o próximo passo, mas parece um rodapé opcional.

### 4.6 Estados de quantidade e início pouco previsíveis

Quantidade de perguntas e botão de início existem no HTML, enquanto determinados fluxos online os ocultam ou iniciam automaticamente. A composição pode variar durante carregamento, cache ou mudança de papel.

As funções devem ser preservadas, mas o layout precisa prever de forma estável:

- anfitrião aguardando;
- anfitrião pronto para iniciar;
- convidado aguardando o anfitrião;
- início automático, quando aplicável;
- quantidade de perguntas visível ou oculta.

### 4.7 Scroll interno pouco evidente

No mobile, a tela usa altura máxima, rolagem interna e scrollbar escondida. Em aparelhos baixos, pode existir conteúdo abaixo da dobra sem pista visual suficiente.

### 4.8 Badge de versão

O badge `v1.5` sobre a moldura parece um elemento de diagnóstico e reduz a sensação premium.

### 4.9 Textos auxiliares pequenos

Alguns rótulos ficam próximos de 10–12 px no mobile. Mesmo com contraste suficiente, são frágeis em telas densas, brilho baixo ou para usuários com visão reduzida.

### 4.10 Pontos com aparência improvisada

- CSS final carregado por JavaScript após estilos antigos.
- Textos-base substituídos pelo runtime.
- Dois modelos aparentes de início: botão explícito e início automático.
- Badge de versão sobreposto.
- Cartão clicável sem aparência clara de botão.
- Scroll interno invisível.
- Muitas sobrescritas com `!important` no bloco de jogadores.

## 5. Sala pronta — recomendações

### Manter

- Fundo de pub e iluminação baixa.
- Marca no topo.
- Azul-petróleo, creme e dourado.
- “Sala pronta” e “Convide quem vai perder”.
- Código da sala em grande escala e com espaçamento entre caracteres.
- Bloco unificado dos dois jogadores.
- Verde para conectado e cinza para aguardando.
- Funções de compartilhar/copiar, código, jogadores, status, quantidade, início e saída.
- Fraunces para título e DM Sans para interface.
- Touch targets atuais, em geral acima de 44 px.

### Refinar

1. Reduzir o título aproximadamente 15–20% no mobile.
2. Fazer o convite assumir o protagonismo operacional da tela.
3. Adicionar um ícone de compartilhar ou copiar ao cartão.
4. Dar mais contraste ao rótulo da ação.
5. Criar um tratamento visual claro de botão ou faixa de ação.
6. Mostrar estado visual de pressionado e feedback curto de sucesso.
7. Alinhar rótulos visuais, descrição acessível e comportamento real.
8. Manter uma moldura cenográfica externa e um painel operacional principal.
9. Reduzir caixas internas completas, usando mais espaçamento, contraste tonal e divisores.
10. Explicitar papel, nome e estado de cada jogador.
11. Usar o indicador cromático como reforço, não como única informação.
12. Aproximar a instrução do convite ou do bloco de jogadores.
13. Aumentar corpo e contraste da orientação de espera.
14. Reservar uma zona estável para quantidade de perguntas e botão de início.
15. Fechar deliberadamente o espaço quando esses controles estiverem ocultos pelo estado atual.
16. Preferir rolagem natural da página a scroll interno invisível.
17. Se a rolagem interna for inevitável, oferecer uma pista visual de continuidade.
18. Garantir que saída, quantidade e início sejam sempre alcançáveis.
19. Buscar aproximadamente 12–14 px como piso prático para rótulos e instruções mobile.
20. Retirar o badge de versão da apresentação final ou restringi-lo ao ambiente de desenvolvimento.

### Redesenhar

Não redesenhar a identidade. Redesenhar apenas a arquitetura interna da hierarquia:

- convite como módulo operacional principal;
- jogadores como módulo de status;
- configuração e início como módulo condicional;
- instrução contextual ligada ao estado;
- menos contêineres concorrentes.

## 6. Consistência com o restante do Burrquizzz

### Consistências fortes

- Paleta correta e estável.
- Fraunces e DM Sans aplicadas nos papéis adequados.
- Dourado usado para recompensa, destaque e ação.
- Linguagem provocativa e divertida.
- Atmosfera escura e material, sem neon.
- Prepare-se e Resultado funcionam como abertura e encerramento do espetáculo.
- Lobby e Home parecem ocorrer no mesmo pub.

### Inconsistências a resolver

1. O lobby tem densidade de bordas maior que as telas de referência.
2. O convite não tem a mesma clareza de ação dos botões de Home, Perguntas e Resultado.
3. Textos auxiliares do lobby estão abaixo do conforto percebido nas outras telas.
4. Aparência e textos finais dependem de injeções posteriores do runtime.
5. O badge de versão destoa da apresentação premium.
6. A distinção de fundos deve ser formalizada: pub para preparação social; palco para transições e celebração.

## 7. Prioridades

### P0 — bloqueadores

Nenhum bloqueador visual evidente nas capturas.

Se testes confirmarem corte de conteúdo ou impossibilidade de alcançar controles em viewports baixos, a correção do overflow deve subir para P0.

### P1 — impacto alto

- Tornar compartilhar/copiar inequivocamente acionável no lobby.
- Reequilibrar a hierarquia do lobby, reduzindo o domínio do slogan.
- Garantir acesso a código, jogadores, quantidade, início e saída em telas baixas.
- Criar composição segura da contagem para landscape, baixa altura e zoom.
- Estabilizar visualmente os diferentes estados do lobby.
- Melhorar a comunicação acessível da contagem sem mudar seu comportamento.

### P2 — refinamento e acabamento

- Reduzir molduras concêntricas do lobby.
- Aumentar corpo e contraste dos textos auxiliares.
- Tornar estados conectado/aguardando mais explícitos.
- Aproximar a orientação do elemento ao qual se refere.
- Ajustar centro óptico da contagem.
- Reduzir peso do relevo do número e de “JÁ”.
- Adaptar a mensagem da contagem por comprimento.
- Consolidar fontes de texto e estilo para evitar flash visual.
- Retirar o badge de versão da experiência final.
- Revisar nomes longos, códigos largos e feedback de compartilhamento.

## 8. Ordem recomendada de implementação

1. Mapear todos os estados reais do lobby, sem alterar gameplay.
2. Reestruturar somente a hierarquia visual do lobby.
3. Tornar a ação de compartilhar/copiar explícita.
4. Estabilizar quantidade de perguntas e início em uma região previsível.
5. Simplificar superfícies e bordas do lobby.
6. Corrigir responsividade vertical do lobby.
7. Criar a variante de baixa altura da contagem.
8. Refinar centro óptico, sombras e escala das mensagens da contagem.
9. Executar uma passagem final de acessibilidade visual e semântica.
10. Retirar elementos internos de diagnóstico e validar a primeira pintura.

## 9. Cenários recomendados para validação

- 320 px de largura.
- Celular alto semelhante às capturas fornecidas.
- Celular de baixa altura.
- Landscape.
- Zoom de 200%.
- Nome com 18 caracteres.
- Código com caracteres visualmente largos.
- Anfitrião sozinho.
- Dois jogadores conectados.
- Convidado aguardando o anfitrião.
- Botão de início habilitado e desabilitado.
- Quantidade de perguntas visível e oculta.
- Compartilhamento nativo disponível.
- Fallback de cópia para a área de transferência.
- Preferência de movimento reduzido.

---

Documento produzido por análise visual e inspeção somente leitura. Nenhuma mudança de implementação foi realizada.

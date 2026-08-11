# Relatório Final de Análise UI/UX — Burrquizzz

## Resumo executivo

O Burrquizzz possui uma base visual clara, alegre e funcional. Sua identidade aparece na paleta azul, amarela e rosa, na tipografia arredondada e no tom de voz irreverente. A tela inicial apresenta os modos solo e duelo de forma simples, os componentes principais são razoavelmente consistentes e o fluxo geral é fácil de compreender.

A principal oportunidade está na distância entre a proposta e a execução atual. O produto se define como um “game show” no qual cada pergunta deveria parecer um pequeno evento, mas a experiência ainda se aproxima visualmente de um formulário dentro de um cartão. A personalidade está mais presente nos textos e nas cores do que na composição das partidas, no feedback e nos resultados.

O problema mais crítico está nas telas de jogo. Perguntas longas, perguntas com imagem e desafios de associação podem ocupar mais espaço do que a viewport disponível, empurrando respostas ou feedback para fora da área visível enquanto o cronômetro continua avançando. Isso afeta responsividade, acessibilidade, clareza e justiça da mecânica.

Também foram identificados problemas relacionados a:

- Imagens cortadas por uma política única de enquadramento.
- Textos alternativos inadequados para perguntas visuais.
- Cronômetro sem representação semântica acessível.
- Controles dinâmicos sem labels programáticos suficientes.
- Feedback curto, periférico e pouco pedagógico.
- Mudanças de tela sem gestão de foco.
- Possibilidade de abandono acidental da partida.
- Exposição da configuração do Firebase ao jogador.
- Pouca diferenciação entre solo e duelo.
- Resultados funcionalmente corretos, mas emocionalmente pouco marcantes.
- Duas camadas CSS concorrentes, aumentando o risco de regressões.

A base atual deve ser preservada e aprimorada. Não há necessidade imediata de substituir completamente a identidade visual.

## Pontos positivos

- A home apresenta uma hierarquia macro clara: proposta, título, explicação e escolha entre apenas dois modos.
- A decisão inicial possui baixa carga cognitiva.
- As respostas têm áreas de toque confortáveis.
- Existe foco visual forte para navegação por teclado.
- Os estados de resposta correta e incorreta são reconhecíveis.
- O jogo informa pergunta atual, total, acertos, adversário e progresso temporal.
- Setup e lobby utilizam elementos HTML adequados, como labels, fieldsets, botões reais e dialog.
- Já existem safe areas, unidades `dvh`, breakpoints móveis e suporte a movimento reduzido.
- O tom de voz é específico e coerente com a marca.
- O lobby comunica presença dos jogadores e autoridade do host.
- A interface utiliza poucos caminhos principais e mantém boa previsibilidade geral.

## Design Health Score

A avaliação pelas heurísticas de Nielsen resultou em **25/40**, classificando a interface como **aceitável, com melhorias significativas necessárias**.

| # | Heurística | Nota | Principal questão |
|---|---|---:|---|
| 1 | Visibilidade do estado do sistema | 3 | Existem timer, placar e feedback, mas o tempo não é semanticamente acessível |
| 2 | Correspondência com o mundo real | 3 | Linguagem natural, exceto pela exposição de Firebase e configuração técnica |
| 3 | Controle e liberdade | 2 | Falta saída contextual segura, confirmação e opções temporais |
| 4 | Consistência e padrões | 3 | Boa coerência aparente, mas duas folhas CSS disputam autoridade |
| 5 | Prevenção de erros | 2 | Há poucas proteções contra abandono acidental e envios inválidos |
| 6 | Reconhecimento em vez de memorização | 3 | Ações principais são visíveis, mas associação e feedback exigem memória |
| 7 | Flexibilidade e eficiência | 2 | Poucos atalhos, preferências ou caminhos alternativos |
| 8 | Estética e minimalismo | 3 | Interface limpa, mas ações técnicas e metadados competem com o jogo |
| 9 | Reconhecimento e recuperação de erros | 2 | Recuperação contextual e tratamento de falhas online são limitados |
| 10 | Ajuda e documentação | 2 | Há hints, mas pouco auxílio contextual durante formatos menos óbvios |
| **Total** |  | **25/40** | **Aceitável** |

A carga cognitiva geral é moderada. A maioria das telas oferece poucas decisões e bom agrupamento, mas perguntas de associação, conteúdo abaixo da dobra e elementos técnicos aumentam o esforço durante uma tarefa cronometrada.

# Problemas e recomendações

## 1. Composição responsiva da tela de jogo

### Problema

A tela de jogo funciona como uma página vertical formada por cabeçalho, cronômetro, cartão da pergunta, imagem, alternativas e feedback. Não existe uma estratégia suficientemente robusta para garantir que todos os elementos essenciais permaneçam visíveis durante uma pergunta cronometrada.

Em dispositivos pequenos, perguntas com imagem, textos longos ou desafios de associação podem empurrar alternativas e feedback para fora da viewport. Os breakpoints atuais reduzem padding e tamanho de fonte, mas não reorganizam o jogo como uma composição adaptativa completa.

### Recomendação

Redesenhar a tela de jogo como um palco responsivo, com áreas claramente reservadas para:

- Progresso e placar.
- Cronômetro.
- Enunciado.
- Mídia.
- Alternativas ou controles.
- Feedback.

Criar comportamentos específicos para perguntas textuais, visuais, digitadas e de associação, além de textos longos, landscape e zoom de 200%. Testar pelo menos em 320×568, 360×640, 390×844, tablet e landscape móvel.

### Impacto

Muito alto. Melhora a conclusão das partidas, a justiça temporal, a leitura, a acessibilidade e o uso com uma mão.

### Risco

Alto. Alterações em altura, overflow ou posicionamento podem cortar perguntas, esconder alternativas ou interferir em todos os formatos existentes.

### Prioridade

Alta.

## 2. Tratamento de perguntas com imagem

### Problema

Todas as imagens usam a mesma proporção de 16:10 com `object-fit: cover`. Isso pode cortar justamente a parte relevante para responder à pergunta.

A imagem também usa carregamento tardio, apesar de fazer parte de uma questão cronometrada. Em conexões lentas, o jogador pode perder parte do tempo esperando o conteúdo aparecer.

Os dados das perguntas possuem textos alternativos específicos, mas a interface usa o próprio enunciado como `alt`. Isso pode duplicar informação e deixar de descrever o conteúdo visual.

### Recomendação

- Escolher `contain`, `cover` ou enquadramento personalizado conforme cada ativo.
- Preservar a proporção original quando o recorte puder eliminar pistas.
- Reservar o espaço da imagem antes do carregamento.
- Pré-carregar a imagem da próxima pergunta quando apropriado.
- Exibir estados de carregamento e falha.
- Utilizar o texto alternativo editorial disponível nos dados.
- Revisar os textos alternativos para que descrevam a imagem sem revelar a resposta.
- Permitir metadados de enquadramento por imagem, caso necessário.

### Impacto

Muito alto. Evita pistas cortadas, reduz perda de tempo, melhora a acessibilidade e torna as perguntas visuais mais justas.

### Risco

Médio. O uso de `contain` pode alterar bastante a composição. Preload aumenta o consumo de banda, e os textos alternativos exigem revisão editorial cuidadosa.

### Prioridade

Alta.

## 3. Acessibilidade do cronômetro e dos controles dinâmicos

### Problema

O cronômetro é apresentado principalmente como uma barra visual. Ele possui um rótulo estático, mas não informa semanticamente seu valor atual.

Perguntas de texto e associação geram inputs e selects dinamicamente sem labels programáticos suficientes. Isso prejudica leitores de tela e comandos por voz. O tempo da pergunta também é rígido, sem alternativa acessível no modo solo.

### Recomendação

- Representar o cronômetro semanticamente como progresso.
- Informar o tempo de forma compreensível sem gerar anúncios a cada frame.
- Associar labels ou descrições programáticas a todos os inputs e selects dinâmicos.
- Garantir uma relação semântica clara entre cada item de associação e seu controle.
- Oferecer no solo uma preferência de tempo ampliado ou sem limite.
- Manter regras temporais competitivas claras no duelo.
- Validar o fluxo completo com teclado e leitor de tela.

### Impacto

Muito alto para pessoas que usam tecnologias assistivas ou possuem limitações motoras e cognitivas. Também melhora a percepção de justiça do jogo.

### Risco

Médio no solo e alto no duelo. Mudanças temporais podem afetar sincronização, duração da partida e equilíbrio competitivo. Anúncios frequentes também podem gerar ruído.

### Prioridade

Alta.

## 4. Feedback curto e pouco integrado

### Problema

O feedback aparece fora do cartão da pergunta, muda principalmente texto e cor e desaparece após aproximadamente 2,2 segundos. Esse tempo pode ser insuficiente para ler a resposta correta, entender uma explicação, processar um erro ou ouvir o conteúdo com leitor de tela.

A transição automática para a próxima pergunta reduz o valor pedagógico e emocional do momento.

### Recomendação

Transformar o feedback em um estado integrado da própria pergunta, contendo:

- Ícone.
- Rótulo textual de acerto ou erro.
- Resposta correta.
- Explicação ou curiosidade curta.
- Indicação do que acontecerá em seguida.
- Sinalização que não dependa apenas de verde ou vermelho.

No modo solo, avaliar avanço explícito ou duração adaptável. No duelo, preservar a sincronização entre jogadores, mas organizar o feedback para que seja legível dentro da janela disponível.

### Impacto

Alto. Melhora aprendizado, retenção, acessibilidade e emoção. Errar deixa de parecer apenas uma interrupção.

### Risco

Médio/alto. Alterar a duração ou o avanço toca diretamente na sincronização e no ritmo das partidas.

### Prioridade

Alta.

## 5. Gestão de foco nas mudanças de tela

### Problema

As mudanças entre home, setup, countdown, jogo e resultados apenas alternam a tela visível e reposicionam a página. O foco do teclado pode permanecer em um controle que acabou de ser ocultado.

Usuários de leitor de tela podem não perceber claramente que um novo contexto foi aberto.

### Recomendação

- Definir um destino de foco adequado para cada tela.
- Focar o título ou landmark principal ao iniciar uma nova etapa.
- Garantir que a mudança seja anunciada de forma clara.
- Evitar que o foco automático interfira em campos que precisam receber digitação.
- Definir comportamento específico para countdown, pergunta, feedback e resultados.

### Impacto

Alto para navegação por teclado e leitores de tela. Também deixa as transições mais previsíveis.

### Risco

Médio. Foco automático mal aplicado pode causar saltos inesperados ou disputar com inputs.

### Prioridade

Alta.

## 6. Abandono acidental da partida

### Problema

O botão da marca funciona como retorno ao início e pode abandonar uma sala ou partida. Durante countdown ou jogo, um toque acidental pode causar perda de progresso ou encerramento da experiência. Esse risco é maior para o host de uma sala online.

### Recomendação

- Tornar a saída contextual durante countdown e jogo.
- Exibir confirmação apenas quando houver progresso em risco.
- Diferenciar as consequências para host e convidado.
- Manter retorno imediato em telas seguras, como setup e resultados.
- Comunicar claramente se sair encerra a sala ou apenas remove o jogador.

### Impacto

Alto. Reduz perda acidental de partidas e melhora controle e liberdade.

### Risco

Médio. Confirmações excessivas podem interromper o fluxo e gerar frustração.

### Prioridade

Alta.

## 7. Exposição da configuração do Firebase

### Problema

A ação “Configurar online” aparece permanentemente na topbar e abre um formulário que solicita um objeto técnico de configuração do Firebase. Isso expõe infraestrutura ao jogador, compete com as ações principais e pode sugerir que é necessário configurar algo antes de jogar.

### Recomendação

- Tratar a configuração como função administrativa ou de diagnóstico.
- Ocultar essa ação da navegação principal em uma versão pública.
- Revelar uma opção de recuperação somente quando o online não estiver disponível.
- Usar linguagem orientada ao jogador em vez de termos de infraestrutura.
- Preservar uma rota técnica acessível para desenvolvimento e diagnóstico.

### Impacto

Alto na clareza, confiança e primeira impressão.

### Risco

Médio/alto. No ambiente atual, essa pode ser a única rota para recuperar ou configurar o modo online.

### Prioridade

Alta em produto público; média em protótipo privado.

## 8. Pouca diferenciação entre solo e duelo

### Problema

Solo e duelo compartilham praticamente a mesma apresentação durante a partida. No solo, faltam elementos como recorde pessoal, sequência de acertos, ritmo e evolução. No duelo, o adversário aparece principalmente como um badge e há pouca sensação de disputa ao vivo.

### Recomendação

No solo:

- Destacar recorde.
- Mostrar sequência.
- Apresentar ritmo pessoal.
- Indicar evolução em relação a partidas anteriores.

No duelo:

- Mostrar estados como “respondendo”, “resposta registrada” e “aguardando”.
- Tornar a presença do adversário mais perceptível.
- Evitar revelar resposta ou pontuação antes do momento apropriado.
- Comunicar problemas de conexão e reconexão.

### Impacto

Alto na motivação, tensão e percepção de valor dos modos.

### Risco

Alto. Informações do oponente dependem de sincronização, Firebase e decisões sobre justiça competitiva.

### Prioridade

Média.

## 9. Resultados pouco narrativos

### Problema

O resultado solo mostra principalmente número de acertos e tempo médio. O duelo apresenta duas linhas com resultados agregados. Essas informações encerram corretamente a mecânica, mas não entregam um clímax proporcional à proposta de game show e não ajudam suficientemente o jogador a entender seu desempenho.

### Recomendação

Aplicar divulgação progressiva na tela final:

1. Mostrar primeiro o resultado principal.
2. Apresentar uma celebração proporcional.
3. Exibir desempenho por categoria ou tipo.
4. Destacar duas ou três respostas para revisão.
5. Mostrar melhor momento, sequência ou recorde.
6. Explicar o critério de desempate.
7. Oferecer CTA principal adequado ao modo.

Evitar apresentar todas as informações de uma só vez.

### Impacto

Alto no efeito emocional final, no aprendizado e na vontade de jogar novamente.

### Risco

Médio. Exige agregação correta dos dados e tratamento de empate, desconexão e respostas incompletas.

### Prioridade

Média.

## 10. Deriva entre as duas camadas CSS

### Problema

`styles.css` e `visual-polish.css` redefinem tokens e componentes semelhantes. Há diversas cores literais e regras concorrentes. Alguns comportamentos móveis também entram em conflito. A aparência atual pode funcionar, mas sua manutenção é frágil.

### Recomendação

Consolidar gradualmente:

- Tokens de cor.
- Tipografia.
- Espaçamento.
- Raios.
- Sombras.
- Breakpoints.
- Variantes de botões.
- Cards.
- Chips.
- Feedback.
- Progresso.
- Resultados.

Migrar componente por componente, com validação visual entre as etapas. Evitar uma refatoração integral de uma vez.

### Impacto

Médio no curto prazo e alto no longo prazo. Reduz regressões e torna o sistema visual mais previsível.

### Risco

Alto. A camada de polish foi criada para sobrescrever a base, e a cascata atual contém decisões implícitas.

### Prioridade

Média.

## 11. Tipografia dependente da plataforma

### Problema

A identidade tipográfica depende de Arial Rounded e Trebuchet, que não têm aparência ou disponibilidade consistentes em Windows, Android e iOS. Alguns metadados e chips utilizam tamanhos pequenos, uppercase e pouco espaço, prejudicando leitura rápida.

### Recomendação

- Definir uma stack tipográfica mais previsível ou incorporar uma fonte apropriada.
- Estabelecer tamanho mínimo para metadados.
- Revisar uppercase, peso e espaçamento de letras.
- Limitar a largura de leitura dos enunciados.
- Testar mudança de fonte antes do carregamento e variações de plataforma.

### Impacto

Médio. Melhora consistência de marca e legibilidade sob pressão.

### Risco

Baixo/médio. Webfonts podem aumentar o tempo de carregamento e provocar mudanças de layout.

### Prioridade

Média.

## 12. Falta de contrato semântico para cores

### Problema

A paleta é coerente, mas os estados não estão totalmente centralizados em tokens semânticos. Sucesso, erro, foco, chips e superfícies usam várias cores literais. O feedback também depende bastante de verde e vermelho.

### Recomendação

Criar tokens semânticos para:

- Ação principal.
- Ação secundária.
- Superfície.
- Texto principal.
- Texto secundário.
- Sucesso.
- Erro.
- Aviso.
- Foco.
- Estado desabilitado.

Validar contraste WCAG AA nos estados reais e combinar cor com texto, forma ou ícone.

### Impacto

Médio em acessibilidade, coerência e manutenção.

### Risco

Médio. Mudanças aparentemente pequenas podem causar regressões de contraste.

### Prioridade

Média.

## 13. Responsividade da home, topbar e placar

### Problema

A home e os setups possuem espaçamento generoso. Em telas de pouca altura, a margem da topbar, o título grande e os cartões podem empurrar os modos para fora da primeira dobra. Nomes longos de jogadores também podem comprimir o cabeçalho do duelo.

### Recomendação

- Criar ajustes condicionados à altura disponível.
- Tratar landscape separadamente.
- Reduzir primeiro margens e espaços decorativos, preservando alvos de toque.
- Permitir truncamento ou empilhamento seguro no placar.
- Testar nomes com o limite máximo de caracteres.
- Validar zoom de 200% e textos expandidos.

### Impacto

Médio. Melhora descoberta das ações e evita colisões.

### Risco

Baixo/médio.

### Prioridade

Média-baixa.

## 14. Alvos de toque secundários

### Problema

Respostas e botões principais têm dimensões adequadas, mas alguns controles secundários ficam abaixo dos 44 pixels recomendados, incluindo marca, botão superior móvel e fechamento do diálogo.

### Recomendação

Aumentar a área interativa para pelo menos 44×44 CSS pixels, mantendo o ícone visual menor se necessário.

### Impacto

Médio para uso móvel e pessoas com limitações motoras.

### Risco

Baixo. A topbar precisa continuar funcionando em larguras próximas de 320px.

### Prioridade

Média-baixa.

## 15. Movimento reduzido tratado de forma global

### Problema

O suporte a `prefers-reduced-motion` existe, o que é positivo, mas utiliza uma regra global que praticamente elimina todas as animações. Isso pode remover também transições úteis para compreender mudanças de estado.

### Recomendação

- Remover movimentos decorativos.
- Preservar transições instantâneas ou discretas que comuniquem estado.
- Evitar deslocamentos amplos e efeitos de entrada.
- Manter feedback perceptível mesmo sem animação.

### Impacto

Baixo/médio. Melhora acessibilidade sem perder orientação.

### Risco

Médio, pois aumenta a quantidade de regras específicas e a necessidade de testes.

### Prioridade

Baixa.

# Personas e riscos de experiência

## Jordan — usuário iniciante

### Pontos positivos

- Consegue entender os dois modos rapidamente.
- As principais ações têm rótulos textuais.
- A estrutura inicial é simples.

### Riscos

- “Configurar online” pode sugerir que uma configuração técnica é obrigatória.
- Formatos como associação aparecem sob pressão temporal sem preparação suficiente.
- Não há ajuda contextual durante a partida.
- A saída e o retorno não deixam sempre claras suas consequências.

## Sam — usuário dependente de acessibilidade

### Pontos positivos

- Há foco visível.
- Os botões principais usam elementos nativos.
- Setup e lobby possuem labels adequados.

### Riscos

- O cronômetro não apresenta valor semântico.
- Selects de associação não possuem labels programáticos suficientes.
- O limite de tempo é rígido.
- O feedback desaparece rapidamente.
- Mudanças de tela não gerenciam foco.
- Conteúdo pode ficar fora da viewport com zoom de 200%.

## Casey — usuário móvel e distraído

### Pontos positivos

- Respostas e ações principais possuem alvos de toque confortáveis.
- O layout inicial utiliza poucas escolhas.

### Riscos

- Imagem, pergunta e alternativas podem não caber juntas.
- O feedback pode aparecer longe da região visível.
- Interrupções não possuem pausa ou retomada explícita.
- Ações superiores podem ficar fora da zona confortável do polegar.
- Nomes longos podem comprimir o placar.

# Ordem sugerida de implementação

## Fase 1 — Problemas críticos da partida

1. Criar uma matriz responsiva para todos os tipos de pergunta.
2. Corrigir tratamento, recorte, carregamento e texto alternativo das imagens.
3. Implementar semântica adequada para cronômetro e controles dinâmicos.
4. Adicionar gestão de foco nas mudanças de tela.
5. Reestruturar o feedback para ser mais legível, integrado e pedagógico.
6. Proteger a saída durante countdown e partidas.

## Fase 2 — Clareza de produto e integridade do sistema

7. Remover a configuração Firebase da hierarquia principal do jogador.
8. Consolidar gradualmente tokens e componentes das duas camadas CSS.
9. Validar contraste e criar contrato semântico de cores.
10. Ajustar tipografia e tamanho mínimo de metadados.

## Fase 3 — Evolução da experiência

11. Diferenciar melhor solo e duelo.
12. Expandir os resultados com fechamento narrativo e revisão progressiva.
13. Melhorar responsividade da home, topbar e placar.
14. Ajustar alvos de toque secundários.
15. Refinar o tratamento de movimento reduzido.

# Matriz resumida de prioridade

| Ordem | Recomendação | Impacto | Risco | Prioridade |
|---:|---|---|---|---|
| 1 | Composição responsiva da tela de jogo | Muito alto | Alto | Alta |
| 2 | Tratamento das perguntas com imagem | Muito alto | Médio | Alta |
| 3 | Acessibilidade temporal e semântica | Muito alto | Médio/alto | Alta |
| 4 | Feedback integrado e legível | Alto | Médio/alto | Alta |
| 5 | Gestão de foco | Alto | Médio | Alta |
| 6 | Saída segura da partida | Alto | Médio | Alta |
| 7 | Retirar Firebase da interface principal | Alto | Médio/alto | Alta ou média |
| 8 | Consolidar CSS, tokens e componentes | Médio/alto | Alto | Média |
| 9 | Diferenciar solo e duelo | Alto | Alto | Média |
| 10 | Expandir resultados | Alto | Médio | Média |
| 11 | Revisar tipografia | Médio | Baixo/médio | Média |
| 12 | Criar contrato semântico de cores | Médio | Médio | Média |
| 13 | Responsividade da home e placar | Médio | Baixo/médio | Média-baixa |
| 14 | Aumentar alvos de toque secundários | Médio | Baixo | Média-baixa |
| 15 | Refinar movimento reduzido | Baixo/médio | Médio | Baixa |

# Conclusão

O Burrquizzz não precisa de uma substituição completa de sua identidade. A base existente é coerente, reconhecível e suficientemente clara. O melhor caminho é preservar a personalidade atual e fortalecer os momentos que definem o produto.

A implementação futura deveria começar pelas telas de jogo, pois é nelas que responsividade, acessibilidade, mídia, tempo e feedback convergem. Depois disso, o sistema visual pode ser consolidado e os modos solo, duelo e resultados podem ganhar mais caráter.

A pergunta central para orientar as próximas decisões é:

> Se a pergunta é o espetáculo principal do Burrquizzz, como garantir que enunciado, mídia, alternativas, tempo e feedback sejam percebidos como um único palco — e não como partes de um formulário vertical?

# Limitações da análise

O detector estático do Impeccable não encontrou violações no `index.html`, mas isso não comprova conformidade completa. Muitos controles importantes são criados dinamicamente pelo JavaScript e não aparecem no markup inicial.

Não foi iniciada uma URL local nem executada inspeção visual em browser. Portanto, ainda precisam ser validados futuramente:

- Contraste computado.
- Overflow real.
- Recorte efetivo das imagens.
- Ordem de tabulação em execução.
- Comportamento com leitor de tela.
- Zoom de 200%.
- Dispositivos móveis reais.
- Landscape.
- Conexões lentas.
- Sincronização visual do duelo.

Esta etapa de avaliação foi analítica. A única alteração posterior autorizada foi a criação deste arquivo de relatório. Nenhum código do produto foi implementado, nenhum servidor foi iniciado, nenhum commit foi criado e nada foi publicado.

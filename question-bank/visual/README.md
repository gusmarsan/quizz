# Banco visual do Burrquizzz

Acervo editorial de 100 perguntas `image_choice`, verificado em 07/08/2026.

## Distribuição

- 10 — Internet antiga / internet discada
- 20 — Objetos esquecidos / Isso Existiu
- 20 — Celebridades / Quem é essa figura?
- 10 — Games e tecnologia retrô
- 10 — TV e cultura pop
- 10 — Arte
- 10 — Curiosidades visuais / Isso existiu mesmo?
- 10 — Que lugar é esse?

## Imagens

As imagens são reais e foram verificadas a partir de arquivos identificados no Wikimedia Commons. As 100 cópias usadas no jogo foram baixadas e padronizadas em `assets/visual-quiz/`.

Padrão local:

- formato: WebP;
- lado maior: até 1200 px, sem ampliar imagens menores;
- compressão adaptativa com alvo de até aproximadamente 220 KB por imagem;
- nomes estáveis: `v001.webp` a `v100.webp`;
- manifesto técnico: `assets/visual-quiz/manifest.json`.

Cada pergunta continua preservando:

- `imageFile`: nome exato do arquivo de origem;
- `remoteImage`: URL da imagem externa que originou a cópia local;
- `image`: arquivo WebP local efetivamente exibido no jogo;
- `imageSource`: página do arquivo no Wikimedia Commons;
- `imageLicense`: licença ou indicação de domínio público encontrada na página de origem;
- `imageCredit`: autoria/crédito editorial;
- `verifiedAt`: data da curadoria.

O manifesto registra ainda dimensões finais, peso, qualidade de conversão e SHA-256 de cada WebP. Assim, a cópia usada pelo jogo fica estável sem perder a procedência e a licença da imagem original.

## Regras editoriais

- imagens devem ser reconhecíveis, mas não entregar a resposta por texto ou legenda evidente;
- alternativas erradas devem ser plausíveis;
- celebridades recebem enunciados diferentes para não colidir com o histórico antirrepetição por texto;
- lugares evitam pontos turísticos óbvios demais;
- obras de arte priorizam reproduções em domínio público;
- itens históricos e estranhos priorizam domínio público, Creative Commons ou acervos com reutilização declarada.

Este banco não define frequência de aparição por episódio. A regra de selecionar 1 ou 2 perguntas visuais por partida pertence ao motor do jogo e deve ser tratada separadamente da curadoria.

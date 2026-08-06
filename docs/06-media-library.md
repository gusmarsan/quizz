# Biblioteca de mídia do Burrquizzz

## Objetivo

Criar um acervo próprio de imagens reais, áudios e vídeos que possa ser usado com segurança nas descobertas do jogo.

## Regra principal

Nenhuma mídia entra no jogo sem:

- identificação do assunto;
- página de origem;
- autoria conhecida quando exigida;
- licença registrada;
- texto de crédito;
- resposta principal verificada;
- tags para seleção pelo motor de episódios.

## Estrutura do catálogo

O arquivo `assets/media/manifest.json` é a fonte de verdade do acervo.

Cada item deve ter:

- `id`: identificador único e estável;
- `type`: `image`, `audio` ou `video`;
- `status`: `draft`, `ready` ou `blocked`;
- `universe`: universo editorial do Burrquizzz;
- `title`: nome interno;
- `subject`: o que aparece na mídia;
- `imageUrl`, `audioUrl` ou `videoUrl`;
- `sourcePage`: página que comprova origem e licença;
- `author`: autor ou detentor indicado na fonte;
- `license`: licença aplicável;
- `credit`: linha pronta para exibição;
- `tags`: termos usados na seleção;
- `questionSeeds`: ideias de descoberta, não perguntas definitivas.

## Fontes permitidas nesta fase

Prioridade:

1. Wikimedia Commons com licença explícita;
2. domínio público;
3. Creative Commons com atribuição compatível;
4. material criado especificamente para o Burrquizzz.

Não usar automaticamente:

- imagens encontradas em busca comum sem licença clara;
- capturas de filmes, programas ou videoclipes;
- capas, logotipos e fotografias promocionais sem análise de uso;
- links frágeis de redes sociais;
- imagens geradas por IA que finjam ser fotografias históricas.

## Créditos

O jogo deve oferecer uma área de créditos da descoberta ou do episódio. Licenças `CC BY` e `CC BY-SA` exigem atribuição adequada.

## Primeiro pacote

O catálogo inicial contém quatro objetos reais de nostalgia tecnológica:

- fita VHS;
- disquete;
- pager;
- televisão de tubo.

Eles servem para validar o fluxo visual antes de ampliar o acervo.

## Próximas metas

- integrar o catálogo ao Worker;
- fazer a IA escolher no máximo duas mídias por episódio;
- gerar perguntas visuais apenas a partir dos metadados verificados;
- exibir crédito depois da resposta;
- baixar as imagens aprovadas para o próprio repositório, evitando dependência permanente de links externos;
- chegar a 25 itens antes de abrir novas categorias.

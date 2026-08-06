const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const DISCOVERIES_PER_BLOCK = 4;
const BLOCK_COUNT = 4;
const TOTAL_DISCOVERIES = DISCOVERIES_PER_BLOCK * BLOCK_COUNT;

const HOSTS = ["Nico", "Vera", "Duda", "Otto", "Augusto"];

const UNIVERSES = [
  "Rebobina! — nostalgia, objetos e hábitos de outras décadas",
  "Zapeando — televisão brasileira e internacional",
  "Corta! — cinema, bastidores e filmes improváveis",
  "Aumenta o volume — música, versões, bandas e histórias de palco",
  "Mundo Bizarro — fatos reais difíceis de acreditar",
  "Internet Discada — internet antiga, memes, sites e tecnologia",
  "Isso Existiu — produtos, brinquedos, embalagens e invenções",
  "Prorrogação — esportes curiosos e histórias fora do placar",
  "Cultura Pop — celebridades, séries, personagens e fenômenos"
];

const BANNED = [
  "capitais e geografia escolar",
  "fórmulas, matemática e ciências escolares",
  "datas para decorar",
  "política atual",
  "religião",
  "rankings, idades e recordes que mudam com o tempo",
  "perguntas óbvias ou com alternativas absurdas",
  "assuntos repetidos no mesmo episódio"
];

export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "burrquizzz-ai",
        format: "four-block-episode",
        blocks: BLOCK_COUNT,
        discoveries: TOTAL_DISCOVERIES,
        model: MODEL
      }, { headers });
    }
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Use POST para gerar um episódio." }, { status: 405, headers });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const recentQuestions = Array.isArray(body.recentQuestions)
        ? body.recentQuestions.filter((item) => typeof item === "string").slice(-50)
        : [];
      const mediaItems = sanitizeMediaItems(body.mediaItems);
      const visualCount = mediaItems.length ? Math.min(2, mediaItems.length) : 0;

      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: buildPrompt(recentQuestions, mediaItems, visualCount) },
          { role: "user", content: "Crie agora um episódio completo com quatro blocos de quatro descobertas. Retorne apenas o JSON definido pelo esquema." }
        ],
        response_format: {
          type: "json_schema",
          json_schema: buildSchema(mediaItems)
        },
        temperature: 0.86,
        max_completion_tokens: 7000
      });

      const parsed = extractJson(result);
      const episode = validateEpisode(parsed?.episode, mediaItems, visualCount);

      return Response.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        episode,
        questions: episode.discoveries
      }, { headers });
    } catch (error) {
      console.error(error);
      return Response.json({
        ok: false,
        error: "Não foi possível criar o episódio.",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500, headers });
    }
  }
};

function sanitizeMediaItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.status === "ready" && item.type === "image")
    .slice(0, 20)
    .map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      subject: String(item.subject || "").trim(),
      universe: String(item.universe || "Isso Existiu").trim(),
      imageUrl: String(item.imageUrl || "").trim(),
      sourcePage: String(item.sourcePage || "").trim(),
      credit: String(item.credit || "").trim(),
      tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : [],
      questionSeeds: Array.isArray(item.questionSeeds) ? item.questionSeeds.map(String).slice(0, 4) : []
    }))
    .filter((item) => item.id && item.title && item.imageUrl);
}

function buildPrompt(recentQuestions, mediaItems, visualCount) {
  const recentBlock = recentQuestions.length
    ? recentQuestions.map((item) => `- ${item}`).join("\n")
    : "- Nenhuma descoberta anterior informada.";

  const mediaBlock = mediaItems.length
    ? mediaItems.map((item) => `- mediaId: ${item.id} | título: ${item.title} | assunto: ${item.subject} | universo: ${item.universe} | sugestões: ${item.questionSeeds.join(" / ")}`).join("\n")
    : "- Nenhuma mídia disponível.";

  return `
Você é o diretor de conteúdo e roteirista-chefe do Burrquizzz, um game show brasileiro para adultos.

MISSÃO
Crie um episódio divertido, imprevisível e conversável. O objetivo não é provar inteligência, mas provocar surpresa, nostalgia, humor e descoberta. Errar também deve ser divertido porque a explicação revela uma boa história.

TOM
- Português brasileiro natural.
- Texto curto, ritmado e claro.
- Humor leve, inteligente e ocasionalmente sarcástico.
- Nunca humilhe o jogador.
- Nunca pareça prova, vestibular ou aula.
- Não force piadas em todas as descobertas.

ESTRUTURA OBRIGATÓRIA
- Exatamente 4 blocos.
- Exatamente 4 descobertas em cada bloco.
- Exatamente 16 descobertas no episódio.
- Cada bloco precisa ter id curto, title marcante e intro de uma frase.
- Os quatro blocos devem ter identidades diferentes.
- O quarto bloco é o Grande Final.
- A 16ª descoberta deve ser a mais memorável do episódio.
- Não repita pessoa, artista, obra, país, década ou estrutura no episódio.
- Misture pelo menos 6 universos desta lista:
${UNIVERSES.map((item) => `- ${item}`).join("\n")}

RITMO
- Bloco 1: entrada acessível e divertida.
- Bloco 2: cultura pop, música, TV, cinema ou internet.
- Bloco 3: fatos mais estranhos e surpreendentes.
- Bloco 4: Grande Final, com perguntas mais fortes e memoráveis.
- Dificuldade total aproximada: 6 fáceis, 7 médias e 3 difíceis.

DESCOBERTAS VISUAIS
- Gere exatamente ${visualCount} descobertas com type = "image_choice".
- Distribua as visuais em blocos diferentes.
- Use somente mediaId da lista abaixo.
- Não invente mídia, URL ou crédito.
- A imagem deve ser necessária para responder.
- Use cada mediaId no máximo uma vez.
- As demais devem usar type = "multiple_choice" e mediaId vazio.

CATÁLOGO DISPONÍVEL
${mediaBlock}

DESCOBERTA PERFEITA
Cada descoberta precisa ter contexto curto, pergunta clara, quatro alternativas plausíveis, apenas uma correta e explicação de uma ou duas frases com o detalhe mais interessante.

EVITE
${BANNED.map((item) => `- ${item}`).join("\n")}

NÃO REPITA NEM REFORMULE ESTAS DESCOBERTAS RECENTES
${recentBlock}

REVISÃO
Antes de entregar, revise silenciosamente cada descoberta. Reescreva qualquer uma que seja genérica, escolar, duvidosa, repetitiva ou sem graça. Use apenas fatos sobre os quais tenha alta confiança.
`;
}

function buildSchema(mediaItems) {
  const mediaIds = mediaItems.map((item) => item.id);
  const discoverySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["multiple_choice", "image_choice"] },
      mediaId: mediaIds.length ? { type: "string", enum: ["", ...mediaIds] } : { type: "string", enum: [""] },
      category: { type: "string" },
      difficulty: { type: "string", enum: ["facil", "media", "dificil"] },
      prompt: { type: "string" },
      options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
      correctIndex: { type: "integer", minimum: 0, maximum: 3 },
      explanation: { type: "string" }
    },
    required: ["type", "mediaId", "category", "difficulty", "prompt", "options", "correctIndex", "explanation"]
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      episode: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          host: { type: "string", enum: HOSTS },
          intro: { type: "string" },
          outro: { type: "string" },
          blocks: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                intro: { type: "string" },
                discoveries: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: discoverySchema
                }
              },
              required: ["id", "title", "intro", "discoveries"]
            }
          }
        },
        required: ["title", "subtitle", "host", "intro", "outro", "blocks"]
      }
    },
    required: ["episode"]
  };
}

function extractJson(result) {
  if (result?.response && typeof result.response === "object") return result.response;
  const raw = result?.choices?.[0]?.message?.content ?? result?.response ?? result;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") throw new Error("Formato inesperado da IA.");
  return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim());
}

function validateEpisode(input, mediaItems, expectedVisualCount) {
  if (!input || !Array.isArray(input.blocks) || input.blocks.length !== BLOCK_COUNT) {
    throw new Error("O episódio não contém quatro blocos válidos.");
  }

  const mediaMap = new Map(mediaItems.map((item) => [item.id, item]));
  const usedMedia = new Set();
  const seen = new Set();
  const blocks = [];
  const discoveries = [];

  input.blocks.forEach((block, blockIndex) => {
    if (!Array.isArray(block?.discoveries) || block.discoveries.length !== DISCOVERIES_PER_BLOCK) {
      throw new Error(`O bloco ${blockIndex + 1} não contém quatro descobertas.`);
    }

    const cleanBlockDiscoveries = [];

    block.discoveries.forEach((item, position) => {
      const prompt = String(item?.prompt || "").trim();
      const options = Array.isArray(item?.options) ? item.options.map((option) => String(option).trim()) : [];
      const correctIndex = Number(item?.correctIndex);
      const key = normalize(prompt);
      const requestedType = item?.type === "image_choice" ? "image_choice" : "multiple_choice";
      const mediaId = String(item?.mediaId || "").trim();
      const media = requestedType === "image_choice" ? mediaMap.get(mediaId) : null;

      if (!prompt || key.length < 12 || seen.has(key)) throw new Error("Descoberta repetida ou curta demais.");
      if (options.length !== 4 || options.some((option) => !option) || new Set(options.map(normalize)).size !== 4) throw new Error("Alternativas inválidas.");
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error("Resposta correta inválida.");
      if (requestedType === "image_choice" && (!media || usedMedia.has(mediaId))) throw new Error("Mídia visual inválida ou repetida.");

      seen.add(key);
      if (media) usedMedia.add(mediaId);

      const discovery = {
        id: `ai-${crypto.randomUUID()}`,
        type: media ? "image_choice" : "multiple_choice",
        category: String(item.category || media?.universe || "Mundo Bizarro").trim(),
        difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
        blockIndex,
        blockPosition: position,
        isGrandFinal: blockIndex === 3 && position === 3,
        prompt,
        options,
        correctIndex,
        explanation: String(item.explanation || "").trim(),
        ...(media ? {
          mediaId,
          image: media.imageUrl,
          imageCredit: media.credit,
          imageSource: media.sourcePage,
          supportText: media.credit ? `Imagem: ${media.credit}` : ""
        } : {})
      };

      cleanBlockDiscoveries.push(discovery);
      discoveries.push(discovery);
    });

    blocks.push({
      id: String(block.id || `bloco-${blockIndex + 1}`).trim(),
      title: String(block.title || `Bloco ${blockIndex + 1}`).trim(),
      intro: String(block.intro || "Mais quatro descobertas de utilidade questionável.").trim(),
      startIndex: blockIndex * 4,
      endIndex: blockIndex * 4 + 3,
      discoveries: cleanBlockDiscoveries.map((item) => item.id)
    });
  });

  const visualCount = discoveries.filter((item) => item.type === "image_choice").length;
  if (visualCount < expectedVisualCount) throw new Error(`Foram criadas apenas ${visualCount} descobertas visuais válidas.`);

  return {
    id: `episode-${crypto.randomUUID()}`,
    title: String(input.title || "O mundo é mais estranho do que parece").trim(),
    subtitle: String(input.subtitle || "Conhecimento de utilidade rigorosamente duvidosa").trim(),
    host: HOSTS.includes(input.host) ? input.host : "Nico",
    intro: String(input.intro || "Prepare-se para descobrir coisas que você não precisava saber — até agora.").trim(),
    outro: String(input.outro || "Agora você sabe mais coisas inúteis do que alguns minutos atrás.").trim(),
    blocks,
    discoveries
  };
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

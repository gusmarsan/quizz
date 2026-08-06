const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

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
      return Response.json({ ok: true, service: "burrquizzz-ai", format: "episode-with-media", model: MODEL }, { headers });
    }
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Use POST para gerar um episódio." }, { status: 405, headers });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const requestedCount = Number.parseInt(body.count, 10);
      const count = Number.isInteger(requestedCount) ? Math.min(20, Math.max(5, requestedCount)) : 15;
      const recentQuestions = Array.isArray(body.recentQuestions)
        ? body.recentQuestions.filter((item) => typeof item === "string").slice(-50)
        : [];
      const mediaItems = sanitizeMediaItems(body.mediaItems);
      const visualCount = mediaItems.length ? Math.min(2, mediaItems.length, Math.max(1, Math.floor(count / 8))) : 0;

      const schema = buildSchema(count, mediaItems);
      const prompt = buildPrompt(count, recentQuestions, mediaItems, visualCount);

      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Crie agora um episódio completo. Retorne apenas o JSON definido pelo esquema." }
        ],
        response_format: { type: "json_schema", json_schema: schema },
        temperature: 0.85,
        max_completion_tokens: 6500
      });

      const parsed = extractJson(result);
      const episode = validateEpisode(parsed?.episode, count, mediaItems, visualCount);

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
    .slice(0, 12)
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

function buildPrompt(count, recentQuestions, mediaItems, visualCount) {
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

EPISÓDIO
- Gere exatamente ${count} descobertas.
- Crie título curto e memorável, subtítulo, abertura e encerramento.
- Escolha um apresentador entre: ${HOSTS.join(", ")}.
- Misture pelo menos 6 universos diferentes desta lista:
${UNIVERSES.map((item) => `- ${item}`).join("\n")}
- Não use o mesmo universo em três descobertas consecutivas.
- Não repita artista, obra, pessoa, país, década ou estrutura dentro do episódio.
- Ordem de dificuldade: cerca de 40% fáceis, 40% médias e 20% difíceis.
- A última descoberta deve ser a mais memorável, não necessariamente a mais difícil.

DESCOBERTAS VISUAIS
- Gere exatamente ${visualCount} descobertas com type = "image_choice".
- Nas visuais, use somente um mediaId da lista abaixo.
- Não invente mídia, URL, crédito ou imagem.
- A imagem deve ser necessária para responder, não apenas decorativa.
- Use cada mediaId no máximo uma vez.
- As demais descobertas devem usar type = "multiple_choice" e mediaId vazio.

CATÁLOGO DISPONÍVEL
${mediaBlock}

DESCOBERTA PERFEITA
Cada descoberta precisa ter:
1. um contexto curto ou detalhe intrigante;
2. uma pergunta clara;
3. quatro alternativas plausíveis;
4. apenas uma resposta correta;
5. explicação de uma ou duas frases com a parte mais interessante do fato.

EVITE
${BANNED.map((item) => `- ${item}`).join("\n")}

NÃO REPITA NEM REFORMULE ESTAS DESCOBERTAS RECENTES
${recentBlock}

QUALIDADE
Antes de entregar, revise silenciosamente cada descoberta. Descarte e reescreva qualquer uma que seja genérica, escolar, duvidosa, repetitiva ou sem graça. Use apenas fatos sobre os quais tenha alta confiança.
`;
}

function buildSchema(count, mediaItems) {
  const mediaIds = mediaItems.map((item) => item.id);
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
          discoveries: {
            type: "array",
            minItems: count,
            maxItems: count,
            items: {
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
            }
          }
        },
        required: ["title", "subtitle", "host", "intro", "outro", "discoveries"]
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

function validateEpisode(input, expectedCount, mediaItems, expectedVisualCount) {
  if (!input || !Array.isArray(input.discoveries)) throw new Error("Episódio inválido.");

  const mediaMap = new Map(mediaItems.map((item) => [item.id, item]));
  const usedMedia = new Set();
  const discoveries = [];
  const seen = new Set();

  for (const item of input.discoveries) {
    const prompt = String(item?.prompt || "").trim();
    const options = Array.isArray(item?.options) ? item.options.map((option) => String(option).trim()) : [];
    const correctIndex = Number(item?.correctIndex);
    const key = normalize(prompt);
    const requestedType = item?.type === "image_choice" ? "image_choice" : "multiple_choice";
    const mediaId = String(item?.mediaId || "").trim();
    const media = requestedType === "image_choice" ? mediaMap.get(mediaId) : null;

    if (!prompt || key.length < 12 || seen.has(key) || options.length !== 4 || options.some((option) => !option) || new Set(options.map(normalize)).size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
    if (requestedType === "image_choice" && (!media || usedMedia.has(mediaId))) continue;

    seen.add(key);
    if (media) usedMedia.add(mediaId);

    discoveries.push({
      id: `ai-${crypto.randomUUID()}`,
      type: media ? "image_choice" : "multiple_choice",
      category: String(item.category || media?.universe || "Mundo Bizarro").trim(),
      difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
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
    });
  }

  if (discoveries.length < expectedCount) throw new Error(`Foram criadas apenas ${discoveries.length} descobertas válidas.`);
  const visualCount = discoveries.filter((item) => item.type === "image_choice").length;
  if (visualCount < expectedVisualCount) throw new Error(`Foram criadas apenas ${visualCount} descobertas visuais válidas.`);

  return {
    id: `episode-${crypto.randomUUID()}`,
    title: String(input.title || "O mundo é mais estranho do que parece").trim(),
    subtitle: String(input.subtitle || "Conhecimento de utilidade rigorosamente duvidosa").trim(),
    host: HOSTS.includes(input.host) ? input.host : "Nico",
    intro: String(input.intro || "Prepare-se para descobrir coisas que você não precisava saber — até agora.").trim(),
    outro: String(input.outro || "Agora você sabe mais coisas inúteis do que alguns minutos atrás.").trim(),
    discoveries: discoveries.slice(0, expectedCount)
  };
}

function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

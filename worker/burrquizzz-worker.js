const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const BLOCKS = 4;
const PER_BLOCK = 4;
const TOTAL = BLOCKS * PER_BLOCK;
const HOSTS = ["Nico", "Vera", "Duda", "Otto", "Augusto"];
const UNIVERSES = ["Rebobina!", "Zapeando", "Corta!", "Aumenta o volume", "Mundo Bizarro", "Internet Discada", "Isso Existiu", "Prorrogação", "Cultura Pop"];
const TIME_RISK = [/\batualmente\b/i, /\bhoje\b/i, /\bmais recente\b/i, /\brecorde atual\b/i, /\bem 202[4-9]\b/i, /\bcontinua sendo\b/i];

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
        format: "curated-four-block-episode",
        blocks: BLOCKS,
        discoveries: TOTAL,
        curator: true,
        model: MODEL
      }, { headers });
    }
    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Use POST para gerar um episódio." }, { status: 405, headers });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const recent = Array.isArray(body.recentQuestions)
        ? body.recentQuestions.filter((item) => typeof item === "string").slice(-50)
        : [];
      const media = sanitizeMedia(body.mediaItems);
      const visualCount = media.length ? Math.min(2, media.length) : 0;
      const schema = episodeSchema(media);

      const draftResult = await runJson(env, generationPrompt(recent, media, visualCount),
        "Crie um episódio com 4 blocos de 4 descobertas.", schema, 0.82);
      const draft = extractJson(draftResult)?.episode;
      validateEpisode(draft, media, visualCount, false);

      const reviewResult = await runJson(env, curatorPrompt(media, visualCount),
        JSON.stringify({ episode: draft }), schema, 0.1);
      const reviewed = extractJson(reviewResult)?.episode;
      const episode = validateEpisode(reviewed, media, visualCount, true);

      return Response.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        curator: {
          enabled: true,
          reviewedDiscoveries: TOTAL,
          strictAnswerChecks: TOTAL,
          visualDiscoveries: episode.discoveries.filter((item) => item.type === "image_choice").length
        },
        episode,
        questions: episode.discoveries
      }, { headers });
    } catch (error) {
      console.error("Burrquizzz generation error", error);
      return Response.json({
        ok: false,
        error: "Não foi possível criar um episódio confiável.",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500, headers });
    }
  }
};

function runJson(env, system, user, schema, temperature) {
  return env.AI.run(MODEL, {
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_schema", json_schema: schema },
    temperature,
    max_completion_tokens: 7000
  });
}

function sanitizeMedia(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.status === "ready" && item?.type === "image")
    .slice(0, 20)
    .map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      subject: String(item.subject || "").trim(),
      universe: String(item.universe || "Isso Existiu").trim(),
      imageUrl: String(item.imageUrl || "").trim(),
      sourcePage: String(item.sourcePage || "").trim(),
      credit: String(item.credit || "").trim(),
      questionSeeds: Array.isArray(item.questionSeeds) ? item.questionSeeds.map(String).slice(0, 4) : []
    }))
    .filter((item) => item.id && item.title && item.imageUrl);
}

function generationPrompt(recent, media, visualCount) {
  return `Você é o roteirista-chefe do Burrquizzz, um game show brasileiro de cultura pop, nostalgia, humor e curiosidades esquisitas.

PRECISÃO É OBRIGATÓRIA
- Não invente fatos, títulos, nomes, números, recordes ou relações entre pessoas e obras.
- Use apenas fatos estáveis sobre os quais tenha alta confiança.
- Se houver dúvida, troque o assunto.
- Só uma alternativa pode estar correta.
- correctIndex precisa apontar exatamente para ela.
- A explicação deve começar com: Resposta: <texto exato da alternativa correta>.
- Evite números exatos, superlativos, recordes, rankings, idades e fatos atuais.
- Não trate boatos ou lendas urbanas como fatos.

FORMATO
- Exatamente 4 blocos de 4 descobertas, total 16.
- Bloco 1 acessível; bloco 2 cultura pop; bloco 3 mais estranho; bloco 4 Grande Final.
- A 16ª deve ser memorável.
- Misture ao menos 6 universos: ${UNIVERSES.join(", ")}.
- Não repita pessoa, artista, obra, país, década ou estrutura.
- Aproximadamente 6 fáceis, 7 médias e 3 difíceis.
- Exatamente ${visualCount} descobertas image_choice, em blocos diferentes; as demais multiple_choice.
- Use somente os mediaId autorizados.

TOM
Português brasileiro, texto curto, humor leve e ocasionalmente sarcástico. Nunca pareça prova e nunca humilhe o jogador.

CATÁLOGO
${mediaText(media)}

NÃO REPITA
${recent.length ? recent.map((item) => `- ${item}`).join("\n") : "- Nenhuma descoberta recente."}

Antes de entregar, confira cada resposta e reescreva qualquer item ambíguo, duvidoso, escolar, repetitivo ou sem graça.`;
}

function curatorPrompt(media, visualCount) {
  return `Você é o Curador Factual do Burrquizzz. Receberá um episódio em JSON e deve devolver o episódio final corrigido no mesmo esquema.

Não confie no rascunho. Para cada descoberta:
- confirme que o fato é estável e amplamente verificável;
- confirme que apenas uma alternativa é correta;
- corrija correctIndex quando necessário;
- faça a explicação começar exatamente com Resposta: <texto exato da alternativa correta>.;
- reescreva por completo qualquer item incerto, ambíguo, baseado em boato, dependente de atualidade ou com mais de uma resposta defensável;
- evite números exatos, superlativos e recordes salvo quando forem históricos e indiscutíveis;
- preserve o humor, mas precisão vem antes.

Preserve exatamente 4 blocos de 4 descobertas, exatamente ${visualCount} visuais e o quarto bloco como Grande Final. Use somente estes mediaId:
${mediaText(media)}

Entregue somente o JSON final.`;
}

function mediaText(media) {
  if (!media.length) return "- Nenhuma mídia disponível.";
  return media.map((item) =>
    `- ${item.id}: ${item.title}; assunto: ${item.subject}; universo: ${item.universe}; sugestões: ${item.questionSeeds.join(" / ")}`
  ).join("\n");
}

function episodeSchema(media) {
  const mediaIds = media.map((item) => item.id);
  const discovery = {
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
            minItems: BLOCKS,
            maxItems: BLOCKS,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                intro: { type: "string" },
                discoveries: { type: "array", minItems: PER_BLOCK, maxItems: PER_BLOCK, items: discovery }
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

function validateEpisode(input, mediaItems, expectedVisuals, strict) {
  if (!input || !Array.isArray(input.blocks) || input.blocks.length !== BLOCKS) {
    throw new Error("O episódio não contém quatro blocos válidos.");
  }

  const mediaMap = new Map(mediaItems.map((item) => [item.id, item]));
  const usedMedia = new Set();
  const seen = new Set();
  const blocks = [];
  const discoveries = [];

  input.blocks.forEach((block, blockIndex) => {
    if (!Array.isArray(block?.discoveries) || block.discoveries.length !== PER_BLOCK) {
      throw new Error(`O bloco ${blockIndex + 1} não contém quatro descobertas.`);
    }

    const ids = [];
    block.discoveries.forEach((item, position) => {
      const prompt = String(item?.prompt || "").trim();
      const options = Array.isArray(item?.options) ? item.options.map((option) => String(option).trim()) : [];
      const correctIndex = Number(item?.correctIndex);
      const explanation = String(item?.explanation || "").trim();
      const key = normalize(prompt);
      const requestedImage = item?.type === "image_choice";
      const mediaId = String(item?.mediaId || "").trim();
      const media = requestedImage ? mediaMap.get(mediaId) : null;

      if (!prompt || key.length < 12 || seen.has(key)) throw new Error("Descoberta repetida ou curta demais.");
      if (options.length !== 4 || options.some((option) => !option) || new Set(options.map(normalize)).size !== 4) throw new Error("Alternativas inválidas.");
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error("Resposta correta inválida.");
      if (requestedImage && (!media || usedMedia.has(mediaId))) throw new Error("Mídia visual inválida ou repetida.");
      if (TIME_RISK.some((pattern) => pattern.test(`${prompt} ${explanation}`))) throw new Error("Fato dependente de atualidade.");
      if (strict) validateAnswer(options[correctIndex], explanation);

      seen.add(key);
      if (media) usedMedia.add(mediaId);
      const id = `ai-${crypto.randomUUID()}`;
      ids.push(id);
      discoveries.push({
        id,
        type: media ? "image_choice" : "multiple_choice",
        category: String(item.category || media?.universe || "Mundo Bizarro").trim(),
        difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
        blockIndex,
        blockPosition: position,
        isGrandFinal: blockIndex === 3 && position === 3,
        prompt,
        options,
        correctIndex,
        explanation,
        ...(media ? {
          mediaId,
          image: media.imageUrl,
          imageCredit: media.credit,
          imageSource: media.sourcePage,
          supportText: media.credit ? `Imagem: ${media.credit}` : ""
        } : {})
      });
    });

    blocks.push({
      id: String(block.id || `bloco-${blockIndex + 1}`).trim(),
      title: String(block.title || `Bloco ${blockIndex + 1}`).trim(),
      intro: String(block.intro || "Mais quatro descobertas de utilidade questionável.").trim(),
      startIndex: blockIndex * PER_BLOCK,
      endIndex: blockIndex * PER_BLOCK + PER_BLOCK - 1,
      discoveries: ids
    });
  });

  const visuals = discoveries.filter((item) => item.type === "image_choice").length;
  if (visuals !== expectedVisuals) throw new Error(`O episódio contém ${visuals} visuais; eram esperadas ${expectedVisuals}.`);

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

function validateAnswer(correctOption, explanation) {
  const expected = normalize(`Resposta: ${correctOption}.`);
  if (explanation.length < 18 || !normalize(explanation).startsWith(expected)) {
    throw new Error("A explicação não confirma exatamente a alternativa correta.");
  }
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

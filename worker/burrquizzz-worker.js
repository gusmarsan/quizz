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
      return Response.json({ ok: true, service: "burrquizzz-ai", format: "episode", model: MODEL }, { headers });
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

      const schema = buildSchema(count);
      const prompt = buildPrompt(count, recentQuestions);

      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Crie agora um episódio completo. Retorne apenas o JSON definido pelo esquema." }
        ],
        response_format: { type: "json_schema", json_schema: schema },
        temperature: 0.85,
        max_completion_tokens: 6000
      });

      const parsed = extractJson(result);
      const episode = validateEpisode(parsed?.episode, count);

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

function buildPrompt(count, recentQuestions) {
  const recentBlock = recentQuestions.length
    ? recentQuestions.map((item) => `- ${item}`).join("\n")
    : "- Nenhuma descoberta anterior informada.";

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
- Gere exatamente ${count} descobertas de múltipla escolha.
- Crie título curto e memorável, subtítulo, abertura e encerramento.
- Escolha um apresentador entre: ${HOSTS.join(", ")}.
- Misture pelo menos 6 universos diferentes desta lista:
${UNIVERSES.map((item) => `- ${item}`).join("\n")}
- Não use o mesmo universo em três descobertas consecutivas.
- Não repita artista, obra, pessoa, país, década ou estrutura dentro do episódio.
- Ordem de dificuldade: cerca de 40% fáceis, 40% médias e 20% difíceis.
- A última descoberta deve ser a mais memorável, não necessariamente a mais difícil.

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

function buildSchema(count) {
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
                category: { type: "string" },
                difficulty: { type: "string", enum: ["facil", "media", "dificil"] },
                prompt: { type: "string" },
                options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
                correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                explanation: { type: "string" }
              },
              required: ["category", "difficulty", "prompt", "options", "correctIndex", "explanation"]
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

function validateEpisode(input, expectedCount) {
  if (!input || !Array.isArray(input.discoveries)) throw new Error("Episódio inválido.");

  const discoveries = [];
  const seen = new Set();
  for (const item of input.discoveries) {
    const prompt = String(item?.prompt || "").trim();
    const options = Array.isArray(item?.options) ? item.options.map((option) => String(option).trim()) : [];
    const correctIndex = Number(item?.correctIndex);
    const key = normalize(prompt);

    if (!prompt || key.length < 12 || seen.has(key) || options.length !== 4 || options.some((option) => !option) || new Set(options.map(normalize)).size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;

    seen.add(key);
    discoveries.push({
      id: `ai-${crypto.randomUUID()}`,
      type: "multiple_choice",
      category: String(item.category || "Mundo Bizarro").trim(),
      difficulty: ["facil", "media", "dificil"].includes(item.difficulty) ? item.difficulty : "media",
      prompt,
      options,
      correctIndex,
      explanation: String(item.explanation || "").trim()
    });
  }

  if (discoveries.length < expectedCount) throw new Error(`Foram criadas apenas ${discoveries.length} descobertas válidas.`);

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

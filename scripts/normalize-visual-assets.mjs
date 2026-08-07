import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "assets", "visual-quiz");
const moduleUrl = `${pathToFileURL(path.join(root, "question-bank", "visual-batch.js")).href}?build=${Date.now()}`;
const { VISUAL_QUESTIONS } = await import(moduleUrl);

if (!Array.isArray(VISUAL_QUESTIONS) || VISUAL_QUESTIONS.length !== 100) {
  throw new Error(`Esperadas 100 perguntas visuais; recebidas ${VISUAL_QUESTIONS?.length ?? 0}.`);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const manifest = [];
const failures = [];
const MAX_SIDE = 1200;
const TARGET_BYTES = 220 * 1024;
const MIN_QUALITY = 48;
const START_QUALITY = 80;
const REQUEST_GAP_MS = 1800;
const MAX_FETCH_ATTEMPTS = 7;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchImage(url, id) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "BurrquizzzVisualAssetBuilder/1.0 (https://github.com/gusmarsan/quizz)",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });

      if (response.ok) return response;

      const retryAfter = Number(response.headers.get("retry-after"));
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) throw new Error(`HTTP ${response.status}`);

      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(45000, 3500 * attempt * attempt);

      lastError = new Error(`HTTP ${response.status}`);
      console.warn(`${id}: tentativa ${attempt}/${MAX_FETCH_ATTEMPTS} recebeu HTTP ${response.status}; aguardando ${Math.round(waitMs / 1000)}s.`);
      await sleep(waitMs);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_FETCH_ATTEMPTS) break;
      const waitMs = Math.min(30000, 2500 * attempt);
      console.warn(`${id}: tentativa ${attempt}/${MAX_FETCH_ATTEMPTS} falhou (${error.message}); aguardando ${Math.round(waitMs / 1000)}s.`);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error("falha ao baixar imagem");
}

for (const [index, question] of VISUAL_QUESTIONS.entries()) {
  const id = String(question.id || "").trim();
  const imageFile = String(question.imageFile || "").trim();
  if (!id || !imageFile) {
    failures.push(`${id || `item-${index + 1}`}: sem id ou imageFile`);
    continue;
  }

  const sourceImage = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(imageFile)}?width=1600`;
  const outputName = `${id}.webp`;
  const outputPath = path.join(outputDir, outputName);

  try {
    if (index > 0) await sleep(REQUEST_GAP_MS);
    const response = await fetchImage(sourceImage, id);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`resposta não é imagem (${contentType || "sem content-type"})`);
    }

    const original = Buffer.from(await response.arrayBuffer());
    if (original.length < 1000) {
      throw new Error(`arquivo suspeitamente pequeno (${original.length} bytes)`);
    }

    let quality = START_QUALITY;
    let converted;
    let info;

    do {
      const result = await sharp(original, { animated: false })
        .rotate()
        .resize({
          width: MAX_SIDE,
          height: MAX_SIDE,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality, effort: 5, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });

      converted = result.data;
      info = result.info;
      if (converted.length <= TARGET_BYTES || quality <= MIN_QUALITY) break;
      quality -= 4;
    } while (quality >= MIN_QUALITY);

    await fs.writeFile(outputPath, converted);

    manifest.push({
      id,
      category: question.category,
      theme: question.theme,
      localImage: `./assets/visual-quiz/${outputName}`,
      imageFile,
      sourceImage,
      sourcePage: question.imageSource,
      license: question.imageLicense,
      credit: question.imageCredit,
      verifiedAt: question.verifiedAt,
      width: info.width,
      height: info.height,
      bytes: converted.length,
      quality,
      sha256: crypto.createHash("sha256").update(converted).digest("hex")
    });

    console.log(`[${String(index + 1).padStart(3, "0")}/100] ${id}: ${info.width}x${info.height}, ${Math.round(converted.length / 1024)} KB, q${quality}`);
  } catch (error) {
    failures.push(`${id}: ${error.message}`);
    console.error(`FALHA ${id}:`, error.message);
  }
}

if (failures.length) {
  throw new Error(`Falharam ${failures.length} imagens:\n${failures.join("\n")}`);
}

const ids = new Set(manifest.map((item) => item.id));
if (manifest.length !== 100 || ids.size !== 100) {
  throw new Error("Manifesto visual incompleto ou com IDs duplicados.");
}

const totalBytes = manifest.reduce((sum, item) => sum + item.bytes, 0);
await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: manifest.length,
    format: "webp",
    maxSidePx: MAX_SIDE,
    targetMaxBytes: TARGET_BYTES,
    totalBytes,
    items: manifest
  }, null, 2)}\n`
);

console.log(`\n100/100 imagens normalizadas. Total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB.`);

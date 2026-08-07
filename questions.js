// Burrquizzz v2.5.0 — 1.090 perguntas ativas, incluindo 100 perguntas visuais verificadas.
// Diretriz editorial: manter e expandir estes temas em futuras renovações.
// Temas-base: curiosidades inúteis, internet nostálgica, TV e nostalgia, TV brasileira,
// cinema, séries, animação, música brasileira, pop internacional, rock e metal, games,
// objetos/tecnologia nostálgicos, ciência, história e geografia.
// Novos eixos: HQs, literatura clássica, Recordes Guinness, recordes absurdos,
// campeões/recordistas, arte, objetos esquecidos, celebridades e lugares pelo mundo.

import batch01 from "./question-bank/batch-01.js?v=2.4.0";
import batch02 from "./question-bank/batch-02.js?v=2.4.0";
import batch03 from "./question-bank/batch-03.js?v=2.4.0";
import batch04 from "./question-bank/batch-04.js?v=2.4.0";
import batch05 from "./question-bank/batch-05.js?v=2.4.0";
import batch06 from "./question-bank/batch-06.js?v=2.4.0";
import batch07 from "./question-bank/batch-07.js?v=2.4.0";
import batch08 from "./question-bank/batch-08.js?v=2.4.0";
import batch09 from "./question-bank/batch-09.js?v=2.4.0";
import batch10 from "./question-bank/batch-10.js?v=2.4.0";
import batch11 from "./question-bank/batch-11.js?v=2.4.0";
import batch12 from "./question-bank/batch-12.js?v=2.4.0";
import batch13 from "./question-bank/batch-13.js?v=2.4.0";
import batch14 from "./question-bank/batch-14.js?v=2.4.0";
import batch15 from "./question-bank/batch-15.js?v=2.4.0";
import batch16 from "./question-bank/batch-16.js?v=2.4.0";
import batch17a from "./question-bank/batch-17a.js?v=2.4.0";
import batch17b from "./question-bank/batch-17b.js?v=2.4.0";
import batch18a from "./question-bank/batch-18a.js?v=2.4.0";
import batch18b from "./question-bank/batch-18b.js?v=2.4.0";
import batch19 from "./question-bank/batch-19.js?v=2.4.0";
import batch20 from "./question-bank/batch-20.js?v=2.4.0";
import visualQuestions from "./question-bank/visual-batch.js?v=2.5.0";

const BASE_QUESTIONS = [
  ...batch01,
  ...batch02,
  ...batch03,
  ...batch04,
  ...batch05,
  ...batch06,
  ...batch07,
  ...batch08,
  ...batch09,
  ...batch10,
  ...batch11,
  ...batch12,
  ...batch13,
  ...batch14,
  ...batch15,
  ...batch16,
  ...batch17a,
  ...batch17b,
  ...batch18a,
  ...batch18b,
  ...batch19,
  ...batch20
];

// As 10 perguntas visuais antigas usavam SVGs provisórios e foram substituídas pelo novo acervo.
const BASE_WITHOUT_LEGACY_IMAGES = BASE_QUESTIONS.filter(
  (question) => question.type !== "image_choice"
);

export const QUESTIONS = [
  ...BASE_WITHOUT_LEGACY_IMAGES,
  ...visualQuestions
];

if (BASE_QUESTIONS.length !== 1000) {
  throw new Error(`Banco-base incompleto: ${BASE_QUESTIONS.length}/1000.`);
}

if (visualQuestions.length !== 100) {
  throw new Error(`Banco visual incompleto: ${visualQuestions.length}/100.`);
}

if (QUESTIONS.length !== 1090) {
  throw new Error(`Banco ativo incompleto: ${QUESTIONS.length}/1090.`);
}

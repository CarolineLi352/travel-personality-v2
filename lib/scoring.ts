import questionsData from "@/data/questions.json";
import questionInfluenceData from "@/data/question-influence.json";
import { personas } from "@/data/catalog";
import calibrationData from "@/data/persona-calibration.json";
import { validateQuestionInfluence, validateQuestions } from "@/lib/question-data";
import { dimensionIds, type Answer, type Persona, type Question, type Scores } from "@/lib/types";

export const questions = validateQuestions(questionsData) as Question[];
const questionInfluence = validateQuestionInfluence(questionInfluenceData, questions);

const zeros = (): Scores => ({ npc: 0, chaos: 0, hype: 0, spend: 0, camera: 0, control: 0 });

const maxima = questions.reduce((totals, question) => {
  const influence = questionInfluence[question.id];
  for (const dimension of dimensionIds) {
    totals[dimension] += Math.max(...question.options.map((option) => option.weights[dimension] ?? 0)) * influence;
  }
  return totals;
}, zeros());

export function scoreAnswers(answers: Answer[]): Scores {
  const raw = zeros();
  for (const answer of answers) {
    const question = questions.find((item) => item.id === answer.questionId);
    if (!question) continue;
    const option = question.options.find((item) => item.id === answer.optionId);
    if (!option) continue;
    const influence = questionInfluence[question.id];
    for (const dimension of dimensionIds) raw[dimension] += (option.weights[dimension] ?? 0) * influence;
  }

  return Object.fromEntries(
    dimensionIds.map((dimension) => [dimension, Math.round((raw[dimension] / maxima[dimension]) * 100)]),
  ) as Scores;
}

type PersonaCalibration = Record<string, { mean: number; deviation: number; bias: number }>;
const personaCalibration = calibrationData as PersonaCalibration;

function calibratedDistance(scores: Scores, persona: Persona) {
  const squaredDistance = dimensionIds.reduce(
    (sum, dimension) => sum + Math.pow(scores[dimension] - persona.vector[dimension], 2),
    0,
  );
  const calibration = personaCalibration[persona.id];
  if (!calibration) return squaredDistance;
  return (squaredDistance - calibration.mean) / calibration.deviation - calibration.bias;
}

const personaHintCandidateWindow = 0.2;
const personaHintStrength = 0.04;

function personaEvidence(answers: Answer[]) {
  const evidence = Object.fromEntries(personas.map((persona) => [persona.id, 0])) as Record<string, number>;
  for (const answer of answers) {
    const option = questions.find((question) => question.id === answer.questionId)
      ?.options.find((item) => item.id === answer.optionId);
    const influence = questionInfluence[answer.questionId] ?? 1;
    for (const [personaId, weight] of Object.entries(option?.personaHints ?? {})) {
      evidence[personaId] = (evidence[personaId] ?? 0) + weight * influence;
    }
  }
  return evidence;
}

export function matchPersona(scores: Scores, answers: Answer[] = []): Persona {
  const ranked = personas
    .map((persona) => ({ persona, distance: calibratedDistance(scores, persona) }))
    .sort((a, b) => a.distance - b.distance);
  if (answers.length === 0) return ranked[0].persona;

  const evidence = personaEvidence(answers);
  const candidates = ranked.filter((candidate) => candidate.distance - ranked[0].distance <= personaHintCandidateWindow);
  return candidates
    .map((candidate) => ({
      ...candidate,
      resolvedDistance: candidate.distance - (evidence[candidate.persona.id] ?? 0) * personaHintStrength,
    }))
    .sort((a, b) => a.resolvedDistance - b.resolvedDistance)[0].persona;
}

export function getTopDimensions(scores: Scores) {
  return [...dimensionIds].sort((a, b) => scores[b] - scores[a]);
}

export type TravelLanguage = "zh" | "en";

const skyscannerLocale: Record<TravelLanguage, { origin: string; market: string; locale: string; currency: string }> = {
  zh: { origin: "CN", market: "CN", locale: "zh-CN", currency: "CNY" },
  en: { origin: "UK", market: "UK", locale: "en-GB", currency: "GBP" },
};

export function skyscannerUrl(iata: string, language: TravelLanguage = "zh") {
  const config = skyscannerLocale[language];
  const url = new URL("https://www.skyscanner.net/g/referrals/v1/flights/browse-view");
  url.searchParams.set("origin", config.origin);
  url.searchParams.set("destination", iata.trim().toUpperCase());
  url.searchParams.set("market", config.market);
  url.searchParams.set("locale", config.locale);
  url.searchParams.set("currency", config.currency);
  return url.toString();
}

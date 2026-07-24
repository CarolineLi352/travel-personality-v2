import fs from "node:fs";
import vm from "node:vm";

const dimensions = ["npc", "chaos", "hype", "spend", "camera", "control"];
const questions = JSON.parse(fs.readFileSync("data/questions.json", "utf8"));
const questionInfluence = JSON.parse(fs.readFileSync("data/question-influence.json", "utf8"));
const calibration = JSON.parse(fs.readFileSync("data/persona-calibration.json", "utf8"));
const catalogSource = fs.readFileSync("data/catalog.ts", "utf8");
const personaSource = catalogSource
  .slice(catalogSource.indexOf("export const personas"), catalogSource.indexOf("export function getPersona"))
  .replace("export const personas: Persona[] =", "const personas =");
const context = {};
vm.runInNewContext(`${personaSource}\nglobalThis.personas = personas;`, context);
const { personas } = context;
const samples = Number(process.argv[2] ?? 500_000);

const maxima = Object.fromEntries(dimensions.map((dimension) => [
  dimension,
  questions.reduce((sum, question) => sum + Math.max(...question.options.map((option) => option.weights[dimension] ?? 0)) * questionInfluence[question.id], 0),
]));

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function scoreRandomAnswers(random) {
  const raw = Object.fromEntries(dimensions.map((dimension) => [dimension, 0]));
  const evidence = Object.fromEntries(personas.map((persona) => [persona.id, 0]));
  questions.forEach((question) => {
    const option = question.options[Math.floor(random() * question.options.length)];
    const influence = questionInfluence[question.id];
    dimensions.forEach((dimension) => { raw[dimension] += (option.weights[dimension] ?? 0) * influence; });
    Object.entries(option.personaHints ?? {}).forEach(([personaId, weight]) => { evidence[personaId] += weight * influence; });
  });
  return {
    scores: Object.fromEntries(dimensions.map((dimension) => [
      dimension,
      Math.round(raw[dimension] / maxima[dimension] * 100),
    ])),
    evidence,
  };
}

function squaredDistance(scores, persona) {
  return dimensions.reduce((sum, dimension) => sum + (scores[dimension] - persona.vector[dimension]) ** 2, 0);
}

function match(scores, calibrated, evidence = {}) {
  const ranked = personas.map((persona) => {
    const rawDistance = squaredDistance(scores, persona);
    const config = calibration[persona.id];
    const distance = calibrated ? (rawDistance - config.mean) / config.deviation - config.bias : rawDistance;
    return { persona, distance };
  }).sort((first, second) => first.distance - second.distance);
  if (!calibrated) return ranked[0].persona;
  return ranked
    .filter((candidate) => candidate.distance - ranked[0].distance <= 0.2)
    .map((candidate) => ({ ...candidate, resolvedDistance: candidate.distance - (evidence[candidate.persona.id] ?? 0) * 0.04 }))
    .sort((first, second) => first.resolvedDistance - second.resolvedDistance)[0].persona;
}

const random = randomGenerator(20260716);
const rawCounts = Object.fromEntries(personas.map((persona) => [persona.code, 0]));
const calibratedCounts = Object.fromEntries(personas.map((persona) => [persona.code, 0]));
for (let index = 0; index < samples; index += 1) {
  const { scores, evidence } = scoreRandomAnswers(random);
  rawCounts[match(scores, false).code] += 1;
  calibratedCounts[match(scores, true, evidence).code] += 1;
}

console.log(`Uniform-choice simulation: ${samples.toLocaleString()} runs; target ${(100 / personas.length).toFixed(2)}%`);
console.log("CODE     BEFORE     AFTER");
personas.forEach((persona) => {
  const before = rawCounts[persona.code] / samples * 100;
  const after = calibratedCounts[persona.code] / samples * 100;
  console.log(`${persona.code.padEnd(6)} ${before.toFixed(2).padStart(8)}% ${after.toFixed(2).padStart(8)}%`);
});

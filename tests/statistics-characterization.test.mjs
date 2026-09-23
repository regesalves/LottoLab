import test from "node:test";
import assert from "node:assert/strict";
import {
  countHits, createEvaluationCache, evaluateGameAgainstContest, evaluateGameHistory,
  evaluateGames, rankGames,
} from "../src/engine/statistics.ts";

const game = { dezenas: [1, 2, 3, 4, 5] };
const contests = [
  { concurso: 101, dezenas: [1, 2, 3, 4, 5] },
  { concurso: 102, dezenas: [1, 2, 6, 7, 8] },
  { concurso: 103, dezenas: [11, 12, 13, 14, 15] },
];

test("estatísticas: acertos e comparação por concurso são determinísticos", () => {
  assert.equal(countHits(game, contests[0]), 5);
  assert.equal(countHits(game, contests[1]), 2);
  assert.deepEqual(evaluateGameAgainstContest(game, contests[1]), { concurso: 102, acertos: 2 });
});

test("estatísticas: avaliação histórica preserva média, janelas, recência e score", () => {
  const history = contests.map((contest) => ({ ...contest, dezenas: [1, 2, 3, 4, 5] }));
  const evaluation = evaluateGameHistory(game, history);
  assert.equal(evaluation.concursosAvaliados, 3);
  assert.equal(evaluation.media, 5);
  assert.equal(evaluation.melhor, 5);
  assert.equal(evaluation.mediana, 5);
  assert.deepEqual(evaluation.distribuicao, { 5: 3 });
  assert.equal(evaluation.janelas["10"].media, 5);
  assert.equal(evaluation.recencia[10].ultimoConcurso, null);
  assert.equal(evaluation.recencia[10].concursosDesde, null);
  assert.equal(evaluation.consistencia[10], 0);
  assert.equal(evaluation.pontuacao.total, 75);
});

test("estatísticas: cache reutiliza a avaliação para o mesmo jogo e histórico", async () => {
  const cache = createEvaluationCache(contests);
  const primeiro = await evaluateGames([game], contests, cache);
  const segundo = await evaluateGames([game], contests, cache);
  assert.equal(primeiro.length, 1);
  assert.equal(segundo.length, 1);
  assert.equal(cache.misses, 1);
  assert.equal(cache.hits, 1);
});

test("estatísticas: ranking ordena por pontuação e mantém ranking sequencial", () => {
  const evaluated = [
    { id: "jogo-002", jogo: { dezenas: [2] }, avaliacao: { pontuacao: { total: 50 }, melhor: 0, media: 0, consistencia: { 11: 0 }, janelas: { "25": { media: 0 }, completo: { acimaDe12: 0, acimaDe13: 0, acimaDe14: 0, quinze: 0 } } }, ranking: 0 },
    { id: "jogo-001", jogo: { dezenas: [1] }, avaliacao: { pontuacao: { total: 75 }, melhor: 0, media: 0, consistencia: { 11: 0 }, janelas: { "25": { media: 0 }, completo: { acimaDe12: 0, acimaDe13: 0, acimaDe14: 0, quinze: 0 } } }, ranking: 0 },
  ];
  assert.deepEqual(rankGames(evaluated, "pontuacao").map((item) => [item.id, item.ranking]), [["jogo-001", 1], ["jogo-002", 2]]);
});

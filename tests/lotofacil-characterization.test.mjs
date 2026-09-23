import test from "node:test";
import assert from "node:assert/strict";
import { gerarJogosLotofacil } from "../src/engine/lotofacil.ts";

const referencia = Array.from({ length: 15 }, (_, index) => index + 1);
const todasAsContagens = Array.from({ length: 21 }, (_, index) => index);

function config(changes = {}) {
  return {
    quantidadeDezenas: [15], fixas: [], excluidas: [], pares: [], repetidas: [],
    dezenasConcursoAnterior: referencia, moldura: [], primos: [], fibonacci: [],
    multiplos3: [], somaMin: 0, somaMax: 500, ...changes,
  };
}

function assertJogosNormalizados(jogos) {
  for (const jogo of jogos) {
    assert.equal(jogo.dezenas.length, jogo.quantidade);
    assert.ok(jogo.dezenas.every((n) => Number.isInteger(n) && n >= 1 && n <= 25));
    assert.equal(new Set(jogo.dezenas).size, jogo.dezenas.length);
    assert.deepEqual(jogo.dezenas, [...jogo.dezenas].sort((a, b) => a - b));
  }
}

test("golden: 14 fixas gera as 11 conclusões possíveis em ordem", async () => {
  const fixas = Array.from({ length: 14 }, (_, index) => index + 1);
  const jogos = await gerarJogosLotofacil(config({ fixas }));
  assert.equal(jogos.length, 11);
  assert.deepEqual(jogos.map((jogo) => jogo.dezenas),
    Array.from({ length: 11 }, (_, index) => [...fixas, index + 15]));
  assertJogosNormalizados(jogos);
});

test("golden: múltiplas quantidades preservam todas as combinações", async () => {
  const fixas = Array.from({ length: 14 }, (_, index) => index + 1);
  const jogos = await gerarJogosLotofacil(config({ quantidadeDezenas: [15, 16], fixas }));
  assert.equal(jogos.length, 66);
  assert.deepEqual(jogos.map((jogo) => jogo.quantidade).sort((a, b) => a - b),
    [...Array(11).fill(15), ...Array(55).fill(16)]);
  assertJogosNormalizados(jogos);
});

test("golden: fixas, excluídas e filtros combinados mantêm 120 jogos válidos", async () => {
  const fixas = Array.from({ length: 12 }, (_, index) => index + 1);
  const jogos = await gerarJogosLotofacil(config({
    fixas, excluidas: [16, 17, 18], pares: todasAsContagens,
    repetidas: todasAsContagens, moldura: todasAsContagens,
    primos: todasAsContagens, fibonacci: todasAsContagens,
    multiplos3: todasAsContagens,
  }));
  assert.equal(jogos.length, 120);
  assert.ok(jogos.every((jogo) => fixas.every((n) => jogo.dezenas.includes(n))));
  assert.ok(jogos.every((jogo) => [16, 17, 18].every((n) => !jogo.dezenas.includes(n))));
  assertJogosNormalizados(jogos);
});

test("geração sem solução retorna uma lista vazia", async () => {
  const jogos = await gerarJogosLotofacil(config({
    fixas: referencia, pares: [6], quantidadeDezenas: [15],
  }));
  assert.deepEqual(jogos, []);
});

test("AbortSignal já cancelado interrompe a geração sem resultados", async () => {
  const controller = new AbortController();
  controller.abort();
  const jogos = await gerarJogosLotofacil(config(), { signal: controller.signal });
  assert.deepEqual(jogos, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { gerarJogosLotofacil } from "../src/engine/lotofacil.ts";
import { validateGeneratedGames } from "../src/engine/gameValidator.ts";
import { alternarRegraDezena } from "../src/engine/numberSelection.ts";

const referencia = { concurso: 1, data: "", dezenas: Array.from({ length: 15 }, (_, indice) => indice + 1) };
const todas = Array.from({ length: 21 }, (_, indice) => indice);

const configuracao = {
  quantidadeDezenas: [15],
  fixas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  excluidas: [16, 17, 18],
  pares: todas,
  repetidas: todas,
  dezenasConcursoAnterior: referencia.dezenas,
  moldura: todas,
  primos: todas,
  fibonacci: todas,
  multiplos3: todas,
  somaMin: 0,
  somaMax: 500,
};

test("gerador aplica fixas, excluídas e todos os filtros existentes", async () => {
  const jogos = await gerarJogosLotofacil(configuracao);
  assert.ok(jogos.length > 0);
  for (const game of jogos) {
    assert.ok(configuracao.fixas.every((dezena) => game.dezenas.includes(dezena)));
    assert.ok(configuracao.excluidas.every((dezena) => !game.dezenas.includes(dezena)));
  }
  const resultado = validateGeneratedGames(jogos, configuracao, referencia);
  assert.equal(resultado.jogosInvalidos, 0);
  console.log(`[GERAÇÃO REAL COM EXCLUSÕES] ${jogos.length} jogos válidos; nenhuma excluída encontrada.`);
});

test("sem excluídas preserva exatamente a composição anterior", async () => {
  const fixas = Array.from({ length: 14 }, (_, indice) => indice + 1);
  const jogos = await gerarJogosLotofacil({ ...configuracao, fixas, excluidas: [], repetidas: [], dezenasConcursoAnterior: [] });
  assert.deepEqual(jogos.map((game) => game.dezenas), Array.from({ length: 11 }, (_, indice) => [...fixas, indice + 15]));
});

test("marcar como excluída remove apenas a mesma dezena das fixas", () => {
  assert.deepEqual(alternarRegraDezena(10, "excluida", [3, 10, 15], [4, 9]), {
    fixas: [3, 15], excluidas: [4, 9, 10],
  });
});

test("marcar como fixa remove apenas a mesma dezena das excluídas", () => {
  assert.deepEqual(alternarRegraDezena(10, "fixa", [3, 15], [4, 9, 10]), {
    fixas: [3, 10, 15], excluidas: [4, 9],
  });
});


test("selecionar e desmarcar chip preserva valores não consecutivos", async () => {
  const { alternarValorFiltro } = await import("../src/engine/numberSelection.ts");
  let valores = [];
  valores = alternarValorFiltro(valores, 8);
  valores = alternarValorFiltro(valores, 10);
  assert.deepEqual(valores, [8, 10]);
  valores = alternarValorFiltro(valores, 8);
  assert.deepEqual(valores, [10]);
});

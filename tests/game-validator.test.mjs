import test from "node:test";
import assert from "node:assert/strict";
import { gerarJogosLotofacil } from "../src/engine/lotofacil.ts";
import {
  validateGeneratedGame,
  validateGeneratedGames,
} from "../src/engine/gameValidator.ts";

const dezenasValidas = Array.from({ length: 15 }, (_, indice) => indice + 1);
const referenciaA = { concurso: 1, data: "", dezenas: dezenasValidas };
const referenciaB = { concurso: 2, data: "", dezenas: Array.from({ length: 15 }, (_, indice) => indice + 11) };

function jogo(dezenas = dezenasValidas) {
  return {
    dezenas,
    quantidade: 999,
    pares: 999,
    repetidas: 999,
    moldura: 999,
    primos: 999,
    fibonacci: 999,
    multiplos3: 999,
    soma: 999,
  };
}

function config(alteracoes = {}) {
  return {
    quantidadeDezenas: [15],
    fixas: [3, 7],
    excluidas: [],
    pares: [7],
    repetidas: [15],
    dezenasConcursoAnterior: referenciaA.dezenas,
    moldura: [9],
    primos: [6],
    fibonacci: [6],
    multiplos3: [5],
    somaMin: 120,
    somaMax: 120,
    ...alteracoes,
  };
}

const criterios = (resultado) => resultado.erros.map((erro) => erro.criterio);

test("jogo perfeitamente válido ignora métricas armazenadas", () => {
  assert.equal(validateGeneratedGame(jogo(), config(), referenciaA).valido, true);
});

test("quantidade de dezenas errada", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ quantidadeDezenas: [16] }), referenciaA)).includes("Quantidade de dezenas"));
});

test("dezena fixa ausente", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ fixas: [25] }), referenciaA)).includes("Dezenas fixas"));
});

test("quantidade de pares errada", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ pares: [8] }), referenciaA)).includes("Pares"));
});

test("repetidas erradas", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ repetidas: [14] }), referenciaA)).includes("Repetidas"));
});

test("moldura errada", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ moldura: [8] }), referenciaA)).includes("Moldura"));
});

test("primos errados", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ primos: [5] }), referenciaA)).includes("Primos"));
});

test("Fibonacci errado", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ fibonacci: [5] }), referenciaA)).includes("Fibonacci"));
});

test("múltiplos de 3 errados", () => {
  assert.ok(criterios(validateGeneratedGame(jogo(), config({ multiplos3: [4] }), referenciaA)).includes("Múltiplos de 3"));
});

test("soma abaixo do mínimo", () => {
  assert.match(validateGeneratedGame(jogo(), config({ somaMin: 121, somaMax: 130 }), referenciaA).erros.find((erro) => erro.criterio === "Soma").mensagem, /abaixo/);
});

test("soma acima do máximo", () => {
  assert.match(validateGeneratedGame(jogo(), config({ somaMin: 100, somaMax: 119 }), referenciaA).erros.find((erro) => erro.criterio === "Soma").mensagem, /acima/);
});

test("dezena duplicada", () => {
  const resultado = validateGeneratedGame(jogo([...dezenasValidas.slice(0, 14), 14]), config(), referenciaA);
  assert.ok(criterios(resultado).includes("Dezenas duplicadas"));
});

test("dezena menor que 1", () => {
  assert.ok(criterios(validateGeneratedGame(jogo([0, ...dezenasValidas.slice(1)]), config(), referenciaA)).includes("Validade das dezenas"));
});

test("dezena maior que 25", () => {
  assert.ok(criterios(validateGeneratedGame(jogo([...dezenasValidas.slice(0, 14), 26]), config(), referenciaA)).includes("Validade das dezenas"));
});

test("uma entre várias opções de filtro é suficiente", () => {
  assert.equal(validateGeneratedGame(jogo(), config({ pares: [7, 8] }), referenciaA).valido, true);
});

test("concurso de referência diferente altera repetidas", () => {
  assert.equal(validateGeneratedGame(jogo(), config({ repetidas: [5] }), referenciaB).valido, true);
  assert.equal(validateGeneratedGame(jogo(), config({ repetidas: [5] }), referenciaA).valido, false);
});

test("repetidas sem concurso de referência", () => {
  const resultado = validateGeneratedGame(jogo(), config(), null);
  assert.ok(criterios(resultado).includes("Repetidas"));
  assert.match(resultado.erros.find((erro) => erro.criterio === "Repetidas").mensagem, /sem um concurso/);
});

test("vários erros são registrados no mesmo jogo", () => {
  const resultado = validateGeneratedGame(jogo([0, ...dezenasValidas.slice(1, 14), 14]), config({ quantidadeDezenas: [16], fixas: [25], somaMin: 200, somaMax: 210 }), null);
  assert.ok(resultado.erros.length >= 4);
});

test("lista completa com todos os jogos válidos", () => {
  const resultado = validateGeneratedGames([jogo(), jogo()], config(), referenciaA);
  assert.deepEqual({ valido: resultado.valido, validos: resultado.jogosValidos, invalidos: resultado.jogosInvalidos }, { valido: true, validos: 2, invalidos: 0 });
});

test("lista completa identifica jogo inválido e seu ID", () => {
  const resultado = validateGeneratedGames([jogo(), jogo([...dezenasValidas.slice(0, 14), 26])], config(), referenciaA);
  assert.equal(resultado.valido, false);
  assert.equal(resultado.jogosInvalidos, 1);
  assert.equal(resultado.inconsistencias[0].id, "Jogo 002");
});

const todas = Array.from({ length: 21 }, (_, indice) => indice);

test("jogos reais de 15 dezenas passam no verificador independente", async () => {
  const configuracao = config({
    fixas: Array.from({ length: 12 }, (_, indice) => indice + 1),
    pares: [6, 7, 8],
    repetidas: [12, 13, 14, 15],
    moldura: todas,
    primos: todas,
    fibonacci: todas,
    multiplos3: todas,
    somaMin: 120,
    somaMax: 190,
  });
  const jogos = await gerarJogosLotofacil(configuracao);
  const resultado = validateGeneratedGames(jogos, configuracao, referenciaA);
  assert.ok(jogos.length > 0);
  assert.equal(resultado.jogosInvalidos, 0);
  console.log(`[GERAÇÃO REAL 15] ${resultado.totalJogos} jogos, ${resultado.jogosValidos} válidos, ${resultado.jogosInvalidos} inválidos.`);
});

test("jogos reais de 20 dezenas com múltiplas opções passam", async () => {
  const configuracao = config({
    quantidadeDezenas: [20],
    fixas: Array.from({ length: 18 }, (_, indice) => indice + 1),
    pares: [9, 10, 11, 12],
    repetidas: [15, 16],
    moldura: todas,
    primos: todas,
    fibonacci: todas,
    multiplos3: todas,
    somaMin: 210,
    somaMax: 270,
  });
  const jogos = await gerarJogosLotofacil(configuracao);
  const resultado = validateGeneratedGames(jogos, configuracao, referenciaA);
  assert.ok(jogos.length > 0);
  assert.equal(resultado.jogosInvalidos, 0);
  console.log(`[GERAÇÃO REAL 20] ${resultado.totalJogos} jogos, ${resultado.jogosValidos} válidos, ${resultado.jogosInvalidos} inválidos.`);
});


test("jogo válido com dezenas excluídas ausentes", () => {
  const resultado = validateGeneratedGame(jogo(), config({ excluidas: [16, 22, 25] }), referenciaA);
  assert.equal(resultado.valido, true);
});

test("uma dezena excluída presente é informada", () => {
  const resultado = validateGeneratedGame(jogo(), config({ excluidas: [10] }), referenciaA);
  assert.ok(criterios(resultado).includes("Dezenas a evitar"));
  assert.match(resultado.erros.find((erro) => erro.criterio === "Dezenas a evitar").mensagem, /10/);
});

test("várias dezenas excluídas presentes geram erros independentes", () => {
  const resultado = validateGeneratedGame(jogo(), config({ excluidas: [4, 9, 12] }), referenciaA);
  assert.equal(resultado.erros.filter((erro) => erro.criterio === "Dezenas a evitar").length, 3);
});

test("conflito entre fixa e excluída é detectado independentemente no jogo", () => {
  const resultado = validateGeneratedGame(jogo(), config({ fixas: [10], excluidas: [10] }), referenciaA);
  assert.ok(criterios(resultado).includes("Dezenas a evitar"));
});


const molduraSet = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);
const primosSet = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);

function dezenasComContagem(predicado, quantidade) {
  const universo = Array.from({ length: 25 }, (_, indice) => indice + 1);
  return [
    ...universo.filter(predicado).slice(0, quantidade),
    ...universo.filter((numero) => !predicado(numero)).slice(0, 15 - quantidade),
  ].sort((a, b) => a - b);
}

function semRestricoes(alteracoes = {}) {
  return config({
    fixas: [],
    pares: [],
    repetidas: [],
    moldura: [],
    primos: [],
    fibonacci: [],
    multiplos3: [],
    somaMin: 0,
    somaMax: 500,
    ...alteracoes,
  });
}

function possuiErro(resultado, criterio) {
  return resultado.erros.some((erro) => erro.criterio === criterio);
}

test("Repetidas [8, 10] aceita apenas os valores explicitamente selecionados", () => {
  for (const quantidade of [8, 10]) {
    const dezenas = dezenasComContagem((numero) => referenciaA.dezenas.includes(numero), quantidade);
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenas), semRestricoes({ repetidas: [8, 10] }), referenciaA), "Repetidas"), false);
  }
  const dezenas = dezenasComContagem((numero) => referenciaA.dezenas.includes(numero), 9);
  assert.equal(possuiErro(validateGeneratedGame(jogo(dezenas), semRestricoes({ repetidas: [8, 10] }), referenciaA), "Repetidas"), true);
});

test("Pares [4, 8] não aceita os valores intermediários", () => {
  for (const quantidade of [4, 8]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => numero % 2 === 0, quantidade)), semRestricoes({ pares: [4, 8] }), referenciaA), "Pares"), false);
  }
  for (const quantidade of [5, 6, 7]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => numero % 2 === 0, quantidade)), semRestricoes({ pares: [4, 8] }), referenciaA), "Pares"), true);
  }
});

test("Moldura [7, 10] não aceita 8 ou 9", () => {
  for (const quantidade of [7, 10]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => molduraSet.has(numero), quantidade)), semRestricoes({ moldura: [7, 10] }), referenciaA), "Moldura"), false);
  }
  for (const quantidade of [8, 9]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => molduraSet.has(numero), quantidade)), semRestricoes({ moldura: [7, 10] }), referenciaA), "Moldura"), true);
  }
});

test("Primos [2, 5] não aceita 3 ou 4", () => {
  for (const quantidade of [2, 5]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => primosSet.has(numero), quantidade)), semRestricoes({ primos: [2, 5] }), referenciaA), "Primos"), false);
  }
  for (const quantidade of [3, 4]) {
    assert.equal(possuiErro(validateGeneratedGame(jogo(dezenasComContagem((numero) => primosSet.has(numero), quantidade)), semRestricoes({ primos: [2, 5] }), referenciaA), "Primos"), true);
  }
});

test("filtros vazios restauram ausência de restrição discreta", () => {
  const resultado = validateGeneratedGame(jogo(dezenasComContagem((numero) => numero % 2 === 0, 6)), semRestricoes(), referenciaA);
  for (const criterio of ["Pares", "Repetidas", "Moldura", "Primos", "Fibonacci", "Múltiplos de 3"]) {
    assert.equal(possuiErro(resultado, criterio), false);
  }
});

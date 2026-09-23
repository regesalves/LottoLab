import test from "node:test";
import assert from "node:assert/strict";
import { validarConfiguracaoLotofacil } from "../src/engine/lotofacil.ts";

const referenciaA = Array.from({ length: 15 }, (_, indice) => indice + 1);
const referenciaB = Array.from({ length: 15 }, (_, indice) => indice + 9);

function config(alteracoes = {}) {
  return {
    quantidadeDezenas: [15],
    fixas: [],
    excluidas: [],
    pares: [],
    repetidas: [],
    dezenasConcursoAnterior: referenciaA,
    moldura: [],
    primos: [],
    fibonacci: [],
    multiplos3: [],
    somaMin: 120,
    somaMax: 270,
    ...alteracoes,
  };
}

const codigos = (resultado) => resultado.map((problema) => problema.code);

test('configuração válida não apresenta erros', () => {
  assert.deepEqual(validarConfiguracaoLotofacil(config()), []);
});

test('fixas acima da quantidade de dezenas', () => {
  const fixas = Array.from({ length: 16 }, (_, indice) => indice + 1);
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ fixas }))).includes('quantidade-fixas'));
});

test('fixas incompatíveis acumulam todos os erros comprováveis', () => {
  const resultado = validarConfiguracaoLotofacil(config({
    fixas: Array.from({ length: 16 }, (_, indice) => indice + 1),
    pares: [2], repetidas: [5], somaMin: 80, somaMax: 100,
  }));
  assert.ok(codigos(resultado).includes('quantidade-fixas'));
  assert.ok(codigos(resultado).includes('pares-fixas'));
  assert.ok(codigos(resultado).includes('repetidas-fixas'));
  assert.ok(codigos(resultado).includes('soma-fixas'));
  assert.equal(resultado.length, 4);
});

test('configuração válida continua gerando exatamente os jogos esperados', async () => {
  const { gerarJogosLotofacil } = await import('../src/engine/lotofacil.ts');
  const fixas = Array.from({ length: 14 }, (_, indice) => indice + 1);
  const jogos = await gerarJogosLotofacil(config({ fixas, somaMin: 0, somaMax: 500 }));
  assert.deepEqual(
    jogos.map((jogo) => jogo.dezenas),
    Array.from({ length: 11 }, (_, indice) => [...fixas, indice + 15]),
  );
});

test('conflito entre filtros válidos isoladamente é diagnosticado', () => {
  const resultado = validarConfiguracaoLotofacil(config({ pares: [2], moldura: [6] }));
  assert.ok(codigos(resultado).includes('pares-moldura'));
});

test("15 dezenas e 15 fixas detectam restrição incompatível", () => {
  const resultado = validarConfiguracaoLotofacil(config({ fixas: referenciaA, pares: [6] }));
  assert.ok(codigos(resultado).includes("pares-limites"));
});

test("20 dezenas, 9 repetidas e fixas incompatíveis explicam repetidas", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    quantidadeDezenas: [20], fixas: referenciaA.slice(0, 10), repetidas: [9],
  }));
  assert.ok(codigos(resultado).includes("repetidas-limites"));
  assert.match(resultado[0].message, /fixas|pelo menos/i);
});

test("fixas que obrigam mais repetidas que o máximo", () => {
  const resultado = validarConfiguracaoLotofacil(config({ fixas: referenciaA.slice(0, 8), repetidas: [7] }));
  assert.ok(codigos(resultado).includes("repetidas-limites"));
});

test("referência insuficiente impede o mínimo de repetidas", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    repetidas: [6], dezenasConcursoAnterior: [1, 2, 3, 4, 5],
  }));
  assert.ok(codigos(resultado).includes("repetidas-limites"));
  assert.match(resultado[0].message, /máximo|mínimo/i);
});

test("quantidade incompatível com pares", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ pares: [13] }))).includes("pares-limites"));
});

test("quantidade incompatível com moldura", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ moldura: [0] }))).includes("moldura-limites"));
});

test("quantidade incompatível com primos", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ primos: [10] }))).includes("primos-limites"));
});

test("quantidade incompatível com Fibonacci", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ fibonacci: [8] }))).includes("fibonacci-limites"));
});

test("quantidade incompatível com múltiplos de 3", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ multiplos3: [9] }))).includes("multiplos3-limites"));
});

test("soma impossível por causa das fixas", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    fixas: Array.from({ length: 15 }, (_, indice) => indice + 11), somaMin: 120, somaMax: 210,
  }));
  assert.ok(codigos(resultado).includes("soma-maxima"));
});

test("uma alternativa possível mantém a configuração válida", () => {
  const resultado = validarConfiguracaoLotofacil(config({ pares: [13, 8] }));
  assert.deepEqual(resultado, []);
});

test("múltiplos conflitos independentes são retornados juntos", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    fixas: referenciaA.slice(0, 8), repetidas: [7], somaMin: 80, somaMax: 100,
  }));
  assert.ok(codigos(resultado).includes("repetidas-limites"));
  assert.ok(codigos(resultado).includes("soma-maxima"));
  assert.ok(resultado.length >= 2);
});

test("repetidas usam as dezenas da referência selecionada", () => {
  const base = { fixas: referenciaA.slice(0, 8), repetidas: [7] };
  assert.ok(validarConfiguracaoLotofacil(config(base)).length > 0);
  assert.deepEqual(validarConfiguracaoLotofacil(config({ ...base, dezenasConcursoAnterior: referenciaB })), []);
});

test("navegar para outra referência altera a validação de repetidas", () => {
  const base = config({ fixas: referenciaA.slice(0, 8), repetidas: [7] });
  const anterior = validarConfiguracaoLotofacil(base);
  const proximo = validarConfiguracaoLotofacil({ ...base, dezenasConcursoAnterior: referenciaB });
  assert.notDeepEqual(codigos(anterior), codigos(proximo));
});

test("sem filtro de repetidas a configuração continua válida", () => {
  assert.deepEqual(validarConfiguracaoLotofacil(config({
    fixas: referenciaA.slice(0, 8), repetidas: [], dezenasConcursoAnterior: [],
  })), []);
});


test("configuração válida com exclusões", () => {
  assert.deepEqual(validarConfiguracaoLotofacil(config({ excluidas: [16, 22, 25] })), []);
});

test("fixas e excluídas em conflito são diagnosticadas", () => {
  assert.ok(codigos(validarConfiguracaoLotofacil(config({ fixas: [3], excluidas: [3] }))).includes("fixas-excluidas"));
});

test("exclusões podem impedir completar a quantidade", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    quantidadeDezenas: [20],
    fixas: [1, 2, 3, 4, 5, 6, 7],
    excluidas: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  }));
  assert.ok(codigos(resultado).includes("quantidade-disponivel"));
});

test("exclusões no concurso de referência explicam repetidas impossíveis", () => {
  const resultado = validarConfiguracaoLotofacil(config({
    repetidas: [9],
    excluidas: [1, 2, 3, 4, 5, 6, 7, 8],
  }));
  const problema = resultado.find((item) => item.code === "repetidas-limites");
  assert.ok(problema);
  assert.match(problema.message, /9 repetidas.*7 dezenas.*permanecem disponíveis/i);
});

test("várias exclusões da referência ainda permitem uma meta alcançável", () => {
  assert.deepEqual(validarConfiguracaoLotofacil(config({
    repetidas: [7],
    excluidas: [1, 2, 3, 4, 5, 6, 7, 8],
  })), []);
});


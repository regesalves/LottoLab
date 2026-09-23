import type { ConcursoLotofacil } from "../history/types.ts";
import type { LotofacilConfig, LotofacilJogo } from "./lotofacil.ts";
import {
  ehFibonacci,
  ehMoldura,
  ehMultiploDe3,
  ehPar,
  ehPrimo,
} from "./statistics.ts";

export interface GameValidationError {
  criterio: string;
  esperado: string;
  encontrado: string;
  mensagem: string;
}

export interface GameValidationResult {
  valido: boolean;
  erros: GameValidationError[];
}

export interface GameValidationInconsistency {
  id: string;
  indice: number;
  erros: GameValidationError[];
}

export interface GamesValidationResult {
  valido: boolean;
  totalJogos: number;
  jogosValidos: number;
  jogosInvalidos: number;
  inconsistencias: GameValidationInconsistency[];
}

function opcoesEsperadas(valores: readonly number[]) {
  return valores.length === 1 ? String(valores[0]) : `uma das opções: ${valores.join(", ")}`;
}

function validarContagem(
  erros: GameValidationError[],
  criterio: string,
  encontrado: number,
  permitidos: readonly number[],
) {
  if (permitidos.length === 0 || permitidos.includes(encontrado)) return;
  const esperado = opcoesEsperadas(permitidos);
  erros.push({
    criterio,
    esperado,
    encontrado: String(encontrado),
    mensagem: `${criterio}: esperado ${esperado}, encontrado ${encontrado}.`,
  });
}

export function validateGeneratedGame(
  jogo: LotofacilJogo,
  configuracao: LotofacilConfig,
  concursoReferencia?: ConcursoLotofacil | null,
): GameValidationResult {
  const erros: GameValidationError[] = [];
  const dezenas = [...jogo.dezenas];
  const quantidade = dezenas.length;

  if (configuracao.quantidadeDezenas.length === 0) {
    erros.push({
      criterio: "Quantidade de dezenas",
      esperado: "ao menos uma quantidade selecionada",
      encontrado: "nenhuma quantidade selecionada",
      mensagem: "Quantidade de dezenas: nenhuma quantidade foi selecionada na configuração.",
    });
  } else {
    validarContagem(erros, "Quantidade de dezenas", quantidade, configuracao.quantidadeDezenas);
  }

  const duplicadas = [...new Set(dezenas.filter((dezena, indice) => dezenas.indexOf(dezena) !== indice))];
  if (duplicadas.length > 0) {
    erros.push({
      criterio: "Dezenas duplicadas",
      esperado: "todas as dezenas únicas",
      encontrado: duplicadas.join(", "),
      mensagem: `Dezena duplicada no jogo: ${duplicadas.join(", ")}.`,
    });
  }

  const invalidas = dezenas.filter((dezena) => !Number.isInteger(dezena) || dezena < 1 || dezena > 25);
  for (const dezena of invalidas) {
    erros.push({
      criterio: "Validade das dezenas",
      esperado: "número inteiro entre 1 e 25",
      encontrado: String(dezena),
      mensagem: `Dezena inválida no jogo: ${dezena}.`,
    });
  }

  const ordenadas = dezenas.every((dezena, indice) => indice === 0 || dezenas[indice - 1] < dezena);
  if (!ordenadas) {
    erros.push({
      criterio: "Ordenação das dezenas",
      esperado: "ordem crescente, sem repetições",
      encontrado: dezenas.join(", "),
      mensagem: "As dezenas do jogo não estão normalizadas em ordem crescente.",
    });
  }

  const conjunto = new Set(dezenas);
  for (const fixa of [...new Set(configuracao.fixas)]) {
    if (!conjunto.has(fixa)) {
      erros.push({
        criterio: "Dezenas fixas",
        esperado: String(fixa),
        encontrado: "ausente",
        mensagem: `Dezena fixa não encontrada no jogo: ${fixa}.`,
      });
    }
  }

  for (const excluida of [...new Set(configuracao.excluidas)]) {
    if (conjunto.has(excluida)) {
      erros.push({
        criterio: "Dezenas a evitar",
        esperado: `${excluida} ausente`,
        encontrado: String(excluida),
        mensagem: `Dezena excluída encontrada no jogo: ${excluida}.`,
      });
    }
  }
  validarContagem(erros, "Pares", dezenas.filter(ehPar).length, configuracao.pares);
  validarContagem(erros, "Moldura", dezenas.filter(ehMoldura).length, configuracao.moldura);
  validarContagem(erros, "Primos", dezenas.filter(ehPrimo).length, configuracao.primos);
  validarContagem(erros, "Fibonacci", dezenas.filter(ehFibonacci).length, configuracao.fibonacci);
  validarContagem(erros, "Múltiplos de 3", dezenas.filter(ehMultiploDe3).length, configuracao.multiplos3);

  if (configuracao.repetidas.length > 0) {
    if (!concursoReferencia) {
      erros.push({
        criterio: "Repetidas",
        esperado: opcoesEsperadas(configuracao.repetidas),
        encontrado: "concurso de referência indisponível",
        mensagem: "Repetidas: não é possível conferir o critério sem um concurso de referência.",
      });
    } else {
      const referencia = new Set(concursoReferencia.dezenas);
      validarContagem(
        erros,
        "Repetidas",
        dezenas.filter((dezena) => referencia.has(dezena)).length,
        configuracao.repetidas,
      );
    }
  }

  const soma = dezenas.reduce((total, dezena) => total + dezena, 0);
  const somaMin = Math.min(configuracao.somaMin, configuracao.somaMax);
  const somaMax = Math.max(configuracao.somaMin, configuracao.somaMax);
  if (soma < somaMin) {
    erros.push({
      criterio: "Soma",
      esperado: `entre ${somaMin} e ${somaMax}`,
      encontrado: String(soma),
      mensagem: `Soma ${soma} está abaixo do mínimo permitido de ${somaMin}.`,
    });
  } else if (soma > somaMax) {
    erros.push({
      criterio: "Soma",
      esperado: `entre ${somaMin} e ${somaMax}`,
      encontrado: String(soma),
      mensagem: `Soma ${soma} está acima do máximo permitido de ${somaMax}.`,
    });
  }

  return { valido: erros.length === 0, erros };
}

export function validateGeneratedGames(
  jogos: readonly LotofacilJogo[],
  configuracao: LotofacilConfig,
  concursoReferencia?: ConcursoLotofacil | null,
): GamesValidationResult {
  const inconsistencias: GameValidationInconsistency[] = [];

  jogos.forEach((jogo, indice) => {
    const resultado = validateGeneratedGame(jogo, configuracao, concursoReferencia);
    if (!resultado.valido) {
      inconsistencias.push({
        id: `Jogo ${String(indice + 1).padStart(3, "0")}`,
        indice,
        erros: resultado.erros,
      });
    }
  });

  return {
    valido: inconsistencias.length === 0,
    totalJogos: jogos.length,
    jogosValidos: jogos.length - inconsistencias.length,
    jogosInvalidos: inconsistencias.length,
    inconsistencias,
  };
}


import {
  countHits,
  ehFibonacci,
  ehMoldura,
  ehMultiploDe3,
  ehPar,
  ehPrimo,
} from "./statistics.ts";
import {
  analisarConfiguracaoLotofacil,
  type ValidationIssue,
} from "./lotofacil-validation.ts";
import type { GeneratedGame, GenerationOptions } from "./contracts.ts";

export type { ValidationIssue } from "./lotofacil-validation.ts";

export interface LotofacilConfig {
  quantidadeDezenas: number[];
  fixas: number[];
  excluidas: number[];
  pares: number[];
  repetidas: number[];
  dezenasConcursoAnterior: number[];
  moldura: number[];
  primos: number[];
  fibonacci: number[];
  multiplos3: number[];
  somaMin: number;
  somaMax: number;
}

export interface LotofacilJogo extends GeneratedGame {
  dezenas: number[];
  quantidade: number;
  pares: number;
  repetidas: number;
  moldura: number;
  primos: number;
  fibonacci: number;
  multiplos3: number;
  soma: number;
}

export interface GeracaoOpcoes extends GenerationOptions {}

type Metrica = "pares" | "repetidas" | "moldura" | "primos" | "fibonacci" | "multiplos3";

type Contadores = Record<Metrica, number>;

const UNIVERSO = Array.from({ length: 25 }, (_, indice) => indice + 1);
const METRICAS: Metrica[] = ["pares", "repetidas", "moldura", "primos", "fibonacci", "multiplos3"];

const pausa = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function pertence(numero: number, metrica: Metrica, anteriores: Set<number>) {
  if (metrica === "pares") return ehPar(numero);
  if (metrica === "repetidas") return anteriores.has(numero);
  if (metrica === "moldura") return ehMoldura(numero);
  if (metrica === "primos") return ehPrimo(numero);
  if (metrica === "fibonacci") return ehFibonacci(numero);
  return ehMultiploDe3(numero);
}

function valoresPermitidos(config: LotofacilConfig, metrica: Metrica) {
  return config[metrica];
}

function somaMenores(valores: number[], inicio: number, quantidade: number) {
  let soma = 0;
  for (let i = inicio; i < inicio + quantidade; i += 1) soma += valores[i];
  return soma;
}

function somaMaiores(valores: number[], inicio: number, quantidade: number) {
  let soma = 0;
  for (let i = valores.length - 1; i >= inicio && quantidade > 0; i -= 1, quantidade -= 1) {
    soma += valores[i];
  }
  return soma;
}

function possuiPermitidoNoIntervalo(permitidos: number[], minimo: number, maximo: number) {
  return permitidos.length === 0 || permitidos.some((valor) => valor >= minimo && valor <= maximo);
}

function normalizar(config: LotofacilConfig): LotofacilConfig {
  const unicosOrdenados = (valores: number[]) => [...new Set(valores)].sort((a, b) => a - b);

  return {
    quantidadeDezenas: unicosOrdenados(config.quantidadeDezenas).filter((valor) => valor >= 15 && valor <= 20),
    fixas: unicosOrdenados(config.fixas).filter((valor) => valor >= 1 && valor <= 25),
    excluidas: unicosOrdenados(config.excluidas).filter((valor) => valor >= 1 && valor <= 25),
    pares: unicosOrdenados(config.pares),
    repetidas: config.dezenasConcursoAnterior.length > 0
      ? unicosOrdenados(config.repetidas)
      : [],
    dezenasConcursoAnterior: unicosOrdenados(config.dezenasConcursoAnterior)
      .filter((valor) => valor >= 1 && valor <= 25),
    moldura: unicosOrdenados(config.moldura),
    primos: unicosOrdenados(config.primos),
    fibonacci: unicosOrdenados(config.fibonacci),
    multiplos3: unicosOrdenados(config.multiplos3),
    somaMin: Math.min(config.somaMin, config.somaMax),
    somaMax: Math.max(config.somaMin, config.somaMax),
  };
}

export function validarConfiguracaoLotofacil(
  configuracao: LotofacilConfig,
): ValidationIssue[] {
  return analisarConfiguracaoLotofacil(configuracao);
}
export async function gerarJogosLotofacil(
  configuracao: LotofacilConfig,
  opcoes: GeracaoOpcoes = {},
): Promise<LotofacilJogo[]> {
  const config = normalizar(configuracao);
  const resultados: LotofacilJogo[] = [];
  const fixasSet = new Set(config.fixas);
  const excluidasSet = new Set(config.excluidas);
  const candidatas = UNIVERSO.filter(
    (numero) => !fixasSet.has(numero) && !excluidasSet.has(numero),
  );
  const anterioresSet = new Set(config.dezenasConcursoAnterior);
  const intervaloDePausa = Math.max(500, opcoes.intervaloDePausa ?? 5000);
  let nosVisitados = 0;

  const contadoresFixos = METRICAS.reduce<Contadores>((acumulado, metrica) => {
    acumulado[metrica] = config.fixas.filter((numero) => pertence(numero, metrica, anterioresSet)).length;
    return acumulado;
  }, { pares: 0, repetidas: 0, moldura: 0, primos: 0, fibonacci: 0, multiplos3: 0 });
  const somaFixas = config.fixas.reduce((total, numero) => total + numero, 0);

  const sufixos = METRICAS.reduce<Record<Metrica, number[]>>((acumulado, metrica) => {
    const contagens = Array(candidatas.length + 1).fill(0) as number[];
    for (let i = candidatas.length - 1; i >= 0; i -= 1) {
      contagens[i] = contagens[i + 1] + (pertence(candidatas[i], metrica, anterioresSet) ? 1 : 0);
    }
    acumulado[metrica] = contagens;
    return acumulado;
  }, { pares: [], repetidas: [], moldura: [], primos: [], fibonacci: [], multiplos3: [] });

  interface EstadoBusca {
    indice: number;
    faltam: number;
    soma: number;
    contadores: Contadores;
    escolhidas: number[];
  }

  for (const quantidade of config.quantidadeDezenas) {
    const faltamInicial = quantidade - config.fixas.length;
    if (faltamInicial < 0 || faltamInicial > candidatas.length) continue;

    const pilha: EstadoBusca[] = [{
      indice: 0,
      faltam: faltamInicial,
      soma: somaFixas,
      contadores: { ...contadoresFixos },
      escolhidas: [],
    }];

    while (pilha.length > 0) {
      if (opcoes.signal?.aborted) return resultados;
      const estado = pilha.pop();
      if (!estado) break;

      nosVisitados += 1;
      if (nosVisitados % intervaloDePausa === 0) await pausa();

      const { indice, faltam, soma, contadores, escolhidas } = estado;
      const restantes = candidatas.length - indice;
      if (faltam < 0 || faltam > restantes || soma > config.somaMax) continue;

      if (faltam > 0) {
        if (soma + somaMenores(candidatas, indice, faltam) > config.somaMax) continue;
        if (soma + somaMaiores(candidatas, indice, faltam) < config.somaMin) continue;
      } else if (soma < config.somaMin) {
        continue;
      }

      let metricasViaveis = true;
      for (const metrica of METRICAS) {
        const permitidos = valoresPermitidos(config, metrica);
        if (permitidos.length === 0) continue;
        const restantesDaMetrica = sufixos[metrica][indice];
        const restantesForaDaMetrica = restantes - restantesDaMetrica;
        const minimo = contadores[metrica] + Math.max(0, faltam - restantesForaDaMetrica);
        const maximo = contadores[metrica] + Math.min(faltam, restantesDaMetrica);
        if (!possuiPermitidoNoIntervalo(permitidos, minimo, maximo)) {
          metricasViaveis = false;
          break;
        }
      }
      if (!metricasViaveis) continue;

      if (faltam === 0) {
        if (METRICAS.some((metrica) => {
          const permitidos = valoresPermitidos(config, metrica);
          return permitidos.length > 0 && !permitidos.includes(contadores[metrica]);
        })) continue;

        const dezenasJogo = [...config.fixas, ...escolhidas].sort(
          (a, b) => a - b,
        );
        resultados.push({
          dezenas: dezenasJogo,
          quantidade,
          ...contadores,
          repetidas: countHits(dezenasJogo, config.dezenasConcursoAnterior),
          soma,
        });
        continue;
      }

      if (indice >= candidatas.length) continue;
      const numero = candidatas[indice];
      pilha.push({
        indice: indice + 1,
        faltam,
        soma,
        contadores,
        escolhidas,
      });

      const proximosContadores = { ...contadores };
      for (const metrica of METRICAS) {
        if (pertence(numero, metrica, anterioresSet)) proximosContadores[metrica] += 1;
      }
      pilha.push({
        indice: indice + 1,
        faltam: faltam - 1,
        soma: soma + numero,
        contadores: proximosContadores,
        escolhidas: [...escolhidas, numero],
      });
    }
  }

  return resultados;
}

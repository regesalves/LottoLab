export interface NumberCollection {
  dezenas: readonly number[];
}

export interface HistoricalContest extends NumberCollection {
  concurso: number;
}

export interface EstatisticasLotofacil {
  pares: number;
  moldura: number;
  primos: number;
  fibonacci: number;
  multiplos3: number;
  soma: number;
}

export interface ContestEvaluation {
  concurso: number;
  acertos: number;
}

export interface WindowEvaluation {
  concursosAvaliados: number;
  media: number;
  melhor: number;
  acimaDe11: number;
  acimaDe12: number;
  acimaDe13: number;
  acimaDe14: number;
  quinze: number;
}

export type HistoricalWindow = "10" | "25" | "50" | "100" | "250" | "completo";
export type HitThreshold = 10 | 11 | 12 | 13 | 14 | 15;

export interface RecencyMetric {
  ultimoConcurso: number | null;
  concursosDesde: number | null;
}

export type RecencyEvaluation = Record<HitThreshold, RecencyMetric>;
export type ConsistencyEvaluation = Record<HitThreshold, number>;

export interface LottoLabScore {
  total: number;
  historico: number;
  recencia: number;
  consistencia: number;
  desempenhoAlto: number;
}

export interface HistoricalEvaluation {
  melhor: number;
  pior: number;
  media: number;
  mediana: number;
  concursosAvaliados: number;
  distribuicao: Record<number, number>;
  ocorrencias: Record<HitThreshold | "9OuMenos", number>;
  janelas: Record<HistoricalWindow, WindowEvaluation>;
  recencia: RecencyEvaluation;
  consistencia: ConsistencyEvaluation;
  concursosMelhorDesempenho: number[];
  pontuacao: LottoLabScore;
}

export interface EvaluatedGame<TGame extends NumberCollection = NumberCollection> {
  id: string;
  jogo: TGame;
  avaliacao: HistoricalEvaluation;
  ranking: number;
}

export type RankingCriterion =
  | "pontuacao"
  | "melhor"
  | "media"
  | "consistencia"
  | "recente"
  | "12+"
  | "13+"
  | "14+"
  | "15";

export interface EvaluationCache {
  historyKey: string;
  values: Map<string, HistoricalEvaluation>;
  hits: number;
  misses: number;
}

/**
 * Pesos públicos da Pontuação LottoLab. Cada componente é normalizado em
 * uma escala de 0 a 100 e o total é a média ponderada abaixo. Os valores
 * descrevem desempenho histórico observado, não probabilidade futura.
 */
export const LOTTO_LAB_SCORE_WEIGHTS = {
  historico: 0.30,
  recencia: 0.20,
  consistencia: 0.25,
  desempenhoAlto: 0.25,
} as const;

const LIMITES = [10, 11, 12, 13, 14, 15] as const;
const MOLDURA = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);
const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21]);
const MULTIPLOS_3 = new Set([3, 6, 9, 12, 15, 18, 21, 24]);

const arredondar = (valor: number, casas = 2) => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

function obterDezenas(valor: NumberCollection | readonly number[]) {
  return Array.isArray(valor)
    ? valor
    : (valor as NumberCollection).dezenas;
}

export const ehPar = (numero: number) => numero % 2 === 0;
export const ehMoldura = (numero: number) => MOLDURA.has(numero);
export const ehPrimo = (numero: number) => PRIMOS.has(numero);
export const ehFibonacci = (numero: number) => FIBONACCI.has(numero);
export const ehMultiploDe3 = (numero: number) => MULTIPLOS_3.has(numero);

export function createHitCounter(
  game: NumberCollection | readonly number[],
) {
  const dezenasJogo = new Set(obterDezenas(game));

  return (contest: NumberCollection | readonly number[]) =>
    obterDezenas(contest).reduce(
      (total, dezena) => total + Number(dezenasJogo.has(dezena)),
      0,
    );
}

export function countHits(
  game: NumberCollection | readonly number[],
  contest: NumberCollection | readonly number[],
) {
  return createHitCounter(game)(contest);
}

export const contarRepetidas = countHits;

export function evaluateGameAgainstContest(
  game: NumberCollection | readonly number[],
  contest: HistoricalContest,
): ContestEvaluation {
  return {
    concurso: contest.concurso,
    acertos: countHits(game, contest),
  };
}

function avaliarJanela(acertos: readonly number[]): WindowEvaluation {
  const concursosAvaliados = acertos.length;
  const media = concursosAvaliados
    ? acertos.reduce((total, valor) => total + valor, 0) / concursosAvaliados
    : 0;

  return {
    concursosAvaliados,
    media: arredondar(media),
    melhor: concursosAvaliados ? Math.max(...acertos) : 0,
    acimaDe11: acertos.filter((valor) => valor >= 11).length,
    acimaDe12: acertos.filter((valor) => valor >= 12).length,
    acimaDe13: acertos.filter((valor) => valor >= 13).length,
    acimaDe14: acertos.filter((valor) => valor >= 14).length,
    quinze: acertos.filter((valor) => valor >= 15).length,
  };
}

/**
 * Componentes: média completa normalizada (histórico), média dos últimos 25
 * (recência), frequências de 10+/11+/12+ (consistência) e frequências
 * ponderadas de 11+ a 15 (desempenho alto).
 */
export function calculateLottoLabScore(
  evaluation: Omit<HistoricalEvaluation, "pontuacao">,
  gameSize: number,
): LottoLabScore {
  if (evaluation.concursosAvaliados === 0) {
    return {
      total: 0,
      historico: 0,
      recencia: 0,
      consistencia: 0,
      desempenhoAlto: 0,
    };
  }

  const maximoComparavel = Math.max(1, Math.min(gameSize, 15));

  // Histórico:
  // representa o desempenho médio em toda a base histórica.
  const historico = Math.max(
    0,
    Math.min(100, (evaluation.media / maximoComparavel) * 100),
  );

  // Recência:
  // combina as janelas recentes para reduzir a dependência de uma
  // única janela curta. O histórico completo continua sendo a referência.
  const media10 = evaluation.janelas["10"].media;
  const media25 = evaluation.janelas["25"].media;
  const media50 = evaluation.janelas["50"].media;

  const recenciaMedia =
    media10 * 0.20 +
    media25 * 0.30 +
    media50 * 0.50;

  const recenciaBase = Math.max(
    0,
    Math.min(100, (recenciaMedia / maximoComparavel) * 100),
  );

  // Suavização da recência em relação ao próprio histórico do jogo.
  // Evita que uma janela recente muito curta domine a pontuação.
  const diferencaRecencia = recenciaBase - historico;
  const recencia = Math.max(
    0,
    Math.min(100, historico + diferencaRecencia * 0.60),
  );

  // Consistência:
  // mede a regularidade da distribuição de acertos.
  // Um desvio menor significa comportamento mais regular.
  const distribuicao = evaluation.distribuicao;
  let somaQuadrados = 0;
  let totalObservacoes = 0;

  for (const [acertosTexto, quantidade] of Object.entries(distribuicao)) {
    const acertos = Number(acertosTexto);
    somaQuadrados += quantidade * acertos * acertos;
    totalObservacoes += quantidade;
  }

  const mediaBruta = evaluation.media;
  const variancia = totalObservacoes > 0
    ? Math.max(0, somaQuadrados / totalObservacoes - mediaBruta ** 2)
    : 0;

  const desvioPadrao = Math.sqrt(variancia);

  // Para uma Lotofácil de 15 dezenas, usamos 5 como referência
  // de dispersão elevada. Quanto menor a dispersão, maior a consistência.
  const consistencia = Math.max(
    0,
    Math.min(100, 100 - (desvioPadrao / 5) * 100),
  );

  // Desempenho alto:
  // valoriza progressivamente resultados de 11 a 15 acertos.
  // Cada concurso conta apenas uma vez no maior nível atingido.
  const total = evaluation.concursosAvaliados;

  const ocorrenciasAltas = {
    11: evaluation.ocorrencias[11],
    12: evaluation.ocorrencias[12],
    13: evaluation.ocorrencias[13],
    14: evaluation.ocorrencias[14],
    15: evaluation.ocorrencias[15],
  };

  const pesosAltos = {
    11: 1,
    12: 2,
    13: 4,
    14: 7,
    15: 12,
  };

  let pontosAltos = 0;
  let pontosMaximos = total * pesosAltos[11];

  for (const nivel of [12, 13, 14, 15] as const) {
    const ocorrencias = ocorrenciasAltas[nivel];
    const peso = pesosAltos[nivel];

    pontosAltos += ocorrencias * peso;
    pontosMaximos += total * peso;
  }

  // A ocorrência de 11 acertos também participa da escala.
  pontosAltos += ocorrenciasAltas[11] * pesosAltos[11];

  const desempenhoAlto = pontosMaximos > 0
    ? Math.max(0, Math.min(100, (pontosAltos / pontosMaximos) * 100))
    : 0;

  const componentes = {
    historico,
    recencia,
    consistencia,
    desempenhoAlto,
  };

  const totalScore =
    componentes.historico * LOTTO_LAB_SCORE_WEIGHTS.historico +
    componentes.recencia * LOTTO_LAB_SCORE_WEIGHTS.recencia +
    componentes.consistencia * LOTTO_LAB_SCORE_WEIGHTS.consistencia +
    componentes.desempenhoAlto * LOTTO_LAB_SCORE_WEIGHTS.desempenhoAlto;

  return {
    historico: componentes.historico,
    recencia: componentes.recencia,
    consistencia: componentes.consistencia,
    desempenhoAlto: componentes.desempenhoAlto,
    total: totalScore,
  };
}
export function evaluateGameHistory(
  game: NumberCollection | readonly number[],
  historicalContests: readonly HistoricalContest[],
): HistoricalEvaluation {
  const dezenas = obterDezenas(game);
  const contarAcertos = createHitCounter(dezenas);
  const resultados = historicalContests.map((contest) => ({
    concurso: contest.concurso,
    acertos: contarAcertos(contest),
  }));
  const acertos = resultados.map((resultado) => resultado.acertos);
  const ordenados = [...acertos].sort((a, b) => a - b);
  const concursosAvaliados = resultados.length;
  const distribuicao: Record<number, number> = {};

  for (const valor of acertos) {
    distribuicao[valor] = (distribuicao[valor] ?? 0) + 1;
  }

  const media = concursosAvaliados
    ? acertos.reduce((total, valor) => total + valor, 0) / concursosAvaliados
    : 0;
  const meio = Math.floor(ordenados.length / 2);
  const mediana = ordenados.length === 0
    ? 0
    : ordenados.length % 2
      ? ordenados[meio]
      : (ordenados[meio - 1] + ordenados[meio]) / 2;
  const melhor = concursosAvaliados ? Math.max(...acertos) : 0;

  const ocorrencias = {
    10: distribuicao[10] ?? 0,
    11: distribuicao[11] ?? 0,
    12: distribuicao[12] ?? 0,
    13: distribuicao[13] ?? 0,
    14: distribuicao[14] ?? 0,
    15: distribuicao[15] ?? 0,
    "9OuMenos": acertos.filter((valor) => valor <= 9).length,
  };

  const janelas = {
    10: avaliarJanela(acertos.slice(-10)),
    25: avaliarJanela(acertos.slice(-25)),
    50: avaliarJanela(acertos.slice(-50)),
    100: avaliarJanela(acertos.slice(-100)),
    250: avaliarJanela(acertos.slice(-250)),
    completo: avaliarJanela(acertos),
  };

  const recencia = {} as RecencyEvaluation;
  const consistencia = {} as ConsistencyEvaluation;

  for (const limite of LIMITES) {
    let indiceEncontrado = -1;
    for (let indice = resultados.length - 1; indice >= 0; indice -= 1) {
      if (resultados[indice].acertos >= limite) {
        indiceEncontrado = indice;
        break;
      }
    }

    recencia[limite] = {
      ultimoConcurso:
        indiceEncontrado >= 0 ? resultados[indiceEncontrado].concurso : null,
      concursosDesde:
        indiceEncontrado >= 0 ? resultados.length - 1 - indiceEncontrado : null,
    };
    consistencia[limite] = concursosAvaliados
      ? arredondar(
          acertos.filter((valor) => valor >= limite).length /
            concursosAvaliados *
            100,
        )
      : 0;
  }

  const base: Omit<HistoricalEvaluation, "pontuacao"> = {
    melhor,
    pior: concursosAvaliados ? Math.min(...acertos) : 0,
    media: arredondar(media),
    mediana: arredondar(mediana),
    concursosAvaliados,
    distribuicao,
    ocorrencias,
    janelas,
    recencia,
    consistencia,
    concursosMelhorDesempenho: resultados
      .filter((resultado) => resultado.acertos === melhor)
      .map((resultado) => resultado.concurso),
  };

  return {
    ...base,
    pontuacao: calculateLottoLabScore(base, dezenas.length),
  };
}

export function createEvaluationCache(
  historicalContests: readonly HistoricalContest[],
): EvaluationCache {
  let assinatura = 2166136261;
  for (const concurso of historicalContests) {
    assinatura ^= concurso.concurso;
    assinatura = Math.imul(assinatura, 16777619);
    for (const dezena of concurso.dezenas) {
      assinatura ^= dezena;
      assinatura = Math.imul(assinatura, 16777619);
    }
  }

  return {
    historyKey: `${historicalContests.length}:${assinatura >>> 0}`,
    values: new Map(),
    hits: 0,
    misses: 0,
  };
}

export function gameCacheKey(game: NumberCollection | readonly number[]) {
  return [...obterDezenas(game)]
    .sort((a, b) => a - b)
    .map((dezena) => String(dezena).padStart(2, "0"))
    .join("-");
}

function ensureCache(
  cache: EvaluationCache,
  historicalContests: readonly HistoricalContest[],
) {
  const next = createEvaluationCache(historicalContests);
  if (cache.historyKey !== next.historyKey) {
    cache.historyKey = next.historyKey;
    cache.values.clear();
    cache.hits = 0;
    cache.misses = 0;
  }
}

export async function evaluateGames<TGame extends NumberCollection>(
  games: readonly TGame[],
  historicalContests: readonly HistoricalContest[],
  cache: EvaluationCache,
  options: { signal?: AbortSignal; batchSize?: number } = {},
): Promise<EvaluatedGame<TGame>[]> {
  ensureCache(cache, historicalContests);
  const evaluated: EvaluatedGame<TGame>[] = [];
  const batchSize = Math.max(1, options.batchSize ?? 25);

  for (let index = 0; index < games.length; index += 1) {
    if (options.signal?.aborted) return [];

    const game = games[index];
    const key = gameCacheKey(game);
    let avaliacao = cache.values.get(key);

    if (avaliacao) {
      cache.hits += 1;
    } else {
      avaliacao = evaluateGameHistory(game, historicalContests);
      cache.values.set(key, avaliacao);
      cache.misses += 1;
    }

    evaluated.push({
      id: `jogo-${String(index + 1).padStart(3, "0")}`,
      jogo: game,
      avaliacao,
      ranking: 0,
    });

    if ((index + 1) % batchSize === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return rankGames(evaluated, "pontuacao");
}

function rankingValue(game: EvaluatedGame, criterion: RankingCriterion) {
  const evaluation = game.avaliacao;

  if (criterion === "pontuacao") return evaluation.pontuacao.total;
  if (criterion === "melhor") return evaluation.melhor;
  if (criterion === "media") return evaluation.media;
  if (criterion === "consistencia") return evaluation.consistencia[11];
  if (criterion === "recente") return evaluation.janelas["25"].media;
  if (criterion === "12+") return evaluation.janelas.completo.acimaDe12;
  if (criterion === "13+") return evaluation.janelas.completo.acimaDe13;
  if (criterion === "14+") return evaluation.janelas.completo.acimaDe14;
  return evaluation.janelas.completo.quinze;
}

export function rankGames<TGame extends NumberCollection>(
  games: readonly EvaluatedGame<TGame>[],
  criterion: RankingCriterion,
) {
  return [...games]
    .sort((a, b) => {
      const diferenca =
        rankingValue(b as EvaluatedGame, criterion) -
        rankingValue(a as EvaluatedGame, criterion);
      return diferenca || a.id.localeCompare(b.id);
    })
    .map((game, index) => ({ ...game, ranking: index + 1 }));
}

export function calcularEstatisticas(dezenas: number[]): EstatisticasLotofacil {
  return {
    pares: dezenas.filter(ehPar).length,
    moldura: dezenas.filter(ehMoldura).length,
    primos: dezenas.filter(ehPrimo).length,
    fibonacci: dezenas.filter(ehFibonacci).length,
    multiplos3: dezenas.filter(ehMultiploDe3).length,
    soma: dezenas.reduce((total, numero) => total + numero, 0),
  };
}


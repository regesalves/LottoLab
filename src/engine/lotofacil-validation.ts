import {
  ehFibonacci,
  ehMoldura,
  ehMultiploDe3,
  ehPar,
  ehPrimo,
} from "./statistics.ts";

export interface LotofacilValidationConfig {
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

export interface ValidationIssue {
  code: string;
  title: string;
  message: string;
}

type Metrica = "pares" | "repetidas" | "moldura" | "primos" | "fibonacci" | "multiplos3";
type Restricao = Metrica | "soma";
type Contadores = Record<Metrica, number>;

const UNIVERSO = Array.from({ length: 25 }, (_, indice) => indice + 1);
const METRICAS: Metrica[] = ["pares", "repetidas", "moldura", "primos", "fibonacci", "multiplos3"];
const NOMES: Record<Metrica, string> = {
  pares: "Pares",
  repetidas: "Repetidas",
  moldura: "Moldura",
  primos: "Primos",
  fibonacci: "Fibonacci",
  multiplos3: "Múltiplos de 3",
};

function normalizar(config: LotofacilValidationConfig): LotofacilValidationConfig {
  const unicos = (valores: number[]) => [...new Set(valores)].sort((a, b) => a - b);
  return {
    quantidadeDezenas: unicos(config.quantidadeDezenas).filter((valor) => valor >= 15 && valor <= 20),
    fixas: unicos(config.fixas).filter((valor) => valor >= 1 && valor <= 25),
    excluidas: unicos(config.excluidas).filter((valor) => valor >= 1 && valor <= 25),
    pares: unicos(config.pares),
    repetidas: config.dezenasConcursoAnterior.length > 0 ? unicos(config.repetidas) : [],
    dezenasConcursoAnterior: unicos(config.dezenasConcursoAnterior).filter((valor) => valor >= 1 && valor <= 25),
    moldura: unicos(config.moldura),
    primos: unicos(config.primos),
    fibonacci: unicos(config.fibonacci),
    multiplos3: unicos(config.multiplos3),
    somaMin: Math.min(config.somaMin, config.somaMax),
    somaMax: Math.max(config.somaMin, config.somaMax),
  };
}

function pertence(numero: number, metrica: Metrica, referencia: Set<number>) {
  if (metrica === "pares") return ehPar(numero);
  if (metrica === "repetidas") return referencia.has(numero);
  if (metrica === "moldura") return ehMoldura(numero);
  if (metrica === "primos") return ehPrimo(numero);
  if (metrica === "fibonacci") return ehFibonacci(numero);
  return ehMultiploDe3(numero);
}

function somaMenores(valores: number[], inicio: number, quantidade: number) {
  let soma = 0;
  for (let indice = inicio; indice < inicio + quantidade; indice += 1) soma += valores[indice];
  return soma;
}

function somaMaiores(valores: number[], inicio: number, quantidade: number) {
  let soma = 0;
  for (let indice = valores.length - 1; indice >= inicio && quantidade > 0; indice -= 1, quantidade -= 1) {
    soma += valores[indice];
  }
  return soma;
}

function possuiAlternativa(valores: number[], minimo: number, maximo: number) {
  return valores.length === 0 || valores.some((valor) => valor >= minimo && valor <= maximo);
}

export function analisarConfiguracaoLotofacil(
  configuracao: LotofacilValidationConfig,
): ValidationIssue[] {
  const config = normalizar(configuracao);
  const problemas: ValidationIssue[] = [];
  if (config.quantidadeDezenas.length === 0) {
    return [{ code: "quantidade-ausente", title: "Quantidade de dezenas", message: "Selecione pelo menos uma quantidade de dezenas." }];
  }

  const fixas = new Set(config.fixas);
  const excluidas = new Set(config.excluidas);
  const conflitos = config.fixas.filter((numero) => excluidas.has(numero));
  if (conflitos.length > 0) {
    problemas.push({
      code: "fixas-excluidas",
      title: "Fixas × Dezenas a evitar",
      message: `As dezenas ${conflitos.map((numero) => String(numero).padStart(2, "0")).join(", ")} não podem ser fixas e excluídas ao mesmo tempo.`,
    });
  }
  const candidatas = UNIVERSO.filter(
    (numero) => !fixas.has(numero) && !excluidas.has(numero),
  );
  const referencia = new Set(config.dezenasConcursoAnterior);
  const quantidades = config.quantidadeDezenas.filter((quantidade) => {
    const faltam = quantidade - config.fixas.length;
    return faltam >= 0 && faltam <= candidatas.length;
  });

  if (quantidades.length === 0) {
    const disponiveis = UNIVERSO.length - config.excluidas.length;
    problemas.push({
      code: config.fixas.length > Math.max(...config.quantidadeDezenas)
        ? "quantidade-fixas"
        : "quantidade-disponivel",
      title: "Quantidade de dezenas × Fixas e excluídas",
      message: config.fixas.length > Math.max(...config.quantidadeDezenas)
        ? `Foram selecionadas ${config.fixas.length} dezenas fixas, acima de todas as quantidades de jogo permitidas.`
        : `A quantidade solicitada exige mais dezenas do que as ${disponiveis} que permanecem disponíveis após ${config.excluidas.length} exclusões.`, 
    });
    for (const metrica of METRICAS) {
      const permitidos = config[metrica];
      if (permitidos.length === 0) continue;
      const obrigatorias = config.fixas.filter((numero) => pertence(numero, metrica, referencia)).length;
      const maximoPedido = Math.max(...permitidos);
      if (obrigatorias > maximoPedido) {
        problemas.push({
          code: metrica + '-fixas',
          title: NOMES[metrica] + ' × Fixas',
          message: 'As dezenas fixas selecionadas já excedem o máximo permitido por esse filtro.',
        });
      }
    }
    const somaFixas = config.fixas.reduce((total, numero) => total + numero, 0);
    if (somaFixas > config.somaMax) {
      problemas.push({
        code: 'soma-fixas',
        title: 'Soma × Fixas',
        message: 'A soma das dezenas fixas já ultrapassa o máximo definido.',
      });
    }
    return problemas;
  }

  for (const metrica of METRICAS) {
    const permitidos = config[metrica];
    if (permitidos.length === 0) continue;
    const limites = quantidades.map((quantidade) => {
      const faltam = quantidade - config.fixas.length;
      const obrigatorias = config.fixas.filter((numero) => pertence(numero, metrica, referencia)).length;
      const disponiveis = candidatas.filter((numero) => pertence(numero, metrica, referencia)).length;
      const fora = candidatas.length - disponiveis;
      return {
        obrigatorias,
        minimo: obrigatorias + Math.max(0, faltam - fora),
        maximo: obrigatorias + Math.min(faltam, disponiveis),
      };
    });
    if (limites.some(({ minimo, maximo }) => possuiAlternativa(permitidos, minimo, maximo))) continue;

    const obrigatorias = Math.min(...limites.map((limite) => limite.obrigatorias));
    const minimo = Math.min(...limites.map((limite) => limite.minimo));
    const maximo = Math.max(...limites.map((limite) => limite.maximo));
    const minimoPedido = Math.min(...permitidos);
    const maximoPedido = Math.max(...permitidos);
    let message: string;
    if (obrigatorias > maximoPedido) {
      message = `As dezenas fixas selecionadas já obrigam pelo menos ${obrigatorias} ${NOMES[metrica].toLowerCase()}, mas o filtro permite no máximo ${maximoPedido}.`;
    } else if (minimo > maximoPedido) {
      message = `O jogo terá pelo menos ${minimo} ${NOMES[metrica].toLowerCase()}, mas o filtro permite no máximo ${maximoPedido}.`;
    } else if (metrica === "repetidas" && config.excluidas.some((numero) => referencia.has(numero))) {
      message = `São necessárias ${minimoPedido} repetidas, mas apenas ${maximo} dezenas do concurso de referência permanecem disponíveis após as exclusões.`;
    } else {
      message = `É possível atingir no máximo ${maximo} ${NOMES[metrica].toLowerCase()}, abaixo do mínimo exigido de ${minimoPedido}.`;
    }
    problemas.push({ code: `${metrica}-limites`, title: `${NOMES[metrica]} × Fixas e quantidade`, message });
  }

  const somaFixas = config.fixas.reduce((total, numero) => total + numero, 0);
  const limitesSoma = quantidades.map((quantidade) => {
    const faltam = quantidade - config.fixas.length;
    return {
      minimo: somaFixas + somaMenores(candidatas, 0, faltam),
      maximo: somaFixas + somaMaiores(candidatas, 0, faltam),
    };
  });
  if (!limitesSoma.some(({ minimo, maximo }) => config.somaMin <= maximo && config.somaMax >= minimo)) {
    const minimo = Math.min(...limitesSoma.map((limite) => limite.minimo));
    const maximo = Math.max(...limitesSoma.map((limite) => limite.maximo));
    problemas.push(config.somaMax < minimo
      ? { code: "soma-maxima", title: "Soma × Fixas e quantidade", message: `Mesmo completando o jogo com as menores dezenas possíveis, a soma mínima seria ${minimo}, acima do máximo definido de ${config.somaMax}.` }
      : { code: "soma-minima", title: "Soma × Fixas e quantidade", message: `Mesmo completando o jogo com as maiores dezenas possíveis, a soma máxima seria ${maximo}, abaixo do mínimo definido de ${config.somaMin}.` });
  }
  if (problemas.length > 0) return problemas;

  const restricoesAtivas: Restricao[] = [
    ...METRICAS.filter((metrica) => config[metrica].length > 0),
    "soma",
  ];

  const existeJogo = (restricoes: readonly Restricao[]) => {
    const metricas = METRICAS.filter((metrica) => restricoes.includes(metrica));
    const validarSoma = restricoes.includes("soma");
    const contadoresFixos = metricas.reduce<Partial<Contadores>>((resultado, metrica) => {
      resultado[metrica] = config.fixas.filter((numero) => pertence(numero, metrica, referencia)).length;
      return resultado;
    }, {});
    const sufixos = metricas.reduce<Partial<Record<Metrica, number[]>>>((resultado, metrica) => {
      const contagens = Array(candidatas.length + 1).fill(0) as number[];
      for (let indice = candidatas.length - 1; indice >= 0; indice -= 1) {
        contagens[indice] = contagens[indice + 1] + (pertence(candidatas[indice], metrica, referencia) ? 1 : 0);
      }
      resultado[metrica] = contagens;
      return resultado;
    }, {});

    for (const quantidade of quantidades) {
      const memo = new Set<string>();
      const buscar = (indice: number, faltam: number, soma: number, contadores: Partial<Contadores>): boolean => {
        const restantes = candidatas.length - indice;
        if (faltam < 0 || faltam > restantes) return false;
        if (validarSoma) {
          if (soma > config.somaMax) return false;
          if (faltam > 0 && soma + somaMenores(candidatas, indice, faltam) > config.somaMax) return false;
          if (faltam > 0 && soma + somaMaiores(candidatas, indice, faltam) < config.somaMin) return false;
          if (faltam === 0 && soma < config.somaMin) return false;
        }
        for (const metrica of metricas) {
          const atual = contadores[metrica] ?? 0;
          const restantesDaMetrica = sufixos[metrica]?.[indice] ?? 0;
          const minimo = atual + Math.max(0, faltam - (restantes - restantesDaMetrica));
          const maximo = atual + Math.min(faltam, restantesDaMetrica);
          if (!possuiAlternativa(config[metrica], minimo, maximo)) return false;
        }
        if (faltam === 0) return true;
        if (indice >= candidatas.length) return false;

        const chave = `${indice}|${faltam}|${validarSoma ? soma : "-"}|${metricas.map((metrica) => contadores[metrica] ?? 0).join(",")}`;
        if (memo.has(chave)) return false;
        memo.add(chave);
        const numero = candidatas[indice];
        const proximos = { ...contadores };
        for (const metrica of metricas) {
          if (pertence(numero, metrica, referencia)) proximos[metrica] = (proximos[metrica] ?? 0) + 1;
        }
        return buscar(indice + 1, faltam - 1, soma + numero, proximos) ||
          buscar(indice + 1, faltam, soma, contadores);
      };
      if (buscar(0, quantidade - config.fixas.length, somaFixas, contadoresFixos)) return true;
    }
    return false;
  };

  if (existeJogo(restricoesAtivas)) return [];

  const nome = (restricao: Restricao) => restricao === "soma" ? "Soma" : NOMES[restricao];
  for (let primeiro = 0; primeiro < restricoesAtivas.length; primeiro += 1) {
    for (let segundo = primeiro + 1; segundo < restricoesAtivas.length; segundo += 1) {
      const esquerda = restricoesAtivas[primeiro];
      const direita = restricoesAtivas[segundo];
      if (existeJogo([esquerda, direita])) continue;
      problemas.push({
        code: `${esquerda}-${direita}`,
        title: `${nome(esquerda)} × ${nome(direita)}`,
        message: `Nenhum jogo consegue atender simultaneamente aos filtros de ${nome(esquerda).toLowerCase()} e ${nome(direita).toLowerCase()} com as quantidades e dezenas fixas selecionadas.`,
      });
    }
  }

  if (problemas.length === 0) {
    problemas.push({
      code: "criterios-combinados",
      title: "Critérios combinados",
      message: `As opções de ${restricoesAtivas.map(nome).join(", ")} funcionam isoladamente, mas não podem ser atendidas ao mesmo tempo.`,
    });
  }
  return problemas;
}





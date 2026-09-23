import { useEffect, useMemo, useRef, useState } from "react";
import {
  gerarJogosLotofacil,
  validarConfiguracaoLotofacil,
  type LotofacilJogo,
  type ValidationIssue,
} from "../engine/lotofacil";
import {
  createEvaluationCache,
  type EvaluatedGame,
} from "../core/lotofacil";
import { validateGeneratedGames } from "../engine/gameValidator";
import { alternarRegraDezena, alternarValorFiltro } from "../engine/numberSelection";
import { LOTOFACIL_DEFINITION, LOTOFACIL_NUMBERS } from "../core/lotofacil";
import type { ConcursoLotofacil } from "../history/types";

type DisplayGame = LotofacilJogo & { moldura: number };
const RESULTADOS_POR_PAGINA = 100;
const SEM_DEZENAS: number[] = [];

export function useLotofacilGenerator({ concursoSelecionado }: { concursoSelecionado: ConcursoLotofacil | null }) {
  const [modoSelecao, setModoSelecao] = useState<"fixa" | "excluida">("fixa");
  const [fixas, setFixas] = useState<number[]>([]);
  const [excluidas, setExcluidas] = useState<number[]>([]);
  const [quantidades, setQuantidades] = useState<number[]>([]);
  const [selecionados, setSelecionados] = useState<Record<string, number[]>>({});
  const [somaMinima, setSomaMinima] = useState(180);
  const [somaMaxima, setSomaMaxima] = useState(210);
  const [jogos, setJogos] = useState<DisplayGame[]>([]);
  const [jogosAvaliados, setJogosAvaliados] = useState<
    EvaluatedGame<DisplayGame>[]
  >([]);
  const [geracaoVersao, setGeracaoVersao] = useState(0);
  const [gerando, setGerando] = useState(false);
  const [errosGeracao, setErrosGeracao] = useState<ValidationIssue[]>([]);
  const [resultadosVisiveis, setResultadosVisiveis] = useState(
    RESULTADOS_POR_PAGINA,
  );
  const cacheAvaliacoes = useRef(createEvaluationCache([]));

  const dezenasReferenciaFiltro = selecionados.repetidas?.length
    ? concursoSelecionado?.dezenas ?? SEM_DEZENAS
    : SEM_DEZENAS;

  const configuracaoGeracao = useMemo(
    () => ({
      quantidadeDezenas: quantidades,
      fixas,
      excluidas,
      pares: selecionados.pares ?? [],
      repetidas: selecionados.repetidas ?? [],
      dezenasConcursoAnterior: dezenasReferenciaFiltro,
      moldura: selecionados.moldura ?? [],
      primos: selecionados.primos ?? [],
      fibonacci: selecionados.fibonacci ?? [],
      multiplos3: selecionados.multiplos3 ?? [],
      somaMin: somaMinima,
      somaMax: somaMaxima,
    }),
    [dezenasReferenciaFiltro, excluidas, fixas, quantidades, selecionados, somaMaxima, somaMinima],
  );

  function limpar() {
    setFixas([]);
    setExcluidas([]);
    setQuantidades([]);
    setSelecionados({});
    setSomaMinima(180);
    setSomaMaxima(210);
    setJogos([]);
    setJogosAvaliados([]);
    setGeracaoVersao(0);
    setGerando(false);
    setErrosGeracao([]);
    setResultadosVisiveis(RESULTADOS_POR_PAGINA);
  }

  function gerarJogos() {
    const erros = validarConfiguracaoLotofacil(configuracaoGeracao);
    if (erros.length > 0) {
      setErrosGeracao(erros);
      setJogos([]);
      setJogosAvaliados([]);
      return;
    }

    setErrosGeracao([]);
    setGeracaoVersao((versao) => versao + 1);
  }

  function alternarFixa(numero: number) {
    const proximo = alternarRegraDezena(numero, "fixa", fixas, excluidas);
    setFixas(proximo.fixas);
    setExcluidas(proximo.excluidas);
  }

  function alternarExcluida(numero: number) {
    const proximo = alternarRegraDezena(numero, "excluida", fixas, excluidas);
    setFixas(proximo.fixas);
    setExcluidas(proximo.excluidas);
  }

  function alternarQuantidade(valor: number) {
    setQuantidades((atual) => (atual.includes(valor) ? [] : [valor]));
  }

  function alternarFiltro(id: string, valor: number) {
    setSelecionados((atual) => {
      const atuais = atual[id] ?? [];
      const novos = alternarValorFiltro(atuais, valor);

      return {
        ...atual,
        [id]: novos,
      };
    });
  }

  useEffect(() => {
    if (geracaoVersao === 0) return;

    if (configuracaoGeracao.quantidadeDezenas.length === 0) {
      setJogos([]);
      setGerando(false);
      setErrosGeracao(validarConfiguracaoLotofacil(configuracaoGeracao));
      return;
    }

    const conflitos = validarConfiguracaoLotofacil(configuracaoGeracao);
    if (conflitos.length > 0) {
      setJogos([]);
      setJogosAvaliados([]);
      setGerando(false);
      setErrosGeracao(conflitos);
      return;
    }

    const controller = new AbortController();
    setGerando(true);
    setErrosGeracao([]);
    setResultadosVisiveis(RESULTADOS_POR_PAGINA);

    void gerarJogosLotofacil(configuracaoGeracao, { signal: controller.signal }).then((novosJogos) => {
      if (controller.signal.aborted) return;
      if (import.meta.env.DEV) {
        const verificacao = validateGeneratedGames(
          novosJogos,
          configuracaoGeracao,
          configuracaoGeracao.repetidas.length > 0
            ? {
                concurso: 0,
                data: "",
                dezenas: configuracaoGeracao.dezenasConcursoAnterior,
              }
            : null,
        );
        const resumo = [
          "[VALIDAÇÃO DOS JOGOS]",
          `${verificacao.totalJogos} jogos verificados.`,
          `${verificacao.jogosValidos} válidos.`,
          `${verificacao.jogosInvalidos} inválidos.`,
        ].join("\n");

        if (verificacao.valido) {
          console.info(resumo);
        } else {
          console.error(resumo, verificacao.inconsistencias);
        }
      }
      setJogos(novosJogos);
      setJogosAvaliados([]);
      setGerando(false);
      if (novosJogos.length === 0) {
        setErrosGeracao([{ 
          code: "sem-combinacoes",
          title: "Critérios selecionados",
          message: "A configuração selecionada não possui combinações compatíveis.",
        }]);
      }
    });

    return () => controller.abort();
  }, [configuracaoGeracao, geracaoVersao]);

  return {
    modoSelecao,
    setModoSelecao,
    fixas,
    setFixas,
    excluidas,
    setExcluidas,
    quantidades,
    setQuantidades,
    selecionados,
    setSelecionados,
    somaMinima,
    setSomaMinima,
    somaMaxima,
    setSomaMaxima,
    jogos,
    setJogos,
    jogosAvaliados,
    setJogosAvaliados,
    geracaoVersao,
    setGeracaoVersao,
    gerando,
    setGerando,
    errosGeracao,
    setErrosGeracao,
    resultadosVisiveis,
    setResultadosVisiveis,
    configuracaoGeracao,
    alternarFixa,
    alternarExcluida,
    alternarQuantidade,
    alternarFiltro,
    limpar,
    gerarJogos,
    cacheAvaliacoes,
  };
}

export const LOTOFACIL_GENERATOR_CONFIG = {
  definition: LOTOFACIL_DEFINITION,
  numbers: LOTOFACIL_NUMBERS,
};

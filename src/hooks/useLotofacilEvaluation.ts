import { useEffect, useRef, useState } from "react";
import {
  evaluateGames,
  type EvaluationCache,
  type EvaluatedGame,
  type HistoricalContest,
  type NumberCollection,
} from "../core/lotofacil";

export function useLotofacilEvaluation<TGame extends NumberCollection>({
  jogos,
  concursosDisponiveis,
  cacheAvaliacoes,
}: {
  jogos: readonly TGame[];
  concursosDisponiveis: readonly HistoricalContest[];
  cacheAvaliacoes: EvaluationCache;
}) {
  const [jogosAvaliados, setJogosAvaliados] = useState<
    EvaluatedGame<TGame>[]
  >([]);
  const [avaliando, setAvaliando] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    if (jogos.length === 0 || concursosDisponiveis.length === 0) {
      setJogosAvaliados([]);
      setAvaliando(false);
      return () => controller.abort();
    }

    setAvaliando(true);

    void evaluateGames(jogos, concursosDisponiveis, cacheAvaliacoes, {
      signal: controller.signal,
    })
      .then((avaliados) => {
        if (controller.signal.aborted) return;
        setJogosAvaliados(avaliados);
        setAvaliando(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setJogosAvaliados([]);
        setAvaliando(false);
      });

    return () => {
      controller.abort();
    };
  }, [cacheAvaliacoes, concursosDisponiveis, jogos]);

  return {
    jogosAvaliados,
    setJogosAvaliados,
    avaliando,
    setAvaliando,
    cancelar: () => {
      controllerRef.current?.abort();
    },
  };
}

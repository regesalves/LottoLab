import concursosRecentes from "../data/lotofacil-latest.json";
import type {
  ConcursoLotofacil,
  HistoryRepository,
  HistorySnapshot,
  ResumoHistoricoLotofacil,
} from "./types";

interface HistoryBridge {
  loadSnapshot(): Promise<HistorySnapshot>;
  refresh(): Promise<HistorySnapshot>;
  getContestByNumber(numero: number): Promise<ConcursoLotofacil | null>;
}

function resolveRuntimeHistoryBridge(): HistoryBridge | undefined {
  const runtime = globalThis as typeof globalThis & {
    lotofacilHistorico?: HistoryBridge;
  };

  return runtime.lotofacilHistorico;
}

export interface LotofacilHistoryProvider extends HistoryRepository {
  carregar(): Promise<ResumoHistoricoLotofacil>;
  loadSnapshot(): Promise<HistorySnapshot>;
  refresh(): Promise<HistorySnapshot>;
  getContestByNumber(numero: number): Promise<ConcursoLotofacil | null>;
}

export function createLotofacilHistoryProvider(): LotofacilHistoryProvider {
  const provider = resolveRuntimeHistoryBridge();

  if (provider) {
    return {
      carregar: () => provider.loadSnapshot(),
      loadSnapshot: () => provider.loadSnapshot(),
      refresh: () => provider.refresh(),
      getContestByNumber: (numero) => provider.getContestByNumber(numero),
    };
  }

  const fallback = concursosRecentes as ConcursoLotofacil[];

  return {
    async carregar(): Promise<ResumoHistoricoLotofacil> {
      return this.loadSnapshot();
    },
    async loadSnapshot(): Promise<HistorySnapshot> {
      return {
        concursos: fallback,
        totalConcursos: fallback.length,
        concursoAtual: fallback.at(-1) ?? null,
        concursoAnterior: fallback.at(-2) ?? null,
        atualizado: false,
        concursosAdicionados: 0,
      };
    },
    async refresh(): Promise<HistorySnapshot> {
      return this.loadSnapshot();
    },
    async getContestByNumber(numero: number): Promise<ConcursoLotofacil | null> {
      return fallback.find((concurso) => concurso.concurso === numero) ?? null;
    },
  };
}

/** Publica a base local primeiro e recupera falhas temporarias sem bloquear a tela. */
export async function iniciarHistorico(
  provider: LotofacilHistoryProvider,
  publicar: (snapshot: HistorySnapshot) => void,
  ativo: () => boolean,
  signal?: AbortSignal,
): Promise<void> {
  const local = await provider.carregar();
  if (!ativo()) return;
  publicar(local);
  // No máximo duas novas tentativas, espaçadas, apenas quando há erro.
  for (const atraso of [0, 30000, 120000]) {
    if (atraso > 0) await aguardarAtualizacao(atraso, signal);
    if (!ativo() || signal?.aborted) return;
    try {
      const atualizado = await provider.refresh();
      if (!ativo()) return;
      publicar(atualizado);
      if (!atualizado.erroAtualizacao) return;
    } catch {
      // Falhas de IPC preservam o snapshot ja publicado e permitem nova tentativa.
    }
  }
}

function aguardarAtualizacao(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const terminar = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", terminar);
      resolve();
    };
    const timer = setTimeout(terminar, ms);
    signal?.addEventListener("abort", terminar, { once: true });
  });
}

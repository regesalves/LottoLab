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

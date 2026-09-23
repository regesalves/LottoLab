export interface ConcursoLotofacil {
  concurso: number;
  data: string;
  dezenas: number[];
}

export interface HistorySnapshot {
  concursos: ConcursoLotofacil[];
  totalConcursos: number;
  concursoAtual: ConcursoLotofacil | null;
  concursoAnterior: ConcursoLotofacil | null;
  atualizado: boolean;
  concursosAdicionados: number;
  erroAtualizacao?: string;
}

export type ResumoHistoricoLotofacil = HistorySnapshot;

export interface LocalStore {
  readJson<T>(key: string): Promise<T | null>;
  writeJson<T>(key: string, value: T): Promise<void>;
}

export interface HistoryRepository {
  loadSnapshot(): Promise<HistorySnapshot>;
  refresh(): Promise<HistorySnapshot>;
  getContestByNumber(numero: number): Promise<ConcursoLotofacil | null>;
}

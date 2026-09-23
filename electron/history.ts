import { app } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import historicoInicial from "../src/data/lotofacil-history.json";
import type {
  ConcursoLotofacil,
  HistorySnapshot,
  LocalStore,
  ResumoHistoricoLotofacil,
} from "../src/history/types";

const API_CAIXA = "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil";
const ARQUIVO_HISTORICO = "lotofacil-history.json";

const localStore: LocalStore = {
  async readJson<T>(key: string): Promise<T | null> {
    const caminho = path.join(app.getPath("userData"), key);
    try {
      return JSON.parse(await readFile(caminho, "utf8")) as T;
    } catch {
      return null;
    }
  },
  async writeJson<T>(key: string, value: T): Promise<void> {
    const caminho = path.join(app.getPath("userData"), key);
    await writeFile(caminho, JSON.stringify(value), "utf8");
  },
};

interface RespostaCaixa {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
}

function normalizarConcurso(valor: unknown): ConcursoLotofacil | null {
  if (!valor || typeof valor !== "object") return null;
  const candidato = valor as Partial<ConcursoLotofacil>;
  if (typeof candidato.concurso !== "number" || !Number.isInteger(candidato.concurso) || typeof candidato.data !== "string") return null;
  if (!Array.isArray(candidato.dezenas) || candidato.dezenas.length !== 15) return null;
  const dezenas = [...new Set(candidato.dezenas.map(Number))]
    .filter((numero) => Number.isInteger(numero) && numero >= 1 && numero <= 25)
    .sort((a, b) => a - b);
  if (dezenas.length !== 15) return null;
  return { concurso: candidato.concurso, data: candidato.data, dezenas };
}

function normalizarHistorico(valores: unknown): ConcursoLotofacil[] {
  if (!Array.isArray(valores)) return [];
  const porConcurso = new Map<number, ConcursoLotofacil>();
  for (const valor of valores) {
    const concurso = normalizarConcurso(valor);
    if (concurso) porConcurso.set(concurso.concurso, concurso);
  }
  return [...porConcurso.values()].sort((a, b) => a.concurso - b.concurso);
}

async function consultarCaixa(numero?: number): Promise<ConcursoLotofacil> {
  const url = numero ? `${API_CAIXA}/${numero}` : API_CAIXA;
  let ultimaFalha: unknown;

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (resposta.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (tentativa + 1)));
        continue;
      }
      if (!resposta.ok) throw new Error(`CAIXA respondeu ${resposta.status}`);
      const dados = await resposta.json() as RespostaCaixa;
      const concurso = normalizarConcurso({
        concurso: dados.numero,
        data: dados.dataApuracao,
        dezenas: dados.listaDezenas.map(Number),
      });
      if (!concurso) throw new Error("Resposta inválida da CAIXA");
      return concurso;
    } catch (erro) {
      ultimaFalha = erro;
      if (tentativa < 3) await new Promise((resolve) => setTimeout(resolve, 500 * (tentativa + 1)));
    }
  }

  throw ultimaFalha instanceof Error ? ultimaFalha : new Error("Falha ao consultar a CAIXA");
}

async function carregarArquivoLocal(caminho: string) {
  try {
    return normalizarHistorico(JSON.parse(await readFile(caminho, "utf8")));
  } catch {
    return [];
  }
}

function resumir(
  historico: ConcursoLotofacil[],
  atualizado: boolean,
  concursosAdicionados = 0,
  erroAtualizacao?: string,
): HistorySnapshot {
  return {
    concursos: historico,
    totalConcursos: historico.length,
    concursoAtual: historico.at(-1) ?? null,
    concursoAnterior: historico.at(-2) ?? null,
    atualizado,
    concursosAdicionados,
    erroAtualizacao,
  };
}

export async function loadHistorySnapshot(): Promise<HistorySnapshot> {
  const caminho = path.join(app.getPath("userData"), ARQUIVO_HISTORICO);
  const baseEmbutida = normalizarHistorico(historicoInicial);
  const baseLocal = await carregarArquivoLocal(caminho);
  const historico = normalizarHistorico([...baseEmbutida, ...baseLocal]);
  return resumir(historico, false);
}

export async function carregarEAtualizarHistorico(): Promise<ResumoHistoricoLotofacil> {
  return refreshHistorySnapshot();
}

export async function getContestByNumber(numero: number): Promise<ConcursoLotofacil | null> {
  const snapshot = await loadHistorySnapshot();
  return snapshot.concursos.find((concurso) => concurso.concurso === numero) ?? null;
}

export async function refreshHistorySnapshot(): Promise<HistorySnapshot> {
  const snapshot = await loadHistorySnapshot();
  const existentes = new Map(snapshot.concursos.map((concurso) => [concurso.concurso, concurso]));
  const ultimoConhecido = snapshot.concursoAtual?.concurso ?? 0;

  try {
    const maisRecente = await consultarCaixa();
    if (maisRecente.concurso <= ultimoConhecido) return resumir(snapshot.concursos, false);

    const novosConcursos: ConcursoLotofacil[] = [];
    for (let numero = ultimoConhecido + 1; numero <= maisRecente.concurso; numero += 1) {
      const concurso = numero === maisRecente.concurso ? maisRecente : await consultarCaixa(numero);
      if (concurso.concurso !== numero) {
        throw new Error("A CAIXA retornou um concurso incompleto ou inesperado.");
      }
      if (!existentes.has(concurso.concurso)) {
        existentes.set(concurso.concurso, concurso);
        novosConcursos.push(concurso);
      }
    }

    const historicoAtualizado = normalizarHistorico([...snapshot.concursos, ...novosConcursos]);
    if (historicoAtualizado.length !== snapshot.concursos.length + novosConcursos.length) {
      throw new Error("A CAIXA retornou concursos inválidos.");
    }

    if (novosConcursos.length > 0) {
      await localStore.writeJson(ARQUIVO_HISTORICO, historicoAtualizado);
    }
    return resumir(historicoAtualizado, novosConcursos.length > 0, novosConcursos.length);
  } catch (erro) {
    console.warn("Não foi possível atualizar o histórico da Lotofácil; mantendo a base local.", erro);
    const mensagem = erro instanceof Error ? erro.message : "Falha ao consultar a CAIXA.";
    return resumir(snapshot.concursos, false, 0, mensagem);
  }
}

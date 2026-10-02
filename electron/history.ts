import { app } from "electron";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import historicoInicial from "../src/data/lotofacil-history.json";
import type {
  ConcursoLotofacil,
  HistorySnapshot,
  LocalStore,
} from "../src/history/types";

// Mesmo servidor publicado pelo portal oficial; redescoberto se a rota falhar.
let apiCaixa = "https://servicebus3.caixa.gov.br/portaldeloterias";
const PARAMETROS_CAIXA = "https://loterias.caixa.gov.br/Style%20Library/json/params.txt";

async function descobrirApiCaixa(): Promise<string> {
  const resposta = await fetch(PARAMETROS_CAIXA, { signal: AbortSignal.timeout(3000) });
  if (!resposta.ok) throw new Error(`Portal CAIXA respondeu ${resposta.status}`);
  const dados = await resposta.json() as { urlapiloterias?: string };
  const url = new URL(dados.urlapiloterias ?? "");
  if (url.protocol !== "https:" || !/^servicebus\d+\.caixa\.gov\.br$/.test(url.hostname)
      || url.pathname.replace(/\/$/, "") !== "/portaldeloterias"
      || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error("Endereço de API inválido no portal da CAIXA.");
  }
  return url.origin + "/portaldeloterias";
}
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
    const temporario = `${caminho}.tmp`;
    await writeFile(temporario, JSON.stringify(value), "utf8");
    await rename(temporario, caminho);
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

async function consultarCaixa(numero: number, api: string): Promise<ConcursoLotofacil | null> {
  const resposta = await fetch(`${api}/api/lotofacil/${numero}`, {
    signal: AbortSignal.timeout(3000),
    headers: { Accept: "application/json" },
  });
  // O gateway oficial também encapsula o 404 do concurso futuro em HTTP 500.
  if (resposta.status === 404 || resposta.status === 204) return null;
  if (resposta.status === 500) {
    const erro = await resposta.json().catch(() => null) as { exceptionMessage?: string } | null;
    try {
      if (typeof erro?.exceptionMessage === "string"
          && JSON.parse(erro.exceptionMessage).StatusCode === 404) return null;
    } catch { /* Outros erros 500 continuam sendo falhas, nunca "atualizado". */ }
  }
  if (!resposta.ok) throw new Error(`CAIXA respondeu HTTP ${resposta.status}`);
  const dados = await resposta.json() as RespostaCaixa;
  if (dados === null) return null;
  const concurso = normalizarConcurso({
    concurso: dados.numero,
    data: dados.dataApuracao,
    dezenas: dados.listaDezenas,
  });
  if (!concurso || concurso.concurso !== numero) {
    throw new Error("A CAIXA retornou um concurso incompleto ou inesperado.");
  }
  return concurso;
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

export async function getContestByNumber(numero: number): Promise<ConcursoLotofacil | null> {
  const snapshot = await loadHistorySnapshot();
  return snapshot.concursos.find((concurso) => concurso.concurso === numero) ?? null;
}

let atualizacaoEmCurso: Promise<HistorySnapshot> | null = null;

export function refreshHistorySnapshot(): Promise<HistorySnapshot> {
  // Compartilha a mesma busca entre inicializacao, StrictMode e botao manual.
  atualizacaoEmCurso ??= atualizarHistorico().finally(() => {
    atualizacaoEmCurso = null;
  });
  return atualizacaoEmCurso;
}

async function atualizarHistorico(): Promise<HistorySnapshot> {
  const snapshot = await loadHistorySnapshot();
  let historico = snapshot.concursos;
  let adicionados = 0;
  let redescobriuApi = false;
  try {
    for (let numero = (snapshot.concursoAtual?.concurso ?? 0) + 1; ; numero += 1) {
      let concurso: ConcursoLotofacil | null;
      try {
        concurso = await consultarCaixa(numero, apiCaixa);
      } catch (erro) {
        // Uma unica descoberta por sincronizacao, sem repetir a rota que falhou.
        if (redescobriuApi) throw erro;
        redescobriuApi = true;
        const descoberta = await descobrirApiCaixa().catch(() => null);
        if (!descoberta || descoberta === apiCaixa) throw erro;
        apiCaixa = descoberta;
        concurso = await consultarCaixa(numero, apiCaixa);
      }
      if (!concurso) break;
      const atualizado = normalizarHistorico([...historico, concurso]);
      // Persiste cada avanco: uma falha posterior nao perde concursos obtidos.
      await localStore.writeJson(ARQUIVO_HISTORICO, atualizado);
      historico = atualizado;
      adicionados += 1;
    }
    return resumir(historico, adicionados > 0, adicionados);
  } catch (erro) {
    console.warn("Não foi possível atualizar o histórico da Lotofácil; mantendo a base local.", erro);
    const mensagem = erro instanceof Error && erro.name === "TimeoutError"
      ? "A CAIXA demorou para responder. O histórico local foi mantido."
      : erro instanceof Error ? erro.message : "Falha ao consultar a CAIXA.";
    return resumir(historico, adicionados > 0, adicionados, mensagem);
  }
}

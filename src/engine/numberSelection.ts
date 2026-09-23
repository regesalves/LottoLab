export type RegraDezena = "fixa" | "excluida";

export interface SelecaoDezenas {
  fixas: number[];
  excluidas: number[];
}

const ordenar = (valores: number[]) => [...new Set(valores)].sort((a, b) => a - b);

export function alternarRegraDezena(
  numero: number,
  regra: RegraDezena,
  fixas: readonly number[],
  excluidas: readonly number[],
): SelecaoDezenas {
  if (regra === "fixa") {
    return fixas.includes(numero)
      ? { fixas: fixas.filter((valor) => valor !== numero), excluidas: [...excluidas] }
      : {
          fixas: ordenar([...fixas, numero]),
          excluidas: excluidas.filter((valor) => valor !== numero),
        };
  }

  return excluidas.includes(numero)
    ? { fixas: [...fixas], excluidas: excluidas.filter((valor) => valor !== numero) }
    : {
        fixas: fixas.filter((valor) => valor !== numero),
        excluidas: ordenar([...excluidas, numero]),
      };
}

export function alternarValorFiltro(valores: readonly number[], valor: number): number[] {
  return valores.includes(valor)
    ? valores.filter((item) => item !== valor)
    : ordenar([...valores, valor]);
}
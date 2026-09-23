/** Contratos utilizados pelo gerador da Lotofácil. */
export interface GenerationOptions {
  signal?: AbortSignal;
  intervaloDePausa?: number;
}

export interface GeneratedGame {
  dezenas: readonly number[];
  quantidade: number;
}

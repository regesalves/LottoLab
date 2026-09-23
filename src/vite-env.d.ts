/// <reference types="vite/client" />

import type { LotofacilHistoryProvider } from "./history/lotofacilHistoryProvider";

declare global {
  interface Window {
    lotofacilHistorico?: LotofacilHistoryProvider;
    lotofacilPdf?: {
      exportar(jogos: unknown[]): Promise<{ saved: boolean; path?: string; reason?: string }>;
    };
  }
}

export {};

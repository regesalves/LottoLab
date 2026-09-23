import type { ModalityDefinition } from "./types";

export type LotofacilSpecificFilterId = "frame";

export const LOTOFACIL_DEFINITION: ModalityDefinition<LotofacilSpecificFilterId> = {
  id: "lotofacil",
  name: "Lotofácil",
  numberRange: { min: 1, max: 25 },
  allowedBetSizes: [15, 16, 17, 18, 19, 20],
  drawnNumbersCount: 15,
  filters: {
    common: [
      "fixed-numbers",
      "excluded-numbers",
      "bet-size",
      "even-numbers",
      "repeated-numbers",
      "prime-numbers",
      "fibonacci-numbers",
      "multiples-of-three",
      "sum",
    ],
    specific: ["frame"],
  },
};

export const LOTOFACIL_NUMBERS = Array.from(
  { length: LOTOFACIL_DEFINITION.numberRange.max - LOTOFACIL_DEFINITION.numberRange.min + 1 },
  (_, index) => LOTOFACIL_DEFINITION.numberRange.min + index,
);
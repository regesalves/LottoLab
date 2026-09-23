export type ModalityId = "lotofacil";

export type CommonFilterId =
  | "fixed-numbers"
  | "excluded-numbers"
  | "bet-size"
  | "even-numbers"
  | "repeated-numbers"
  | "prime-numbers"
  | "fibonacci-numbers"
  | "multiples-of-three"
  | "sum";

export interface NumberRange {
  min: number;
  max: number;
}

export interface ModalityDefinition<TSpecificFilter extends string = never> {
  id: ModalityId;
  name: string;
  numberRange: NumberRange;
  allowedBetSizes: readonly number[];
  drawnNumbersCount: number;
  filters: {
    common: readonly CommonFilterId[];
    specific: readonly TSpecificFilter[];
  };
}

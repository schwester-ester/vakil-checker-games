import type { InitialValidation, Position } from "./types.js";
import { hasDistinctRowsAndColumns } from "./positions.js";
import { initialBlackConfiguration } from "./specializationOrder.js";
import { isHappy } from "./checkerRules.js";

export function normalizeSubset(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function validateSubset(values: readonly number[], n: number, k: number): string[] {
  const errors: string[] = [];
  if (values.length !== k) {
    errors.push(`Expected exactly ${k} entries.`);
  }
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > n)) {
    errors.push(`Every entry must be an integer in {1, …, ${n}}.`);
  }
  if (new Set(values).size !== values.length) {
    errors.push("Entries must be distinct.");
  }
  return errors;
}

export function parseSubset(text: string): number[] | null {
  const cleaned = text.trim().replace(/[{}\[\]()]/g, "");
  if (cleaned === "") {
    return [];
  }
  const parts = cleaned.split(/[\s,;]+/).filter(Boolean);
  const values = parts.map((part) => Number(part));
  return values.every(Number.isFinite) ? normalizeSubset(values) : null;
}

export function initialWhiteConfiguration(
  AInput: readonly number[],
  BInput: readonly number[],
): Position[] {
  const A = normalizeSubset(AInput);
  const B = normalizeSubset(BInput);
  if (A.length !== B.length) {
    throw new Error("A and B must have the same cardinality.");
  }
  const k = A.length;
  return A.map((row, index) => ({ row, col: B[k - 1 - index]! }));
}

export function inferSubsetsFromWhite(white: readonly Position[]): {
  A: number[];
  B: number[];
} {
  return {
    A: white.map(({ row }) => row).sort((a, b) => a - b),
    B: white.map(({ col }) => col).sort((a, b) => a - b),
  };
}

export function isVakilInitialForm(white: readonly Position[]): boolean {
  if (!hasDistinctRowsAndColumns(white)) {
    return false;
  }
  const sorted = [...white].sort((a, b) => a.row - b.row);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]!.col <= sorted[index]!.col) {
      return false;
    }
  }
  return true;
}

export function validateInitialWhite(
  n: number,
  k: number,
  white: readonly Position[],
): InitialValidation {
  const countCorrect = white.length === k;
  const distinctRows = new Set(white.map(({ row }) => row)).size === white.length;
  const distinctColumns = new Set(white.map(({ col }) => col)).size === white.length;
  const inBounds = white.every(
    ({ row, col }) =>
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 1 &&
      row <= n &&
      col >= 1 &&
      col <= n,
  );
  const vakilForm = distinctRows && distinctColumns && isVakilInitialForm(white);
  const black = initialBlackConfiguration(n);
  const allHappy = inBounds && white.every((checker) => isHappy(checker, black));
  const { A, B } = inferSubsetsFromWhite(white);
  const errors: string[] = [];

  if (!countCorrect) {
    errors.push(`Place exactly ${k} white checker${k === 1 ? "" : "s"}.`);
  }
  if (!distinctRows) {
    errors.push("No two white checkers may occupy the same row.");
  }
  if (!distinctColumns) {
    errors.push("No two white checkers may occupy the same column.");
  }
  if (!inBounds) {
    errors.push(`Every checker must lie on the ${n} × ${n} board.`);
  }
  if (distinctRows && distinctColumns && !vakilForm) {
    errors.push(
      "After sorting by increasing row, the columns must strictly decrease: (a₁,bₖ), …, (aₖ,b₁).",
    );
  }
  if (countCorrect && distinctRows && distinctColumns && vakilForm && !allHappy) {
    errors.push(
      "At least one initial white checker is unhappy, so Vakil's rule has no checker games for this input.",
    );
  }

  return {
    valid: countCorrect && distinctRows && distinctColumns && vakilForm && inBounds && allHappy,
    countCorrect,
    distinctRows,
    distinctColumns,
    vakilForm,
    inBounds,
    allHappy,
    A,
    B,
    errors,
  };
}

/** Partition corresponding to a k-subset in Vakil/Fulton's convention. */
export function partitionFromSubset(
  n: number,
  k: number,
  subsetInput: readonly number[],
): number[] {
  const subset = normalizeSubset(subsetInput);
  if (validateSubset(subset, n, k).length > 0) {
    throw new Error("Cannot convert an invalid subset to a partition.");
  }
  return subset.map((value, index) => n - k + (index + 1) - value);
}

export function formatSubset(subset: readonly number[]): string {
  return `{${subset.join(", ")}}`;
}

export function formatPartition(partition: readonly number[]): string {
  const nonzero = partition.filter((part) => part > 0);
  return nonzero.length === 0 ? "∅" : `(${nonzero.join(", ")})`;
}

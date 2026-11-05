import { validateFilledTableau, type FilledTableau } from "./inverseTableau.js";
import type { Position, TableauEvent } from "./types.js";
import { tableauFromEvents } from "./tableau.js";

export interface PipeDreamCrossing extends Position {
  readonly entry: number;
  readonly tableauRow: number;
  readonly tableauCol: number;
  readonly event?: TableauEvent;
}

export interface NumberedPipeDream {
  readonly n: number;
  readonly alphabetSize: number;
  readonly permutation: readonly number[];
  /** Unreflected coordinates: entry t in tableau box (a,b) gives (t,t+b-a). */
  readonly crossings: readonly PipeDreamCrossing[];
}

/** Kogan's diagonal convention (Knutson–Miller–Yong, Proposition 5.3).
 * The elbows connect west to south and north to east. Flipping its first k rows
 * gives the usual antidiagonal reduced-word convention for w(lambda,k).
 * Reflection for display is separate, so it never reverses the entry labels.
 */
export function pipeDreamFromTableau(rows: FilledTableau, k: number, n = Math.max(1, k + (rows[0]?.length ?? 0))): NumberedPipeDream {
  const errors = validateFilledTableau(rows);
  if (errors.length > 0) throw new Error(errors.join(" "));
  if (!Number.isSafeInteger(k) || k < 0 || rows.some((row, i) => row.length > 0 && (i >= k || row.some(entry => entry > k)))) {
    throw new Error("The pipe-dream alphabet must contain every tableau entry and row.");
  }
  if (!Number.isSafeInteger(n) || n < Math.max(1, k + (rows[0]?.length ?? 0))) {
    throw new Error("The pipe-dream board must fit the tableau's alphabet and width.");
  }
  const first = Array.from({ length: k }, (_, i) => i + 1 + (rows[k - i - 1]?.length ?? 0));
  const used = new Set(first);
  const permutation = [...first, ...Array.from({ length: n }, (_, i) => i + 1).filter(value => !used.has(value))];
  const crossings = rows.flatMap((row, a) => row.map((entry, b): PipeDreamCrossing => ({
    row: entry, col: entry + b - a, entry, tableauRow: a + 1, tableauCol: b + 1,
  })));
  return { n, alphabetSize: k, permutation, crossings };
}

export function pipeDreamFromEvents(events: readonly TableauEvent[], k: number, n: number): NumberedPipeDream {
  const rows = tableauFromEvents(events, k);
  const dream = pipeDreamFromTableau(rows.map(row => row.map(cell => cell.value)), k, n);
  return {
    ...dream,
    crossings: dream.crossings.map(crossing => ({
      ...crossing, event: rows[crossing.tableauRow - 1]![crossing.tableauCol - 1]!.event,
    })),
  };
}

/** Horizontal then vertical reflection in the full n × n checkerboard frame. */
export function reflectedPipeDreamCrossings(dream: NumberedPipeDream): PipeDreamCrossing[] {
  return dream.crossings.map(crossing => ({ ...crossing, row: dream.n + 1 - crossing.row, col: dream.n + 1 - crossing.col }));
}

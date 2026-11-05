import type { BranchAction, CheckerState, GameNode, GameTree, TableauEvent } from "./types.js";
import { filledTableauKey, validateFilledTableau, type FilledTableau } from "./inverseTableau.js";
import { analyzeWhiteMove, applyPhaseOne, performCleanup } from "./checkerRules.js";
import { buildSpecializationSchedule, initialBlackConfiguration } from "./specializationOrder.js";
import { initialWhiteConfiguration, validateInitialWhite } from "./validation.js";
import { createTableauEvent, tableauFromEvents, tableauValues } from "./tableau.js";
import { samePosition } from "./positions.js";
import { generateGameTree } from "./generateGames.js";

export interface MinimalTableauStart {
  readonly n: number;
  readonly k: number;
  readonly A: readonly number[];
  readonly B: readonly number[];
  readonly alpha: readonly number[];
  readonly gamma: readonly number[];
  readonly content: readonly number[];
  readonly deficits: readonly number[];
}

/** Minimum with EXACTLY k whites, via the alpha-dominant reverse row word.
 * See INVERSE_RESEARCH.md for the proof and the separately conjectural branch rule.
 */
export function minimalTableauStart(rows: FilledTableau, k = Math.max(1, ...rows.flat())): MinimalTableauStart {
  const errors = validateFilledTableau(rows);
  if (errors.length) throw new Error(errors.join(" "));
  if (!Number.isSafeInteger(k) || k < 1 || rows.some(row => row.some(value => value > k))) {
    throw new Error("k must be a positive integer at least as large as every entry.");
  }
  const content = Array<number>(k).fill(0);
  const deficits = Array<number>(k - 1).fill(0);
  for (const row of rows) for (const value of [...row].reverse()) {
    content[value - 1]!++;
    // Only this adjacent deficit can increase when the new letter is read.
    if (value > 1) {
      deficits[value - 2] = Math.max(deficits[value - 2]!, content[value - 1]! - content[value - 2]!);
    }
  }
  const alpha = Array<number>(k).fill(0);
  for (let j = k - 2; j >= 0; j--) alpha[j] = alpha[j + 1]! + deficits[j]!;
  const gamma = alpha.map((value, j) => value + content[j]!);
  const n = k + gamma[0]!;
  const A = alpha.map((value, j) => n - k + j + 1 - value);
  const B = Array.from({ length: k }, (_, j) => n - k + j + 1 - (rows[j]?.length ?? 0));
  if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) {
    throw new Error("The dominant-word starting-position formula produced an invalid start.");
  }
  return { n, k, A, B, alpha, gamma, content, deficits };
}

/** Proven inverse using the start formula and the existing forward engine.
 * Enumerates siblings at ONE known minimal start, never other starts or boards.
 * The experimental directTableauGame below avoids even sibling enumeration.
 */
export function tableauGameFromMinimalStart(
  rows: FilledTableau, k?: number, options: { maxNodes?: number } = {},
): { start: MinimalTableauStart; tree: GameTree; leaf: GameNode } {
  const start = minimalTableauStart(rows, k);
  const tree = generateGameTree(start.n, start.A, start.B, options);
  const key = filledTableauKey(rows);
  const matches = tree.leaves.filter(leaf => filledTableauKey(tableauValues(tableauFromEvents(leaf.state.tableauEvents, start.k))) === key);
  if (matches.length !== 1) throw new Error(`Expected one game for the dominant tableau; found ${matches.length}.`);
  return { start, tree, leaf: matches[0]! };
}

export interface DirectTableauGame {
  readonly start: MinimalTableauStart;
  readonly states: readonly CheckerState[];
  readonly actions: readonly BranchAction[];
  readonly tableauEvents: readonly TableauEvent[];
  readonly output: readonly number[];
}

/** Experimental direct inverse: one prescribed path, with no start or branch search.
 * At an unblocked B-beta decision let q be the diagonal white's row rank and c
 * its column rank. Swap iff the next unconsumed entry of row c is less than q.
 * Every dagger event and the final output are checked; mismatches throw rather
 * than silently returning a different tableau. This local rule is tested but
 * its general correctness is still a conjecture (see INVERSE_RESEARCH.md).
 */
export function directTableauGame(rows: FilledTableau, k?: number): DirectTableauGame {
  const start = minimalTableauStart(rows, k);
  const remaining = rows.map(row => [...row]);
  let white = initialWhiteConfiguration(start.A, start.B);
  const events: TableauEvent[] = [];
  const actions: BranchAction[] = [];
  const states: CheckerState[] = [{ n: start.n, k: start.k, step: 0, black: initialBlackConfiguration(start.n), white, tableauEvents: [] }];
  for (const move of buildSpecializationSchedule(start.n)) {
    const analysis = analyzeWhiteMove(white, move);
    let action = analysis.allowedActions[0]!;
    if (analysis.allowedActions.length === 2) {
      const diagonal = analysis.topWhiteInCriticalDiagonal!;
      const q = [...white].sort((a, b) => a.row - b.row).findIndex(checker => samePosition(checker, diagonal)) + 1;
      const c = [...white].sort((a, b) => a.col - b.col).findIndex(checker => samePosition(checker, diagonal)) + 1;
      const next = remaining[c - 1]?.at(-1);
      action = next !== undefined && next < q ? "swap" : "stay";
    }
    const cleanup = performCleanup(applyPhaseOne(white, analysis, action), move.after);
    if (analysis.dagger) {
      const rising = analysis.topWhiteInCriticalDiagonal!;
      const destination = cleanup.moves.find(slide => samePosition(slide.from, rising))?.to;
      if (destination === undefined) throw new Error("Dagger checker did not rise.");
      const event = createTableauEvent(move.step, white, rising, destination);
      if (remaining[event.tableauRow - 1]?.pop() !== event.entry) {
        throw new Error(`Conjectural direct inverse failed at recording step ${move.step}.`);
      }
      events.push(event);
    }
    white = cleanup.white;
    actions.push(action);
    states.push({ n: start.n, k: start.k, step: move.step, black: move.after, white, tableauEvents: [...events] });
  }
  if (remaining.some(row => row.length > 0)) throw new Error("Direct inverse left unrecorded tableau boxes.");
  const output = white.map(checker => checker.row).sort((a, b) => a - b);
  const expected = start.gamma.map((value, j) => start.n - start.k + j + 1 - value);
  if (white.some(checker => checker.row !== checker.col) || output.some((value, j) => value !== expected[j])) {
    throw new Error("Direct inverse terminal position disagrees with alpha + content.");
  }
  return { start, states, actions, tableauEvents: events, output };
}

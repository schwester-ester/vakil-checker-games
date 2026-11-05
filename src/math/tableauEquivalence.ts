import type { GameTree } from "./types.js";
import { generateGameTree } from "./generateGames.js";
import { enumerateSubsets, filledTableauKey } from "./inverseTableau.js";
import { generateTableauLadder } from "./tableauLadder.js";
import { tableauFromEvents, tableauValues } from "./tableau.js";
import { initialWhiteConfiguration, validateInitialWhite } from "./validation.js";

export interface EquivalentTableau {
  readonly key: string;
  readonly leafIds: readonly string[];
}
export interface EquivalenceRow {
  readonly tree: GameTree;
  readonly tableaux: readonly EquivalentTableau[];
}
export interface EquivalenceTable {
  readonly minBoardSize: number;
  readonly maxBoardSize: number;
  readonly k: number;
  readonly shape: readonly number[];
  readonly rows: readonly EquivalenceRow[];
  readonly tableauCount: number;
  readonly coveredCount: number;
}
export interface EquivalenceOptions {
  readonly maxBoardSize?: number;
  readonly maxTableaux?: number;
  readonly maxTotalNodes?: number;
  readonly maxNodesPerTree?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (n: number, starts: number, covered: number, total: number) => void;
}

/**
 * Fix EXACTLY k white checkers, even for fillings whose largest entry is below k.
 * Enumerate board sizes in increasing order. Record a tableau only on the first
 * size realizing it, but finish that entire size to retain ALL of its minimal
 * starts. Later boards may contain siblings already realized on smaller boards;
 * those siblings must not enter the equivalence row. Return once every filling
 * has its minimum established, retaining rows from all earlier board sizes.
 * Rows are incidence sets, not necessarily disjoint equivalence classes: the same
 * filling can arise from different A. A limit aborts, never publishes partial rows.
 */
export async function generateEquivalenceTable(
  shape: readonly number[], k: number, options: EquivalenceOptions = {},
): Promise<EquivalenceTable> {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error("Maximum entry k must be a positive integer.");
  const universe = generateTableauLadder(shape, k, options.maxTableaux ?? 500);
  if (universe.nodes.length === 0) throw new Error("No semistandard tableaux: the shape has more rows than k.");
  const minN = Math.max(1, k + (shape[0] ?? 0));
  const maxN = options.maxBoardSize ?? Math.max(10, minN);
  const maxTotalNodes = options.maxTotalNodes ?? 2_000_000;
  const maxNodesPerTree = options.maxNodesPerTree ?? 12_000;
  if (!Number.isSafeInteger(maxN) || maxN < minN) throw new Error(`The board must have size at least k + the first row length = ${minN}.`);
  if (!Number.isSafeInteger(maxTotalNodes) || maxTotalNodes < 1 || !Number.isSafeInteger(maxNodesPerTree) || maxNodesPerTree < 1) throw new Error("Search limits must be positive integers.");
  const allowed = new Set(universe.nodes.map((node) => node.id));
  const minima = new Map<string, number>();
  const rows: EquivalenceRow[] = [];
  const checkCancelled = (): void => { if (options.signal?.aborted) throw new Error("Equivalence analysis cancelled."); };
  let nodes = 0;
  checkCancelled();
  for (let n = minN; n <= maxN; n++) {
    const B = Array.from({ length: k }, (_, i) => n - k + i + 1 - (shape[i] ?? 0));
    let starts = 0;
    let lastYield = performance.now();
    options.onProgress?.(n, 0, minima.size, allowed.size);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    checkCancelled();
    for (const A of enumerateSubsets(n, k)) {
      checkCancelled();
      if (performance.now() - lastYield > 25) {
        options.onProgress?.(n, starts, minima.size, allowed.size);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        checkCancelled();
        lastYield = performance.now();
      }
      if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid) continue;
      if (nodes >= maxTotalNodes) throw new Error("Search state limit reached. Increase the limit and retry; no partial table is presented as complete.");
      const tree = generateGameTree(n, A, B, { maxNodes: Math.min(maxNodesPerTree, maxTotalNodes - nodes) });
      nodes += tree.nodeCount;
      starts++;
      const entries = new Map<string, string[]>();
      for (const leaf of tree.leaves) {
        const key = filledTableauKey(tableauValues(tableauFromEvents(leaf.state.tableauEvents, k)));
        if (!allowed.has(key)) throw new Error("A checker game recorded a tableau outside the specified shape and alphabet.");
        const minimum = minima.get(key);
        if (minimum !== undefined && minimum < n) continue;
        minima.set(key, n);
        const ids = entries.get(key) ?? [];
        ids.push(leaf.id);
        entries.set(key, ids);
      }
      if (entries.size > 0) rows.push({ tree, tableaux: [...entries].map(([key, leafIds]) => ({ key, leafIds })) });
    }
    options.onProgress?.(n, starts, minima.size, allowed.size);
    if (minima.size === allowed.size) {
      return { minBoardSize: rows[0]!.tree.n, maxBoardSize: n, k, shape: [...shape], rows, tableauCount: allowed.size, coveredCount: minima.size };
    }
  }
  throw new Error(`Minimum boards have not been established for every tableau through n=${maxN} with exactly ${k} white checkers. Raise the maximum board size; no incomplete table is shown.`);
}

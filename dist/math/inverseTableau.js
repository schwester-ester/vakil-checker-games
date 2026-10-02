import { generateGameTree } from "./generateGames.js";
import { tableauFromEvents, tableauValues } from "./tableau.js";
import { initialWhiteConfiguration, validateInitialWhite } from "./validation.js";
export function validateFilledTableau(rows) {
    const errors = [];
    if (rows.some((row, i) => i > 0 && row.length > rows[i - 1].length)) {
        errors.push("Row lengths must weakly decrease from top to bottom.");
    }
    if (rows.some((row) => row.some((value) => !Number.isSafeInteger(value) || value < 1))) {
        errors.push("Every cell must contain a positive integer.");
    }
    if (rows.some((row) => row.some((value, i) => i > 0 && value < row[i - 1]))) {
        errors.push("Entries must weakly increase from left to right.");
    }
    if (rows.some((row, i) => i > 0 && row.some((value, j) => value <= rows[i - 1][j]))) {
        errors.push("Entries must strictly increase down each column.");
    }
    return errors;
}
/** Ignore only trailing empty rows: they do not change a Young diagram. */
export function filledTableauKey(rows) {
    const normalized = rows.map((row) => [...row]);
    while (normalized.at(-1)?.length === 0)
        normalized.pop();
    return JSON.stringify(normalized);
}
function* subsets(n, k, start = 1, prefix = []) {
    if (prefix.length === k) {
        yield [...prefix];
        return;
    }
    for (let value = start; value <= n - (k - prefix.length) + 1; value += 1) {
        prefix.push(value);
        yield* subsets(n, k, value + 1, prefix);
        prefix.pop();
    }
}
/**
 * Exhaustive inverse of the existing forward map, without assuming an inverse formula.
 * Shape beta fixes B_i = n-k+i-beta_i. For each n, enumerate EVERY possible k and A.
 * Unhappy starts have no games. Finish the entire first board size with any matches.
 * Since no candidate on any smaller board is skipped, the returned n is minimal
 * (among positive board sizes). Within that n use increasing k,
 * lexicographic A to order all starting positions, keeping every matching leaf.
 * A resource limit aborts the whole search; it must never skip a candidate.
 */
export async function findMinimalTableauGames(rows, options = {}) {
    const errors = validateFilledTableau(rows);
    if (errors.length > 0)
        throw new Error(errors.join(" "));
    const shape = rows.map((row) => row.length);
    while (shape.at(-1) === 0)
        shape.pop();
    let largestEntry = 0;
    for (const row of rows)
        for (const value of row)
            largestEntry = Math.max(largestEntry, value);
    const minK = Math.max(shape.length, largestEntry);
    const width = shape[0] ?? 0;
    const minN = Math.max(1, minK + width);
    const maxN = options.maxBoardSize ?? Math.max(10, minN);
    const maxTotalNodes = options.maxTotalNodes ?? 500_000;
    const maxNodesPerTree = options.maxNodesPerTree ?? 12_000;
    if (!Number.isSafeInteger(maxN) || maxN < 1 ||
        !Number.isSafeInteger(maxTotalNodes) || maxTotalNodes < 1 ||
        !Number.isSafeInteger(maxNodesPerTree) || maxNodesPerTree < 1) {
        throw new Error("Search limits must be positive integers.");
    }
    const target = filledTableauKey(rows);
    let candidates = 0;
    let nodes = 0;
    let lastYield = performance.now();
    const checkCancelled = () => {
        if (options.signal?.aborted)
            throw new Error("Tableau search cancelled.");
    };
    checkCancelled();
    for (let n = minN; n <= maxN; n += 1) {
        const matches = [];
        options.onProgress?.(n, candidates);
        // Yield to paint progress and accept cancellation, including before the first tree.
        await new Promise((resolve) => setTimeout(resolve, 0));
        checkCancelled();
        for (let k = minK; k <= n - width; k += 1) {
            const B = Array.from({ length: k }, (_, i) => n - k + i + 1 - (shape[i] ?? 0));
            for (const A of subsets(n, k)) {
                checkCancelled();
                if (performance.now() - lastYield > 25) {
                    options.onProgress?.(n, candidates);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    checkCancelled();
                    lastYield = performance.now();
                }
                if (!validateInitialWhite(n, k, initialWhiteConfiguration(A, B)).valid)
                    continue;
                const remaining = maxTotalNodes - nodes;
                if (remaining < 1)
                    throw new Error("Search work limit reached. Increase the search effort and try again; the complete set of minimal starting positions has not been established.");
                // A BranchLimitError propagates: continuing would invalidate minimality.
                const tree = generateGameTree(n, A, B, { maxNodes: Math.min(maxNodesPerTree, remaining) });
                candidates += 1;
                nodes += tree.nodeCount;
                const leafIds = [];
                for (const leaf of tree.leaves) {
                    const values = tableauValues(tableauFromEvents(leaf.state.tableauEvents, k));
                    if (filledTableauKey(values) === target)
                        leafIds.push(leaf.id);
                }
                if (leafIds.length > 0)
                    matches.push({ tree, leafIds });
            }
        }
        if (matches.length > 0)
            return { n, matches, candidates };
    }
    throw new Error(`No matching game on boards of size 1 through ${maxN}. Increase the maximum board size; this does not mean the tableau has no corresponding game.`);
}
//# sourceMappingURL=inverseTableau.js.map
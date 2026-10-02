import { filledTableauKey, validateFilledTableau } from "./inverseTableau.js";
export function parseTableauShape(text) {
    if (text.trim() === "")
        return [];
    const parts = text.trim().split(/[\s,;]+/);
    if (parts.some((part) => !/^\d+$/.test(part)))
        throw new Error("Enter row lengths as positive integers, separated by commas or spaces.");
    const shape = parts.map(Number);
    if (shape.some((part, i) => !Number.isSafeInteger(part) || part < 1 || (i > 0 && part > shape[i - 1]))) {
        throw new Error("Row lengths must be positive and weakly decrease from top to bottom.");
    }
    return shape;
}
/**
 * Enumerate the entire cover graph of semistandard tableaux: each edge increases
 * exactly one cell by 1. The minimum filling puts r+1 in every cell of row r.
 * Every other tableau has a first cell in row order above that minimum; decreasing
 * it by 1 preserves semistandardness (its left/above neighbors are minimal).
 * Repeating reaches the minimum, proving that these upward moves reach every
 * filling. Deduplicate vertices but retain all incoming edges, including diamonds.
 */
export function generateTableauLadder(shape, maxEntry, maxTableaux = 200) {
    if (shape.some((length, i) => !Number.isSafeInteger(length) || length < 1 || (i > 0 && length > shape[i - 1]))) {
        throw new Error("Shape must have positive, weakly decreasing row lengths.");
    }
    if (!Number.isSafeInteger(maxEntry) || maxEntry < 1 || !Number.isSafeInteger(maxTableaux) || maxTableaux < 1) {
        throw new Error("Maximum entry and tableau limit must be positive integers.");
    }
    if (shape.reduce((sum, length) => sum + length, 0) > 200)
        throw new Error("Use at most 200 boxes per shape.");
    if (shape.length > maxEntry)
        return { shape: [...shape], maxEntry, nodes: [], edges: [] };
    const minimum = shape.map((length, r) => Array(length).fill(r + 1));
    const root = { id: filledTableauKey(minimum), rows: minimum, level: 0 };
    const nodes = [root];
    const seen = new Set([root.id]);
    const edges = [];
    for (let index = 0; index < nodes.length; index++) {
        const parent = nodes[index];
        parent.rows.forEach((row, r) => row.forEach((value, c) => {
            if (value >= maxEntry)
                return;
            const next = parent.rows.map((entries) => [...entries]);
            next[r][c] = value + 1;
            if (validateFilledTableau(next).length > 0)
                return;
            const id = filledTableauKey(next);
            if (!seen.has(id)) {
                if (nodes.length >= maxTableaux)
                    throw new Error(`This shape has more than ${maxTableaux} tableaux. Raise the tableau limit, reduce the maximum entry, or use a smaller shape. No truncated diagram is shown.`);
                seen.add(id);
                nodes.push({ id, rows: next, level: parent.level + 1 });
            }
            edges.push({ from: parent.id, to: id, row: r, col: c });
        }));
    }
    return { shape: [...shape], maxEntry, nodes, edges };
}
//# sourceMappingURL=tableauLadder.js.map
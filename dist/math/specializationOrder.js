import { clonePositions, compareByRowThenColumn, positionKey } from "./positions.js";
/**
 * Vakil's reduced word is read from the right:
 *   [n-1], [n-2,n-1], ..., [1,2,...,n-1].
 * Each e_j swaps the black checkers in adjacent rows j and j+1.
 */
export function specializationReflections(n) {
    if (!Number.isInteger(n) || n < 2) {
        throw new RangeError("Board size n must be an integer at least 2.");
    }
    const result = [];
    for (let start = n - 1; start >= 1; start -= 1) {
        for (let reflection = start; reflection <= n - 1; reflection += 1) {
            result.push(reflection);
        }
    }
    return result;
}
export function initialBlackConfiguration(n) {
    return Array.from({ length: n }, (_, index) => ({
        row: index + 1,
        col: n - index,
    }));
}
export function finalBlackConfiguration(n) {
    return Array.from({ length: n }, (_, index) => ({
        row: index + 1,
        col: index + 1,
    }));
}
export function permutationFromBlack(black) {
    const n = black.length;
    const permutation = Array(n).fill(0);
    for (const checker of black) {
        permutation[n - checker.col] = checker.row;
    }
    return permutation;
}
export function buildSpecializationSchedule(n) {
    let black = initialBlackConfiguration(n);
    const schedule = [];
    specializationReflections(n).forEach((simpleReflection, index) => {
        const byRow = new Map(black.map(({ row, col }) => [row, col]));
        const descendingColumn = byRow.get(simpleReflection);
        const risingColumn = byRow.get(simpleReflection + 1);
        if (descendingColumn === undefined || risingColumn === undefined) {
            throw new Error("Malformed black-checker configuration: a row is missing its checker.");
        }
        if (risingColumn >= descendingColumn) {
            throw new Error(`Specialization invariant failed at e_${simpleReflection}: the rising checker must lie left of the descending checker.`);
        }
        const descending = { row: simpleReflection, col: descendingColumn };
        const rising = { row: simpleReflection + 1, col: risingColumn };
        const criticalDiagonal = [];
        for (let offset = 0; offset < descendingColumn - risingColumn; offset += 1) {
            criticalDiagonal.push({
                row: simpleReflection + 1 + offset,
                col: risingColumn + offset,
            });
        }
        const beforeKeys = new Set(black.map(positionKey));
        for (const square of criticalDiagonal) {
            if (!beforeKeys.has(positionKey(square))) {
                throw new Error("The prescribed critical diagonal is not a diagonal of black checkers.");
            }
        }
        const after = black
            .map((checker) => {
            if (checker.row === descending.row && checker.col === descending.col) {
                return { row: checker.row + 1, col: checker.col };
            }
            if (checker.row === rising.row && checker.col === rising.col) {
                return { row: checker.row - 1, col: checker.col };
            }
            return { ...checker };
        })
            .sort(compareByRowThenColumn);
        schedule.push({
            step: index + 1,
            simpleReflection,
            before: clonePositions(black),
            after: clonePositions(after),
            descending,
            rising,
            criticalRow: simpleReflection,
            criticalDiagonal,
        });
        black = after;
    });
    const expectedFinal = finalBlackConfiguration(n).map(positionKey).join("|");
    const actualFinal = black.map(positionKey).join("|");
    if (expectedFinal !== actualFinal) {
        throw new Error("The specialization schedule did not terminate at the longest permutation.");
    }
    return schedule;
}
//# sourceMappingURL=specializationOrder.js.map
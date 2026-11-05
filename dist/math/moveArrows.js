import { samePosition } from "./positions.js";
import { pathToNode } from "./generateGames.js";
import { boardHistoryOptions } from "./boardHistory.js";
/** Match each move against the positions before that step, updating swaps simultaneously. */
export function pathsForNode(tree, node) {
    const paths = tree.root.state.white.map((start, checkerIndex) => ({
        checkerIndex, start, end: start, moves: [],
    }));
    for (const state of pathToNode(tree, node.id)) {
        if (state.moveInfo === undefined)
            continue;
        const updates = arrowsForMove(state.moveInfo).map((move) => {
            const path = paths.find((candidate) => samePosition(candidate.end, move.points[0]));
            if (path === undefined)
                throw new Error("A checker route lost its checker identity.");
            return { path, move };
        });
        for (const { path, move } of updates) {
            path.moves.push(move);
            path.end = move.points[move.points.length - 1];
        }
    }
    return paths;
}
export function boardMoveOptions(tree, node) {
    const moves = node.state.step === tree.schedule.length
        ? { movePaths: pathsForNode(tree, node) }
        : { moveArrows: node.moveInfo === undefined ? [] : arrowsForMove(node.moveInfo) };
    return { ...boardHistoryOptions(tree, node), ...moves };
}
/** Keep checker identity through the row swap and any subsequent cleanup. */
export function arrowsForMove(info) {
    const arrows = [];
    const consumed = new Set();
    if (info.action === "swap") {
        const critical = info.whiteInCriticalRow;
        const diagonal = info.topWhiteInCriticalDiagonal;
        for (const [from, to] of [
            [critical, { row: diagonal.row, col: critical.col }],
            [diagonal, { row: critical.row, col: diagonal.col }],
        ]) {
            const points = [from, to];
            info.cleanupMoves.forEach((cleanup, index) => {
                if (samePosition(points[points.length - 1], cleanup.from)) {
                    points.push(cleanup.to);
                    consumed.add(index);
                }
            });
            arrows.push({ kind: "swap", step: info.blackMove.step, points });
        }
    }
    info.cleanupMoves.forEach((cleanup, index) => {
        if (!consumed.has(index)) {
            arrows.push({ kind: cleanup.direction === "left" ? "west" : "north", step: info.blackMove.step, points: [cleanup.from, cleanup.to] });
        }
    });
    return arrows;
}
//# sourceMappingURL=moveArrows.js.map
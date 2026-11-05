import type { GameNode, GameTree, MoveInfo, Position } from "./types.js";
import { samePosition } from "./positions.js";
import { pathToNode } from "./generateGames.js";

export interface CheckerMoveArrow {
  readonly kind: "swap" | "west" | "north";
  readonly step: number;
  readonly points: readonly Position[];
}

export interface CheckerPath {
  readonly checkerIndex: number;
  readonly start: Position;
  readonly end: Position;
  readonly moves: readonly CheckerMoveArrow[];
}

/** Match each move against the positions before that step, updating swaps simultaneously. */
export function pathsForNode(tree: GameTree, node: GameNode): CheckerPath[] {
  const paths = tree.root.state.white.map((start, checkerIndex) => ({
    checkerIndex, start, end: start, moves: [] as CheckerMoveArrow[],
  }));
  for (const state of pathToNode(tree, node.id)) {
    if (state.moveInfo === undefined) continue;
    const updates = arrowsForMove(state.moveInfo).map((move) => {
      const path = paths.find((candidate) => samePosition(candidate.end, move.points[0]));
      if (path === undefined) throw new Error("A checker route lost its checker identity.");
      return { path, move };
    });
    for (const { path, move } of updates) {
      path.moves.push(move);
      path.end = move.points[move.points.length - 1]!;
    }
  }
  return paths;
}

export function boardMoveOptions(tree: GameTree, node: GameNode): {
  movePaths?: readonly CheckerPath[];
  moveArrows?: readonly CheckerMoveArrow[];
} {
  return node.state.step === tree.schedule.length
    ? { movePaths: pathsForNode(tree, node) }
    : { moveArrows: node.moveInfo === undefined ? [] : arrowsForMove(node.moveInfo) };
}

/** Keep checker identity through the row swap and any subsequent cleanup. */
export function arrowsForMove(info: MoveInfo): CheckerMoveArrow[] {
  const arrows: CheckerMoveArrow[] = [];
  const consumed = new Set<number>();
  if (info.action === "swap") {
    const critical = info.whiteInCriticalRow!;
    const diagonal = info.topWhiteInCriticalDiagonal!;
    for (const [from, to] of [
      [critical, { row: diagonal.row, col: critical.col }],
      [diagonal, { row: critical.row, col: diagonal.col }],
    ] as const) {
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

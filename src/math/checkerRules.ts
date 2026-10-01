import type {
  BlackMove,
  BranchAction,
  CleanupMove,
  DiagonalStatus,
  MoveAnalysis,
  Position,
  RowStatus,
  TableCase,
} from "./types.js";
import {
  clonePositions,
  compareByRowThenColumn,
  positionKey,
  samePosition,
} from "./positions.js";

export function isHappy(white: Position, black: readonly Position[]): boolean {
  const blackInColumn = black.find(({ col }) => col === white.col);
  const blackInRow = black.find(({ row }) => row === white.row);
  if (blackInColumn === undefined || blackInRow === undefined) {
    throw new Error("A black-checker configuration must have one checker in every row and column.");
  }
  return blackInColumn.row <= white.row && blackInRow.col <= white.col;
}

export function allHappy(white: readonly Position[], black: readonly Position[]): boolean {
  return white.every((checker) => isHappy(checker, black));
}

function tableCase(rowStatus: RowStatus, diagonalStatus: DiagonalStatus): TableCase {
  const rowLetter =
    diagonalStatus === "rising-square" ? "A" : diagonalStatus === "elsewhere" ? "B" : "C";
  const columnLetter =
    rowStatus === "descending-square" ? "alpha" : rowStatus === "elsewhere" ? "beta" : "gamma";
  return `${rowLetter}-${columnLetter}` as TableCase;
}

/** Exact, testable transcription of Vakil's Table 2. */
export function actionsForTableCase(
  rowStatus: RowStatus,
  diagonalStatus: DiagonalStatus,
  hasBlocker: boolean,
): readonly BranchAction[] {
  if (diagonalStatus === "rising-square") {
    return rowStatus === "none" ? ["stay"] : ["swap"];
  }
  if (diagonalStatus === "elsewhere") {
    if (rowStatus === "descending-square") {
      return ["swap"];
    }
    if (rowStatus === "elsewhere") {
      return hasBlocker ? ["stay"] : ["stay", "swap"];
    }
    return ["stay"];
  }
  return ["stay"];
}

export function findBlockers(
  first: Position,
  second: Position,
  white: readonly Position[],
): Position[] {
  const minRow = Math.min(first.row, second.row);
  const maxRow = Math.max(first.row, second.row);
  const minCol = Math.min(first.col, second.col);
  const maxCol = Math.max(first.col, second.col);
  return white
    .filter(
      (checker) =>
        checker.row > minRow &&
        checker.row < maxRow &&
        checker.col > minCol &&
        checker.col < maxCol,
    )
    .sort(compareByRowThenColumn);
}

export function analyzeWhiteMove(
  white: readonly Position[],
  blackMove: BlackMove,
): MoveAnalysis {
  const whiteInCriticalRow = white.find(({ row }) => row === blackMove.criticalRow);
  const diagonalKeys = new Set(blackMove.criticalDiagonal.map(positionKey));
  const whiteOnCriticalDiagonal = white
    .filter((checker) => diagonalKeys.has(positionKey(checker)))
    .sort(compareByRowThenColumn);
  const topWhiteInCriticalDiagonal = whiteOnCriticalDiagonal[0];

  const rowStatus: RowStatus = samePosition(whiteInCriticalRow, blackMove.descending)
    ? "descending-square"
    : whiteInCriticalRow === undefined
      ? "none"
      : "elsewhere";
  const diagonalStatus: DiagonalStatus = samePosition(
    topWhiteInCriticalDiagonal,
    blackMove.rising,
  )
    ? "rising-square"
    : topWhiteInCriticalDiagonal === undefined
      ? "none"
      : "elsewhere";

  const blockers =
    whiteInCriticalRow !== undefined && topWhiteInCriticalDiagonal !== undefined
      ? findBlockers(whiteInCriticalRow, topWhiteInCriticalDiagonal, white)
      : [];
  const allowedActions = actionsForTableCase(
    rowStatus,
    diagonalStatus,
    blockers.length > 0,
  );

  const base = {
    tableCase: tableCase(rowStatus, diagonalStatus),
    rowStatus,
    diagonalStatus,
    blockers,
    allowedActions,
    dagger: diagonalStatus === "rising-square" && rowStatus === "none",
  } satisfies Omit<MoveAnalysis, "whiteInCriticalRow" | "topWhiteInCriticalDiagonal">;

  return {
    ...base,
    ...(whiteInCriticalRow === undefined ? {} : { whiteInCriticalRow }),
    ...(topWhiteInCriticalDiagonal === undefined ? {} : { topWhiteInCriticalDiagonal }),
  };
}

export function applyPhaseOne(
  white: readonly Position[],
  analysis: MoveAnalysis,
  action: BranchAction,
): Position[] {
  if (!analysis.allowedActions.includes(action)) {
    throw new Error(`Action ${action} is not allowed in Table 2 case ${analysis.tableCase}.`);
  }
  if (action === "stay") {
    return clonePositions(white);
  }

  const critical = analysis.whiteInCriticalRow;
  const diagonal = analysis.topWhiteInCriticalDiagonal;
  if (critical === undefined || diagonal === undefined) {
    throw new Error("A swap requires both the critical-row and critical-diagonal white checkers.");
  }

  return white
    .filter(
      (checker) =>
        !samePosition(checker, critical) && !samePosition(checker, diagonal),
    )
    .concat([
      { row: diagonal.row, col: critical.col },
      { row: critical.row, col: diagonal.col },
    ])
    .sort(compareByRowThenColumn);
}

function cleanupCandidates(
  checker: Position,
  white: readonly Position[],
  black: readonly Position[],
): Position[] {
  const other = white.filter((position) => !samePosition(position, checker));
  const occupiedRows = new Set(other.map(({ row }) => row));
  const occupiedColumns = new Set(other.map(({ col }) => col));
  const candidates: Position[] = [];

  for (let col = 1; col < checker.col; col += 1) {
    const candidate = { row: checker.row, col };
    if (!occupiedColumns.has(col) && isHappy(candidate, black)) {
      candidates.push(candidate);
    }
  }
  for (let row = 1; row < checker.row; row += 1) {
    const candidate = { row, col: checker.col };
    if (!occupiedRows.has(row) && isHappy(candidate, black)) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

/**
 * Vakil's Phase 2: repeatedly slide each unhappy checker left or up. On every legal
 * checker-game state the legal destination is unique; the assertion below makes that
 * uniqueness part of the executable specification rather than an untested assumption.
 */
export function performCleanup(
  phaseOneWhite: readonly Position[],
  nextBlack: readonly Position[],
): { white: Position[]; moves: CleanupMove[] } {
  let white = clonePositions(phaseOneWhite);
  const moves: CleanupMove[] = [];

  while (true) {
    const unhappy = white.filter((checker) => !isHappy(checker, nextBlack));
    if (unhappy.length === 0) {
      return { white, moves };
    }

    const checker = unhappy.sort(compareByRowThenColumn)[0]!;
    const candidates = cleanupCandidates(checker, white, nextBlack);
    if (candidates.length !== 1) {
      const candidateText = candidates.map(positionKey).join("; ") || "none";
      throw new Error(
        `Phase 2 uniqueness failed for ${positionKey(checker)}; candidates: ${candidateText}.`,
      );
    }

    const destination = candidates[0]!;
    const direction: CleanupMove["direction"] =
      destination.row === checker.row ? "left" : "up";
    moves.push({ from: { ...checker }, to: { ...destination }, direction });
    white = white
      .filter((position) => !samePosition(position, checker))
      .concat([{ ...destination }])
      .sort(compareByRowThenColumn);
  }
}

export function explainMove(
  analysis: MoveAnalysis,
  action: BranchAction,
  cleanupMoves: readonly CleanupMove[],
): string {
  const rowDescription =
    analysis.rowStatus === "descending-square"
      ? "The critical-row white checker is on the descending black checker."
      : analysis.rowStatus === "elsewhere"
        ? "The critical row contains a white checker away from the descending black checker."
        : "The critical row contains no white checker.";
  const diagonalDescription =
    analysis.diagonalStatus === "rising-square"
      ? "The top white checker on the critical diagonal is on the rising black checker."
      : analysis.diagonalStatus === "elsewhere"
        ? "The top white checker on the critical diagonal lies farther southeast."
        : "There is no white checker on the critical diagonal.";

  let decision: string;
  if (analysis.tableCase === "B-beta") {
    if (analysis.blockers.length > 0) {
      decision = "A blocker lies strictly inside the rectangle, so Table 2 forces stay.";
    } else {
      decision = `There is no blocker, so Table 2 permits both branches; this branch chooses ${action}.`;
    }
  } else if (analysis.dagger) {
    decision = "This is the dagger case A-γ: Phase 1 stays and records one tableau entry.";
  } else {
    decision = `Table 2 case ${analysis.tableCase.replace("-", "-")} forces ${action}.`;
  }

  const cleanup =
    cleanupMoves.length === 0
      ? "No Phase 2 cleanup is needed."
      : `Phase 2 makes the unique ${cleanupMoves[0]!.direction} slide to restore happiness.`;
  return `${rowDescription} ${diagonalDescription} ${decision} ${cleanup}`;
}

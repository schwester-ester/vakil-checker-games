import type { GameNode, GameTree, Position } from "./types.js";
import { pipeDreamFromEvents, type NumberedPipeDream } from "./pipeDream.js";

export interface RecordedCriticalSquare extends Position {
  readonly entry: number;
  readonly step: number;
}

export interface BoardHistoryOptions {
  readonly initialWhite?: readonly Position[];
  readonly criticalSquares?: readonly RecordedCriticalSquare[];
  readonly pipeDream?: NumberedPipeDream;
}

/** Recording history belongs to this path; initial outlines belong only to outputs. */
export function boardHistoryOptions(tree: GameTree, node: GameNode): BoardHistoryOptions {
  return {
    ...(node.state.step === tree.schedule.length ? {
      initialWhite: tree.root.state.white,
      pipeDream: pipeDreamFromEvents(node.state.tableauEvents, tree.k, tree.n),
    } : {}),
    criticalSquares: node.state.tableauEvents.map((event) => ({
      ...tree.schedule[event.step - 1]!.descending,
      entry: event.entry,
      step: event.step,
    })),
  };
}

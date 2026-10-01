export interface Position {
  readonly row: number;
  readonly col: number;
}

export type BranchAction = "stay" | "swap";
export type RowStatus = "descending-square" | "elsewhere" | "none";
export type DiagonalStatus = "rising-square" | "elsewhere" | "none";
export type TableCase =
  | "A-alpha"
  | "A-beta"
  | "A-gamma"
  | "B-alpha"
  | "B-beta"
  | "B-gamma"
  | "C-alpha"
  | "C-beta"
  | "C-gamma";

export interface BlackMove {
  readonly step: number;
  readonly simpleReflection: number;
  readonly before: readonly Position[];
  readonly after: readonly Position[];
  readonly descending: Position;
  readonly rising: Position;
  readonly criticalRow: number;
  readonly criticalDiagonal: readonly Position[];
}

export interface TableauEvent {
  readonly id: string;
  readonly step: number;
  readonly entry: number;
  readonly tableauRow: number;
  readonly rowRank: number;
  readonly columnRank: number;
  readonly checkerBefore: Position;
  readonly checkerAfter: Position;
}

export interface CleanupMove {
  readonly from: Position;
  readonly to: Position;
  readonly direction: "left" | "up";
}

export interface MoveAnalysis {
  readonly tableCase: TableCase;
  readonly rowStatus: RowStatus;
  readonly diagonalStatus: DiagonalStatus;
  readonly whiteInCriticalRow?: Position;
  readonly topWhiteInCriticalDiagonal?: Position;
  readonly blockers: readonly Position[];
  readonly allowedActions: readonly BranchAction[];
  readonly dagger: boolean;
}

export interface MoveInfo extends MoveAnalysis {
  readonly action: BranchAction;
  readonly phase1Before: readonly Position[];
  readonly phase1After: readonly Position[];
  readonly cleanupMoves: readonly CleanupMove[];
  readonly explanation: string;
  readonly blackMove: BlackMove;
  readonly tableauEvent?: TableauEvent;
}

export interface CheckerState {
  readonly n: number;
  readonly k: number;
  readonly step: number;
  readonly black: readonly Position[];
  readonly white: readonly Position[];
  readonly tableauEvents: readonly TableauEvent[];
}

export interface GameNode {
  readonly id: string;
  readonly parentId?: string;
  readonly branchLabel?: BranchAction;
  readonly state: CheckerState;
  readonly moveInfo?: MoveInfo;
  readonly children: readonly GameNode[];
}

export interface GameTree {
  readonly n: number;
  readonly k: number;
  readonly A: readonly number[];
  readonly B: readonly number[];
  readonly root: GameNode;
  readonly nodesById: ReadonlyMap<string, GameNode>;
  readonly leaves: readonly GameNode[];
  readonly schedule: readonly BlackMove[];
  readonly nodeCount: number;
}

export interface InitialValidation {
  readonly valid: boolean;
  readonly countCorrect: boolean;
  readonly distinctRows: boolean;
  readonly distinctColumns: boolean;
  readonly vakilForm: boolean;
  readonly inBounds: boolean;
  readonly allHappy: boolean;
  readonly A: readonly number[];
  readonly B: readonly number[];
  readonly errors: readonly string[];
}

export interface TableauCell {
  readonly value: number;
  readonly event: TableauEvent;
}

export type TableauRows = readonly (readonly TableauCell[])[];

import type { GameNode, Position } from "../math/types.js";
import { formatPosition } from "../math/positions.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { element } from "./dom.js";

export interface GameInspectorOptions {
  readonly node: GameNode;
  readonly totalSteps: number;
  readonly showAnnotations: boolean;
  readonly debug: boolean;
}

function positionList(positions: readonly Position[]): string {
  return positions.length === 0 ? "none" : positions.map(formatPosition).join(", ");
}

function detail(label: string, value: string, emphasis = false): HTMLElement {
  const row = element("div", { className: `inspector-detail${emphasis ? " inspector-detail--emphasis" : ""}` });
  row.append(
    element("dt", { text: label }),
    element("dd", { text: value }),
  );
  return row;
}

export function createGameInspector(options: GameInspectorOptions): HTMLElement {
  const aside = element("aside", {
    className: "inspector panel-card",
    attributes: { "aria-labelledby": "inspector-heading" },
  });
  aside.append(
    element("p", { className: "eyebrow", text: "Selected state" }),
    element("h2", {
      className: "panel-title",
      text: options.node.state.step === 0 ? "Initial position" : `Move ${options.node.state.step}`,
      attributes: { id: "inspector-heading" },
    }),
    element("p", {
      className: "inspector-progress",
      text: `Step ${options.node.state.step} of ${options.totalSteps}`,
    }),
  );

  const info = options.node.moveInfo;
  if (info === undefined) {
    aside.append(
      createCheckerBoard({
        n: options.node.state.n,
        black: options.node.state.black,
        white: options.node.state.white,
        pixelSize: 300,
        showLabels: true,
      }),
      element("p", {
        className: "inspector-intro",
        text: "The black checkers begin on the northeast–southwest diagonal. Select a later node to inspect its Table 2 case and cleanup move.",
      }),
    );
    return aside;
  }

  const boardPair = element("div", { className: "inspector-board-pair" });
  const before = element("figure", { className: "inspector-board" });
  before.append(
    createCheckerBoard({
      n: options.node.state.n,
      black: info.blackMove.before,
      white: info.phase1Before,
      pixelSize: 250,
      showLabels: true,
      ...(options.showAnnotations
        ? { annotations: { blackMove: info.blackMove, blockers: info.blockers } }
        : {}),
    }),
    element("figcaption", { text: "Before the black move" }),
  );
  const after = element("figure", { className: "inspector-board" });
  after.append(
    createCheckerBoard({
      n: options.node.state.n,
      black: options.node.state.black,
      white: options.node.state.white,
      pixelSize: 250,
      showLabels: true,
    }),
    element("figcaption", { text: "After Phase 2" }),
  );
  boardPair.append(before, after);
  aside.append(boardPair);

  const details = element("dl", { className: "inspector-details" });
  details.append(
    detail("Simple reflection", `e${info.blackMove.simpleReflection}`),
    detail("Descending black checker", formatPosition(info.blackMove.descending)),
    detail("Rising black checker", formatPosition(info.blackMove.rising)),
    detail("Critical row", String(info.blackMove.criticalRow)),
    detail("Critical diagonal", positionList(info.blackMove.criticalDiagonal)),
    detail("Table 2 case", info.tableCase, true),
    detail("Critical-row white checker", info.whiteInCriticalRow === undefined ? "none" : formatPosition(info.whiteInCriticalRow)),
    detail("Top critical-diagonal white", info.topWhiteInCriticalDiagonal === undefined ? "none" : formatPosition(info.topWhiteInCriticalDiagonal)),
    detail("Blocker", info.blockers.length === 0 ? "no" : `yes: ${positionList(info.blockers)}`),
    detail("Phase 1", info.action),
    detail(
      "Phase 2",
      info.cleanupMoves.length === 0
        ? "no cleanup"
        : info.cleanupMoves
            .map((move) => `${formatPosition(move.from)} → ${formatPosition(move.to)} (${move.direction})`)
            .join("; "),
    ),
    detail(
      "Tableau event",
      info.tableauEvent === undefined
        ? "none"
        : `entry ${info.tableauEvent.entry} in tableau row ${info.tableauEvent.tableauRow}`,
    ),
  );
  aside.append(details);

  if (options.debug) {
    const explanation = element("div", { className: "explanation-box" });
    explanation.append(
      element("h3", { text: "Explain this move" }),
      element("p", { text: info.explanation }),
    );
    aside.append(explanation);
  }

  return aside;
}

import type { GameNode, GameTree, TableauEvent } from "../math/types.js";
import {
  formalOutput,
  groupLeavesByOutput,
  outputSubset,
} from "../math/generateGames.js";
import {
  formatPartition,
  formatSubset,
  partitionFromSubset,
} from "../math/validation.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { createTableau } from "./Tableau.js";
import { button, element } from "./dom.js";

export interface FinalResultsOptions {
  readonly tree: GameTree;
  readonly onInspectLeaf: (leafId: string) => void;
  readonly onTableauEvent: (leafId: string, event: TableauEvent) => void;
}

function gameCard(
  tree: GameTree,
  leaf: GameNode,
  gameNumber: number,
  onInspectLeaf: (leafId: string) => void,
  onTableauEvent: (leafId: string, event: TableauEvent) => void,
): HTMLElement {
  const output = outputSubset(leaf);
  const gamma = partitionFromSubset(tree.n, tree.k, output);
  const card = element("article", { className: "game-card" });
  const header = element("div", { className: "game-card-header" });
  const title = element("div");
  title.append(
    element("p", { className: "eyebrow", text: `Game ${gameNumber}` }),
    element("h4", { text: `Output S = ${formatSubset(output)}` }),
  );
  header.append(
    title,
    button("Trace this game", () => onInspectLeaf(leaf.id), "button button--small"),
  );

  const content = element("div", { className: "game-card-content" });
  const boardFigure = element("figure", { className: "result-board" });
  boardFigure.append(
    createCheckerBoard({
      n: tree.n,
      black: leaf.state.black,
      white: leaf.state.white,
      pixelSize: Math.min(280, tree.n * 34 + 34),
      showLabels: true,
    }),
    element("figcaption", { text: `λ(S) = ${formatPartition(gamma)}` }),
  );
  const tableauFigure = element("figure", { className: "result-tableau" });
  tableauFigure.append(
    element("figcaption", { text: "Section 2.6 tableau" }),
    createTableau({
      events: leaf.state.tableauEvents,
      rowCount: tree.k,
      showRowLabels: true,
      onCellClick: (event) => onTableauEvent(leaf.id, event),
    }),
    element("p", {
      className: "tableau-help",
      text: "Click an entry to inspect the † move that created it.",
    }),
  );
  content.append(boardFigure, tableauFigure);
  card.append(header, content);
  return card;
}

export function createFinalResults(options: FinalResultsOptions): HTMLElement {
  const section = element("section", { className: "final-results" });
  const summary = element("div", { className: "results-summary panel-card" });
  summary.append(
    element("p", { className: "eyebrow", text: "Formal checker-game output" }),
    element("h2", { className: "formal-output", text: formalOutput(options.tree.leaves) }),
    element("p", {
      className: "results-meta",
      text: `${options.tree.leaves.length} terminal checker game${options.tree.leaves.length === 1 ? "" : "s"}; paths with the same output remain distinct.`,
    }),
  );
  section.append(summary);

  const indexById = new Map(options.tree.leaves.map((leaf, index) => [leaf.id, index + 1]));
  const groups = groupLeavesByOutput(options.tree.leaves);
  for (const group of groups) {
    const groupSection = element("section", { className: "output-group panel-card" });
    const groupHeading = element("div", { className: "output-group-heading" });
    groupHeading.append(
      element("div", {
        className: "output-subset",
        text: `S = ${formatSubset(group.subset)}`,
      }),
      element("span", {
        className: "multiplicity-badge",
        text: `multiplicity ${group.leaves.length}`,
      }),
    );
    const cards = element("div", { className: "game-card-grid" });
    for (const leaf of group.leaves) {
      cards.append(
        gameCard(
          options.tree,
          leaf,
          indexById.get(leaf.id) ?? 0,
          options.onInspectLeaf,
          options.onTableauEvent,
        ),
      );
    }
    groupSection.append(groupHeading, cards);
    section.append(groupSection);
  }
  return section;
}

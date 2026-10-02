import type { TableauSearchResult } from "../math/inverseTableau.js";
import type { TableauLadder, LadderNode } from "../math/tableauLadder.js";
import type { TableauEvent } from "../math/types.js";
import { formatSubset } from "../math/validation.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { createTableau } from "./Tableau.js";
import { button, element, labelledControl, svgElement } from "./dom.js";

export interface ShapeAnalysis {
  id: number;
  text: string;
  ladder: TableauLadder | undefined;
  error: string | undefined;
  games: Map<string, TableauSearchResult | string>;
  selections: Map<string, number>;
  scale: number;
}
export interface TableauLaddersOptions {
  readonly shapes: readonly ShapeAnalysis[];
  readonly maxEntry: number;
  readonly maxTableaux: number;
  readonly maxBoard: number;
  readonly effort: number;
  readonly searching: boolean;
  readonly status: string;
  readonly onAdd: () => void;
  readonly onRemove: (id: number) => void;
  readonly onShape: (id: number, text: string) => void;
  readonly onMaxEntry: (value: number) => void;
  readonly onLimit: (value: number) => void;
  readonly onMaxBoard: (value: number) => void;
  readonly onEffort: (value: number) => void;
  readonly onGenerate: () => void;
  readonly onCancel: () => void;
  readonly onGame: (rows: LadderNode["rows"], result: TableauSearchResult, matchIndex: number, leafId: string) => void;
  readonly onEvent: (rows: LadderNode["rows"], result: TableauSearchResult, matchIndex: number, leafId: string, event: TableauEvent) => void;
}

export function createLadderNodeContent(shape: ShapeAnalysis, node: LadderNode, options: TableauLaddersOptions): HTMLElement {
  const content = element("div", { className: "ladder-node-content" });
  const result = shape.games.get(node.id);
  if (result === undefined || typeof result === "string") {
    const tableau = element("div", { className: "tableau tableau--compact" });
    if (node.rows.length === 0) tableau.append(element("span", { className: "empty-tableau", text: "∅" }));
    for (const row of node.rows) {
      const rowElement = element("div", { className: "tableau-row" });
      for (const value of row) rowElement.append(element("span", { className: "tableau-cell", text: String(value) }));
      tableau.append(rowElement);
    }
    content.append(tableau, element("p", { className: typeof result === "string" ? "ladder-node-error" : "tableau-help", text: typeof result === "string" ? result : "Checker games pending. Generate or resume the analysis to trace entries." }));
    return content;
  }
  const games = result.matches.flatMap((match, matchIndex) => match.leafIds.map((leafId) => ({ match, matchIndex, leafId })));
  const selectedIndex = Math.min(shape.selections.get(node.id) ?? 0, games.length - 1);
  const selected = games[selectedIndex]!;
  const leaf = selected.match.tree.nodesById.get(selected.leafId)!;
  content.append(createTableau({
    events: leaf.state.tableauEvents, rowCount: selected.match.tree.k, compact: true,
    onCellClick: (event) => options.onEvent(node.rows, result, selected.matchIndex, selected.leafId, event),
  }));
  content.append(element("p", { className: "ladder-board-summary", text: `Smallest board: ${result.n} × ${result.n} · ${games.length} matching game${games.length === 1 ? "" : "s"}` }));
  if (games.length > 1) {
    const select = element("select", { className: "speed-select", attributes: { "aria-label": "Game used to trace tableau entries" } });
    games.forEach((_, i) => {
      const option = element("option", { text: `Trace entries using Game ${i + 1}`, attributes: { value: String(i) } });
      option.selected = i === selectedIndex;
      select.append(option);
    });
    select.addEventListener("change", () => {
      shape.selections.set(node.id, Number(select.value));
      content.replaceWith(createLadderNodeContent(shape, node, options));
    });
    content.append(select);
  }
  const list = element("div", { className: "ladder-games" });
  games.forEach(({ match, matchIndex, leafId }, gameIndex) => {
    const game = button("", () => {
      shape.selections.set(node.id, gameIndex);
      options.onGame(node.rows, result, matchIndex, leafId);
    }, "ladder-game");
    game.setAttribute("aria-label", `Explore starting position of Game ${gameIndex + 1}`);
    game.append(
      createCheckerBoard({ n: result.n, black: match.tree.root.state.black, white: match.tree.root.state.white, compact: true, showLabels: false, pixelSize: 64 }),
      element("span", { text: `Game ${gameIndex + 1} · k=${match.tree.k}\nA=${formatSubset(match.tree.A)}\nB=${formatSubset(match.tree.B)}` }),
    );
    list.append(game);
  });
  content.append(list);
  return content;
}

function createDiagram(shape: ShapeAnalysis, options: TableauLaddersOptions): HTMLElement {
  const diagram = element("div", { className: "ladder-diagram" });
  const ladder = shape.ladder!;
  if (ladder.nodes.length === 0) {
    diagram.append(element("p", { className: "validation-message", text: "No semistandard tableaux: a column taller than the maximum entry cannot be filled strictly increasingly." }));
    return diagram;
  }
  const levels: LadderNode[][] = [];
  for (const node of ladder.nodes) (levels[node.level] ??= []).push(node);
  const cardWidth = Math.max(250, (ladder.shape[0] ?? 0) * 28 + 32);
  const cardHeight = 250 + Math.max(1, ladder.shape.length) * 28;
  const gapX = 100, gapY = 36;
  const width = levels.length * (cardWidth + gapX) + 32;
  const height = Math.max(...levels.map((level) => level.length)) * (cardHeight + gapY) + 32;
  const positions = new Map<string, { x: number; y: number }>();
  levels.forEach((level, depth) => level.forEach((node, i) => positions.set(node.id, {
    x: 16 + depth * (cardWidth + gapX),
    y: (height - level.length * (cardHeight + gapY) + gapY) / 2 + i * (cardHeight + gapY),
  })));
  const viewport = element("div", { className: "ladder-viewport", attributes: { "data-ladder-viewport": String(shape.id), tabindex: "0", "aria-label": `Ladder diagram for shape ${shape.text || "empty"}; scroll to explore` } });
  const stage = element("div", { className: "ladder-stage" });
  const canvas = element("div", { className: "ladder-canvas" });
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const edges = svgElement("svg", { class: "ladder-edges", width, height, "aria-label": "Ladder moves: each edge increases one entry by 1" });
  for (const edge of ladder.edges) {
    const from = positions.get(edge.from)!, to = positions.get(edge.to)!;
    const x1 = from.x + cardWidth, y1 = from.y + cardHeight / 2;
    const x2 = to.x, y2 = to.y + cardHeight / 2;
    const path = svgElement("path", { d: `M${x1},${y1} C${x1 + gapX / 2},${y1} ${x2 - gapX / 2},${y2} ${x2},${y2}`, class: "flow-edge" });
    const title = svgElement("title");
    title.textContent = `Increase row ${edge.row + 1}, column ${edge.col + 1} by 1`;
    path.append(title);
    const label = svgElement("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2, "text-anchor": "middle", class: "flow-edge-label" });
    label.textContent = `+1 (${edge.row + 1},${edge.col + 1})`;
    edges.append(path, label);
  }
  canvas.append(edges);
  ladder.nodes.forEach((node, index) => {
    const position = positions.get(node.id)!;
    const card = element("article", { className: "ladder-node", attributes: { "data-ladder-node": `${shape.id}-${index}`, "aria-label": `Tableau ${index + 1}, ladder level ${node.level}` } });
    Object.assign(card.style, { left: `${position.x}px`, top: `${position.y}px`, width: `${cardWidth}px`, height: `${cardHeight}px` });
    card.append(element("p", { className: "eyebrow", text: `Tableau ${index + 1} · level ${node.level}` }), createLadderNodeContent(shape, node, options));
    canvas.append(card);
  });
  stage.append(canvas);
  viewport.append(stage);
  const scale = (): void => {
    canvas.style.transform = `scale(${shape.scale})`;
    stage.style.width = `${width * shape.scale}px`;
    stage.style.height = `${height * shape.scale}px`;
  };
  scale();
  const toolbar = element("div", { className: "flow-toolbar" });
  toolbar.append(
    button("Zoom in", () => { shape.scale = Math.min(1.5, shape.scale * 1.2); scale(); }, "button button--small"),
    button("Zoom out", () => { shape.scale = Math.max(0.15, shape.scale / 1.2); scale(); }, "button button--small"),
    button("Fit width", () => { shape.scale = Math.max(0.15, Math.min(1, (viewport.clientWidth || 600) / width)); scale(); }, "button button--small"),
    button("Fit height", () => { shape.scale = Math.max(0.15, Math.min(1, (viewport.clientHeight || 680) / height)); scale(); }, "button button--small"),
    element("span", { className: "toolbar-note", text: `${ladder.nodes.length} tableaux · ${ladder.edges.length} ladder moves · scroll to explore` }),
  );
  diagram.append(toolbar, viewport);
  return diagram;
}

export function createTableauLadders(options: TableauLaddersOptions): HTMLElement {
  const section = element("section", { className: "input-card panel-card", attributes: { id: "tableau-ladders", "aria-labelledby": "ladder-heading" } });
  section.append(element("p", { className: "eyebrow", text: "Compare shapes" }), element("h2", { className: "panel-title", text: "Tableau ladders & checker games", attributes: { id: "ladder-heading" } }), element("p", { className: "tableau-input-intro", text: "Choose row lengths and a shared maximum entry. Generate every semistandard filling, connected by moves that increase exactly one box by 1. Paths can join: each tableau appears once, with all legal ladder moves shown. Under each tableau are all corresponding games on its smallest board. Click a checkerboard to explore its starting position, or a tableau entry to inspect its recording move." }));
  const settings = element("div", { className: "setup-controls" });
  function numeric(label: string, value: number, min: number, max: number, callback: (value: number) => void): HTMLLabelElement {
    const input = element("input", { className: "number-input", attributes: { type: "number", min: String(min), max: String(max), value: String(value), "aria-label": label } });
    input.disabled = options.searching;
    let lastValid = value;
    input.addEventListener("change", () => { const next = Number(input.value); if (Number.isSafeInteger(next) && next >= min && next <= max) { lastValid = next; callback(next); } else input.value = String(lastValid); });
    return labelledControl(label, input);
  }
  settings.append(numeric("Shared maximum entry", options.maxEntry, 1, 30, options.onMaxEntry));
  const generate = button(options.searching ? "Generating ladders…" : "Generate tableaux & games", options.onGenerate, "button button--primary");
  generate.disabled = options.searching || options.shapes.length === 0;
  settings.append(generate);
  if (options.searching) settings.append(button("Cancel analysis", options.onCancel));
  const limits = element("details", { className: "ladder-search-limits" });
  limits.append(element("summary", { text: "Analysis limits" }), numeric("Tableaux per shape", options.maxTableaux, 1, 2000, options.onLimit), numeric("Ladder search up to n", options.maxBoard, 1, 30, options.onMaxBoard), numeric("Search states per tableau", options.effort, 1, 10_000_000, options.onEffort), element("p", { className: "field-help", text: "Each tableau uses a complete minimum-board search. Interrupted or bounded searches are labeled, never presented as complete. Change limits and generate again to retry. Individual game trees use the states-per-game-tree limit in the filled-tableau section above." }));
  section.append(settings, limits, element("p", { text: options.status, className: "tableau-search-status", attributes: { id: "ladder-status", role: "status", "aria-live": "polite" } }));
  const comparisons = element("div", { className: "ladder-comparisons" });
  for (const shape of options.shapes) {
    const panel = element("section", { className: "ladder-shape-panel", attributes: { "data-ladder-shape": String(shape.id) } });
    const header = element("div", { className: "panel-heading-row" });
    const input = element("input", { className: "subset-input", attributes: { type: "text", value: shape.text, placeholder: "2, 1", "aria-label": `Row lengths for comparison shape ${shape.id}` } });
    input.disabled = options.searching;
    input.addEventListener("input", () => options.onShape(shape.id, input.value));
    header.append(labelledControl("Row lengths (blank = empty shape)", input), button("Remove shape", () => options.onRemove(shape.id), "button button--small"));
    panel.append(header);
    if (shape.error !== undefined) panel.append(element("p", { className: "generation-error", text: shape.error, attributes: { role: "alert" } }));
    if (shape.ladder !== undefined) panel.append(createDiagram(shape, options));
    comparisons.append(panel);
  }
  section.append(comparisons, button("+ Add another shape", options.onAdd));
  return section;
}

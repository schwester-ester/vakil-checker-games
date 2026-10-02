import type { GameNode, GameTree, Position, TableauEvent } from "./math/types.js";
import {
  BranchLimitError,
  firstLeafBelow,
  generateGameTree,
  pathToNode,
} from "./math/generateGames.js";
import { positionKey } from "./math/positions.js";
import { initialBlackConfiguration } from "./math/specializationOrder.js";
import {
  inferSubsetsFromWhite,
  initialWhiteConfiguration,
  parseSubset,
  validateInitialWhite,
  validateSubset,
} from "./math/validation.js";
import { createFinalResults } from "./components/FinalResults.js";
import { createGameInspector } from "./components/GameInspector.js";
import {
  createGameTree,
  type FlowTransform,
} from "./components/GameTree.js";
import {
  createInputPanel,
  type InputMode,
} from "./components/InputPanel.js";
import { button, element, labelledControl } from "./components/dom.js";
import { createTableauInput } from "./components/TableauInput.js";
import { findMinimalTableauGames, type TableauMatch, type TableauSearchResult } from "./math/inverseTableau.js";
import { createCheckerBoard } from "./components/CheckerBoard.js";
import { formatSubset } from "./math/validation.js";
import { generateTableauLadder, parseTableauShape } from "./math/tableauLadder.js";
import { createLadderNodeContent, createTableauLadders, type ShapeAnalysis, type TableauLaddersOptions } from "./components/TableauLadders.js";

let nextShapeId = 2;
const ladders = {
  shapes: [{ id: 1, text: "2, 1", ladder: undefined, error: undefined, games: new Map(), selections: new Map(), scale: 0.8 }] as ShapeAnalysis[],
  maxEntry: 3,
  maxTableaux: 200,
  maxBoard: 10,
  effort: 500_000,
  controller: undefined as AbortController | undefined,
  status: "Add shapes to compare their ladder diagrams with the same maximum entry.",
};

function cancelLadderAnalysis(): void {
  ladders.controller?.abort();
  ladders.controller = undefined;
}

function ladderStatus(text: string): void {
  ladders.status = text;
  const status = document.querySelector("#ladder-status");
  if (status !== null) status.textContent = text;
}

async function analyzeLadders(): Promise<void> {
  cancelLadderAnalysis();
  const controller = new AbortController();
  ladders.controller = controller;
  const searchOptions = { maxBoardSize: ladders.maxBoard, maxTotalNodes: ladders.effort, maxNodesPerTree: tableauInput.maxTreeNodes, signal: controller.signal };
  const cache = new Map<string, TableauSearchResult>();
  for (const shape of ladders.shapes) for (const [key, result] of shape.games) if (typeof result !== "string") cache.set(key, result);
  for (const shape of ladders.shapes) {
    shape.error = undefined;
    shape.games.clear();
    try {
      shape.ladder = generateTableauLadder(parseTableauShape(shape.text), ladders.maxEntry, ladders.maxTableaux);
    } catch (error) {
      shape.ladder = undefined;
      shape.error = error instanceof Error ? error.message : "Could not generate this shape.";
    }
  }
  ladderStatus("Generating complete ladder diagrams and finding minimum-board games…");
  render();
  let completed = 0, failed = 0;
  const total = ladders.shapes.reduce((sum, shape) => sum + (shape.ladder?.nodes.length ?? 0), 0);
  try {
    for (const shape of ladders.shapes) {
      for (const [index, node] of (shape.ladder?.nodes ?? []).entries()) {
        if (controller.signal.aborted) return;
        ladderStatus(`Finding checker games: ${completed + 1} of ${total} tableaux · shape (${shape.text || "∅"})`);
        try {
          const cached = cache.get(node.id);
          const result = (cached !== undefined && cached.n <= searchOptions.maxBoardSize ? cached : undefined) ?? await findMinimalTableauGames(node.rows, {
            ...searchOptions,
            onProgress: (n) => ladderStatus(`Finding checker games: ${completed + 1} of ${total} tableaux · shape (${shape.text || "∅"}) · board n=${n}`),
          });
          if (controller.signal.aborted) return;
          cache.set(node.id, result);
          shape.games.set(node.id, result);
        } catch (error) {
          if (controller.signal.aborted) return;
          failed++;
          shape.games.set(node.id, error instanceof BranchLimitError
            ? "Search limit reached. Raise search states or the per-game-tree limit and retry; games are not yet known."
            : error instanceof Error ? error.message : "Checker-game search failed.");
        }
        completed++;
        const old = document.querySelector(`[data-ladder-node="${shape.id}-${index}"] .ladder-node-content`);
        old?.replaceWith(createLadderNodeContent(shape, node, ladderOptions()));
        // Cached searches still yield so large comparisons remain cancellable.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    const invalidShapes = ladders.shapes.filter((shape) => shape.error !== undefined).length;
    ladderStatus(`Analysis complete: ${total} tableaux · ${completed - failed} with complete minimum-board games${failed ? ` · ${failed} searches need larger limits` : ""}${invalidShapes ? ` · ${invalidShapes} shapes need correction` : ""}.`);
  } finally {
    if (ladders.controller === controller) {
      ladders.controller = undefined;
      render();
    }
  }
}

function openLadderGame(rows: readonly (readonly number[])[], result: TableauSearchResult, matchIndex: number, leafId: string, event?: TableauEvent): void {
  cancelTableauSearch();
  tableauInput.rows = rows.map((row) => [...row]);
  tableauInput.shapeText = rows.map((row) => row.length).join(", ");
  tableauInput.shapeValid = true;
  tableauInput.error = undefined;
  tableauInput.result = result;
  tableauInput.match = undefined;
  tableauInput.status = `All ${result.matches.length} minimum-board starting positions for the selected ladder tableau (n=${result.n}).`;
  activateTableauMatch(matchIndex);
  state.view = "flow";
  state.playbackLeafId = leafId;
  if (event !== undefined) inspectTableauEvent(leafId, event);
  else {
    state.selectedNodeId = result.matches[matchIndex]!.tree.root.id;
    render();
    requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function ladderOptions(): TableauLaddersOptions {
  return {
    ...ladders,
    searching: ladders.controller !== undefined,
    onAdd: () => {
      cancelLadderAnalysis();
      ladders.shapes.push({ id: nextShapeId++, text: "2", ladder: undefined, error: undefined, games: new Map(), selections: new Map(), scale: 0.8 });
      ladderStatus("Shape added. Generate to include it in the comparison.");
      render();
    },
    onRemove: (id) => {
      cancelLadderAnalysis();
      ladders.shapes = ladders.shapes.filter((shape) => shape.id !== id);
      ladderStatus("Shape removed. Completed diagrams for the other shapes are retained.");
      render();
    },
    onShape: (id, text) => {
      const shape = ladders.shapes.find((shape) => shape.id === id)!;
      const input = document.querySelector<HTMLInputElement>(`[aria-label="Row lengths for comparison shape ${id}"]`);
      const cursor = input?.selectionStart ?? text.length;
      shape.text = text;
      shape.ladder = undefined;
      shape.error = undefined;
      shape.games.clear();
      shape.selections.clear();
      ladderStatus("Shape changed. Generate to update its tableaux and checker games.");
      render();
      const next = document.querySelector<HTMLInputElement>(`[aria-label="Row lengths for comparison shape ${id}"]`);
      next?.focus();
      next?.setSelectionRange(cursor, cursor);
    },
    onMaxEntry: (value) => {
      ladders.maxEntry = value;
      for (const shape of ladders.shapes) {
        shape.ladder = undefined;
        shape.error = undefined;
        shape.games.clear();
        shape.selections.clear();
      }
      document.querySelectorAll("#tableau-ladders .ladder-diagram, #tableau-ladders .generation-error").forEach((node) => node.remove());
      ladderStatus("Maximum entry changed. Generate to update every shape.");
    },
    onLimit: (value) => { ladders.maxTableaux = value; },
    onMaxBoard: (value) => { ladders.maxBoard = value; },
    onEffort: (value) => { ladders.effort = value; },
    onGenerate: () => { void analyzeLadders(); },
    onCancel: () => {
      cancelLadderAnalysis();
      ladderStatus("Analysis cancelled. Finished searches remain available; pending games are labeled. Generate again to resume.");
      render();
    },
    onGame: (rows, result, matchIndex, leafId) => openLadderGame(rows, result, matchIndex, leafId),
    onEvent: (rows, result, matchIndex, leafId, event) => openLadderGame(rows, result, matchIndex, leafId, event),
  };
}

const tableauInput = {
  shapeText: "2, 1",
  shapeValid: true,
  rows: [[1, 3], [2]],
  maxBoardSize: 10,
  effort: 500_000,
  maxTreeNodes: 12_000,
  status: "",
  error: undefined as string | undefined,
  match: undefined as TableauMatch | undefined,
  result: undefined as TableauSearchResult | undefined,
  controller: undefined as AbortController | undefined,
};

function cancelTableauSearch(): void {
  tableauInput.controller?.abort();
  tableauInput.controller = undefined;
}

type ViewMode = "flow" | "final";

interface AppState {
  n: number;
  k: number;
  inputMode: InputMode;
  white: Position[];
  subsetA: string;
  subsetB: string;
  tree: GameTree | undefined;
  view: ViewMode;
  selectedNodeId: string;
  playbackLeafId: string;
  collapsed: Set<string>;
  flowTransform: FlowTransform;
  showAnnotations: boolean;
  debug: boolean;
  isPlaying: boolean;
  playbackSpeed: number;
  generationError: string | undefined;
}

const initialA = [2, 4];
const initialB = [2, 4];
const initialTree = generateGameTree(4, initialA, initialB);
const state: AppState = {
  n: 4,
  k: 2,
  inputMode: "board",
  white: initialWhiteConfiguration(initialA, initialB),
  subsetA: "2, 4",
  subsetB: "2, 4",
  tree: initialTree,
  view: "flow",
  selectedNodeId: initialTree.root.id,
  playbackLeafId: initialTree.leaves[0]?.id ?? initialTree.root.id,
  collapsed: new Set(),
  flowTransform: { scale: 0.7, x: 28, y: 28 },
  showAnnotations: true,
  debug: true,
  isPlaying: false,
  playbackSpeed: 900,
  generationError: undefined,
};

let playbackTimer: number | undefined;
const appElement = document.querySelector<HTMLElement>("#app");
if (appElement === null) throw new Error("Missing #app root element.");
const app: HTMLElement = appElement;

function invalidateTree(): void {
  cancelTableauSearch();
  tableauInput.match = undefined;
  tableauInput.result = undefined;
  stopPlayback();
  state.tree = undefined;
  state.selectedNodeId = "";
  state.playbackLeafId = "";
  state.collapsed = new Set();
  state.generationError = undefined;
}

function subsetDiagnostics(): {
  A: number[] | null;
  B: number[] | null;
  errors: string[];
} {
  const A = parseSubset(state.subsetA);
  const B = parseSubset(state.subsetB);
  const errors: string[] = [];
  if (A === null) {
    errors.push("A: use only integers separated by commas or spaces.");
  } else {
    errors.push(...validateSubset(A, state.n, state.k).map((error) => `A: ${error}`));
  }
  if (B === null) {
    errors.push("B: use only integers separated by commas or spaces.");
  } else {
    errors.push(...validateSubset(B, state.n, state.k).map((error) => `B: ${error}`));
  }
  if (A !== null && B !== null && A.length !== B.length) {
    errors.push("A and B must have the same cardinality.");
  }
  return { A, B, errors };
}

function syncWhiteFromSubsetText(): void {
  const diagnostics = subsetDiagnostics();
  if (diagnostics.A !== null && diagnostics.B !== null && diagnostics.errors.length === 0) {
    state.white = initialWhiteConfiguration(diagnostics.A, diagnostics.B);
  } else {
    state.white = [];
  }
  invalidateTree();
}

function formatSubsetText(values: readonly number[]): string {
  return values.join(", ");
}

function confirmReset(): boolean {
  return (
    state.white.length === 0 ||
    window.confirm("Changing n or k will clear the current white-checker configuration. Continue?")
  );
}

function changeN(next: number): void {
  if (next === state.n) return;
  if (!confirmReset()) {
    render();
    return;
  }
  state.n = next;
  state.k = Math.min(state.k, next);
  state.white = [];
  state.subsetA = "";
  state.subsetB = "";
  invalidateTree();
  render();
}

function changeK(next: number): void {
  if (next === state.k) return;
  if (!confirmReset()) {
    render();
    return;
  }
  state.k = Math.max(0, Math.min(state.n, next));
  state.white = [];
  state.subsetA = "";
  state.subsetB = "";
  invalidateTree();
  render();
}

function toggleWhite(position: Position): void {
  const key = positionKey(position);
  const existing = state.white.findIndex((checker) => positionKey(checker) === key);
  if (existing >= 0) {
    state.white = state.white.filter((_, index) => index !== existing);
  } else if (state.white.length < state.k) {
    state.white = [...state.white, position].sort((a, b) => a.row - b.row || a.col - b.col);
  } else {
    state.generationError = `There are already ${state.k} white checkers. Remove one before adding another.`;
    render();
    return;
  }
  const { A, B } = inferSubsetsFromWhite(state.white);
  state.subsetA = formatSubsetText(A);
  state.subsetB = formatSubsetText(B);
  invalidateTree();
  render();
}

function clearInput(): void {
  state.white = [];
  state.subsetA = "";
  state.subsetB = "";
  invalidateTree();
  render();
}

function loadExample(n: number, A: readonly number[], B: readonly number[]): void {
  cancelTableauSearch();
  tableauInput.match = undefined;
  tableauInput.result = undefined;
  stopPlayback();
  state.n = n;
  state.k = A.length;
  state.inputMode = "board";
  state.white = initialWhiteConfiguration(A, B);
  state.subsetA = formatSubsetText(A);
  state.subsetB = formatSubsetText(B);
  state.tree = undefined;
  state.view = "flow";
  state.selectedNodeId = "";
  state.playbackLeafId = "";
  state.collapsed = new Set();
  state.generationError = undefined;
  render();
}

function generate(): void {
  cancelTableauSearch();
  tableauInput.match = undefined;
  tableauInput.result = undefined;
  const validation = validateInitialWhite(state.n, state.k, state.white);
  const diagnostics = state.inputMode === "subsets" ? subsetDiagnostics() : { errors: [] };
  if (!validation.valid || diagnostics.errors.length > 0) return;
  try {
    const tree = generateGameTree(state.n, validation.A, validation.B, { maxNodes: 12_000 });
    stopPlayback();
    state.tree = tree;
    state.view = "flow";
    state.selectedNodeId = tree.root.id;
    state.playbackLeafId = tree.leaves[0]?.id ?? tree.root.id;
    state.collapsed = new Set();
    state.flowTransform = { scale: tree.nodeCount > 100 ? 0.35 : 0.7, x: 28, y: 28 };
    state.generationError = undefined;
  } catch (error) {
    state.tree = undefined;
    state.generationError =
      error instanceof BranchLimitError
        ? `${error.message} The mathematical engine does not merge paths, so large inputs can grow quickly.`
        : error instanceof Error
          ? error.message
          : "Checker-game generation failed.";
  }
  render();
  requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

async function searchTableau(): Promise<void> {
  if (!tableauInput.shapeValid) return;
  cancelTableauSearch();
  stopPlayback();
  const controller = new AbortController();
  tableauInput.controller = controller;
  tableauInput.error = undefined;
  tableauInput.match = undefined;
  tableauInput.result = undefined;
  tableauInput.status = "Searching boards in increasing size…";
  state.tree = undefined;
  render();
  try {
    const result = await findMinimalTableauGames(tableauInput.rows, {
      maxBoardSize: tableauInput.maxBoardSize,
      maxTotalNodes: tableauInput.effort,
      maxNodesPerTree: tableauInput.maxTreeNodes,
      signal: controller.signal,
      onProgress: (n, candidates) => {
        tableauInput.status = `Searching n = ${n} · ${candidates.toLocaleString()} starting positions checked`;
        const status = document.querySelector("#tableau-search-status");
        if (status !== null) status.textContent = tableauInput.status;
      },
    });
    if (controller.signal.aborted) return;
    tableauInput.result = result;
    tableauInput.status = `Exhaustive search complete: ${result.matches.length} starting positions on the minimum board n = ${result.n}.`;
    activateTableauMatch(0);
    state.view = "final";
  } catch (error) {
    if (controller.signal.aborted) return;
    tableauInput.error = error instanceof BranchLimitError
      ? "A candidate exceeded the search effort or per-game-tree limit. Increase those limits and try again. The search stopped without skipping this candidate, so the complete set of minimal starting positions is not yet known."
      : error instanceof Error ? error.message : "Tableau search failed.";
    tableauInput.status = "Search stopped without a result.";
  } finally {
    if (tableauInput.controller === controller) {
      tableauInput.controller = undefined;
      render();
    }
  }
}

function activateTableauMatch(index: number): void {
  const match = tableauInput.result?.matches[index];
  if (match === undefined || tableauInput.match === match) return;
  stopPlayback();
  tableauInput.match = match;
  const tree = match.tree;
  state.n = tree.n;
  state.k = tree.k;
  state.white = initialWhiteConfiguration(tree.A, tree.B);
  state.subsetA = formatSubsetText(tree.A);
  state.subsetB = formatSubsetText(tree.B);
  state.tree = tree;
  state.selectedNodeId = match.leafIds[0] ?? tree.root.id;
  state.playbackLeafId = state.selectedNodeId;
  state.collapsed = new Set();
  state.flowTransform = { scale: tree.nodeCount > 100 ? 0.35 : 0.7, x: 28, y: 28 };
  state.generationError = undefined;
}

function changeTableauShape(text: string): void {
  tableauInput.shapeText = text;
  const parts = text.trim() === "" ? [] : text.trim().split(/[\s,;]+/).map(Number);
  if (parts.some((part, i) => !Number.isSafeInteger(part) || part < 1 || part > 100 || (i > 0 && part > parts[i - 1]!)) || parts.reduce((a, b) => a + b, 0) > 1000) {
    tableauInput.shapeValid = false;
    invalidateTree();
    tableauInput.error = "Use positive, weakly decreasing row lengths (at most 100 per row and 1,000 cells total), or leave blank for an empty tableau.";
    render();
    return;
  }
  tableauInput.shapeValid = true;
  tableauInput.rows = parts.map((length, r) => Array.from({ length }, (_, c) => tableauInput.rows[r]?.[c] ?? r + 1));
  tableauInput.error = undefined;
  tableauInput.status = "";
  invalidateTree();
  render();
}

function selectedNode(tree: GameTree): GameNode {
  return tree.nodesById.get(state.selectedNodeId) ?? tree.root;
}

function expandAncestors(tree: GameTree, nodeId: string): void {
  for (const node of pathToNode(tree, nodeId)) state.collapsed.delete(node.id);
}

function selectNode(nodeId: string, preservePlayback = false): void {
  const tree = state.tree;
  if (tree === undefined) return;
  const node = tree.nodesById.get(nodeId);
  if (node === undefined) return;
  if (!preservePlayback) stopPlayback();
  state.selectedNodeId = nodeId;
  if (!preservePlayback) state.playbackLeafId = firstLeafBelow(node).id;
  expandAncestors(tree, nodeId);
  render();
}

function playbackPath(tree: GameTree): GameNode[] {
  const leaf = tree.nodesById.get(state.playbackLeafId);
  if (leaf === undefined) {
    const fallback = firstLeafBelow(selectedNode(tree));
    state.playbackLeafId = fallback.id;
    return pathToNode(tree, fallback.id);
  }
  return pathToNode(tree, leaf.id);
}

function playbackIndex(tree: GameTree): number {
  const path = playbackPath(tree);
  const index = path.findIndex((node) => node.id === state.selectedNodeId);
  return index >= 0 ? index : 0;
}

function movePlayback(index: number): void {
  const tree = state.tree;
  if (tree === undefined) return;
  const path = playbackPath(tree);
  const bounded = Math.max(0, Math.min(path.length - 1, index));
  const target = path[bounded];
  if (target === undefined) return;
  state.selectedNodeId = target.id;
  expandAncestors(tree, target.id);
  render();
}

function stopPlayback(): void {
  if (playbackTimer !== undefined) window.clearInterval(playbackTimer);
  playbackTimer = undefined;
  state.isPlaying = false;
}

function startPlayback(): void {
  const tree = state.tree;
  if (tree === undefined) return;
  stopPlayback();
  let index = playbackIndex(tree);
  const path = playbackPath(tree);
  if (index >= path.length - 1) {
    index = 0;
    const initial = path[0];
    if (initial !== undefined) state.selectedNodeId = initial.id;
  }
  state.isPlaying = true;
  playbackTimer = window.setInterval(() => {
    const currentTree = state.tree;
    if (currentTree === undefined) {
      stopPlayback();
      return;
    }
    const currentPath = playbackPath(currentTree);
    const currentIndex = currentPath.findIndex((node) => node.id === state.selectedNodeId);
    if (currentIndex < 0 || currentIndex >= currentPath.length - 1) {
      stopPlayback();
      render();
      return;
    }
    const next = currentPath[currentIndex + 1];
    if (next !== undefined) {
      state.selectedNodeId = next.id;
      expandAncestors(currentTree, next.id);
      render();
    }
  }, state.playbackSpeed);
  render();
}

function restartPlaybackAtNewSpeed(speed: number): void {
  const wasPlaying = state.isPlaying;
  stopPlayback();
  state.playbackSpeed = speed;
  if (wasPlaying) startPlayback();
  else render();
}

function inspectLeaf(leafId: string): void {
  const tree = state.tree;
  if (tree === undefined) return;
  stopPlayback();
  state.view = "flow";
  state.playbackLeafId = leafId;
  state.selectedNodeId = leafId;
  expandAncestors(tree, leafId);
  render();
  requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function inspectTableauEvent(leafId: string, event: TableauEvent): void {
  const tree = state.tree;
  if (tree === undefined) return;
  stopPlayback();
  state.view = "flow";
  state.playbackLeafId = leafId;
  const path = pathToNode(tree, leafId);
  const node = path.find((candidate) => candidate.state.step === event.step) ?? tree.root;
  state.selectedNodeId = node.id;
  expandAncestors(tree, node.id);
  render();
  requestAnimationFrame(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function segment(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const control = button(label, onClick, `segment${active ? " segment--active" : ""}`);
  control.setAttribute("aria-pressed", String(active));
  return control;
}

function checkboxControl(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const input = element("input", {
    attributes: { type: "checkbox", ...(checked ? { checked: "" } : {}) },
  });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const wrapper = element("label", { className: "toggle-control" });
  wrapper.append(input, element("span", { className: "toggle-track" }), element("span", { text: label }));
  return wrapper;
}

function createPlaybackControls(tree: GameTree): HTMLElement {
  const path = playbackPath(tree);
  const index = playbackIndex(tree);
  const controls = element("div", { className: "playback-controls panel-card" });
  const transport = element("div", { className: "transport-buttons" });
  const first = button("|‹", () => {
    stopPlayback();
    movePlayback(0);
  }, "transport-button");
  first.title = "First step";
  const previous = button("‹", () => {
    stopPlayback();
    movePlayback(index - 1);
  }, "transport-button");
  previous.title = "Previous step";
  const play = button(state.isPlaying ? "Pause" : "Play", () => {
    if (state.isPlaying) {
      stopPlayback();
      render();
    } else {
      startPlayback();
    }
  }, "transport-button transport-button--play");
  const next = button("›", () => {
    stopPlayback();
    movePlayback(index + 1);
  }, "transport-button");
  next.title = "Next step";
  const last = button("›|", () => {
    stopPlayback();
    movePlayback(path.length - 1);
  }, "transport-button");
  last.title = "Last step";
  first.disabled = index === 0;
  previous.disabled = index === 0;
  next.disabled = index === path.length - 1;
  last.disabled = index === path.length - 1;
  transport.append(first, previous, play, next, last);

  const speed = element("select", { className: "speed-select", attributes: { "aria-label": "Playback speed" } });
  for (const [label, value] of [["0.5×", 1500], ["1×", 900], ["2×", 450], ["4×", 220]] as const) {
    const option = element("option", { text: label, attributes: { value: String(value) } });
    option.selected = state.playbackSpeed === value;
    speed.append(option);
  }
  speed.addEventListener("change", () => restartPlaybackAtNewSpeed(Number(speed.value)));

  controls.append(
    element("div", { className: "playback-label", text: `Selected game · step ${index} of ${path.length - 1}` }),
    transport,
    labelledControl("Speed", speed),
  );
  return controls;
}

function createResults(tree: GameTree): HTMLElement {
  const section = element("section", { className: "results-section", attributes: { id: "results" } });
  const topbar = element("div", { className: "results-topbar" });
  const viewSwitch = element("div", { className: "segmented segmented--large", attributes: { role: "group", "aria-label": "Results view" } });
  viewSwitch.append(
    segment("Flow diagram", state.view === "flow", () => {
      stopPlayback();
      state.view = "flow";
      render();
    }),
    segment("Final results", state.view === "final", () => {
      stopPlayback();
      state.view = "final";
      render();
    }),
  );
  const resultMeta = element("div", { className: "result-meta" });
  const allMatches = tableauInput.result?.matches;
  resultMeta.append(
    element("span", { text: `${state.view === "final" && allMatches !== undefined ? allMatches.reduce((sum, match) => sum + match.tree.nodeCount, 0) : tree.nodeCount} states` }),
    element("span", { text: `${state.view === "final" && allMatches !== undefined ? allMatches.reduce((sum, match) => sum + match.tree.leaves.length, 0) : tree.leaves.length} terminal games` }),
    element("span", { text: `${tree.schedule.length} black moves` }),
  );
  topbar.append(viewSwitch, resultMeta);
  section.append(topbar);

  if (state.view === "final") {
    if (allMatches !== undefined) {
      for (const [index, match] of allMatches.entries()) {
        const start = element("section", { className: "starting-position-results", attributes: { "data-start-index": String(index) } });
        const heading = element("div", { className: "results-summary panel-card recovered-position" });
        const description = element("div");
        description.append(
          element("h2", { className: "panel-title", text: `Starting position ${index + 1} · k = ${match.tree.k}` }),
          element("p", { text: `A = ${formatSubset(match.tree.A)}; B = ${formatSubset(match.tree.B)}` }),
          button("Explore this starting position", () => {
            activateTableauMatch(index);
            state.view = "flow";
            selectNode(match.tree.root.id);
          }),
        );
        heading.append(createCheckerBoard({ n: match.tree.n, black: match.tree.root.state.black, white: match.tree.root.state.white, pixelSize: 180 }), description);
        start.append(heading, createFinalResults({
          tree: match.tree,
          inputLeafIds: match.leafIds,
          onInspectLeaf: (leafId) => { activateTableauMatch(index); inspectLeaf(leafId); },
          onTableauEvent: (leafId, event) => { activateTableauMatch(index); inspectTableauEvent(leafId, event); },
        }));
        section.append(start);
      }
      return section;
    }
    section.append(
      createFinalResults({
        tree,
        ...(tableauInput.match === undefined ? {} : { inputLeafIds: tableauInput.match.leafIds }),
        onInspectLeaf: inspectLeaf,
        onTableauEvent: inspectTableauEvent,
      }),
    );
    return section;
  }

  const optionBar = element("div", { className: "flow-options" });
  optionBar.append(
    checkboxControl("Board annotations", state.showAnnotations, (checked) => {
      state.showAnnotations = checked;
      render();
    }),
    checkboxControl("Debug / explain move", state.debug, (checked) => {
      state.debug = checked;
      render();
    }),
  );
  section.append(optionBar, createPlaybackControls(tree));

  const layout = element("div", { className: "flow-layout" });
  layout.append(
    createGameTree({
      tree,
      selectedNodeId: selectedNode(tree).id,
      collapsed: state.collapsed,
      transform: state.flowTransform,
      onSelect: (nodeId) => selectNode(nodeId),
      onToggleCollapsed: (nodeId) => {
        if (state.collapsed.has(nodeId)) state.collapsed.delete(nodeId);
        else state.collapsed.add(nodeId);
        render();
      },
      onExpandAll: () => {
        state.collapsed = new Set();
        render();
      },
      onCollapseBranches: () => {
        state.collapsed = new Set(
          [...tree.nodesById.values()]
            .filter((node) => node.children.length > 1)
            .map((node) => node.id),
        );
        render();
      },
      onTransformChange: (transform) => {
        state.flowTransform = transform;
      },
    }),
    createGameInspector({
      node: selectedNode(tree),
      totalSteps: tree.schedule.length,
      showAnnotations: state.showAnnotations,
      debug: state.debug,
    }),
  );
  section.append(layout);
  return section;
}

function createHowItWorks(): HTMLElement {
  const details = element("details", { className: "how-panel panel-card" });
  const summary = element("summary");
  summary.append(
    element("span", { className: "how-summary-title", text: "How Vakil’s rule works" }),
    element("span", { className: "how-summary-note", text: "Mathematical conventions and implementation notes" }),
  );
  const body = element("div", { className: "how-body" });
  body.append(
    element("p", {
      text: "Black checkers encode the relative position of two complete flags. They follow Vakil’s prescribed specialization word from the identity to the longest permutation. White checkers encode the position of the k-plane and must remain happy after every move.",
    }),
    element("p", {
      text: "At each black move, Table 2 determines whether the white configuration stays, swaps, or branches. Phase 2 then performs the unique cleanup needed to restore happiness. Distinct root-to-leaf paths are retained even when they end at the same subset, which is exactly how multiplicities arise.",
    }),
    element("p", {
      text: "A distinguished † move records the current row-rank r of the rising white checker in tableau row c, where c is its current column-rank. The app stores these events during generation, so the tableau is never reconstructed from the terminal subset alone.",
    }),
  );
  const references = element("div", { className: "paper-reference" });
  references.append(
    element("span", { text: "Paper reference: §§2.2–2.6, Figures 1–7, and Table 2. " }),
  );
  const link = element("a", {
    text: "Open Vakil’s paper",
    attributes: {
      href: "https://arxiv.org/pdf/math/0302294",
      target: "_blank",
      rel: "noreferrer",
    },
  });
  references.append(link);
  body.append(references);
  details.append(summary, body);
  return details;
}

function createHeader(): HTMLElement {
  const header = element("header", { className: "site-header" });
  const title = element("div", { className: "title-block" });
  title.append(
    element("p", { className: "kicker", text: "Geometric Littlewood–Richardson rule" }),
    element("h1", { text: "Vakil Checker Games" }),
    element("p", {
      className: "subtitle",
      text: "Start from a checker position or a Young tableau, generate every sibling checker game, and explore the bijection through the specialization tree.",
    }),
  );
  const inputLinks = element("nav", { className: "input-navigation", attributes: { "aria-label": "Input sections" } });
  inputLinks.append(element("a", {
    className: "button button--primary",
    text: "Enter a Young tableau",
    attributes: { href: "#tableau-input" },
  }));
  inputLinks.append(element("a", { className: "button", text: "Compare tableau ladders", attributes: { href: "#tableau-ladders" } }));
  title.append(inputLinks);
  const verification = element("div", { className: "verification-badge" });
  verification.append(
    element("span", { className: "verification-dot" }),
    element("div", {
      html: "<strong>Verified engine</strong><span>Figure 6 · Figure 7 · Table 2</span>",
    }),
  );
  header.append(title, verification);
  return header;
}

function render(): void {
  const ladderScrolls = new Map([...document.querySelectorAll<HTMLElement>("[data-ladder-viewport]")].map((viewport) => [viewport.dataset.ladderViewport, { x: viewport.scrollLeft, y: viewport.scrollTop }]));
  app.replaceChildren();
  const shell = element("div", { className: "app-shell" });
  shell.append(createHeader());

  const diagnostics = state.inputMode === "subsets" ? subsetDiagnostics() : { errors: [] as string[] };
  const validation = validateInitialWhite(state.n, state.k, state.white);
  const inputOptions = {
    n: state.n,
    k: state.k,
    mode: state.inputMode,
    white: state.white,
    black: initialBlackConfiguration(state.n),
    validation,
    subsetA: state.subsetA,
    subsetB: state.subsetB,
    subsetErrors: diagnostics.errors,
    onNChange: changeN,
    onKChange: changeK,
    onModeChange: (mode: InputMode) => {
      state.inputMode = mode;
      if (mode === "subsets") {
        const { A, B } = inferSubsetsFromWhite(state.white);
        state.subsetA = formatSubsetText(A);
        state.subsetB = formatSubsetText(B);
      }
      render();
    },
    onToggleWhite: toggleWhite,
    onSubsetAChange: (value: string) => {
      state.subsetA = value;
      syncWhiteFromSubsetText();
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Subset A"]');
        input?.focus();
        input?.setSelectionRange(value.length, value.length);
      });
    },
    onSubsetBChange: (value: string) => {
      state.subsetB = value;
      syncWhiteFromSubsetText();
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Subset B"]');
        input?.focus();
        input?.setSelectionRange(value.length, value.length);
      });
    },
    onClear: clearInput,
    onExample4: () => loadExample(4, [2, 4], [2, 4]),
    onExample6: () => loadExample(6, [2, 4, 6], [2, 4, 6]),
    onGenerate: generate,
    ...(state.generationError === undefined ? {} : { generationError: state.generationError }),
  };
  shell.append(createInputPanel(inputOptions));
  shell.append(createTableauInput({
    shapeText: tableauInput.shapeText,
    shapeValid: tableauInput.shapeValid,
    rows: tableauInput.rows,
    maxBoardSize: tableauInput.maxBoardSize,
    effort: tableauInput.effort,
    maxTreeNodes: tableauInput.maxTreeNodes,
    status: tableauInput.status,
    searching: tableauInput.controller !== undefined,
    ...(tableauInput.error === undefined ? {} : { error: tableauInput.error }),
    ...(tableauInput.result === undefined ? {} : { result: tableauInput.result }),
    onShape: (text) => {
      const input = document.querySelector<HTMLInputElement>('[aria-label="Tableau row lengths"]');
      const cursor = input?.selectionStart ?? text.length;
      changeTableauShape(text);
      const next = document.querySelector<HTMLInputElement>('[aria-label="Tableau row lengths"]');
      next?.focus();
      next?.setSelectionRange(cursor, cursor);
    },
    onCell: (row, col, text) => {
      const input = document.querySelector<HTMLInputElement>(`[data-tableau-cell="${row}-${col}"]`);
      const cursor = input?.selectionStart ?? text.length;
      tableauInput.rows[row]![col] = /^\d+$/.test(text) ? Number(text) : NaN;
      if (tableauInput.shapeValid) tableauInput.error = undefined;
      tableauInput.status = "";
      invalidateTree();
      render();
      const next = document.querySelector<HTMLInputElement>(`[data-tableau-cell="${row}-${col}"]`);
      if (next !== null) {
        next.value = text;
        next.focus();
        next.setSelectionRange(cursor, cursor);
      }
    },
    onMaxBoardSize: (n) => {
      if (Number.isSafeInteger(n) && n >= 1 && n <= 30) tableauInput.maxBoardSize = n;
    },
    onEffort: (nodes) => { tableauInput.effort = nodes; },
    onMaxTreeNodes: (nodes) => {
      if (Number.isSafeInteger(nodes) && nodes >= 1 && nodes <= 120_000) tableauInput.maxTreeNodes = nodes;
    },
    onSearch: () => { void searchTableau(); },
    onCancel: () => {
      cancelTableauSearch();
      tableauInput.status = "Search cancelled. No minimum has been claimed.";
      render();
    },
    onExample: (rows) => {
      invalidateTree();
      tableauInput.rows = rows;
      tableauInput.shapeText = rows.map((row) => row.length).join(", ");
      tableauInput.shapeValid = true;
      tableauInput.error = undefined;
      tableauInput.status = "";
      render();
    },
    onTrace: (index) => {
      activateTableauMatch(index);
      const leafId = tableauInput.match?.leafIds[0];
      if (leafId !== undefined) inspectLeaf(leafId);
    },
  }));
  shell.append(createTableauLadders(ladderOptions()));
  if (state.tree !== undefined) shell.append(createResults(state.tree));
  shell.append(createHowItWorks());

  const footer = element("footer", { className: "site-footer" });
  footer.append(
    element("span", { text: "Exact path multiplicities · event-based tableaux · pure TypeScript checker engine" }),
    element("span", { text: "Rows increase downward; columns increase rightward." }),
  );
  shell.append(footer);
  app.append(shell);
  for (const viewport of document.querySelectorAll<HTMLElement>("[data-ladder-viewport]")) {
    const scroll = ladderScrolls.get(viewport.dataset.ladderViewport);
    if (scroll !== undefined) { viewport.scrollLeft = scroll.x; viewport.scrollTop = scroll.y; }
    else {
      const stage = viewport.querySelector<HTMLElement>(".ladder-stage");
      if (stage !== null) viewport.scrollTop = Math.max(0, (parseFloat(stage.style.height) - (viewport.clientHeight || 680)) / 2);
    }
  }
}

window.addEventListener("beforeunload", () => { stopPlayback(); cancelTableauSearch(); cancelLadderAnalysis(); });
render();

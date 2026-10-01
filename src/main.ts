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
  resultMeta.append(
    element("span", { text: `${tree.nodeCount} states` }),
    element("span", { text: `${tree.leaves.length} terminal games` }),
    element("span", { text: `${tree.schedule.length} black moves` }),
  );
  topbar.append(viewSwitch, resultMeta);
  section.append(topbar);

  if (state.view === "final") {
    section.append(
      createFinalResults({
        tree,
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
      text: "Build an initial white-checker position, generate every legal checker game, inspect the specialization tree, and trace each terminal game to its tableau.",
    }),
  );
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
  if (state.tree !== undefined) shell.append(createResults(state.tree));
  shell.append(createHowItWorks());

  const footer = element("footer", { className: "site-footer" });
  footer.append(
    element("span", { text: "Exact path multiplicities · event-based tableaux · pure TypeScript checker engine" }),
    element("span", { text: "Rows increase downward; columns increase rightward." }),
  );
  shell.append(footer);
  app.append(shell);
}

window.addEventListener("beforeunload", stopPlayback);
render();

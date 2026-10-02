import type { FilledTableau, TableauSearchResult } from "../math/inverseTableau.js";
import { validateFilledTableau } from "../math/inverseTableau.js";
import { formatSubset } from "../math/validation.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { button, element, labelledControl } from "./dom.js";

export interface TableauInputOptions {
  readonly shapeText: string;
  readonly shapeValid: boolean;
  readonly rows: FilledTableau;
  readonly maxBoardSize: number;
  readonly effort: number;
  readonly maxTreeNodes: number;
  readonly searching: boolean;
  readonly status: string;
  readonly error?: string;
  readonly result?: TableauSearchResult;
  readonly onShape: (text: string) => void;
  readonly onCell: (row: number, col: number, text: string) => void;
  readonly onMaxBoardSize: (n: number) => void;
  readonly onEffort: (nodes: number) => void;
  readonly onMaxTreeNodes: (nodes: number) => void;
  readonly onSearch: () => void;
  readonly onCancel: () => void;
  readonly onExample: (rows: number[][]) => void;
  readonly onTrace: (index: number) => void;
}

export function createTableauInput(options: TableauInputOptions): HTMLElement {
  const section = element("section", { className: "input-card panel-card", attributes: { id: "tableau-input", "aria-labelledby": "tableau-input-heading" } });
  section.append(
    element("p", { className: "eyebrow", text: "Explore the bijection" }),
    element("h2", { className: "panel-title", text: "Start from a Young tableau", attributes: { id: "tableau-input-heading" } }),
    element("p", { className: "tableau-input-intro", text: "Enter a straight Young diagram and its semistandard filling, in the same convention as Final Results: rows weakly increase and columns strictly increase. The app finds every possible starting position on the smallest checkerboard and generates all of their sibling games." }),
  );
  const setup = element("div", { className: "setup-controls" });
  const shape = element("input", { className: "subset-input", attributes: { value: options.shapeText, placeholder: "2, 1", "aria-label": "Tableau row lengths", type: "text" } });
  shape.disabled = options.searching;
  shape.addEventListener("input", () => options.onShape(shape.value));
  const maxN = element("input", { className: "number-input", attributes: { type: "number", min: "1", max: "30", value: String(options.maxBoardSize), "aria-label": "Maximum search board size" } });
  maxN.disabled = options.searching;
  maxN.addEventListener("change", () => {
    const value = Number(maxN.value);
    if (Number.isSafeInteger(value) && value >= 1 && value <= 30) options.onMaxBoardSize(value);
    else maxN.value = String(options.maxBoardSize);
  });
  const effort = element("select", { className: "speed-select", attributes: { "aria-label": "Search effort" } });
  for (const nodes of [500_000, 2_000_000, 10_000_000]) {
    const option = element("option", { text: `${nodes.toLocaleString()} states`, attributes: { value: String(nodes) } });
    option.selected = nodes === options.effort;
    effort.append(option);
  }
  effort.disabled = options.searching;
  effort.addEventListener("change", () => options.onEffort(Number(effort.value)));
  setup.append(labelledControl("Row lengths (top to bottom)", shape), labelledControl("Search up to n", maxN), labelledControl("Search effort", effort));
  const treeLimit = element("input", { className: "number-input", attributes: { type: "number", min: "1", max: "120000", value: String(options.maxTreeNodes), "aria-label": "Maximum states per game tree" } });
  treeLimit.disabled = options.searching;
  treeLimit.addEventListener("change", () => {
    const value = Number(treeLimit.value);
    if (Number.isSafeInteger(value) && value >= 1 && value <= 120_000) options.onMaxTreeNodes(value);
    else treeLimit.value = String(options.maxTreeNodes);
  });
  setup.append(labelledControl("States per game tree", treeLimit));
  section.append(setup, element("p", { className: "field-help tableau-shape-help", text: "Use decreasing row lengths, e.g. 3, 2, 1. Leave blank for the empty tableau. Change row lengths to resize the cells." }));
  const work = element("div", { className: "tableau-input-work" });
  const editor = element("div", { className: "tableau tableau-editor", attributes: { "aria-label": "Tableau entries" } });
  if (options.rows.length === 0) editor.append(element("span", { className: "empty-tableau", text: "∅" }));
  options.rows.forEach((row, r) => {
    const rowElement = element("div", { className: "tableau-row" });
    row.forEach((value, c) => {
      const cell = element("input", { className: "tableau-cell tableau-entry", attributes: { type: "text", inputmode: "numeric", value: Number.isNaN(value) ? "" : String(value), "aria-label": `Tableau row ${r + 1}, column ${c + 1}`, "data-tableau-cell": `${r}-${c}` } });
      cell.disabled = options.searching;
      cell.addEventListener("input", () => options.onCell(r, c, cell.value));
      rowElement.append(cell);
    });
    editor.append(rowElement);
  });
  const details = element("div");
  const errors = validateFilledTableau(options.rows);
  details.append(element("p", { className: "tableau-input-intro", text: "A tableau alone may have several possible starting positions. We search the entire smallest matching board, including every possible number of white checkers. Final Results groups all sibling games by starting position and marks every copy of your input tableau." }));
  const message = element("div", { className: errors.length ? "validation-message" : "validation-message validation-message--ok", attributes: { role: "status" } });
  message.textContent = errors.length ? errors.join(" ") : "Valid semistandard tableau. Ready to find its checker game.";
  details.append(message);
  const status = element("p", { className: "tableau-search-status", text: options.status, attributes: { id: "tableau-search-status", role: "status", "aria-live": "polite" } });
  details.append(status);
  if (options.error !== undefined) details.append(element("div", { className: "generation-error", text: options.error, attributes: { role: "alert" } }));
  work.append(editor, details);
  section.append(work);
  const actions = element("div", { className: "input-actions" });
  const example1 = button("Example: 2", () => options.onExample([[2]]));
  const example2 = button("Example: Figure 7", () => options.onExample([[1, 3], [2]]));
  example1.disabled = example2.disabled = options.searching;
  const search = button(options.searching ? "Searching…" : "Find checker game & siblings", options.onSearch, "button button--primary button--generate");
  search.disabled = options.searching || errors.length > 0 || !options.shapeValid;
  actions.append(example1, example2, search);
  if (options.searching) actions.append(button("Cancel search", options.onCancel));
  section.append(actions);
  if (options.result !== undefined) {
    const result = options.result;
    section.append(element("h3", { className: "minimal-starts-heading", text: `Smallest board: ${result.n} × ${result.n} · ${result.matches.length} starting positions` }));
    result.matches.forEach((match, index) => {
      const tree = match.tree;
      const recovered = element("div", { className: "recovered-position" });
      const description = element("div");
      description.append(
        element("h4", { text: `Starting position ${index + 1} · ${tree.k} white checkers` }),
        element("p", { text: `A = ${formatSubset(tree.A)}; B = ${formatSubset(tree.B)}. ${tree.leaves.length} sibling game${tree.leaves.length === 1 ? "" : "s"} share this starting position.` }),
        button("Trace the input tableau’s game", () => options.onTrace(index)),
      );
      recovered.append(createCheckerBoard({ n: tree.n, black: tree.root.state.black, white: tree.root.state.white, pixelSize: 220 }), description);
      section.append(recovered);
    });
  }
  return section;
}

import { boardMoveOptions } from "../math/moveArrows.js";
import { formatSubset } from "../math/validation.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { createTableau } from "./Tableau.js";
import { button, element, labelledControl } from "./dom.js";
export function createTableauEquivalence(options) {
    const section = element("section", { className: "input-card panel-card", attributes: { id: "tableau-equivalence", "aria-labelledby": "equivalence-heading" } });
    section.append(element("p", { className: "eyebrow", text: "Group by starting position" }), element("h2", { className: "panel-title", text: "Equivalent tableaux", attributes: { id: "equivalence-heading" } }), element("p", { className: "tableau-input-intro", text: "Choose a shape and entry bound k. Every game here uses exactly k white checkers. Tableaux are grouped together only when they share a starting position on their own minimum checkerboard. Rows may have different board sizes. Click an entry to inspect its recording move, or explore a minimal starting position and its games." }), element("p", { className: "field-help", text: "Every filling with entries 1,…,k is searched on increasing board sizes. A tableau appears only at its first matching size. Larger-board copies are excluded from the table. For fixed k, each tableau has one minimal starting position; different tableaux can share that position. Each tableau is paired with its game's final board, with all board display toggles available." }));
    const setup = element("div", { className: "setup-controls" });
    const shape = element("input", { className: "subset-input", attributes: { value: options.shapeText, type: "text", placeholder: "2, 1", "aria-label": "Equivalence tableau row lengths" } });
    shape.disabled = options.searching;
    shape.addEventListener("input", () => options.onShape(shape.value));
    function numeric(label, value, max, callback) {
        const input = element("input", { className: "number-input", attributes: { type: "number", min: "1", max: String(max), value: String(value), "aria-label": label } });
        input.disabled = options.searching;
        let lastValid = value;
        input.addEventListener("change", () => {
            const next = Number(input.value);
            if (Number.isSafeInteger(next) && next >= 1 && next <= max) {
                lastValid = next;
                callback(next);
            }
            else
                input.value = String(lastValid);
        });
        return labelledControl(label, input);
    }
    setup.append(labelledControl("Shape row lengths", shape), numeric("Maximum entry / white checkers k", options.k, 30, options.onK));
    const generate = button(options.searching ? "Grouping tableaux…" : "Generate equivalence table", options.onGenerate, "button button--primary");
    generate.disabled = options.searching;
    setup.append(generate);
    if (options.searching)
        setup.append(button("Cancel equivalence search", options.onCancel));
    const limits = element("details", { className: "ladder-search-limits" });
    limits.append(element("summary", { text: "Analysis limits" }), numeric("Equivalence search up to n", options.maxBoardSize, 30, options.onMaxBoard), numeric("Equivalence tableau limit", options.maxTableaux, 2000, options.onMaxTableaux), numeric("Equivalence search state limit", options.effort, 10_000_000, options.onEffort), element("p", { className: "field-help", text: "The search state limit covers the entire analysis. Individual trees use the states-per-game-tree limit above. Every displayed tableau has a certified minimum board. A limit or cancellation stops without displaying a partial table as complete." }));
    section.append(setup, limits, element("p", { className: "tableau-search-status", text: options.status, attributes: { id: "equivalence-status", role: "status", "aria-live": "polite" } }));
    if (options.error !== undefined)
        section.append(element("p", { className: "generation-error", text: options.error, attributes: { role: "alert" } }));
    if (options.result === undefined)
        return section;
    const result = options.result;
    const output = element("div", { className: "equivalence-output" });
    output.append(element("h3", { text: `Minimal starting positions · boards n=${result.minBoardSize}${result.maxBoardSize === result.minBoardSize ? "" : `–${result.maxBoardSize}`} · exactly ${result.k} white checkers` }), element("p", { text: `${result.rows.length} minimal starting positions · all ${result.tableauCount} distinct tableaux represented. Each row’s board is minimal for every tableau listed in that row.` }));
    const filterLabel = "Only rows with multiple equivalent tableaux";
    const filterInput = element("input", { attributes: { type: "checkbox", "aria-label": filterLabel } });
    filterInput.checked = options.onlyMultiple;
    filterInput.addEventListener("change", () => options.onOnlyMultipleChange(filterInput.checked));
    const filter = element("label", { className: "toggle-control equivalence-filter" });
    filter.append(filterInput, element("span", { className: "toggle-track" }), element("span", { text: filterLabel }));
    output.append(filter);
    const visibleCount = result.rows.filter((row) => !options.onlyMultiple || row.tableaux.length > 1).length;
    output.append(element("p", { className: "results-meta", text: `Showing ${visibleCount} of ${result.rows.length} starting positions.` }));
    if (visibleCount === 0) {
        output.append(element("p", { text: "No starting positions contain more than one distinct equivalent tableau." }));
        section.append(output);
        return section;
    }
    const scroll = element("div", { className: "equivalence-table-scroll" });
    const table = element("table", { className: "equivalence-table" });
    table.append(element("caption", { text: `Tableaux of shape (${result.shape.join(", ") || "∅"}) grouped by minimal checker-game starting position, with k=${result.k}` }));
    const head = element("thead");
    const headings = element("tr");
    headings.append(element("th", { text: "Minimal starting position", attributes: { scope: "col" } }), element("th", { text: "Equivalent tableaux (minimal at this start)", attributes: { scope: "col" } }));
    head.append(headings);
    const body = element("tbody");
    result.rows.forEach((row, index) => {
        if (options.onlyMultiple && row.tableaux.length <= 1)
            return;
        const tr = element("tr", { attributes: { "data-equivalence-row": String(index) } });
        const start = element("th", { attributes: { scope: "row" } });
        start.append(element("p", { text: `Start ${index + 1} · ${row.tree.n} × ${row.tree.n} (minimal)` }), element("p", { text: `A = ${formatSubset(row.tree.A)}; B = ${formatSubset(row.tree.B)}` }), button("Explore starting position", () => options.onStart(row), "button button--small"));
        const cell = element("td");
        const tiles = element("div", { className: "equivalence-tableaux" });
        for (const entry of row.tableaux)
            for (const leafId of entry.leafIds) {
                const leaf = row.tree.nodesById.get(leafId);
                const tile = element("article", { className: "equivalence-tableau" });
                const pair = element("div", { className: "equivalence-tableau-pair" });
                pair.append(createTableau({ events: leaf.state.tableauEvents, rowCount: result.k, compact: true, onCellClick: (event) => options.onEvent(row, leafId, event) }));
                const finalBoard = element("figure", { className: "equivalence-final-board", attributes: { "data-leaf-id": leafId } });
                finalBoard.append(createCheckerBoard({ n: row.tree.n, black: leaf.state.black, white: leaf.state.white, ...boardMoveOptions(row.tree, leaf), compact: true, showLabels: true, pixelSize: 160 }), element("figcaption", { text: "Final state" }));
                pair.append(finalBoard);
                tile.append(pair, button("Trace this game", () => options.onGame(row, leafId), "button button--small"));
                tiles.append(tile);
            }
        cell.append(element("p", { className: "results-meta", text: `${row.tableaux.length} distinct tableaux · ${row.tableaux.reduce((sum, entry) => sum + entry.leafIds.length, 0)} minimal-board games` }), tiles);
        tr.append(start, cell);
        body.append(tr);
    });
    table.append(head, body);
    scroll.append(table);
    output.append(scroll);
    section.append(output);
    return section;
}
//# sourceMappingURL=TableauEquivalence.js.map
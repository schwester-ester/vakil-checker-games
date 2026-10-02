import { formatSubset } from "../math/validation.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { button, element, labelledControl, setDisabled } from "./dom.js";
function numericInput(value, min, max, onChange) {
    const input = element("input", {
        className: "number-input",
        attributes: {
            type: "number",
            min: String(min),
            max: String(max),
            value: String(value),
            inputmode: "numeric",
        },
    });
    input.addEventListener("change", () => {
        const next = Number(input.value);
        if (Number.isInteger(next))
            onChange(Math.max(min, Math.min(max, next)));
    });
    return input;
}
function statusItem(ok, text, pending = false) {
    const item = element("li", {
        className: `validation-item ${pending ? "validation-item--pending" : ok ? "validation-item--ok" : "validation-item--error"}`,
    });
    item.append(element("span", {
        className: "validation-symbol",
        text: pending ? "·" : ok ? "✓" : "×",
    }), element("span", { text }));
    return item;
}
function segment(label, active, onClick) {
    const control = button(label, onClick, `segment${active ? " segment--active" : ""}`);
    control.setAttribute("aria-pressed", String(active));
    return control;
}
export function createInputPanel(options) {
    const section = element("section", {
        className: "input-card panel-card",
        attributes: { "aria-labelledby": "input-heading" },
    });
    const headingRow = element("div", { className: "panel-heading-row" });
    const heading = element("div");
    heading.append(element("p", { className: "eyebrow", text: "Input" }), element("h2", { className: "panel-title", text: "Initial checker position", attributes: { id: "input-heading" } }));
    const mode = element("div", { className: "segmented", attributes: { role: "group", "aria-label": "Input mode" } });
    mode.append(segment("Board", options.mode === "board", () => options.onModeChange("board")), segment("Subsets", options.mode === "subsets", () => options.onModeChange("subsets")));
    headingRow.append(heading, mode);
    const setup = element("div", { className: "setup-controls" });
    setup.append(labelledControl("Board size n", numericInput(options.n, 1, Math.max(10, options.n), options.onNChange)), labelledControl("White checkers k", numericInput(options.k, 0, options.n, options.onKChange)));
    const workArea = element("div", { className: "input-work-area" });
    const boardColumn = element("div", { className: "input-board-column" });
    boardColumn.append(element("div", {
        className: "board-caption",
        text: options.mode === "board" ? "Click a square to toggle a white checker." : "The board updates from A and B.",
    }), createCheckerBoard({
        n: options.n,
        black: options.black,
        white: options.white,
        pixelSize: Math.min(430, 40 * options.n + 34),
        showLabels: true,
        interactive: options.mode === "board",
        invalidWhite: options.white.length > 0 && !options.validation.valid,
        onToggleWhite: options.onToggleWhite,
    }), element("div", {
        className: `checker-count${options.white.length === options.k ? " checker-count--complete" : ""}`,
        text: `Number placed: ${options.white.length} / ${options.k}`,
    }));
    const details = element("div", { className: "input-details" });
    if (options.mode === "subsets") {
        const subsetFields = element("div", { className: "subset-fields" });
        const inputA = element("input", {
            className: `subset-input${options.subsetErrors.some((error) => error.startsWith("A:")) ? " subset-input--error" : ""}`,
            attributes: {
                type: "text",
                value: options.subsetA,
                placeholder: "2, 4",
                "aria-label": "Subset A",
                spellcheck: "false",
            },
        });
        const inputB = element("input", {
            className: `subset-input${options.subsetErrors.some((error) => error.startsWith("B:")) ? " subset-input--error" : ""}`,
            attributes: {
                type: "text",
                value: options.subsetB,
                placeholder: "2, 4",
                "aria-label": "Subset B",
                spellcheck: "false",
            },
        });
        inputA.addEventListener("input", () => options.onSubsetAChange(inputA.value));
        inputB.addEventListener("input", () => options.onSubsetBChange(inputB.value));
        subsetFields.append(labelledControl("A", inputA), labelledControl("B", inputB), element("p", {
            className: "field-help",
            text: `Enter ${options.k} distinct integers from 1 to ${options.n}, separated by commas or spaces.`,
        }));
        details.append(subsetFields);
    }
    const inferred = element("div", { className: "inferred-subsets" });
    inferred.append(element("div", { className: "math-chip", html: `<span class="math-chip-label">A</span><span>${formatSubset(options.validation.A)}</span>` }), element("div", { className: "math-chip", html: `<span class="math-chip-label">B</span><span>${formatSubset(options.validation.B)}</span>` }));
    details.append(inferred);
    const validationList = element("ul", { className: "validation-list" });
    const countPending = options.white.length !== options.k;
    validationList.append(statusItem(options.validation.countCorrect, `Exactly ${options.k} white checker${options.k === 1 ? "" : "s"}`, countPending), statusItem(options.validation.distinctRows, "Distinct rows", options.white.length === 0 && options.k > 0), statusItem(options.validation.distinctColumns, "Distinct columns", options.white.length === 0 && options.k > 0), statusItem(options.validation.vakilForm, "Vakil initial form (columns decrease as rows increase)", options.white.length < 2), statusItem(options.validation.allHappy, "All white checkers are happy", !options.validation.countCorrect));
    details.append(validationList);
    const errors = [...options.subsetErrors, ...options.validation.errors];
    if (errors.length > 0) {
        const errorBox = element("div", { className: "validation-message", attributes: { role: "status" } });
        errorBox.append(...[...new Set(errors)].map((error) => element("p", { text: error })));
        details.append(errorBox);
    }
    else {
        details.append(element("div", {
            className: "validation-message validation-message--ok",
            text: "Valid initial position. The checker-game tree can be generated.",
            attributes: { role: "status" },
        }));
    }
    if (options.generationError !== undefined) {
        details.append(element("div", {
            className: "generation-error",
            text: options.generationError,
            attributes: { role: "alert" },
        }));
    }
    workArea.append(boardColumn, details);
    const actions = element("div", { className: "input-actions" });
    const generate = button("Generate checker games", options.onGenerate, "button button--primary button--generate");
    setDisabled(generate, !options.validation.valid || options.subsetErrors.length > 0);
    actions.append(button("Clear", options.onClear, "button"), button("Example: n=4", options.onExample4, "button"), button("Example: n=6", options.onExample6, "button"), generate);
    section.append(headingRow, setup, workArea, actions);
    return section;
}
//# sourceMappingURL=InputPanel.js.map
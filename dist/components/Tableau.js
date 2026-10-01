import { tableauFromEvents } from "../math/tableau.js";
import { element } from "./dom.js";
export function createTableau(options) {
    const rows = tableauFromEvents(options.events, options.rowCount);
    const wrapper = element("div", {
        className: `tableau${options.compact ? " tableau--compact" : ""}`,
    });
    const nonemptyRows = rows.filter((row) => row.length > 0);
    if (nonemptyRows.length === 0) {
        wrapper.append(element("span", { className: "empty-tableau", text: "∅" }));
        return wrapper;
    }
    rows.forEach((row, index) => {
        if (row.length === 0)
            return;
        const rowElement = element("div", { className: "tableau-row" });
        if (options.showRowLabels === true) {
            rowElement.append(element("span", { className: "tableau-row-label", text: `${index + 1}` }));
        }
        for (const cell of row) {
            const cellElement = element("button", {
                className: "tableau-cell",
                text: String(cell.value),
                attributes: {
                    type: "button",
                    title: `Created at checker step ${cell.event.step}; click to inspect that move.`,
                    "aria-label": `Tableau entry ${cell.value}, created at step ${cell.event.step}`,
                },
            });
            if (options.onCellClick === undefined) {
                cellElement.disabled = true;
            }
            else {
                cellElement.addEventListener("click", () => options.onCellClick?.(cell.event));
            }
            rowElement.append(cellElement);
        }
        wrapper.append(rowElement);
    });
    return wrapper;
}
//# sourceMappingURL=Tableau.js.map
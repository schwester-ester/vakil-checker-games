import { positionKey } from "../math/positions.js";
import { svgElement } from "./dom.js";
export function createCheckerBoard(options) {
    const cell = options.compact ? 18 : 34;
    const labelMargin = options.showLabels === false ? 3 : options.compact ? 15 : 24;
    const boardSize = options.n * cell;
    const total = boardSize + labelMargin + 4;
    const svg = svgElement("svg", {
        class: `checker-board${options.compact ? " checker-board--compact" : ""}`,
        viewBox: `0 0 ${total} ${total}`,
        width: options.pixelSize ?? total,
        height: options.pixelSize ?? total,
        role: "img",
        "aria-label": `${options.n} by ${options.n} checkerboard`,
    });
    const origin = labelMargin;
    svg.append(svgElement("rect", {
        x: origin,
        y: origin,
        width: boardSize,
        height: boardSize,
        class: "board-background",
        rx: options.compact ? 1 : 3,
    }));
    if (options.annotations !== undefined) {
        const { blackMove } = options.annotations;
        svg.append(svgElement("rect", {
            x: origin,
            y: origin + (blackMove.criticalRow - 1) * cell,
            width: boardSize,
            height: cell,
            class: "annotation-critical-row",
        }));
        for (const square of blackMove.criticalDiagonal) {
            svg.append(svgElement("rect", {
                x: origin + (square.col - 1) * cell,
                y: origin + (square.row - 1) * cell,
                width: cell,
                height: cell,
                class: "annotation-critical-diagonal",
            }));
        }
    }
    for (let index = 0; index <= options.n; index += 1) {
        svg.append(svgElement("line", {
            x1: origin,
            y1: origin + index * cell,
            x2: origin + boardSize,
            y2: origin + index * cell,
            class: "board-grid-line",
        }), svgElement("line", {
            x1: origin + index * cell,
            y1: origin,
            x2: origin + index * cell,
            y2: origin + boardSize,
            class: "board-grid-line",
        }));
    }
    if (options.showLabels !== false) {
        for (let index = 1; index <= options.n; index += 1) {
            const columnLabel = svgElement("text", {
                x: origin + (index - 0.5) * cell,
                y: origin - (options.compact ? 4 : 7),
                class: "board-label",
                "text-anchor": "middle",
            });
            columnLabel.textContent = String(index);
            const rowLabel = svgElement("text", {
                x: origin - (options.compact ? 5 : 8),
                y: origin + (index - 0.5) * cell + (options.compact ? 3 : 4),
                class: "board-label",
                "text-anchor": "middle",
            });
            rowLabel.textContent = String(index);
            svg.append(columnLabel, rowLabel);
        }
    }
    const blackMove = options.annotations?.blackMove;
    const blockers = new Set((options.annotations?.blockers ?? []).map(positionKey));
    for (const checker of options.black) {
        const cx = origin + (checker.col - 0.5) * cell;
        const cy = origin + (checker.row - 0.5) * cell;
        svg.append(svgElement("circle", {
            cx,
            cy,
            r: cell * 0.26,
            class: "black-checker",
        }));
        if (blackMove !== undefined &&
            checker.row === blackMove.descending.row &&
            checker.col === blackMove.descending.col) {
            svg.append(svgElement("circle", {
                cx,
                cy,
                r: cell * 0.37,
                class: "descending-marker",
            }));
        }
        if (blackMove !== undefined &&
            checker.row === blackMove.rising.row &&
            checker.col === blackMove.rising.col) {
            svg.append(svgElement("circle", {
                cx,
                cy,
                r: cell * 0.37,
                class: "rising-marker",
            }));
        }
    }
    for (const checker of options.white) {
        const cx = origin + (checker.col - 0.5) * cell;
        const cy = origin + (checker.row - 0.5) * cell;
        const classNames = ["white-checker"];
        if (options.invalidWhite === true)
            classNames.push("white-checker--invalid");
        if (blockers.has(positionKey(checker)))
            classNames.push("white-checker--blocker");
        svg.append(svgElement("circle", {
            cx,
            cy,
            r: cell * 0.17,
            class: classNames.join(" "),
        }));
    }
    if (options.interactive === true && options.onToggleWhite !== undefined) {
        for (let row = 1; row <= options.n; row += 1) {
            for (let col = 1; col <= options.n; col += 1) {
                const hit = svgElement("rect", {
                    x: origin + (col - 1) * cell,
                    y: origin + (row - 1) * cell,
                    width: cell,
                    height: cell,
                    class: "board-hit-target",
                    tabindex: "0",
                    role: "button",
                    "aria-label": `Toggle white checker at row ${row}, column ${col}`,
                });
                const toggle = () => options.onToggleWhite?.({ row, col });
                hit.addEventListener("click", toggle);
                hit.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle();
                    }
                });
                svg.append(hit);
            }
        }
    }
    return svg;
}
//# sourceMappingURL=CheckerBoard.js.map
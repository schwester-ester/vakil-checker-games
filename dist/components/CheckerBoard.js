import { positionKey } from "../math/positions.js";
import { svgElement } from "./dom.js";
import { createPipeDream } from "./PipeDream.js";
let nextArrowBoardId = 0;
let moveArrowsVisible = false;
let pipeDreamsVisible = false;
const arrowColors = { swap: "#a044c2", west: "#d06410", north: "#007fa3" };
/** The page rerenders after changing this setting, including diagrams populated later. */
export function setPipeDreamsVisible(visible) {
    pipeDreamsVisible = visible;
}
export function setCheckerMoveArrowsVisible(visible) {
    moveArrowsVisible = visible;
    for (const overlay of document.querySelectorAll(".checker-move-arrows")) {
        overlay.style.display = visible ? "inline" : "none";
    }
}
export function createCheckerBoard(options) {
    const cell = options.compact ? 18 : 34;
    const labelMargin = options.showLabels === false ? 3 : options.compact ? 15 : 24;
    const boardSize = options.n * cell;
    const total = boardSize + labelMargin + 4;
    const showPipeDream = pipeDreamsVisible && options.pipeDream !== undefined;
    const fullWidth = showPipeDream ? total * 2 + 12 : total;
    const svg = svgElement("svg", {
        class: `checker-board${options.compact ? " checker-board--compact" : ""}${options.initialWhite !== undefined ? " checker-board--final" : ""}`,
        viewBox: `0 0 ${fullWidth} ${total}`,
        width: (options.pixelSize ?? total) * fullWidth / total,
        height: options.pixelSize ?? total,
        role: "img",
        "aria-label": `${options.n} by ${options.n} checkerboard${showPipeDream ? " beside its reflected numbered pipe dream" : ""}`,
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
    if (options.movePaths !== undefined || (options.moveArrows !== undefined && options.moveArrows.length > 0)) {
        const arrows = svgElement("g", { class: "checker-move-arrows", "pointer-events": "none" });
        arrows.style.display = moveArrowsVisible ? "inline" : "none";
        const defs = svgElement("defs");
        const boardId = nextArrowBoardId++;
        for (const kind of ["swap", "west", "north"]) {
            const marker = svgElement("marker", {
                id: `checker-arrow-${boardId}-${kind}`, viewBox: "0 0 8 8", refX: 7, refY: 4,
                markerWidth: 5, markerHeight: 5, orient: "auto", markerUnits: "strokeWidth",
            });
            marker.append(svgElement("path", { d: "M 0 0 L 8 4 L 0 8 Z", fill: arrowColors[kind], class: `move-arrow-head move-arrow--${kind}` }));
            defs.append(marker);
        }
        arrows.append(defs);
        const routes = options.movePaths?.map((route) => {
            const group = svgElement("g", { class: "checker-route", "data-checker-index": route.checkerIndex });
            const title = svgElement("title");
            title.textContent = `White checker ${route.checkerIndex + 1}: (${route.start.row},${route.start.col}) → (${route.end.row},${route.end.col})${route.moves.length === 0 ? " (stationary)" : ""}`;
            group.append(title, svgElement("circle", {
                cx: origin + (route.start.col - 0.5) * cell,
                cy: origin + (route.start.row - 0.5) * cell,
                r: cell * 0.08,
                class: "checker-route-start",
                fill: "#fff", stroke: "#52606d", "stroke-width": 1,
            }));
            arrows.append(group);
            return { moves: route.moves, group, continuous: true };
        }) ?? [{ moves: options.moveArrows ?? [], group: arrows, continuous: false }];
        for (const route of routes)
            for (const [moveIndex, arrow] of route.moves.entries()) {
                const points = arrow.points.map(({ row, col }) => ({ x: origin + (col - 0.5) * cell, y: origin + (row - 0.5) * cell }));
                const first = points[0];
                const last = points[points.length - 1];
                const next = points[1];
                const previous = points[points.length - 2];
                // Leave the checker centers visible, with the tip beside the destination.
                const inset = cell * 0.23;
                const towards = (a, b, distance) => {
                    const length = Math.hypot(b.x - a.x, b.y - a.y);
                    return { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length };
                };
                const start = route.continuous ? first : towards(first, next, inset);
                const end = route.continuous && moveIndex < route.moves.length - 1 ? last : towards(last, previous, inset);
                let d = `M ${start.x} ${start.y}`;
                for (let index = 1; index < points.length - 1; index += 1) {
                    const corner = points[index];
                    const before = points[index - 1];
                    const after = points[index + 1];
                    const radius = Math.min(cell * 0.22, Math.hypot(corner.x - before.x, corner.y - before.y) * 0.25, Math.hypot(after.x - corner.x, after.y - corner.y) * 0.25);
                    const entry = towards(corner, before, radius);
                    const exit = towards(corner, after, radius);
                    d += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;
                }
                d += ` L ${end.x} ${end.y}`;
                const path = svgElement("path", {
                    d, class: `checker-move-arrow move-arrow--${arrow.kind}`,
                    fill: "none", stroke: arrowColors[arrow.kind], "stroke-width": 1.8,
                    "stroke-linecap": "round", "stroke-linejoin": "round",
                    "marker-end": `url(#checker-arrow-${boardId}-${arrow.kind})`,
                });
                const title = svgElement("title");
                title.textContent = `Step ${arrow.step}: ${arrow.kind === "swap" ? "swap (including cleanup)" : arrow.kind === "west" ? "west slide" : "north slide (tableau entry)"}; ${arrow.points.map(({ row, col }) => `(${row},${col})`).join(" → ")}`;
                path.append(title);
                route.group.append(path);
            }
        svg.append(arrows);
    }
    if (options.initialWhite !== undefined) {
        const outlines = svgElement("g", { class: "checker-initial-positions", "pointer-events": "none" });
        for (const checker of options.initialWhite) {
            const outline = svgElement("circle", {
                cx: origin + (checker.col - 0.5) * cell,
                cy: origin + (checker.row - 0.5) * cell,
                r: cell * 0.22,
                class: "checker-initial-outline",
            });
            const title = svgElement("title");
            title.textContent = `Initial white checker at (${checker.row},${checker.col})`;
            outline.append(title);
            outlines.append(outline);
        }
        svg.append(outlines);
    }
    if (options.criticalSquares !== undefined && options.criticalSquares.length > 0) {
        const squares = svgElement("g", { class: "checker-critical-squares", "pointer-events": "none" });
        for (const square of options.criticalSquares) {
            const group = svgElement("g", { "data-step": square.step, "data-row": square.row, "data-col": square.col });
            const title = svgElement("title");
            title.textContent = `Step ${square.step}: tableau entry ${square.entry}, critical square (${square.row},${square.col})`;
            const label = svgElement("text", {
                x: origin + (square.col - 0.5) * cell,
                y: origin + (square.row - 0.5) * cell,
                "text-anchor": "middle",
                "dominant-baseline": "central",
                "font-size": cell * 0.44,
                class: "checker-critical-entry",
            });
            label.textContent = String(square.entry);
            group.append(title, svgElement("rect", {
                x: origin + (square.col - 1) * cell,
                y: origin + (square.row - 1) * cell,
                width: cell,
                height: cell,
                class: "checker-critical-square",
            }), label);
            squares.append(group);
        }
        svg.append(squares);
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
    if (showPipeDream) {
        const dream = createPipeDream(options.pipeDream, cell, origin);
        dream.setAttribute("x", String(total + 12));
        svg.append(dream);
        svg.classList.add("checker-board--with-pipe-dream");
    }
    return svg;
}
//# sourceMappingURL=CheckerBoard.js.map
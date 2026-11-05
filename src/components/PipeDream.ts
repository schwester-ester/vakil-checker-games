import { reflectedPipeDreamCrossings, type NumberedPipeDream } from "../math/pipeDream.js";
import { svgElement } from "./dom.js";

export function createPipeDream(dream: NumberedPipeDream, cell: number, origin: number): SVGSVGElement {
  const boardSize = dream.n * cell;
  const total = boardSize + origin + 4;
  const svg = svgElement("svg", { class: "pipe-dream", viewBox: `0 0 ${total} ${total}`, width: total, height: total, role: "img", "aria-label": `Reflected numbered pipe dream for w = (${dream.permutation.join(", ")})` });
  const title = svgElement("title");
  title.textContent = `Pipe dream · w = (${dream.permutation.join(", ")}). Each crossing is labeled with its tableau entry; noncrossing squares are blank.`;
  svg.append(title, svgElement("rect", { x: origin, y: origin, width: boardSize, height: boardSize, class: "board-background" }));
  for (let i = 0; i <= dream.n; i++) {
    svg.append(
      svgElement("line", { x1: origin, x2: origin + boardSize, y1: origin + i * cell, y2: origin + i * cell, class: "board-grid-line" }),
      svgElement("line", { x1: origin + i * cell, x2: origin + i * cell, y1: origin, y2: origin + boardSize, class: "board-grid-line" }),
    );
  }
  if (origin >= 15) {
    const heading = svgElement("text", { x: origin + boardSize / 2, y: origin - 5, "text-anchor": "middle", class: "pipe-dream-heading", "font-size": cell * 0.3 });
    heading.textContent = "Pipe dream";
    svg.append(heading);
  }
  const crossings = reflectedPipeDreamCrossings(dream);
  for (const crossing of crossings) {
    const group = svgElement("g", { class: "pipe-dream-crossing", "data-row": crossing.row, "data-col": crossing.col, "data-tableau-row": crossing.tableauRow, "data-tableau-col": crossing.tableauCol, ...(crossing.event === undefined ? {} : { "data-step": crossing.event.step }) });
    const tooltip = svgElement("title");
    tooltip.textContent = `Tableau (${crossing.tableauRow},${crossing.tableauCol}): ${crossing.entry} → reflected crossing (${crossing.row},${crossing.col})${crossing.event === undefined ? "" : ` · recording step ${crossing.event.step}`}`;
    const label = svgElement("text", { x: origin + (crossing.col - 0.5) * cell, y: origin + (crossing.row - 0.5) * cell, "text-anchor": "middle", "dominant-baseline": "central", "font-size": cell * 0.44, class: "pipe-dream-entry" });
    label.textContent = String(crossing.entry);
    group.append(tooltip, svgElement("rect", { x: origin + (crossing.col - 1) * cell, y: origin + (crossing.row - 1) * cell, width: cell, height: cell, class: "pipe-dream-crossing-square" }), label);
    svg.append(group);
  }
  return svg;
}

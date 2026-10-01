import type { GameNode, GameTree } from "../math/types.js";
import { pathToNode } from "../math/generateGames.js";
import { createCheckerBoard } from "./CheckerBoard.js";
import { button, element, svgElement } from "./dom.js";

export interface FlowTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface GameTreeOptions {
  readonly tree: GameTree;
  readonly selectedNodeId: string;
  readonly collapsed: ReadonlySet<string>;
  readonly transform: FlowTransform;
  readonly onSelect: (nodeId: string) => void;
  readonly onToggleCollapsed: (nodeId: string) => void;
  readonly onExpandAll: () => void;
  readonly onCollapseBranches: () => void;
  readonly onTransformChange: (transform: FlowTransform) => void;
}

interface LayoutNode {
  readonly node: GameNode;
  readonly x: number;
  readonly y: number;
  readonly visibleChildren: readonly LayoutNode[];
}

const NODE_WIDTH = 142;
const NODE_HEIGHT = 142;
const HORIZONTAL_SPACING = 176;
const VERTICAL_SPACING = 174;
const TOP_MARGIN = 90;

function buildLayout(root: GameNode, collapsed: ReadonlySet<string>): {
  root: LayoutNode;
  all: LayoutNode[];
  width: number;
  height: number;
} {
  let leafIndex = 0;
  const all: LayoutNode[] = [];

  const visit = (node: GameNode): LayoutNode => {
    const visibleSource = collapsed.has(node.id) ? [] : node.children;
    const visibleChildren = visibleSource.map(visit);
    let x: number;
    if (visibleChildren.length === 0) {
      x = leafIndex * HORIZONTAL_SPACING + NODE_WIDTH / 2 + 30;
      leafIndex += 1;
    } else {
      x =
        visibleChildren.reduce((sum, child) => sum + child.x, 0) / visibleChildren.length;
    }
    const result: LayoutNode = {
      node,
      x,
      y: TOP_MARGIN + node.state.step * VERTICAL_SPACING,
      visibleChildren,
    };
    all.push(result);
    return result;
  };

  const layoutRoot = visit(root);
  const maxX = Math.max(...all.map(({ x }) => x)) + NODE_WIDTH / 2 + 40;
  const maxY = Math.max(...all.map(({ y }) => y)) + NODE_HEIGHT / 2 + 50;
  return {
    root: layoutRoot,
    all,
    width: Math.max(400, maxX),
    height: Math.max(400, maxY),
  };
}

function drawNode(
  layout: LayoutNode,
  selectedNodeId: string,
  highlightedIds: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
  onSelect: (nodeId: string) => void,
  onToggleCollapsed: (nodeId: string) => void,
): SVGGElement {
  const { node } = layout;
  const group = svgElement("g", {
    class: [
      "flow-node",
      node.id === selectedNodeId ? "flow-node--selected" : "",
      highlightedIds.has(node.id) ? "flow-node--path" : "",
    ]
      .filter(Boolean)
      .join(" "),
    transform: `translate(${layout.x - NODE_WIDTH / 2} ${layout.y - NODE_HEIGHT / 2})`,
    role: "button",
    tabindex: "0",
    "aria-label": `Checker state at step ${node.state.step}`,
  });
  group.append(
    svgElement("rect", {
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rx: 10,
      class: "flow-node-card",
    }),
  );

  const title = svgElement("text", {
    x: 10,
    y: 18,
    class: "flow-node-title",
  });
  title.textContent =
    node.state.step === 0
      ? "Initial"
      : `Step ${node.state.step}${node.branchLabel === undefined ? "" : ` · ${node.branchLabel}`}`;
  group.append(title);

  const board = createCheckerBoard({
    n: node.state.n,
    black: node.state.black,
    white: node.state.white,
    compact: true,
    showLabels: false,
    pixelSize: 102,
  });
  board.setAttribute("x", "20");
  board.setAttribute("y", "25");
  board.setAttribute("width", "102");
  board.setAttribute("height", "102");
  board.setAttribute("pointer-events", "none");
  group.append(board);

  if (node.children.length > 1) {
    const badge = svgElement("g", {
      transform: `translate(${NODE_WIDTH - 26} 8)`,
      class: "branch-badge",
    });
    badge.append(
      svgElement("circle", { cx: 9, cy: 9, r: 9, class: "branch-badge-circle" }),
    );
    const badgeText = svgElement("text", {
      x: 9,
      y: 12,
      "text-anchor": "middle",
      class: "branch-badge-text",
    });
    badgeText.textContent = String(node.children.length);
    badge.append(badgeText);
    group.append(badge);
  }

  if (node.children.length > 0) {
    const collapse = svgElement("g", {
      class: "collapse-control",
      transform: `translate(${NODE_WIDTH / 2 - 10} ${NODE_HEIGHT - 16})`,
      role: "button",
      tabindex: "0",
      "aria-label": collapsed.has(node.id) ? "Expand subtree" : "Collapse subtree",
    });
    collapse.append(
      svgElement("rect", { x: 0, y: 0, width: 20, height: 14, rx: 5, class: "collapse-bg" }),
    );
    const collapseText = svgElement("text", {
      x: 10,
      y: 11,
      "text-anchor": "middle",
      class: "collapse-text",
    });
    collapseText.textContent = collapsed.has(node.id) ? "+" : "−";
    collapse.append(collapseText);
    const toggle = (event: Event): void => {
      event.stopPropagation();
      onToggleCollapsed(node.id);
    };
    collapse.addEventListener("click", toggle);
    collapse.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") toggle(event);
    });
    group.append(collapse);
  }

  const select = (): void => onSelect(node.id);
  group.addEventListener("click", select);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  });
  return group;
}

export function createGameTree(options: GameTreeOptions): HTMLElement {
  const section = element("section", { className: "flow-section" });
  const toolbar = element("div", { className: "flow-toolbar" });
  const viewport = element("div", { className: "flow-viewport" });
  const svg = svgElement("svg", {
    class: "flow-svg",
    width: "100%",
    height: "680",
    role: "application",
    "aria-label": "Checker-game branching flow diagram",
  });
  const transformGroup = svgElement("g", { class: "flow-transform" });
  svg.append(transformGroup);
  viewport.append(svg);

  const layout = buildLayout(options.tree.root, options.collapsed);
  const selectedPath = pathToNode(options.tree, options.selectedNodeId);
  const highlightedIds = new Set(selectedPath.map(({ id }) => id));
  const highlightedEdges = new Set(
    selectedPath.slice(1).map((node) => `${node.parentId ?? ""}->${node.id}`),
  );

  for (const parent of layout.all) {
    for (const child of parent.visibleChildren) {
      const path = svgElement("path", {
        d: `M ${parent.x} ${parent.y + NODE_HEIGHT / 2} C ${parent.x} ${parent.y + NODE_HEIGHT / 2 + 50}, ${child.x} ${child.y - NODE_HEIGHT / 2 - 50}, ${child.x} ${child.y - NODE_HEIGHT / 2}`,
        class: highlightedEdges.has(`${parent.node.id}->${child.node.id}`)
          ? "flow-edge flow-edge--path"
          : "flow-edge",
      });
      transformGroup.append(path);
      if (child.node.branchLabel !== undefined && parent.node.children.length > 1) {
        const edgeLabel = svgElement("text", {
          x: (parent.x + child.x) / 2,
          y: (parent.y + child.y) / 2,
          class: "flow-edge-label",
          "text-anchor": "middle",
        });
        edgeLabel.textContent = child.node.branchLabel;
        transformGroup.append(edgeLabel);
      }
    }
  }

  for (const node of layout.all) {
    transformGroup.append(
      drawNode(
        node,
        options.selectedNodeId,
        highlightedIds,
        options.collapsed,
        options.onSelect,
        options.onToggleCollapsed,
      ),
    );
  }

  let current: FlowTransform = { ...options.transform };
  const applyTransform = (): void => {
    transformGroup.setAttribute(
      "transform",
      `translate(${current.x} ${current.y}) scale(${current.scale})`,
    );
    options.onTransformChange(current);
  };
  const fit = (): void => {
    const width = Math.max(300, viewport.clientWidth);
    const height = 680;
    const scale = Math.min(1, (width - 50) / layout.width, (height - 50) / layout.height);
    current = { scale: Math.max(0.12, scale), x: 25, y: 25 };
    applyTransform();
  };
  const zoom = (factor: number): void => {
    current = { ...current, scale: Math.min(2.5, Math.max(0.12, current.scale * factor)) };
    applyTransform();
  };

  toolbar.append(
    button("Fit", fit, "button button--small"),
    button("Zoom in", () => zoom(1.2), "button button--small"),
    button("Zoom out", () => zoom(1 / 1.2), "button button--small"),
    button("Expand all", options.onExpandAll, "button button--small"),
    button("Collapse branches", options.onCollapseBranches, "button button--small"),
    element("span", {
      className: "toolbar-note",
      text: `${options.tree.nodeCount} nodes · drag to pan · wheel to zoom`,
    }),
  );

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  svg.addEventListener("pointerdown", (event) => {
    const target = event.target as Element;
    if (target.closest(".flow-node") !== null) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    svg.setPointerCapture(event.pointerId);
    viewport.classList.add("is-panning");
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    current = {
      ...current,
      x: current.x + event.clientX - lastX,
      y: current.y + event.clientY - lastY,
    };
    lastX = event.clientX;
    lastY = event.clientY;
    applyTransform();
  });
  const stopDragging = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-panning");
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  };
  svg.addEventListener("pointerup", stopDragging);
  svg.addEventListener("pointercancel", stopDragging);
  svg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.min(2.5, Math.max(0.12, current.scale * factor));
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;
      current = {
        scale: newScale,
        x: pointerX - worldX * newScale,
        y: pointerY - worldY * newScale,
      };
      applyTransform();
    },
    { passive: false },
  );

  applyTransform();
  section.append(toolbar, viewport);
  return section;
}

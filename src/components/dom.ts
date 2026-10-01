export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: string;
    attributes?: Record<string, string>;
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    node.setAttribute(name, value);
  }
  return node;
}

export function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  className = "button",
): HTMLButtonElement {
  const result = element("button", {
    className,
    text: label,
    attributes: { type: "button" },
  });
  result.addEventListener("click", onClick);
  return result;
}

export function labelledControl(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = element("label", { className: "labelled-control" });
  label.append(element("span", { className: "control-label", text: labelText }), control);
  return label;
}

export function setDisabled(control: HTMLButtonElement, disabled: boolean): void {
  control.disabled = disabled;
  control.setAttribute("aria-disabled", String(disabled));
}

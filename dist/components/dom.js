export function element(tag, options = {}) {
    const node = document.createElement(tag);
    if (options.className !== undefined)
        node.className = options.className;
    if (options.text !== undefined)
        node.textContent = options.text;
    if (options.html !== undefined)
        node.innerHTML = options.html;
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
        node.setAttribute(name, value);
    }
    return node;
}
export function svgElement(tag, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, String(value));
    }
    return node;
}
export function button(label, onClick, className = "button") {
    const result = element("button", {
        className,
        text: label,
        attributes: { type: "button" },
    });
    result.addEventListener("click", onClick);
    return result;
}
export function labelledControl(labelText, control) {
    const label = element("label", { className: "labelled-control" });
    label.append(element("span", { className: "control-label", text: labelText }), control);
    return label;
}
export function setDisabled(control, disabled) {
    control.disabled = disabled;
    control.setAttribute("aria-disabled", String(disabled));
}
//# sourceMappingURL=dom.js.map
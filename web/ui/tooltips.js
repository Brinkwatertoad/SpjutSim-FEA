/** Dependency-free compact and expanded tooltip coordination. */
(function initPortableUITooltips(scope) {
  "use strict";

  const createTooltipController = (input = {}) => {
    const doc = input.document ?? scope.document;
    const viewport = input.viewport ?? scope;
    const container = input.container ?? doc?.body;
    const getHelpEnabled = typeof input.getHelpEnabled === "function" ? input.getHelpEnabled : () => false;
    if (!doc?.createElement || !container?.append) {
      throw new Error("Portable tooltips require a document and container.");
    }
    const compact = doc.createElement("div");
    compact.className = "ui-tooltip";
    compact.dataset.tooltipSurface = "compact";
    compact.hidden = true;
    const expanded = doc.createElement("div");
    expanded.className = "ui-tooltip ui-tooltip-expanded";
    expanded.dataset.tooltipSurface = "expanded";
    expanded.hidden = true;
    container.append(compact, expanded);
    let activeCompact = null;
    let activeHelp = null;

    const mountForTarget = (node, target) => {
      const host = target?.closest?.("dialog[open]") || container;
      if (node.parentElement !== host) host.appendChild(node);
    };
    const position = (node, x, y) => {
      const rect = node.getBoundingClientRect?.() ?? {};
      const width = rect.width || node.offsetWidth || 0;
      const height = rect.height || node.offsetHeight || 0;
      const inset = 4;
      const left = Math.min(Math.max(inset, Number(x || 0) + 12), Math.max(inset, Number(viewport.innerWidth || 0) - width - inset));
      const top = Math.min(Math.max(inset, Number(y || 0) + 12), Math.max(inset, Number(viewport.innerHeight || 0) - height - inset));
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    };
    const hideCompact = (target) => {
      if (target && activeCompact !== target) return;
      activeCompact = null;
      compact.hidden = true;
    };
    const hideHelp = (target) => {
      if (target && activeHelp !== target) return;
      activeHelp = null;
      expanded.hidden = true;
    };
    const hideAll = () => { hideCompact(); hideHelp(); };
    const showCompact = (target, text, x, y) => {
      if (!text) return;
      mountForTarget(compact, target);
      activeCompact = target;
      compact.textContent = text;
      compact.hidden = false;
      position(compact, x, y);
    };
    const showHelp = (target, entry, x, y) => {
      mountForTarget(expanded, target);
      activeHelp = target;
      expanded.replaceChildren();
      const title = String(entry?.title ?? "").trim();
      const body = [entry?.summary, entry?.definition].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
      if (title) {
        const strong = doc.createElement("strong");
        strong.textContent = title;
        expanded.appendChild(strong);
      }
      if (body) {
        const detail = doc.createElement("div");
        detail.textContent = body;
        expanded.appendChild(detail);
      }
      expanded.hidden = false;
      position(expanded, x, y);
    };
    const anchorPosition = (element) => {
      const rect = element.getBoundingClientRect?.() ?? {};
      return { x: Number(rect.left || 0) + Number(rect.width || 0) / 2, y: Number(rect.top || 0) };
    };
    const attachTooltip = (element, text) => {
      if (!element?.addEventListener) return;
      element.dataset.tooltip = String(text ?? "").trim();
      if (!element.dataset.tooltip || element.dataset.tooltipBound === "1") return;
      element.dataset.tooltipBound = "1";
      let pointer = null;
      const show = (position) => {
        if (getHelpEnabled() && element.dataset.helpTitle) return;
        showCompact(element, element.dataset.tooltip, position.x, position.y);
      };
      element.addEventListener("mouseenter", (event) => { pointer = { x: event.clientX, y: event.clientY }; show(pointer); });
      element.addEventListener("mousemove", (event) => { pointer = { x: event.clientX, y: event.clientY }; show(pointer); });
      element.addEventListener("mouseleave", () => { pointer = null; hideCompact(element); });
      element.addEventListener("focus", () => show(pointer || anchorPosition(element)));
      element.addEventListener("blur", () => hideCompact(element));
    };
    const applyCustomTooltip = (element, text) => {
      if (!element) return;
      const normalized = String(text ?? "").trim();
      element.removeAttribute?.("title");
      if (!normalized) return;
      element.setAttribute?.("aria-label", normalized);
      attachTooltip(element, normalized);
    };
    const registerHelpTarget = (element, entry) => {
      if (!element?.addEventListener || !entry || element.dataset.helpBound === "1") return;
      element.dataset.helpBound = "1";
      element.dataset.helpTitle = String(entry.title ?? "");
      const show = (position) => { if (getHelpEnabled()) showHelp(element, entry, position.x, position.y); };
      element.addEventListener("mouseenter", (event) => show({ x: event.clientX, y: event.clientY }));
      element.addEventListener("mousemove", (event) => show({ x: event.clientX, y: event.clientY }));
      element.addEventListener("mouseleave", () => hideHelp(element));
      element.addEventListener("focus", () => show(anchorPosition(element)));
      element.addEventListener("blur", () => hideHelp(element));
    };
    const registerCompositeHelpTarget = (element, entry) => {
      if (!element?.addEventListener || !entry || element.dataset.compositeHelpBound === "1") return null;
      element.dataset.compositeHelpBound = "1";
      let pointerInside = false;
      let focusInside = false;
      let lastPointer = null;
      const show = (position) => {
        if (getHelpEnabled()) { hideCompact(element); showHelp(element, entry, position.x, position.y); }
        else { hideHelp(element); showCompact(element, String(entry.title ?? ""), position.x, position.y); }
      };
      const hideIfOutside = () => { if (!pointerInside && !focusInside) { hideCompact(element); hideHelp(element); } };
      element.addEventListener("mouseenter", (event) => { pointerInside = true; lastPointer = { x: event.clientX, y: event.clientY }; show(lastPointer); });
      element.addEventListener("mousemove", (event) => { lastPointer = { x: event.clientX, y: event.clientY }; show(lastPointer); });
      element.addEventListener("mouseleave", () => { pointerInside = false; lastPointer = null; hideIfOutside(); });
      element.addEventListener("focusin", () => { focusInside = true; show(lastPointer || anchorPosition(element)); });
      element.addEventListener("focusout", (event) => { if (element.contains?.(event.relatedTarget)) return; focusInside = false; hideIfOutside(); });
      return Object.freeze({ reset: () => { pointerInside = false; focusInside = false; lastPointer = null; hideCompact(element); hideHelp(element); } });
    };
    return Object.freeze({ compact, expanded, attachTooltip, applyCustomTooltip, registerHelpTarget, registerCompositeHelpTarget, hideHelp, hideAll });
  };

  scope.PortableUITooltips = Object.freeze({ createTooltipController });
}(typeof self !== "undefined" ? self : globalThis));

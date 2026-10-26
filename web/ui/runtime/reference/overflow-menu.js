/** Dependency-free compact overflow action menu. */
(function initPortableUIOverflowMenu(scope) {
  "use strict";
  const asArray = (value) => Array.isArray(value) ? value : [];
  const createOverflowMenu = (input = {}) => {
    const doc = input.document ?? scope.document;
    if (!doc?.createElement) throw new Error("Portable overflow menu requires a document.");
    const element = doc.createElement("div");
    element.className = `ui-overflow-menu${input.className ? ` ${input.className}` : ""}`;
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary icon-button ui-overflow-menu-toggle";
    toggle.textContent = "⋯";
    toggle.setAttribute("aria-label", String(input.label ?? "More actions"));
    toggle.setAttribute("aria-haspopup", "menu");
    toggle.setAttribute("aria-expanded", "false");
    const menu = doc.createElement("div");
    menu.className = "ui-overflow-menu-popup";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const items = new Map();
    const enabledItems = () => Array.from(items.values()).filter((item) => !item.disabled);
    const setOpen = (value, options = {}) => {
      const open = Boolean(value);
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        const rect = toggle.getBoundingClientRect?.();
        const viewportHeight = Number(scope.innerHeight ?? doc.documentElement?.clientHeight ?? 0);
        const above = rect && viewportHeight > 0 && viewportHeight - rect.bottom < 220 && rect.top > viewportHeight - rect.bottom;
        element.dataset.overflowPlacement = above ? "above" : "below";
        if (options.focusFirst !== false) enabledItems()[0]?.focus?.();
      } else if (options.restoreFocus) toggle.focus?.();
      return open;
    };
    const close = (options = {}) => setOpen(false, options);
    const open = (options = {}) => setOpen(true, options);
    const render = (definitions = input.actions) => {
      items.clear();
      menu.replaceChildren();
      asArray(definitions).forEach((definition) => {
        if (definition?.separator === true) {
          const separator = doc.createElement("div");
          separator.className = "ui-overflow-menu-separator";
          separator.setAttribute("role", "separator");
          menu.append(separator);
          return;
        }
        const id = String(definition?.id ?? "").trim();
        if (!id) return;
        const item = doc.createElement("button");
        item.type = "button";
        item.className = `secondary ui-overflow-menu-item${definition.danger ? " danger-action" : ""}`;
        item.dataset.overflowAction = id;
        item.setAttribute("role", "menuitem");
        item.textContent = String(definition.label ?? id);
        item.disabled = definition.disabled === true;
        if (definition.helpId) item.dataset.helpId = String(definition.helpId);
        item.addEventListener("click", () => {
          if (item.disabled) return;
          close({ restoreFocus: true });
          if (typeof definition.onSelect === "function") definition.onSelect(id);
          else if (typeof input.onAction === "function") input.onAction(id);
        });
        items.set(id, item);
        menu.append(item);
      });
      toggle.disabled = items.size === 0;
      return items;
    };
    const onToggle = (event) => {
      event?.stopPropagation?.();
      setOpen(menu.hidden, { focusFirst: true });
    };
    const onDocumentPointerDown = (event) => {
      if (!menu.hidden && !element.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        event.preventDefault();
        close({ restoreFocus: true });
        return;
      }
      if (menu.hidden || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const available = enabledItems();
      if (!available.length) return;
      event.preventDefault();
      const current = available.indexOf(doc.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? available.length - 1
        : event.key === "ArrowDown" ? (current + 1 + available.length) % available.length
          : (current - 1 + available.length) % available.length;
      available[next]?.focus?.();
    };
    toggle.addEventListener("click", onToggle);
    element.addEventListener("keydown", onKeyDown);
    doc.addEventListener?.("pointerdown", onDocumentPointerDown);
    element.append(toggle, menu);
    render();
    const destroy = () => {
      doc.removeEventListener?.("pointerdown", onDocumentPointerDown);
      toggle.removeEventListener("click", onToggle);
      element.removeEventListener("keydown", onKeyDown);
    };
    return Object.freeze({ element, toggle, menu, items, open, close, setOpen, render, destroy });
  };
  scope.PortableUIOverflowMenu = Object.freeze({ createOverflowMenu });
}(typeof self !== "undefined" ? self : globalThis));

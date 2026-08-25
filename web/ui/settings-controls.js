/** Dependency-free Settings presentation and shortcut coordination. */
(function initPortableUISettingsControls(scope) {
  "use strict";

  const asObject = (value) => (value && typeof value === "object" ? value : {});
  const addClass = (node, name) => node?.classList?.add?.(name);

  const createHeader = (input = {}) => {
    const args = asObject(input);
    const doc = args.document ?? scope.document;
    if (!doc?.createElement) throw new Error("Portable Settings controls require a document.");
    const element = doc.createElement("header");
    element.className = "ui-settings-header";
    const title = typeof args.title === "object" && args.title
      ? args.title
      : doc.createElement("h2");
    if (typeof args.title !== "object") title.textContent = String(args.title ?? "Settings");
    addClass(title, "ui-settings-title");
    const actionContainer = doc.createElement("div");
    actionContainer.className = "ui-settings-header-actions";
    const actions = {};
    Array.from(args.actions ?? []).forEach((descriptor, index) => {
      const action = asObject(descriptor);
      const id = String(action.id ?? `action-${index + 1}`);
      const node = action.node ?? doc.createElement("button");
      if (!action.node) {
        node.type = "button";
        node.textContent = String(action.label ?? id);
      }
      if (action.label && !node.getAttribute?.("aria-label")) {
        node.setAttribute?.("aria-label", String(action.label));
      }
      if (typeof action.onClick === "function") node.addEventListener?.("click", action.onClick);
      if (action.className) addClass(node, action.className);
      node.dataset.settingsAction = id;
      actions[id] = node;
      actionContainer.append(node);
    });
    element.append(title, actionContainer);
    return Object.freeze({ element, title, actionContainer, actions: Object.freeze(actions) });
  };

  const enhanceSwitches = (root) => {
    const candidates = String(root?.tagName ?? "").toUpperCase() === "INPUT"
      ? [root]
      : Array.from(root?.querySelectorAll?.('input[type="checkbox"]') ?? []);
    return candidates.filter((input) => String(input?.type ?? "").toLowerCase() === "checkbox")
      .map((input) => {
        addClass(input, "ui-switch-input");
        input.setAttribute?.("role", "switch");
        return input;
      });
  };

  const isEditableTarget = (target) => {
    const tagName = String(target?.tagName ?? "").toUpperCase();
    return ["INPUT", "TEXTAREA", "SELECT"].includes(tagName)
      || target?.isContentEditable === true
      || String(target?.getAttribute?.("contenteditable") ?? "").toLowerCase() === "true";
  };

  const bindHistoryShortcuts = (input = {}) => {
    const args = asObject(input);
    const target = args.target ?? scope.document;
    if (!target?.addEventListener || !target?.removeEventListener) {
      throw new Error("Portable Settings history shortcuts require an event target.");
    }
    const handleKeydown = (event) => {
      if (typeof args.isSessionOpen === "function" && !args.isSessionOpen()) return;
      if (!(event?.ctrlKey || event?.metaKey) || event?.altKey || isEditableTarget(event?.target)) return;
      const key = String(event?.key ?? "").toLowerCase();
      const redo = key === "y" || (key === "z" && event.shiftKey === true);
      const undo = key === "z" && event.shiftKey !== true;
      if (!undo && !redo) return;
      const callback = redo ? args.onRedo : args.onUndo;
      if (typeof callback !== "function") return;
      event.preventDefault?.();
      callback(event);
    };
    target.addEventListener("keydown", handleKeydown);
    return () => target.removeEventListener("keydown", handleKeydown);
  };

  const attachLabelHelp = (target, metadata) => {
    if (!target?.dataset) throw new Error("Portable Settings label help requires a target element.");
    const help = asObject(metadata);
    if (help.title != null) target.dataset.helpTitle = String(help.title);
    if (help.summary != null) target.dataset.helpSummary = String(help.summary);
    if (help.definition != null) target.dataset.helpDefinition = String(help.definition);
    addClass(target, "ui-help-target");
    return target;
  };

  scope.PortableUISettingsControls = Object.freeze({
    createHeader,
    enhanceSwitches,
    bindHistoryShortcuts,
    attachLabelHelp
  });
}(typeof self !== "undefined" ? self : globalThis));

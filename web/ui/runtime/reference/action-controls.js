/** Dependency-free action-icon binding and activation feedback. */
(function initPortableUIActionControls(scope) {
  "use strict";

  const requireFunction = (value, name) => {
    if (typeof value !== "function") throw new Error(`Portable action controls require ${name}.`);
    return value;
  };

  const applyActionIcon = (button, actionId, accessibleName, options = {}) => {
    if (!button?.replaceChildren || !button?.setAttribute) {
      throw new Error("Portable action controls require a button element.");
    }
    const createIcon = requireFunction(options.createIcon, "createIcon");
    const icon = createIcon(String(actionId));
    if (!icon) throw new Error(`Unknown action icon '${actionId}'.`);
    button.replaceChildren(icon);
    const visibleLabel = String(options.visibleLabel ?? "").trim();
    if (visibleLabel) {
      const doc = options.document ?? button.ownerDocument ?? scope.document;
      const label = doc.createElement("span");
      label.textContent = visibleLabel;
      button.appendChild(label);
    }
    button.dataset.actionIcon = String(actionId);
    button.setAttribute("aria-label", String(accessibleName));
    if (typeof options.attachTooltip === "function") options.attachTooltip(button, String(accessibleName));
    return button;
  };

  const createActivationFeedback = (input = {}) => {
    const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 140;
    const setTimer = input.setTimer ?? scope.setTimeout?.bind(scope);
    const clearTimer = input.clearTimer ?? scope.clearTimeout?.bind(scope);
    requireFunction(setTimer, "setTimer");
    requireFunction(clearTimer, "clearTimer");
    let timer = null;
    const clear = (button) => {
      if (timer !== null) clearTimer(timer);
      timer = null;
      if (button?.dataset) delete button.dataset.actionActivated;
    };
    const pulse = (button) => {
      if (!button?.dataset) throw new Error("Activation feedback requires a button element.");
      if (timer !== null) clearTimer(timer);
      button.dataset.actionActivated = "1";
      timer = setTimer(() => {
        delete button.dataset.actionActivated;
        timer = null;
      }, duration);
    };
    return Object.freeze({ pulse, clear });
  };

  scope.PortableUIActionControls = Object.freeze({ applyActionIcon, createActivationFeedback });
}(typeof self !== "undefined" ? self : globalThis));

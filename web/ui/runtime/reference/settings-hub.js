/** Dependency-free categorized Settings navigation for reference-merge consumers. */
(function initPortableUISettingsHub(scope) {
  "use strict";

  const createSettingsHub = (input = {}) => {
    const keys = Array.isArray(input.keys) ? input.keys.map((key) => String(key)) : [];
    const tabs = Array.isArray(input.tabs) ? input.tabs.slice() : [];
    const panels = Array.isArray(input.panels) ? input.panels.slice() : [];
    if (!keys.length || keys.length !== tabs.length || keys.length !== panels.length) {
      throw new Error("Portable Settings hub requires equally sized keys, tabs, and panels.");
    }
    if (tabs.some((tab) => typeof tab?.setAttribute !== "function") || panels.some((panel) => !panel)) {
      throw new Error("Portable Settings hub received an invalid tab or panel.");
    }

    let activeIndex = Math.max(0, keys.indexOf(String(input.initialKey ?? keys[0])));
    let opener = null;

    const setActive = (key, options = {}) => {
      const requested = keys.indexOf(String(key));
      activeIndex = requested >= 0 ? requested : 0;
      tabs.forEach((tab, index) => {
        const selected = index === activeIndex;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
        panels[index].hidden = !selected;
      });
      if (options.focus === true) tabs[activeIndex].focus?.();
      if (options.focusSelector && typeof panels[activeIndex].querySelector === "function") {
        panels[activeIndex].querySelector(options.focusSelector)?.focus?.();
      }
      return keys[activeIndex];
    };

    const handleKeydown = (event) => {
      const current = Math.max(0, tabs.indexOf(event.currentTarget));
      const key = String(event.key ?? "");
      const forward = key === "ArrowRight" || key === "ArrowDown";
      const reverse = key === "ArrowLeft" || key === "ArrowUp";
      if (!forward && !reverse && key !== "Home" && key !== "End") return;
      event.preventDefault?.();
      const target = key === "Home"
        ? 0
        : key === "End"
          ? tabs.length - 1
          : (current + (forward ? 1 : -1) + tabs.length) % tabs.length;
      setActive(keys[target], { focus: true });
    };

    const clickHandlers = tabs.map((tab, index) => {
      const callback = () => setActive(keys[index]);
      tab.addEventListener?.("click", callback);
      return callback;
    });
    tabs.forEach((tab) => tab.addEventListener?.("keydown", handleKeydown));

    const setOpener = (element) => {
      opener = element && typeof element.focus === "function" ? element : null;
    };
    const restoreOpenerFocus = () => {
      const target = opener;
      opener = null;
      target?.focus?.();
    };
    const getActiveKey = () => keys[activeIndex];
    const destroy = () => {
      tabs.forEach((tab, index) => {
        tab.removeEventListener?.("click", clickHandlers[index]);
        tab.removeEventListener?.("keydown", handleKeydown);
      });
      opener = null;
    };

    setActive(keys[activeIndex]);
    return Object.freeze({
      keys: keys.slice(),
      setActive,
      getActiveKey,
      handleKeydown,
      setOpener,
      restoreOpenerFocus,
      destroy
    });
  };

  scope.PortableUISettingsHub = Object.freeze({ createSettingsHub });
}(typeof self !== "undefined" ? self : globalThis));

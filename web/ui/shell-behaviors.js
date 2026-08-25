/** Dependency-free shell behavior reference for the phase-1 UI port. */
(function initPortableUIShellBehaviors(scope) {
  "use strict";

  const RESULTS_MODES = Object.freeze(["hidden", "split", "expanded"]);
  const AUTOCOLLAPSE_MODES = Object.freeze(["always", "small-screens", "never"]);
  const DEFAULT_UI_STATE = Object.freeze({
    toolsVisible: true,
    resultsMode: "split",
    resultsSplitRatio: 0.65,
    activeResultsTab: "results",
    colorScheme: "dark",
    autocollapseTools: "small-screens"
  });

  const asObject = (value) => (value && typeof value === "object" ? value : {});
  const asStringList = (value, fallback) => {
    const normalized = Array.isArray(value)
      ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];
    return normalized.length ? Array.from(new Set(normalized)) : fallback.slice();
  };
  const requireFunction = (value, name) => {
    if (typeof value !== "function") {
      throw new Error(`Portable UI shell requires '${name}' function.`);
    }
    return value;
  };
  const requireElement = (value, name) => {
    if (!value || !value.dataset || typeof value.setAttribute !== "function") {
      throw new Error(`Portable UI shell requires '${name}' element.`);
    }
    return value;
  };

  const clampSplitRatio = (value, fallback = DEFAULT_UI_STATE.resultsSplitRatio) => {
    const numeric = Number(value);
    const normalizedFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : DEFAULT_UI_STATE.resultsSplitRatio;
    const resolved = Number.isFinite(numeric) ? numeric : normalizedFallback;
    return Math.max(0.2, Math.min(0.8, resolved));
  };

  const normalizeUiState = (value, options = {}) => {
    const source = asObject(value);
    const args = asObject(options);
    const resultsTabs = asStringList(args.resultsTabs, [DEFAULT_UI_STATE.activeResultsTab]);
    const schemeKeys = asStringList(args.schemeKeys, ["light", "dark", "vivid"]);
    const resultsMode = RESULTS_MODES.includes(String(source.resultsMode ?? "").trim())
      ? String(source.resultsMode).trim()
      : DEFAULT_UI_STATE.resultsMode;
    const autocollapseTools = AUTOCOLLAPSE_MODES.includes(String(source.autocollapseTools ?? "").trim())
      ? String(source.autocollapseTools).trim()
      : DEFAULT_UI_STATE.autocollapseTools;
    const activeResultsTab = resultsTabs.includes(String(source.activeResultsTab ?? "").trim())
      ? String(source.activeResultsTab).trim()
      : resultsTabs[0];
    const colorScheme = schemeKeys.includes(String(source.colorScheme ?? "").trim().toLowerCase())
      ? String(source.colorScheme).trim().toLowerCase()
      : (schemeKeys.includes(DEFAULT_UI_STATE.colorScheme) ? DEFAULT_UI_STATE.colorScheme : schemeKeys[0]);
    return {
      toolsVisible: typeof source.toolsVisible === "boolean" ? source.toolsVisible : DEFAULT_UI_STATE.toolsVisible,
      resultsMode,
      resultsSplitRatio: clampSplitRatio(source.resultsSplitRatio),
      activeResultsTab,
      colorScheme,
      autocollapseTools
    };
  };

  const resolveResponsiveState = (width, options = {}) => {
    const args = asObject(options);
    const numericWidth = Number(width);
    const resolvedWidth = Number.isFinite(numericWidth) && numericWidth > 0 ? numericWidth : 0;
    const dockBelow = Number.isFinite(Number(args.dockBelow)) ? Number(args.dockBelow) : 700;
    const stackBelow = Number.isFinite(Number(args.stackBelow)) ? Number(args.stackBelow) : 900;
    return {
      width: resolvedWidth,
      dockedAllowed: resolvedWidth >= dockBelow,
      stacked: resolvedWidth < stackBelow,
      compact: resolvedWidth < 600
    };
  };

  const shouldAutoCollapseTools = (mode, width, compactThreshold = 600) => {
    const normalizedMode = AUTOCOLLAPSE_MODES.includes(String(mode ?? "").trim())
      ? String(mode).trim()
      : DEFAULT_UI_STATE.autocollapseTools;
    if (normalizedMode === "always") return true;
    if (normalizedMode === "never") return false;
    const numericWidth = Number(width);
    return Number.isFinite(numericWidth) && numericWidth > 0 && numericWidth < compactThreshold;
  };

  const applyPaneState = (input) => {
    const args = asObject(input);
    const root = requireElement(args.root, "root");
    const resultsLayout = requireElement(args.resultsLayout, "resultsLayout");
    if (!resultsLayout.style || typeof resultsLayout.style.setProperty !== "function") {
      throw new Error("Portable UI shell requires 'resultsLayout.style.setProperty' function.");
    }
    const requestResize = requireFunction(args.requestResize, "requestResize");
    const tabs = Array.isArray(args.resultsTabs) ? args.resultsTabs : [];
    const panels = Array.isArray(args.resultsPanels) ? args.resultsPanels : [];
    const state = normalizeUiState(args.state, {
      resultsTabs: tabs.map((entry) => entry?.dataset?.resultsTab).filter(Boolean),
      schemeKeys: args.schemeKeys
    });
    const responsive = asObject(args.responsiveState);
    const effectiveMode = responsive.dockedAllowed === false && state.resultsMode === "split"
      ? "expanded"
      : state.resultsMode;

    root.dataset.toolsVisible = state.toolsVisible ? "true" : "false";
    resultsLayout.dataset.resultsMode = effectiveMode;
    resultsLayout.dataset.resultsStacked = responsive.stacked === true ? "true" : "false";
    resultsLayout.style.setProperty("--ui-results-split-ratio", String(state.resultsSplitRatio));

    if (args.resultsDivider && typeof args.resultsDivider.setAttribute === "function") {
      args.resultsDivider.setAttribute("aria-orientation", responsive.stacked === true ? "horizontal" : "vertical");
    }
    if (args.toolsToggle && typeof args.toolsToggle.setAttribute === "function") {
      args.toolsToggle.setAttribute("aria-pressed", state.toolsVisible ? "true" : "false");
    }
    if (args.resultsToggle && typeof args.resultsToggle.setAttribute === "function") {
      args.resultsToggle.setAttribute("aria-pressed", effectiveMode === "hidden" ? "false" : "true");
    }
    tabs.forEach((tab) => {
      const selected = tab?.dataset?.resultsTab === state.activeResultsTab;
      tab?.setAttribute?.("aria-selected", selected ? "true" : "false");
      tab?.setAttribute?.("tabindex", selected ? "0" : "-1");
    });
    panels.forEach((panel) => {
      panel.hidden = panel?.dataset?.resultsPanel !== state.activeResultsTab;
    });
    requestResize({ state, effectiveMode, responsive });
    return { state, effectiveMode };
  };

  const createMenuController = (input) => {
    const args = asObject(input);
    const menuBar = args.menuBar;
    if (!menuBar || typeof menuBar.querySelectorAll !== "function") {
      throw new Error("Portable UI menu controller requires 'menuBar' element.");
    }
    const doc = args.document ?? (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.addEventListener !== "function") {
      throw new Error("Portable UI menu controller requires 'document' event target.");
    }
    const dispatchAction = requireFunction(args.dispatchAction, "dispatchAction");
    const positionMenu = typeof args.positionMenu === "function" ? args.positionMenu : (() => {});
    const groups = Array.from(menuBar.querySelectorAll("[data-ui-menu-group]"));
    let lastTrigger = null;

    const setGroupOpen = (group, open) => {
      group.dataset.open = open ? "true" : "false";
      const button = group.querySelector?.("[data-ui-menu-button]");
      button?.setAttribute?.("aria-expanded", open ? "true" : "false");
      if (open) {
        lastTrigger = button;
        const list = group.querySelector?.(".ui-menu-list");
        positionMenu(list, button);
      }
    };

    const closeAll = (options = {}) => {
      groups.forEach((group) => setGroupOpen(group, false));
      if (options.restoreFocus === true) {
        lastTrigger?.focus?.();
      }
    };

    const openGroup = (group) => {
      closeAll();
      setGroupOpen(group, true);
    };

    groups.forEach((group) => {
      const button = group.querySelector?.("[data-ui-menu-button]");
      button?.addEventListener?.("click", (event) => {
        event.stopPropagation?.();
        const wasOpen = group.dataset.open === "true";
        closeAll();
        if (!wasOpen) openGroup(group);
      });
      button?.addEventListener?.("mouseenter", () => {
        const hasOpenGroup = groups.some((entry) => entry.dataset.open === "true");
        if (hasOpenGroup && group.dataset.open !== "true") openGroup(group);
      });
    });

    menuBar.addEventListener?.("click", (event) => {
      const actionElement = event.target?.closest?.("[data-ui-menu-action]");
      if (!actionElement || actionElement.disabled) return;
      dispatchAction(String(actionElement.dataset.uiMenuAction ?? ""));
      closeAll();
    });

    const handleDocumentClick = (event) => {
      if (!menuBar.contains?.(event.target)) closeAll();
    };
    const handleDocumentKeydown = (event) => {
      if (String(event.key ?? "").toLowerCase() !== "escape") return;
      closeAll({ restoreFocus: true });
      event.preventDefault?.();
    };
    doc.addEventListener("click", handleDocumentClick);
    doc.addEventListener("keydown", handleDocumentKeydown);

    const setActionEnabled = (actionId, enabled) => {
      menuBar.querySelectorAll(`[data-ui-menu-action="${String(actionId)}"]`).forEach((element) => {
        element.disabled = enabled !== true;
        element.setAttribute?.("aria-disabled", enabled === true ? "false" : "true");
      });
    };

    return Object.freeze({ closeAll, openGroup, setActionEnabled });
  };

  scope.PortableUIShellBehaviors = Object.freeze({
    DEFAULT_UI_STATE,
    RESULTS_MODES,
    AUTOCOLLAPSE_MODES,
    clampSplitRatio,
    normalizeUiState,
    resolveResponsiveState,
    shouldAutoCollapseTools,
    applyPaneState,
    createMenuController
  });
}(typeof self !== "undefined" ? self : globalThis));

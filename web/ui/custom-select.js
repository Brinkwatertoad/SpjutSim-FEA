/** Dependency-free progressive enhancement for native single-choice selects. */
(function initPortableUICustomSelect(scope) {
  "use strict";

  const customSelectInstances = new WeakMap();
  const WIDTH_POLICIES = Object.freeze({
    matchTrigger: "match-trigger",
    fitOptions: "fit-options",
    triggerBoundedOpenFit: "trigger-bounded-open-fit",
    fullWidth: "full-width",
    fullWidthOpenFit: "full-width-open-fit"
  });
  const DEFAULT_WIDTH_POLICY = WIDTH_POLICIES.fitOptions;
  let generatedId = 0;

  const asObject = (value) => (value && typeof value === "object" ? value : {});
  const isSelect = (value) => String(value?.tagName ?? "").toUpperCase() === "SELECT";
  const normalizeId = (value, fallback) => String(value ?? "").trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
  const optionLabel = (option) => String(option?.textContent ?? option?.value ?? "").trim();
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const resolvePopupPlacement = (input = {}) => {
    const triggerRect = asObject(input.triggerRect);
    const popupSize = asObject(input.popupSize);
    const viewport = asObject(input.viewport);
    const inset = Math.max(0, finiteNumber(input.inset, 8));
    const gap = Math.max(0, finiteNumber(input.gap, 0));
    const viewportWidth = Math.max(inset * 2, finiteNumber(viewport.width, 360));
    const viewportHeight = Math.max(inset * 2, finiteNumber(viewport.height, 640));
    const triggerLeft = finiteNumber(triggerRect.left, inset);
    const triggerTop = finiteNumber(triggerRect.top, inset);
    const triggerBottom = finiteNumber(triggerRect.bottom, triggerTop + finiteNumber(triggerRect.height));
    const triggerWidth = Math.max(0, finiteNumber(
      triggerRect.width,
      finiteNumber(triggerRect.right, triggerLeft) - triggerLeft
    ));
    const width = Math.min(
      Math.max(triggerWidth, finiteNumber(popupSize.width, triggerWidth)),
      Math.max(0, viewportWidth - inset * 2)
    );
    const requestedHeight = Math.max(0, finiteNumber(popupSize.height));
    const spaceBelow = Math.max(0, viewportHeight - inset - triggerBottom - gap);
    const spaceAbove = Math.max(0, triggerTop - gap - inset);
    const placement = requestedHeight <= spaceBelow || spaceBelow >= spaceAbove ? "below" : "above";
    const availableHeight = placement === "below" ? spaceBelow : spaceAbove;
    const height = Math.min(requestedHeight, availableHeight);
    const left = Math.max(inset, Math.min(triggerLeft, viewportWidth - inset - width));
    const top = placement === "below"
      ? Math.min(viewportHeight - inset - height, triggerBottom + gap)
      : Math.max(inset, triggerTop - gap - height);
    return Object.freeze({ placement, left, top, width, height, maxHeight: availableHeight });
  };

  const normalizeWidthPolicy = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase() || DEFAULT_WIDTH_POLICY;
    if (!Object.values(WIDTH_POLICIES).includes(normalized)) {
      throw new Error(`Portable custom select received unsupported width policy '${normalized}'.`);
    }
    return normalized;
  };

  const getLabel = (select, fallback) => {
    const ariaLabel = String(select.getAttribute?.("aria-label") ?? "").trim();
    if (ariaLabel) return ariaLabel;
    const parent = select.closest?.("label");
    if (parent?.cloneNode) {
      const clone = parent.cloneNode(true);
      clone.querySelectorAll?.("select, input, button, textarea, .custom-select-menu-group")
        .forEach((entry) => entry.remove?.());
      const text = String(clone.textContent ?? "").replace(/\s+/g, " ").trim().replace(/:$/, "");
      if (text) return text;
    }
    return fallback;
  };

  const createCustomSelect = (input) => {
    const args = asObject(input);
    const select = args.select;
    if (!isSelect(select)) throw new Error("Portable custom select requires a native select.");
    const existing = customSelectInstances.get(select);
    if (existing) {
      existing.sync();
      return existing;
    }
    const doc = args.document ?? select.ownerDocument ?? scope.document;
    if (!doc?.createElement) throw new Error("Portable custom select requires a document.");

    const id = normalizeId(
      args.id ?? select.dataset?.customSelectId ?? select.id ?? select.name,
      `select-${generatedId += 1}`
    );
    const labelText = String(args.label ?? "").trim() || getLabel(select, id);
    const widthPolicy = normalizeWidthPolicy(args.widthPolicy ?? select.dataset?.customSelectWidthPolicy);
    const requestFrame = args.requestAnimationFrameFn
      ?? doc.defaultView?.requestAnimationFrame?.bind(doc.defaultView)
      ?? ((callback) => setTimeout(callback, 0));
    const positionPopover = typeof args.positionPopoverInViewport === "function"
      ? args.positionPopoverInViewport
      : (popup, rect) => {
        const viewportWidth = Number(doc.defaultView?.innerWidth ?? doc.documentElement?.clientWidth ?? 360);
        const viewportHeight = Number(doc.defaultView?.innerHeight ?? doc.documentElement?.clientHeight ?? 640);
        const width = Math.min(Math.max(rect.width, popup.scrollWidth || rect.width), Math.max(120, viewportWidth - 16));
        const resolved = resolvePopupPlacement({
          triggerRect: rect,
          popupSize: { width, height: popup.scrollHeight || popup.offsetHeight || 0 },
          viewport: { width: viewportWidth, height: viewportHeight },
          inset: 8,
          gap: 0
        });
        popup.style.left = `${resolved.left}px`;
        popup.style.top = `${resolved.top}px`;
        popup.style.width = `${resolved.width}px`;
        popup.style.maxHeight = `${resolved.maxHeight}px`;
        popup.dataset.customSelectPlacement = resolved.placement;
      };

    select.hidden = true;
    select.dataset.customSelectNative = id;
    select.dataset.customSelectWidthPolicy = widthPolicy;

    const group = doc.createElement("div");
    group.className = "menu-group custom-select-menu-group";
    group.dataset.customSelectGroup = id;
    group.dataset.customSelectWidthPolicy = widthPolicy;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "menu-button custom-select-button";
    button.dataset.customSelectButton = id;
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", labelText);
    const buttonLabel = doc.createElement("span");
    buttonLabel.className = "custom-select-button-label";
    const chevron = doc.createElement("span");
    chevron.className = "custom-select-button-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▼";
    button.append(buttonLabel, chevron);

    const list = doc.createElement("div");
    list.className = "menu-list custom-select-list";
    list.dataset.customSelectPopup = id;
    list.hidden = true;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", labelText);
    group.append(button, list);
    select.parentNode?.insertBefore(group, select);

    let isOpen = false;
    const optionButtons = () => Array.from(list.querySelectorAll("[data-custom-select-option]"));
    const close = (options = {}) => {
      isOpen = false;
      group.classList.remove("open");
      list.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (options.restoreFocus) button.focus();
    };
    const position = () => {
      if (isOpen) positionPopover(list, button.getBoundingClientRect(), { align: "start", gap: 0 });
    };

    const renderOptions = () => {
      list.replaceChildren();
      Array.from(select.children).forEach((entry) => {
        const groupLabel = String(entry.tagName ?? "").toUpperCase() === "OPTGROUP"
          ? String(entry.label ?? "").trim()
          : "";
        const options = groupLabel ? Array.from(entry.children) : [entry];
        if (groupLabel) {
          const heading = doc.createElement("div");
          heading.className = "custom-select-group-label";
          heading.textContent = groupLabel;
          list.appendChild(heading);
        }
        options.filter((option) => String(option.tagName ?? "").toUpperCase() === "OPTION").forEach((option) => {
          const optionButton = doc.createElement("button");
          optionButton.type = "button";
          optionButton.className = "menu-item custom-select-option";
          optionButton.dataset.customSelectOption = String(option.value ?? "");
          optionButton.dataset.customSelectSelected = option.selected ? "1" : "0";
          optionButton.setAttribute("role", "option");
          optionButton.setAttribute("aria-selected", option.selected ? "true" : "false");
          optionButton.disabled = option.disabled === true || entry.disabled === true;
          optionButton.textContent = optionLabel(option);
          optionButton.addEventListener("click", () => {
            if (optionButton.disabled) return;
            const previous = String(select.value ?? "");
            select.value = option.value;
            sync();
            close({ restoreFocus: true });
            if (previous !== String(select.value ?? "")) {
              select.dispatchEvent(new (doc.defaultView?.Event ?? Event)("change", { bubbles: true }));
            }
          });
          list.appendChild(optionButton);
        });
      });
    };

    const focusByIndex = (index) => {
      const enabled = optionButtons().filter((entry) => !entry.disabled);
      if (!enabled.length) return;
      enabled[(index + enabled.length) % enabled.length]?.focus();
    };
    const moveFocus = (delta) => {
      const enabled = optionButtons().filter((entry) => !entry.disabled);
      const current = enabled.indexOf(doc.activeElement);
      focusByIndex(current < 0 ? (delta > 0 ? 0 : enabled.length - 1) : current + delta);
    };
    const open = (options = {}) => {
      if (select.disabled) return;
      renderOptions();
      isOpen = true;
      group.classList.add("open");
      list.hidden = false;
      button.setAttribute("aria-expanded", "true");
      position();
      requestFrame(() => {
        position();
        const enabled = optionButtons().filter((entry) => !entry.disabled);
        const selected = enabled.find((entry) => entry.dataset.customSelectSelected === "1");
        (options.last ? enabled.at(-1) : selected ?? enabled[0])?.focus();
      });
    };

    function sync() {
      const selected = select.selectedOptions?.[0] ?? select.options?.[select.selectedIndex];
      buttonLabel.textContent = optionLabel(selected) || String(select.value ?? "");
      button.disabled = select.disabled === true;
      button.dataset.customSelectValue = String(select.value ?? "");
      if (isOpen) {
        renderOptions();
        position();
      }
    }

    const nativeValueDescriptor = Object.getOwnPropertyDescriptor(
      doc.defaultView?.HTMLSelectElement?.prototype ?? {},
      "value"
    );
    let installedValueSync = false;
    if (typeof nativeValueDescriptor?.get === "function"
      && typeof nativeValueDescriptor?.set === "function"
      && !Object.hasOwn(select, "value")) {
      Object.defineProperty(select, "value", {
        configurable: true,
        enumerable: true,
        get() { return nativeValueDescriptor.get.call(this); },
        set(value) {
          nativeValueDescriptor.set.call(this, value);
          sync();
        }
      });
      installedValueSync = true;
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (isOpen) close(); else open();
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      open({ last: event.key === "ArrowUp" });
    });
    list.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        close();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Escape") close({ restoreFocus: true });
      else if (event.key === "ArrowDown") moveFocus(1);
      else if (event.key === "ArrowUp") moveFocus(-1);
      else if (event.key === "Home") focusByIndex(0);
      else if (event.key === "End") focusByIndex(-1);
      else if (list.contains(doc.activeElement)) doc.activeElement.click();
    });
    select.addEventListener("change", sync);
    doc.addEventListener("pointerdown", (event) => {
      if (!group.contains(event.target)) close();
    });
    doc.defaultView?.addEventListener?.("scroll", position, true);
    doc.defaultView?.addEventListener?.("resize", position);

    const api = Object.freeze({
      group,
      button,
      popup: list,
      open,
      close,
      sync,
      destroy() {
        close();
        group.remove();
        select.hidden = false;
        delete select.dataset.customSelectNative;
        if (installedValueSync) delete select.value;
        customSelectInstances.delete(select);
      }
    });
    customSelectInstances.set(select, api);
    sync();
    return api;
  };

  const shouldEnhance = (select, options) => isSelect(select)
    && select.multiple !== true
    && select.dataset?.customSelectSkip !== "1"
    && (typeof options.filter !== "function" || options.filter(select) !== false);

  const enhanceSelects = (root, options = {}) => {
    const selects = isSelect(root) ? [root] : Array.from(root?.querySelectorAll?.("select") ?? []);
    return selects.filter((select) => shouldEnhance(select, options)).map((select) => createCustomSelect({
      select,
      document: options.document,
      widthPolicy: typeof options.resolveWidthPolicy === "function"
        ? options.resolveWidthPolicy(select)
        : options.widthPolicy,
      positionPopoverInViewport: options.positionPopoverInViewport,
      requestAnimationFrameFn: options.requestAnimationFrameFn
    }));
  };

  const getCustomSelect = (select) => customSelectInstances.get(select) ?? null;
  const syncCustomSelects = (root) => {
    const selects = isSelect(root) ? [root] : Array.from(root?.querySelectorAll?.("select") ?? []);
    selects.forEach((select) => customSelectInstances.get(select)?.sync());
  };

  scope.PortableUICustomSelect = Object.freeze({
    WIDTH_POLICIES,
    resolvePopupPlacement,
    createCustomSelect,
    enhanceSelects,
    getCustomSelect,
    syncCustomSelects
  });
}(typeof self !== "undefined" ? self : globalThis));

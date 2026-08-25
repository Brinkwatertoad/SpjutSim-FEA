/** Dependency-free color-scheme editor presentation and callback coordination. */
(function initPortableUIColorSchemeEditor(scope) {
  "use strict";

  const asObject = (value) => (value && typeof value === "object" ? value : {});
  const asArray = (value) => Array.isArray(value) ? value : [];
  const call = (callback, ...args) => typeof callback === "function" ? callback(...args) : undefined;
  const ACTION_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "import", label: "Import…", callback: "onImport", location: "toolbar" }),
    Object.freeze({ id: "export", label: "Export…", callback: "onExport", location: "toolbar" }),
    Object.freeze({ id: "duplicate", label: "Duplicate", callback: "onDuplicate", location: "toolbar" }),
    Object.freeze({ id: "delete", label: "Delete", callback: "onDelete", location: "toolbar", danger: true }),
    Object.freeze({ id: "restore", label: "Reset This Scheme", callback: "onRestore", location: "overflow" }),
    Object.freeze({ id: "reset", label: "Reset Color Schemes", callback: "onReset", location: "overflow" })
  ]);
  const getActionDefinitions = () => ACTION_DEFINITIONS.map((definition) => ({ ...definition }));

  const createButton = (doc, id, label, callback) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "secondary ui-color-scheme-action";
    button.dataset.colorSchemeAction = id;
    button.textContent = label;
    button.addEventListener("click", () => call(callback));
    return button;
  };

  const createEditor = (input = {}) => {
    const args = asObject(input);
    const doc = args.document ?? scope.document;
    const select = args.select;
    const overflowApi = args.overflowMenu ?? scope.PortableUIOverflowMenu;
    if (!doc?.createElement || !select?.addEventListener) {
      throw new Error("Portable color scheme editor requires a document and host-owned select.");
    }
    if (!overflowApi || typeof overflowApi.createOverflowMenu !== "function") {
      throw new Error("Portable color scheme editor requires the shared overflow menu.");
    }
    const element = doc.createElement("section");
    element.className = "ui-color-scheme-editor";
    const toolbar = doc.createElement("div");
    toolbar.className = "ui-color-scheme-toolbar";
    const nameInput = doc.createElement("input");
    nameInput.type = "text";
    nameInput.className = "ui-color-scheme-name";
    nameInput.setAttribute("aria-label", "Color scheme name");
    nameInput.addEventListener("input", () => call(args.onPreviewName, nameInput.value));
    nameInput.addEventListener("change", () => call(args.onRename, nameInput.value));
    const toolbarDefinitions = ACTION_DEFINITIONS.filter((definition) => definition.location === "toolbar");
    const toolbarActions = Object.fromEntries(toolbarDefinitions.map((definition) => [
      definition.id,
      createButton(doc, definition.id, definition.label, args[definition.callback])
    ]));
    toolbarActions.delete.classList.add("danger-action");
    toolbarActions.delete.dataset.actionIntent = "danger";
    const overflowDefinitions = ACTION_DEFINITIONS.filter((definition) => definition.location === "overflow");
    const overflowController = overflowApi.createOverflowMenu({
      document: doc,
      label: "More color scheme actions",
      actions: overflowDefinitions.map((definition) => definition.separator ? definition : ({
        ...definition,
        onSelect: () => call(args[definition.callback])
      }))
    });
    const actions = Object.freeze({
      ...toolbarActions,
      ...Object.fromEntries(ACTION_DEFINITIONS.filter((definition) => definition.location === "overflow")
        .map((definition) => [definition.id, overflowController.items.get(definition.id)]))
    });
    toolbar.append(
      select,
      nameInput,
      toolbarActions.import,
      toolbarActions.export,
      toolbarActions.duplicate,
      toolbarActions.delete,
      overflowController.element
    );
    const attachPicker = (pickerGroup, pickerButton) => {
      if (!pickerGroup?.classList || !pickerButton?.classList || typeof pickerGroup.insertBefore !== "function") {
        return false;
      }
      pickerGroup.classList.add("ui-color-scheme-picker");
      pickerButton.classList.add("ui-color-scheme-picker-menu-button");
      toolbar.insertBefore(pickerGroup, select);
      pickerGroup.insertBefore(nameInput, pickerButton);
      return true;
    };
    const fields = [];
    const createRoleSection = (titleText, definitions, section, advanced = false) => {
      const wrapper = advanced ? doc.createElement("details") : doc.createElement("section");
      wrapper.className = `ui-color-role-section${advanced ? " ui-color-role-advanced" : ""}`;
      const heading = doc.createElement(advanced ? "summary" : "h3");
      heading.textContent = titleText;
      wrapper.append(heading);
      const roleGrid = doc.createElement("div");
      roleGrid.className = "ui-color-role-grid";
      asArray(definitions).forEach((definition) => {
        const role = asObject(definition);
        const roleLabel = String(role.label ?? role.key ?? "Color");
        const roleSection = String(role.section ?? section);
        const roleDerived = role.derived === true || advanced;
        const row = doc.createElement("div");
        row.className = "ui-color-role-row";
        row.dataset.overrideState = roleDerived ? "derived" : "authored";
        const label = doc.createElement("span");
        label.className = "ui-color-role-label";
        label.textContent = roleLabel;
        const text = doc.createElement("input");
        text.type = "text";
        text.setAttribute("aria-label", roleLabel);
        const swatch = doc.createElement("input");
        swatch.type = "color";
        swatch.className = "ui-color-role-swatch";
        swatch.setAttribute("aria-label", `${roleLabel} picker`);
        const commit = (value) => call(args.onUpdateRole, roleSection, String(role.key), value);
        text.addEventListener("input", () => call(args.onPreviewRole, roleSection, String(role.key), text.value));
        text.addEventListener("change", () => commit(text.value));
        swatch.addEventListener("input", () => {
          text.value = swatch.value;
          call(args.onPreviewRole, roleSection, String(role.key), swatch.value);
        });
        swatch.addEventListener("change", () => commit(swatch.value));
        const clear = doc.createElement("button");
        clear.type = "button";
        clear.className = "ui-color-role-clear";
        clear.textContent = roleLabel;
        clear.setAttribute("aria-label", `Use derived ${roleLabel}`);
        clear.dataset.tooltip = `Use derived ${roleLabel}`;
        clear.hidden = !roleDerived;
        call(args.attachTooltip, clear, `Use derived ${roleLabel}`);
        clear.addEventListener("click", () => call(args.onClearOverride, roleSection, String(role.key)));
        row.append(label, text, swatch, clear);
        roleGrid.append(row);
        fields.push({ section: roleSection, key: String(role.key), label, text, swatch, clear, row, derived: roleDerived });
      });
      wrapper.append(roleGrid);
      return wrapper;
    };
    const interfaceRoles = args.interfaceRoles ?? args.sharedRoles;
    const interfaceSection = createRoleSection("Interface", interfaceRoles, "authored");
    const canvasSection = createRoleSection("Canvas", args.canvasRoles, "authored");
    const advanced = createRoleSection("Advanced Overrides", args.advancedRoles, "derivedOverrides", true);
    const extensionSections = Object.entries(asObject(args.extensions)).map(([namespace, config]) => {
      const extension = asObject(config);
      return createRoleSection(String(extension.label ?? namespace), extension.roles, `extensions.${namespace}`);
    });
    const preview = doc.createElement("div");
    preview.className = "ui-color-scheme-preview";
    preview.setAttribute("aria-label", "Color scheme preview");
    element.append(toolbar, preview, interfaceSection, canvasSection, ...extensionSections, advanced);

    const syncSelect = () => call(args.syncSelect, select);
    const sync = () => {
      const entry = asObject(call(args.getCurrentEntry));
      const resolved = asObject(call(args.resolveEntry, entry));
      nameInput.value = String(entry.label ?? "");
      nameInput.hidden = false;
      actions.restore.disabled = entry.resettable !== true;
      actions.restore.dataset.helpId = entry.resettable === true ? "" : String(entry.resetHelpId ?? "color-scheme-reset-unavailable");
      fields.forEach((field) => {
        const path = field.section.split(".");
        const map = path.reduce((value, key) => asObject(value)[key], entry) ?? {};
        const configured = asObject(map)[field.key];
        const color = String(field.derived && configured === undefined ? resolved[field.key] : configured ?? "").toLowerCase();
        field.text.value = color;
        if (/^#[0-9a-f]{6}$/.test(color)) field.swatch.value = color;
        if (field.derived) {
          const overridden = Object.prototype.hasOwnProperty.call(asObject(map), field.key);
          field.row.dataset.overrideState = overridden ? "override" : "derived";
          field.label.hidden = overridden;
          field.clear.hidden = !overridden;
        }
      });
      call(args.renderPreview, preview, entry);
      syncSelect();
      return entry;
    };
    select.addEventListener("change", () => {
      call(args.onSelect, select.value);
      sync();
    });
    sync();
    return Object.freeze({ element, toolbar, actions, nameInput, preview, overflowController, attachPicker, sync, syncSelect });
  };

  scope.PortableUIColorSchemeEditor = Object.freeze({ ACTION_DEFINITIONS, getActionDefinitions, createEditor });
}(typeof self !== "undefined" ? self : globalThis));

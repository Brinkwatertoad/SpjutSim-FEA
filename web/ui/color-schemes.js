/** Dependency-free color-role reference for the phase-1 UI port. */
(function initPortableUIColorSchemes(scope) {
  "use strict";

  const SHARED_AUTHORED_COLOR_ROLES = Object.freeze([
    "appBackground",
    "surface",
    "text",
    "accent",
    "danger",
    "canvasBackground",
    "canvasGeometry",
    "selection"
  ]);
  const normalizeHexColor = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
  };

  const normalizeColor = normalizeHexColor;

  const colorParts = (value) => {
    const normalized = normalizeColor(value);
    return normalized
      ? normalized.slice(1).match(/[0-9a-f]{2}/g).map((part) => Number.parseInt(part, 16))
      : null;
  };

  const partsToColor = (parts) => `#${parts.map((part) =>
    Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")
  ).join("")}`;

  const mixColors = (left, right, weight = 0.5) => {
    const leftParts = colorParts(left);
    const rightParts = colorParts(right);
    if (!leftParts || !rightParts) return null;
    const normalizedWeight = Math.max(0, Math.min(1, Number(weight)));
    return partsToColor(leftParts.map((part, index) =>
      (part * (1 - normalizedWeight)) + (rightParts[index] * normalizedWeight)
    ));
  };

  const withAlpha = (color, alpha = 1) => {
    const parts = colorParts(color);
    if (!parts) return null;
    const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha)));
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${normalizedAlpha})`;
  };

  const chooseContrastColor = (color) => {
    const parts = colorParts(color);
    if (!parts) return null;
    const luminance = (parts[0] * 0.2126) + (parts[1] * 0.7152) + (parts[2] * 0.0722);
    return luminance >= 142 ? "#111827" : "#f8fafc";
  };

  const relativeLuminance = (color) => {
    const parts = colorParts(color);
    if (!parts) return null;
    const channels = parts.map((part) => {
      const value = part / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (channels[0] * 0.2126) + (channels[1] * 0.7152) + (channels[2] * 0.0722);
  };

  const contrastRatio = (left, right) => {
    const leftLuminance = relativeLuminance(left);
    const rightLuminance = relativeLuminance(right);
    if (leftLuminance === null || rightLuminance === null) return 0;
    const lighter = Math.max(leftLuminance, rightLuminance);
    const darker = Math.min(leftLuminance, rightLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const readableColor = (preferred, background, minimum = 4.5) => {
    if (contrastRatio(preferred, background) >= minimum) return preferred;
    const candidates = ["#111827", "#f8fafc"];
    return candidates.sort((left, right) => contrastRatio(right, background) - contrastRatio(left, background))[0];
  };

  const normalizeColorMap = (value) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.freeze(Object.fromEntries(Object.entries(source)
      .map(([key, color]) => [String(key), normalizeColor(color)])
      .filter((entry) => entry[1])));
  };

  const cloneJsonValue = (value) => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(cloneJsonValue));
    if (value && typeof value === "object") {
      return Object.freeze(Object.fromEntries(Object.entries(value)
        .filter(([key, entry]) => key !== "__proto__" && typeof entry !== "undefined" && typeof entry !== "function")
        .map(([key, entry]) => [String(key), cloneJsonValue(entry)])));
    }
    return null;
  };

  const normalizeAuthoredPalette = (value) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.freeze(Object.fromEntries(SHARED_AUTHORED_COLOR_ROLES
      .map((role) => [role, normalizeColor(source[role])])
      .filter((entry) => entry[1])));
  };

  const resolvePalette = (input = {}) => {
    const args = input && typeof input === "object" ? input : {};
    const authored = normalizeAuthoredPalette(args.authored);
    const missing = SHARED_AUTHORED_COLOR_ROLES.filter((role) => !authored[role]);
    if (missing.length) throw new Error(`Portable color palette is missing: ${missing.join(", ")}.`);
    const secondaryCandidate = mixColors(authored.text, authored.surface, 0.28);
    const secondaryText = readableColor(secondaryCandidate, authored.surface);
    const canvasText = readableColor(authored.text, authored.canvasBackground);
    const derived = {
      secondaryText,
      canvasText,
      panelSurface: mixColors(authored.surface, authored.appBackground, 0.18),
      controlSurface: mixColors(authored.surface, authored.appBackground, 0.08),
      interactiveHoverSurface: mixColors(authored.accent, authored.surface, 0.88),
      border: mixColors(secondaryText, authored.surface, 0.55),
      dangerSurface: mixColors(authored.danger, authored.surface, 0.88),
      gridMajor: mixColors(authored.canvasGeometry, authored.canvasBackground, 0.72),
      gridMinor: mixColors(authored.canvasGeometry, authored.canvasBackground, 0.86),
      canvasFill: authored.canvasBackground,
      hover: mixColors(authored.selection, canvasText, 0.2),
      placementPreview: authored.selection,
      selectionSurface: mixColors(authored.selection, authored.surface, 0.84),
      selectionText: chooseContrastColor(authored.selection)
    };
    const extensions = cloneJsonValue(args.extensions ?? {});
    return Object.freeze({
      ...authored,
      ...derived,
      ...normalizeColorMap(args.derivedOverrides),
      extensions
    });
  };

  const normalizeSchemeId = (value, fallback = "scheme") => {
    const normalized = String(value ?? "").trim().toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return normalized || fallback;
  };

  const normalizeExtensions = (value) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return cloneJsonValue(source);
  };

  const normalizeCompleteScheme = (value, fallbackId = "scheme") => {
    const source = value && typeof value === "object" ? value : {};
    const id = normalizeSchemeId(source.id ?? source.key, fallbackId);
    return Object.freeze({
      id,
      key: id,
      label: String(source.label ?? id).trim() || id,
      authored: normalizeAuthoredPalette(source.authored),
      derivedOverrides: normalizeColorMap(source.derivedOverrides),
      extensions: normalizeExtensions(source.extensions)
    });
  };

  const normalizeFactorySchemes = (value) => {
    const used = new Set();
    return Object.freeze(Array.from(value ?? []).map((entry, index) => normalizeCompleteScheme(entry, `scheme-${index + 1}`))
      .filter((entry) => {
        if (used.has(entry.id) || SHARED_AUTHORED_COLOR_ROLES.some((role) => !entry.authored[role])) return false;
        used.add(entry.id);
        return true;
      }));
  };

  const normalizePartialScheme = (value) => {
    const source = value && typeof value === "object" ? value : {};
    return Object.freeze({
      ...(String(source.label ?? "").trim() ? { label: String(source.label).trim() } : {}),
      authored: normalizeColorMap(source.authored),
      derivedOverrides: normalizeColorMap(source.derivedOverrides),
      extensions: normalizeExtensions(source.extensions)
    });
  };

  const normalizeLibraryOverlay = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const overridesSource = source.overrides && typeof source.overrides === "object" ? source.overrides : {};
    const overrides = Object.freeze(Object.fromEntries(Object.entries(overridesSource)
      .map(([id, entry]) => [normalizeSchemeId(id), normalizePartialScheme(entry)])));
    const hiddenFactoryIds = Object.freeze(Array.from(new Set(Array.from(source.hiddenFactoryIds ?? [])
      .map((id) => normalizeSchemeId(id)).filter(Boolean))));
    const customSchemes = Object.freeze(Array.from(source.customSchemes ?? [])
      .map((entry, index) => normalizeCompleteScheme(entry, `custom-${index + 1}`)));
    const customResetBaselinesSource = source.customResetBaselines && typeof source.customResetBaselines === "object"
      ? source.customResetBaselines
      : {};
    const customResetBaselines = Object.freeze(Object.fromEntries(Object.entries(customResetBaselinesSource)
      .map(([id, entry]) => {
        const normalizedId = normalizeSchemeId(id);
        return [normalizedId, normalizeCompleteScheme({ ...entry, id: normalizedId, key: normalizedId }, normalizedId)];
      })));
    const preservedExtensions = source.preservedExtensions && typeof source.preservedExtensions === "object"
      ? Object.freeze({ ...source.preservedExtensions })
      : Object.freeze({});
    return Object.freeze({ version: 1, overrides, hiddenFactoryIds, customSchemes, customResetBaselines, preservedExtensions });
  };

  const mergeScheme = (factory, override = {}) => normalizeCompleteScheme({
    ...factory,
    label: override.label ?? factory.label,
    authored: { ...factory.authored, ...override.authored },
    derivedOverrides: { ...factory.derivedOverrides, ...override.derivedOverrides },
    extensions: Object.fromEntries(new Set([
      ...Object.keys(factory.extensions ?? {}), ...Object.keys(override.extensions ?? {})
    ]).values().map((namespace) => [namespace, {
      ...(factory.extensions?.[namespace] ?? {}), ...(override.extensions?.[namespace] ?? {})
    }]))
  }, factory.id);

  const resolveSchemeLibrary = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const hidden = new Set(overlay.hiddenFactoryIds);
    const entries = [];
    factorySchemes.forEach((factory) => {
      if (hidden.has(factory.id)) return;
      const override = overlay.overrides[factory.id];
      entries.push(Object.freeze({
        ...mergeScheme(factory, override),
        factory: true,
        modified: Boolean(override),
        custom: false,
        resettable: Boolean(override)
      }));
    });
    overlay.customSchemes.forEach((entry) => entries.push(Object.freeze({
      ...entry, factory: false, modified: false, custom: true,
      resettable: Boolean(overlay.customResetBaselines[entry.id])
    })));
    const defaultSchemeId = normalizeSchemeId(input.defaultSchemeId, factorySchemes[0]?.id ?? "default");
    const requestedActive = normalizeSchemeId(input.activeSchemeId, defaultSchemeId);
    const activeSchemeId = entries.some((entry) => entry.id === requestedActive)
      ? requestedActive
      : (entries.find((entry) => entry.id === defaultSchemeId)?.id ?? entries[0]?.id ?? null);
    return Object.freeze({ entries: Object.freeze(entries), activeSchemeId, empty: entries.length === 0 });
  };

  const uniqueSchemeId = (baseValue, ids) => {
    const base = normalizeSchemeId(baseValue, "custom");
    if (!ids.has(base)) return base;
    let suffix = 2;
    while (ids.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  };

  const createCustomScheme = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const ids = new Set([...factorySchemes.map((entry) => entry.id), ...overlay.customSchemes.map((entry) => entry.id)]);
    const seed = input.seed && typeof input.seed === "object" ? input.seed : factorySchemes[0];
    const label = String(input.label ?? seed?.label ?? "Custom scheme").trim() || "Custom scheme";
    const id = uniqueSchemeId(input.id ?? label, ids);
    const scheme = normalizeCompleteScheme({ ...seed, id, key: id, label }, id);
    return Object.freeze({
      scheme,
      overlay: normalizeLibraryOverlay({ ...overlay, customSchemes: [...overlay.customSchemes, scheme] })
    });
  };

  const updateScheme = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const schemeId = normalizeSchemeId(input.schemeId);
    const patch = normalizePartialScheme(input.patch);
    const extensionObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const mergeExtensionMaps = (left = {}, right = {}) => Object.fromEntries(new Set([
      ...Object.keys(left), ...Object.keys(right)
    ]).values().map((namespace) => [namespace, {
      ...extensionObject(left[namespace]),
      ...extensionObject(right[namespace])
    }]));
    if (factorySchemes.some((entry) => entry.id === schemeId)) {
      const previous = overlay.overrides[schemeId] ?? {};
      return normalizeLibraryOverlay({
        ...overlay,
        overrides: { ...overlay.overrides, [schemeId]: {
          ...(patch.label ? { label: patch.label } : (previous.label ? { label: previous.label } : {})),
          authored: { ...previous.authored, ...patch.authored },
          derivedOverrides: { ...previous.derivedOverrides, ...patch.derivedOverrides },
          extensions: mergeExtensionMaps(previous.extensions, patch.extensions)
        } }
      });
    }
    return normalizeLibraryOverlay({
      ...overlay,
      customSchemes: overlay.customSchemes.map((entry) => entry.id === schemeId
        ? normalizeCompleteScheme({
          ...entry,
          label: input.patch?.label ?? entry.label,
          authored: { ...entry.authored, ...patch.authored },
          derivedOverrides: { ...entry.derivedOverrides, ...patch.derivedOverrides },
          extensions: mergeExtensionMaps(entry.extensions, patch.extensions)
        }, entry.id)
        : entry)
    });
  };

  const duplicateScheme = (input = {}) => {
    const library = resolveSchemeLibrary(input);
    const source = library.entries.find((entry) => entry.id === normalizeSchemeId(input.schemeId));
    if (!source) throw new Error("Portable color scheme to duplicate was not found.");
    return createCustomScheme({
      ...input,
      id: `${source.id}-copy`,
      label: `${source.label} Copy`,
      seed: source
    });
  };

  const deleteScheme = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const schemeId = normalizeSchemeId(input.schemeId);
    const customResetBaselines = { ...overlay.customResetBaselines };
    delete customResetBaselines[schemeId];
    const nextOverlay = factorySchemes.some((entry) => entry.id === schemeId)
      ? normalizeLibraryOverlay({ ...overlay, hiddenFactoryIds: [...overlay.hiddenFactoryIds, schemeId] })
      : normalizeLibraryOverlay({
        ...overlay,
        customSchemes: overlay.customSchemes.filter((entry) => entry.id !== schemeId),
        customResetBaselines
      });
    const resolved = resolveSchemeLibrary({
      factorySchemes,
      overlay: nextOverlay,
      defaultSchemeId: input.defaultSchemeId,
      activeSchemeId: input.activeSchemeId === schemeId ? null : input.activeSchemeId
    });
    return Object.freeze({ overlay: nextOverlay, activeSchemeId: resolved.activeSchemeId });
  };

  const restoreFactoryScheme = (input = {}) => {
    const overlay = normalizeLibraryOverlay(input.overlay);
    const schemeId = normalizeSchemeId(input.schemeId);
    const overrides = { ...overlay.overrides };
    delete overrides[schemeId];
    return normalizeLibraryOverlay({
      ...overlay,
      overrides,
      hiddenFactoryIds: overlay.hiddenFactoryIds.filter((id) => id !== schemeId)
    });
  };

  const isPartialSchemeEmpty = (entry) => !entry?.label
    && Object.keys(entry?.authored ?? {}).length === 0
    && Object.keys(entry?.derivedOverrides ?? {}).length === 0
    && Object.keys(entry?.extensions ?? {}).length === 0;

  const clearSchemeOverride = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const schemeId = normalizeSchemeId(input.schemeId);
    const section = String(input.section ?? "derivedOverrides");
    const role = String(input.role ?? "");
    if (!role || !["authored", "derivedOverrides"].includes(section)) return overlay;
    if (factorySchemes.some((entry) => entry.id === schemeId)) {
      const previous = overlay.overrides[schemeId];
      if (!previous) return overlay;
      const sectionValues = { ...(previous[section] ?? {}) };
      delete sectionValues[role];
      const next = normalizePartialScheme({ ...previous, [section]: sectionValues });
      const overrides = { ...overlay.overrides };
      if (isPartialSchemeEmpty(next)) delete overrides[schemeId];
      else overrides[schemeId] = next;
      return normalizeLibraryOverlay({ ...overlay, overrides });
    }
    return normalizeLibraryOverlay({
      ...overlay,
      customSchemes: overlay.customSchemes.map((entry) => {
        if (entry.id !== schemeId) return entry;
        const sectionValues = { ...(entry[section] ?? {}) };
        delete sectionValues[role];
        return normalizeCompleteScheme({ ...entry, [section]: sectionValues }, entry.id);
      })
    });
  };

  const restoreScheme = (input = {}) => {
    const factorySchemes = normalizeFactorySchemes(input.factorySchemes);
    const overlay = normalizeLibraryOverlay(input.overlay);
    const schemeId = normalizeSchemeId(input.schemeId);
    if (factorySchemes.some((entry) => entry.id === schemeId)) return restoreFactoryScheme({ overlay, schemeId });
    const baseline = overlay.customResetBaselines[schemeId];
    if (!baseline) return overlay;
    return normalizeLibraryOverlay({
      ...overlay,
      customSchemes: overlay.customSchemes.map((entry) => entry.id === schemeId ? baseline : entry)
    });
  };

  const resetSchemeLibrary = () => normalizeLibraryOverlay(null);

  const COLOR_SCHEME_DOCUMENT_FORMAT = "spjutsim-color-schemes";
  const COLOR_SCHEME_DOCUMENT_VERSION = 3;

  const normalizePortableScheme = (value, index = 0) => {
    const normalized = normalizeCompleteScheme(value, `scheme-${index + 1}`);
    const missing = SHARED_AUTHORED_COLOR_ROLES.filter((role) => !normalized.authored[role]);
    if (missing.length) {
      throw new Error(`Portable color scheme '${normalized.id}' is missing: ${missing.join(", ")}.`);
    }
    return normalized;
  };

  const completeSchemeForHost = (input = {}) => {
    const scheme = normalizePortableScheme(input.scheme, 0);
    const fallback = normalizePortableScheme(input.fallbackScheme ?? input.scheme, 0);
    const required = input.requiredExtensions && typeof input.requiredExtensions === "object"
      ? input.requiredExtensions
      : {};
    const extensions = Object.fromEntries(Object.entries(scheme.extensions ?? {}).map(([namespace, values]) => [
      namespace,
      values && typeof values === "object" && !Array.isArray(values) ? { ...values } : values
    ]));
    Object.entries(required).forEach(([namespace, roles]) => {
      const values = { ...(extensions[namespace] ?? {}) };
      const fallbackValues = fallback.extensions?.[namespace] ?? {};
      Array.from(roles ?? []).forEach((role) => {
        const key = String(role);
        if (!normalizeColor(values[key])) {
          const fallbackColor = normalizeColor(fallbackValues[key]);
          if (!fallbackColor) throw new Error(`Portable color host fallback is missing ${namespace}.${key}.`);
          values[key] = fallbackColor;
        }
      });
      extensions[namespace] = values;
    });
    return normalizeCompleteScheme({ ...scheme, extensions }, scheme.id);
  };

  const parseSchemeDocument = (textOrObject) => {
    const parsed = typeof textOrObject === "string" ? JSON.parse(textOrObject) : textOrObject;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Portable color scheme document must be an object.");
    }
    if (parsed.format !== COLOR_SCHEME_DOCUMENT_FORMAT || parsed.version !== COLOR_SCHEME_DOCUMENT_VERSION) {
      throw new Error("Unsupported portable color scheme document.");
    }
    if (!Array.isArray(parsed.schemes) || parsed.schemes.length === 0) {
      throw new Error("Portable color scheme document must contain schemes.");
    }
    const usedIds = new Set();
    const schemes = parsed.schemes.map((entry, index) => {
      const normalized = normalizePortableScheme(entry, index);
      if (usedIds.has(normalized.id)) throw new Error(`Duplicate portable color scheme id '${normalized.id}'.`);
      usedIds.add(normalized.id);
      return normalized;
    });
    return Object.freeze({
      format: COLOR_SCHEME_DOCUMENT_FORMAT,
      version: COLOR_SCHEME_DOCUMENT_VERSION,
      schemes: Object.freeze(schemes)
    });
  };

  const serializeSchemeDocument = (value) => {
    const sourceSchemes = Array.isArray(value?.schemes) ? value.schemes : [value];
    const parsed = parseSchemeDocument({
      format: COLOR_SCHEME_DOCUMENT_FORMAT,
      version: COLOR_SCHEME_DOCUMENT_VERSION,
      schemes: sourceSchemes
    });
    return JSON.stringify(parsed, null, 2);
  };

  const importSchemeDocument = (input = {}) => {
    const parsed = parseSchemeDocument(input.document);
    let overlay = normalizeLibraryOverlay(input.overlay);
    const importedSchemeIds = [];
    parsed.schemes.forEach((entry) => {
      const completedEntry = completeSchemeForHost({
        scheme: entry,
        fallbackScheme: input.fallbackScheme ?? entry,
        requiredExtensions: input.requiredExtensions
      });
      const result = createCustomScheme({
        factorySchemes: input.factorySchemes,
        overlay,
        id: completedEntry.id,
        label: completedEntry.label,
        seed: completedEntry
      });
      overlay = normalizeLibraryOverlay({
        ...result.overlay,
        customResetBaselines: {
          ...result.overlay.customResetBaselines,
          [result.scheme.id]: result.scheme
        }
      });
      importedSchemeIds.push(result.scheme.id);
    });
    return Object.freeze({ overlay, importedSchemeIds: Object.freeze(importedSchemeIds) });
  };

  scope.PortableUIColorSchemes = Object.freeze({
    SHARED_AUTHORED_COLOR_ROLES,
    normalizeColor,
    normalizeHexColor,
    mixColors,
    withAlpha,
    chooseContrastColor,
    relativeLuminance,
    contrastRatio,
    normalizeAuthoredPalette,
    resolvePalette,
    normalizeFactorySchemes,
    normalizeLibraryOverlay,
    resolveSchemeLibrary,
    createCustomScheme,
    updateScheme,
    clearSchemeOverride,
    duplicateScheme,
    deleteScheme,
    restoreFactoryScheme,
    restoreScheme,
    resetSchemeLibrary,
    serializeSchemeDocument,
    parseSchemeDocument,
    completeSchemeForHost,
    importSchemeDocument
  });
}(typeof self !== "undefined" ? self : globalThis));

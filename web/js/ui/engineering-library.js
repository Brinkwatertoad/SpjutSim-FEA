'use strict';

(function publishEngineeringLibraryUI(global) {
  function requireFunction(value, label) {
    if (typeof value !== 'function') throw new Error(`Engineering library UI adapter requires ${label}.`);
    return value;
  }

  function requireAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') throw new Error('Engineering library UI requires an adapter object.');
    ['getId', 'getLabel', 'getGroup', 'getSearchTokens'].forEach(name => requireFunction(adapter[name], `adapter ${name}`));
    return adapter;
  }

  function normalizeLibraryEntries(records, rawAdapter) {
    const adapter = requireAdapter(rawAdapter);
    return Object.freeze((Array.isArray(records) ? records : []).map(record => {
      const id = String(adapter.getId(record) ?? '').trim();
      if (!id) throw new Error('Engineering library UI entry requires a stable ID.');
      const label = String(adapter.getLabel(record) ?? id).trim() || id;
      const group = String(adapter.getGroup(record) ?? '').trim();
      const tokens = adapter.getSearchTokens(record);
      const searchText = [id, label, group, ...(Array.isArray(tokens) ? tokens : [])]
        .map(token => String(token ?? '').trim().toLowerCase())
        .filter(Boolean)
        .join('\n');
      return Object.freeze({ id, label, group, searchText, record });
    }));
  }

  function filterLibraryEntries(entries, query) {
    const normalizedQuery = String(query ?? '').trim().toLowerCase();
    const source = Array.isArray(entries) ? entries : [];
    if (!normalizedQuery) return source.slice();
    return source.filter(entry => String(entry?.searchText ?? '').includes(normalizedQuery));
  }

  function getSharedRecordId(items, field) {
    const source = Array.isArray(items) ? items : [];
    if (!source.length) return null;
    const first = String(source[0]?.[field] ?? '').trim();
    if (!first) return null;
    return source.every(item => String(item?.[field] ?? '').trim() === first) ? first : null;
  }

  function requireNode(value, label) {
    if (!value || typeof value.appendChild !== 'function') {
      throw new Error(`Engineering library UI requires ${label}.`);
    }
    return value;
  }

  function createEngineeringLibraryUI(input = {}) {
    const doc = input.document || global.document;
    if (!doc || typeof doc.createElement !== 'function') {
      throw new Error('Engineering library UI requires a document-like object.');
    }
    const dialog = requireNode(input.dialog || doc.getElementById('engineering-library-dialog'), 'the library dialog');
    const searchInput = requireNode(input.searchInput || doc.getElementById('engineering-library-search'), 'the library search input');
    const tableHost = requireNode(input.tableHost || doc.getElementById('engineering-library-table'), 'the library table host');
    const editorHost = requireNode(input.editorHost || doc.getElementById('engineering-library-editor'), 'the library editor host');
    const title = requireNode(input.title || doc.getElementById('engineering-library-title'), 'the library title');
    const useButton = requireNode(input.useButton || doc.getElementById('engineering-library-use'), 'the library Use button');
    const addButton = requireNode(input.addButton || doc.getElementById('engineering-library-add'), 'the library Add button');
    const copyButton = requireNode(input.copyButton || doc.getElementById('engineering-library-copy'), 'the library Copy button');
    const editButton = requireNode(input.editButton || doc.getElementById('engineering-library-edit'), 'the library Edit button');
    const deleteButton = requireNode(input.deleteButton || doc.getElementById('engineering-library-delete'), 'the library Delete button');
    const importButton = requireNode(input.importButton || doc.getElementById('engineering-library-import'), 'the library Import button');
    const csvFormatButton = requireNode(input.csvFormatButton || doc.getElementById('engineering-library-csv-format'), 'the library CSV Format button');
    const csvGuideHost = requireNode(input.csvGuideHost || doc.getElementById('engineering-library-csv-guide'), 'the library CSV guide host');
    const exportFilteredButton = requireNode(input.exportFilteredButton || doc.getElementById('engineering-library-export-filtered'), 'the library Export Filtered button');
    const deleteFilteredButton = requireNode(input.deleteFilteredButton || doc.getElementById('engineering-library-delete-filtered'), 'the library Delete Filtered button');
    const resetButton = requireNode(input.resetButton || doc.getElementById('engineering-library-reset'), 'the library Reset button');
    const closeButtons = Array.from(dialog.querySelectorAll('[data-engineering-library-close]'));
    const tabButtons = Array.from(dialog.querySelectorAll('[data-engineering-library-tab]'));
    const getAdapter = requireFunction(input.getAdapter, 'getAdapter');
    const getRecords = requireFunction(input.getRecords, 'getRecords');
    const onUse = typeof input.onUse === 'function' ? input.onUse : () => {};
    const onDelete = typeof input.onDelete === 'function' ? input.onDelete : () => {};
    const onCopy = typeof input.onCopy === 'function' ? input.onCopy : () => {};
    const onDeleteFiltered = typeof input.onDeleteFiltered === 'function' ? input.onDeleteFiltered : () => {};
    const onResetLibrary = typeof input.onResetLibrary === 'function' ? input.onResetLibrary : () => {};
    const onPreviewCsvImport = typeof input.onPreviewCsvImport === 'function' ? input.onPreviewCsvImport : () => null;
    const onCommitCsvImport = typeof input.onCommitCsvImport === 'function' ? input.onCommitCsvImport : () => {};
    const onExportCsv = typeof input.onExportCsv === 'function' ? input.onExportCsv : () => {};
    const getCsvGuide = requireFunction(input.getCsvGuide, 'getCsvGuide');
    const confirmAction = typeof input.confirmAction === 'function' ? input.confirmAction : () => true;
    const onStatus = typeof input.onStatus === 'function' ? input.onStatus : () => {};
    const attachTooltip = typeof input.attachTooltip === 'function' ? input.attachTooltip : () => {};
    const registerHoverInfo = typeof input.registerHoverInfo === 'function' ? input.registerHoverInfo : () => {};
    const positionPopover = typeof input.positionPopover === 'function'
      ? input.positionPopover
      : (popover, anchor) => {
          const rect = anchor.getBoundingClientRect();
          popover.style.left = `${Math.max(8, rect.left)}px`;
          popover.style.top = `${Math.max(8, rect.bottom)}px`;
        };

    const state = {
      kind: 'material',
      selectedId: '',
      launchContext: null,
      entries: [],
      pickerControls: []
    };

    const csvFileInput = doc.createElement('input');
    csvFileInput.type = 'file';
    csvFileInput.accept = '.csv,text/csv';
    csvFileInput.hidden = true;
    csvFileInput.dataset.engineeringLibraryCsvInput = '1';
    dialog.appendChild(csvFileInput);

    function adapterFor(kind = state.kind) {
      return requireAdapter(getAdapter(kind));
    }

    function readEntries(kind = state.kind) {
      return normalizeLibraryEntries(getRecords(kind), adapterFor(kind));
    }

    function selectedEntry() {
      return state.entries.find(entry => entry.id === state.selectedId) || null;
    }

    function closeEditor() {
      editorHost.replaceChildren();
      editorHost.hidden = true;
      delete editorHost.dataset.mode;
    }

    function syncActions() {
      const entry = selectedEntry();
      const adapter = adapterFor();
      useButton.disabled = !entry;
      copyButton.disabled = !entry;
      editButton.disabled = !entry || (typeof adapter.canEdit === 'function' && !adapter.canEdit(entry.record));
      deleteButton.disabled = !entry || (typeof adapter.canDelete === 'function' && !adapter.canDelete(entry.record));
      exportFilteredButton.disabled = state.entries.length === 0;
      deleteFilteredButton.disabled = state.entries.length === 0;
    }

    function renderTable() {
      const adapter = adapterFor();
      const columns = Array.isArray(adapter.columns) ? adapter.columns : [];
      state.entries = filterLibraryEntries(readEntries(), searchInput.value);
      if (!state.entries.some(entry => entry.id === state.selectedId)) state.selectedId = '';
      tableHost.replaceChildren();

      const table = doc.createElement('table');
      table.className = 'engineering-library-table';
      const head = doc.createElement('thead');
      const headRow = doc.createElement('tr');
      columns.forEach(column => {
        const cell = doc.createElement('th');
        cell.scope = 'col';
        cell.textContent = String(column?.label ?? column?.key ?? '');
        if (column?.help) registerHoverInfo(cell, column.help);
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = doc.createElement('tbody');

      state.entries.forEach(entry => {
        const row = doc.createElement('tr');
        row.tabIndex = 0;
        row.dataset.engineeringLibraryRow = entry.id;
        row.classList.toggle('selected', entry.id === state.selectedId);
        columns.forEach(column => {
          const cell = doc.createElement('td');
          if (typeof column?.renderCell === 'function') {
            column.renderCell({ cell, record: entry.record, column, document: doc });
          } else {
            const value = typeof column?.render === 'function'
              ? column.render(entry.record)
              : entry.record?.[column?.key];
            cell.textContent = String(value ?? '—');
          }
          row.appendChild(cell);
        });
        const choose = () => {
          state.selectedId = entry.id;
          renderTable();
        };
        row.addEventListener('click', choose);
        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        });
        body.appendChild(row);
      });
      table.appendChild(body);

      if (state.entries.length) {
        tableHost.appendChild(table);
      } else {
        const empty = doc.createElement('p');
        empty.className = 'engineering-library-empty';
        empty.textContent = 'No matching records.';
        tableHost.appendChild(empty);
      }
      syncActions();
    }

    function openEditor(mode, record = null) {
      const adapter = adapterFor();
      if (typeof adapter.renderEditor !== 'function') return;
      editorHost.hidden = false;
      editorHost.dataset.mode = mode;
      adapter.renderEditor({
        host: editorHost,
        mode,
        record,
        launchContext: state.launchContext,
        close: closeEditor,
        refresh: renderTable
      });
    }

    function openLibrary(options = {}) {
      state.kind = String(options.kind ?? 'material');
      state.selectedId = String(options.selectedId ?? '');
      state.launchContext = options.context ?? null;
      searchInput.value = String(options.query ?? '');
      title.textContent = `${String(adapterFor().label ?? state.kind)} Library`;
      tabButtons.forEach(button => {
        const active = button.dataset.engineeringLibraryTab === state.kind;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      closeEditor();
      renderTable();
      if (!csvGuideHost.hidden) renderCsvGuide();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (options.mode === 'create') openEditor('create');
      searchInput.focus();
    }

    function closeLibrary() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      state.launchContext = null;
      csvGuideHost.hidden = true;
      csvFormatButton.setAttribute('aria-expanded', 'false');
      closeEditor();
    }

    function renderCsvGuide() {
      const guide = getCsvGuide(state.kind) || {};
      csvGuideHost.replaceChildren();
      const header = doc.createElement('div');
      header.className = 'engineering-library-csv-guide-header';
      const heading = doc.createElement('h3');
      heading.textContent = String(guide.title || 'CSV Format');
      const close = doc.createElement('button');
      close.type = 'button';
      close.className = 'ghost';
      close.dataset.engineeringCsvGuideClose = '1';
      close.textContent = 'Close';
      close.addEventListener('click', () => {
        csvGuideHost.hidden = true;
        csvFormatButton.setAttribute('aria-expanded', 'false');
        csvFormatButton.focus();
      });
      header.append(heading, close);
      csvGuideHost.appendChild(header);
      const intro = doc.createElement('p');
      intro.textContent = String(guide.intro || '');
      csvGuideHost.appendChild(intro);
      [
        ['Required columns', guide.requiredColumns],
        ['Optional columns', guide.optionalColumns],
        ['Supported unit headers', guide.unitHeaders]
      ].forEach(([label, entries]) => {
        const sectionHeading = doc.createElement('h4');
        sectionHeading.textContent = label;
        const list = doc.createElement('ul');
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
          const item = doc.createElement('li');
          item.textContent = String(entry);
          list.appendChild(item);
        });
        csvGuideHost.append(sectionHeading, list);
      });
      [guide.idBehavior, guide.quoting].filter(Boolean).forEach((text) => {
        const paragraph = doc.createElement('p');
        paragraph.textContent = String(text);
        csvGuideHost.appendChild(paragraph);
      });
      const exampleHeading = doc.createElement('h4');
      exampleHeading.textContent = 'Example';
      const example = doc.createElement('code');
      example.textContent = [guide.exampleHeader, guide.exampleRow].filter(Boolean).join('\n');
      const footer = doc.createElement('p');
      footer.textContent = String(guide.footer || '');
      csvGuideHost.append(exampleHeading, example, footer);
    }

    function actionPayload(entries = state.entries) {
      return {
        kind: state.kind,
        query: String(searchInput.value ?? ''),
        entries: entries.slice(),
        records: entries.map(entry => entry.record),
        context: state.launchContext
      };
    }

    function reportActionError(error) {
      onStatus(error?.message || String(error), 'error');
    }

    function finishMutation(message = '') {
      if (message) onStatus(message, 'success');
      state.selectedId = '';
      closeEditor();
      renderTable();
      state.pickerControls.forEach(control => control.sync());
    }

    function createPicker(options = {}) {
      const host = requireNode(options.host, 'a picker host');
      const kind = String(options.kind ?? '').trim();
      const getSelectedId = requireFunction(options.getSelectedId, 'picker getSelectedId');
      const onSelect = requireFunction(options.onSelect, 'picker onSelect');
      const showGroupHeadings = options.showGroupHeadings !== false;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'engineering-library-picker-button';
      button.dataset.engineeringLibraryPicker = kind;
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      const label = doc.createElement('span');
      label.className = 'engineering-library-picker-label';
      const chevron = doc.createElement('span');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      button.append(label, chevron);
      host.appendChild(button);

      const popover = doc.createElement('div');
      popover.className = 'engineering-library-picker-popover';
      popover.dataset.engineeringLibraryPickerPopover = kind;
      popover.hidden = true;
      const search = doc.createElement('input');
      search.type = 'search';
      search.className = 'engineering-library-picker-search';
      const results = doc.createElement('div');
      results.className = 'engineering-library-picker-results';
      results.setAttribute('role', 'listbox');
      const footer = doc.createElement('div');
      footer.className = 'engineering-library-picker-footer';
      const browse = doc.createElement('button');
      browse.type = 'button';
      browse.textContent = 'Browse full library…';
      const add = doc.createElement('button');
      add.type = 'button';
      add.textContent = 'Add custom…';
      footer.append(browse, add);
      popover.append(search, results, footer);
      const popoverContainer = host.closest('dialog') || doc.body;
      popoverContainer.appendChild(popover);

      function close() {
        popover.hidden = true;
        button.setAttribute('aria-expanded', 'false');
      }

      function syncPickerSelection(selectedId) {
        results.querySelectorAll('.engineering-library-picker-option').forEach(option => {
          option.setAttribute('aria-selected', option.dataset.engineeringLibraryOption === selectedId ? 'true' : 'false');
        });
      }

      function renderPickerResults() {
        const adapter = adapterFor(kind);
        const selectedId = String(getSelectedId() ?? '');
        const entries = filterLibraryEntries(normalizeLibraryEntries(getRecords(kind), adapter), search.value);
        results.replaceChildren();
        let previousGroup = null;
        entries.forEach(entry => {
          if (showGroupHeadings && entry.group && entry.group !== previousGroup) {
            const group = doc.createElement('div');
            group.className = 'engineering-library-picker-group';
            group.textContent = entry.group;
            results.appendChild(group);
            previousGroup = entry.group;
          }
          const option = doc.createElement('button');
          option.type = 'button';
          option.setAttribute('role', 'option');
          option.dataset.engineeringLibraryOption = entry.id;
          option.className = 'engineering-library-picker-option';
          const optionLabel = doc.createElement('span');
          optionLabel.textContent = entry.label;
          const meta = doc.createElement('span');
          meta.textContent = typeof adapter.getOptionMeta === 'function' ? String(adapter.getOptionMeta(entry.record) ?? '') : '';
          option.append(optionLabel, meta);
          option.addEventListener('click', () => {
            onSelect(entry.id, entry.record);
            close();
            sync();
          });
          results.appendChild(option);
        });
        if (!entries.length) {
          const empty = doc.createElement('p');
          empty.className = 'engineering-library-empty';
          empty.textContent = 'No matching records.';
          results.appendChild(empty);
        }
        syncPickerSelection(selectedId);
      }

      function refreshOpenPickerResults(adapter, selectedId) {
        const entries = filterLibraryEntries(normalizeLibraryEntries(getRecords(kind), adapter), search.value);
        const options = Array.from(results.querySelectorAll('.engineering-library-picker-option'));
        const sameEntries = options.length === entries.length
          && options.every((option, index) => option.dataset.engineeringLibraryOption === entries[index].id);
        if (!sameEntries) {
          renderPickerResults();
          return;
        }
        options.forEach((option, index) => {
          const entry = entries[index];
          option.querySelector('span:first-child').textContent = entry.label;
          option.querySelector('span:last-child').textContent = typeof adapter.getOptionMeta === 'function'
            ? String(adapter.getOptionMeta(entry.record) ?? '')
            : '';
        });
        syncPickerSelection(selectedId);
      }

      function open() {
        state.pickerControls.forEach(control => control.close());
        search.value = '';
        renderPickerResults();
        popover.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        positionPopover(popover, button);
        search.focus();
      }

      function sync() {
        const adapter = adapterFor(kind);
        const selectedId = String(getSelectedId() ?? '');
        const entry = normalizeLibraryEntries(getRecords(kind), adapter).find(item => item.id === selectedId) || null;
        search.placeholder = `Search ${String(adapter.label ?? kind).toLowerCase()} records`;
        label.textContent = entry?.label || String(options.emptyLabel ?? 'Mixed');
        attachTooltip(button, options.tooltip || `Choose ${String(adapter.label ?? kind).toLowerCase()}`);
        if (!popover.hidden) refreshOpenPickerResults(adapter, selectedId);
      }

      function readLaunchContext() {
        return typeof options.getContext === 'function' ? options.getContext() : options.context;
      }

      button.addEventListener('click', () => popover.hidden ? open() : close());
      search.addEventListener('input', renderPickerResults);
      popover.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
          button.focus();
        }
      });
      browse.addEventListener('click', () => {
        close();
        openLibrary({ kind, selectedId: getSelectedId(), context: readLaunchContext() });
      });
      add.addEventListener('click', () => {
        close();
        openLibrary({ kind, mode: 'create', context: readLaunchContext() });
      });

      const control = Object.freeze({ button, popover, close, sync, render: renderPickerResults });
      state.pickerControls.push(control);
      sync();
      return control;
    }

    tabButtons.forEach(button => {
      button.addEventListener('click', () => openLibrary({
        kind: button.dataset.engineeringLibraryTab,
        context: state.launchContext
      }));
    });
    searchInput.addEventListener('input', renderTable);
    useButton.addEventListener('click', () => {
      const entry = selectedEntry();
      if (!entry) return;
      onUse({ kind: state.kind, id: entry.id, record: entry.record, context: state.launchContext });
      closeLibrary();
    });
    addButton.addEventListener('click', () => openEditor('create'));
    copyButton.addEventListener('click', () => {
      const entry = selectedEntry();
      if (!entry) return;
      try {
        const outcome = onCopy({ kind: state.kind, id: entry.id, record: entry.record });
        openEditor('copy', outcome?.record || entry.record);
      } catch (error) {
        reportActionError(error);
      }
    });
    editButton.addEventListener('click', () => {
      const entry = selectedEntry();
      if (entry) openEditor('edit', entry.record);
    });
    deleteButton.addEventListener('click', () => {
      const entry = selectedEntry();
      if (!entry) return;
      onDelete({ kind: state.kind, id: entry.id, record: entry.record });
      state.selectedId = '';
      renderTable();
    });
    exportFilteredButton.addEventListener('click', () => {
      try {
        onExportCsv(actionPayload());
      } catch (error) {
        reportActionError(error);
      }
    });
    deleteFilteredButton.addEventListener('click', () => {
      const payload = actionPayload();
      if (!payload.entries.length) return;
      if (!confirmAction(`Delete ${payload.entries.length} visible ${state.kind} record${payload.entries.length === 1 ? '' : 's'}?`)) return;
      try {
        const outcome = onDeleteFiltered(payload);
        finishMutation(outcome?.message);
      } catch (error) {
        reportActionError(error);
      }
    });
    resetButton.addEventListener('click', () => {
      if (!confirmAction('Reset the complete Material and Section library? Custom and imported records will be removed.')) return;
      try {
        const outcome = onResetLibrary(actionPayload());
        finishMutation(outcome?.message);
      } catch (error) {
        reportActionError(error);
      }
    });
    importButton.addEventListener('click', () => csvFileInput.click());
    csvFormatButton.addEventListener('click', () => {
      const willOpen = csvGuideHost.hidden;
      csvGuideHost.hidden = !willOpen;
      csvFormatButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) renderCsvGuide();
    });
    csvFileInput.addEventListener('change', async () => {
      const file = csvFileInput.files?.[0];
      if (!file) return;
      try {
        const preview = await onPreviewCsvImport({
          kind: state.kind,
          text: await file.text(),
          fileName: file.name
        });
        if (!preview?.valid) {
          const message = preview?.errors?.map(error => error.row ? `Row ${error.row}: ${error.message}` : error.message).join(' ') || 'CSV import failed.';
          onStatus(message, 'error');
          return;
        }
        const counts = preview.counts || {};
        const summary = `Import ${counts.create || 0} new, ${counts.override || 0} override, ${counts.update || 0} update, and ${counts.unchanged || 0} unchanged record(s)?`;
        if (!confirmAction(summary)) return;
        await onCommitCsvImport({ kind: state.kind, preview });
        finishMutation('CSV import complete.');
      } catch (error) {
        reportActionError(error);
      } finally {
        csvFileInput.value = '';
      }
    });
    closeButtons.forEach(button => button.addEventListener('click', closeLibrary));
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeLibrary();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeLibrary();
    });
    doc.addEventListener('pointerdown', event => {
      state.pickerControls.forEach(control => {
        if (!control.popover.contains(event.target) && !control.button.contains(event.target)) control.close();
      });
    });

    return Object.freeze({
      createPicker,
      openLibrary,
      closeLibrary,
      refresh: () => {
        if (dialog.open || dialog.hasAttribute('open')) renderTable();
        state.pickerControls.forEach(control => control.sync());
      }
    });
  }

  global.TrussEngineeringLibraryUI = Object.freeze({
    normalizeLibraryEntries,
    filterLibraryEntries,
    getSharedRecordId,
    createEngineeringLibraryUI
  });
})(globalThis);

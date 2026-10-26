(function (root) {
  'use strict';
  var api = root.SpjutsimFEA, portable = root.PortableUIColorSchemes;
  function roles(definitions) {
    return Object.keys(definitions).map(function(key){return {key:key,label:definitions[key]};});
  }
  function complete(entry) {
    return api.completeColorScheme(entry);
  }
  function createDemo(host) {
    host.innerHTML = '<div class="fea-color-preview-interface"><strong>Interface demo</strong><button type="button" class="ui-button-primary">Accent</button><button type="button" data-action-intent="danger">Danger</button><button id="color-demo-modal-button" type="button">Open picker…</button></div>' +
      '<svg viewBox="0 0 300 96" role="img" aria-label="Geometry, selection, support and load color preview"><path data-preview-geometry d="M92 25h92v48H92z" fill="none" stroke-width="3"/><path data-preview-selection d="M184 25v48" stroke-width="5"/><path data-preview-support d="M82 20v58M70 25l12-5M70 40l12-5M70 55l12-5M70 70l12-5" stroke-width="3"/><path data-preview-load d="M194 49h45m-10-7 10 7-10 7" fill="none" stroke-width="3"/></svg>' +
      '<dialog id="color-demo-dialog" class="fea-project-dialog" aria-labelledby="color-demo-title"><h2 id="color-demo-title">Interface demo</h2><label for="color-demo-picker">Example picker</label><select id="color-demo-picker"><option value="first">First option</option><option value="second">Second option</option><option value="third">Third option</option></select><form method="dialog" class="fea-dialog-actions"><button id="color-demo-close-button">Close</button></form></dialog>';
    var dialog = host.querySelector('dialog'), opener = host.querySelector('#color-demo-modal-button');
    var picker = root.PortableUICustomSelect.createCustomSelect({select:host.querySelector('select'),document:host.ownerDocument});
    opener.addEventListener('click',function(){dialog.showModal();picker.button.focus();});
    // Let the native dialog own focus and Escape while Settings remains open.
    dialog.addEventListener('keydown',function(event){event.stopPropagation();});
    dialog.addEventListener('close',function(){picker.close();opener.focus();});
  }
  function renderPreview(host, entry) {
    var palette = api.resolveColorPalette(complete(entry));
    if (!host.firstElementChild) { createDemo(host); }
    var surface = host.firstElementChild, canvas = host.querySelector('svg');
    surface.style.background = palette.surface;surface.style.color = palette.text;
    host.style.setProperty('--surface',palette.surface);host.style.setProperty('--text',palette.text);
    host.style.setProperty('--ui-color-surface',palette.surface);host.style.setProperty('--ui-color-text',palette.text);
    host.style.setProperty('--ui-color-border',palette.border);host.style.setProperty('--ui-color-border-soft',palette.border);
    host.style.setProperty('--ui-color-surface-soft',palette.controlSurface);
    host.style.setProperty('--ui-color-accent',palette.accent);
    host.style.setProperty('--ui-color-danger',palette.danger);
    host.style.setProperty('--ui-color-selection-text',palette.selectionText);
    canvas.style.background = palette.canvasBackground;
    ['geometry','selection','support','load'].forEach(function(role){
      canvas.querySelector('[data-preview-'+role+']').setAttribute('stroke',
        role === 'geometry' ? palette.canvasGeometry : role === 'selection' ? palette.selection : palette.extensions.fea[role]);
    });
  }

  api.FEAColorSchemes.prototype.bindControls = function () {
    var self = this, select = document.getElementById('color-scheme-select');
    if (!select) { return; }
    var host = document.getElementById('color-scheme-editor');
    var status = document.getElementById('color-scheme-status');
    var importInput = document.getElementById('color-scheme-import-input');
    var editor, picker;
    function syncSelect() {
      var library = self.library();
      select.replaceChildren();
      library.entries.forEach(function(entry){
        var option = document.createElement('option');option.value = entry.id;option.textContent = entry.label;
        select.append(option);
      });
      select.value = library.activeSchemeId;
      if (picker) { picker.sync(); }
    }
    function refresh() {
      editor.sync();
      editor.actions.delete.disabled = self.library().entries.length < 2;
      editor.actions.restore.title = self.activeEntry().resettable ? 'Restore the original scheme' : 'This scheme has no changes or saved reset baseline.';
      status.textContent = self.storageWarning || ('Active: ' + self.activeEntry().label);
    }
    function perform(action) {
      try { action();refresh(); }
      catch (error) { editor.sync();status.textContent = error.message; }
    }
    syncSelect();
    editor = root.PortableUIColorSchemeEditor.createEditor({
      document:document,select:select,
      interfaceRoles:roles({appBackground:'App Background',surface:'Panel',text:'Text',accent:'Accent',danger:'Danger'}),
      canvasRoles:roles({canvasBackground:'Background',canvasGeometry:'Geometry',selection:'Selection'}),
      advancedRoles:roles({panelSurface:'Content Surface',border:'Border',secondaryText:'Secondary Text',canvasText:'Canvas Text',
        gridMajor:'Major Grid',gridMinor:'Minor Grid',canvasFill:'Canvas Fill',hover:'Canvas Hover',placementPreview:'Placement Preview'}),
      extensions:{fea:{label:'FEA',roles:roles({load:'Load',support:'Support',axisX:'X Axis',axisY:'Y Axis',axisZ:'Z Axis'})}},
      getCurrentEntry:function(){return self.activeEntry();},resolveEntry:function(){return self.activePalette();},
      syncSelect:syncSelect,renderPreview:renderPreview,
      onSelect:function(id){perform(function(){self.select(id);});},
      onRename:function(label){perform(function(){self.rename(label);});},
      onDuplicate:function(){perform(function(){self.duplicate();});},
      onDelete:function(){perform(function(){self.remove();});},
      onRestore:function(){perform(function(){self.restore();});},
      onReset:function(){perform(function(){self.reset();});},
      onClearOverride:function(section,role){perform(function(){self.clearOverride(role);});},
      onUpdateRole:function(section,role,value){perform(function(){self.updateRole(section,role,value);});},
      onPreviewRole:function(section,role,value){
        var color = portable.normalizeColor(value);
        if (!color) { return; }
        var entry = self.activeEntry(), draft = Object.assign({},entry);
        if (section === 'extensions.fea') {
          draft.extensions = Object.assign({},entry.extensions,{fea:Object.assign({},entry.extensions.fea,{[role]:color})});
        } else { draft[section] = Object.assign({},entry[section],{[role]:color}); }
        renderPreview(editor.preview,draft);
      },
      onImport:function(){importInput.click();},
      onExport:function(){
        var exported = self.exportActive(), url = root.URL.createObjectURL(new Blob([exported.text],{type:'application/json'}));
        var anchor = document.createElement('a');anchor.href = url;anchor.download = exported.filename;anchor.click();
        root.setTimeout(function(){root.URL.revokeObjectURL(url);},0);
        status.textContent = 'Exported ' + self.activeEntry().label + '.';
      }
    });
    host.append(editor.element);
    picker = root.PortableUICustomSelect.createCustomSelect({select:select,document:document,widthPolicy:'fit-options'});
    editor.attachPicker(picker.group,picker.button);
    var actions = document.createElement('div');actions.className = 'fea-color-scheme-actions';
    ['import','export','duplicate','delete'].forEach(function(action){
      var button = editor.actions[action];
      if (action !== 'import') {
        button.classList.add('fea-icon-button');
        button.title = {export:'Export color scheme',delete:'Delete color scheme',duplicate:'Duplicate color scheme'}[action];
        root.PortableUIActionControls.applyActionIcon(button,action,button.title,{
          createIcon:function(id){return root.PortableUIIcons.createIcon(id,{document:document,size:20});}
        });
      }
      actions.append(button);
    });
    editor.overflowController.toggle.classList.add('fea-icon-button');
    actions.append(editor.overflowController.element);editor.toolbar.append(actions);
    editor.actions.import.id = 'color-scheme-import-button';editor.actions.export.id = 'color-scheme-export-button';
    importInput.addEventListener('change',async function(){
      var file = importInput.files && importInput.files[0];importInput.value = '';
      if (!file) { return; }
      try { self.importDocument(JSON.parse(await file.text()));refresh(); }
      catch (error) { status.textContent = 'Import failed: ' + error.message; }
    });
    refresh();
  };
}(globalThis));

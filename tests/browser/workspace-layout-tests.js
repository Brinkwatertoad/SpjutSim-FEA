(function () {
  'use strict';
  var frame = document.getElementById('workspace-frame');
  var status = document.getElementById('test-status');
  function assert(value, message) { if (!value) { throw new Error(message); } }
  function settle() { return new Promise(function (resolve) { setTimeout(resolve, 100); }); }
  function checkPaneGutters(win, doc) {
    var panes = ['setup-pane', 'results-pane'].map(function (id) { return doc.getElementById(id); });
    var rootStyle = win.getComputedStyle(doc.documentElement);
    var measured = parseFloat(rootStyle.getPropertyValue('--ui-scrollbar-width'));
    var paneStyle = win.getComputedStyle(panes[0]);
    var lane = panes[0].offsetWidth - panes[0].clientWidth - parseFloat(paneStyle.borderLeftWidth) - parseFloat(paneStyle.borderRightWidth);
    assert(measured === lane, 'Startup scrollbar measurement does not match the pane gutter');
    var originalScheme = doc.documentElement.dataset.colorScheme;
    var schemes = new win.SpjutsimFEA.FEAColorSchemes(null, doc.documentElement);
    var modeStyle = doc.createElement('style'); doc.head.appendChild(modeStyle);
    var baselineWidths = [];
    try {
      ['', '* { scrollbar-width: none !important; }', '* { scrollbar-width: thin !important; }'].forEach(function (css, mode) {
        modeStyle.textContent = css;
        schemes.activeSchemeId = mode === 1 ? 'light' : 'dark';
        schemes.applyActive();
        panes.forEach(function (pane, index) {
          var originalStyle = pane.getAttribute('style');
          var spacer = doc.createElement('div'); spacer.style.cssText = 'height: 600px; flex-shrink: 0;';
          pane.appendChild(spacer);
          try {
            var child = pane.firstElementChild;
            var style = win.getComputedStyle(pane);
            var reserved = pane.offsetWidth - pane.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
            var padding = parseFloat(style.paddingRight);
            assert(style.scrollbarGutter === 'stable', 'Pane is missing its stable native gutter');
            assert(Math.abs(reserved + padding - Math.max(17, reserved + 2)) <= 0.5, 'Pane must count native scrollbar space once inside the shared inset');
            assert(parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--ui-scrollbar-width')) === reserved,
              'Scrollbar measurement did not follow the applied palette/style');
            var width = child.getBoundingClientRect().width;
            if (mode === 0) { baselineWidths[index] = { width: width, lane: reserved }; }
            else if (reserved <= 15 && baselineWidths[index].lane <= 15) {
              assert(Math.abs(width - baselineWidths[index].width) <= 0.5, 'Content width changed between native, overlay, and thin scrollbar modes');
            }
            [false, true, false].forEach(function (overflowing) {
              pane.style.height = overflowing ? '160px' : (pane.scrollHeight + 100) + 'px';
              assert((pane.scrollHeight > pane.clientHeight) === overflowing, 'Gutter fixture did not change overflow state');
              assert(Math.abs(child.getBoundingClientRect().width - width) <= 0.5, 'Content width changed when scrolling became necessary or stopped');
            });
            if (mode === 1) {
              pane.style.position = 'relative';
              spacer.style.cssText = 'position: absolute; right: 0; top: 0; width: 15px; height: 40px;';
              assert(spacer.getBoundingClientRect().left - child.getBoundingClientRect().right >= 1.5,
                'Content overlaps the conservative 15px overlay scrollbar region');
            }
          } finally {
            spacer.remove();
            if (originalStyle === null) { pane.removeAttribute('style'); } else { pane.setAttribute('style', originalStyle); }
          }
        });
      });
    } finally {
      modeStyle.remove(); schemes.activeSchemeId = originalScheme; schemes.applyActive();
    }
  }
  frame.addEventListener('load', async function () {
    try {
      var win = frame.contentWindow, doc = win.document;
      var shell = doc.querySelector('.fea-workspace');
      for (var size of [[500, 400], [1440, 500], [1440, 900], [1000, 700], [850, 600]]) {
        frame.style.width = size[0] + 'px'; frame.style.height = size[1] + 'px';
        await settle();
        var canvas = doc.getElementById('viewport').getBoundingClientRect();
        var bounds = shell.getBoundingClientRect();
        assert(Math.abs(doc.getElementById('viewport').width - canvas.width * Math.min(win.devicePixelRatio, 2)) <= 2, 'Canvas drawing buffer did not follow device pixel ratio');
        assert(canvas.bottom <= bounds.bottom + 1 && canvas.right <= bounds.right + 1,
          'Initialized canvas exceeds workspace at ' + size.join('x') + ': bottom=' + canvas.bottom + '/' + bounds.bottom);
        assert(doc.documentElement.scrollHeight <= size[1] + 1 && doc.documentElement.scrollWidth <= size[0] + 1, 'Page overflow at ' + size.join('x'));
      }
      frame.style.width = '1440px'; frame.style.height = '900px'; await settle();
      var bar = doc.querySelector('.fea-actionbar');
      assert(bar && bar.getBoundingClientRect().top >= doc.querySelector('.fea-topbar').getBoundingClientRect().bottom && bar.getBoundingClientRect().bottom <= shell.getBoundingClientRect().top, 'Action bar is not between menubar and workspace');
      ['toggle-setup-pane','toggle-results-pane','solve-button'].forEach(function (id) { assert(bar.contains(doc.getElementById(id)), id + ' is outside action bar'); });
      ['save'].forEach(function (name) { assert(bar.querySelector('[data-placeholder="' + name + '"]').disabled, name + ' placeholder is enabled'); });
      assert(doc.getElementById('toggle-results-pane').getBoundingClientRect().right > 1400, 'Results toggle is not at right edge');
      assert(doc.getElementById('solve-button').getBoundingClientRect().right > 1300 && doc.getElementById('solve-button').nextElementSibling.id === 'toggle-results-pane', 'Solve is not adjacent to Results');
      var title = doc.querySelector('.fea-topbar strong').getBoundingClientRect();
      var menu = doc.getElementById('application-menu').getBoundingClientRect();
      var statusStyle = win.getComputedStyle(doc.getElementById('app-status'));
      assert(menu.left >= title.right && menu.left - title.right < 20, 'Menus are not immediately right of title');
      assert(statusStyle.textAlign === 'right' && doc.getElementById('app-status').getBoundingClientRect().right > 1420, 'Runtime status is not right-aligned at edge');
      var accentSample = doc.createElement('span'); accentSample.style.backgroundColor = 'var(--accent, #4387f5)'; doc.body.append(accentSample);
      assert(win.getComputedStyle(doc.getElementById('solve-button')).backgroundColor === win.getComputedStyle(accentSample).backgroundColor, 'Solve lost accent background'); accentSample.remove();
      var api = win.SpjutsimFEA;
      // Drive the UIController-owned instance through its public controls.
      var layout = {setPaneOpen: function (name, open) {
        var toggle = doc.getElementById('toggle-' + name + '-pane');
        if ((toggle.getAttribute('aria-expanded') === 'true') !== open) { toggle.click(); }
      }};
      assert(doc.getElementById('results-pane').hidden, 'Empty Results should start collapsed');
      var setupToggle = doc.getElementById('toggle-setup-pane');
      var resultsToggle = doc.getElementById('toggle-results-pane');
      var input = doc.getElementById('setup-add-support-button');
      input.focus(); layout.setPaneOpen('setup', false);
      assert(doc.activeElement === setupToggle, 'Collapse did not return hidden pane focus to toggle');
      layout.setPaneOpen('setup', true);
      assert(!doc.getElementById('setup-pane').hidden, 'Setup did not reopen');
      var splitter = doc.getElementById('setup-splitter');
      var before = doc.getElementById('setup-pane').getBoundingClientRect().width;
      splitter.dispatchEvent(new win.KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true,cancelable:true}));
      assert(doc.getElementById('setup-pane').getBoundingClientRect().width > before, 'Keyboard splitter did not resize pane');
      splitter.dispatchEvent(new win.KeyboardEvent('keydown', {key:'End',bubbles:true,cancelable:true}));
      assert(doc.getElementById('viewport').getBoundingClientRect().width >= 320, 'Splitter consumed minimum viewport space');
      layout.setPaneOpen('results', true);
      layout.setPaneOpen('results', false); win.dispatchEvent(new win.Event('resize')); await settle();
      assert(doc.getElementById('results-pane').hidden, 'Routine redraw reopened Results');
      layout.setPaneOpen('setup', false);
      assert(doc.getElementById('viewport').getBoundingClientRect().width >= 1000, 'Collapsing both panes placed canvas in a zero-width grid column');
      layout.setPaneOpen('results', true);
      assert(doc.getElementById('viewport').getBoundingClientRect().width >= 320, 'Results-only layout lost the canvas grid column');
      frame.style.width = '500px'; frame.style.height = '400px'; await settle();
      layout.setPaneOpen('results', true);
      assert(doc.getElementById('setup-pane').hidden && !doc.getElementById('results-pane').hidden, 'Compact drawer did not select one active pane');
      assert(doc.getElementById('viewport').getBoundingClientRect().width >= 320, 'Compact drawer squeezed canvas');
      resultsToggle.focus(); layout.setPaneOpen('results', false);
      var normal = api.normalizeWorkspacePreferences({setupWidth:-4,resultsWidth:Infinity,setupOpen:'yes',resultsOpen:1});
      assert(normal.setupWidth >= 220 && normal.resultsWidth <= 520 && normal.resultsOpen === false, 'Malformed preferences were not repaired');
      var fixture = doc.implementation.createHTMLDocument('Storage fallback');
      fixture.body.innerHTML = '<main></main>' + ['setup', 'results'].map(function (name) {
        return '<aside id="' + name + '-pane"></aside><button id="toggle-' + name + '-pane"></button><div id="' + name + '-splitter"></div>';
      }).join('');
      [
        {getItem:function () { return '{malformed'; },setItem:function () { throw new Error('Quota exceeded'); }},
        {getItem:function () { throw new Error('Storage denied'); },setItem:function () { throw new Error('Storage denied'); }},
        {getItem:function () { return JSON.stringify({version:99,preferences:{setupOpen:false}}); },setItem:function () {}}
      ].forEach(function (storage) {
        var instance = new api.WorkspaceLayout(fixture.querySelector('main'), {storage:storage});
        instance.setPaneOpen('results', true);
        assert(!fixture.getElementById('results-pane').hidden, 'Storage failure disabled live pane controls');
        assert(instance.preferences.setupOpen === true, 'Invalid stored record did not restore default preferences');
        instance.dispose();
      });
      frame.style.width = '1440px'; frame.style.height = '900px'; await settle();
      layout.setPaneOpen('setup', true); layout.setPaneOpen('results', true); await settle();
      checkPaneGutters(win, doc);
      status.textContent = 'Passed: stable pane gutters across scrollbar modes and overflow, initialized resize sequence, independent pane sizing, compact drawers, keyboard/focus and storage fallback';
    } catch (error) { status.textContent = 'Failed: ' + error.message; console.error(error); }
  });
}());

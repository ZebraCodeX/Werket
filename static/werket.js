(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var editor = $('editor');
  var workspaceKey = 'werket-workspace-v2';
  var oskPrefKey = 'werket-osk';
  var saveTimer, suggestTimer, spellTimer;
  var phoneticBuffer = '', phoneticStart = 0, phoneticRendered = '';
  var undoStack = [], redoStack = [], applyingHistory = false;
  var oskOpen = false;
  var caretStart = 0, caretEnd = 0;
  var contextFileId = null;
  var markingSpell = false;
  var currentUser = null;
  var saveMenuOpen = false;
  var families = ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ','ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ','ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ','ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'];
  var roman = ['h','l','H','m','S','r','s','sh','q','b','t','c','x','n','N','a','k','K','w','E','z','Z','y','d','j','g','T','C','P','S','D'];
  var orders = ['e','u','i','a','ie','silent','o'];
  var symbols = ['።','፣','፤','፥','፦','፧','፨','፩','፪','፫','፬','፭','፮','፯','፰','፱','፲','?','!',',','.'];
  var phon = {h:'ሀ',H:'ሐ',l:'ለ',m:'መ',s:'ሰ',r:'ረ',S:'ሠ',b:'በ',t:'ተ',c:'ቸ',C:'ጨ',q:'ቀ',k:'ከ',x:'ኀ',n:'ነ',N:'ኘ',a:'አ',w:'ወ',z:'ዘ',y:'የ',d:'ደ',j:'ጀ',g:'ገ',T:'ጠ',p:'ፐ',f:'ፈ',v:'ቨ',D:'ፀ'};
  var vowels = {e:0,u:1,i:2,a:3,ie:4,ee:4,'':5,o:6};
  var templates = [
    {id:'blank', icon:'□', artwork:'blank', name:'Blank document', description:'A clean page for notes or free writing.', files:[['Untitled.md','']]},
    {id:'letter', icon:'✉', artwork:'letter', name:'Letter', description:'Greeting, body, and closing for a formal note.', files:[['letter.md','<h1>Letter</h1><p>Date: </p><p>Dear </p><p>Write your message here.</p><p>Sincerely,</p>']]},
    {id:'journal', icon:'◷', artwork:'journal', name:'Daily journal', description:'A focused page for reflection and daily notes.', files:[['journal.md','<h1>Daily journal</h1><h2>Today</h2><p>What happened today?</p><h2>Reflection</h2><p>What did I learn?</p>']]},
    {id:'notes', icon:'✎', artwork:'meeting', name:'Meeting notes', description:'Agenda, notes, and next steps.', files:[['meeting.md','<h1>Meeting notes</h1><p>Date: </p><p>Attendees: </p><h2>Agenda</h2><ul><li></li></ul><h2>Notes</h2><p></p><h2>Next steps</h2><ul><li></li></ul>']]},
    {id:'book', icon:'▤', artwork:'book', name:'Book project', description:'Outline, characters, research, and chapter files.', book:true}
  ];

  function safeLoad() { try { return JSON.parse(localStorage.getItem(workspaceKey) || 'null'); } catch (e) { return null; } }
  function newId() { return 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
  function initialWorkspace() { return {projectName:'My documents', activeId:null, openIds:[], font:'Noto Sans Ethiopic', size:18, align:'left', files:[]}; }
  var workspace = safeLoad() || initialWorkspace();
  if (!Array.isArray(workspace.files)) workspace.files = [];
  if (!workspace.files.length) workspace.files.push(file('Untitled.md', ''));
  if (!workspace.activeId || !workspace.files.some(function (f) { return f.id === workspace.activeId; })) workspace.activeId = workspace.files[0].id;
  if (!workspace.openIds || !workspace.openIds.length) workspace.openIds = [workspace.activeId];

  function file(name, text, folder) { return {id:newId(), name:name, text:text || '', folder:folder || '', updated:Date.now()}; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function activeFile() { return workspace.files.find(function (f) { return f.id === workspace.activeId; }) || null; }
  function saveWorkspace() { localStorage.setItem(workspaceKey, JSON.stringify(workspace)); }
  function setStatus(text) { $('saveStatus').textContent = text; }
  function editorText() { return (editor.innerText || '').replace(/\u00a0/g, ' '); }
  function editorHtml() {
    var clone = editor.cloneNode(true);
    clone.querySelectorAll('.spell-error').forEach(function (el) {
      el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
    });
    return clone.innerHTML;
  }
  function activeBlock() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return editor;
    var node = sel.anchorNode;
    if (!node || node === editor) return editor;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node.parentNode && node.parentNode !== editor) node = node.parentNode;
    return (node && editor.contains(node)) ? node : editor;
  }
  function stripMarkdownNoise(text) {
    return String(text || '').replace(/^\s*#{1,6}\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/(^|\s)_([^_]+)_/g, '$1$2');
  }
  function markdownToHtml(value) {
    return escapeHtml(String(value || ''))
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/^\- (.*)$/gm, '<div class="editor-bullet">• $1</div>')
      .replace(/^\d+\. (.*)$/gm, '<div class="editor-number">$1</div>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
  function setEditorContent(value) {
    var source = String(value || '');
    editor.innerHTML = /^\s*<(?:h[1-6]|p|div|strong|em|ul|ol|br)\b/i.test(source) ? source : markdownToHtml(source);
  }
  function selectionOffsets() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) return {start: caretStart, end: caretEnd};
    var range = selection.getRangeAt(0), before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.startContainer, range.startOffset);
    var selected = range.cloneRange();
    selected.selectNodeContents(editor);
    selected.setEnd(range.endContainer, range.endOffset);
    return {start: before.toString().length, end: selected.toString().length};
  }
  function nodeAtOffset(root, offset) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node, count = 0;
    while ((node = walker.nextNode())) {
      var next = count + node.nodeValue.length;
      if (offset <= next) return {node: node, offset: Math.max(0, offset - count)};
      count = next;
    }
    return {node: root, offset: root.childNodes.length};
  }
  function restoreSelection(start, end) {
    var startPoint = nodeAtOffset(editor, start), endPoint = nodeAtOffset(editor, end), range = document.createRange(), selection = window.getSelection();
    try {
      range.setStart(startPoint.node, startPoint.offset); range.setEnd(endPoint.node, endPoint.offset);
      selection.removeAllRanges(); selection.addRange(range);
      caretStart = start; caretEnd = end;
    } catch (e) {}
  }
  function replaceTextRange(start, end, text) {
    var startPoint = nodeAtOffset(editor, start), endPoint = nodeAtOffset(editor, end), range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset); range.setEnd(endPoint.node, endPoint.offset); range.deleteContents();
    var inserted = document.createTextNode(text); range.insertNode(inserted); range.setStartAfter(inserted); range.collapse(true);
    var selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); caretStart = caretEnd = start + text.length;
    try { editor.dispatchEvent(new Event('input', {bubbles: true})); } catch (e) {}
  }
  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var button = $('themeBtn');
    if (button) {
      button.textContent = dark ? '☀' : '☾';
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(dark));
    }
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = dark ? '#172019' : '#233b7a';
    localStorage.setItem('werket-theme', dark ? 'dark' : 'light');
  }
  function initTheme() {
    var saved = localStorage.getItem('werket-theme');
    var preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(preferred);
  }
  function uniqueName(base) {
    var name = base, n = 2, stem = base.replace(/(\.[^.]+)$/, ''), ext = (base.match(/(\.[^.]+)$/) || [''])[0];
    while (workspace.files.some(function (f) { return f.name === name; })) { name = stem + ' ' + n + ext; n++; }
    return name;
  }
  function shouldOfferOnScreenKeyboard() { return true; }
  function closeMenu() { $('newMenu').hidden = true; $('newBtn').setAttribute('aria-expanded', 'false'); }
  function closeContextMenu() { $('contextMenu').hidden = true; }
  function replaceSpellSpan(el, word) {
    if (!el) return;
    pushUndo();
    var text = document.createTextNode(word);
    el.parentNode.replaceChild(text, el);
    editor.normalize();
    changed();
    restoreCaret();
    checkSpelling();
  }
  function showContextMenu(event, fileId) {
    event.preventDefault();
    event.stopPropagation();
    contextFileId = fileId || workspace.activeId;
    var menu = $('contextMenu');
    var old = menu.querySelector('.spell-fix-row');
    if (old) old.remove();
    var oldSep = menu.querySelector('.context-sep');
    if (oldSep) oldSep.remove();
    var inEditor = editor.contains(event.target);
    if (inEditor) {
      var sel = window.getSelection();
      var hasSelection = sel && sel.rangeCount && !sel.getRangeAt(0).collapsed;
      var cutBtn = menu.querySelector('[data-context="cut"]');
      var copyBtn = menu.querySelector('[data-context="copy"]');
      if (cutBtn) cutBtn.disabled = !hasSelection;
      if (copyBtn) copyBtn.disabled = !hasSelection;
      var sep = document.createElement('div');
      sep.className = 'context-sep';
      menu.insertBefore(sep, menu.firstChild);
      var spellEl = event.target && event.target.closest ? event.target.closest('.spell-error') : null;
      if (spellEl && editor.contains(spellEl)) {
        var row = document.createElement('div');
        row.className = 'spell-fix-row';
        var word = spellEl.dataset.word || spellEl.textContent;
        var title = document.createElement('div');
        title.className = 'spell-fix-title';
        title.textContent = '\u201c' + word + '\u201d \u2014 suggestions';
        row.appendChild(title);
        var list = String(spellEl.dataset.suggestions || '').split('|').filter(Boolean).slice(0, 5);
        if (!list.length) {
          var none = document.createElement('div');
          none.className = 'spell-fix-none';
          none.textContent = 'No close match';
          row.appendChild(none);
        }
        list.forEach(function (suggestion) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'spell-fix-item';
          button.textContent = '\u2713 ' + suggestion;
          button.onclick = function (ev) {
            ev.stopPropagation();
            closeContextMenu();
            replaceSpellSpan(spellEl, suggestion);
          };
          row.appendChild(button);
        });
        var ignore = document.createElement('button');
        ignore.type = 'button';
        ignore.className = 'spell-fix-item spell-fix-ignore';
        ignore.textContent = 'Ignore once';
        ignore.onclick = function (ev) { ev.stopPropagation(); closeContextMenu(); };
        row.appendChild(ignore);
        menu.insertBefore(row, menu.firstChild);
      }
    }
    menu.hidden = false;
    menu.style.left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8) + 'px';
  }
  function hideOrders() {
    var pops = document.querySelectorAll('.orders');
    for (var i = 0; i < pops.length; i++) pops[i].remove();
  }
  function isHome() { return !$('homeScreen').hidden; }
  function setActivity(id) {
    document.querySelectorAll('.activity').forEach(function (button) { button.classList.toggle('active', button.id === id); });
  }

  function suppressNativeKeyboard() {
    editor.setAttribute('inputmode', 'none');
    editor.setAttribute('virtualkeyboardpolicy', 'manual');
    if (navigator.virtualKeyboard && navigator.virtualKeyboard.hide) {
      try { navigator.virtualKeyboard.hide(); } catch (e) {}
    }
  }
  function allowNativeKeyboard() {
    editor.setAttribute('inputmode', 'text');
    editor.removeAttribute('virtualkeyboardpolicy');
  }
  function rememberCaret() {
    var offsets = selectionOffsets();
    caretStart = offsets.start;
    caretEnd = offsets.end;
  }
  function restoreCaret() {
    restoreSelection(caretStart, caretEnd);
  }
  function checkSession() {
    fetch('/api/me').then(function (r) { return r.json(); }).then(function (data) {
      currentUser = data.user || null;
      updateAvatar();
    }).catch(function () { currentUser = null; updateAvatar(); });
  }
  function updateAvatar() {
    var btn = $('avatarBtn');
    if (!btn) return;
    if (currentUser) {
      btn.textContent = (currentUser.name || currentUser.email || 'U')[0].toUpperCase();
      btn.title = currentUser.name + ' (' + currentUser.email + ') - Click to sign out';
    } else {
      btn.textContent = 'Z';
      btn.title = 'Sign in to save across devices';
    }
  }
  function showAuth(mode) {
    var dialog = $('authDialog');
    var isSignup = mode === 'signup';
    $('authTitle').textContent = isSignup ? 'Create your account' : 'Sign in to Werket';
    $('authSubmitBtn').textContent = isSignup ? 'Create account' : 'Sign in';
    $('authNameField').style.display = isSignup ? 'flex' : 'none';
    $('authSwitchText').textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
    $('authSwitchBtn').textContent = isSignup ? 'Sign in' : 'Create one';
    $('authError').hidden = true;
    $('authForm').dataset.mode = mode;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    setTimeout(function () { (isSignup ? $('authName') : $('authEmail')).focus(); }, 100);
  }
  function closeAuth() {
    var dialog = $('authDialog');
    if (dialog.open) dialog.close(); else dialog.removeAttribute('open');
  }
  function submitAuth(event) {
    event.preventDefault();
    var mode = $('authForm').dataset.mode || 'login';
    var url = mode === 'signup' ? '/api/register' : '/api/login';
    var body = {email: $('authEmail').value, password: $('authPassword').value};
    if (mode === 'signup') body.name = $('authName').value;
    var errEl = $('authError');
    errEl.hidden = true;
    fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
      .then(function (r) { return r.json().then(function (d) { return {ok: r.ok, data: d}; }); })
      .then(function (result) {
        if (!result.ok) { errEl.textContent = result.data.error || 'Error'; errEl.hidden = false; return; }
        currentUser = result.data.user;
        updateAvatar();
        closeAuth();
        setStatus('Signed in as ' + currentUser.name);
        syncToCloud();
      }).catch(function (e) { errEl.textContent = 'Network error'; errEl.hidden = false; });
  }
  function signOut() {
    fetch('/api/logout', {method: 'POST'}).then(function () {
      currentUser = null;
      updateAvatar();
      setStatus('Signed out');
    }).catch(function () {});
  }
  function syncToCloud() {
    if (!currentUser) return;
    var payload = {files: workspace.files, openIds: workspace.openIds, activeId: workspace.activeId, projectName: workspace.projectName, font: workspace.font, size: workspace.size, align: workspace.align};
    fetch('/api/files/save', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) setStatus('Saved to account'); })
      .catch(function () { setStatus('Cloud save failed'); });
  }
  function loadFromCloud() {
    if (!currentUser) return;
    fetch('/api/files').then(function (r) { return r.json(); }).then(function (data) {
      if (data.files && data.files.length) {
        workspace.files = data.files;
        workspace.openIds = data.openIds || [];
        workspace.activeId = data.activeId || (data.files[0] && data.files[0].id);
        workspace.projectName = data.projectName || 'My documents';
        workspace.font = workspace.font || 'Noto Sans Ethiopic';
        workspace.size = data.size || 18;
        workspace.align = data.align || 'left';
        saveWorkspace();
        render();
        setStatus('Loaded from account');
      }
    }).catch(function () {});
  }
  function showSaveMenu() {
    var menu = $('saveMenu');
    var btn = $('saveBtn');
    saveMenuOpen = !saveMenuOpen;
    menu.hidden = !saveMenuOpen;
    btn.setAttribute('aria-expanded', saveMenuOpen ? 'true' : 'false');
    if (saveMenuOpen) {
      $('saveCloudBtn').textContent = currentUser ? 'Save to your account (' + currentUser.name + ')' : 'Sign in to save to cloud';
    }
  }
  function closeSaveMenu() { saveMenuOpen = false; var m = $('saveMenu'); if (m) m.hidden = true; var b = $('saveBtn'); if (b) b.setAttribute('aria-expanded', 'false'); }

  function focusEditor() {
    if (document.activeElement === editor) {
      restoreCaret();
      return;
    }
    editor.focus({preventScroll: true});
    restoreCaret();
  }
  function onTap(el, fn) {
    el.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      setTimeout(function () { fn(event); }, 0);
    });
  }
  function setOsk(open) {
    if (!shouldOfferOnScreenKeyboard()) {
      oskOpen = false;
      $('keyboardPanel').classList.remove('open');
      $('keyboardPanel').hidden = true;
      $('keyboardBtn').hidden = true;
      document.body.classList.remove('osk-open', 'touch-writing');
      allowNativeKeyboard();
      hideOrders();
      return;
    }
    document.body.classList.add('touch-writing');
    $('keyboardBtn').hidden = false;
    oskOpen = !!open;
    $('keyboardPanel').hidden = !oskOpen;
    $('keyboardPanel').classList.toggle('open', oskOpen);
    document.body.classList.toggle('osk-open', oskOpen);
    $('keyboardBtn').textContent = oskOpen ? 'Hide keyboard' : 'Keyboard';
    localStorage.setItem(oskPrefKey, oskOpen ? '1' : '0');
    hideOrders();
    if (oskOpen) {
      suppressNativeKeyboard();
      setTimeout(function () { focusEditor(); }, 0);
    } else {
      allowNativeKeyboard();
    }
  }
  function layoutChrome() {
    var offer = shouldOfferOnScreenKeyboard();
    document.body.classList.toggle('touch-writing', offer);
    document.body.classList.toggle('has-physical-keyboard', !offer);
    if (!offer) setOsk(false);
    else {
      $('keyboardBtn').hidden = false;
      if (oskOpen) setOsk(true);
    }
  }

  function renderTree() {
    var tree = $('fileTree');
    var folders = {};
    workspace.files.forEach(function (f) { (folders[f.folder || '__root'] || (folders[f.folder || '__root'] = [])).push(f); });
    var html = '';
    Object.keys(folders).sort(function (a) { return a === '__root' ? -1 : 1; }).forEach(function (folder) {
      var items = folders[folder];
      if (folder !== '__root') html += '<div class="tree-folder"><div class="tree-folder-label"><span>▾</span><span>▱</span>' + escapeHtml(folder) + '</div>';
      items.sort(function (a,b) { return a.name.localeCompare(b.name); }).forEach(function (f) {
        html += '<button class="tree-file ' + (f.id === workspace.activeId ? 'active' : '') + '" data-file="' + f.id + '"><span class="file-icon">' + (f.name.endsWith('.md') ? '◇' : '□') + '</span>' + escapeHtml(f.name) + '</button>';
      });
      if (folder !== '__root') html += '</div>';
    });
    tree.innerHTML = html;
    tree.querySelectorAll('[data-file]').forEach(function (button) {
      button.onclick = function (event) {
        if (event.target.closest('[data-rename]') || event.target.closest('[data-filedel]')) return;
        openFile(button.dataset.file);
      };
      button.ondblclick = function (event) {
        if (event.target.closest('[data-rename]') || event.target.closest('[data-filedel]')) return;
        openFile(button.dataset.file); setStatus('Opened');
      };
      button.oncontextmenu = function (event) { showContextMenu(event, button.dataset.file); };
    });
    tree.querySelectorAll('[data-rename]').forEach(function (btn) {
      btn.onclick = function (event) {
        event.stopPropagation();
        var fid = btn.dataset.rename;
        var f = workspace.files.find(function (item) { return item.id === fid; });
        if (!f) return;
        var name = window.prompt('Rename file', f.name);
        if (name && name.trim()) { f.name = name.trim(); save(); render(); }
      };
    });
    tree.querySelectorAll('[data-filedel]').forEach(function (btn) {
      btn.onclick = function (event) {
        event.stopPropagation();
        var fid = btn.dataset.filedel;
        var f = workspace.files.find(function (item) { return item.id === fid; });
        if (!f) return;
        if (workspace.files.length <= 1) { window.alert('Keep at least one document.'); return; }
        if (!window.confirm('Permanently delete ' + f.name + '? This cannot be undone.')) return;
        workspace.files = workspace.files.filter(function (item) { return item.id !== fid; });
        workspace.openIds = workspace.openIds.filter(function (item) { return item !== fid; });
        if (workspace.activeId === fid) workspace.activeId = workspace.openIds[workspace.openIds.length - 1] || workspace.files[0].id;
        if (!workspace.openIds.length) workspace.openIds = [workspace.activeId];
        save(); render();
      };
    });
    $('treeProjectName').textContent = (workspace.projectName || 'MY DOCUMENTS').toUpperCase();
    $('projectName').value = workspace.projectName || 'My documents';
  }

  function renderTabs() {
    $('tabs').innerHTML = workspace.openIds.map(function (id) {
      var f = workspace.files.find(function (item) { return item.id === id; });
      if (!f) return '';
      return '<div class="tab ' + (id === workspace.activeId ? 'active' : '') + '" data-tab="' + id + '"><span>' + escapeHtml(f.name) + '</span><button data-close="' + id + '" title="Close">×</button></div>';
    }).join('');
    $('tabs').querySelectorAll('[data-tab]').forEach(function (tab) { tab.onclick = function (event) { if (!event.target.dataset.close) openFile(tab.dataset.tab); }; });
    $('tabs').querySelectorAll('[data-close]').forEach(function (button) { button.onclick = function (event) { event.stopPropagation(); closeFile(button.dataset.close); }; });
    $('tabs').querySelectorAll('[data-tab]').forEach(function (tab) { tab.oncontextmenu = function (event) { showContextMenu(event, tab.dataset.tab); }; });
  }


  function renderHome() {
    $('homeTemplates').innerHTML = templates.map(function (template) {
      return '<button class="home-card" data-template="' + template.id + '"><span class="home-card-preview artwork-' + template.artwork + '"><span>' + template.icon + '</span></span><b>' + escapeHtml(template.name) + '</b><span>' + escapeHtml(template.description) + '</span></button>';
    }).join('');
    $('homeTemplates').querySelectorAll('[data-template]').forEach(function (button) {
      button.onclick = function () { createTemplate(templates.find(function (item) { return item.id === button.dataset.template; })); };
    });
    var recent = workspace.files.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).slice(0, 8);
    $('homeRecent').innerHTML = recent.length ? recent.map(function (f) {
      var snippet = (f.text || '').replace(/\s+/g, ' ').trim().slice(0, 72);
      return '<button class="recent-card" data-file="' + f.id + '"><b>' + escapeHtml(f.name) + '</b><span>' + escapeHtml(snippet || 'Empty document') + '</span></button>';
    }).join('') : '<span class="empty">No recent documents yet.</span>';
    $('homeRecent').querySelectorAll('[data-file]').forEach(function (button) { button.onclick = function () { openFile(button.dataset.file); }; });
  }

  function showHome() {
    hideOrders();
    closeMenu();
    $('homeScreen').hidden = false;
    document.body.classList.add('home-open');
    setActivity('homeActivity');
    setOsk(false);
    renderHome();
  }
  function hideHome() {
    $('homeScreen').hidden = true;
    document.body.classList.remove('home-open');
    setActivity('filesActivity');
  }

  function render() { renderTree(); renderTabs(); renderOutline(); loadActiveIntoEditor(); }
  function openFile(id) {
    if (!workspace.files.some(function (f) { return f.id === id; })) return;
    workspace.activeId = id;
    if (!workspace.openIds.includes(id)) workspace.openIds.push(id);
    phoneticBuffer = ''; phoneticRendered = '';
    hideHome();
    renderTree(); renderTabs(); loadActiveIntoEditor(); saveWorkspace();
    focusEditor();
  }
  function closeFile(id) {
    workspace.openIds = workspace.openIds.filter(function (item) { return item !== id; });
    if (workspace.activeId === id) workspace.activeId = workspace.openIds[workspace.openIds.length - 1] || workspace.files[0].id;
    if (!workspace.openIds.length) {
      workspace.activeId = null;
      showHome();
    }
    render(); saveWorkspace();
  }
  function loadActiveIntoEditor() {
    var f = activeFile();
    if (!f) {
      applyingHistory = true;
      editor.innerHTML = '';
      applyingHistory = false;
      $('fileStatus').textContent = 'No document open';
      updateStats();
      return;
    }
    applyingHistory = true;
    setEditorContent(f.text);
    applyingHistory = false;
    editor.style.fontFamily = workspace.font || 'Noto Sans Ethiopic';
    editor.style.fontSize = (workspace.size || 18) + 'px';
    editor.style.textAlign = workspace.align || 'left';
    $('fileStatus').textContent = f.name + ' · UTF-8';
    updateStats(); refreshSuggestions(); checkSpelling();
  }
  function updateStats() {
    var text = editorText();
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    $('editorStats').textContent = words + ' words · checking dictionary · ' + text.length + ' characters';
  }
  function snapshot() {
    var offsets = selectionOffsets();
    return {id: workspace.activeId, html: editor.innerHTML, text: editorText(), start: offsets.start, end: offsets.end};
  }
  function pushUndo() {
    if (applyingHistory) return;
    var snap = snapshot();
    var last = undoStack[undoStack.length - 1];
    if (last && last.id === snap.id && last.text === snap.text) return;
    undoStack.push(snap);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }
  function applySnap(snap) {
    if (!snap) return;
    if (snap.id && snap.id !== workspace.activeId) openFile(snap.id);
    applyingHistory = true;
    editor.innerHTML = snap.html != null ? snap.html : markdownToHtml(snap.text);
    restoreSelection(snap.start, snap.end);
    applyingHistory = false;
    changed();
    focusEditor();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    applySnap(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    applySnap(redoStack.pop());
  }
  function changed() {
    var f = activeFile(); if (!f) return;
    if (markingSpell) return;
    f.text = editorHtml(); f.updated = Date.now(); updateStats(); setStatus('Unsaved changes');
    rememberCaret();
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 550); refreshSuggestions(); checkSpelling();
  }
  function save() { saveWorkspace(); renderTree(); setStatus('Saved locally'); }

  function insert(text) {
    pushUndo();
    editor.focus({preventScroll: true});
    if (text === '\n' || text === '\r\n') {
      document.execCommand('insertLineBreak');
      changed();
      restoreCaret();
      return;
    }
    var sel = window.getSelection();
    var inserted = false;
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      var offsets = selectionOffsets();
      if (offsets.start !== undefined) {
        replaceTextRange(offsets.start, offsets.end, text);
        inserted = true;
      }
    }
    if (!inserted) {
      var range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      var tnode = document.createTextNode(text);
      range.insertNode(tnode);
      range.setStartAfter(tnode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      caretStart = caretEnd = editorText().length;
    }
    changed();
    restoreCaret();
  }
  function replaceSuggestion(word) {
    pushUndo();
    var offsets = selectionOffsets(), left = editorText().slice(0, offsets.start), match = left.match(/[\u1200-\u135a]+$/), start = match ? offsets.start - match[0].length : offsets.start;
    replaceTextRange(start, offsets.end, word + ' '); changed(); restoreCaret();
  }
  function findInDocument(direction) {
    var query = $('findInput').value;
    if (!query) { $('findCount').textContent = ''; return; }
    var source = editorText().toLocaleLowerCase(), needle = query.toLocaleLowerCase(), start = selectionOffsets().end;
    var index = direction < 0 ? source.lastIndexOf(needle, Math.max(0, start - 1)) : source.indexOf(needle, start);
    if (index < 0) index = direction < 0 ? source.lastIndexOf(needle) : source.indexOf(needle);
    if (index >= 0) { focusEditor(); restoreSelection(index, index + query.length); $('findCount').textContent = 'Found'; }
    else $('findCount').textContent = 'Not found';
  }

  function refreshSuggestions() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () {
      fetch('/api/suggest?text=' + encodeURIComponent(editorText())).then(function (r) { return r.json(); }).then(function (data) {
        var values = (data.words && data.words.length ? data.words : (data.next || [])).slice(0, 6);
        var suggestionMarkup = values.length ? values.map(function (word) { return '<button class="suggestion" data-word="' + escapeHtml(word) + '">' + escapeHtml(word) + '</button>'; }).join('') : '<span class="empty">Type to see suggestions</span>';
        var ks = document.getElementById('keyboardSuggestions');
        if (ks) ks.innerHTML = '<span class="keyboard-suggest-label">Suggestions</span>' + suggestionMarkup;
        if (ks) ks.querySelectorAll('[data-word]').forEach(function (button) { button.onclick = function () { replaceSuggestion(button.dataset.word); hideOrders(); }; });
      }).catch(function () {
        var ks = document.getElementById('keyboardSuggestions');
        if (ks) ks.innerHTML = '<span class="keyboard-suggest-label">Suggestions</span><span class="empty">Offline</span>';
      });
    }, 130);
  }
  function clearSpellMarks(root) {
    (root || editor).querySelectorAll('.spell-error').forEach(function (el) {
      el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
    });
    (root || editor).normalize();
  }
  function wrapSpellRange(root, start, end, item) {
    var a = nodeAtOffset(root, start), b = nodeAtOffset(root, end);
    if (!a.node || a.node.nodeType !== 3 || a.node !== b.node) return;
    if (a.node.parentNode && a.node.parentNode.classList && a.node.parentNode.classList.contains('spell-error')) return;
    var text = a.node, value = text.nodeValue, parent = text.parentNode;
    var before = value.slice(0, a.offset), mid = value.slice(a.offset, b.offset), after = value.slice(b.offset);
    if (!mid) return;
    var span = document.createElement('span');
    span.className = 'spell-error';
    span.dataset.word = item.word;
    span.dataset.suggestions = (item.suggestions || []).map(function (s) { return s.word; }).join('|');
    span.textContent = mid;
    var frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, text);
  }
  function markActiveLineSpelling(words) {
    var block = activeBlock();
    if (!block) return;
    var offsets = selectionOffsets();
    var caret = 0;
    try {
      var range = document.createRange();
      range.selectNodeContents(block);
      var sel = window.getSelection();
      if (sel && sel.rangeCount && block.contains(sel.anchorNode)) {
        var before = range.cloneRange();
        before.setEnd(sel.anchorNode, sel.anchorOffset);
        caret = before.toString().length;
      }
    } catch (e) {}
    markingSpell = true;
    clearSpellMarks(block);
    (words || []).filter(function (item) { return !item.known; }).slice().reverse().forEach(function (item) {
      if (caret > item.start && caret <= item.end) return;
      wrapSpellRange(block, item.start, item.end, item);
    });
    markingSpell = false;
    restoreSelection(offsets.start, offsets.end);
  }
  function checkSpelling() {
    clearTimeout(spellTimer);
    spellTimer = setTimeout(function () {
      var block = activeBlock();
      var lineText = block ? (block.innerText || '').replace(/\u00a0/g, ' ') : editorText();
      fetch('/api/check?text=' + encodeURIComponent(editorText())).then(function (r) { return r.json(); }).then(function (data) {
        var words = data.words || [], unknown = words.filter(function (word) { return !word.known; }), known = words.length - unknown.length;
        $('editorStats').textContent = words.length + ' words · ' + known + ' dictionary words · ' + editorText().length + ' characters';
        var badge = $('spellBadge');
        if (badge) {
          badge.textContent = unknown.length ? unknown.length + ' ISSUES' : 'CLEAN';
          badge.className = 'keyboard-info-badge' + (unknown.length ? ' warn' : '');
        }
        var summary = $('spellSummary');
        if (summary) summary.textContent = unknown.length ? unknown.length + ' misspelled word' + (unknown.length > 1 ? 's' : '') + '. Right-click to correct.' : 'All words in dictionary.';
      }).catch(function () {});
      fetch('/api/check?text=' + encodeURIComponent(lineText)).then(function (r) { return r.json(); }).then(function (data) {
        markActiveLineSpelling(data.words || []);
      }).catch(function () {});
    }, 280);
  }

  function compose(raw) {
    var map = phon, result = '', index = 0;
    while (index < raw.length) {
      var family = map[raw[index]];
      if (!family) { result += raw[index++]; continue; }
      index++; var vowel = '';
      if ((raw.slice(index, index + 2).toLowerCase() === 'ie') || (raw.slice(index, index + 2).toLowerCase() === 'ee')) { vowel = raw.slice(index, index + 2).toLowerCase(); index += 2; }
      else if (Object.prototype.hasOwnProperty.call(vowels, (raw[index] || '').toLowerCase())) { vowel = (raw[index] || '').toLowerCase(); index++; }
      result += String.fromCodePoint(family.codePointAt(0) + vowels[vowel]);
    }
    return result;
  }
  function phoneticKey(event) {
    if (!$('phoneticToggle').checked || event.ctrlKey || event.metaKey || event.altKey) return false;
    var key = event.key, offsets = selectionOffsets(), position = offsets.start;
    if (key === 'Tab') { var ks = document.getElementById('keyboardSuggestions'); var suggestion = ks ? ks.querySelector('[data-word]') : null; if (suggestion) { event.preventDefault(); replaceSuggestion(suggestion.dataset.word); return true; } return false; }
    if (offsets.end !== position) { phoneticBuffer = ''; return false; }
    if (/^[A-Za-z]$/.test(key)) {
      if (position !== phoneticStart + phoneticRendered.length) phoneticBuffer = '';
      if (!phoneticBuffer) { phoneticStart = position; phoneticRendered = ''; pushUndo(); }
      phoneticBuffer += key; var rendered = compose(phoneticBuffer);
      replaceTextRange(phoneticStart, phoneticStart + phoneticRendered.length, rendered); phoneticRendered = rendered; changed(); event.preventDefault(); return true;
    }
    if (key === 'Backspace' && phoneticBuffer) { phoneticBuffer = phoneticBuffer.slice(0, -1); var next = compose(phoneticBuffer); replaceTextRange(phoneticStart, phoneticStart + phoneticRendered.length, next); phoneticRendered = next; changed(); event.preventDefault(); return true; }
    if (key.length === 1 || key === 'Enter') { phoneticBuffer = ''; phoneticRendered = ''; }
    return false;
  }

  function showOrders(button, family) {
    var open = document.querySelector('.orders');
    var same = open && open.dataset.family === family;
    hideOrders();
    if (same) return;
    var pop = document.createElement('div');
    pop.className = 'orders';
    pop.dataset.family = family;
    pop.setAttribute('role', 'listbox');
    orders.forEach(function (order, index) {
      var choice = document.createElement('button');
      var ch = String.fromCodePoint(family.codePointAt(0) + index);
      choice.type = 'button';
      choice.textContent = ch;
      choice.title = order === 'silent' ? 'Sixth order' : order;
      if (index === 0) choice.className = 'base';
      onTap(choice, function () {
        insert(ch);
        hideOrders();
      });
      pop.appendChild(choice);
    });
    document.body.appendChild(pop);
    var br = button.getBoundingClientRect();
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;
    var left = br.left + (br.width - pw) / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    var top = br.top - ph - 8;
    if (top < 8) top = br.bottom + 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function renderKeyboard() {
    var host = $('keyboard'), layout = [7, 8, 8, 8], cursor = 0, html = '<div class="keyboard-hint">Tap a family for its seven orders · the small label is its phonetic key</div>';
    layout.forEach(function (size) { html += '<div class="keys">'; families.slice(cursor, cursor + size).forEach(function (family, offset) { html += '<button type="button" class="key" data-family="' + family + '"><span>' + family + '</span><small>' + roman[cursor + offset] + '</small></button>'; }); html += '</div>'; cursor += size; });
    html += '<div class="keys">' + symbols.slice(0, 9).map(function (symbol) { return '<button type="button" class="key fn" data-symbol="' + symbol + '">' + symbol + '</button>'; }).join('') + '<button type="button" class="key fn space" data-symbol=" ">SPACE</button><button type="button" class="key fn" data-symbol="\\n">⏎</button><button type="button" class="key fn" id="backspaceKey">⌫</button></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-family]').forEach(function (button) {
      onTap(button, function () { showOrders(button, button.dataset.family); });
    });
    host.querySelectorAll('[data-symbol]').forEach(function (button) {
      onTap(button, function () { hideOrders(); insert(button.dataset.symbol === '\\n' ? '\n' : button.dataset.symbol); });
    });
    onTap($('backspaceKey'), function () {
      hideOrders();
      pushUndo();
      editor.focus({preventScroll: true});
      var sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        var offsets = selectionOffsets(), p = offsets.start, q = offsets.end;
        if (q > p) replaceTextRange(p, q, '');
        else if (p > 0) replaceTextRange(p - 1, p, '');
      } else {
        var text = editorText();
        if (text.length > 0) {
          var range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          editor.textContent = text.slice(0, -1);
          caretStart = caretEnd = text.length - 1;
        }
      }
      changed();
      restoreCaret();
    });
  }

  function bookFiles() { return [file('outline.md', '<h1>Book outline</h1><h2>Premise</h2><p>Write the central idea here.</p><h2>Structure</h2><ul><li>Beginning</li><li>Middle</li><li>End</li></ul>', ''), file('characters.md', '<h1>Characters</h1><h2>Main character</h2><p>Name, desire, conflict, and change.</p>', ''), file('chapter-01.md', '<h1>Chapter 01</h1><p>Begin the first scene here.</p>', 'chapters'), file('chapter-02.md', '<h1>Chapter 02</h1><p>Continue the story here.</p>', 'chapters'), file('research.md', '<h1>Research notes</h1><p>Keep references and ideas here.</p>', '')]; }
  function addCreatedFiles(created, projectName) {
    created.forEach(function (f) { workspace.files.push(f); });
    workspace.activeId = created[0].id;
    workspace.openIds = created.map(function (f) { return f.id; }).concat(workspace.openIds || []).filter(function (id, index, all) { return all.indexOf(id) === index; });
    if (projectName) workspace.projectName = projectName;
    closeTemplates();
    hideHome();
    saveWorkspace();
    render();
    setStatus('Document created');
    focusEditor();
  }
  function createTemplate(template) {
    if (!template) return;
    var created = template.book ? bookFiles() : template.files.map(function (item) { return file(uniqueName(item[0]), item[1], ''); });
    addCreatedFiles(created, template.id === 'book' ? 'New book' : workspace.projectName);
  }
  function closeTemplates() {
    var dialog = $('templateDialog');
    if (dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  function showTemplates() {
    closeMenu();
    var dialog = $('templateDialog');
    $('templateGrid').innerHTML = templates.map(function (template) { return '<button class="template-card" data-template="' + template.id + '"><span class="template-art artwork-' + template.artwork + '"><span>' + template.icon + '</span></span><b>' + template.name + '</b><span>' + template.description + '</span></button>'; }).join('');
    $('templateGrid').querySelectorAll('[data-template]').forEach(function (button) { button.onclick = function () { createTemplate(templates.find(function (item) { return item.id === button.dataset.template; })); }; });
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function createBlank() { createTemplate(templates[0]); }
  function createFile() {
    closeMenu();
    var name = window.prompt('File name', uniqueName('notes.md'));
    if (!name) return;
    var f = file(uniqueName(name), '', '');
    workspace.files.push(f);
    openFile(f.id);
    save();
  }
  function renameFile() { var current = activeFile(); if (!current) return; var name = window.prompt('Rename file', current.name); if (name && name.trim()) { current.name = name.trim(); save(); render(); } }
  function duplicateFile() { var current = activeFile(); if (!current) return; var copy = file(uniqueName(current.name.replace(/(\.[^.]+)?$/, ' copy$1')), current.text, current.folder); workspace.files.push(copy); openFile(copy.id); save(); }
  function deleteFile() { var current = activeFile(); if (!current || workspace.files.length === 1) { window.alert('Keep at least one document in the workspace.'); return; } if (!window.confirm('Delete ' + current.name + '?')) return; workspace.files = workspace.files.filter(function (item) { return item.id !== current.id; }); workspace.openIds = workspace.openIds.filter(function (item) { return item !== current.id; }); workspace.activeId = workspace.openIds[workspace.openIds.length - 1] || workspace.files[0].id; if (!workspace.openIds.length) workspace.openIds = [workspace.activeId]; save(); render(); }
  function toggleExplorer() { $('explorerPanel').classList.toggle('open'); setActivity($('explorerPanel').classList.contains('open') ? 'filesActivity' : 'homeActivity'); }

  $('projectName').oninput = function () { workspace.projectName = $('projectName').value; $('treeProjectName').textContent = workspace.projectName.toUpperCase(); saveWorkspace(); };
  document.addEventListener('pointerdown', function (event) {
    if (!event.target.closest('.key[data-family]') && !event.target.closest('.orders')) hideOrders();
    if (!event.target.closest('.menu-wrap')) { closeMenu(); closeSaveMenu(); }
    if (!event.target.closest('.context-menu')) closeContextMenu();
  });
  editor.addEventListener('contextmenu', function (event) { showContextMenu(event, workspace.activeId); });
  // Double-click a yellow misspelling to instantly apply its best suggestion.
  editor.addEventListener('dblclick', function (event) {
    var spellEl = event.target && event.target.closest ? event.target.closest('.spell-error') : null;
    if (spellEl && editor.contains(spellEl)) {
      event.preventDefault();
      var best = String(spellEl.dataset.suggestions || '').split('|').filter(Boolean)[0];
      if (best) replaceSpellSpan(spellEl, best);
      return;
    }
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var node = range.startContainer;
    if (node.nodeType !== 3) return;
    var text = node.nodeValue;
    var start = range.startOffset;
    var end = range.endOffset;
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
    if (start !== range.startOffset || end !== range.endOffset) {
      range.setStart(node, start);
      range.setEnd(node, end);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  document.querySelectorAll('[data-context]').forEach(function (button) {
    button.onclick = function () {
      var action = button.dataset.context, id = contextFileId;
      closeContextMenu();
      if (action === 'cut') { document.execCommand('cut'); return; }
      if (action === 'copy') { document.execCommand('copy'); return; }
      if (action === 'paste') { focusEditor(); document.execCommand('paste'); return; }
      if (action === 'new') return createFile();
      if (id && id !== workspace.activeId && action !== 'open') openFile(id);
      if (action === 'open' && id) return openFile(id);
      if (action === 'rename') return renameFile();
      if (action === 'duplicate') return duplicateFile();
      if (action === 'close' && id) return closeFile(id);
      if (action === 'delete') return deleteFile();
    };
  });
  $('saveMenu').querySelectorAll('[data-save]').forEach(function (button) {
    button.onclick = function () {
      closeSaveMenu();
      var target = button.dataset.save;
      if (target === 'local') { save(); setStatus('Saved to this device'); }
      else if (target === 'cloud') {
        if (currentUser) { syncToCloud(); }
        else { showAuth('login'); }
      }
      else if (target === 'download') {
        var f = activeFile();
        if (f) {
          var link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([editorText()], {type:'text/plain;charset=utf-8'}));
          link.download = f.name.replace(/\.md$/, '') + '.txt';
          link.click();
          URL.revokeObjectURL(link.href);
        }
      }
    };
  });
  $('avatarBtn').onclick = function () {
    if (currentUser) {
      if (window.confirm('Signed in as ' + currentUser.name + ' (' + currentUser.email + ')\n\nSign out?')) signOut();
    } else {
      showAuth('login');
    }
  };
  $('authForm').onsubmit = submitAuth;
  $('authSwitchBtn').onclick = function () {
    var mode = $('authForm').dataset.mode === 'signup' ? 'login' : 'signup';
    showAuth(mode);
  };
  $('closeAuth').onclick = closeAuth;
  $('authStayLocal').onclick = closeAuth;
  $('authDialog').onclick = function (event) { if (event.target === $('authDialog')) closeAuth(); };
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { hideOrders(); closeMenu(); closeContextMenu(); if ($('templateDialog').open) closeTemplates(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); showHome(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); hideHome(); $('findBar').classList.add('open'); $('findInput').focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); applyFormat('bold'); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); applyFormat('italic'); }
  });
  editor.addEventListener('beforeinput', function () { if (!applyingHistory) pushUndo(); });
  editor.addEventListener('input', changed);
  editor.addEventListener('keyup', rememberCaret);
  editor.addEventListener('click', rememberCaret);
  editor.addEventListener('select', rememberCaret);
  editor.addEventListener('blur', rememberCaret);
  document.addEventListener('selectionchange', rememberCaret);
  editor.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); window.print(); }
    else { phoneticKey(event); }
  });
  editor.addEventListener('focus', function () {});
  editor.addEventListener('touchstart', function () {}, {passive: true});

  $('saveBtn').onclick = function (event) {
    event.stopPropagation();
    showSaveMenu();
  };
  $('newBtn').onclick = function (event) {
    event.stopPropagation();
    var open = $('newMenu').hidden;
    $('newMenu').hidden = !open;
    $('newBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  $('newMenu').querySelectorAll('[data-new]').forEach(function (button) {
    button.onclick = function () {
      closeMenu();
      createTemplate(templates.find(function (item) { return item.id === button.dataset.new; }));
    };
  });
  $('newFromTemplate').onclick = function () { closeMenu(); showTemplates(); };
  $('printBtn').onclick = function () { hideHome(); window.print(); };
  $('newFileBtn').onclick = createFile;
  $('newDocBtn').onclick = createBlank;
  $('newProjectBtn').onclick = showTemplates;
  $('templatesBtn').onclick = showTemplates;
  $('templatesActivity').onclick = function () { showTemplates(); setActivity('templatesActivity'); };
  $('homeActivity').onclick = showHome;
  $('filesActivity').onclick = function () {
    var wasHome = isHome();
    hideHome();
    if (shouldOfferOnScreenKeyboard()) {
      if (wasHome) $('explorerPanel').classList.add('open');
      else $('explorerPanel').classList.toggle('open');
    }
    setActivity('filesActivity');
  };
  $('searchActivity').onclick = function () { hideHome(); $('findBar').classList.add('open'); $('findInput').focus(); setActivity('searchActivity'); };
  $('closeTemplates').onclick = closeTemplates;
  $('keyboardBtn').onclick = function () { setOsk(!oskOpen); };
  $('closeKeyboard').onclick = function () { setOsk(false); };
  $('renameFileBtn').onclick = renameFile;
  $('duplicateFileBtn').onclick = duplicateFile;
  $('deleteFileBtn').onclick = deleteFile;
  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;
  $('findBtn').onclick = function () { hideHome(); $('findBar').classList.add('open'); $('findInput').focus(); };
  $('closeFind').onclick = function () { $('findBar').classList.remove('open'); };
  $('findNext').onclick = function () { findInDocument(1); };
  $('findPrev').onclick = function () { findInDocument(-1); };
  $('findInput').oninput = function () { findInDocument(1); };
  $('fontFamily').value = workspace.font || 'Noto Sans Ethiopic';
  $('fontSize').value = String(workspace.size || 18);
  $('fontFamily').onchange = function () { workspace.font = $('fontFamily').value; editor.style.fontFamily = workspace.font; save(); };
  $('fontSize').onchange = function () { workspace.size = Number($('fontSize').value); editor.style.fontSize = workspace.size + 'px'; save(); };
  $('zoom').onchange = function () { document.querySelector('.document-paper').style.transform = 'scale(' + $('zoom').value + ')'; document.querySelector('.document-paper').style.transformOrigin = 'top center'; };
  document.querySelectorAll('[data-align]').forEach(function (button) { button.onclick = function () { workspace.align = button.dataset.align; editor.style.textAlign = workspace.align; save(); }; });
  function currentBlockNode() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var node = sel.anchorNode;
    if (!node) return null;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== editor && !/^(P|H1|H2|H3|DIV|LI|UL|OL)$/i.test(node.nodeName)) node = node.parentNode;
    return (node && node !== editor) ? node : null;
  }
  function cleanMarkdownFromTextNodes(root) {
    root.childNodes.forEach(function (node) {
      if (node.nodeType === 3) node.textContent = stripMarkdownNoise(node.textContent);
      else if (node.nodeType === 1) cleanMarkdownFromTextNodes(node);
    });
  }
  function applyBlock(tag) {
    var name = String(tag || 'p').replace(/[<>]/g, '').toLowerCase();
    if (!/^(h1|h2|h3|p)$/.test(name)) name = 'p';
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var block = currentBlockNode();
    if (!block) {
      var replacement = document.createElement(name);
      var range = sel.getRangeAt(0);
      if (range.collapsed) {
        replacement.innerHTML = '<br>';
        range.insertNode(replacement);
        range.setStart(replacement, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        try {
          replacement.appendChild(range.extractContents());
          range.insertNode(replacement);
          sel.removeAllRanges();
          var after = document.createRange();
          after.selectNodeContents(replacement);
          after.collapse(false);
          sel.addRange(after);
        } catch (e) {}
      }
      return;
    }
    if (block.nodeName.toLowerCase() === name) {
      var para = document.createElement('p');
      para.innerHTML = block.innerHTML || '<br>';
      block.parentNode.replaceChild(para, block);
      return;
    }
    var next = document.createElement(name);
    next.innerHTML = block.innerHTML || '<br>';
    cleanMarkdownFromTextNodes(next);
    if (!next.innerHTML) next.innerHTML = '<br>';
    block.parentNode.replaceChild(next, block);
  }
  function applyInline(tag) {
    var name = String(tag || 'strong').toLowerCase();
    if (name === 'b') name = 'strong';
    if (name === 'i') name = 'em';
    if (!/^(strong|em)$/.test(name)) return false;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    var range = sel.getRangeAt(0);
    if (range.collapsed) {
      // Insert <strong><br></strong> so cursor stays inside for typing
      var el = document.createElement(name);
      el.innerHTML = '<br>';
      range.insertNode(el);
      range.setStartAfter(el);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
    var el = document.createElement(name);
    try {
      el.appendChild(range.extractContents());
      // Strip stray ** or _ markers inside the bolded text without losing HTML formatting.
      cleanMarkdownFromTextNodes(el);
      range.insertNode(el);
      sel.removeAllRanges();
      var after = document.createRange();
      after.selectNodeContents(el);
      sel.addRange(after);
      return true;
    } catch (e) {
      return false;
    }
  }
  function applyFormat(command, value) {
    pushUndo();
    var cmd = String(command || '').toLowerCase();
    var val = String(value || '').replace(/[<>]/g, '').toLowerCase();
    if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3' || val === 'h1' || val === 'h2' || val === 'h3') {
      applyBlock(val === 'h1' || val === 'h2' || val === 'h3' ? val : cmd);
      changed(); restoreCaret(); return;
    }
    if (cmd === 'formatblock') {
      applyBlock(val || 'p');
      changed(); restoreCaret(); return;
    }
    if (cmd === 'bold' || cmd === 'strong') {
      if (applyInline('strong')) { changed(); restoreCaret(); return; }
    }
    if (cmd === 'italic' || cmd === 'em') {
      if (applyInline('em')) { changed(); restoreCaret(); return; }
    }
    if (cmd === 'insertunorderedlist' || cmd === 'insertorderedlist') {
      var sel = window.getSelection();
      if (sel && sel.rangeCount) {
        var range = sel.getRangeAt(0);
        var block = currentBlockNode();
        if (block && block.parentNode && block.parentNode.classList && block.parentNode.classList.contains('editor-bullet')) return;
        if (block && block.parentNode && block.parentNode.classList && block.parentNode.classList.contains('editor-number')) return;
        var wrapper = document.createElement(cmd === 'insertunorderedlist' ? 'div' : 'div');
        wrapper.className = cmd === 'insertunorderedlist' ? 'editor-bullet' : 'editor-number';
        var prefix = cmd === 'insertunorderedlist' ? '\u2022 ' : '1. ';
        if (block) {
          wrapper.textContent = prefix + (block.textContent || '').trim();
          block.parentNode.replaceChild(wrapper, block);
        } else if (!range.collapsed) {
          wrapper.textContent = prefix + (range.toString() || '').trim();
          range.deleteContents();
          range.insertNode(wrapper);
        } else {
          wrapper.innerHTML = prefix + '<br>';
          range.insertNode(wrapper);
        }
        changed(); restoreCaret();
      }
      return;
    }
    changed(); restoreCaret();
  }
  document.querySelectorAll('[data-command]').forEach(function (button) { button.onclick = function () { applyFormat(button.dataset.command, button.dataset.value); }; });
  $('importBtn').onclick = function () { $('importFile').click(); };
  $('importFile').onchange = function (event) {
    var selected = event.target.files[0]; if (!selected) return;
    var reader = new FileReader();
    reader.onload = function () { var f = file(selected.name, String(reader.result || ''), ''); workspace.files.push(f); openFile(f.id); save(); };
    reader.readAsText(selected);
    event.target.value = '';
  };
  $('exportBtn').onclick = function () {
    var f = activeFile();
    if (!f) { setStatus('Open a document before exporting'); return; }
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([editorText()], {type:'text/plain;charset=utf-8'}));
    link.download = f.name.replace(/\.md$/, '') + '.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  $('brandHome').onclick = showHome;
  $('themeBtn').onclick = function () { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };

  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstall = event;
    var banner = $('installBanner');
    if (banner && !localStorage.getItem('werket-install-dismissed')) banner.classList.add('show');
  });
  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    var banner = $('installBanner');
    if (banner) banner.classList.remove('show');
    setStatus('App installed');
  });
  $('installYes').onclick = function () {
    $('installBanner').classList.remove('show');
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; }); }
  };
  $('installNo').onclick = function () {
    $('installBanner').classList.remove('show');
    localStorage.setItem('werket-install-dismissed', '1');
  };

  window.addEventListener('resize', layoutChrome);
  window.addEventListener('orientationchange', layoutChrome);

  initTheme();
  checkSession();
  renderKeyboard();
  render();
  layoutChrome();
  var emptyWorkspace = workspace.files.every(function (f) { return !(f.text || '').trim(); });
  if (emptyWorkspace) showHome();
  else hideHome();
  if (shouldOfferOnScreenKeyboard() && localStorage.getItem(oskPrefKey) === '1') setOsk(true);

  var queryNew = new URLSearchParams(window.location.search).get('new');
  if (queryNew) {
    var tmpl = templates.find(function (t) { return t.id === queryNew; });
    if (tmpl) { createTemplate(tmpl); history.replaceState(null, '', '/'); }
  }
})();

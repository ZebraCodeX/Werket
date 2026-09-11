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
  var deviceKeyboardMode = localStorage.getItem(oskPrefKey) === '0';
  var kbLayer = 'fidel';
  var tapStart = 0, tapX = 0, tapY = 0;
  var caretStart = 0, caretEnd = 0;
  var contextFileId = null;
  var markingSpell = false;
  var currentUser = null;
  var saveMenuOpen = false;
  var exportMenuOpen = false;
  var assistantOpen = false;
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
  function markdownToHtml(value) { return WerketFormats.markdownToHtml(value); }
  function htmlToMarkdown(html) { return WerketFormats.htmlToMarkdown(html); }
  var BLOCK_RE = /^(P|H[1-6]|DIV|UL|OL|LI|BLOCKQUOTE|TABLE)$/i;
  function setEditorContent(value) {
    var source = String(value || '');
    editor.innerHTML = /^\s*<(?:h[1-6]|p|div|strong|em|ul|ol|li|br|blockquote)\b/i.test(source) ? source : markdownToHtml(source);
    normalizeEditorBlocks();
  }
  function normalizeEditorBlocks() {
    var offsets = selectionOffsets();
    var run = [], changed = false;
    function flush() {
      if (!run.length) return;
      var p = document.createElement('p');
      run[0].parentNode.insertBefore(p, run[0]);
      run.forEach(function (node) { p.appendChild(node); });
      run = [];
      changed = true;
    }
    Array.prototype.slice.call(editor.childNodes).forEach(function (child) {
      if (child.nodeType === 1 && BLOCK_RE.test(child.nodeName)) { flush(); return; }
      run.push(child);
    });
    flush();
    if (changed) { if (offsets) restoreSelection(offsets.start, offsets.end); editor.normalize(); }
    return changed;
  }
  function selectionOffsets() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    if (!editor.contains(selection.anchorNode)) return null;
    var range = selection.getRangeAt(0), before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.startContainer, range.startOffset);
    var selected = range.cloneRange();
    selected.selectNodeContents(editor);
    selected.setEnd(range.endContainer, range.endOffset);
    return {start: before.toString().length, end: selected.toString().length};
  }
  function nodeAtOffset(root, offset) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node, count = 0, text = null;
    while ((node = walker.nextNode())) {
      var next = count + node.nodeValue.length;
      if (offset < next) return {node: node, offset: Math.max(0, offset - count)};
      if (offset === next) {
        var container = node.parentElement;
        while (container && container !== root && !/^(P|H1|H2|H3|H4|H5|H6|DIV|LI)$/i.test(container.nodeName)) {
          container = container.parentElement;
        }
        if (container && container !== root && container.nextElementSibling && /^(P|H1|H2|H3|H4|H5|H6|DIV|LI)$/i.test(container.nextElementSibling.nodeName)) {
          var nextBlock = container.nextElementSibling;
          var firstText = nextBlock.firstChild;
          while (firstText && firstText.nodeType !== 3) firstText = firstText.firstChild;
          return {node: firstText || nextBlock, offset: 0};
        }
        text = {node: node, offset: node.nodeValue.length};
      }
      count = next;
    }
    if (text) return text;
    var firstText = root.firstChild;
    while (firstText && firstText.nodeType !== 3) firstText = firstText.firstChild;
    return {node: firstText || root, offset: 0};
  }
  function restoreSelection(start, end) {
    if (start == null || end == null) return;
    editor.focus({preventScroll: true});
    var startPoint = nodeAtOffset(editor, start), endPoint = nodeAtOffset(editor, end), range = document.createRange(), selection = window.getSelection();
    try {
      range.setStart(startPoint.node, startPoint.offset); range.setEnd(endPoint.node, endPoint.offset);
      selection.removeAllRanges(); selection.addRange(range);
      caretStart = start; caretEnd = end;
    } catch (e) {
      try {
        var fallback = document.createRange();
        fallback.selectNodeContents(editor);
        fallback.collapse(false);
        selection.removeAllRanges();
        selection.addRange(fallback);
      } catch (_) {}
    }
  }
  function replaceTextRange(start, end, text) {
    var selection = window.getSelection();
    var range;
    if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0);
      var before = range.cloneRange();
      before.selectNodeContents(editor);
      before.setEnd(range.startContainer, range.startOffset);
      if (before.toString().length === start && range.collapsed) {
        range.deleteContents();
        var inserted = document.createTextNode(text);
        range.insertNode(inserted);
        range.setStartAfter(inserted);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        caretStart = caretEnd = start + text.length;
        try { editor.dispatchEvent(new Event('input', {bubbles: true})); } catch (e) {}
        return;
      }
    }
    var startPoint = nodeAtOffset(editor, start), endPoint = nodeAtOffset(editor, end);
    range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset); range.setEnd(endPoint.node, endPoint.offset); range.deleteContents();
    var inserted = document.createTextNode(text); range.insertNode(inserted); range.setStartAfter(inserted); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range); caretStart = caretEnd = start + text.length;
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
    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (schemeMeta) schemeMeta.content = dark ? 'dark' : 'light';
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
  function shouldOfferOnScreenKeyboard() { return isTouchDevice() || window.innerWidth < 1024; }
  function isTouchDevice() { return 'ontouchstart' in window || (navigator.maxTouchPoints > 0); }
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

  function suppressNativeKeyboard() {
    editor.setAttribute('inputmode', 'none');
    editor.setAttribute('virtualkeyboardpolicy', 'manual');
    if (navigator.virtualKeyboard && navigator.virtualKeyboard.hide) {
      try { navigator.virtualKeyboard.hide(); } catch (e) {}
    }
  }
  function allowNativeKeyboard() {
    editor.removeAttribute('inputmode');
    editor.removeAttribute('virtualkeyboardpolicy');
  }
  function rememberCaret() {
    var offsets = selectionOffsets();
    if (offsets) {
      caretStart = offsets.start;
      caretEnd = offsets.end;
    }
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
  function showExportMenu() {
    var menu = $('exportMenu');
    var btn = $('exportBtn');
    exportMenuOpen = !exportMenuOpen;
    menu.hidden = !exportMenuOpen;
    if (btn) btn.setAttribute('aria-expanded', exportMenuOpen ? 'true' : 'false');
    closeSaveMenu();
  }
  function closeExportMenu() { exportMenuOpen = false; var m = $('exportMenu'); if (m) m.hidden = true; var b = $('exportBtn'); if (b) b.setAttribute('aria-expanded', 'false'); }

  function showAssistant() {
    assistantOpen = true;
    $('assistantPanel').hidden = false;
    $('assistantBtn').classList.add('active');
    $('assistantBtn').setAttribute('aria-expanded', 'true');
  }
  function closeAssistant() {
    assistantOpen = false;
    $('assistantPanel').hidden = true;
    $('assistantBtn').classList.remove('active');
    $('assistantBtn').setAttribute('aria-expanded', 'false');
  }

  function switchAssistantTab(tab) {
    document.querySelectorAll('.assistant-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.assistant-tab-panel').forEach(function (panel) {
      panel.hidden = panel.id !== 'tab-' + tab;
    });
  }

  function insertBibleVerse(ref, text) {
    var html = '<blockquote><p>' + escapeHtml(text) + '</p><cite>— ' + escapeHtml(ref) + '</cite></blockquote>';
    insert(html);
    closeAssistant();
  }
  window.insertBibleVerse = insertBibleVerse;

  function searchBible() {
    var query = $('bibleSearch').value.trim();
    if (!query) return;
    var resultsEl = $('bibleResults');
    resultsEl.innerHTML = '<div class="assistant-loading">Searching...</div>';
    fetch('/api/bible/search?q=' + encodeURIComponent(query) + '&k=10')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.results || !data.results.length) {
          resultsEl.innerHTML = '<div class="assistant-empty">No verses found</div>';
          return;
        }
        resultsEl.innerHTML = data.results.map(function (item) {
          return '<div class="assistant-verse" data-ref="' + escapeHtml(item.ref) + '"><span class="verse-ref">' + escapeHtml(item.ref) + '</span><span class="verse-text">' + escapeHtml(item.text) + '</span><button class="assistant-insert" onclick="insertBibleVerse(\'' + escapeHtml(item.ref).replace(/'/g, "\\'") + '\', \'' + escapeHtml(item.text).replace(/'/g, "\\'") + '\')">Insert</button></div>';
        }).join('');
      })
      .catch(function () { resultsEl.innerHTML = '<div class="assistant-error">Error searching</div>'; });
  }

  function getRandomVerse() {
    var resultsEl = $('bibleResults');
    resultsEl.innerHTML = '<div class="assistant-loading">Loading...</div>';
    fetch('/api/bible/random')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { resultsEl.innerHTML = '<div class="assistant-error">' + escapeHtml(data.error) + '</div>'; return; }
        resultsEl.innerHTML = '<div class="assistant-verse"><span class="verse-ref">' + escapeHtml(data.ref) + '</span><span class="verse-text">' + escapeHtml(data.text) + '</span><button class="assistant-insert" onclick="insertBibleVerse(\'' + escapeHtml(data.ref).replace(/'/g, "\\'") + '\', \'' + escapeHtml(data.text).replace(/'/g, "\\'") + '\')">Insert</button></div>';
      })
      .catch(function () { resultsEl.innerHTML = '<div class="assistant-error">Error loading verse</div>'; });
  }

  function generateBibleRewrite() {
    var topic = $('rewriteTopic').value.trim();
    var chapters = parseInt($('rewriteChapters').value) || 5;
    if (!topic) { alert('Enter a topic or book name'); return; }
    var progressEl = $('rewriteProgress');
    var outputEl = $('rewriteOutput');
    progressEl.hidden = false;
    progressEl.innerHTML = 'Generating chapter 1 of ' + chapters + '...';
    outputEl.innerHTML = '';
    var allContent = '';
    var currentChapter = 0;

    function generateNextChapter() {
      currentChapter++;
      if (currentChapter > chapters) {
        progressEl.hidden = true;
        progressEl.innerHTML = 'Complete!';
        // Create book project
        createBibleBook(topic, allContent);
        return;
      }
      progressEl.innerHTML = 'Generating chapter ' + currentChapter + ' of ' + chapters + '...';
      // Get relevant verses
      fetch('/api/bible/search?q=' + encodeURIComponent(topic + ' chapter ' + currentChapter) + '&k=5')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var verses = (data.results || []).map(function (r) { return r.text; }).join(' ');
          var prompt = 'የ' + escapeHtml(topic) + ' ምዕራፍ ' + currentChapter + 'ን በአማርኛ ጻፍ። የተለየ ጥቅሶች: ' + escapeHtml(verses.slice(0, 500));
          // Use completion API
          return fetch('/api/complete?text=' + encodeURIComponent(prompt));
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var suggestions = (data.sentences || []).join(' ') || (data.next || []).map(function (n) { return n[0]; }).join(' ') || 'ይህ ምዕራፍ ተጽፎአል።';
          var chapterHtml = '<h2>Chapter ' + currentChapter + '</h2><p>' + escapeHtml(suggestions) + '</p>';
          allContent += chapterHtml;
          outputEl.innerHTML += '<div class="generated-chapter">' + chapterHtml + '</div>';
          generateNextChapter();
        })
        .catch(function () {
          outputEl.innerHTML += '<div class="generated-chapter"><h2>Chapter ' + currentChapter + '</h2><p>Error generating content</p></div>';
          generateNextChapter();
        });
    }
    generateNextChapter();
  }

  function createBibleBook(topic, content) {
    // Use the book template
    var bookFiles = [
      file('outline.md', '<h1>Book Outline: ' + escapeHtml(topic) + '</h1><p>Generated from Bible verses about ' + escapeHtml(topic) + '</p>', ''),
      file('chapter-01.md', content, 'chapters'),
      file('research.md', '<h1>Research Notes</h1><p>Bible verses used for: ' + escapeHtml(topic) + '</p>', '')
    ];
    addCreatedFiles(bookFiles, topic + ' - Bible Rewrite');
    closeAssistant();
    setStatus('Created Bible rewrite book: ' + topic);
  }

  function getCompletions() {
    var text = $('completeInput').value.trim();
    if (!text) return;
    var outputEl = $('completeOutput');
    outputEl.innerHTML = '<div class="assistant-loading">Getting suggestions...</div>';
    fetch('/api/complete?text=' + encodeURIComponent(text))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var html = '';
        if (data.sentences && data.sentences.length) {
          html += '<div class="assistant-section-title">Sentence Completions</div>';
          html += data.sentences.map(function (s) { return '<button class="assistant-suggestion" onclick="insert(\'' + escapeHtml(s).replace(/'/g, "\\'") + '\')">' + escapeHtml(s) + '</button>'; }).join('');
        }
        if (data.next && data.next.length) {
          html += '<div class="assistant-section-title">Next Words</div>';
          html += data.next.map(function (n) { return '<button class="assistant-suggestion" onclick="insert(\'' + escapeHtml(n[0]).replace(/'/g, "\\'") + '\')">' + escapeHtml(n[0]) + '</button>'; }).join('');
        }
        if (data.words && data.words.length) {
          html += '<div class="assistant-section-title">Word Suggestions</div>';
          html += data.words.map(function (w) { return '<button class="assistant-suggestion" onclick="insert(\'' + escapeHtml(w[0]).replace(/'/g, "\\'") + '\')">' + escapeHtml(w[0]) + '</button>'; }).join('');
        }
        outputEl.innerHTML = html || '<div class="assistant-empty">No suggestions</div>';
      })
      .catch(function () { outputEl.innerHTML = '<div class="assistant-error">Error getting suggestions</div>'; });
  }

  function exportShell(f, extraHead) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(f.name) + '</title><style>@page { size: A4; margin: 2cm; } body { max-width: 18cm; margin: 0 auto; padding: 2em; font-family: "Noto Sans Ethiopic", "Nyala", "Abyssinica SIL", Georgia, serif; font-size: 12pt; line-height: 1.6; color: #111; } h1{font-size:24pt} h2{font-size:18pt} h3{font-size:14pt} ul,ol{margin:.4em 0 .4em 1.5em;padding-left:1em} blockquote{margin:.8em 0;padding:.2em 1em;border-left:4px solid #c8c8c8;color:#444;font-style:italic} .editor-bullet{margin:.3em 0 0 1.5em} .editor-number{margin:.3em 0 0 1.5em} .editor-check{margin:.3em 0} s{opacity:.75}</style>' + (extraHead || '') + '</head><body>' + editorHtml() + '</body></html>';
  }
  function downloadBlob(content, name, type) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: type }));
    link.download = name;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }
  function exportFile(format) {
    var f = activeFile();
    if (!f) { setStatus('Open a document before exporting'); return; }
    var base = f.name.replace(/\.[^.]+$/, '');
    var html = editorHtml();
    if (format === 'pdf') { printExport(f); return; }
    if (format === 'pdffile') { pdfFileExport(f); return; }
    if (format === 'md') { downloadBlob(htmlToMarkdown(html), base + '.md', 'text/markdown;charset=utf-8'); return; }
    if (format === 'txt') { downloadBlob(WerketFormats.htmlToPlainText(html), base + '.txt', 'text/plain;charset=utf-8'); return; }
    if (format === 'html') { downloadBlob(exportShell(f), base + '.html', 'text/html;charset=utf-8'); return; }
    if (format === 'doc') { downloadBlob(exportShell(f, '<xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>'.replace(/^<xml>/, '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->')), base + '.doc', 'application/msword'); return; }
    if (format === 'docx') { downloadBlob(new Blob([WerketFormats.buildDocx(html, {title: base})]), base + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); setStatus('Exported ' + base + '.docx'); return; }
    if (format === 'odt') { downloadBlob(new Blob([WerketFormats.buildOdt(html, {title: base})]), base + '.odt', 'application/vnd.oasis.opendocument.text'); setStatus('Exported ' + base + '.odt'); return; }
    if (format === 'rtf') { downloadBlob(WerketFormats.buildRtf(html, {title: base}), base + '.rtf', 'application/rtf'); setStatus('Exported ' + base + '.rtf'); return; }
    if (format === 'epub') { downloadBlob(new Blob([WerketFormats.buildEpub(html, {title: base, lang: 'am'})]), base + '.epub', 'application/epub+zip'); setStatus('Exported ' + base + '.epub'); return; }
    setStatus('Unknown export format');
  }
  function printExport(f) {
    var w = window.open('', '_blank');
    if (!w) { setStatus('Allow pop-ups to export PDF'); return; }
    w.document.write(exportShell(f));
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
    setStatus('In print dialog, choose “Save as PDF”');
  }

  function dataUrlToBytes(dataUrl) {
    var base64 = dataUrl.split(',')[1] || '';
    var binary = atob(base64), out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  var PDF_FONT = '"Noto Sans Ethiopic", "Abyssinica SIL", Nyala, Georgia, serif';
  function pdfFileExport(f) {
    var blocks = WerketFormats.htmlToBlocks(editorHtml());
    if (!blocks.length) { setStatus('Nothing to export'); return; }
    var scale = 2, pageW = 595.28 * scale, pageH = 841.89 * scale;
    var margin = 56 * scale, x = margin, y = margin;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var pages = [];
    var listItem = 0, lastListKind = '';
    function newPage() {
      canvas.width = Math.round(pageW); canvas.height = Math.round(pageH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#111111';
      y = margin;
    }
    function pushPage() {
      pages.push({jpeg: dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92)), width: pageW, height: pageH});
    }
    function fontFor(size, bold, italic) {
      return (italic ? 'italic ' : '') + (bold ? '700 ' : '400 ') + size + 'px ' + PDF_FONT;
    }
    function drawWords(text, size, bold, italic, color) {
      ctx.font = fontFor(size, bold, italic);
      ctx.fillStyle = color || '#111111';
      var words = text.split(/(\s+)/);
      for (var i = 0; i < words.length; i++) {
        var piece = words[i];
        if (!piece) continue;
        var w = ctx.measureText(piece).width;
        if (piece.trim() && x + w > pageW - margin) { x = margin + currentIndent; y += size * 1.55; }
        if (y + size * 1.55 > pageH - margin) { pushPage(); newPage(); x = margin + currentIndent; }
        ctx.fillText(piece, x, y + size);
        x += w;
      }
    }
    var currentIndent = 0;
    blocks.forEach(function (block) {
      if (block.empty) { y += 22 * scale * 1.4; return; }
      if (block.type !== 'li') listItem = 0;
      var size = 22 * scale, bold = false, italic = false;
      currentIndent = 0;
      if (block.type === 'h1') { size = 40 * scale; bold = true; }
      else if (block.type === 'h2') { size = 32 * scale; bold = true; }
      else if (block.type === 'h3') { size = 27 * scale; bold = true; }
      else if (block.type === 'li') { currentIndent = 44 * scale; if (block.list !== lastListKind) listItem = 0; }
      else if (block.type === 'check') { currentIndent = 40 * scale; }
      if (block.quote) { italic = true; currentIndent += 56 * scale; }
      if (y + size * 2.2 > pageH - margin) { pushPage(); newPage(); }
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') y += size * 0.45;
      x = margin + currentIndent;
      if (block.type === 'li') {
        lastListKind = block.list;
        drawWords(block.list === 'number' ? (++listItem) + '. ' : '\u2022 ', size, bold, italic, '#333333');
      } else if (block.type === 'check') {
        drawWords(block.checked ? '\u2611 ' : '\u2610 ', size, bold, italic, '#333333');
      }
      (block.runs || []).forEach(function (run) {
        if (run.br) { x = margin + currentIndent; y += size * 1.55; if (y + size * 1.55 > pageH - margin) { pushPage(); newPage(); } return; }
        var color = block.quote ? '#444444' : (run.strike ? '#777777' : '#111111');
        drawWords(run.text, size, bold || run.bold, italic || run.italic, color);
      });
      x = margin;
      y += size * 1.55;
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') y += size * 0.3;
    });
    pushPage();
    var pdf = WerketFormats.buildPdf(pages, {title: f.name.replace(/\.[^.]+$/, ''), pageWidth: 595.28, pageHeight: 841.89});
    downloadBlob(new Blob([pdf], {type: 'application/pdf'}), f.name.replace(/\.[^.]+$/, '') + '.pdf', 'application/pdf');
    setStatus('Exported PDF (' + pages.length + ' page' + (pages.length > 1 ? 's' : '') + ')');
  }

  function pdfInflate(data, start) {
    var bitPos = 0;
    function readBits(n) {
      var v = 0;
      for (var i = 0; i < n; i++) {
        var idx = (start + (bitPos >> 3));
        var bit = ((data[idx] || 0) >> (bitPos & 7)) & 1;
        v |= bit << i;
        bitPos++;
      }
      return v;
    }
    function readBit() { return readBits(1); }
    function tree(lengths) {
      var nodes = [{ b0: -1, b1: -1, s: -1 }], bl = new Int16Array(16), next = new Int16Array(16), c = 0, i, k;
      for (i = 0; i < lengths.length; i++) if (lengths[i]) bl[lengths[i]]++;
      for (i = 1; i <= 15; i++) { c = (c + bl[i - 1]) << 1; next[i] = c; }
      for (i = 0; i < lengths.length; i++) {
        if (!lengths[i]) continue;
        var bc = next[lengths[i]]++, node = 0;
        for (k = lengths[i] - 1; k >= 0; k--) {
          var key = ((bc >> k) & 1) ? 'b1' : 'b0';
          if (nodes[node][key] < 0) { nodes.push({ b0: -1, b1: -1, s: -1 }); nodes[node][key] = nodes.length - 1; }
          node = nodes[node][key];
        }
        nodes[node].s = i;
      }
      return nodes;
    }
    function dec(t) {
      var node = 0;
      for (var depth = 0; depth < 32; depth++) {
        var n = t[node], nx = n[readBit() ? 'b1' : 'b0'];
        if (nx < 0) return -1;
        if (t[nx].s >= 0 && t[nx].b0 < 0 && t[nx].b1 < 0) return t[nx].s;
        node = nx;
      }
      return -1;
    }
    var lit = [], dist = [], i;
    for (i = 0; i < 144; i++) lit.push(8); for (i = 144; i < 256; i++) lit.push(9); for (i = 256; i < 280; i++) lit.push(7); for (i = 280; i < 288; i++) lit.push(8);
    for (i = 0; i < 30; i++) dist.push(5);
    var tLit = tree(lit), tDist = tree(dist);
    var lenB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
    var lenE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    var dBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
    var dExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    var out = [], cap = 6 * 1024 * 1024;
    function byte(b) { if (out.length < cap) out.push(b); }
    var last;
    do {
      last = readBit();
      var btype = readBits(2);
      if (btype === 3) return null;
      if (btype === 0) {
        var aligned = (bitPos + 7) & ~7;
        bitPos = aligned;
        var len = readBits(16); readBits(16);
        for (i = 0; i < len; i++) byte(data[start + (bitPos >> 3) + i] || 0);
        bitPos += len * 8;
      } else {
        var tl, td;
        if (btype === 1) { tl = tLit; td = tDist; }
        else {
          var hlit = readBits(5) + 257, hdist = readBits(5) + 1, hclen = readBits(4) + 4;
          var order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
          var cl = new Array(19).fill(0);
          for (i = 0; i < hclen; i++) cl[order[i]] = readBits(3);
          var tCL = tree(cl);
          var lens = new Array(hlit + hdist).fill(0), li = 0;
          while (li < lens.length) {
            var sym = dec(tCL);
            if (sym < 0) return null;
            if (sym < 16) lens[li++] = sym;
            else if (sym === 16) { var r = 3 + readBits(2); while (r--) lens[li++] = lens[li - 1]; }
            else if (sym === 17) { var r2 = 3 + readBits(3); while (r2--) lens[li++] = 0; }
            else { var r3 = 11 + readBits(7); while (r3--) lens[li++] = 0; }
          }
          tl = tree(lens.slice(0, hlit));
          td = tree(lens.slice(hlit));
        }
        for (var guard = 0; ; guard++) {
          if (guard > 20000000) return null;
          var s2 = dec(tl);
          if (s2 < 0) return null;
          if (s2 < 256) { byte(s2); continue; }
          if (s2 === 256) break;
          if (s2 > 285) return null;
          var le = s2 - 257, ln = lenB[le] + (lenE[le] ? readBits(lenE[le]) : 0);
          if (!(ln >= 3 && ln <= 258)) return null;
          var ds = dec(td);
          if (ds < 0 || ds >= 30) return null;
          var dd = dBase[ds] + (dExtra[ds] ? readBits(dExtra[ds]) : 0);
          if (dd < 1 || dd > out.length) return null;
          while (ln--) { byte(out[out.length - dd]); }
        }
      }
    } while (!last);
    return new Uint8Array(out);
  }
  function pdfLiteralToString(tok) {
    var inner = tok.slice(1, -1), out = '';
    for (var i = 0; i < inner.length; i++) {
      var ch = inner[i];
      if (ch !== '\\') { out += ch; continue; }
      var nx = inner[++i];
      if (nx === 'n') out += '\n';
      else if (nx === 'r') out += '\r';
      else if (nx === 't') out += '\t';
      else if (nx === 'b') out += '\b';
      else if (nx === 'f') out += '\f';
      else if (nx === '(') out += '(';
      else if (nx === ')') out += ')';
      else if (nx === '\\') out += '\\';
      else if (/\d/.test(nx)) { var code = nx; while (code.length < 3 && /\d/.test(inner[i + 1])) code += inner[++i]; out += String.fromCharCode(parseInt(code, 8) & 0xff); }
      else { out += nx; }
    }
    return out;
  }
  function pdfHexToString(tok, cidMap) {
    var hex = tok.slice(1, -1).replace(/\s+/g, '');
    if (hex.length % 2) hex += '0';
    if (cidMap && Object.keys(cidMap).length) {
      var mapped = pdfMapHexCodes(hex, 2, cidMap);
      if (mapped.hits === 0) mapped = pdfMapHexCodes(hex, 1, cidMap);
      if (mapped.hits > 0) return mapped.text;
    }
    if (/^feff/i.test(hex)) {
      var s = '';
      for (var i = 4; i < hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
      return s;
    }
    var t = '';
    for (var j = 0; j < hex.length; j += 2) t += String.fromCharCode(parseInt(hex.slice(j, j + 2), 16));
    return t;
  }
  function pdfMapHexCodes(hex, width, cidMap) {
    var out = '', hits = 0;
    for (var i = 0; i + width * 2 <= hex.length; i += width * 2) {
      var code = parseInt(hex.slice(i, i + width * 2), 16);
      if (Object.prototype.hasOwnProperty.call(cidMap, code)) { out += cidMap[code]; hits++; }
      else out += String.fromCharCode(code);
    }
    return {text: out, hits: hits};
  }
  function pdfParseToUnicode(text) {
    var map = {}, m;
    var bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((m = bfcharRe.exec(text))) {
      var pairRe = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>/g, p;
      while ((p = pairRe.exec(m[1]))) {
        var src = parseInt(p[1].replace(/\s+/g, ''), 16);
        var dstHex = p[2].replace(/\s+/g, '');
        while (dstHex.length % 4) dstHex += '0';
        var dst = '';
        for (var i = 0; i < dstHex.length; i += 4) dst += String.fromCharCode(parseInt(dstHex.slice(i, i + 4), 16));
        map[src] = dst;
      }
    }
    var rangeRe = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*(\[[\s\S]*?\]|<[0-9A-Fa-f\s]+>)/g, r;
    while ((r = rangeRe.exec(text))) {
      var lo = parseInt(r[1].replace(/\s+/g, ''), 16);
      var hi = parseInt(r[2].replace(/\s+/g, ''), 16);
      if (!(hi >= lo) || hi - lo > 65535) continue;
      var third = r[3];
      if (third[0] === '[') {
        var dsts = third.match(/<([0-9A-Fa-f\s]+)>/g) || [];
        for (var c = lo; c <= hi; c++) {
          var idx = c - lo;
          if (idx >= dsts.length) break;
          var dHex = dsts[idx].replace(/[<>\s]/g, '');
          while (dHex.length % 4) dHex += '0';
          var dStr = '';
          for (var k = 0; k < dHex.length; k += 4) dStr += String.fromCharCode(parseInt(dHex.slice(k, k + 4), 16));
          map[c] = dStr;
        }
      } else {
        var baseHex = third.replace(/[<>\s]/g, '');
        while (baseHex.length % 4) baseHex += '0';
        var baseCode = parseInt(baseHex.slice(0, 4), 16) || 0;
        var extra = baseHex.length > 4 ? parseInt(baseHex.slice(4), 16) || 0 : 0;
        for (var c2 = lo; c2 <= hi; c2++) {
          var units = '';
          var value = baseCode + (c2 - lo);
          units += String.fromCharCode(value & 0xffff);
          if (extra) units += String.fromCharCode(extra);
          map[c2] = units;
        }
      }
    }
    return map;
  }
  function extractPdfTextOps(decoded, cidMap) {
    var clean = decoded.replace(/%.*?(?:[\r\n]|$)/g, '').replace(/^\s+/, '');
    var re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[cdD*]\b|\bTj\b|\bTJ\b|\bET\b|\bBT\b/g, m, lines = [], current = '';
    while ((m = re.exec(clean))) {
      var tok = m[0];
      if (tok === 'Td' || tok === 'TD' || tok === 'T*') { if (current.trim()) lines.push(current.trim()); current = ''; }
      else if (tok === 'BT') current = '';
      else if (tok === 'ET') { if (current.trim()) lines.push(current.trim()); current = ''; }
      else if (tok === 'Tj' || tok === 'TJ') {}
      else if (tok[0] === '(') current += pdfLiteralToString(tok);
      else if (tok[0] === '<') current += pdfHexToString(tok, cidMap || {});
    }
    if (current.trim()) lines.push(current.trim());
    return lines.join('\n');
  }
  function pdfExtractText(bytes) {
    var src = '';
    for (var i = 0; i < bytes.length; i++) src += String.fromCharCode(bytes[i]);
    var streams = [], re = /stream\r?\n([\s\S]*?)\r?\nendstream/g, m, s;
    while ((m = re.exec(src))) streams.push(m[1]);
    if (!streams.length) { re = /stream\s+([\s\S]*?)endstream/g; while ((m = re.exec(src))) streams.push(m[1]); }
    var decodeds = [];
    var cidMap = {};
    for (i = 0; i < streams.length; i++) {
      s = streams[i];
      var data = new Uint8Array(s.length);
      for (var j = 0; j < s.length; j++) data[j] = s.charCodeAt(j) & 0xff;
      var decoded = null;
      if (data.length > 4) {
        try { decoded = pdfInflate(data, (data[0] & 0x0f) === 8 ? 2 : 0); } catch (e) { decoded = null; }
        if (!decoded) try { decoded = pdfInflate(data, 0); } catch (e2) {}
      }
      var textForm = decoded ? String.fromCharCode.apply(null, Array.prototype.slice.call(decoded, 0, Math.min(decoded.length, 65536))) : s;
      if (/beginbf(char|range)/.test(textForm)) {
        var streamMap = pdfParseToUnicode(textForm);
        for (var code in streamMap) cidMap[code] = streamMap[code];
      }
      decodeds.push(decoded ? textForm : null);
    }
    var text = '';
    for (i = 0; i < streams.length; i++) {
      var t = decodeds[i] !== null ? extractPdfTextOps(decodeds[i], cidMap) : extractPdfTextOps(streams[i], cidMap);
      if (t && /\S/.test(t)) text += (text ? '\n' : '') + t;
    }
    return text;
  }
function importPdf(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var bytes = new Uint8Array(reader.result), text = '';
      try { text = pdfExtractText(bytes); } catch (e) { text = ''; }
      if (!text.trim()) { setStatus('Could not read text from this PDF'); return; }
      var name = uniqueName(file.name.replace(/\.pdf$/i, '.md'));
      // Preserve paragraph structure better - split on double newlines
      var paragraphs = text.split(/\n{2,}/).map(function (para) {
        var trimmed = para.trim();
        if (!trimmed) return '';
        return '<p>' + trimmed.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/\n/g, '<br>') + '</p>';
      }).filter(Boolean).join('');
      var f = file(name, paragraphs, '');
      workspace.files.push(f);
      openFile(f.id);
      save();
      setStatus('Imported ' + file.name + ' (' + text.length + ' chars)');
    };
    reader.readAsArrayBuffer(file);
  }

  function focusEditor() {
    if (document.activeElement === editor) {
      restoreCaret();
      return;
    }
    editor.focus({preventScroll: true});
    restoreCaret();
  }
   function onTap(el, fn) {
    var lastRun = 0;
    function run(event) {
      var now = Date.now();
      if (now - lastRun < 350) return;
      lastRun = now;
      event.preventDefault();
      event.stopPropagation();
      fn(event);
    }
    el.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
    el.addEventListener('pointerup', run);
    el.addEventListener('click', run);
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
    if (oskOpen) deviceKeyboardMode = false;
    $('keyboardPanel').hidden = !oskOpen;
    $('keyboardPanel').classList.toggle('open', oskOpen);
    document.body.classList.toggle('osk-open', oskOpen);
    $('keyboardBtn').classList.toggle('active', oskOpen);
    $('keyboardBtn').textContent = oskOpen ? '⌄' : '⌃';
    $('keyboardBtn').title = oskOpen ? 'Hide keyboard' : 'Show keyboard';
    localStorage.setItem(oskPrefKey, oskOpen ? '1' : '0');
    hideOrders();
    if (oskOpen) {
      suppressNativeKeyboard();
      setTimeout(function () {
        if (document.activeElement !== editor) {
          editor.focus({preventScroll: true});
          restoreCaret();
        }
      }, 50);
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
      $('keyboardBtn').textContent = oskOpen ? '⌄' : '⌃';
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
    $('projectName').value = workspace.projectName || 'My documents';
  }

  function renderTabs() {
    $('tabs').innerHTML = workspace.openIds.map(function (id) {
      var f = workspace.files.find(function (item) { return item.id === id; });
      if (!f) return '';
      return '<div class="tab ' + (id === workspace.activeId ? 'active' : '') + '" data-tab="' + id + '" title="' + escapeHtml(f.name) + '"><span>' + escapeHtml(f.name) + '</span><button data-close="' + id + '" title="Close">×</button></div>';
    }).join('') + '<button class="tab-add" id="tabAddBtn" title="New document">＋</button>';
    $('tabs').querySelectorAll('[data-tab]').forEach(function (tab) { tab.onclick = function (event) { if (!event.target.dataset.close) openFile(tab.dataset.tab); }; });
    $('tabs').querySelectorAll('[data-close]').forEach(function (button) { button.onclick = function (event) { event.stopPropagation(); closeFile(button.dataset.close); }; });
    $('tabs').querySelectorAll('[data-tab]').forEach(function (tab) { tab.oncontextmenu = function (event) { showContextMenu(event, tab.dataset.tab); }; });
    $('tabAddBtn').onclick = function () { createFile(); };
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
    setOsk(false);
    renderHome();
  }
  function hideHome() {
    $('homeScreen').hidden = true;
    document.body.classList.remove('home-open');
  }

  function render() { renderTree(); renderTabs(); loadActiveIntoEditor(); }
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
    return {id: workspace.activeId, html: editor.innerHTML, text: editorText(), start: offsets ? offsets.start : caretStart, end: offsets ? offsets.end : caretEnd};
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

  function caretBlockOffset(range, block) {
    var probe = document.createRange();
    probe.selectNodeContents(block);
    try { probe.setEnd(range.startContainer, range.startOffset); } catch (e) { return 0; }
    return probe.toString().length;
  }
  function caretAtBlockEnd(range, block) {
    return caretBlockOffset(range, block) >= block.textContent.length;
  }
  function caretAtBlockStart(range, block) {
    return caretBlockOffset(range, block) === 0;
  }
  function placeCaretAtBlockStart(block) {
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function ensureBlockPlaceholder(block) {
    if (!block.childNodes.length) block.innerHTML = '<br>';
  }
  function insertNewLine() {
    pushUndo();
    normalizeEditorBlocks();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var block = currentBlockNode();
    if (!block) {
      var starter = document.createElement('p');
      starter.innerHTML = '<br>';
      editor.appendChild(starter);
      placeCaretAtBlockStart(starter);
      rememberCaret();
      changed();
      editor.focus({preventScroll: true});
      return;
    }
    if (block.nodeName === 'UL' || block.nodeName === 'OL') {
      var child = block.childNodes[Math.min(range.startOffset, block.childNodes.length - 1)] || block.lastChild;
      if (child) {
        var inner = document.createRange();
        inner.selectNodeContents(child);
        inner.collapse(false);
        sel.removeAllRanges();
        sel.addRange(inner);
        range = inner;
        block = child;
      }
    }
    var tag = block.nodeName.toUpperCase();
    var isListItem = tag === 'LI' || (block.classList && (block.classList.contains('editor-bullet') || block.classList.contains('editor-number')));
    var isHeading = /^H[1-6]$/.test(tag);
    var isEmpty = isEmptyBlock(block);
    var wasAtStart = caretAtBlockStart(range, block);
    var wasAtEnd = caretAtBlockEnd(range, block);
    var afterFragment = range.extractContents();
    var afterHasContent = afterFragment.childNodes.length > 0 && (afterFragment.textContent || '').length > 0;

    if (isListItem && isEmpty) {
      var listHost = tag === 'LI' ? block.parentNode : block.parentNode;
      var exit = document.createElement('p');
      exit.innerHTML = '<br>';
      if (listHost && listHost !== editor && /^(UL|OL)$/i.test(listHost.nodeName)) {
        listHost.parentNode.insertBefore(exit, listHost.nextSibling);
        if (!listHost.querySelector('li')) listHost.remove();
        else block.remove();
      } else {
        block.parentNode.insertBefore(exit, block.nextSibling);
        block.remove();
      }
      placeCaretAtBlockStart(exit);
      rememberCaret();
      changed();
      editor.focus({preventScroll: true});
      return;
    }

    var newTag;
    if (isListItem) newTag = tag === 'LI' ? 'li' : 'div';
    else if (isHeading && wasAtEnd && block.textContent.trim()) newTag = 'p';
    else newTag = (isHeading || tag === 'P') ? tag.toLowerCase() : 'p';

    var newBlock = document.createElement(newTag);
    if (isListItem && tag !== 'LI' && block.className) newBlock.className = block.className;
    if (afterFragment.childNodes.length) newBlock.appendChild(afterFragment);
    ensureBlockPlaceholder(newBlock);
    ensureBlockPlaceholder(block);
    block.parentNode.insertBefore(newBlock, block.nextSibling);

    // Word/Pages behavior: Enter at the very start of a block leaves the empty
    // block above and the caret moves into it; otherwise the caret starts the
    // new block below.
    var caretBlock = (wasAtStart && afterHasContent) ? block : newBlock;
    placeCaretAtBlockStart(caretBlock);
    rememberCaret();
    changed();
    // Ensure editor has focus and caret is visible
    editor.focus({preventScroll: true});
    // Scroll caret into view if needed
    try {
      var sel2 = window.getSelection();
      if (sel2 && sel2.rangeCount) {
        var range2 = sel2.getRangeAt(0);
        var rect = range2.getBoundingClientRect();
        var editorRect = editor.getBoundingClientRect();
        if (rect.bottom > editorRect.bottom - 20) {
          editor.scrollTop += rect.bottom - editorRect.bottom + 20;
        }
      }
    } catch (e) {}
  }
  function insertSoftBreak() {
    pushUndo();
    editor.focus({preventScroll: true});
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var br = document.createElement('br');
    range.insertNode(br);
    var newRange = document.createRange();
    if (!br.nextSibling || (br.nextSibling.nodeType === 3 && br.nextSibling.textContent === '')) {
      var zero = document.createTextNode('\u200B');
      br.parentNode.insertBefore(zero, br.nextSibling);
      newRange.setStartAfter(zero);
    } else {
      newRange.setStartAfter(br);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    rememberCaret();
    changed();
  }
  function backspaceAtBlockStart() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    var range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    var block = currentBlockNode();
    if (!block) return false;
    var node = range.startContainer;
    var offset = range.startOffset;
    if (node !== block && (node.nodeType !== 3 || offset !== 0)) return false;
    if (node.nodeType === 3 && offset !== 0) return false;
    if (node === block && offset !== 0) return false;
    var prev = block.previousElementSibling;
    if (!prev || !/^(P|H1|H2|H3|DIV)$/i.test(prev.nodeName)) return false;
    pushUndo();
    var anchorOffset = prev.textContent.length;
    while (prev.lastChild) prev.removeChild(prev.lastChild);
    while (block.firstChild) prev.appendChild(block.firstChild);
    block.parentNode.removeChild(block);
    var textNode = prev;
    while (textNode.nodeType !== 3 && textNode.firstChild) textNode = textNode.firstChild;
    var newRange = document.createRange();
    if (textNode.nodeType === 3) {
      newRange.setStart(textNode, Math.min(anchorOffset, textNode.textContent.length));
    } else {
      newRange.selectNodeContents(prev);
      newRange.collapse(false);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    rememberCaret();
    changed();
    return true;
  }
  function deleteAtBlockEnd() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    var range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    var block = currentBlockNode();
    if (!block) return false;
    var node = range.startContainer;
    var offset = range.startOffset;
    if (node.nodeType === 3 && offset !== node.textContent.length) return false;
    if (node === block && offset !== block.childNodes.length) return false;
    if (node.nodeType === 1 && offset !== node.childNodes.length) return false;
    var next = block.nextElementSibling;
    if (!next || !/^(P|H1|H2|H3|DIV)$/i.test(next.nodeName)) return false;
    pushUndo();
    var anchorOffset = block.textContent.length;
    while (next.firstChild) block.appendChild(next.firstChild);
    next.parentNode.removeChild(next);
    var textNode = block;
    while (textNode.nodeType !== 3 && textNode.firstChild) textNode = textNode.firstChild;
    var newRange = document.createRange();
    if (textNode.nodeType === 3) {
      newRange.setStart(textNode, Math.min(anchorOffset, textNode.textContent.length));
    } else {
      newRange.selectNodeContents(block);
      newRange.collapse(false);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    rememberCaret();
    changed();
    return true;
  }
  function isEmptyBlock(block) {
    if (!block || !/^(P|H1|H2|H3|DIV|LI)$/i.test(block.nodeName)) return false;
    if (block.textContent.trim()) return false;
    return Array.prototype.every.call(block.childNodes, function (child) {
      return child.nodeType === 3 ? child.nodeValue.trim() === '' : child.nodeName === 'BR';
    });
  }
  function insert(text) {
    pushUndo();
    editor.focus({preventScroll: true});
    if (text === '\n' || text === '\r\n') { insertNewLine(); return; }
    var sel = window.getSelection(), range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (sel && range && editor.contains(range.startContainer)) {
      var block = range.collapsed ? currentBlockNode() : null;
      if (range.collapsed && block && isEmptyBlock(block)) {
        while (block.firstChild) block.removeChild(block.firstChild);
        var textNode = document.createTextNode(text);
        block.appendChild(textNode);
        var newRange = document.createRange();
        newRange.setStart(textNode, text.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        changed();
        rememberCaret();
        editor.focus({preventScroll: true});
        return;
      }
      range.deleteContents();
      var inserted = document.createTextNode(text);
      range.insertNode(inserted);
      range.setStartAfter(inserted);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      changed();
      rememberCaret();
      editor.focus({preventScroll: true});
      return;
    }
    var offsets = selectionOffsets();
    if (offsets) {
      replaceTextRange(offsets.start, offsets.end, text);
    }
    changed();
    restoreCaret();
    editor.focus({preventScroll: true});
  }
  function replaceSuggestion(word) {
    pushUndo();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return;
    var range = sel.getRangeAt(0);
    var block = currentBlockNode();
    if (!block) return;
    var blockStart = getBlockTextStart(block);
    var textBefore = editorText().slice(0, blockStart + getCaretOffsetInBlock(range, block));
    var match = textBefore.match(/[\u1200-\u135a]+$/);
    var startOffset = match ? (blockStart + getCaretOffsetInBlock(range, block) - match[0].length) : getGlobalOffset(range);
    var endOffset = getGlobalOffset(range);
    var text = editorText().slice(startOffset, endOffset);
    var hasTrailingSpace = text.endsWith(' ') || text.endsWith('\n') || text.endsWith('\u00a0');
    var replacement = hasTrailingSpace ? word : word + ' ';
    replaceTextRange(startOffset, endOffset, replacement);
    changed();
    restoreCaret();
  }
  function getBlockTextStart(block) {
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT), node, count = 0;
    while ((node = walker.nextNode())) {
      if (block.contains(node)) return count;
      count += node.nodeValue.length;
    }
    return 0;
  }
  function getCaretOffsetInBlock(range, block) {
    var probe = document.createRange();
    probe.selectNodeContents(block);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length;
  }
  function getGlobalOffset(range) {
    var before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString().length;
  }
  function findInDocument(direction) {
    var query = $('findInput').value;
    if (!query) { $('findCount').textContent = ''; return; }
    var offsets = selectionOffsets();
    var start = offsets ? offsets.end : editorText().length;
    var source = editorText().toLocaleLowerCase(), needle = query.toLocaleLowerCase();
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
    var sel = window.getSelection();
    var savedRange = null;
    var hasSelection = sel && sel.rangeCount && block.contains(sel.anchorNode);
    if (hasSelection) {
      try { savedRange = sel.getRangeAt(0).cloneRange(); } catch (e) {}
    }
    var caret = 0;
    if (hasSelection && savedRange) {
      try {
        var range = document.createRange();
        range.selectNodeContents(block);
        var before = range.cloneRange();
        before.setEnd(savedRange.startContainer, savedRange.startOffset);
        caret = before.toString().length;
      } catch (e) {}
    }
    markingSpell = true;
    clearSpellMarks(block);
    (words || []).filter(function (item) { return !item.known; }).slice().reverse().forEach(function (item) {
      if (caret > item.start && caret <= item.end) return;
      wrapSpellRange(block, item.start, item.end, item);
    });
    markingSpell = false;
    if (hasSelection && savedRange) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch (e) {}
    }
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
var errorsEl = $('errors');
          if (errorsEl) {
            errorsEl.innerHTML = unknown.slice(0, 8).map(function (item) {
              var btns = (item.suggestions || []).slice(0, 3).map(function (s) {
                return '<button data-fix="' + escapeHtml(s.word) + '" data-word="' + escapeHtml(item.word) + '">' + escapeHtml(s.word) + '</button>';
              }).join('');
              return '<div class="spell-error-item"><span class="spell-wrong">' + escapeHtml(item.word) + '</span><span class="spell-actions">' + (btns || '<span class="empty">No match</span>') + '</span></div>';
            }).join('');
            errorsEl.querySelectorAll('[data-fix]').forEach(function (btn) {
              btn.onclick = function () {
                var fix = btn.dataset.fix;
                var word = btn.dataset.word;
                var spellEl = editor.querySelector('.spell-error[data-word="' + word + '"]');
                if (spellEl) {
                  replaceSpellSpan(spellEl, fix);
                } else {
                  var sel = window.getSelection();
                  if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
                    var range = sel.getRangeAt(0);
                    var text = range.toString();
                    if (text === word) {
                      range.deleteContents();
                      var inserted = document.createTextNode(fix);
                      range.insertNode(inserted);
                      range.setStartAfter(inserted);
                      range.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(range);
                      changed();
                      checkSpelling();
                    }
                  }
                }
              };
            });
          }
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
    var offsets = selectionOffsets();
    if (!offsets) return false;
    var key = event.key, position = offsets.start;
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
    var host = $('keyboard'), html = '';
    if (kbLayer === 'num') {
      [['1','2','3','4','5','6','7','8','9','0'],['፩','፪','፫','፬','፭','፮','፯','፰','፱','፲'],['፤','፥','፦','፧','፨','?','!','(',')','-']].forEach(function (row) {
        html += '<div class="keys">';
        row.forEach(function (ch) { html += '<button type="button" class="key fn num" data-symbol="' + ch + '">' + ch + '</button>'; });
        html += '</div>';
      });
    } else {
      var layout = [7, 8, 8, 8], cursor = 0;
      layout.forEach(function (size) {
        html += '<div class="keys">';
        families.slice(cursor, cursor + size).forEach(function (family, offset) {
          html += '<button type="button" class="key" data-family="' + family + '"><span>' + family + '</span><small>' + roman[cursor + offset] + '</small></button>';
        });
        html += '</div>';
        cursor += size;
      });
    }
    html += '<div class="keys action-row">';
    html += '<button type="button" class="key fn layer" id="layerToggle">' + (kbLayer === 'fidel' ? '123' : 'abc') + '</button>';
    html += '<button type="button" class="key fn" data-symbol="' + (kbLayer === 'fidel' ? '፣' : '@') + '">' + (kbLayer === 'fidel' ? '፣' : '@') + '</button>';
    html += '<button type="button" class="key fn space" data-symbol=" ">space</button>';
    html += '<button type="button" class="key fn" data-symbol="' + (kbLayer === 'fidel' ? '።' : '.') + '">' + (kbLayer === 'fidel' ? '።' : '.') + '</button>';
    html += '<button type="button" class="key fn enter" data-symbol="\\n">⏎</button>';
    html += '<button type="button" class="key fn" id="backspaceKey">⌫</button>';
    html += '</div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-family]').forEach(function (button) {
      onTap(button, function () { showOrders(button, button.dataset.family); });
      button.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showOrders(button, button.dataset.family);
      });
      button.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideOrders();
        insert(button.dataset.family);
      });
    });
    host.querySelectorAll('[data-symbol]').forEach(function (button) {
      onTap(button, function () { hideOrders(); insert(button.dataset.symbol === '\\n' ? '\n' : button.dataset.symbol); });
      button.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    onTap($('layerToggle'), function () { kbLayer = kbLayer === 'fidel' ? 'num' : 'fidel'; renderKeyboard(); });
    setupBackspace($('backspaceKey'));
  }
  function setupBackspace(el) {
    if (!el) return;
    var timer = null;
    function del() {
      hideOrders();
      editor.focus({preventScroll: true});
      if (backspaceAtBlockStart()) { restoreCaret(); return; }
      var offsets = selectionOffsets();
      if (!offsets) return;
      var p = offsets.start, q = offsets.end;
      if (q > p) replaceTextRange(p, q, '');
      else if (p > 0) replaceTextRange(p - 1, p, '');
      changed();
      restoreCaret();
    }
    function start(event) {
      if (event.cancelable) event.preventDefault();
      pushUndo();
      del();
      if (timer) clearInterval(timer);
      timer = setInterval(function () { pushUndo(); del(); }, 70);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
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
  function toggleExplorer() {
    $('explorerPanel').classList.toggle('open');
    document.body.classList.toggle('sidebar-open', $('explorerPanel').classList.contains('open'));
  }
  function showSpellPopup(spellEl, x, y) {
    var existing = document.getElementById('spellPopup');
    if (existing) existing.remove();
    var suggestions = String(spellEl.dataset.suggestions || '').split('|').filter(Boolean).slice(0, 5);
    var popup = document.createElement('div');
    popup.id = 'spellPopup';
    popup.className = 'spell-popup';
    popup.setAttribute('role', 'menu');
    var word = spellEl.dataset.word || spellEl.textContent;
    var title = document.createElement('div');
    title.className = 'spell-popup-title';
    title.textContent = '\u201c' + word + '\u201d \u2014 suggestions';
    popup.appendChild(title);
    if (!suggestions.length) {
      var none = document.createElement('div');
      none.className = 'spell-popup-none';
      none.textContent = 'No close match';
      popup.appendChild(none);
    }
    suggestions.forEach(function (suggestion) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'spell-popup-item';
      button.textContent = '\u2713 ' + suggestion;
      button.onclick = function (ev) {
        ev.stopPropagation();
        closeSpellPopup();
        replaceSpellSpan(spellEl, suggestion);
      };
      popup.appendChild(button);
    });
    var ignore = document.createElement('button');
    ignore.type = 'button';
    ignore.className = 'spell-popup-item spell-popup-ignore';
    ignore.textContent = 'Ignore once';
    ignore.onclick = function (ev) { ev.stopPropagation(); closeSpellPopup(); };
    popup.appendChild(ignore);
    document.body.appendChild(popup);
    var pw = popup.offsetWidth, ph = popup.offsetHeight;
    var left = Math.min(x - pw / 2, window.innerWidth - pw - 8);
    left = Math.max(8, left);
    var top = y - ph - 12;
    if (top < 8) top = y + 12;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    setTimeout(function () { document.addEventListener('pointerdown', closeSpellPopup, {once: true}); }, 0);
  }
  function closeSpellPopup() {
    var popup = document.getElementById('spellPopup');
    if (popup) popup.remove();
  }
  $('projectName').oninput = function () { workspace.projectName = $('projectName').value; saveWorkspace(); };
  document.addEventListener('pointerdown', function (event) {
    if (!event.target.closest('.menu-wrap')) { closeMenu(); closeSaveMenu(); closeExportMenu(); }
    if (!event.target.closest('.context-menu')) closeContextMenu();
    if (!event.target.closest('.spell-popup')) closeSpellPopup();
    if (!event.target.closest('.key[data-family]') && !event.target.closest('.orders') && !event.target.closest('.keyboard-panel')) hideOrders();
  });
  editor.addEventListener('contextmenu', function (event) { showContextMenu(event, workspace.activeId); });
  var lastTap = 0, lastTapEl = null;
  editor.addEventListener('click', function (event) {
    var spellEl = event.target && event.target.closest ? event.target.closest('.spell-error') : null;
    if (!spellEl || !editor.contains(spellEl)) return;
    var now = Date.now();
    if (now - lastTap < 300 && lastTapEl === spellEl) {
      var best = String(spellEl.dataset.suggestions || '').split('|').filter(Boolean)[0];
      if (best) replaceSpellSpan(spellEl, best);
      lastTap = 0; lastTapEl = null;
      return;
    }
    if (isTouchDevice()) {
      event.preventDefault();
      event.stopPropagation();
      showSpellPopup(spellEl, event.clientX, event.clientY);
    }
    lastTap = now; lastTapEl = spellEl;
  });
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
    else if (event.key === 'Enter') { event.preventDefault(); if (event.shiftKey) insertSoftBreak(); else insertNewLine(); }
    else if (event.key === 'Backspace') { if (!backspaceAtBlockStart()) phoneticKey(event); }
    else if (event.key === 'Delete') { if (!deleteAtBlockEnd()) phoneticKey(event); }
    else { phoneticKey(event); }
  });
  editor.addEventListener('focus', function () {});
  editor.addEventListener('pointerdown', function (event) {
    tapStart = Date.now();
    tapX = event.clientX;
    tapY = event.clientY;
  });

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
  $('templatesBtn').onclick = showTemplates;
  $('sidebarToggle').onclick = toggleExplorer;
  $('closeTemplates').onclick = closeTemplates;
  $('keyboardBtn').onclick = function () { deviceKeyboardMode = false; setOsk(!oskOpen); };
  $('closeKeyboard').onclick = function () { setOsk(false); };
  $('deviceKbBtn').onclick = function () {
    deviceKeyboardMode = true;
    setOsk(false);
    setTimeout(function () {
      editor.focus({preventScroll: true});
      restoreCaret();
    }, 80);
  };
  $('kbBold').onclick = function () { editor.focus({preventScroll: true}); restoreCaret(); applyFormat('bold'); };
  $('kbItalic').onclick = function () { editor.focus({preventScroll: true}); restoreCaret(); applyFormat('italic'); };
  $('kbUndo').onclick = function () { editor.focus({preventScroll: true}); restoreCaret(); undo(); };
  $('kbRedo').onclick = function () { editor.focus({preventScroll: true}); restoreCaret(); redo(); };
  $('kbSoftBreak').onclick = function () { editor.focus({preventScroll: true}); restoreCaret(); insertSoftBreak(); };
  $('kbFind').onclick = function () { hideHome(); $('findBar').classList.add('open'); $('findInput').focus(); };
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
    event.target.value = '';
    var lower = selected.name.toLowerCase();
    if (lower.endsWith('.pdf')) { importPdf(selected); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var content = String(reader.result || '');
      var name = selected.name;
      if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        var tmp = document.createElement('div'); tmp.innerHTML = content;
        content = tmp.textContent || '';
        name = name.replace(/\.html?$/i, '.md');
      }
      var f = file(uniqueName(name), content, '');
      workspace.files.push(f);
      openFile(f.id);
      save();
    };
    reader.readAsText(selected);
  };
  $('exportBtn').onclick = function () { showExportMenu(); };
  $('assistantBtn').onclick = function () {
    if (assistantOpen) closeAssistant(); else showAssistant();
  };
  $('closeAssistant').onclick = closeAssistant;
  document.querySelectorAll('.assistant-tab').forEach(function (btn) {
    btn.onclick = function () { switchAssistantTab(btn.dataset.tab); };
  });
  $('bibleSearchBtn').onclick = searchBible;
  $('bibleRandomBtn').onclick = getRandomVerse;
  $('rewriteGenerateBtn').onclick = generateBibleRewrite;
  $('completeBtn').onclick = getCompletions;
  $('bibleSearch').addEventListener('keydown', function (e) { if (e.key === 'Enter') searchBible(); });
  $('completeInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); getCompletions(); } });
  document.querySelectorAll('#exportMenu [data-export]').forEach(function (button) { button.onclick = function () { closeExportMenu(); exportFile(button.dataset.export); }; });
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

  var queryNew = new URLSearchParams(window.location.search).get('new');
  if (queryNew) {
    var tmpl = templates.find(function (t) { return t.id === queryNew; });
    if (tmpl) { createTemplate(tmpl); history.replaceState(null, '', '/'); }
  }

  window.__werketTest = { pdfInflate: pdfInflate, pdfExtractText: pdfExtractText, insert: insert, htmlToMarkdown: htmlToMarkdown };
})();

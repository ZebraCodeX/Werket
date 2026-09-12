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
  var inspectorOpen = false;
  var thumbnailsOpen = false;
  var tocOpen = false;
  var pageBreakCounter = 0;
  var paperSizes = {a4:{w:794,h:1123},letter:{w:816,h:1056},legal:{w:816,h:1344},a5:{w:559,h:794},a3:{w:1123,h:1587}};
  var currentPaperSize = 'a4';
  var margins = {top:72,right:72,bottom:72,left:72};
  var headerFooter = {header:true,footer:true,pageNumbers:true,headerHeight:36,footerHeight:36};
  var families = ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ','ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ','ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ','ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'];
  var roman = ['h','l','H','m','S','r','s','sh','q','b','t','c','x','n','N','a','k','K','w','E','z','Z','y','d','j','g','T','C','P','S','D'];
  var orders = ['e','u','i','a','ie','silent','o'];
  var symbols = ['።','፣','፤','፥','፦','፧','፨','፩','፪','፫','፬','፭','፮','፯','፰','፱','፲','?','!',',','.'];
  var phon = {h:'ሀ',H:'ሐ',l:'ለ',m:'መ',s:'ሰ',r:'ረ',S:'ሠ',b:'በ',t:'ተ',c:'ቸ',C:'ጨ',q:'ቀ',k:'ከ',x:'ኀ',n:'ነ',N:'ኘ',a:'አ',w:'ወ',z:'ዘ',y:'የ',d:'ደ',j:'ጀ',g:'ገ',T:'ጠ',p:'ፐ',f:'ፈ',v:'ቨ',D:'ፀ'};
  var vowels = {e:0,u:1,i:2,a:3,ie:4,ee:4,'':5,o:6};
  var templates = [
    {id:'blank', icon:'□', artwork:'blank', name:{en:'Blank document', am:'ባዶ ሰነድ'}, description:{en:'A clean page for notes or free writing.', am:'ለማስታወሻ ወይም ለነጻ ጽሕፈት ንጹህ ገጽ።'}, defaultName:{en:'Untitled.md', am:'አዲስ ሰነድ.md'}, files:{en:[['Untitled.md','']], am:[['አዲስ ሰነድ.md','']]}},
    {id:'letter', icon:'✉', artwork:'letter', name:{en:'Letter', am:'ደብዳቤ'}, description:{en:'Greeting, body, and closing for a formal note.', am:'መንከባከቢያ ለመደበኛ ማስታወቂያ፤ መግቢያ፣ ይዘት እና መዝጊያ።'}, defaultName:{en:'Letter.md', am:'ደብዳቤ.md'}, files:{en:[['Letter.md','<h1>Letter</h1><p>[Date]</p><p>Dear [Name],</p><p>I hope this letter finds you well. [Write your message here.]</p><p>Thank you for your time and consideration.</p><p>Sincerely,</p><p>[Your name]</p>']], am:[['ደብዳቤ.md','<h1>ደብዳቤ</h1><p>[ቀን]</p><p>ውድ [ስም]፣</p><p>ይህ ደብዳቤ ደህንነትን እያመጣልህ/ሽ ተመንጄያለሁ። [መልእክትዎን እዚህ ይጻፉ።]</p><p>ለጊዜዎና ለትኩረትዎ እናመሰግናለን።</p><p>በአክብሮት፣</p><p>[ስምዎ]</p>']]}},
    {id:'journal', icon:'◷', artwork:'journal', name:{en:'Daily journal', am:'የዕለታዊ ማስታወሻ'}, description:{en:'A focused page for reflection and daily notes.', am:'ለማሰላሰል እና ለዕለታዊ ማስታወሻ የተዘጋጀ ገጽ።'}, defaultName:{en:'Journal.md', am:'ማስታወሻ.md'}, files:{en:[['Journal.md','<h1>Daily journal</h1><p>Today’s date: [Date]</p><h2>What happened today?</h2><p>Describe your day, your feelings, and your thoughts.</p><h2>Gratitude</h2><p>Three things you are grateful for today:<br>1. <br>2. <br>3. </p><h2>Tomorrow</h2><p>What would you like to focus on tomorrow?</p>']], am:[['ማስታወሻ.md','<h1>የዕለታዊ ማስታወሻ</h1><p>የዛሬው ቀን፡ [ቀን]</p><h2>ዛሬ ምን ተከሰተ?</h2><p>ቀንዎን፣ ስሜቶችዎንና ሃሳቦችዎን ይግለጹ።</p><h2>ምስጋና</h2><p>ዛሬ ያመሰገናችሁት ሦስት ነገሮች፡<br>1. <br>2. <br>3. </p><h2>ነገ</h2><p>ነገ በምን ላይ ማተኮር ይፈልጋሉ?</p>']]}},
    {id:'notes', icon:'✎', artwork:'meeting', name:{en:'Meeting notes', am:'የስብሰባ ማስታወሻ'}, description:{en:'Agenda, notes, and next steps.', am:'መርሃ ግብር፣ ማስታወሻ እና ቀጣይ እርምጃዎች።'}, defaultName:{en:'Meeting Notes.md', am:'ስብሰባ.md'}, files:{en:[['Meeting Notes.md','<h1>Meeting notes</h1><p>Date: [Date]</p><p>Attendees: [Names]</p><h2>Agenda</h2><ul><li>Topic 1</li><li>Topic 2</li><li>Topic 3</li></ul><h2>Discussion</h2><p>Key points and decisions from the meeting.</p><h2>Action Items</h2><ul><li>[Task — owner — due date]</li><li>[Task — owner — due date]</li></ul>']], am:[['ስብሰባ.md','<h1>የስብሰባ ማስታወሻ</h1><p>ቀን: [ቀን]</p><p>ተሳታፊዎች: [ስሞች]</p><h2>መርሃ ግብር</h2><ul><li>ርዕስ 1</li><li>ርዕስ 2</li><li>ርዕስ 3</li></ul><h2>ውይይት</h2><p>በስብሰባው የተወያዩባቸው ዋና ነጥቦች እና ውሳኔዎች።</p><h2>ተግባራት</h2><ul><li>[ተግባር — ተጠያቂ — ጊዜ]</li><li>[ተግባር — ተጠያቂ — ጊዜ]</li></ul>']]}},
    {id:'book', icon:'▤', artwork:'book', name:{en:'Book project', am:'የመጽሐፍ ፕሮጀክት'}, description:{en:'Outline, characters, research, and chapter files.', am:'ዝርዝር ገለጻ፣ ገጸ-ባሕሪያት፣ ምርምር እና ምዕራፎች።'}, defaultName:{en:'Book.md', am:'መጽሐፍ.md'}, book:true}
  ];

  function safeLoad() { try { return JSON.parse(localStorage.getItem(workspaceKey) || 'null'); } catch (e) { return null; } }
  function newId() { return 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
  function workspaceLang() { return (workspace.lang === 'en' ? 'en' : 'am'); }
  function templateName(template, lang) { return ((template && template.name) || {}[lang]) || (template && template.name && template.name.en) || 'Document'; }
  function templateDesc(template, lang) { return ((template && template.description) || {}[lang]) || (template && template.description && template.description.en) || ''; }
  function templateDefaultName(template, lang) { return ((template && template.defaultName) || {})[lang] || 'Untitled.md'; }
  function templateFiles(template, lang) { return ((template && template.files) || {})[lang] || ((template && template.files && template.files.en) || [['Untitled.md','']]); }
  function initialWorkspace() { return {projectName:'My documents', activeId:null, openIds:[], font:'Noto Sans Ethiopic', size:18, align:'left', lang:'am', files:[]}; }
  var workspace = safeLoad() || initialWorkspace();
  if (!Array.isArray(workspace.files)) workspace.files = [];
  if (!workspace.files.length) workspace.files.push(file('Untitled.md', ''));
  if (!workspace.activeId || !workspace.files.some(function (f) { return f.id === workspace.activeId; })) workspace.activeId = workspace.files[0].id;
  if (!workspace.openIds || !workspace.openIds.length) workspace.openIds = [workspace.activeId];

  function file(name, text, folder) { return {id:newId(), name:name, text:text || '', folder:folder || '', lang: workspaceLang(), updated:Date.now()}; }
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
    if (changed) { restoreSelection(offsets.start, offsets.end); editor.normalize(); }
    return changed;
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
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node, count = 0, text = null;
    while ((node = walker.nextNode())) {
      var next = count + node.nodeValue.length;
      if (offset < next) return {node: node, offset: Math.max(0, offset - count)};
      if (offset === next) {
        text = {node: node, offset: node.nodeValue.length};
      }
      count = next;
    }
    return text || {node: root, offset: root.childNodes.length};
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
    var payload = {files: workspace.files, openIds: workspace.openIds, activeId: workspace.activeId, projectName: workspace.projectName, font: workspace.font, size: workspace.size, align: workspace.align, lang: workspace.lang};
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
        workspace.font = data.font || workspace.font || 'Noto Sans Ethiopic';
        workspace.size = data.size || 18;
        workspace.align = data.align || 'left';
        if (data.lang) workspace.lang = data.lang;
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
    var base = f.name.replace(/\.[^.]+$/, '') || 'document';
    var html = editorHtml();
    if (format === 'pdf') { printExport(f); return; }
    if (format === 'pdffile') { pdfFileExport(f); return; }
    if (format === 'md') { downloadBlob(htmlToMarkdown(html), base + '.md', 'text/markdown;charset=utf-8'); setStatus('Exported ' + base + '.md'); return; }
    if (format === 'txt') { downloadBlob(WerketFormats.htmlToPlainText(html), base + '.txt', 'text/plain;charset=utf-8'); setStatus('Exported ' + base + '.txt'); return; }
    if (format === 'html') { downloadBlob(exportShell(f), base + '.html', 'text/html;charset=utf-8'); setStatus('Exported ' + base + '.html'); return; }
    if (format === 'doc') { downloadBlob(exportShell(f, '<xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>'.replace(/^<xml>/, '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->')), base + '.doc', 'application/msword'); setStatus('Exported ' + base + '.doc'); return; }
    if (format === 'docx') { downloadBlob(new Blob([WerketFormats.buildDocx(html, {title: base})]), base + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); setStatus('Exported ' + base + '.docx'); return; }
    if (format === 'odt') { downloadBlob(new Blob([WerketFormats.buildOdt(html, {title: base})]), base + '.odt', 'application/vnd.oasis.opendocument.text'); setStatus('Exported ' + base + '.odt'); return; }
    if (format === 'rtf') { downloadBlob(WerketFormats.buildRtf(html, {title: base}), base + '.rtf', 'application/rtf'); setStatus('Exported ' + base + '.rtf'); return; }
    if (format === 'epub') { downloadBlob(new Blob([WerketFormats.buildEpub(html, {title: base, lang: (f.lang || workspaceLang())})]), base + '.epub', 'application/epub+zip'); setStatus('Exported ' + base + '.epub'); return; }
    if (format === 'json') {
      var backup = {
        exported: new Date().toISOString(),
        projectName: workspace.projectName,
        lang: f.lang || workspaceLang(),
        files: workspace.files.map(function (item) {
          return {name: item.name, folder: item.folder || '', lang: item.lang || '', text: item.text || ''};
        })
      };
      downloadBlob(JSON.stringify(backup, null, 2), (workspace.projectName || 'werket') + '-backup.json', 'application/json;charset=utf-8');
      setStatus('Exported workspace backup');
      return;
    }
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
function addImportedFile(name, content) {
    var f = file(uniqueName(name), content, '');
    workspace.files.push(f);
    workspace.activeId = f.id;
    return f;
  }
  function isBinaryBytes(bytes) {
    var n = Math.min(bytes.length, 2048);
    for (var i = 0; i < n; i++) if (bytes[i] === 0) return true;
    return false;
  }
  function bytesToUtf8(bytes) {
    var decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', {fatal: false}) : null;
    if (decoder) { try { return decoder.decode(bytes); } catch (e) {} }
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(encodeURIComponent(out)); } catch (e2) { return out; }
  }
  function textToParagraphs(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var l = line.trim();
      if (!l) return '<p><br></p>';
      return '<p>' + escapeHtml(line.replace(/\u00a0/g, ' ')) + '</p>';
    }).join('');
  }
  function sanitizeHtml(html) {
    var doc = null;
    try { doc = new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html'); } catch (e) {}
    if (!doc || !doc.body) return '';
    ['script', 'style', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'noscript', 'template'].forEach(function (tag) {
      doc.querySelectorAll(tag).forEach(function (node) { node.remove(); });
    });
    doc.querySelectorAll('*').forEach(function (node) {
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (/^on/.test(name) || (name === 'href' && /^javascript:/i.test(attr.value)) || (name === 'src' && (attr.value.indexOf('data:') === 0))) node.removeAttribute(attr.name);
      });
    });
    return (doc.body.innerHTML || '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }
  function parseXmlString(text) {
    try {
      var doc = new DOMParser().parseFromString(text, 'application/xml');
      if (!doc || doc.querySelector('parsererror')) return null;
      return doc;
    } catch (e) { return null; }
  }
  function blocksToHtml(blocks) {
    return blocks.map(function (block) {
      if (!block.text) return '<p><br></p>';
      if (block.type === 'pre') return '<pre class="import-code">' + escapeHtml(block.text) + '</pre>';
      if (!/^(h[123]|p|ul|ol|li|blockquote|pre)$/.test(block.type)) block.type = 'p';
      return '<' + block.type + '>' + escapeHtml(block.text) + '</' + block.type + '>';
    }).join('');
  }
  function extractBodyBlocks(node, out) {
    if (!node || !node.childNodes) return out;
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType !== 1) continue;
      var tag = (child.tagName || child.localName || '').toLowerCase();
      if (/^(script|style|link|meta|head|title)$/.test(tag)) continue;
      if (/^h[1-6]$/.test(tag)) {
        var headingText = (child.textContent || '').trim();
        if (headingText) out.push('<h' + Math.min(3, Number(tag[1])) + '>' + escapeHtml(headingText) + '</h' + Math.min(3, Number(tag[1])) + '>');
        continue;
      }
      if (tag === 'p' || tag === 'blockquote' || tag === 'li' || tag === 'pre' || tag === 'dt' || tag === 'dd') {
        var t = (child.textContent || '').trim();
        if (t) {
          if (tag === 'pre') out.push('<pre class="import-code">' + escapeHtml(t) + '</pre>');
          else if (tag === 'blockquote') out.push('<blockquote><p>' + escapeHtml(t) + '</p></blockquote>');
          else if (tag === 'li') out.push('<ul><li>' + escapeHtml(t) + '</li></ul>');
          else out.push('<p>' + escapeHtml(t) + '</p>');
        }
        continue;
      }
      extractBodyBlocks(child, out);
    }
    return out;
  }
  function importDocx(name, bytes) {
    var entries = WerketFormats.readZip(bytes) || [];
    var entry = entries.filter(function (e) { return /word\/document\.xml$/i.test(e.name); })[0];
    if (!entry) { setStatus('Could not open .docx: no document found'); return; }
    var xml = WerketFormats.bytesToText(entry.data);
    var doc = parseXmlString(xml);
    if (!doc) { setStatus('Could not read .docx contents'); return; }
    var out = [];
    var propsHash = {};
    var styles = entries.filter(function (e) { return /word\/styles\.xml$/i.test(e.name); })[0];
    if (styles) {
      var sdoc = parseXmlString(WerketFormats.bytesToText(styles.data));
      if (sdoc) {
        var sEls = sdoc.getElementsByTagName('w:style');
        for (var i = 0; i < sEls.length; i++) {
          var styleEl = sEls[i];
          var sid = styleEl.getAttribute('w:styleId');
          var styleNameEl = styleEl.getElementsByTagName('w:name')[0];
          if (sid && styleNameEl) propsHash[sid] = styleNameEl.getAttribute('w:val') || '';
        }
      }
    }
    var pEls = doc.getElementsByTagName('w:p');
    for (var pi = 0; pi < pEls.length; pi++) {
      var pEl = pEls[pi];
      var styleRef = '';
      var pStyle = pEl.getElementsByTagName('w:pStyle')[0];
      if (pStyle) styleRef = pStyle.getAttribute('w:val') || '';
      var styleName = propsHash[styleRef] || '';
      var heading = /heading\s*(\d)/i.exec(styleName);
      var text = '';
      var tEls = pEl.getElementsByTagName('w:t');
      for (var ti = 0; ti < tEls.length; ti++) text += tEls[ti].textContent;
      if (heading) out.push('<h' + Math.min(3, Number(heading[1])) + '>' + escapeHtml(text) + '</h' + Math.min(3, Number(heading[1])) + '>');
      else out.push('<p>' + escapeHtml(text) + '</p>');
    }
    if (!out.length) { setStatus('.docx appears empty'); return; }
    addImportedFile(name.replace(/\.docx$/i, '') + '.md', out.join(''));
  }
  function importOdt(name, bytes) {
    var entries = WerketFormats.readZip(bytes) || [];
    var entry = entries.filter(function (e) { return /content\.xml$/i.test(e.name); })[0];
    if (!entry) { setStatus('Could not open .odt: no content found'); return; }
    var doc = parseXmlString(WerketFormats.bytesToText(entry.data));
    if (!doc) { setStatus('Could not read .odt contents'); return; }
    var blocks = [];
    var s = doc.getElementsByTagName('office:body')[0];
    var root = (s || doc.documentElement);
    (function walk(node) {
      if (!node.childNodes) return;
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType !== 1) continue;
        var tag = (child.localName || '').toLowerCase();
        if (tag === 'p') blocks.push({type: 'p', text: (child.textContent || '').trim()});
        else if (tag === 'h') {
          var lvl = parseInt(child.getAttribute('text:outline-level') || '1', 10) || 1;
          blocks.push({type: 'h' + Math.min(3, lvl), text: (child.textContent || '').trim()});
        } else walk(child);
      }
    })(root);
    if (!blocks.length) { setStatus('.odt appears empty'); return; }
    addImportedFile(name.replace(/\.odt$/i, '') + '.md', blocksToHtml(blocks));
  }
  function importEpub(name, bytes) {
    var entries = WerketFormats.readZip(bytes) || [];
    function findEntry(path) {
      var normalized = String(path || '').replace(/^\/+/, '');
      return entries.filter(function (e) {
        var n = e.name.replace(/^\/+/, '').replace(/\\/g, '/');
        return n === normalized || n === './' + normalized;
      })[0];
    }
    var container = findEntry('META-INF/container.xml');
    var opfPath = 'EPUB/content.opf';
    if (container) {
      var cdoc = parseXmlString(WerketFormats.bytesToText(container.data));
      if (cdoc) {
        var rootfile = cdoc.getElementsByTagName('rootfile')[0];
        if (rootfile && rootfile.getAttribute('full-path')) opfPath = rootfile.getAttribute('full-path');
      }
    }
    var opfEntry = findEntry(opfPath);
    if (!opfEntry) { setStatus('Could not open .epub: no package found'); return; }
    var odoc = parseXmlString(WerketFormats.bytesToText(opfEntry.data));
    if (!odoc) { setStatus('Could not read .epub contents'); return; }
    var hrefs = [];
    var manifest = {};
    var mItems = odoc.getElementsByTagName('item');
    for (var i = 0; i < mItems.length; i++) manifest[mItems[i].getAttribute('id')] = mItems[i].getAttribute('href');
    var spineItems = odoc.getElementsByTagName('itemref');
    for (var si = 0; si < spineItems.length; si++) {
      var idref = spineItems[si].getAttribute('idref');
      if (manifest[idref]) hrefs.push(manifest[idref]);
    }
    if (!hrefs.length) {
      hrefs = entries.filter(function (e) { return /\.x?html?$/i.test(e.name) && !/nav\.xhtml$/i.test(e.name); }).map(function (e) { return e.name; }).sort();
    }
    var opfDir = opfPath.replace(/\/[^\/]*$/, '');
    function resolve(href) {
      href = String(href || '').replace(/#.*$/, '');
      if (!href) return '';
      if (/^(https?:)?\//.test(href)) return href.replace(/^\/+/, '');
      if (href.indexOf('../') === 0) {
        var parts = (opfDir ? opfDir.split('/') : []).slice();
        while (parts.length && href.indexOf('../') === 0) { parts.pop(); href = href.slice(3); }
        return parts.concat([href]).join('/');
      }
      return (opfDir ? opfDir + '/' : '') + href;
    }
    var html = '';
    hrefs.forEach(function (href) {
      var path = resolve(href);
      var entry = findEntry(path);
      var content = entry ? bytesToUtf8(entry.data) : '';
      var doc = null;
      try { doc = new DOMParser().parseFromString(content, 'text/html'); } catch (e) {}
      if (doc && doc.body) {
        html += extractBodyBlocks(doc.body, []).join('\n') + '\n';
      } else {
        var raw = String(content).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
        if (raw) html += textToParagraphs(raw);
      }
    });
    if (!html.trim()) { setStatus('.epub appears empty'); return; }
    addImportedFile(name.replace(/\.epub$/i, '') + '.md', html);
  }
  function rtfToText(rtf) {
    var src = String(rtf || '');
    src = src.replace(/\\u(-?\d+)\??/g, function (m, n) {
      n = parseInt(n, 10);
      if (n < 0) n += 65536;
      return n <= 0xffff ? String.fromCharCode(n) : '';
    });
    src = src.replace(/\\'([0-9a-fA-F]{2})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
    src = src.replace(/\\par\b/gi, '\n');
    src = src.replace(/\\line\b/gi, '\n');
    src = src.replace(/\\tab\b/gi, '\t');
    src = src.replace(/\\~+/g, ' ').replace(/\\_+/g, ' ');
    src = src.replace(/\\[a-zA-Z]+\s?/g, ' ');
    src = src.replace(/\\['{}*/\\]/g, ' ').replace(/[{}]/g, '');
    var out = [];
    src.split(/\n+/).forEach(function (line) {
      var l = String(line || '').replace(/\s+/g, ' ').trim();
      if (l) out.push('<p>' + escapeHtml(l) + '</p>');
    });
    return out.join('');
  }
  function importPdfBytes(name, bytes) {
    var text = '';
    try { text = pdfExtractText(bytes); } catch (e) { text = ''; }
    if (!text.trim()) { setStatus('Could not read text from ' + name); return null; }
    var paragraphs = text.split(/\n{2,}/).map(function (para) {
      var trimmed = para.trim();
      if (!trimmed) return '';
      return '<p>' + trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>';
    }).filter(Boolean).join('');
    return addImportedFile(name.replace(/\.pdf$/i, '.md'), paragraphs);
  }
  function importFile(file) {
    var lower = (file.name || '').toLowerCase();
    var ext = (lower.match(/\.([a-z0-9]+)$/) || ['', ''])[1];
    var name = file.name;
    if (lower.endsWith('.pdf')) {
      return new Promise(function (resolvePromise) {
        file.arrayBuffer().then(function (buf) {
          var f = importPdfBytes(name, new Uint8Array(buf));
          resolvePromise(f ? true : false);
        }).catch(function () { setStatus('Could not read ' + name); resolvePromise(false); });
      });
    }
    if (ext === 'docx' || ext === 'odt' || ext === 'epub') {
      return new Promise(function (resolvePromise) {
        file.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf);
          try {
            if (ext === 'docx') importDocx(name, bytes);
            else if (ext === 'odt') importOdt(name, bytes);
            else importEpub(name, bytes);
            resolvePromise(true);
          } catch (e) { setStatus('Could not open ' + name + ': ' + e.message); resolvePromise(false); }
        }).catch(function () { setStatus('Could not read ' + name); resolvePromise(false); });
      });
    }
    return new Promise(function (resolvePromise) {
      file.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        if (isBinaryBytes(bytes)) {
          setStatus('“' + name + '” is a binary file that Werket cannot edit.');
          resolvePromise(false);
          return;
        }
        var content = bytesToUtf8(bytes);
        if (ext === 'html' || ext === 'htm') {
          var sanitized = sanitizeHtml(content);
          addImportedFile(name.replace(/\.html?$/i, '.html'), sanitized);
          resolvePromise(true);
          return;
        }
        if (ext === 'rtf') {
          var f = addImportedFile(name.replace(/\.rtf$/i, '.md'), textToParagraphs(rtfToText(content)));
          resolvePromise(!!f);
          return;
        }
        if (ext === 'md' || ext === 'markdown') {
          var f2 = addImportedFile(name, content);
          resolvePromise(!!f2);
          return;
        }
        if (ext === 'doc') {
          var plain = content.replace(/[^\x20-\x7e\xe0-\xff]/g, ' ').replace(/\s+/g, ' ');
          var f3 = addImportedFile(name.replace(/\.doc$/i, '.txt'), textToParagraphs(plain));
          resolvePromise(!!f3);
          return;
        }
        var f4 = addImportedFile(name, textToParagraphs(content));
        resolvePromise(!!f4);
      }).catch(function () { setStatus('Could not read ' + name); resolvePromise(false); });
    });
  }
  function importFiles(files) {
    if (!files || !files.length) return;
    setStatus('Opening ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…');
    var done = 0, ok = 0;
    function finish() {
      done++;
      if (done === files.length) {
        save();
        if (workspace.activeId) openFile(workspace.activeId);
        setStatus('Opened ' + ok + ' of ' + files.length + ' file' + (files.length > 1 ? 's' : ''));
      }
    }
    files.forEach(function (fileItem) {
      importFile(fileItem).then(function (success) { if (success) ok++; finish(); });
    });
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
    Object.keys(folders).sort(function (a, b) {
      if (a === '__root') return -1;
      if (b === '__root') return 1;
      return String(a).localeCompare(String(b));
    }).forEach(function (folder) {
      var items = folders[folder];
      if (folder !== '__root') html += '<div class="tree-folder"><div class="tree-folder-label"><span>▾</span><span>▱</span>' + escapeHtml(folder) + '</div>';
      items.sort(function (a,b) { return a.name.localeCompare(b.name); }).forEach(function (f) {
        var lowerName = f.name.toLowerCase();
        var icon = /\.(md|markdown)$/.test(lowerName) ? '◇' : /\.(pdf|docx|doc|odt|rtf|epub)$/.test(lowerName) ? '⬕' : '□';
        html += '<button class="tree-file ' + (f.id === workspace.activeId ? 'active' : '') + '" data-file="' + f.id + '"><span class="file-icon">' + icon + '</span>' + escapeHtml(f.name) + '</button>';
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
      return '<button class="home-card" data-template="' + template.id + '"><span class="home-card-preview artwork-' + template.artwork + '"><span>' + template.icon + '</span></span><b>' + escapeHtml(template.name.en) + '</b><span>' + escapeHtml((template.name.am || '') + ' · ' + template.description.en) + '</span></button>';
    }).join('');
    $('homeTemplates').querySelectorAll('[data-template]').forEach(function (button) {
      button.onclick = function () { openNewDocDialog(button.dataset.template); };
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
  // Allow clicking the document or home background to dismiss the home overlay
  // (users expect to click the paper to start writing)
  try {
    var _homeEl = document.getElementById('homeScreen');
    if (_homeEl) _homeEl.addEventListener('click', function(e){ if (e.target === _homeEl) { hideHome(); focusEditor(); }});
    var _stageEl = document.querySelector('.document-stage');
    if (_stageEl) _stageEl.addEventListener('click', function(e){ if (isHome() && !e.target.closest('#homeScreen')) { hideHome(); }});
  } catch(e) {}
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
    editor.dataset.lang = f.lang || workspaceLang();
    var ph = f.lang === 'am' ? 'አማርኛ መጻፍ ይጀምሩ...' : 'Start writing in English...';
    if (editor.dataset.placeholder !== ph) editor.dataset.placeholder = ph;
    $('fileStatus').textContent = f.name + ' · UTF-8 · ' + (editor.dataset.lang === 'am' ? 'አማርኛ' : 'English');
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
        // Ensure focus is maintained
        editor.focus({preventScroll: true});
        return;
      }
    }
    var offsets = selectionOffsets();
    replaceTextRange(offsets.start, offsets.end, text);
    changed();
    restoreCaret();
    // Ensure focus is maintained after insert
    editor.focus({preventScroll: true});
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
         var errorsEl = $('errors');
         if (errorsEl) {
           errorsEl.innerHTML = unknown.slice(0, 8).map(function (item) {
             var btns = (item.suggestions || []).slice(0, 3).map(function (s) {
               return '<button data-fix="' + escapeHtml(s.word) + '" data-start="' + item.start + '" data-end="' + item.end + '">' + escapeHtml(s.word) + '</button>';
             }).join('');
             var start = item.start, end = item.end;
             return '<div class="spell-error-item"><span class="spell-wrong">' + escapeHtml(item.word) + '</span><span class="spell-actions">' + (btns || '<span class="empty">No match</span>') + '</span></div>';
           }).join('');
           errorsEl.querySelectorAll('[data-fix]').forEach(function (btn) {
             btn.onclick = function () {
               var start = Number(btn.dataset.start), end = Number(btn.dataset.end);
               replaceTextRange(start, end, btn.dataset.fix);
               changed(); restoreCaret(); checkSpelling();
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
    });
    host.querySelectorAll('[data-symbol]').forEach(function (button) {
      onTap(button, function () { hideOrders(); insert(button.dataset.symbol === '\\n' ? '\n' : button.dataset.symbol); });
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
      var offsets = selectionOffsets(), p = offsets.start, q = offsets.end;
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

  function bookFiles(lang) {
    var am = lang === 'am';
    if (am) return [
      file('ዝርዝር.md', '<h1>የመጽሐፍ ዝርዝር</h1><h2>መነሻ ሃሳብ</h2><p>ዋናውን ሃሳብ እዚህ ይጻፉ።</p><h2>አወቃቀር</h2><ul><li>መግቢያ</li><li>የመሀል ክፍል</li><li>መደምደሚያ</li></ul>', ''),
      file('ገጸ-ባሕሪያት.md', '<h1>ገጸ-ባሕሪያት</h1><h2>ዋና ተዋናይ</h2><p>ስም፣ ምኞት፣ ግጭት እና ለውጥ።</p>', ''),
      file('ምዕራፍ-01.md', '<h1>ምዕራፍ 01</h1><p>ገጽ ታሪኩን እዚህ ይጀምሩ።</p>', 'ምዕራፎች'),
      file('ምዕራፍ-02.md', '<h1>ምዕራፍ 02</h1><p>ታሪኩን እዚህ ይቀጥሉ።</p>', 'ምዕራፎች'),
      file('ምርምር.md', '<h1>የምርምር ማስታወሻዎች</h1><p>ማጣቀሻዎችን እና ሃሳቦችን እዚህ ያስቀምጡ።</p>', '')
    ];
    return [
      file('outline.md', '<h1>Book outline</h1><h2>Premise</h2><p>Write the central idea here.</p><h2>Structure</h2><ul><li>Beginning</li><li>Middle</li><li>End</li></ul>', ''),
      file('characters.md', '<h1>Characters</h1><h2>Main character</h2><p>Name, desire, conflict, and change.</p>', ''),
      file('chapter-01.md', '<h1>Chapter 01</h1><p>Begin the first scene here.</p>', 'chapters'),
      file('chapter-02.md', '<h1>Chapter 02</h1><p>Continue the story here.</p>', 'chapters'),
      file('research.md', '<h1>Research notes</h1><p>Keep references and ideas here.</p>', '')
    ];
  }
  function ensureExt(name, ext) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return ext || '.md';
    return /(\.[^.]+)$/.test(s) ? s : s + (ext || '.md');
  }
  function addCreatedFiles(created, projectName) {
    created.forEach(function (f) { workspace.files.push(f); });
    workspace.activeId = created[0].id;
    workspace.openIds = created.map(function (f) { return f.id; }).concat(workspace.openIds || []).filter(function (id, index, all) { return all.indexOf(id) === index; });
    if (projectName) workspace.projectName = projectName;
    closeTemplates();
    closeNewDocDialog();
    hideHome();
    saveWorkspace();
    render();
    setStatus('Document created');
    focusEditor();
  }
  function createFromNewDoc(template, lang, name, useOsk) {
    lang = lang === 'en' ? 'en' : 'am';
    workspace.lang = lang;
    var created;
    if (template && template.book) {
      created = bookFiles(lang);
      var project = String(name || '').trim().replace(/\.md$/i, '') || templateDefaultName(template, lang).replace(/\.md$/i, '');
      addCreatedFiles(created, project);
    } else if (template) {
      var src = templateFiles(template, lang);
      created = src.map(function (item, idx) {
        var nm = idx === 0 ? ensureExt(name, '.md') : item[0];
        return file(uniqueName(nm), item[1] || '', '');
      });
      addCreatedFiles(created, workspace.projectName);
    } else {
      created = [file(uniqueName(ensureExt(name, '.md')), '', '')];
      addCreatedFiles(created, workspace.projectName);
    }
    if (lang === 'am' && useOsk) {
      setTimeout(function () { setOsk(true); }, 300);
    }
    return created;
  }
  var newDocTemplateId = 'blank';
  function selectedNewDocTemplate() { return templates.find(function (t) { return t.id === newDocTemplateId; }) || templates[0]; }
  function setNewDocLangControl() {
    var lang = $('newDocLangAm').checked ? 'am' : 'en';
    $('newDocOskWrap').style.display = lang === 'am' ? 'flex' : 'none';
    var t = selectedNewDocTemplate();
    $('newDocName').placeholder = templateDefaultName(t, lang);
    var book = t && t.book;
    $('newDocNameLabel').textContent = book ? (lang === 'am' ? 'የፕሮጀክት ስም (Project name)' : 'Project name') : (lang === 'am' ? 'የፋይል ስም (File name)' : 'File name');
    $('newDocCreate').textContent = book ? (lang === 'am' ? 'ፕሮጀክቱን ይፍጠሩ' : 'Create project') : (lang === 'am' ? 'ሰነዱን ይፍጠሩ' : 'Create document');
  }
  function openNewDocDialog(templateId, presetLang) {
    closeMenu(); closeSaveMenu(); closeExportMenu();
    newDocTemplateId = templateId || 'blank';
    var t = selectedNewDocTemplate();
    var lang = presetLang || workspaceLang();
    $('newDocLangAm').checked = lang !== 'en';
    $('newDocLangEn').checked = lang === 'en';
    $('newDocName').value = '';
    $('newDocError').hidden = true;
    $('newDocPickedName').textContent = t.name.am + ' · ' + t.name.en;
    $('newDocPickedDesc').textContent = templateDesc(t, lang);
    $('newDocTemplateGrid').querySelectorAll('[data-ndtp]').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.ndtp === newDocTemplateId);
    });
    setNewDocLangControl();
    var dialog = $('newDocDialog');
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    if ($('newDocLangAm').checked) $('newDocOsk').checked = true;
    setTimeout(function () { var inp = $('newDocName'); inp.focus(); var def = templateDefaultName(t, lang); if (!inp.value) inp.value = def; inp.select(); }, 120);
  }
  function closeNewDocDialog() {
    var dialog = $('newDocDialog');
    if (dialog.open) dialog.close(); else dialog.removeAttribute('open');
  }
  function submitNewDoc(event) {
    if (event && event.preventDefault) event.preventDefault();
    var name = $('newDocName').value;
    if (!name || !name.trim()) { $('newDocError').textContent = 'Please name your document.'; $('newDocError').hidden = false; return; }
    var lang = $('newDocLangAm').checked ? 'am' : 'en';
    createFromNewDoc(selectedNewDocTemplate(), lang, name, $('newDocOsk').checked);
    setStatus((lang === 'am' ? 'New Amharic document created' : 'New document created'));
  }
  function createTemplate(template) { openNewDocDialog(template && template.id ? template.id : 'blank', workspaceLang()); }
  function closeTemplates() {
    var dialog = $('templateDialog');
    if (dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  function showTemplates() { openNewDocDialog('blank', workspaceLang()); }
  function createBlank() { openNewDocDialog('blank', workspaceLang()); }
  function createFile() { openNewDocDialog('blank', workspaceLang()); }
  function renderNewDocTemplates() {
    $('newDocTemplateGrid').innerHTML = templates.map(function (template) {
      return '<button type="button" class="newdoc-tpl" data-ndtp="' + template.id + '" title="' + escapeHtml(template.name.en) + '"><span class="template-art artwork-' + template.artwork + '"><span>' + template.icon + '</span></span><b>' + escapeHtml(template.name.en) + '<small>' + escapeHtml(template.name.am) + '</small></b></button>';
    }).join('');
    $('newDocTemplateGrid').querySelectorAll('[data-ndtp]').forEach(function (chip) {
      chip.onclick = function () {
        newDocTemplateId = chip.dataset.ndtp;
        var t = selectedNewDocTemplate();
        var lang = $('newDocLangAm').checked ? 'am' : 'en';
        $('newDocPickedName').textContent = t.name.am + ' · ' + t.name.en;
        $('newDocPickedDesc').textContent = templateDesc(t, lang);
        $('newDocName').value = '';
        $('newDocName').placeholder = templateDefaultName(t, lang);
        $('newDocNameLabel').textContent = t.book ? (lang === 'am' ? 'የፕሮጀክት ስም (Project name)' : 'Project name') : (lang === 'am' ? 'የፋይል ስም (File name)' : 'File name');
        $('newDocName').focus();
        var def = templateDefaultName(t, lang);
        $('newDocName').value = def;
        $('newDocName').select();
        $('newDocTemplateGrid').querySelectorAll('[data-ndtp]').forEach(function (other) { other.classList.toggle('active', other === chip); });
        setNewDocLangControl();
      };
    });
  }
  function renameFile() { var current = activeFile(); if (!current) return; var name = window.prompt('Rename file', current.name); if (name && name.trim()) { current.name = name.trim(); save(); render(); } }
  function duplicateFile() { var current = activeFile(); if (!current) return; var copy = file(uniqueName(current.name.replace(/(\.[^.]+)?$/, ' copy$1')), current.text, current.folder); workspace.files.push(copy); openFile(copy.id); save(); }
  function deleteFile() { var current = activeFile(); if (!current || workspace.files.length === 1) { window.alert('Keep at least one document in the workspace.'); return; } if (!window.confirm('Delete ' + current.name + '?')) return; workspace.files = workspace.files.filter(function (item) { return item.id !== current.id; }); workspace.openIds = workspace.openIds.filter(function (item) { return item !== current.id; }); workspace.activeId = workspace.openIds[workspace.openIds.length - 1] || workspace.files[0].id; if (!workspace.openIds.length) workspace.openIds = [workspace.activeId]; save(); render(); }
  function toggleExplorer() {
    $('explorerPanel').classList.toggle('open');
    document.body.classList.toggle('sidebar-open', $('explorerPanel').classList.contains('open'));
  }

  $('projectName').oninput = function () { workspace.projectName = $('projectName').value; saveWorkspace(); };
  document.addEventListener('pointerdown', function (event) {
    if (!event.target.closest('.menu-wrap')) { closeMenu(); closeSaveMenu(); closeExportMenu(); }
    if (!event.target.closest('.context-menu')) closeContextMenu();
    if (!event.target.closest('.key[data-family]') && !event.target.closest('.orders') && !event.target.closest('.keyboard-panel')) hideOrders();
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
        var f2 = activeFile();
        if (f2) {
          var lower = f2.name.toLowerCase();
          var isMd = /\.md$/i.test(lower) || /\.markdown$/i.test(lower);
          var content = isMd ? htmlToMarkdown(editorHtml()) : editorText();
          var type = isMd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
          var dlName = /\.([^.]+)$/.test(f2.name) ? f2.name : f2.name + '.txt';
          var link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([content], {type: type}));
          link.download = dlName;
          link.click();
          URL.revokeObjectURL(link.href);
          setStatus('Downloaded ' + dlName);
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
    if (event.key === 'Escape') { hideOrders(); closeMenu(); closeContextMenu(); if ($('newDocDialog').open) closeNewDocDialog(); if ($('templateDialog').open) closeTemplates(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); openNewDocDialog('blank', workspaceLang()); }
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
  editor.addEventListener('pointerup', function (event) {
    if (isTouchDevice() && !oskOpen && !deviceKeyboardMode && Date.now() - tapStart < 600 && Math.abs(event.clientX - tapX) < 12 && Math.abs(event.clientY - tapY) < 12) {
      setOsk(true);
    }
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
      openNewDocDialog(button.dataset.new, workspaceLang());
    };
  });
  $('newFromTemplate').onclick = function () { closeMenu(); showTemplates(); };
  $('printBtn').onclick = function () { hideHome(); window.print(); };
  $('newFileBtn').onclick = createFile;
  $('templatesBtn').onclick = showTemplates;
  $('sidebarToggle').onclick = toggleExplorer;
  $('closeTemplates').onclick = closeTemplates;
  $('newDocCancel').onclick = closeNewDocDialog;
  $('newDocForm').onsubmit = submitNewDoc;
  $('newDocLangAm').onchange = setNewDocLangControl;
  $('newDocLangEn').onchange = setNewDocLangControl;
  $('newDocDialog').addEventListener('click', function (event) { if (event.target === $('newDocDialog')) closeNewDocDialog(); });
  renderNewDocTemplates();
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
    var selected = Array.prototype.slice.call(event.target.files || []);
    if (!selected.length) return;
    event.target.value = '';
    importFiles(selected);
  };
  $('exportBtn').onclick = function () { showExportMenu(); };
  document.querySelectorAll('#exportMenu [data-export]').forEach(function (button) { button.onclick = function () { closeExportMenu(); exportFile(button.dataset.export); }; });
  $('brandHome').onclick = showHome;
  $('themeBtn').onclick = function () { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };

  /* ======= PAGES-LIKE FEATURES ======= */

  // Paragraph Style Dropdown
  var paragraphStyles = {
    body: {tag:'p', name:'Body'},
    heading1: {tag:'h1', name:'Heading 1'},
    heading2: {tag:'h2', name:'Heading 2'},
    heading3: {tag:'h3', name:'Heading 3'},
    title: {tag:'h1', name:'Title', className:'title-style'},
    subtitle: {tag:'h2', name:'Subtitle', className:'subtitle-style'},
    caption: {tag:'p', name:'Caption', className:'caption-style'},
    code: {tag:'pre', name:'Code', className:'code-style'},
    blockquote: {tag:'blockquote', name:'Blockquote'}
  };
  function applyParagraphStyle(styleKey) {
    var style = paragraphStyles[styleKey];
    if (!style) return;
    pushUndo();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var block = currentBlockNode();
    var newTag = style.tag;
    var className = style.className || '';
    if (!block) {
      var range = sel.getRangeAt(0);
      var el = document.createElement(newTag);
      if (className) el.className = className;
      if (range.collapsed) el.innerHTML = '<br>';
      else { el.appendChild(range.extractContents()); }
      range.insertNode(el);
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (block.nodeName.toLowerCase() === newTag && (!className || block.className === className)) {
      // Already this style, convert to body
      var p = document.createElement('p');
      p.innerHTML = block.innerHTML || '<br>';
      block.parentNode.replaceChild(p, block);
    } else {
      var newEl = document.createElement(newTag);
      newEl.innerHTML = block.innerHTML || '<br>';
      if (className) newEl.className = className;
      block.parentNode.replaceChild(newEl, block);
    }
    changed(); restoreCaret();
    updateInspectorFromSelection();
  }
  if ($('paragraphStyle')) {
    $('paragraphStyle').onchange = function () {
      applyParagraphStyle(this.value);
      this.value = 'body'; // Reset to show default
    };
  }

  // Inspector Sidebar
  function toggleInspector() {
    inspectorOpen = !inspectorOpen;
    document.body.classList.toggle('inspector-open', inspectorOpen);
    $('inspectorBtn').setAttribute('aria-pressed', inspectorOpen);
    if (inspectorOpen) {
      updateInspectorFromSelection();
      closeThumbnails();
      closeToc();
    }
  }
  function closeInspector() {
    inspectorOpen = false;
    document.body.classList.remove('inspector-open');
    $('inspectorBtn').setAttribute('aria-pressed', 'false');
  }
  function switchInspectorTab(tab) {
    document.querySelectorAll('.inspector-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.inspector === tab);
    });
    document.querySelectorAll('.inspector-panel').forEach(function (panel) {
      panel.hidden = panel.id !== 'inspector' + tab.charAt(0).toUpperCase() + tab.slice(1);
    });
  }
  function updateInspectorFromSelection() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var block = currentBlockNode();
    if (!block) return;
    // Style panel
    var tag = block.nodeName.toLowerCase();
    var className = block.className || '';
    var styleKey = 'body';
    for (var k in paragraphStyles) {
      if (paragraphStyles[k].tag === tag && (!paragraphStyles[k].className || paragraphStyles[k].className === className)) {
        styleKey = k; break;
      }
    }
    if ($('inspectorParagraphStyle')) $('inspectorParagraphStyle').value = styleKey;
    // Text panel
    if ($('inspectorFontFamily')) $('inspectorFontFamily').value = getComputedStyle(block).fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    if ($('inspectorFontSize')) $('inspectorFontSize').value = parseFloat(getComputedStyle(block).fontSize) || workspace.size;
    if ($('inspectorFontColor')) $('inspectorFontColor').value = rgbToHex(getComputedStyle(block).color);
    if ($('inspectorLineSpacing')) $('inspectorLineSpacing').value = getComputedStyle(block).lineHeight;
    if ($('inspectorParaSpacing')) $('inspectorParaSpacing').value = parseFloat(getComputedStyle(block).marginBottom) * 1 || 12;
    if ($('inspectorBold')) $('inspectorBold').checked = getComputedStyle(block).fontWeight >= 600 || getComputedStyle(block).fontWeight === 'bold';
    if ($('inspectorItalic')) $('inspectorItalic').checked = getComputedStyle(block).fontStyle === 'italic';
    if ($('inspectorUnderline')) $('inspectorUnderline').checked = getComputedStyle(block).textDecoration.includes('underline');
    if ($('inspectorStrike')) $('inspectorStrike').checked = getComputedStyle(block).textDecoration.includes('line-through');
  }
  function rgbToHex(rgb) {
    var m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1],m[2],m[3]].map(function(x){return parseInt(x).toString(16).padStart(2,'0');}).join('');
  }
  // Inspector event handlers
  if ($('inspectorParagraphStyle')) {
    $('inspectorParagraphStyle').onchange = function () { applyParagraphStyle(this.value); };
  }
  if ($('inspectorFontFamily')) {
    $('inspectorFontFamily').onchange = function () {
      pushUndo();
      var block = currentBlockNode();
      if (block) { block.style.fontFamily = this.value; changed(); }
    };
  }
  if ($('inspectorFontSize')) {
    $('inspectorFontSize').onchange = function () {
      pushUndo();
      var block = currentBlockNode();
      if (block) { block.style.fontSize = this.value + 'px'; changed(); }
    };
  }
  if ($('inspectorFontColor')) {
    $('inspectorFontColor').onchange = function () {
      pushUndo();
      var block = currentBlockNode();
      if (block) { block.style.color = this.value; changed(); }
    };
  }
  if ($('inspectorLineSpacing')) {
    $('inspectorLineSpacing').onchange = function () {
      pushUndo();
      var block = currentBlockNode();
      if (block) { block.style.lineHeight = this.value; changed(); }
    };
  }
  if ($('inspectorParaSpacing')) {
    $('inspectorParaSpacing').onchange = function () {
      pushUndo();
      var block = currentBlockNode();
      if (block) { block.style.marginBottom = this.value + 'px'; changed(); }
    };
  }
  ['Bold','Italic','Underline','Strike'].forEach(function (prop) {
    var el = $('inspector' + prop);
    if (el) {
      el.onchange = function () {
        pushUndo();
        var block = currentBlockNode();
        if (!block) return;
        var val = this.checked;
        if (prop === 'Bold') block.style.fontWeight = val ? '700' : '400';
        else if (prop === 'Italic') block.style.fontStyle = val ? 'italic' : 'normal';
        else if (prop === 'Underline') block.style.textDecoration = val ? 'underline' : 'none';
        else if (prop === 'Strike') block.style.textDecoration = val ? 'line-through' : 'none';
        changed();
      };
    }
  });

  // Layout Inspector
  function applyLayoutSettings() {
    var paper = $('inspectorPaperSize');
    if (paper) {
      paper.onchange = function () {
        var size = this.value;
        if (size === 'custom') return;
        currentPaperSize = size;
        var sz = paperSizes[size];
        applyPaperSize(sz.w, sz.h);
      };
    }
    var width = $('inspectorPaperWidth'), height = $('inspectorPaperHeight');
    if (width && height) {
      function applyCustom() {
        var w = parseInt(width.value) || paperSizes[currentPaperSize].w;
        var h = parseInt(height.value) || paperSizes[currentPaperSize].h;
        applyPaperSize(w, h);
      }
      width.onchange = applyCustom;
      height.onchange = applyCustom;
    }
    ['Top','Right','Bottom','Left'].forEach(function (side) {
      var el = $('inspectorMargin' + side);
      if (el) el.onchange = function () {
        margins[side.toLowerCase()] = parseInt(this.value) || 72;
        applyMargins();
      };
    });
    if ($('inspectorHeader')) $('inspectorHeader').onchange = function () { headerFooter.header = this.checked; applyHeaderFooter(); };
    if ($('inspectorFooter')) $('inspectorFooter').onchange = function () { headerFooter.footer = this.checked; applyHeaderFooter(); };
    if ($('inspectorPageNumbers')) $('inspectorPageNumbers').onchange = function () { headerFooter.pageNumbers = this.checked; applyHeaderFooter(); };
    if ($('inspectorHeaderHeight')) $('inspectorHeaderHeight').onchange = function () { headerFooter.headerHeight = parseInt(this.value) || 36; applyHeaderFooter(); };
    if ($('inspectorFooterHeight')) $('inspectorFooterHeight').onchange = function () { headerFooter.footerHeight = parseInt(this.value) || 36; applyHeaderFooter(); };
    if ($('inspectorColumns')) $('inspectorColumns').onchange = function () { editor.style.columnCount = this.value; };
    if ($('inspectorColumnGap')) $('inspectorColumnGap').onchange = function () { editor.style.columnGap = this.value + 'px'; };
  }

  function applyPaperSize(w, h) {
    var paper = $('documentPaper');
    if (!paper) return;
    paper.style.width = w + 'px';
    paper.style.minHeight = h + 'px';
    paper.dataset.paper = currentPaperSize;
    paperSizes[currentPaperSize] = {w:w, h:h};
    // Update width/height inputs
    if ($('inspectorPaperWidth')) $('inspectorPaperWidth').value = w;
    if ($('inspectorPaperHeight')) $('inspectorPaperHeight').value = h;
  }
  function applyMargins() {
    var paper = $('documentPaper');
    if (!paper) return;
    paper.style.setProperty('--margin-top', margins.top + 'px');
    paper.style.setProperty('--margin-right', margins.right + 'px');
    paper.style.setProperty('--margin-bottom', margins.bottom + 'px');
    paper.style.setProperty('--margin-left', margins.left + 'px');
    // Update editor padding
    editor.style.paddingTop = margins.top + 'px';
    editor.style.paddingRight = margins.right + 'px';
    editor.style.paddingBottom = margins.bottom + 'px';
    editor.style.paddingLeft = margins.left + 'px';
    // Update margin inputs
    if ($('inspectorMarginTop')) $('inspectorMarginTop').value = margins.top;
    if ($('inspectorMarginRight')) $('inspectorMarginRight').value = margins.right;
    if ($('inspectorMarginBottom')) $('inspectorMarginBottom').value = margins.bottom;
    if ($('inspectorMarginLeft')) $('inspectorMarginLeft').value = margins.left;
  }
  function applyHeaderFooter() {
    var paper = $('documentPaper');
    if (!paper) return;
    // Header
    var header = paper.querySelector('.page-header') || document.createElement('div');
    header.className = 'page-header';
    if (headerFooter.header) {
      header.style.display = 'block';
      header.style.top = 'calc(var(--margin-top, 72px) - ' + headerFooter.headerHeight + 'px)';
      header.style.height = headerFooter.headerHeight + 'px';
    } else { header.style.display = 'none'; }
    // Footer
    var footer = paper.querySelector('.page-footer') || document.createElement('div');
    footer.className = 'page-footer';
    if (headerFooter.footer) {
      footer.style.display = 'block';
      footer.style.bottom = 'calc(var(--margin-bottom, 72px) - ' + headerFooter.footerHeight + 'px)';
      footer.style.height = headerFooter.footerHeight + 'px';
    } else { footer.style.display = 'none'; }
    // Page numbers
    var pnum = paper.querySelector('.page-number') || document.createElement('div');
    pnum.className = 'page-number';
    pnum.style.display = headerFooter.pageNumbers ? 'block' : 'none';
    // Ensure elements are in DOM
    if (!paper.contains(header)) paper.insertBefore(header, paper.firstChild);
    if (!paper.contains(footer)) paper.appendChild(footer);
    if (!paper.contains(pnum)) paper.appendChild(pnum);
    // Update inputs
    if ($('inspectorHeader')) $('inspectorHeader').checked = headerFooter.header;
    if ($('inspectorFooter')) $('inspectorFooter').checked = headerFooter.footer;
    if ($('inspectorPageNumbers')) $('inspectorPageNumbers').checked = headerFooter.pageNumbers;
    if ($('inspectorHeaderHeight')) $('inspectorHeaderHeight').value = headerFooter.headerHeight;
    if ($('inspectorFooterHeight')) $('inspectorFooterHeight').value = headerFooter.footerHeight;
  }

  // Page Break
  function insertPageBreak() {
    pushUndo();
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var pb = document.createElement('div');
    pb.className = 'page-break';
    pb.setAttribute('data-page-break', 'true');
    range.insertNode(pb);
    range.setStartAfter(pb);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    changed();
    updateThumbnails();
  }

  // Thumbnails Sidebar
  function toggleThumbnails() {
    thumbnailsOpen = !thumbnailsOpen;
    document.body.classList.toggle('thumbnails-open', thumbnailsOpen);
    $('thumbnailsBtn').setAttribute('aria-pressed', thumbnailsOpen);
    if (thumbnailsOpen) {
      updateThumbnails();
      closeInspector();
      closeToc();
    }
  }
  function closeThumbnails() {
    thumbnailsOpen = false;
    document.body.classList.remove('thumbnails-open');
    $('thumbnailsBtn').setAttribute('aria-pressed', 'false');
  }
  function updateThumbnails() {
    var container = $('pageThumbnails');
    if (!container) return;
    // For now, render a single page thumbnail representing the document
    // In a full implementation, we'd split content by page breaks and render each
    var html = '';
    var paper = $('documentPaper');
    if (paper) {
      // Use canvas to render thumbnail
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var scale = 0.3;
      canvas.width = paper.offsetWidth * scale;
      canvas.height = paper.offsetHeight * scale;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw a simplified representation
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
      html = '<div class="page-thumbnail active" title="Page 1"><canvas></canvas><span class="page-number-badge">1</span></div>';
    }
    container.innerHTML = html;
    // Actually draw on canvas
    setTimeout(function() {
      var c = container.querySelector('canvas');
      if (c) {
        var ctx2 = c.getContext('2d');
        var p = $('documentPaper');
        if (p) {
          // Draw background
          ctx2.fillStyle = '#fff';
          ctx2.fillRect(0, 0, c.width, c.height);
          // Draw page border
          ctx2.strokeStyle = '#ddd';
          ctx2.lineWidth = 1;
          ctx2.strokeRect(2, 2, c.width - 4, c.height - 4);
        }
      }
    }, 0);
  }

  // Table of Contents Sidebar
  function toggleToc() {
    tocOpen = !tocOpen;
    document.body.classList.toggle('toc-open', tocOpen);
    $('tocBtn').setAttribute('aria-pressed', tocOpen);
    if (tocOpen) {
      updateToc();
      closeInspector();
      closeThumbnails();
    }
  }
  function closeToc() {
    tocOpen = false;
    document.body.classList.remove('toc-open');
    $('tocBtn').setAttribute('aria-pressed', 'false');
  }
  function updateToc() {
    var list = $('tocList');
    if (!list) return;
    var headings = editor.querySelectorAll('h1, h2, h3');
    var html = '';
    headings.forEach(function (h, i) {
      var level = h.tagName.toLowerCase();
      var text = h.textContent.trim();
      if (!text) return;
      var id = 'toc-' + i;
      h.id = id;
      html += '<a class="toc-item toc-' + level + '" href="#' + id + '">' + escapeHtml(text) + '</a>';
    });
    list.innerHTML = html || '<div style="padding:16px;color:var(--muted);text-align:center;">No headings</div>';
    // Make links work
    list.querySelectorAll('a').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        var target = document.getElementById(this.getAttribute('href').slice(1));
        if (target) target.scrollIntoView({behavior:'smooth'});
      };
    });
  }

  // Event handlers for new toolbar buttons
  if ($('pageBreakBtn')) $('pageBreakBtn').onclick = insertPageBreak;
  if ($('inspectorBtn')) $('inspectorBtn').onclick = toggleInspector;
  if ($('closeInspector')) $('closeInspector').onclick = closeInspector;
  document.querySelectorAll('.inspector-tab').forEach(function (btn) {
    btn.onclick = function () { switchInspectorTab(btn.dataset.inspector); };
  });
  if ($('thumbnailsBtn')) $('thumbnailsBtn').onclick = toggleThumbnails;
  if ($('closeThumbnails')) $('closeThumbnails').onclick = closeThumbnails;
  if ($('tocBtn')) $('tocBtn').onclick = toggleToc;
  if ($('closeToc')) $('closeToc').onclick = closeToc;

  // Initialize inspector layout settings
  applyLayoutSettings();
  applyPaperSize(paperSizes[currentPaperSize].w, paperSizes[currentPaperSize].h);
  applyMargins();
  applyHeaderFooter();

  // Keyboard shortcuts for page break
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      insertPageBreak();
    }
  });

  // Escape key closes all sidebars
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      hideOrders(); closeMenu(); closeContextMenu();
      if ($('newDocDialog').open) closeNewDocDialog();
      if ($('templateDialog').open) closeTemplates();
      if (inspectorOpen) closeInspector();
      if (thumbnailsOpen) closeThumbnails();
      if (tocOpen) closeToc();
    }
  });

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
    history.replaceState(null, '', '/');
    if (tmpl) openNewDocDialog(tmpl.id); else openNewDocDialog('blank');
  }

  window.__werketTest = { pdfInflate: pdfInflate, pdfExtractText: pdfExtractText, insert: insert, htmlToMarkdown: htmlToMarkdown };
})();

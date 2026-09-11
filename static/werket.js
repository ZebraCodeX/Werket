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
  var families = ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ','ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ','ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ','ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'];
  var roman = ['h','l','H','m','S','r','s','sh','q','b','t','c','x','n','N','a','k','K','w','E','z','Z','y','d','j','g','T','C','P','S','D'];
  var orders = ['e','u','i','a','ie','silent','o'];
  var symbols = ['።','፣','፤','፥','፦','፧','፨','፩','፪','፫','፬','፭','፮','፯','፰','፱','፲','?','!',',','.'];
  var phon = {h:'ሀ',H:'ሐ',l:'ለ',m:'መ',s:'ሰ',r:'ረ',S:'ሠ',b:'በ',t:'ተ',c:'ቸ',C:'ጨ',q:'ቀ',k:'ከ',x:'ኀ',n:'ነ',N:'ኘ',a:'አ',w:'ወ',z:'ዘ',y:'የ',d:'ደ',j:'ጀ',g:'ገ',T:'ጠ',p:'ፐ',f:'ፈ',v:'ቨ',D:'ፀ'};
  var vowels = {e:0,u:1,i:2,a:3,ie:4,ee:4,'':5,o:6};
  var templates = [
    {id:'blank', icon:'□', name:'Blank document', description:'A clean page for notes or free writing.', files:[['Untitled.md','']]},
    {id:'letter', icon:'✉', name:'Letter', description:'Greeting, body, and closing for a formal note.', files:[['letter.md','# Letter\n\nDate: \n\nDear \n\nWrite your message here.\n\nSincerely,\n']]},
    {id:'journal', icon:'◷', name:'Daily journal', description:'A focused page for reflection and daily notes.', files:[['journal.md','# Daily journal\n\n## Today\n\nWhat happened today?\n\n## Reflection\n\nWhat did I learn?\n']]},
    {id:'notes', icon:'✎', name:'Meeting notes', description:'Agenda, notes, and next steps.', files:[['meeting.md','# Meeting notes\n\nDate: \nAttendees: \n\n## Agenda\n\n- \n\n## Notes\n\n\n## Next steps\n\n- \n']]},
    {id:'book', icon:'▤', name:'Book project', description:'Outline, characters, research, and chapter files.', book:true}
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
  function activeFile() { return workspace.files.find(function (f) { return f.id === workspace.activeId; }) || workspace.files[0]; }
  function saveWorkspace() { localStorage.setItem(workspaceKey, JSON.stringify(workspace)); }
  function setStatus(text) { $('saveStatus').textContent = text; }
  function uniqueName(base) {
    var name = base, n = 2, stem = base.replace(/(\.[^.]+)$/, ''), ext = (base.match(/(\.[^.]+)$/) || [''])[0];
    while (workspace.files.some(function (f) { return f.name === name; })) { name = stem + ' ' + n + ext; n++; }
    return name;
  }
  function shouldOfferOnScreenKeyboard() {
    var narrow = window.matchMedia('(max-width: 820px)').matches;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var noHover = window.matchMedia('(hover: none)').matches;
    return narrow || (coarse && noHover);
  }
  function closeMenu() { $('newMenu').hidden = true; $('newBtn').setAttribute('aria-expanded', 'false'); }
  function hideOrders() {
    var pops = document.querySelectorAll('.orders');
    for (var i = 0; i < pops.length; i++) pops[i].remove();
  }
  function isHome() { return !$('homeScreen').hidden; }
  function setActivity(id) {
    document.querySelectorAll('.activity').forEach(function (button) { button.classList.toggle('active', button.id === id); });
  }

  function suppressNativeKeyboard() {
    editor.setAttribute('readonly', 'true');
    editor.setAttribute('inputmode', 'none');
    editor.setAttribute('virtualkeyboardpolicy', 'manual');
    if (navigator.virtualKeyboard && navigator.virtualKeyboard.hide) {
      try { navigator.virtualKeyboard.hide(); } catch (e) {}
    }
  }
  function allowNativeKeyboard() {
    editor.removeAttribute('readonly');
    editor.setAttribute('inputmode', 'text');
    editor.removeAttribute('virtualkeyboardpolicy');
  }
  function syncNativeKeyboard() {
    if (oskOpen && shouldOfferOnScreenKeyboard()) suppressNativeKeyboard();
    else allowNativeKeyboard();
  }
  function rememberCaret() {
    if (document.activeElement !== editor) return;
    caretStart = editor.selectionStart;
    caretEnd = editor.selectionEnd;
  }
  function restoreCaret() {
    try { editor.setSelectionRange(caretStart, caretEnd); } catch (e) {}
  }
  function focusEditor() {
    syncNativeKeyboard();
    editor.focus({preventScroll: true});
    restoreCaret();
  }
  function onTap(el, fn) {
    el.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      fn(event);
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
      editor.blur();
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
    tree.querySelectorAll('[data-file]').forEach(function (button) { button.onclick = function () { openFile(button.dataset.file); }; });
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
  }

  function renderOutline() {
    var items = workspace.files.filter(function (f) { return f.folder === 'chapters' || f.name === 'outline.md' || f.name === 'characters.md'; });
    $('outline').innerHTML = items.length ? items.map(function (f) { return '<button class="outline-item" data-outline="' + f.id + '">◦ ' + escapeHtml(f.name) + '</button>'; }).join('') : '<span class="empty">Create a book project to see its structure.</span>';
    $('outline').querySelectorAll('[data-outline]').forEach(function (b) { b.onclick = function () { openFile(b.dataset.outline); }; });
  }

  function renderHome() {
    $('homeTemplates').innerHTML = templates.map(function (template) {
      return '<button class="home-card" data-template="' + template.id + '"><span class="home-card-preview">' + template.icon + '</span><b>' + escapeHtml(template.name) + '</b><span>' + escapeHtml(template.description) + '</span></button>';
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
    if (!workspace.openIds.length) workspace.openIds = [workspace.activeId];
    render(); saveWorkspace();
  }
  function loadActiveIntoEditor() {
    var f = activeFile();
    if (!f) return;
    applyingHistory = true;
    editor.value = f.text;
    applyingHistory = false;
    editor.style.fontFamily = workspace.font || 'Noto Sans Ethiopic';
    editor.style.fontSize = (workspace.size || 18) + 'px';
    editor.style.textAlign = workspace.align || 'left';
    $('fileStatus').textContent = f.name + ' · UTF-8';
    updateStats(); refreshSuggestions(); checkSpelling();
  }
  function updateStats() {
    var words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
    $('editorStats').textContent = words + ' words · checking dictionary · ' + editor.value.length + ' characters';
  }
  function snapshot() {
    return {id: workspace.activeId, text: editor.value, start: editor.selectionStart, end: editor.selectionEnd};
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
    editor.value = snap.text;
    editor.setSelectionRange(snap.start, snap.end);
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
    f.text = editor.value; f.updated = Date.now(); updateStats(); setStatus('Unsaved changes');
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 550); refreshSuggestions(); checkSpelling();
  }
  function save() { saveWorkspace(); renderTree(); setStatus('Saved locally'); }

  function selectRangeInsert(prefix, suffix) {
    pushUndo();
    var start = editor.selectionStart, end = editor.selectionEnd, value = editor.value;
    editor.value = value.slice(0, start) + prefix + value.slice(start, end) + suffix + value.slice(end);
    editor.setSelectionRange(start + prefix.length, end + prefix.length); changed(); focusEditor();
  }
  function insert(text) {
    pushUndo();
    focusEditor();
    var start = editor.selectionStart, end = editor.selectionEnd, value = editor.value;
    editor.value = value.slice(0, start) + text + value.slice(end);
    var pos = start + text.length;
    caretStart = caretEnd = pos;
    editor.setSelectionRange(pos, pos); changed(); focusEditor();
  }
  function replaceSuggestion(word) {
    pushUndo();
    var cursor = editor.selectionStart, value = editor.value, left = value.slice(0, cursor), match = left.match(/[\u1200-\u135a]+$/), start = match ? cursor - match[0].length : cursor;
    editor.value = value.slice(0, start) + word + ' ' + value.slice(cursor); editor.setSelectionRange(start + word.length + 1, start + word.length + 1); changed(); focusEditor();
  }
  function findInDocument(direction) {
    var query = $('findInput').value;
    if (!query) { $('findCount').textContent = ''; return; }
    var source = editor.value.toLocaleLowerCase(), needle = query.toLocaleLowerCase(), start = editor.selectionEnd;
    var index = direction < 0 ? source.lastIndexOf(needle, Math.max(0, start - 1)) : source.indexOf(needle, start);
    if (index < 0) index = direction < 0 ? source.lastIndexOf(needle) : source.indexOf(needle);
    if (index >= 0) { focusEditor(); editor.setSelectionRange(index, index + query.length); $('findCount').textContent = 'Found'; }
    else $('findCount').textContent = 'Not found';
  }

  function refreshSuggestions() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () {
      fetch('/api/suggest?text=' + encodeURIComponent(editor.value)).then(function (r) { return r.json(); }).then(function (data) {
        var values = (data.words && data.words.length ? data.words : (data.next || [])).slice(0, 6);
        var suggestionMarkup = values.length ? values.map(function (word) { return '<button class="suggestion" data-word="' + escapeHtml(word) + '">' + escapeHtml(word) + '</button>'; }).join('') : '<span class="empty">No dictionary suggestions yet.</span>';
        $('suggestions').innerHTML = suggestionMarkup;
        var keyboardSuggestions = document.getElementById('keyboardSuggestions');
        if (keyboardSuggestions) keyboardSuggestions.innerHTML = suggestionMarkup;
        $('suggestions').querySelectorAll('[data-word]').forEach(function (button) { button.onclick = function () { replaceSuggestion(button.dataset.word); }; });
        if (keyboardSuggestions) keyboardSuggestions.querySelectorAll('[data-word]').forEach(function (button) { button.onclick = function () { replaceSuggestion(button.dataset.word); hideOrders(); }; });
      }).catch(function () { $('suggestions').innerHTML = '<span class="empty">Suggestions unavailable while offline.</span>'; });
    }, 130);
  }
  function checkSpelling() {
    clearTimeout(spellTimer);
    spellTimer = setTimeout(function () {
      fetch('/api/check?text=' + encodeURIComponent(editor.value)).then(function (r) { return r.json(); }).then(function (data) {
        var words = data.words || [], unknown = words.filter(function (word) { return !word.known; }), known = words.length - unknown.length;
        $('editorStats').textContent = words.length + ' words · ' + known + ' dictionary words · ' + editor.value.length + ' characters';
        $('spellBadge').textContent = unknown.length ? unknown.length + ' ISSUES' : 'CLEAN'; $('spellBadge').className = 'badge' + (unknown.length ? ' warn' : '');
        $('spellSummary').textContent = unknown.length ? 'Choose a real dictionary correction below.' : 'Every Amharic word is in the Werket dictionary.';
        $('errors').innerHTML = unknown.slice(0, 8).map(function (item) { var buttons = (item.suggestions || []).slice(0, 3).map(function (s) { return '<button class="fix" data-fix="' + escapeHtml(s.word) + '" data-start="' + item.start + '" data-end="' + item.end + '">' + escapeHtml(s.word) + '</button>'; }).join(''); return '<div class="error-item"><span class="error-word">' + escapeHtml(item.word) + '</span><br>' + (buttons || '<span class="empty">No close match</span>') + '</div>'; }).join('');
        $('errors').querySelectorAll('[data-fix]').forEach(function (button) { button.onclick = function () { pushUndo(); var start = Number(button.dataset.start), end = Number(button.dataset.end); editor.value = editor.value.slice(0, start) + button.dataset.fix + editor.value.slice(end); editor.setSelectionRange(start + button.dataset.fix.length, start + button.dataset.fix.length); changed(); focusEditor(); }; });
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
    var key = event.key, position = editor.selectionStart;
    if (key === 'Tab') { var suggestion = $('suggestions').querySelector('[data-word]'); if (suggestion) { event.preventDefault(); replaceSuggestion(suggestion.dataset.word); return true; } return false; }
    if (position === undefined || editor.selectionEnd !== position) { phoneticBuffer = ''; return false; }
    if (/^[A-Za-z]$/.test(key)) {
      if (position !== phoneticStart + phoneticRendered.length) phoneticBuffer = '';
      if (!phoneticBuffer) { phoneticStart = position; phoneticRendered = ''; pushUndo(); }
      phoneticBuffer += key; var rendered = compose(phoneticBuffer), value = editor.value;
      editor.value = value.slice(0, phoneticStart) + rendered + value.slice(phoneticStart + phoneticRendered.length); phoneticRendered = rendered; editor.setSelectionRange(phoneticStart + rendered.length, phoneticStart + rendered.length); changed(); event.preventDefault(); return true;
    }
    if (key === 'Backspace' && phoneticBuffer) { phoneticBuffer = phoneticBuffer.slice(0, -1); var next = compose(phoneticBuffer), current = editor.value; editor.value = current.slice(0, phoneticStart) + next + current.slice(phoneticStart + phoneticRendered.length); phoneticRendered = next; editor.setSelectionRange(phoneticStart + next.length, phoneticStart + next.length); changed(); event.preventDefault(); return true; }
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
    var host = $('keyboard'), layout = [7, 8, 8, 8], cursor = 0, html = '<div class="keyboard-suggest-row" id="keyboardSuggestions"><span class="empty">Type to see dictionary suggestions</span></div><div class="keyboard-hint">Tap a family for its seven orders · the small label is its phonetic key</div>';
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
      focusEditor();
      var p = editor.selectionStart, q = editor.selectionEnd;
      if (q > p) { editor.value = editor.value.slice(0, p) + editor.value.slice(q); caretStart = caretEnd = p; }
      else if (p > 0) { editor.value = editor.value.slice(0, p - 1) + editor.value.slice(p); caretStart = caretEnd = p - 1; }
      editor.setSelectionRange(caretStart, caretEnd);
      changed(); focusEditor();
    });
  }

  function bookFiles() { return [file('outline.md', '# Book outline\n\n## Premise\n\nWrite the central idea here.\n\n## Structure\n\n- Beginning\n- Middle\n- End\n', ''), file('characters.md', '# Characters\n\n## Main character\n\nName, desire, conflict, and change.\n', ''), file('chapter-01.md', '# Chapter 01\n\nBegin the first scene here.\n', 'chapters'), file('chapter-02.md', '# Chapter 02\n\nContinue the story here.\n', 'chapters'), file('research.md', '# Research notes\n\nKeep references and ideas here.\n', '')]; }
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
    $('templateGrid').innerHTML = templates.map(function (template) { return '<button class="template-card" data-template="' + template.id + '"><b>' + template.icon + ' ' + template.name + '</b><span>' + template.description + '</span></button>'; }).join('');
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
  function toggleExplorer() { $('explorerPanel').classList.toggle('open'); setActivity($('explorerPanel').classList.contains('open') || !shouldOfferOnScreenKeyboard() ? 'filesActivity' : 'homeActivity'); }

  $('projectName').oninput = function () { workspace.projectName = $('projectName').value; $('treeProjectName').textContent = workspace.projectName.toUpperCase(); saveWorkspace(); };
  document.addEventListener('pointerdown', function (event) {
    if (!event.target.closest('.key[data-family]') && !event.target.closest('.orders')) hideOrders();
    if (!event.target.closest('.menu-wrap')) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { hideOrders(); closeMenu(); if ($('templateDialog').open) closeTemplates(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); showHome(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); hideHome(); $('findBar').classList.add('open'); $('findInput').focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); selectRangeInsert('**', '**'); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') { event.preventDefault(); selectRangeInsert('_', '_'); }
  });
  editor.addEventListener('beforeinput', function () { if (!applyingHistory) pushUndo(); });
  editor.addEventListener('input', changed);
  editor.addEventListener('keyup', rememberCaret);
  editor.addEventListener('click', rememberCaret);
  editor.addEventListener('select', rememberCaret);
  document.addEventListener('selectionchange', rememberCaret);
  editor.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); window.print(); }
    else { phoneticKey(event); }
  });
  editor.addEventListener('focus', function () { if (oskOpen) suppressNativeKeyboard(); });
  editor.addEventListener('touchstart', function () { if (oskOpen) suppressNativeKeyboard(); }, {passive: true});

  $('saveBtn').onclick = save;
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
  $('settingsBtn').onclick = function () { $('inspector').classList.toggle('open'); };
  $('closeTemplates').onclick = closeTemplates;
  $('keyboardBtn').onclick = function () { setOsk(!oskOpen); };
  $('closeKeyboard').onclick = function () { setOsk(false); };
  $('toggleInspector').onclick = function () { $('inspector').classList.toggle('open'); };
  $('closeInspector').onclick = function () { $('inspector').classList.remove('open'); };
  $('addOutlineBtn').onclick = createFile;
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
  document.querySelectorAll('[data-prefix]').forEach(function (button) { button.onclick = function () { pushUndo(); var start = editor.selectionStart, value = editor.value, line = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1; editor.value = value.slice(0, line) + button.dataset.prefix + value.slice(line); editor.setSelectionRange(start + button.dataset.prefix.length, start + button.dataset.prefix.length); changed(); focusEditor(); }; });
  document.querySelectorAll('[data-wrap]').forEach(function (button) { button.onclick = function () { selectRangeInsert(button.dataset.wrap, button.dataset.end || ''); }; });
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
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([f.text], {type:'text/plain;charset=utf-8'}));
    link.download = f.name.replace(/\.md$/, '') + '.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  $('brandHome').onclick = showHome;

  window.addEventListener('resize', layoutChrome);
  window.addEventListener('orientationchange', layoutChrome);

  renderKeyboard();
  render();
  layoutChrome();
  var emptyWorkspace = workspace.files.every(function (f) { return !(f.text || '').trim(); });
  if (emptyWorkspace) showHome();
  else hideHome();
  if (shouldOfferOnScreenKeyboard() && localStorage.getItem(oskPrefKey) === '1') setOsk(true);
})();

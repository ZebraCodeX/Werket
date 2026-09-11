(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var editor = $('editor');
  var workspaceKey = 'werket-workspace-v2';
  var saveTimer, suggestTimer, spellTimer;
  var phoneticBuffer = '', phoneticStart = 0, phoneticRendered = '';
  var families = ['ሀ','ለ','ሐ','መ','ሠ','ረ','ሰ','ሸ','ቀ','በ','ተ','ቸ','ኀ','ነ','ኘ','አ','ከ','ኸ','ወ','ዐ','ዘ','ዠ','የ','ደ','ጀ','ገ','ጠ','ጨ','ጰ','ጸ','ፀ'];
  var roman = ['h','l','H','m','S','r','s','sh','q','b','t','c','x','n','N','a','k','K','w','E','z','Z','y','d','j','g','T','C','P','S','D'];
  var orders = ['e','u','i','a','ie','silent','o'];
  var symbols = ['።','፣','፤','፥','፦','፧','፨','፩','፪','፫','፬','፭','፮','፯','፰','፱','፲','?','!',',','.'];
  var phon = {h:'ሀ',H:'ሐ',l:'ለ',m:'መ',s:'ሰ',r:'ረ',S:'ሠ',b:'በ',t:'ተ',c:'ቸ',C:'ጨ',q:'ቀ',k:'ከ',x:'ኀ',n:'ነ',N:'ኘ',a:'አ',w:'ወ',z:'ዘ',y:'የ',d:'ደ',j:'ጀ',g:'ገ',T:'ጠ',p:'ፐ',f:'ፈ',v:'ቨ',D:'ፀ'};
  var vowels = {e:0,u:1,i:2,a:3,ie:4,ee:4,'':5,o:6};
  var templates = [
    {id:'blank', icon:'□', name:'Blank document', description:'A clean page for notes or free writing.', files:[['document.md',''] ]},
    {id:'letter', icon:'✉', name:'Letter', description:'A simple letter with greeting, body, and closing.', files:[['letter.md','# Letter\n\nDate: \n\nDear \n\nWrite your message here.\n\nSincerely,\n']]},
    {id:'journal', icon:'◷', name:'Daily journal', description:'A focused page for reflection and daily notes.', files:[['journal.md','# Daily journal\n\n## Today\n\nWhat happened today?\n\n## Reflection\n\nWhat did I learn?\n']]},
    {id:'book', icon:'▤', name:'Book project', description:'A complete book workspace with outline, characters, and chapter files.', book:true}
  ];

  function safeLoad() { try { return JSON.parse(localStorage.getItem(workspaceKey) || 'null'); } catch (e) { return null; } }
  function newId() { return 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
  function initialWorkspace() { return {projectName:'My documents', activeId:null, openIds:[], font:'Noto Sans Ethiopic', size:18, files:[]}; }
  var workspace = safeLoad() || initialWorkspace();
  if (!Array.isArray(workspace.files)) workspace.files = [];
  if (!workspace.files.length) workspace.files.push(file('Untitled document.md', ''));
  if (!workspace.activeId || !workspace.files.some(function (f) { return f.id === workspace.activeId; })) workspace.activeId = workspace.files[0].id;
  if (!workspace.openIds || !workspace.openIds.length) workspace.openIds = [workspace.activeId];

  function file(name, text, folder) { return {id:newId(), name:name, text:text || '', folder:folder || '', updated:Date.now()}; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function activeFile() { return workspace.files.find(function (f) { return f.id === workspace.activeId; }) || workspace.files[0]; }
  function saveWorkspace() { localStorage.setItem(workspaceKey, JSON.stringify(workspace)); }
  function setStatus(text) { $('saveStatus').textContent = text; }
  function activeText() { return activeFile() ? activeFile().text : ''; }

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

  function render() { renderTree(); renderTabs(); renderOutline(); loadActiveIntoEditor(); }
  function openFile(id) {
    if (!workspace.files.some(function (f) { return f.id === id; })) return;
    workspace.activeId = id;
    if (!workspace.openIds.includes(id)) workspace.openIds.push(id);
    phoneticBuffer = ''; phoneticRendered = '';
    renderTree(); renderTabs(); loadActiveIntoEditor(); saveWorkspace();
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
    editor.value = f.text;
    editor.style.fontFamily = workspace.font || 'Noto Sans Ethiopic';
    editor.style.fontSize = (workspace.size || 18) + 'px';
    $('fileStatus').textContent = f.name + ' · UTF-8';
    updateStats(); refreshSuggestions(); checkSpelling();
  }
  function updateStats() {
    var words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
    $('editorStats').textContent = words + ' words · checking dictionary · ' + editor.value.length + ' characters';
  }
  function changed() {
    var f = activeFile(); if (!f) return;
    f.text = editor.value; f.updated = Date.now(); updateStats(); setStatus('Unsaved changes');
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 550); refreshSuggestions(); checkSpelling();
  }
  function save() { saveWorkspace(); renderTree(); setStatus('Saved locally'); }

  function selectRangeInsert(prefix, suffix) {
    var start = editor.selectionStart, end = editor.selectionEnd, value = editor.value;
    editor.value = value.slice(0, start) + prefix + value.slice(start, end) + suffix + value.slice(end);
    editor.focus(); editor.setSelectionRange(start + prefix.length, end + prefix.length); changed();
  }
  function insert(text) {
    var start = editor.selectionStart, end = editor.selectionEnd, value = editor.value;
    editor.value = value.slice(0, start) + text + value.slice(end);
    editor.focus(); editor.setSelectionRange(start + text.length, start + text.length); changed();
  }
  function replaceSuggestion(word) {
    var cursor = editor.selectionStart, value = editor.value, left = value.slice(0, cursor), match = left.match(/[\u1200-\u135a]+$/), start = match ? cursor - match[0].length : cursor;
    editor.value = value.slice(0, start) + word + ' ' + value.slice(cursor); editor.focus(); editor.setSelectionRange(start + word.length + 1, start + word.length + 1); changed();
  }

  function refreshSuggestions() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(function () {
      fetch('/api/suggest?text=' + encodeURIComponent(editor.value)).then(function (r) { return r.json(); }).then(function (data) {
        var values = (data.words && data.words.length ? data.words : (data.next || [])).slice(0, 6);
        $('suggestions').innerHTML = values.length ? values.map(function (word) { return '<button class="suggestion" data-word="' + escapeHtml(word) + '">' + escapeHtml(word) + '</button>'; }).join('') : '<span class="empty">No dictionary suggestions yet.</span>';
        $('suggestions').querySelectorAll('[data-word]').forEach(function (button) { button.onclick = function () { replaceSuggestion(button.dataset.word); }; });
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
        $('errors').querySelectorAll('[data-fix]').forEach(function (button) { button.onclick = function () { var start = Number(button.dataset.start), end = Number(button.dataset.end); editor.value = editor.value.slice(0, start) + button.dataset.fix + editor.value.slice(end); editor.focus(); editor.setSelectionRange(start + button.dataset.fix.length, start + button.dataset.fix.length); changed(); }; });
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
      if (!phoneticBuffer) { phoneticStart = position; phoneticRendered = ''; }
      phoneticBuffer += key; var rendered = compose(phoneticBuffer), value = editor.value;
      editor.value = value.slice(0, phoneticStart) + rendered + value.slice(phoneticStart + phoneticRendered.length); phoneticRendered = rendered; editor.setSelectionRange(phoneticStart + rendered.length, phoneticStart + rendered.length); changed(); event.preventDefault(); return true;
    }
    if (key === 'Backspace' && phoneticBuffer) { phoneticBuffer = phoneticBuffer.slice(0, -1); var next = compose(phoneticBuffer), current = editor.value; editor.value = current.slice(0, phoneticStart) + next + current.slice(phoneticStart + phoneticRendered.length); phoneticRendered = next; editor.setSelectionRange(phoneticStart + next.length, phoneticStart + next.length); changed(); event.preventDefault(); return true; }
    if (key.length === 1 || key === 'Enter') { phoneticBuffer = ''; phoneticRendered = ''; }
    return false;
  }

  function renderKeyboard() {
    var host = $('keyboard'), layout = [8, 8, 8, 7], cursor = 0, html = '<div class="keyboard-hint">Tap a family for its seven orders · phonetic keys are shown below</div>';
    layout.forEach(function (size) { html += '<div class="keys">'; families.slice(cursor, cursor + size).forEach(function (family, offset) { html += '<button class="key" data-family="' + family + '"><span>' + family + '</span><small>' + roman[cursor + offset] + '</small></button>'; }); html += '</div>'; cursor += size; });
    html += '<div class="keys">' + symbols.slice(0, 9).map(function (symbol) { return '<button class="key fn" data-symbol="' + symbol + '">' + symbol + '</button>'; }).join('') + '<button class="key fn space" data-symbol=" ">SPACE</button><button class="key fn" id="backspaceKey">⌫</button></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-family]').forEach(function (button) { button.onclick = function () { var family = button.dataset.family, pop = document.createElement('div'); pop.className = 'orders'; orders.forEach(function (order, index) { var choice = document.createElement('button'); choice.textContent = String.fromCodePoint(family.codePointAt(0) + index); choice.title = order; choice.onclick = function () { insert(choice.textContent); pop.remove(); }; pop.appendChild(choice); }); button.appendChild(pop); }; });
    host.querySelectorAll('[data-symbol]').forEach(function (button) { button.onclick = function () { insert(button.dataset.symbol); }; });
    $('backspaceKey').onclick = function () { var p = editor.selectionStart; if (p > 0) { editor.value = editor.value.slice(0, p - 1) + editor.value.slice(p); editor.setSelectionRange(p - 1, p - 1); changed(); } };
  }

  function bookFiles() { return [file('outline.md', '# Book outline\n\n## Premise\n\nWrite the central idea here.\n\n## Structure\n\n- Beginning\n- Middle\n- End\n', ''), file('characters.md', '# Characters\n\n## Main character\n\nName, desire, conflict, and change.\n', ''), file('chapter-01.md', '# Chapter 01\n\nBegin the first scene here.\n', 'chapters'), file('chapter-02.md', '# Chapter 02\n\nContinue the story here.\n', 'chapters'), file('research.md', '# Research notes\n\nKeep references and ideas here.\n', '')]; }
  function createTemplate(template) { workspace = initialWorkspace(); workspace.projectName = template.id === 'book' ? 'New book' : template.name; workspace.files = template.book ? bookFiles() : template.files.map(function (item) { return file(item[0], item[1], ''); }); workspace.activeId = workspace.files[0].id; workspace.openIds = [workspace.activeId]; $('templateDialog').close(); saveWorkspace(); render(); setStatus('Template created'); }
  function showTemplates() { var dialog = $('templateDialog'); $('templateGrid').innerHTML = templates.map(function (template) { return '<button class="template-card" data-template="' + template.id + '"><b>' + template.icon + ' ' + template.name + '</b><span>' + template.description + '</span></button>'; }).join(''); $('templateGrid').querySelectorAll('[data-template]').forEach(function (button) { button.onclick = function () { createTemplate(templates.find(function (item) { return item.id === button.dataset.template; })); }; }); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
  function createFile() { var name = window.prompt('File name', 'notes.md'); if (!name) return; var f = file(name, '', ''); workspace.files.push(f); openFile(f.id); save(); }
  function toggleExplorer() { $('explorerPanel').classList.toggle('open'); }

  $('projectName').oninput = function () { workspace.projectName = $('projectName').value; $('treeProjectName').textContent = workspace.projectName.toUpperCase(); saveWorkspace(); };
  $('editor').addEventListener('input', changed);
  $('editor').addEventListener('keydown', function (event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); window.print(); } else { phoneticKey(event); } });
  $('saveBtn').onclick = save; $('newFileBtn').onclick = createFile; $('newDocBtn').onclick = function () { createTemplate(templates[0]); }; $('newProjectBtn').onclick = showTemplates; $('templatesBtn').onclick = showTemplates; $('templatesActivity').onclick = showTemplates; $('filesActivity').onclick = toggleExplorer; $('searchActivity').onclick = function () { editor.focus(); }; $('settingsBtn').onclick = function () { $('inspector').classList.toggle('open'); }; $('closeTemplates').onclick = function () { $('templateDialog').close(); }; $('keyboardBtn').onclick = function () { $('keyboardPanel').classList.toggle('open'); }; $('closeKeyboard').onclick = function () { $('keyboardPanel').classList.remove('open'); }; $('toggleInspector').onclick = function () { $('inspector').classList.toggle('open'); }; $('closeInspector').onclick = function () { $('inspector').classList.remove('open'); }; $('addOutlineBtn').onclick = createFile;
  $('fontFamily').value = workspace.font || 'Noto Sans Ethiopic'; $('fontSize').value = String(workspace.size || 18); $('fontFamily').onchange = function () { workspace.font = $('fontFamily').value; editor.style.fontFamily = workspace.font; save(); }; $('fontSize').onchange = function () { workspace.size = Number($('fontSize').value); editor.style.fontSize = workspace.size + 'px'; save(); };
  document.querySelectorAll('[data-prefix]').forEach(function (button) { button.onclick = function () { var start = editor.selectionStart, value = editor.value; editor.value = value.slice(0, start) + button.dataset.prefix + value.slice(start); editor.setSelectionRange(start + button.dataset.prefix.length, start + button.dataset.prefix.length); changed(); }; }); document.querySelectorAll('[data-wrap]').forEach(function (button) { button.onclick = function () { selectRangeInsert(button.dataset.wrap, button.dataset.end || ''); }; });
  $('importBtn').onclick = function () { $('importFile').click(); }; $('importFile').onchange = function (event) { var selected = event.target.files[0]; if (!selected) return; var reader = new FileReader(); reader.onload = function () { var f = file(selected.name, reader.result, ''); workspace.files.push(f); openFile(f.id); save(); }; reader.readAsText(selected); }; $('exportBtn').onclick = function () { var f = activeFile(); var link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([f.text], {type:'text/plain;charset=utf-8'})); link.download = f.name.replace(/\.md$/, '') + '.txt'; link.click(); URL.revokeObjectURL(link.href); }; $('brandHome').onclick = function () { openFile(workspace.files[0].id); };
  renderKeyboard(); render();
})();

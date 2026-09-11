/* Werket format builders: converts editor HTML into every export format.
   Works in the browser (window.WerketFormats) and in Node (module.exports)
   so the output can be tested without a browser. */
(function (global) {
  'use strict';

  var BLOCK_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, DIV: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1 };

  function decodeEntities(text) {
    return String(text)
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return codePointToString(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return codePointToString(parseInt(d, 10)); })
      .replace(/&nbsp;/g, '\u00a0')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  function codePointToString(code) {
    try { return String.fromCodePoint(code); } catch (e) { return ''; }
  }
  function escapeXml(text) {
    return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function strToBytes(text) {
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }
  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    return strToBytes(unescape(encodeURIComponent(text)));
  }

  /* ---------- HTML parser: editor HTML -> block model ---------- */

  function htmlToBlocks(html) {
    var src = String(html == null ? '' : html);
    var blocks = [], runs = [], bold = 0, italic = 0, strike = 0;
    var listStack = [], blockType = 'p', inQuote = false, checkState = null;
    var tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>|([^<]+)/g;
    var m;
    function pushText(text) {
      if (!text) return;
      runs.push({ text: decodeEntities(text), bold: bold > 0, italic: italic > 0, strike: strike > 0 });
    }
    function stripListPrefix(block) {
      for (var i = 0; i < block.runs.length; i++) {
        var r = block.runs[i];
        if (!r.text) continue;
        r.text = r.text.replace(/^\s*(?:[\u2022\u25cf\u2023\u2043\u2022\u25aa\u2022]|\u2022|\d+[.)])\s+/, '');
        if (r.text) break;
      }
    }
    function flush() {
      while (runs.length && runs[runs.length - 1].br) runs.pop();
      if (!runs.length) return;
      var hasText = false, i;
      for (i = 0; i < runs.length; i++) if (runs[i].text) { hasText = true; break; }
      var block = { type: blockType, runs: runs.slice(), quote: inQuote };
      if (blockType === 'li') block.list = listStack.length ? listStack[listStack.length - 1] : 'bullet';
      if (blockType === 'check') block.checked = checkState === true;
      if (!hasText) { block.runs = []; block.empty = true; }
      else if (block.list) stripListPrefix(block);
      blocks.push(block);
      runs = [];
      checkState = null;
    }
    while ((m = tokenRe.exec(src))) {
      if (m[3] !== undefined) { pushText(m[3]); continue; }
      var tag = m[1].toUpperCase(), closing = m[0][1] === '/', attrs = m[2] || '';
      var cls = (attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[3] || '';
      var dataChecked = /data-checked\s*=\s*("1"|'1'|1)/i.test(attrs);
      if (tag === 'STRONG' || tag === 'B') { bold += closing ? -1 : 1; continue; }
      if (tag === 'EM' || tag === 'I') { italic += closing ? -1 : 1; continue; }
      if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') { strike += closing ? -1 : 1; continue; }
      if (tag === 'BR') { if (!closing) runs.push({ text: '', br: true, bold: bold > 0, italic: italic > 0, strike: strike > 0 }); continue; }
      if (tag === 'SPAN') {
        if (cls.indexOf('check-box') >= 0) checkState = dataChecked || /\bchecked\b/.test(cls);
        continue;
      }
      if (!BLOCK_TAGS[tag]) continue;
      if (closing) {
        if (tag === 'UL' || tag === 'OL') { listStack.pop(); continue; }
        if (tag === 'BLOCKQUOTE') { flush(); inQuote = false; blockType = 'p'; continue; }
        if (tag === 'LI' || tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'DIV') {
          flush(); blockType = 'p'; continue;
        }
        continue;
      }
      if (tag === 'UL') { listStack.push('bullet'); continue; }
      if (tag === 'OL') { listStack.push('number'); continue; }
      if (tag === 'BLOCKQUOTE') { flush(); inQuote = true; blockType = 'p'; continue; }
      flush();
      if (tag === 'LI') blockType = 'li';
      else if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') blockType = 'h' + tag[1];
      else if (tag === 'DIV') {
        if (/\beditor-check\b/.test(cls)) blockType = 'check';
        else if (/\beditor-bullet\b/.test(cls)) { blockType = 'li'; listStack.push('bullet'); }
        else if (/\beditor-number\b/.test(cls)) { blockType = 'li'; listStack.push('number'); }
        else blockType = 'p';
      } else blockType = 'p';
    }
    flush();
    return blocks;
  }

  function blockText(block) {
    var out = '';
    (block.runs || []).forEach(function (run) { out += run.br ? '\n' : run.text; });
    return out;
  }
  function htmlToPlainText(html) {
    var blocks = htmlToBlocks(html), out = [];
    blocks.forEach(function (block, index) {
      var text = blockText(block);
      if (block.type === 'li') text = (block.list === 'number' ? (index + 1) + '. ' : '\u2022 ') + text;
      if (block.type === 'check') text = (block.checked ? '\u2611 ' : '\u2610 ') + text;
      if (block.quote) text = text.split('\n').map(function (line) { return '> ' + line; }).join('\n');
      out.push(text);
    });
    return out.join('\n\n') + (out.length ? '\n' : '');
  }

  /* ---------- Markdown ---------- */

  function inlineRunsToMarkdown(block) {
    var out = '';
    (block.runs || []).forEach(function (run) {
      if (run.br) { out += '\n'; return; }
      var text = run.text;
      if (text) {
        if (run.bold) text = '**' + text + '**';
        if (run.italic) text = '_' + text + '_';
        if (run.strike) text = '~~' + text + '~~';
      }
      out += text;
    });
    return out;
  }
  function htmlToMarkdown(html) {
    var blocks = htmlToBlocks(html), out = [], numbering = 0, prevList = false;
    blocks.forEach(function (block) {
      var isList = block.type === 'li';
      if (!isList) numbering = 0;
      if (isList && block.list === 'number') numbering++;
      else if (!isList) numbering = 0;
      var line;
      if (block.empty) { out.push(''); prevList = false; return; }
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
        line = '#'.repeat(+block.type[1]) + ' ' + inlineRunsToMarkdown(block);
      } else if (block.type === 'li') {
        line = (block.list === 'number' ? numbering + '. ' : '- ') + inlineRunsToMarkdown(block);
      } else if (block.type === 'check') {
        line = '- [' + (block.checked ? 'x' : ' ') + '] ' + inlineRunsToMarkdown(block);
      } else {
        line = inlineRunsToMarkdown(block);
        if (block.quote) line = line.split('\n').map(function (part) { return '> ' + part; }).join('\n');
      }
      out.push(line);
      prevList = isList;
    });
    return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function markdownToHtml(value) {
    var src = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    var chunks = src.split(/\n{2,}/), out = [];
    function inline(text) {
      return escapeXmlInline(text)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<s>$1</s>');
    }
    function escapeXmlInline(text) {
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    chunks.forEach(function (chunk) {
      var lines = chunk.split('\n').filter(function (line) { return line.trim() !== ''; });
      if (!lines.length) return;
      var checkLines = lines.filter(function (line) { return /^[-*]\s+\[[ xX]\]\s+/.test(line); });
      if (checkLines.length === lines.length) {
        lines.forEach(function (line) {
          var checked = /\[[xX]\]/.test(line);
          var text = line.replace(/^[-*]\s+\[[ xX]\]\s+/, '');
          out.push('<div class="editor-check"><span class="check-box' + (checked ? ' checked' : '') + '" data-checked="' + (checked ? '1' : '0') + '"></span>' + inline(text) + '</div>');
        });
        return;
      }
      var bulletLines = lines.filter(function (line) { return /^[-*]\s+/.test(line); });
      if (bulletLines.length === lines.length && lines.length > 0 && /^[-*]\s+/.test(lines[0])) {
        out.push('<ul>' + lines.map(function (line) { return '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>');
        return;
      }
      var numberLines = lines.filter(function (line) { return /^\d+[.)]\s+/.test(line); });
      if (numberLines.length === lines.length && lines.length > 0 && /^\d+[.)]\s+/.test(lines[0])) {
        out.push('<ol>' + lines.map(function (line) { return '<li>' + inline(line.replace(/^\d+[.)]\s+/, '')) + '</li>'; }).join('') + '</ol>');
        return;
      }
      var quoteLines = lines.filter(function (line) { return /^>\s?/.test(line); });
      if (quoteLines.length === lines.length && lines.length > 0 && /^>\s?/.test(lines[0])) {
        out.push('<blockquote>' + lines.map(function (line) { return inline(line.replace(/^>\s?/, '')); }).join('<br>') + '</blockquote>');
        return;
      }
      var heading = lines[0].match(/^(#{1,3})\s+(.*)$/);
      if (heading && lines.length === 1) {
        out.push('<h' + heading[1].length + '>' + inline(heading[2]) + '</h' + heading[1].length + '>');
        return;
      }
      out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
    });
    return out.join('');
  }

  /* ---------- ZIP (stored) ---------- */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTime(date) {
    var d = date instanceof Date ? date : new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    var day = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time & 0xffff, date: day & 0xffff };
  }
  function buildZip(entries, when) {
    var stamp = dosTime(when);
    var out = [], central = [], offset = 0, i;
    function u16(v) { return [v & 0xff, (v >> 8) & 0xff]; }
    function u32(v) { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }
    function concat(arrays) {
      var total = 0, k;
      for (k = 0; k < arrays.length; k++) total += arrays[k].length;
      var result = new Uint8Array(total), pos = 0;
      for (k = 0; k < arrays.length; k++) { result.set(arrays[k], pos); pos += arrays[k].length; }
      return result;
    }
    for (i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var nameBytes = utf8Bytes(entry.name);
      var data = typeof entry.data === 'string' ? utf8Bytes(entry.data) : entry.data;
      var crc = crc32(data);
      var flags = entry.plainName ? 0 : 0x0800;
      var local = concat([
        new Uint8Array(u32(0x04034b50).concat(u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0))),
        nameBytes, data
      ]);
      out.push(local);
      central.push(concat([
        new Uint8Array(u32(0x02014b50).concat(u16(20), u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))),
        nameBytes
      ]));
      offset += local.length;
    }
    var centralBytes = concat(central);
    var end = new Uint8Array(u32(0x06054b50).concat(u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)));
    return concat(out.concat([centralBytes, end]));
  }

  /* ---------- DOCX ---------- */

  function docxRuns(block) {
    var out = '', prefix = '';
    if (block.type === 'check') prefix = block.checked ? '\u2611 ' : '\u2610 ';
    (block.runs || []).forEach(function (run) {
      var props = '';
      if (run.bold) props += '<w:b/>';
      if (run.italic) props += '<w:i/>';
      if (run.strike) props += '<w:strike/>';
      var rpr = props ? '<w:rPr>' + props + '</w:rPr>' : '';
      if (run.br) { out += '<w:r>' + rpr + '<w:br/></w:r>'; return; }
      if (run.text) out += '<w:r>' + rpr + '<w:t xml:space="preserve">' + escapeXml(prefix + run.text) + '</w:t></w:r>', prefix = '';
      else if (prefix) { out += '<w:r><w:t xml:space="preserve">' + escapeXml(prefix) + '</w:t></w:r>'; prefix = ''; }
    });
    if (prefix) out += '<w:r><w:t xml:space="preserve">' + escapeXml(prefix) + '</w:t></w:r>';
    if (!out && block.type !== 'check') out = '<w:r><w:t xml:space="preserve"></w:t></w:r>';
    return out;
  }
  function buildDocx(html, options) {
    options = options || {};
    var blocks = htmlToBlocks(html);
    var body = '';
    blocks.forEach(function (block) {
      var ppr = '', runs = docxRuns(block);
      if (block.type === 'h1') ppr = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>';
      else if (block.type === 'h2') ppr = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>';
      else if (block.type === 'h3') ppr = '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>';
      else if (block.type === 'li') ppr = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + (block.list === 'number' ? 2 : 1) + '"/></w:numPr></w:pPr>';
      else if (block.quote) ppr = '<w:pPr><w:ind w:left="720"/><w:spacing w:after="160"/></w:pPr>';
      else ppr = '<w:pPr><w:spacing w:after="160"/></w:pPr>';
      if (block.quote) runs = runs.replace(/<w:rPr>/g, '<w:rPr><w:i/>').replace(/<w:r>(?!<w:rPr>)/g, '<w:r><w:rPr><w:i/></w:rPr>');
      body += '<w:p>' + ppr + runs + '</w:p>';
    });
    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + body
      + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>'
      + '</w:body></w:document>';
    var stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Noto Sans Ethiopic" w:hAnsi="Noto Sans Ethiopic"/><w:sz w:val="24"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
      + '</w:styles>';
    var numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      + '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
      + '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>'
      + '</w:numbering>';
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '</Types>';
    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '</Relationships>';
    var docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
      + '</Relationships>';
    var now = (options.when instanceof Date ? options.when : new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
    var coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'
      + '<dc:title>' + escapeXml(options.title || '') + '</dc:title>'
      + '<dc:creator>Werket</dc:creator><cp:lastModifiedBy>Werket</cp:lastModifiedBy>'
      + '<dcterms:created xmlns:dcterms="http://purl.org/dc/terms/" xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' + now + '</dcterms:created>'
      + '</cp:coreProperties>';
    return buildZip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: stylesXml },
      { name: 'word/numbering.xml', data: numberingXml },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'docProps/core.xml', data: coreXml }
    ], options.when);
  }

  /* ---------- ODT ---------- */

  function odtSpans(block) {
    var out = '', prefix = '';
    if (block.type === 'check') prefix = block.checked ? '\u2611 ' : '\u2610 ';
    (block.runs || []).forEach(function (run) {
      if (run.br) { out += '<text:line-break/>'; return; }
      var style = run.bold ? 'B' : run.italic ? 'I' : run.strike ? 'S' : '';
      if (run.text) {
        var body = escapeXml(prefix + run.text); prefix = '';
        out += style ? '<text:span text:style-name="' + style + '">' + body + '</text:span>' : body;
      }
    });
    if (prefix) out += escapeXml(prefix);
    return out;
  }
  function buildOdt(html, options) {
    options = options || {};
    var blocks = htmlToBlocks(html), body = '', inList = false, lastList = null;
    function closeList() { if (inList) { body += '</text:list>'; inList = false; } lastList = null; }
    blocks.forEach(function (block) {
      if (block.type === 'li') {
        var kind = block.list === 'number' ? 'number' : 'bullet';
        if (!inList || lastList !== kind) { closeList(); body += '<text:list>'; inList = true; lastList = kind; }
        body += '<text:list-item><text:p>' + odtSpans(block) + '</text:p></text:list-item>';
        return;
      }
      closeList();
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
        body += '<text:h text:outline-level="' + block.type[1] + '">' + odtSpans(block) + '</text:h>';
      } else if (block.quote) {
        body += '<text:p text:style-name="Qu">' + odtSpans(block) + '</text:p>';
      } else if (block.empty) {
        body += '<text:p/>';
      } else {
        body += '<text:p>' + odtSpans(block) + '</text:p>';
      }
    });
    closeList();
    var contentXml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">'
      + '<office:automatic-styles>'
      + '<style:style style:name="B" style:family="text"><style:text-properties fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>'
      + '<style:style style:name="I" style:family="text"><style:text-properties fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/></style:style>'
      + '<style:style style:name="S" style:family="text"><style:text-properties style:text-line-through-style="solid" style:text-line-through-type="single" style:text-line-through-width="auto" style:text-line-through-color="font-color"/></style:style>'
      + '<style:style style:name="Qu" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.75cm" fo:margin-right="0.75cm" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm" fo:border-left="0.15cm solid #b0b0b0" fo:padding-left="0.25cm" fo:padding-right="0.1cm"/><style:text-properties fo:font-style="italic"/></style:style>'
      + '</office:automatic-styles>'
      + '<office:body><office:text>' + body + '</office:text></office:body></office:document-content>';
    var manifestXml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">'
      + '<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
      + '</manifest:manifest>';
    return buildZip([
      { name: 'mimetype', data: 'application/vnd.oasis.opendocument.text', plainName: true },
      { name: 'META-INF/manifest.xml', data: manifestXml },
      { name: 'content.xml', data: contentXml }
    ], options.when);
  }

  /* ---------- RTF ---------- */

  function rtfEscapeText(text) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      var ch = text[i];
      if (ch === '\\' || ch === '{' || ch === '}') { out += '\\' + ch; continue; }
      if (code === 0x00a0) { out += '\\~'; continue; }
      if (code < 128) { out += ch; continue; }
      if (code > 32767) code -= 65536;
      out += '\\u' + code + '?';
    }
    return out;
  }
  function rtfRuns(block) {
    var out = '', state = { bold: false, italic: false, strike: false };
    function setProp(name, value) {
      if (state[name] === value) return;
      out += value ? '\\' + { bold: 'b', italic: 'i', strike: 'strike' }[name] : '\\' + { bold: 'b0', italic: 'i0', strike: 'strike0' }[name];
      state[name] = value;
    }
    (block.runs || []).forEach(function (run) {
      setProp('bold', !!run.bold); setProp('italic', !!run.italic); setProp('strike', !!run.strike);
      if (run.br) { out += '\\line '; return; }
      out += rtfEscapeText(run.text);
    });
    setProp('bold', false); setProp('italic', false); setProp('strike', false);
    return out;
  }
  function buildRtf(html, options) {
    options = options || {};
    var blocks = htmlToBlocks(html), body = '', numbering = 0;
    blocks.forEach(function (block) {
      var para = '', prefix = '';
      if (block.type === 'h1') para = '\\pard\\sa180\\sb280\\s1\\b\\fs48 ';
      else if (block.type === 'h2') para = '\\pard\\sa180\\sb240\\s2\\b\\fs32 ';
      else if (block.type === 'h3') para = '\\pard\\sa180\\sb200\\s3\\b\\fs28 ';
      else if (block.type === 'li') {
        numbering = block.list === 'number' ? numbering + 1 : numbering;
        para = block.list === 'number' ? '\\pard\\sa120\\li720\\fi-360 ' : '\\pard\\sa120\\li720\\fi-360 ';
        prefix = block.list === 'number' ? numbering + '. \\tab ' : '\\u8226?\\tab ';
      } else if (block.quote) {
        para = '\\pard\\sa180\\li720\\ri720\\i ';
      } else {
        para = '\\pard\\sa180 ';
      }
      if (block.type === 'check') prefix = block.checked ? '\\u9745? ' : '\\u9744? ';
      body += para + prefix + rtfRuns(block) + '\\par\n';
      if (block.type !== 'li') numbering = 0;
    });
    var title = String(options.title || '').replace(/[^\x20-\x7e]/g, '').replace(/[\\{}]/g, '');
    var info = title ? '{\\info{\\title ' + title + '}{\\author Werket}}' : '{\\info{\\author Werket}}';
    return '{\\rtf1\\ansi\\deff0\\uc1\\deftab720\n'
      + '{\\fonttbl{\\f0\\fswiss\\fcharset0 Noto Sans Ethiopic;}{\\f1\\fmodern\\fcharset0 Courier New;}}\n'
      + info + '\n'
      + '{\\stylesheet{\\s1\\sb280\\sa180\\b\\fs48 Heading 1;}{\\s2\\sb240\\sa180\\b\\fs32 Heading 2;}{\\s3\\sb200\\sa180\\b\\fs28 Heading 3;}}\n'
      + '\\f0\\fs24\n' + body + '}\n';
  }

  /* ---------- EPUB ---------- */

  function epubContent(blocks) {
    var out = '', inList = false, lastList = null, numbering = 0;
    function closeList() { if (inList) { out += '</ul>'; inList = false; } lastList = null; }
    function runs(block) {
      var body = '';
      (block.runs || []).forEach(function (run) {
        if (run.br) { body += '<br/>'; return; }
        var text = escapeXml(run.text);
        if (run.bold) text = '<strong>' + text + '</strong>';
        if (run.italic) text = '<em>' + text + '</em>';
        if (run.strike) text = '<span class="strike">' + text + '</span>';
        body += text;
      });
      return body;
    }
    blocks.forEach(function (block) {
      if (block.type === 'li') {
        var kind = block.list === 'number' ? 'number' : 'bullet';
        if (!inList || lastList !== kind) {
          closeList();
          out += kind === 'number' ? '<ol>' : '<ul>';
          inList = true; lastList = kind;
        }
        out += '<li>' + runs(block) + '</li>';
        return;
      }
      closeList();
      if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
        out += '<' + block.type + '>' + runs(block) + '</' + block.type + '>';
      } else if (block.type === 'check') {
        out += '<p class="check">' + (block.checked ? '\u2611 ' : '\u2610 ') + runs(block) + '</p>';
      } else if (block.quote) {
        out += '<blockquote>' + runs(block) + '</blockquote>';
      } else if (block.empty) {
        out += '<p><br/></p>';
      } else {
        out += '<p>' + runs(block) + '</p>';
      }
    });
    closeList();
    return out;
  }
  function buildEpub(html, options) {
    options = options || {};
    var blocks = htmlToBlocks(html);
    var title = options.title || 'Document';
    var lang = options.lang || 'am';
    var bookId = options.id || 'urn:uuid:werket-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    var modified = (options.when instanceof Date ? options.when : new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
    var chapter = '<?xml version="1.0" encoding="utf-8"?>'
      + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head>'
      + '<title>' + escapeXml(title) + '</title><meta charset="utf-8"/>'
      + '<link rel="stylesheet" type="text/css" href="style.css"/>'
      + '</head><body id="start"><h1>' + escapeXml(title) + '</h1>' + epubContent(blocks) + '</body></html>';
    var navItems = blocks.map(function (block, index) {
      if (block.type !== 'h1' && block.type !== 'h2') return '';
      return '<li><a href="chapter.xhtml#h' + index + '">' + escapeXml(blockText(block)) + '</a></li>';
    }).filter(Boolean).join('');
    var nav = '<?xml version="1.0" encoding="utf-8"?>'
      + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>'
      + '<body><nav epub:type="toc"><h1>Contents</h1><ol>'
      + '<li><a href="chapter.xhtml#start">' + escapeXml(title) + '</a></li>' + navItems
      + '</ol></nav></body></html>';
    var chaptersWithIds = chapter.replace(/<h1>/g, function () { return '<h1 id="h0">'; });
    var opf = '<?xml version="1.0" encoding="utf-8"?>'
      + '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="' + lang + '">'
      + '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
      + '<dc:identifier id="bookid">' + escapeXml(bookId) + '</dc:identifier>'
      + '<dc:title>' + escapeXml(title) + '</dc:title>'
      + '<dc:creator>Werket</dc:creator>'
      + '<dc:language>' + escapeXml(lang) + '</dc:language>'
      + '<meta property="dcterms:modified">' + modified + '</meta>'
      + '</metadata>'
      + '<manifest>'
      + '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
      + '<item id="css" href="style.css" media-type="text/css"/>'
      + '<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>'
      + '</manifest>'
      + '<spine><itemref idref="chapter"/></spine>'
      + '</package>';
    var css = 'body{font-family:"Noto Sans Ethiopic",serif;line-height:1.6;margin:5%;color:#111}'
      + 'h1{font-size:1.8em}h2{font-size:1.4em;margin-top:1.2em}'
      + 'blockquote{border-left:4px solid #b0b0b0;margin:1em 0;padding:.2em 1em;color:#444;font-style:italic}'
      + '.strike{text-decoration:line-through}.check{margin:.3em 0}';
    var container = '<?xml version="1.0" encoding="utf-8"?>'
      + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
      + '<rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
    return buildZip([
      { name: 'mimetype', data: 'application/epub+zip', plainName: true },
      { name: 'META-INF/container.xml', data: container },
      { name: 'EPUB/content.opf', data: opf },
      { name: 'EPUB/nav.xhtml', data: nav },
      { name: 'EPUB/chapter.xhtml', data: chaptersWithIds },
      { name: 'EPUB/style.css', data: css }
    ], options.when);
  }

  /* ---------- PDF (JPEG pages) ---------- */

  function parseJpegSize(bytes) {
    var i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      var marker = bytes[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break;
      var length = (bytes[i + 2] << 8) | bytes[i + 3];
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + length;
    }
    return null;
  }
  function pdfEscapeString(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function buildPdf(pages, options) {
    options = options || {};
    var pageWidth = options.pageWidth || 595.28, pageHeight = options.pageHeight || 841.89;
    if (!pages.length) pages = [{ jpeg: new Uint8Array(0), width: pageWidth, height: pageHeight }];
    var chunks = [], lengths = [];
    function push(text) {
      var bytes = strToBytes(text);
      chunks.push(bytes); lengths.push(bytes.length);
    }
    function pushRaw(bytes) { chunks.push(bytes); lengths.push(bytes.length); }
    function totalSoFar() { var t = 0; for (var i = 0; i < lengths.length; i++) t += lengths[i]; return t; }
    var objectCount = 2 + pages.length * 3 + 1;
    var infoId = objectCount;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var offsets = new Array(objectCount + 1);
    offsets[1] = totalSoFar();
    push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offsets[2] = totalSoFar();
    var kids = [];
    for (var p = 0; p < pages.length; p++) kids.push((3 + p * 3) + ' 0 R');
    push('2 0 obj\n<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>\nendobj\n');
    for (p = 0; p < pages.length; p++) {
      var pageId = 3 + p * 3, contentId = pageId + 1, imageId = pageId + 2;
      offsets[pageId] = totalSoFar();
      push(pageId + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth.toFixed(2) + ' ' + pageHeight.toFixed(2) + '] '
        + '/Resources << /XObject << /Im' + p + ' ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>\nendobj\n');
      offsets[contentId] = totalSoFar();
      var stream = 'q\n' + pageWidth.toFixed(2) + ' 0 0 ' + pageHeight.toFixed(2) + ' 0 0 cm\n/Im' + p + ' Do\nQ\n';
      push(contentId + ' 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream\nendobj\n');
      offsets[imageId] = totalSoFar();
      var jpeg = pages[p].jpeg;
      push(imageId + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + Math.round(pages[p].width)
        + ' /Height ' + Math.round(pages[p].height) + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
      pushRaw(jpeg);
      push('\nendstream\nendobj\n');
    }
    offsets[infoId] = totalSoFar();
    push(infoId + ' 0 obj\n<< /Producer (Werket ' + pdfEscapeString(options.producer || '') + ') /Title (' + pdfEscapeString(options.title || '') + ') >>\nendobj\n');
    var xrefOffset = totalSoFar();
    var xref = 'xref\n0 ' + (objectCount + 1) + '\n0000000000 65535 f \n';
    for (var o = 1; o <= objectCount; o++) {
      xref += ('0000000000' + offsets[o]).slice(-10) + ' 00000 n \n';
    }
    push(xref);
    push('trailer\n<< /Size ' + (objectCount + 1) + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');
    var total = 0;
    for (var k = 0; k < lengths.length; k++) total += lengths[k];
    var result = new Uint8Array(total), pos = 0;
    for (k = 0; k < chunks.length; k++) { result.set(chunks[k], pos); pos += chunks[k].length; }
    return result;
  }

  var WerketFormats = {
    htmlToBlocks: htmlToBlocks,
    blockText: blockText,
    htmlToPlainText: htmlToPlainText,
    htmlToMarkdown: htmlToMarkdown,
    markdownToHtml: markdownToHtml,
    buildZip: buildZip,
    crc32: crc32,
    buildDocx: buildDocx,
    buildOdt: buildOdt,
    buildRtf: buildRtf,
    buildEpub: buildEpub,
    buildPdf: buildPdf,
    parseJpegSize: parseJpegSize,
    escapeXml: escapeXml,
    decodeEntities: decodeEntities
  };
  global.WerketFormats = WerketFormats;
  if (typeof module !== 'undefined' && module.exports) module.exports = WerketFormats;
})(typeof window !== 'undefined' ? window : this);

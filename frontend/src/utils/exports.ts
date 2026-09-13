import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ExportOptions {
  title?: string;
  lang?: string;
  when?: Date;
  paperSize?: 'a4' | 'letter' | 'legal' | 'a5' | 'a3';
  margins?: { top: number; right: number; bottom: number; left: number };
}

interface BlockRun {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  br?: boolean;
}

interface Block {
  type: string;
  runs: BlockRun[];
  quote: boolean;
  empty?: boolean;
  list?: string;
  checked?: boolean;
}

function decodeEntities(text: string): string {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_m: string, h: string) => codePointToString(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m: string, d: string) => codePointToString(parseInt(d, 10)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function codePointToString(code: number): string {
  try { return String.fromCodePoint(code); } catch { return ''; }
}

function escapeXml(text: string): string {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function utf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/* ---------- HTML parser: editor HTML -> block model ---------- */

function htmlToBlocks(html: string): Block[] {
  const src = String(html == null ? '' : html);
  const blocks: Block[] = [];
  let runs: BlockRun[] = [];
  let bold = 0, italic = 0, strike = 0;
  const listStack: string[] = [];
  let blockType = 'p';
  let inQuote = false;
  let checkState: boolean | null = null;

  const BLOCK_TAGS: Record<string, boolean> = { P: true, H1: true, H2: true, H3: true, H4: true, DIV: true, UL: true, OL: true, LI: true, BLOCKQUOTE: true, TABLE: true, TR: true, TD: true, TH: true, TBODY: true, THEAD: true };

  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>|([^<]+)/g;
  let m: RegExpExecArray | null;

  function pushText(text: string) {
    if (!text) return;
    runs.push({ text: decodeEntities(text), bold: bold > 0, italic: italic > 0, strike: strike > 0 });
  }

  function flush() {
    while (runs.length && runs[runs.length - 1].br) runs.pop();
    if (!runs.length) return;
    let hasText = false;
    for (let i = 0; i < runs.length; i++) if (runs[i].text) { hasText = true; break; }
    const block: Block = { type: blockType, runs: runs.slice(), quote: inQuote };
    if (blockType === 'li') block.list = listStack.length ? listStack[listStack.length - 1] : 'bullet';
    if (blockType === 'check') block.checked = checkState === true;
    if (!hasText) { block.runs = []; block.empty = true; }
    blocks.push(block);
    runs = [];
    checkState = null;
  }

  while ((m = tokenRe.exec(src))) {
    if (m[3] !== undefined) { pushText(m[3]); continue; }
    const tag = m[1].toUpperCase();
    const closing = m[0][1] === '/';
    const attrs = m[2] || '';
    const cls = (attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[3] || '';
    const dataChecked = /data-checked\s*=\s*("1"|'1'|1)/i.test(attrs);

    if (tag === 'STRONG' || tag === 'B') { bold += closing ? -1 : 1; continue; }
    if (tag === 'EM' || tag === 'I') { italic += closing ? -1 : 1; continue; }
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') { strike += closing ? -1 : 1; continue; }
    if (tag === 'BR') { if (!closing) runs.push({ text: '', br: true, bold: bold > 0, italic: italic > 0, strike: strike > 0 }); continue; }
    if (tag === 'IMG') {
      const srcMatch = attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i);
      const src = srcMatch ? (srcMatch[2] || srcMatch[3]) : '';
      if (src) pushText(`[Image: ${src}]`);
      continue;
    }
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
      if (tag === 'TABLE' || tag === 'TR' || tag === 'TD' || tag === 'TH' || tag === 'TBODY' || tag === 'THEAD') { flush(); continue; }
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
    } else if (tag === 'TD' || tag === 'TH') {
      blockType = 'p';
    } else blockType = 'p';
  }
  flush();
  return blocks;
}

function blockText(block: Block): string {
  let out = '';
  (block.runs || []).forEach((run: BlockRun) => { out += run.br ? '\n' : run.text; });
  return out;
}

export function htmlToPlainText(html: string): string {
  const blocks = htmlToBlocks(html);
  const out: string[] = [];
  blocks.forEach((block, index) => {
    let text = blockText(block);
    if (block.type === 'li') text = (block.list === 'number' ? (index + 1) + '. ' : '\u2022 ') + text;
    if (block.type === 'check') text = (block.checked ? '\u2611 ' : '\u2610 ') + text;
    if (block.quote) text = text.split('\n').map((line: string) => '> ' + line).join('\n');
    out.push(text);
  });
  return out.join('\n\n') + (out.length ? '\n' : '');
}

/* ---------- Markdown ---------- */

function inlineRunsToMarkdown(block: Block): string {
  let out = '';
  (block.runs || []).forEach((run: BlockRun) => {
    if (run.br) { out += '\n'; return; }
    let text = run.text;
    if (text) {
      if (run.bold) text = '**' + text + '**';
      if (run.italic) text = '_' + text + '_';
      if (run.strike) text = '~~' + text + '~~';
    }
    out += text;
  });
  return out;
}

export function htmlToMarkdown(html: string): string {
  const blocks = htmlToBlocks(html);
  const out: string[] = [];
  let numbering = 0;
  blocks.forEach((block) => {
    const isList = block.type === 'li';
    if (isList && block.list === 'number') numbering++;
    else if (!isList) numbering = 0;
    let line: string;
    if (block.empty) { out.push(''); return; }
    if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
      line = '#'.repeat(+block.type[1]) + ' ' + inlineRunsToMarkdown(block);
    } else if (block.type === 'li') {
      line = (block.list === 'number' ? numbering + '. ' : '- ') + inlineRunsToMarkdown(block);
    } else if (block.type === 'check') {
      line = '- [' + (block.checked ? 'x' : ' ') + '] ' + inlineRunsToMarkdown(block);
    } else {
      line = inlineRunsToMarkdown(block);
      if (block.quote) line = line.split('\n').map((part) => '> ' + part).join('\n');
    }
    out.push(line);
  });
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------- HTML document ---------- */

export function htmlToHtml(html: string, options: { title?: string } = {}): string {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<title>' + escapeXml(options.title || 'Document') + '</title>'
    + '<style>body{font-family:"Noto Sans Ethiopic","Abyssinica SIL",serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6;color:#1d1d1f}'
    + 'h1,h2,h3{margin-top:1.5em}blockquote{border-left:4px solid #ccc;margin:1em 0;padding:.25em 1em;color:#555}'
    + 'table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}'
    + '@media print{body{padding:0}}</style></head><body>' + html + '</body></html>';
}

/* ---------- download ---------- */

export function downloadBlob(data: string | Uint8Array, filename: string, mime: string) {
  let blob: Blob;
  if (data instanceof Uint8Array) {
    const ab = new ArrayBuffer(data.length);
    new Uint8Array(ab).set(data);
    blob = new Blob([ab], { type: mime });
  } else {
    blob = new Blob([data], { type: mime });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- ZIP (stored) ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosTime(date: Date): { time: number; date: number } {
  const d = date instanceof Date ? date : new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const day = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

function u16(v: number): number[] { return [v & 0xff, (v >> 8) & 0xff]; }
function u32(v: number): number[] { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }

function concatArrays(arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { result.set(a, pos); pos += a.length; }
  return result;
}

interface ZipEntry {
  name: string;
  data: string | Uint8Array;
  plainName?: boolean;
}

function buildZip(entries: ZipEntry[], when: Date = new Date()): Uint8Array {
  const stamp = dosTime(when);
  const out: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.name);
    const data = typeof entry.data === 'string' ? utf8Bytes(entry.data) : entry.data;
    const crcVal = crc32(data);
    const flags = entry.plainName ? 0 : 0x0800;

    const localHeader = concatArrays([
      new Uint8Array(u32(0x04034b50).concat(u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crcVal), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0))),
      nameBytes,
      data,
    ]);

    out.push(localHeader);

    const centralHeader = concatArrays([
      new Uint8Array(u32(0x02014b50).concat(u16(20), u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crcVal), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))),
      nameBytes,
    ]);

    central.push(centralHeader);
    offset += localHeader.length;
  }

  const centralBytes = concatArrays(central);
  const endRecord = new Uint8Array(u32(0x06054b50).concat(u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)));

  return concatArrays(out.concat([centralBytes, endRecord]));
}

/* ---------- DOCX ---------- */

function docxRuns(block: Block): string {
  let out = '', prefix = '';
  if (block.type === 'check') prefix = block.checked ? '\u2611 ' : '\u2610 ';
  (block.runs || []).forEach((run: BlockRun) => {
    let props = '';
    if (run.bold) props += '<w:b/>';
    if (run.italic) props += '<w:i/>';
    if (run.strike) props += '<w:strike/>';
    const rpr = props ? '<w:rPr>' + props + '</w:rPr>' : '';
    if (run.br) { out += '<w:r>' + rpr + '<w:br/></w:r>'; return; }
    if (run.text) out += '<w:r>' + rpr + '<w:t xml:space="preserve">' + escapeXml(prefix + run.text) + '</w:t></w:r>', prefix = '';
    else if (prefix) { out += '<w:r><w:t xml:space="preserve">' + escapeXml(prefix) + '</w:t></w:r>'; prefix = ''; }
  });
  if (prefix) out += '<w:r><w:t xml:space="preserve">' + escapeXml(prefix) + '</w:t></w:r>';
  if (!out && block.type !== 'check') out = '<w:r><w:t xml:space="preserve"></w:t></w:r>';
  return out;
}

export async function buildDocx(html: string, options: ExportOptions = {}): Promise<Uint8Array> {
  const blocks = htmlToBlocks(html);
  let body = '';
  blocks.forEach((block) => {
    let ppr = '';
    let runs = docxRuns(block);
    if (block.type === 'h1') ppr = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>';
    else if (block.type === 'h2') ppr = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>';
    else if (block.type === 'h3') ppr = '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>';
    else if (block.type === 'li') ppr = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + (block.list === 'number' ? 2 : 1) + '"/></w:numPr></w:pPr>';
    else if (block.quote) ppr = '<w:pPr><w:ind w:left="720"/><w:spacing w:after="160"/></w:pPr>';
    else ppr = '<w:pPr><w:spacing w:after="160"/></w:pPr>';
    if (block.quote) runs = runs.replace(/<w:rPr>/g, '<w:rPr><w:i/>').replace(/<w:r>(?!<w:rPr>)/g, '<w:r><w:rPr><w:i/></w:rPr>');
    body += '<w:p>' + ppr + runs + '</w:p>';
  });

  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    + body
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>'
    + '</w:body></w:document>';

  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Noto Sans Ethiopic" w:hAnsi="Noto Sans Ethiopic"/><w:sz w:val="24"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
    + '</w:styles>';

  const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
    + '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
    + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
    + '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>'
    + '</w:numbering>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    + '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    + '</Relationships>';

  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
    + '</Relationships>';

  const now = (options.when instanceof Date ? options.when : new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
  const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
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

function odtSpans(block: Block): string {
  let out = '', prefix = '';
  if (block.type === 'check') prefix = block.checked ? '\u2611 ' : '\u2610 ';
  (block.runs || []).forEach((run: BlockRun) => {
    if (run.br) { out += '<text:line-break/>'; return; }
    const style = run.bold ? 'B' : run.italic ? 'I' : run.strike ? 'S' : '';
    if (run.text) {
      const body = escapeXml(prefix + run.text); prefix = '';
      out += style ? '<text:span text:style-name="' + style + '">' + body + '</text:span>' : body;
    }
  });
  if (prefix) out += escapeXml(prefix);
  return out;
}

export async function buildOdt(html: string, options: ExportOptions = {}): Promise<Uint8Array> {
  const blocks = htmlToBlocks(html);
  let body = '', inList = false, lastList: string | null = null;
  function closeList() { if (inList) { body += '</text:list>'; inList = false; } lastList = null; }
  blocks.forEach((block) => {
    if (block.type === 'li') {
      const kind = block.list === 'number' ? 'number' : 'bullet';
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

  const contentXml = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">'
    + '<office:automatic-styles>'
    + '<style:style style:name="B" style:family="text"><style:text-properties fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style>'
    + '<style:style style:name="I" style:family="text"><style:text-properties fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/></style:style>'
    + '<style:style style:name="S" style:family="text"><style:text-properties style:text-line-through-style="solid" style:text-line-through-type="single" style:text-line-through-width="auto" style:text-line-through-color="font-color"/></style:style>'
    + '<style:style style:name="Qu" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.75cm" fo:margin-right="0.75cm" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm" fo:border-left="0.15cm solid #b0b0b0" fo:padding-left="0.25cm" fo:padding-right="0.1cm"/><style:text-properties fo:font-style="italic"/></style:style>'
    + '</office:automatic-styles>'
    + '<office:body><office:text>' + body + '</office:text></office:body></office:document-content>';

  const manifestXml = '<?xml version="1.0" encoding="UTF-8"?>'
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

function rtfEscapeText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ch === '\\' || ch === '{' || ch === '}') { out += '\\' + ch; continue; }
    if (code === 0x00a0) { out += '\\~'; continue; }
    if (code < 128) { out += ch; continue; }
    let c = code;
    if (c > 32767) c -= 65536;
    out += '\\' + c + '?';
  }
  return out;
}

function rtfRuns(block: Block): string {
  let out = '';
  const state = { bold: false, italic: false, strike: false };
  function setProp(name: 'bold' | 'italic' | 'strike', value: boolean) {
    if (state[name] === value) return;
    const map: Record<string, string> = { bold: 'b', italic: 'i', strike: 'strike' };
    const off: Record<string, string> = { bold: 'b0', italic: 'i0', strike: 'strike0' };
    out += value ? '\\' + map[name] : '\\' + off[name];
    state[name] = value;
  }
  (block.runs || []).forEach((run: BlockRun) => {
    setProp('bold', !!run.bold); setProp('italic', !!run.italic); setProp('strike', !!run.strike);
    if (run.br) { out += '\\line '; return; }
    out += rtfEscapeText(run.text);
  });
  setProp('bold', false); setProp('italic', false); setProp('strike', false);
  return out;
}

export function buildRtf(html: string, options: ExportOptions = {}): string {
  const blocks = htmlToBlocks(html);
  let body = '', numbering = 0;
  blocks.forEach((block) => {
    let para = '', prefix = '';
    if (block.type === 'h1') para = '\\pard\\sa180\\sb280\\s1\\b\\fs48 ';
    else if (block.type === 'h2') para = '\\pard\\sa180\\sb240\\s2\\b\\fs32 ';
    else if (block.type === 'h3') para = '\\pard\\sa180\\sb200\\s3\\b\\fs28 ';
    else if (block.type === 'li') {
      numbering = block.list === 'number' ? numbering + 1 : numbering;
      para = '\\pard\\sa120\\li720\\fi-360 ';
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
  const title = String(options.title || '').replace(/[^\x20-\x7e]/g, '').replace(/[\\{}]/g, '');
  const info = title ? '{\\info{\\title ' + title + '}{\\author Werket}}' : '{\\info{\\author Werket}}';
  return '{\\rtf1\\ansi\\deff0\\uc1\\deftab720\n'
    + '{\\fonttbl{\\f0\\fswiss\\fcharset0 Noto Sans Ethiopic;}{\\f1\\fmodern\\fcharset0 Courier New;}}\n'
    + info + '\n'
    + '{\\stylesheet{\\s1\\sb280\\sa180\\b\\fs48 Heading 1;}{\\s2\\sb240\\sa180\\b\\fs32 Heading 2;}{\\s3\\sb200\\sa180\\b\\fs28 Heading 3;}}\n'
    + '\\f0\\fs24\n' + body + '}\n';
}

/* ---------- EPUB ---------- */

function epubContent(blocks: Block[]): string {
  let out = '', inList = false, lastList: string | null = null;
  function closeList() { if (inList) { out += '</ul>'; inList = false; } lastList = null; }
  function runs(block: Block): string {
    let body = '';
    (block.runs || []).forEach((run: BlockRun) => {
      if (run.br) { body += '<br/>'; return; }
      let text = escapeXml(run.text);
      if (run.bold) text = '<strong>' + text + '</strong>';
      if (run.italic) text = '<em>' + text + '</em>';
      if (run.strike) text = '<span class="strike">' + text + '</span>';
      body += text;
    });
    return body;
  }
  blocks.forEach((block) => {
    if (block.type === 'li') {
      const kind = block.list === 'number' ? 'number' : 'bullet';
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

export async function buildEpub(html: string, options: ExportOptions = {}): Promise<Uint8Array> {
  const blocks = htmlToBlocks(html);
  const title = options.title || 'Document';
  const lang = options.lang || 'am';
  const bookId = 'urn:uuid:werket-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  const modified = (options.when instanceof Date ? options.when : new Date()).toISOString().replace(/\.\d+Z$/, 'Z');

  const chapter = '<?xml version="1.0" encoding="utf-8"?>'
    + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head>'
    + '<title>' + escapeXml(title) + '</title><meta charset="utf-8"/>'
    + '<link rel="stylesheet" type="text/css" href="style.css"/>'
    + '</head><body id="start"><h1>' + escapeXml(title) + '</h1>' + epubContent(blocks) + '</body></html>';

  const navItems = blocks.map((block, index) => {
    if (block.type !== 'h1' && block.type !== 'h2') return '';
    return '<li><a href="chapter.xhtml#h' + index + '">' + escapeXml(blockText(block)) + '</a></li>';
  }).filter(Boolean).join('');

  const nav = '<?xml version="1.0" encoding="utf-8"?>'
    + '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>'
    + '<body><nav epub:type="toc"><h1>Contents</h1><ol>'
    + '<li><a href="chapter.xhtml#start">' + escapeXml(title) + '</a></li>' + navItems
    + '</ol></nav></body></html>';

  const opf = '<?xml version="1.0" encoding="utf-8"?>'
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

  const css = 'body{font-family:"Noto Sans Ethiopic",serif;line-height:1.6;margin:5%;color:#111}'
    + 'h1{font-size:1.8em}h2{font-size:1.4em;margin-top:1.2em}'
    + 'blockquote{border-left:4px solid #b0b0b0;margin:1em 0;padding:.2em 1em;color:#444;font-style:italic}'
    + '.strike{text-decoration:line-through}.check{margin:.3em 0}';

  const container = '<?xml version="1.0" encoding="utf-8"?>'
    + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
    + '<rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';

  return buildZip([
    { name: 'mimetype', data: 'application/epub+zip', plainName: true },
    { name: 'META-INF/container.xml', data: container },
    { name: 'EPUB/content.opf', data: opf },
    { name: 'EPUB/nav.xhtml', data: nav },
    { name: 'EPUB/chapter.xhtml', data: chapter },
    { name: 'EPUB/style.css', data: css }
  ], options.when);
}

/* ---------- PDF (pdf-lib) ---------- */

export async function buildPdf(html: string, options: ExportOptions = {}): Promise<Uint8Array> {
  const blocks = htmlToBlocks(html);
  if (!blocks.length) throw new Error('Nothing to export');

  const pdfDoc = await PDFDocument.create();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  let ethiopicFont = font;
  let ethiopicBoldFont = boldFont;
  let ethiopicItalicFont = italicFont;
  let ethiopicBoldItalicFont = boldItalicFont;

  try {
    const fontResponse = await fetch('/fonts/NotoSansEthiopic-Regular.ttf');
    if (fontResponse.ok) {
      const fontBytes = await fontResponse.arrayBuffer();
      ethiopicFont = await pdfDoc.embedFont(fontBytes);
      ethiopicBoldFont = ethiopicFont;
      ethiopicItalicFont = ethiopicFont;
      ethiopicBoldItalicFont = ethiopicFont;
    }
  } catch (e) {
    console.warn('Could not load Noto Sans Ethiopic font, using Helvetica:', e);
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const maxW = pageWidth - 2 * margin;
  const defaultSize = 12;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let curY = pageHeight - margin;
  let numbering = 0;

  const isEthiopicText = (text: string): boolean => /[\u1200-\u137F]/.test(text);

  const getFont = (bold: boolean, italic: boolean, ethiopic: boolean) => {
    if (ethiopic) {
      if (bold && italic) return ethiopicBoldItalicFont;
      if (bold) return ethiopicBoldFont;
      if (italic) return ethiopicItalicFont;
      return ethiopicFont;
    }
    if (bold && italic) return boldItalicFont;
    if (bold) return boldFont;
    if (italic) return italicFont;
    return font;
  };

  function drawWrappedText(
    text: string,
    startX: number,
    y: number,
    sz: number,
    bold: boolean,
    italic: boolean,
    align: 'left' | 'center' | 'right',
    ethiopic: boolean
  ): number {
    const f = getFont(bold, italic, ethiopic);
    const lh = sz * 1.4;
    const words = text.split(/\s+/);
    let currentLine = '';
    let cy = y;

    const drawLine = (line: string, lineY: number) => {
      let x = startX;
      if (align === 'center') {
        x = (pageWidth - f.widthOfTextAtSize(line, sz)) / 2;
      } else if (align === 'right') {
        x = pageWidth - margin - f.widthOfTextAtSize(line, sz);
      }
      page.drawText(line, { x, y: lineY, size: sz, font: f, color: rgb(0, 0, 0) });
    };

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const w = f.widthOfTextAtSize(testLine, sz);
      if (w > maxW && currentLine) {
        drawLine(currentLine, cy);
        cy -= lh;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      drawLine(currentLine, cy);
      cy -= lh;
    }
    return cy;
  }

  function addParagraph(
    text: string,
    opts: { bold?: boolean; italic?: boolean; size?: number; align?: 'left' | 'center' | 'right'; ethiopic?: boolean } = {}
  ) {
    const { bold = false, italic = false, size = defaultSize, align = 'left', ethiopic = false } = opts;
    if (curY < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      curY = pageHeight - margin;
    }
    curY = drawWrappedText(text, margin, curY, size, bold, italic, align, ethiopic);
    curY -= 6;
  }

  for (const block of blocks) {
    if (block.empty) { curY -= 20; continue; }

    const isHeading = block.type === 'h1' || block.type === 'h2' || block.type === 'h3';
    const isList = block.type === 'li';
    const isCheck = block.type === 'check';
    const ethiopic = block.runs.some((r) => isEthiopicText(r.text));

    if (curY < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      curY = pageHeight - margin;
    }

    if (isHeading) {
      const level = parseInt(block.type[1]);
      const sz = level === 1 ? 24 : level === 2 ? 20 : 18;
      for (const run of block.runs) {
        if (run.text.trim()) addParagraph(run.text, { bold: true, size: sz, align: 'center', ethiopic });
      }
      curY -= 6;
      continue;
    }

    if (isList) {
      for (const run of block.runs) {
        if (run.text.trim()) {
          const prefix = block.list === 'number' ? `${++numbering}. ` : '\u2022 ';
          addParagraph(prefix + run.text, { bold: run.bold, italic: run.italic, ethiopic });
        }
      }
      curY -= 4;
      continue;
    }

    if (isCheck) {
      for (const run of block.runs) {
        if (run.text.trim()) {
          const prefix = block.checked ? '\u2611 ' : '\u2610 ';
          addParagraph(prefix + run.text, { bold: run.bold, italic: run.italic, ethiopic });
        }
      }
      curY -= 4;
      continue;
    }

    let paragraphText = '';
    for (const run of block.runs) {
      if (run.br) {
        if (paragraphText) { addParagraph(paragraphText, { ethiopic }); paragraphText = ''; }
        curY -= 8;
        continue;
      }
      paragraphText += run.text;
    }
    if (paragraphText) addParagraph(paragraphText, { ethiopic });
  }

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}

/**
 * Format helpers - shared utilities for export formats.
 * Ported from static/formats.js
 */

export function decodeEntities(text: string): string {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => codePointToString(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => codePointToString(parseInt(d, 10)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
    .replace(/&apos;/g, "'").replace(/'/g, "'").replace(/&/g, '&');
}

function codePointToString(code: number): string {
  try { return String.fromCodePoint(code); } catch { return ''; }
}

export function escapeXml(text: string): string {
  return String(text == null ? '' : text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

export function strToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export function utf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  return strToBytes(unescape(encodeURIComponent(text)));
}

/**
 * CRC32 for ZIP
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
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

function u16(v: number): number[] {
  return [v & 0xff, (v >> 8) & 0xff];
}

function u32(v: number): number[] {
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
}

function concat(arrays: Uint8Array[]): Uint8Array {
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

/**
 * Build a ZIP file (stored/deflate not implemented, uses store only)
 */
export function buildZip(entries: ZipEntry[], when: Date = new Date()): Uint8Array {
  const stamp = dosTime(when);
  const out: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.name);
    const data = typeof entry.data === 'string' ? utf8Bytes(entry.data) : entry.data;
    const crc = crc32(data);
    const flags = entry.plainName ? 0 : 0x0800;

    const localHeader = concat([
      new Uint8Array(u32(0x04034b50).concat(u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0))),
      nameBytes,
      data,
    ]);

    out.push(localHeader);

    const centralHeader = concat([
      new Uint8Array(u32(0x02014b50).concat(u16(20), u16(20), u16(flags), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))),
      nameBytes,
    ]);

    central.push(centralHeader);
    offset += localHeader.length;
  }

  const centralBytes = concat(central);
  const endRecord = new Uint8Array(u32(0x06054b50).concat(u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(offset), u16(0)));

  return concat(out.concat([centralBytes, endRecord]));
}

/**
 * Read ZIP file (for imports)
 */
function u16Read(bytes: Uint8Array, at: number): number {
  return ((bytes[at] & 0xff) | ((bytes[at + 1] & 0xff) << 8)) >>> 0;
}

function u32Read(bytes: Uint8Array, at: number): number {
  return u16Read(bytes, at) | (u16Read(bytes, at + 2) << 16);
}

function sliceName(bytes: Uint8Array, at: number, len: number): string {
  const chunk = bytes.subarray(at, at + len);
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  if (decoder) { try { return decoder.decode(chunk); } catch { } }
  let text = '';
  for (let i = 0; i < chunk.length; i++) text += String.fromCharCode(chunk[i]);
  return text;
}

export interface ZipEntryData {
  name: string;
  data: Uint8Array;
  method: number;
  size: number;
}

export function readZip(bytes: Uint8Array): ZipEntryData[] | null {
  const entries: ZipEntryData[] = [];
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = u16Read(bytes, eocd + 10);
  const cdOffset = u32Read(bytes, eocd + 16);
  let pos = cdOffset;

  for (let n = 0; n < count && pos + 46 <= bytes.length; n++) {
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x01 || bytes[pos + 3] !== 0x02) break;
    const method = u16Read(bytes, pos + 10);
    const compSize = u32Read(bytes, pos + 20);
    const uncSize = u32Read(bytes, pos + 24);
    const nameLen = u16Read(bytes, pos + 28);
    const extraLen = u16Read(bytes, pos + 30);
    const commentLen = u16Read(bytes, pos + 32);
    const lho = u32Read(bytes, pos + 42);
    const name = sliceName(bytes, pos + 46, nameLen);

    let data: Uint8Array | null = null;
    if (lho + 30 <= bytes.length) {
      const lhNameLen = u16Read(bytes, lho + 26);
      const lhExtraLen = u16Read(bytes, lho + 28);
      const startData = lho + 30 + lhNameLen + lhExtraLen;
      const raw = bytes.subarray(startData, startData + compSize);
      if (method === 0) data = raw.slice();
      else if (method === 8) data = inflate(bytes, startData);
    }
    if (data != null) entries.push({ name, data, method, size: uncSize });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Inflate (deflate decompression) - simplified
 */
function inflate(data: Uint8Array, start: number): Uint8Array | null {
  // This is a simplified placeholder - in production use pako or similar
  // For now, return the raw data if it's not compressed
  return data.subarray(start);
}

export function bytesToText(bytes: Uint8Array): string {
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  if (decoder) { try { return decoder.decode(bytes); } catch { } }
  let chunk = '', out = '';
  for (let i = 0; i < bytes.length; i++) chunk += String.fromCharCode(bytes[i]);
  return chunk;
}
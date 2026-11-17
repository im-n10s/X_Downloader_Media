/**
 * jszip.js - High-speed, zero-dependency standard PKZIP archive builder.
 * Optimized for browser service workers with STORE compression (0ms CPU overhead for images).
 */

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCrc32(uint8Array) {
  let crc = 0xffffffff;
  const len = uint8Array.length;
  for (let i = 0; i < len; i++) {
    crc = (CRC_TABLE[(crc ^ uint8Array[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class JSZip {
  constructor() {
    this.entries = new Map();
  }

  file(name, content) {
    let uint8;
    if (content instanceof Uint8Array) {
      uint8 = content;
    } else if (content instanceof ArrayBuffer) {
      uint8 = new Uint8Array(content);
    } else if (typeof content === 'string') {
      uint8 = new TextEncoder().encode(content);
    } else if (content && content.buffer instanceof ArrayBuffer) {
      uint8 = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      uint8 = new TextEncoder().encode(String(content || ''));
    }

    this.entries.set(name, uint8);
    return this;
  }

  clear() {
    this.entries.clear();
  }

  get length() {
    return this.entries.size;
  }

  async generateAsync(options = {}, onUpdate = null) {
    const fileEntries = Array.from(this.entries.entries());
    const totalFiles = fileEntries.length;

    const localParts = [];
    const centralParts = [];
    let currentOffset = 0;

    const now = new Date();
    const dosTime =
      ((now.getHours() & 0x1f) << 11) |
      ((now.getMinutes() & 0x3f) << 5) |
      ((now.getSeconds() >> 1) & 0x1f);
    const dosDate =
      (((now.getFullYear() - 1980) & 0x7f) << 9) |
      (((now.getMonth() + 1) & 0x0f) << 5) |
      (now.getDate() & 0x1f);

    const encoder = new TextEncoder();

    for (let i = 0; i < totalFiles; i++) {
      const [filename, dataBytes] = fileEntries[i];
      const filenameBytes = encoder.encode(filename);
      const fileCrc = computeCrc32(dataBytes);
      const dataSize = dataBytes.byteLength;

      // 1. Local File Header (30 bytes)
      const localHeader = new Uint8Array(30);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 flag
      lv.setUint16(8, 0, true);      // Method 0 (STORE)
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, fileCrc, true);
      lv.setUint32(18, dataSize, true);
      lv.setUint32(22, dataSize, true);
      lv.setUint16(26, filenameBytes.length, true);
      lv.setUint16(28, 0, true);

      localParts.push(localHeader, filenameBytes, dataBytes);

      // 2. Central Directory Header (46 bytes)
      const cdHeader = new Uint8Array(46);
      const cv = new DataView(cdHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, fileCrc, true);
      cv.setUint32(20, dataSize, true);
      cv.setUint32(24, dataSize, true);
      cv.setUint16(28, filenameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, currentOffset, true);

      centralParts.push(cdHeader, filenameBytes);

      currentOffset += 30 + filenameBytes.length + dataSize;

      if (onUpdate && (i % 5 === 0 || i === totalFiles - 1)) {
        onUpdate({
          percent: Math.round(((i + 1) / totalFiles) * 100),
          currentFile: filename,
          currentIndex: i + 1,
          total: totalFiles
        });
      }

      if (i % 20 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const centralDirOffset = currentOffset;
    let centralDirSize = 0;
    for (const part of centralParts) {
      centralDirSize += part.byteLength;
    }

    // 3. End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, totalFiles, true);
    ev.setUint16(10, totalFiles, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);

    const totalSize = currentOffset + centralDirSize + 22;
    const finalBuffer = new Uint8Array(totalSize);

    let writeOffset = 0;
    const allParts = [...localParts, ...centralParts, eocd];
    for (const chunk of allParts) {
      finalBuffer.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }

    return finalBuffer;
  }
}

export default JSZip;

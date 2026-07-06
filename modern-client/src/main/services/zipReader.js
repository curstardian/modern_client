const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function findEOCD(buffer) {
  const minEocdSize = 22;
  for (let i = buffer.length - minEocdSize; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('ZIP EOCD 레코드를 찾을 수 없습니다.');
}

function readEntries(fd, fileSize) {
  const tailSize = Math.min(fileSize, 0xffff + 22);
  const tailBuf = Buffer.alloc(tailSize);
  fs.readSync(fd, tailBuf, 0, tailSize, fileSize - tailSize);
  const eocdOffsetInTail = findEOCD(tailBuf);
  const totalEntries = tailBuf.readUInt16LE(eocdOffsetInTail + 10);
  const cenSize = tailBuf.readUInt32LE(eocdOffsetInTail + 12);
  const cenOffset = tailBuf.readUInt32LE(eocdOffsetInTail + 16);

  const cenBuf = Buffer.alloc(cenSize);
  fs.readSync(fd, cenBuf, 0, cenSize, cenOffset);

  const entries = [];
  let p = 0;
  for (let i = 0; i < totalEntries; i++) {
    if (cenBuf.readUInt32LE(p) !== CEN_SIG) throw new Error('잘못된 ZIP central directory 레코드입니다.');
    const method = cenBuf.readUInt16LE(p + 10);
    const compressedSize = cenBuf.readUInt32LE(p + 20);
    const uncompressedSize = cenBuf.readUInt32LE(p + 24);
    const nameLen = cenBuf.readUInt16LE(p + 28);
    const extraLen = cenBuf.readUInt16LE(p + 30);
    const commentLen = cenBuf.readUInt16LE(p + 32);
    const localHeaderOffset = cenBuf.readUInt32LE(p + 42);
    const name = cenBuf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(fd, entry) {
  const headerBuf = Buffer.alloc(30);
  fs.readSync(fd, headerBuf, 0, 30, entry.localHeaderOffset);
  if (headerBuf.readUInt32LE(0) !== LOC_SIG) throw new Error('잘못된 ZIP local file header입니다.');
  const nameLen = headerBuf.readUInt16LE(26);
  const extraLen = headerBuf.readUInt16LE(28);
  const dataStart = entry.localHeaderOffset + 30 + nameLen + extraLen;
  const compressed = Buffer.alloc(entry.compressedSize);
  fs.readSync(fd, compressed, 0, entry.compressedSize, dataStart);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${entry.method}`);
}

function extractZip(zipPath, destDir, { exclude = [] } = {}) {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const entries = readEntries(fd, size);
    for (const entry of entries) {
      if (entry.name.endsWith('/')) continue;
      if (exclude.some((ex) => entry.name.startsWith(ex))) continue;
      const outPath = path.join(destDir, entry.name);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, readEntryData(fd, entry));
    }
  } finally {
    fs.closeSync(fd);
  }
}

function extractNatives(nativeJars, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const native of nativeJars) {
    extractZip(native.jarPath, destDir, { exclude: native.exclude || ['META-INF/'] });
  }
}

function readZipEntry(zipPath, entryName) {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const entries = readEntries(fd, size);
    const entry = entries.find((e) => e.name === entryName);
    if (!entry) return null;
    return readEntryData(fd, entry);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { extractZip, extractNatives, readZipEntry };

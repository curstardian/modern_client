const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { readJson, writeJson } = require('./jsonStore');

function metaFile(versionId) {
  return path.join(paths.versionDir(versionId), 'meta.json');
}

function recordMeta(versionId, meta) {
  writeJson(metaFile(versionId), { loader: 'vanilla', mcVersion: versionId, installedAt: Date.now(), ...meta });
}

function recordMetaIfMissing(versionId, meta) {
  if (!fs.existsSync(metaFile(versionId))) recordMeta(versionId, meta);
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function listInstalled() {
  const root = paths.versionsRoot();
  const ids = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  return ids.map((id) => {
    const meta = readJson(metaFile(id), { loader: 'vanilla', mcVersion: id, installedAt: null });
    let sizeBytes = 0;
    try {
      sizeBytes = dirSize(paths.versionDir(id));
    } catch {
      sizeBytes = 0;
    }
    return { versionId: id, ...meta, sizeBytes };
  }).sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
}

function deleteInstalled(versionId) {
  fs.rmSync(paths.versionDir(versionId), { recursive: true, force: true });
  return { ok: true };
}

module.exports = { recordMeta, recordMetaIfMissing, listInstalled, deleteInstalled };

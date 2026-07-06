const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const paths = require('./paths');
const { readJson, writeJson } = require('./jsonStore');
const downloader = require('./downloader');
const modrinth = require('./modSources/modrinth');
const curseforge = require('./modSources/curseforge');

function sourceClient(source) {
  if (source === 'modrinth') return modrinth;
  if (source === 'curseforge') return curseforge;
  throw new Error(`알 수 없는 리소스팩 소스: ${source}`);
}

function loadPacks(instanceId) {
  return readJson(paths.instanceResourcePacksFile(instanceId), { packs: [] });
}

function savePacks(instanceId, data) {
  writeJson(paths.instanceResourcePacksFile(instanceId), data);
}

function packFilePath(instanceId, fileName, enabled) {
  const dir = paths.instanceResourcePacksDir(instanceId);
  return path.join(dir, enabled ? fileName : `${fileName}.disabled`);
}

function detectUnregisteredPacks(instanceId) {
  const dir = paths.instanceResourcePacksDir(instanceId);
  let files;
  try {
    files = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }
  const data = loadPacks(instanceId);
  const knownFileNames = new Set(data.packs.map((p) => p.fileName));
  const discovered = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const disabled = entry.name.endsWith('.disabled');
    const baseName = disabled ? entry.name.slice(0, -'.disabled'.length) : entry.name;
    if (!baseName.toLowerCase().endsWith('.zip')) continue;
    if (knownFileNames.has(baseName)) continue;
    discovered.push({
      id: randomUUID(),
      source: 'local',
      projectId: `local:${baseName}`,
      versionId: null,
      fileName: baseName,
      sha1: null,
      size: null,
      enabled: !disabled,
      detected: true,
      installedAt: Date.now(),
    });
    knownFileNames.add(baseName);
  }
  if (discovered.length) {
    data.packs.push(...discovered);
    savePacks(instanceId, data);
  }
  return discovered;
}

function listPacks(instanceId) {
  detectUnregisteredPacks(instanceId);
  const data = loadPacks(instanceId);
  return data.packs.map((pack) => {
    const enabled = pack.enabled !== false;
    return { ...pack, enabled, present: fs.existsSync(packFilePath(instanceId, pack.fileName, enabled)) };
  });
}

async function search({ source, query, mcVersion }) {
  const client = sourceClient(source);
  if (source === 'modrinth') return client.search({ query, mcVersion, projectType: 'resourcepack' });
  return client.search({ query, mcVersion, classId: curseforge.CLASS_ID_RESOURCE_PACKS });
}

async function installPack(instanceId, ref, { mcVersion } = {}) {
  const client = sourceClient(ref.source);
  const projectId = ref.modId;

  const data = loadPacks(instanceId);
  const existing = data.packs.find((p) => p.projectId === projectId && p.source === ref.source);
  if (existing) return { installed: null, alreadyInstalled: true };

  const file = ref.source === 'modrinth'
    ? await client.resolveInstallFile(projectId, { versionId: ref.versionId, mcVersion })
    : await client.resolveInstallFile(projectId, {
      versionId: ref.versionId, mcVersion, urlCategory: 'texture-packs',
    });

  if (file.distributionBlocked) {
    return { installed: null, blocked: { modId: projectId, source: ref.source, fileName: file.fileName, webUrl: file.webUrl } };
  }

  const dest = path.join(paths.instanceResourcePacksDir(instanceId), file.fileName);
  await downloader.downloadOne({
    dest, url: file.url, sha1: file.sha1, size: file.size, name: file.fileName,
  });

  const entry = {
    id: randomUUID(),
    source: ref.source,
    projectId,
    versionId: file.versionId,
    fileName: file.fileName,
    sha1: file.sha1,
    size: file.size,
    enabled: true,
    installedAt: Date.now(),
  };
  const fresh = loadPacks(instanceId);
  fresh.packs.push(entry);
  savePacks(instanceId, fresh);

  return { installed: entry };
}

function setEnabled(instanceId, packId, enabled) {
  const data = loadPacks(instanceId);
  const entry = data.packs.find((p) => p.id === packId);
  if (!entry) throw new Error('존재하지 않는 리소스팩입니다.');
  const dir = paths.instanceResourcePacksDir(instanceId);
  const wasEnabled = entry.enabled !== false;
  const from = path.join(dir, wasEnabled ? entry.fileName : `${entry.fileName}.disabled`);
  const to = path.join(dir, enabled ? entry.fileName : `${entry.fileName}.disabled`);
  if (fs.existsSync(from) && from !== to) fs.renameSync(from, to);
  entry.enabled = enabled;
  savePacks(instanceId, data);
  return { ok: true };
}

function removePack(instanceId, packId) {
  const data = loadPacks(instanceId);
  const entry = data.packs.find((p) => p.id === packId);
  if (!entry) throw new Error('존재하지 않는 리소스팩입니다.');
  const dir = paths.instanceResourcePacksDir(instanceId);
  [entry.fileName, `${entry.fileName}.disabled`].forEach((name) => {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  });
  data.packs = data.packs.filter((p) => p.id !== packId);
  savePacks(instanceId, data);
  return { ok: true };
}

function getPacksFolder(instanceId) {
  return paths.instanceResourcePacksDir(instanceId);
}

module.exports = {
  listPacks, search, installPack, setEnabled, removePack, getPacksFolder,
};

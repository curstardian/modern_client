const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { dialog } = require('electron');
const paths = require('./paths');
const { readJson, writeJson } = require('./jsonStore');
const downloader = require('./downloader');
const modrinth = require('./modSources/modrinth');
const curseforge = require('./modSources/curseforge');
const modMetadata = require('./modMetadata');
const versionRange = require('./versionRange');

const MAX_AUTO_RESOLVE_CANDIDATES = 5;

function sourceClient(source) {
  if (source === 'modrinth') return modrinth;
  if (source === 'curseforge') return curseforge;
  throw new Error(`알 수 없는 모드 소스: ${source}`);
}

function loadMods(instanceId) {
  return readJson(paths.instanceModsFile(instanceId), { mods: [] });
}

function saveMods(instanceId, data) {
  writeJson(paths.instanceModsFile(instanceId), data);
}

function modFilePath(instanceId, fileName, enabled) {
  const dir = paths.instanceModsDir(instanceId);
  return path.join(dir, enabled ? fileName : `${fileName}.disabled`);
}

function detectUnregisteredMods(instanceId) {
  const dir = paths.instanceModsDir(instanceId);
  let files;
  try {
    files = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }
  const data = loadMods(instanceId);
  const knownFileNames = new Set(data.mods.map((m) => m.fileName));
  const discovered = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const disabled = entry.name.endsWith('.disabled');
    const baseName = disabled ? entry.name.slice(0, -'.disabled'.length) : entry.name;
    if (!baseName.toLowerCase().endsWith('.jar')) continue;
    if (knownFileNames.has(baseName)) continue;
    discovered.push({
      id: randomUUID(),
      source: 'local',
      projectId: `local:${baseName}`,
      versionId: null,
      fileName: baseName,
      sha1: null,
      size: null,
      mcVersions: [],
      loaders: [],
      validatedAgainst: {},
      dependencies: [],
      essential: false,
      enabled: !disabled,
      detected: true,
      installedAt: Date.now(),
    });
    knownFileNames.add(baseName);
  }
  if (discovered.length) {
    data.mods.push(...discovered);
    saveMods(instanceId, data);
  }
  return discovered;
}

function listMods(instanceId) {
  detectUnregisteredMods(instanceId);
  const data = loadMods(instanceId);
  return data.mods.map((mod) => {
    const enabled = mod.enabled !== false;
    const filePath = modFilePath(instanceId, mod.fileName, enabled);
    return { ...mod, enabled, present: fs.existsSync(filePath) };
  });
}

async function installMod(instanceId, ref, {
  mcVersion, loader, essential = false, visited = new Set(),
} = {}) {
  const projectId = ref.modId;
  if (visited.has(projectId)) return { installed: [], blocked: [] };
  visited.add(projectId);

  const data = loadMods(instanceId);
  const existing = data.mods.find((m) => m.projectId === projectId && m.source === ref.source);
  if (existing) return { installed: [], blocked: [], alreadyInstalled: true };

  const client = sourceClient(ref.source);
  const file = await client.resolveInstallFile(projectId, { versionId: ref.versionId, mcVersion, loader });

  if (file.distributionBlocked) {
    return {
      installed: [],
      blocked: [{
        modId: projectId, source: ref.source, fileName: file.fileName, webUrl: file.webUrl,
      }],
    };
  }
  if (mcVersion && file.mcVersions.length && !file.mcVersions.includes(mcVersion)) {
    throw new Error(`이 모드는 ${mcVersion} 버전을 지원하지 않습니다.`);
  }
  if (loader && file.loaders.length && !file.loaders.includes(loader)) {
    throw new Error(`이 모드는 ${loader} 로더를 지원하지 않습니다.`);
  }

  const dest = path.join(paths.instanceModsDir(instanceId), file.fileName);
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
    mcVersions: file.mcVersions,
    loaders: file.loaders,
    validatedAgainst: { mcVersion: mcVersion || null, loaderVersion: loader || null },
    dependencies: file.dependencies,
    essential,
    enabled: true,
    installedAt: Date.now(),
  };
  const fresh = loadMods(instanceId);
  fresh.mods.push(entry);
  saveMods(instanceId, fresh);

  const installed = [entry];
  const blocked = [];
  for (const dep of file.dependencies) {
    if (dep.type !== 'required') continue;
    const alreadyThere = loadMods(instanceId).mods.some((m) => m.projectId === dep.projectId);
    if (alreadyThere) continue;
    try {
      const result = await installMod(
        instanceId,
        { source: dep.source, modId: dep.projectId, versionId: dep.versionId },
        { mcVersion, loader, visited },
      );
      installed.push(...(result.installed || []));
      blocked.push(...(result.blocked || []));
    } catch (err) {
      blocked.push({ modId: dep.projectId, source: dep.source, error: err.message });
    }
  }

  return { installed, blocked };
}

function safeReadModMetadata(jarPath) {
  try {
    return modMetadata.readModMetadata(jarPath);
  } catch (err) {
    return null;
  }
}

function applyLocalMeta(entry, meta) {
  if (!meta) return;
  entry.fabricModId = meta.modId || null;
  entry.modVersion = meta.version || null;
  entry.metaLoader = meta.loader || null;
  entry.mcVersionRange = meta.mcVersionRange || null;
  entry.depends = meta.depends || {};
  entry.breaks = meta.breaks || {};
  if (meta.name) entry.displayName = meta.name;
}

function installLocalFile(instanceId, sourceFilePath, { essential = false } = {}) {
  const fileName = path.basename(sourceFilePath);
  const dest = path.join(paths.instanceModsDir(instanceId), fileName);
  fs.copyFileSync(sourceFilePath, dest);
  const meta = safeReadModMetadata(dest);

  const data = loadMods(instanceId);
  const existing = data.mods.find((m) => m.source === 'local' && m.fileName === fileName);
  if (existing) {
    existing.essential = essential;
    applyLocalMeta(existing, meta);
    saveMods(instanceId, data);
    return existing;
  }

  const entry = {
    id: randomUUID(),
    source: 'local',
    projectId: `local:${fileName}`,
    versionId: null,
    fileName,
    sha1: null,
    size: null,
    mcVersions: [],
    loaders: [],
    validatedAgainst: {},
    dependencies: [],
    essential,
    enabled: true,
    installedAt: Date.now(),
  };
  applyLocalMeta(entry, meta);
  data.mods.push(entry);
  saveMods(instanceId, data);
  return entry;
}

function checkVersionCompatibility(versionMeta, entry) {
  if (!versionMeta || !entry.mcVersionRange) return { ok: true };
  const ok = versionRange.satisfiesRange(versionMeta.mcVersion, entry.mcVersionRange);
  return { ok, mcVersion: versionMeta.mcVersion };
}

function installLocalFilesWithCheck(instanceId, filePaths, versionMeta) {
  const imported = [];
  const incompatible = [];
  for (const filePath of filePaths) {
    const entry = installLocalFile(instanceId, filePath);
    imported.push(entry);
    const check = checkVersionCompatibility(versionMeta, entry);
    if (!check.ok) {
      incompatible.push({ modId: entry.id, fileName: entry.fileName, mcVersion: check.mcVersion });
    }
  }
  return { imported, incompatible };
}

async function importFromSystemMods(instanceId, win, versionMeta) {
  const defaultPath = path.join(paths.systemMinecraftDir(), 'mods');
  const result = await dialog.showOpenDialog(win, {
    title: '.minecraft/mods에서 모드 가져오기',
    defaultPath: fs.existsSync(defaultPath) ? defaultPath : paths.systemMinecraftDir(),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Jar', extensions: ['jar'] }],
  });
  if (result.canceled || !result.filePaths.length) return { imported: [], incompatible: [] };
  return installLocalFilesWithCheck(instanceId, result.filePaths, versionMeta);
}

async function uploadLocalMods(instanceId, win, versionMeta) {
  const result = await dialog.showOpenDialog(win, {
    title: '모드 파일 업로드',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Jar', extensions: ['jar'] }],
  });
  if (result.canceled || !result.filePaths.length) return { imported: [], incompatible: [] };
  return installLocalFilesWithCheck(instanceId, result.filePaths, versionMeta);
}

async function findModrinthProject(fabricModId) {
  try {
    return await modrinth.getProject(fabricModId);
  } catch (err) {
    try {
      const hits = await modrinth.search({ query: fabricModId, limit: 5 });
      const match = hits.find((h) => h.id === fabricModId) || hits[0];
      return match ? await modrinth.getProject(match.id) : null;
    } catch (searchErr) {
      return null;
    }
  }
}

function testCandidateCompatibility(candidateMeta, otherEntries) {
  for (const other of otherEntries) {
    if (!other.fabricModId) continue;
    const dependOnOther = candidateMeta.depends && candidateMeta.depends[other.fabricModId];
    if (dependOnOther && other.modVersion && !versionRange.satisfiesRange(other.modVersion, dependOnOther)) {
      return { ok: false, reason: `${other.fabricModId} ${dependOnOther} 필요` };
    }
    const breaksOther = candidateMeta.breaks && candidateMeta.breaks[other.fabricModId];
    if (breaksOther && other.modVersion && versionRange.satisfiesRange(other.modVersion, breaksOther)) {
      return { ok: false, reason: `${other.fabricModId}와(과) 호환되지 않음` };
    }
    const otherDependsOnCandidate = other.depends && candidateMeta.modId && other.depends[candidateMeta.modId];
    if (otherDependsOnCandidate && candidateMeta.version
      && !versionRange.satisfiesRange(candidateMeta.version, otherDependsOnCandidate)) {
      return { ok: false, reason: `${other.fabricModId}가(이) ${otherDependsOnCandidate} 버전을 필요로 함` };
    }
    const otherBreaksCandidate = other.breaks && candidateMeta.modId && other.breaks[candidateMeta.modId];
    if (otherBreaksCandidate && candidateMeta.version
      && versionRange.satisfiesRange(candidateMeta.version, otherBreaksCandidate)) {
      return { ok: false, reason: `${other.fabricModId}와(과) 호환되지 않음` };
    }
  }
  return { ok: true };
}

async function autoResolveModVersion(instanceId, modId, versionMeta, instanceName) {
  const data = loadMods(instanceId);
  const entry = data.mods.find((m) => m.id === modId);
  if (!entry) throw new Error('존재하지 않는 모드입니다.');
  if (!entry.fabricModId) return { ok: false, reason: 'unknown-project' };

  const project = await findModrinthProject(entry.fabricModId);
  if (!project) return { ok: false, reason: 'not-found' };

  const rawVersions = await modrinth.getVersions(project.id, {
    mcVersion: versionMeta.mcVersion, loader: versionMeta.loader,
  });
  if (!rawVersions.length) return { ok: false, reason: 'no-compatible-version' };
  rawVersions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published));

  const otherEntries = data.mods.filter((m) => m.id !== modId);
  const tempDir = paths.tempInstanceModsDir(instanceName);

  try {
    for (const raw of rawVersions.slice(0, MAX_AUTO_RESOLVE_CANDIDATES)) {
      const file = modrinth.normalizeVersion(project.id, raw);
      if (!file || file.distributionBlocked) continue;

      const tempFile = path.join(tempDir, file.fileName);
      try {
        await downloader.downloadOne({
          dest: tempFile, url: file.url, sha1: file.sha1, size: file.size, name: file.fileName,
        });
      } catch (err) {
        continue;
      }

      const candidateMeta = safeReadModMetadata(tempFile);
      const compat = candidateMeta ? testCandidateCompatibility(candidateMeta, otherEntries) : { ok: true };
      if (!compat.ok) continue;

      const dir = paths.instanceModsDir(instanceId);
      [entry.fileName, `${entry.fileName}.disabled`].forEach((name) => {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      });
      const finalDest = path.join(dir, file.fileName);
      fs.copyFileSync(tempFile, finalDest);

      const fresh = loadMods(instanceId);
      const idx = fresh.mods.findIndex((m) => m.id === modId);
      const newEntry = {
        id: entry.id,
        source: 'modrinth',
        projectId: project.id,
        versionId: file.versionId,
        fileName: file.fileName,
        sha1: file.sha1,
        size: file.size,
        mcVersions: file.mcVersions,
        loaders: file.loaders,
        validatedAgainst: { mcVersion: versionMeta.mcVersion, loaderVersion: versionMeta.loader },
        dependencies: file.dependencies,
        essential: entry.essential,
        enabled: true,
        installedAt: Date.now(),
      };
      applyLocalMeta(newEntry, candidateMeta);
      if (idx >= 0) fresh.mods[idx] = newEntry; else fresh.mods.push(newEntry);
      saveMods(instanceId, fresh);

      return { ok: true, installed: newEntry };
    }
    return { ok: false, reason: 'no-compatible-version' };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function setEnabled(instanceId, modId, enabled) {
  const data = loadMods(instanceId);
  const entry = data.mods.find((m) => m.id === modId);
  if (!entry) throw new Error('존재하지 않는 모드입니다.');
  if (entry.essential && !enabled) throw new Error('이 모드는 Modern Client 실행에 필요해 비활성화할 수 없습니다.');
  const dir = paths.instanceModsDir(instanceId);
  const wasEnabled = entry.enabled !== false;
  const from = path.join(dir, wasEnabled ? entry.fileName : `${entry.fileName}.disabled`);
  const to = path.join(dir, enabled ? entry.fileName : `${entry.fileName}.disabled`);
  if (fs.existsSync(from) && from !== to) fs.renameSync(from, to);
  entry.enabled = enabled;
  saveMods(instanceId, data);
  return { ok: true };
}

function removeMod(instanceId, modId) {
  const data = loadMods(instanceId);
  const entry = data.mods.find((m) => m.id === modId);
  if (!entry) throw new Error('존재하지 않는 모드입니다.');
  if (entry.essential) throw new Error('이 모드는 Modern Client 실행에 필요해 삭제할 수 없습니다.');
  const dir = paths.instanceModsDir(instanceId);
  [entry.fileName, `${entry.fileName}.disabled`].forEach((name) => {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  });
  data.mods = data.mods.filter((m) => m.id !== modId);
  saveMods(instanceId, data);
  return { ok: true };
}

async function verifyOnDisk(instanceId) {
  const data = loadMods(instanceId);
  const results = [];
  for (const mod of data.mods) {
    const enabled = mod.enabled !== false;
    const filePath = modFilePath(instanceId, mod.fileName, enabled);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (err) {
      results.push({
        modId: mod.id, fileName: mod.fileName, ok: false, reason: 'missing',
      });
      continue;
    }
    if (mod.size != null && stat.size !== mod.size) {
      results.push({
        modId: mod.id, fileName: mod.fileName, ok: false, reason: 'modified',
      });
      continue;
    }
    results.push({ modId: mod.id, fileName: mod.fileName, ok: true });
  }
  return results;
}

function getModsFolder(instanceId) {
  return paths.instanceModsDir(instanceId);
}

module.exports = {
  listMods,
  installMod,
  installLocalFile,
  importFromSystemMods,
  uploadLocalMods,
  autoResolveModVersion,
  setEnabled,
  removeMod,
  verifyOnDisk,
  getModsFolder,
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const paths = require('./paths');
const { readJson, writeJson } = require('./jsonStore');
const downloader = require('./downloader');
const modrinth = require('./modSources/modrinth');
const curseforge = require('./modSources/curseforge');

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

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function listMods(instanceId) {
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
    throw new Error(`이 모드는 마인크래프트 ${mcVersion} 버전을 지원하지 않습니다.`);
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
    if (!fs.existsSync(filePath)) {
      results.push({
        modId: mod.id, fileName: mod.fileName, ok: false, reason: 'missing',
      });
      continue;
    }
    if (mod.sha1) {
      const actual = await sha1File(filePath);
      if (actual !== mod.sha1) {
        results.push({
          modId: mod.id, fileName: mod.fileName, ok: false, reason: 'modified',
        });
        continue;
      }
    }
    results.push({ modId: mod.id, fileName: mod.fileName, ok: true });
  }
  return results;
}

module.exports = {
  listMods, installMod, setEnabled, removeMod, verifyOnDisk,
};

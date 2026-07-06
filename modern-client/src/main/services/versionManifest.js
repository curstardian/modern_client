const { readJson, writeJson } = require('./jsonStore');
const { manifestCacheFile } = require('./paths');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

async function fetchManifest({ refresh = false } = {}) {
  if (!refresh) {
    const cached = readJson(manifestCacheFile(), null);
    if (cached) return cached;
  }
  const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`버전 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  writeJson(manifestCacheFile(), data);
  return data;
}

async function list({ refresh = false } = {}) {
  const manifest = await fetchManifest({ refresh });
  return {
    latest: manifest.latest,
    versions: manifest.versions.map((v) => ({
      id: v.id,
      type: v.type,
      url: v.url,
      releaseTime: v.releaseTime,
      sha1: v.sha1,
    })),
  };
}

async function findVersionEntry(versionId, { refresh = false } = {}) {
  const manifest = await fetchManifest({ refresh });
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`버전을 찾을 수 없습니다: ${versionId}`);
  return entry;
}

module.exports = { list, findVersionEntry };

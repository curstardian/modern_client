const { writeJson } = require('./jsonStore');
const paths = require('./paths');
const versionsLibrary = require('./versionsLibrary');

const META_BASE = 'https://meta.fabricmc.net/v2';

async function listLoaderVersions(mcVersion) {
  const url = `${META_BASE}/versions/loader/${encodeURIComponent(mcVersion)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Fabric 로더 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  return data.map((entry) => ({ loaderVersion: entry.loader.version, stable: !!entry.loader.stable }));
}

async function installFabric(mcVersion, loaderVersion) {
  const url = `${META_BASE}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Fabric 프로필을 불러오지 못했습니다 (HTTP ${res.status})`);
  const profile = await res.json();
  const versionId = profile.id;
  writeJson(paths.versionJsonFile(versionId), profile);
  versionsLibrary.recordMeta(versionId, { loader: 'fabric', mcVersion, loaderVersion });
  return { versionId };
}

module.exports = { listLoaderVersions, installFabric };

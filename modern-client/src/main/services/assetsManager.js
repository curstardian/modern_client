const { readJson, writeJson } = require('./jsonStore');
const paths = require('./paths');
const downloader = require('./downloader');

async function fetchAssetIndex(versionJson) {
  const assetIndex = versionJson.assetIndex;
  if (!assetIndex) throw new Error('버전 정보에 asset index가 없습니다.');
  const indexFile = paths.assetIndexFile(assetIndex.id);
  const cached = readJson(indexFile, null);
  if (cached) return { id: assetIndex.id, data: cached };
  const res = await fetch(assetIndex.url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`asset index를 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  writeJson(indexFile, data);
  return { id: assetIndex.id, data };
}

async function downloadAssets(versionJson, { onProgress } = {}) {
  const { data } = await fetchAssetIndex(versionJson);
  const tasks = Object.entries(data.objects || {}).map(([name, obj]) => ({
    name,
    dest: paths.assetObjectFile(obj.hash),
    sha1: obj.hash,
    size: obj.size,
    url: `https://resources.download.minecraft.net/${obj.hash.slice(0, 2)}/${obj.hash}`,
  }));
  await downloader.downloadAll(tasks, { concurrency: 8, onProgress });
  return data;
}

module.exports = { fetchAssetIndex, downloadAssets };

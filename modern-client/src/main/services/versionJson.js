const { readJson, writeJson } = require('./jsonStore');
const paths = require('./paths');
const versionManifest = require('./versionManifest');

async function getVersionJson(versionId, { refresh = false } = {}) {
  const file = paths.versionJsonFile(versionId);
  if (!refresh) {
    const cached = readJson(file, null);
    if (cached) return cached;
  }
  const entry = await versionManifest.findVersionEntry(versionId, { refresh });
  const res = await fetch(entry.url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`버전 정보를 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  writeJson(file, data);
  return data;
}

function isLegacyAssets(versionJson) {
  const id = versionJson.assetIndex?.id || versionJson.assets;
  return id === 'legacy' || id === 'pre-1.6';
}

function isModernArguments(versionJson) {
  return Array.isArray(versionJson.arguments?.game);
}

function normalizeArguments(versionJson) {
  if (versionJson.arguments) {
    return {
      game: versionJson.arguments.game || [],
      jvm: versionJson.arguments.jvm || [],
    };
  }
  if (typeof versionJson.minecraftArguments === 'string') {
    return { game: versionJson.minecraftArguments.split(/\s+/), jvm: [] };
  }
  return { game: [], jvm: [] };
}

function libraryKey(name) {
  const parts = String(name).split(':');
  const classifier = parts[3] || '';
  return `${parts[0]}:${parts[1]}:${classifier}`;
}

function dedupeLibraries(libraries) {
  const seen = new Set();
  const result = [];
  for (const lib of libraries) {
    const key = libraryKey(lib.name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(lib);
  }
  return result;
}

function mergeVersionJson(child, parent) {
  const parentArgs = normalizeArguments(parent);
  const childArgs = normalizeArguments(child);
  return {
    ...parent,
    ...child,
    libraries: dedupeLibraries([...(child.libraries || []), ...(parent.libraries || [])]),
    arguments: {
      game: [...parentArgs.game, ...childArgs.game],
      jvm: [...parentArgs.jvm, ...childArgs.jvm],
    },
    minecraftArguments: undefined,
  };
}

async function getEffectiveVersionJson(versionId, opts = {}) {
  const child = await getVersionJson(versionId, opts);
  if (!child.inheritsFrom) return child;
  const parent = await getEffectiveVersionJson(child.inheritsFrom, opts);
  return mergeVersionJson(child, parent);
}

module.exports = {
  getVersionJson, getEffectiveVersionJson, isLegacyAssets, isModernArguments,
};

const config = require('../config');

const BASE = 'https://api.curseforge.com/v1';
const GAME_ID = 432;
const CLASS_ID_MODS = 6;
const CLASS_ID_RESOURCE_PACKS = 12;
const LOADER_ENUM = {
  forge: 1, fabric: 4, quilt: 5, neoforge: 6,
};
const LOADER_NAMES = new Set(Object.keys(LOADER_ENUM).map((n) => n.toLowerCase()).concat(['cauldron', 'liteloader']));

function headers() {
  const key = config.getCurseForgeApiKey();
  if (!key) {
    throw new Error('CurseForge API 키가 설정되지 않았습니다. config/curseforge.json에 curseforgeApiKey를 입력해주세요.');
  }
  return { 'x-api-key': key, Accept: 'application/json' };
}

function normalizeRelationType(relationType) {
  switch (relationType) {
    case 3: return 'required';
    case 5: return 'incompatible';
    case 1:
    case 6: return 'embedded';
    default: return 'optional';
  }
}

function normalizeFile(modId, file, modSlug, urlCategory = 'mc-mods') {
  const sha1Entry = (file.hashes || []).find((h) => h.algo === 1);
  const gameVersions = file.gameVersions || [];
  return {
    modId: String(modId),
    source: 'curseforge',
    versionId: String(file.id),
    fileName: file.fileName,
    url: file.downloadUrl || null,
    distributionBlocked: !file.downloadUrl,
    webUrl: modSlug ? `https://www.curseforge.com/minecraft/${urlCategory}/${modSlug}` : null,
    sha1: sha1Entry?.value || null,
    size: file.fileLength || null,
    mcVersions: gameVersions.filter((v) => /^\d/.test(v)),
    loaders: gameVersions.filter((v) => LOADER_NAMES.has(v.toLowerCase())).map((v) => v.toLowerCase()),
    dependencies: (file.dependencies || []).map((d) => ({
      projectId: String(d.modId),
      versionId: null,
      source: 'curseforge',
      type: normalizeRelationType(d.relationType),
    })),
  };
}

async function search({
  query = '', mcVersion, loader, index = 0, pageSize = 20, classId = CLASS_ID_MODS,
} = {}) {
  const params = new URLSearchParams({
    gameId: String(GAME_ID), classId: String(classId), searchFilter: query, index: String(index), pageSize: String(pageSize),
  });
  if (mcVersion) params.set('gameVersion', mcVersion);
  if (loader && LOADER_ENUM[loader]) params.set('modLoaderType', String(LOADER_ENUM[loader]));
  const res = await fetch(`${BASE}/mods/search?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`CurseForge 검색 실패 (HTTP ${res.status})`);
  const data = await res.json();
  return (data.data || []).map((mod) => ({
    id: String(mod.id),
    source: 'curseforge',
    name: mod.name,
    summary: mod.summary,
    iconUrl: mod.logo?.thumbnailUrl || null,
    downloads: mod.downloadCount,
    author: mod.authors?.[0]?.name || '',
    slug: mod.slug,
  }));
}

async function getMod(modId) {
  const res = await fetch(`${BASE}/mods/${modId}`, { headers: headers() });
  if (!res.ok) throw new Error(`CurseForge 모드를 찾을 수 없습니다 (HTTP ${res.status})`);
  const data = await res.json();
  return data.data;
}

async function getFiles(modId, { mcVersion, loader } = {}) {
  const params = new URLSearchParams();
  if (mcVersion) params.set('gameVersion', mcVersion);
  if (loader && LOADER_ENUM[loader]) params.set('modLoaderType', String(LOADER_ENUM[loader]));
  const query = params.toString();
  const res = await fetch(`${BASE}/mods/${modId}/files${query ? `?${query}` : ''}`, { headers: headers() });
  if (!res.ok) throw new Error(`CurseForge 파일 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
  const data = await res.json();
  return data.data || [];
}

async function resolveInstallFile(modId, {
  versionId, mcVersion, loader, urlCategory = 'mc-mods',
} = {}) {
  const mod = await getMod(modId).catch(() => null);
  const slug = mod?.slug;
  if (versionId) {
    const res = await fetch(`${BASE}/mods/${modId}/files/${versionId}`, { headers: headers() });
    if (!res.ok) throw new Error(`CurseForge 파일 정보를 불러오지 못했습니다 (HTTP ${res.status})`);
    const data = await res.json();
    return normalizeFile(modId, data.data, slug, urlCategory);
  }
  const files = await getFiles(modId, { mcVersion, loader });
  if (!files.length) throw new Error('호환되는 CurseForge 파일을 찾을 수 없습니다.');
  return normalizeFile(modId, files[0], slug, urlCategory);
}

module.exports = {
  search, getMod, getFiles, resolveInstallFile, CLASS_ID_MODS, CLASS_ID_RESOURCE_PACKS,
};

const USER_AGENT = 'modern-client-launcher/1.0.0 (Modern Client Minecraft Launcher)';
const BASE = 'https://api.modrinth.com/v2';

function headers() {
  return { 'User-Agent': USER_AGENT };
}

function normalizeDependencyType(type) {
  if (type === 'required' || type === 'optional' || type === 'incompatible' || type === 'embedded') return type;
  return 'optional';
}

function normalizeVersion(projectId, version) {
  const primaryFile = version.files.find((f) => f.primary) || version.files[0];
  if (!primaryFile) return null;
  return {
    modId: projectId,
    source: 'modrinth',
    versionId: version.id,
    fileName: primaryFile.filename,
    url: primaryFile.url,
    distributionBlocked: false,
    webUrl: null,
    sha1: primaryFile.hashes?.sha1 || null,
    size: primaryFile.size || null,
    mcVersions: version.game_versions || [],
    loaders: version.loaders || [],
    dependencies: (version.dependencies || [])
      .filter((d) => d.project_id)
      .map((d) => ({
        projectId: d.project_id,
        versionId: d.version_id || null,
        source: 'modrinth',
        type: normalizeDependencyType(d.dependency_type),
      })),
  };
}

async function search({
  query = '', mcVersion, loader, limit = 20, offset = 0,
} = {}) {
  const facets = [['project_type:mod']];
  if (loader) facets.push([`categories:${loader}`]);
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  const params = new URLSearchParams({
    query, limit: String(limit), offset: String(offset), facets: JSON.stringify(facets),
  });
  const res = await fetch(`${BASE}/search?${params.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(`Modrinth 검색 실패 (HTTP ${res.status})`);
  const data = await res.json();
  return data.hits.map((hit) => ({
    id: hit.project_id,
    source: 'modrinth',
    name: hit.title,
    summary: hit.description,
    iconUrl: hit.icon_url || null,
    downloads: hit.downloads,
    author: hit.author,
  }));
}

async function getProject(projectId) {
  const res = await fetch(`${BASE}/project/${encodeURIComponent(projectId)}`, { headers: headers() });
  if (!res.ok) throw new Error(`Modrinth 프로젝트를 찾을 수 없습니다 (HTTP ${res.status})`);
  return res.json();
}

async function getVersions(projectId, { mcVersion, loader } = {}) {
  const params = new URLSearchParams();
  if (loader) params.set('loaders', JSON.stringify([loader]));
  if (mcVersion) params.set('game_versions', JSON.stringify([mcVersion]));
  const query = params.toString();
  const url = `${BASE}/project/${encodeURIComponent(projectId)}/version${query ? `?${query}` : ''}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Modrinth 버전 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
  return res.json();
}

async function resolveInstallFile(projectId, { versionId, mcVersion, loader } = {}) {
  if (versionId) {
    const res = await fetch(`${BASE}/version/${encodeURIComponent(versionId)}`, { headers: headers() });
    if (!res.ok) throw new Error(`Modrinth 버전 정보를 불러오지 못했습니다 (HTTP ${res.status})`);
    const version = await res.json();
    return normalizeVersion(projectId, version);
  }
  const versions = await getVersions(projectId, { mcVersion, loader });
  if (!versions.length) throw new Error('호환되는 Modrinth 버전을 찾을 수 없습니다.');
  return normalizeVersion(projectId, versions[0]);
}

module.exports = {
  search, getProject, getVersions, resolveInstallFile,
};

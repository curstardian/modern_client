const modManager = require('./modManager');

function checkDependencies(mods) {
  const problems = [];
  const installedIds = new Set(mods.map((m) => m.projectId));
  for (const mod of mods) {
    for (const dep of mod.dependencies || []) {
      if (dep.type === 'required' && !installedIds.has(dep.projectId)) {
        problems.push({
          modId: mod.id,
          fileName: mod.fileName,
          type: 'missing-dependency',
          message: `${mod.fileName}이(가) 필요로 하는 모드가 설치되어 있지 않습니다.`,
        });
      }
      if (dep.type === 'incompatible' && installedIds.has(dep.projectId)) {
        problems.push({
          modId: mod.id,
          fileName: mod.fileName,
          type: 'incompatible-pair',
          message: `${mod.fileName}은(는) 함께 설치된 다른 모드와 호환되지 않습니다.`,
        });
      }
    }
  }
  return problems;
}

async function preflightCheck(instance, versionMeta) {
  if (!versionMeta || versionMeta.loader === 'vanilla') return { ok: true, problems: [] };

  const mods = modManager.listMods(instance.id);
  const enabledMods = mods.filter((m) => m.enabled);
  const problems = [];

  const diskResults = await modManager.verifyOnDisk(instance.id);
  const diskById = new Map(diskResults.map((r) => [r.modId, r]));

  for (const mod of enabledMods) {
    const disk = diskById.get(mod.id);
    if (disk && !disk.ok) {
      problems.push({
        modId: mod.id,
        fileName: mod.fileName,
        type: disk.reason === 'missing' ? 'missing-file' : 'file-modified',
        message: disk.reason === 'missing'
          ? `${mod.fileName} 파일을 찾을 수 없습니다.`
          : `${mod.fileName} 파일이 설치 당시와 다릅니다 (변조되었을 수 있습니다).`,
      });
    }
    const validated = mod.validatedAgainst || {};
    if (validated.mcVersion && validated.mcVersion !== versionMeta.mcVersion) {
      problems.push({
        modId: mod.id,
        fileName: mod.fileName,
        type: 'version-mismatch',
        message: `${mod.fileName}은(는) ${validated.mcVersion} 기준으로 설치되었지만 현재 인스턴스는 ${versionMeta.mcVersion}입니다.`,
      });
    }
  }

  problems.push(...checkDependencies(enabledMods));

  return { ok: problems.length === 0, problems };
}

module.exports = { preflightCheck };

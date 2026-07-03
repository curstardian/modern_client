const modManager = require('./modManager');

// Modern Client 자체 동반 모드가 완성되면 여기에 항목을 추가한다.
// 예: { source: 'modrinth', projectId: '<완성 후 실제 프로젝트 ID>' }
// 참고: Modrinth 신규 프로젝트는 기본 draft 상태라 완성 직후 바로 조회되지 않는다.
// unlisted 또는 approved로 전환해야 하며, unlisted도 심사 큐를 거치므로 즉시 반영되지 않는다.
const ESSENTIAL_MODS = [];

async function ensureEssentialMods(instance, versionMeta) {
  if (!versionMeta || versionMeta.loader === 'vanilla') return { installed: [] };
  const { mcVersion } = versionMeta;
  const { loader } = versionMeta;
  const installed = [];

  for (const entry of ESSENTIAL_MODS) {
    try {
      const result = await modManager.installMod(
        instance.id,
        { source: entry.source, modId: entry.projectId },
        { mcVersion, loader, essential: true },
      );
      installed.push(...(result.installed || []));
    } catch (err) {
      throw new Error(`필수 모드 설치 실패: ${err.message}`);
    }
  }
  return { installed };
}

module.exports = { ensureEssentialMods, ESSENTIAL_MODS };

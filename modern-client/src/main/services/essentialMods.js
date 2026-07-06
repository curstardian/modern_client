const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const modManager = require('./modManager');

const ESSENTIAL_MODS = [];

function jarsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jar'))
    .map((entry) => path.join(dir, entry.name));
}

function listLocalEssentialModJars(mcVersion, loader) {
  const root = paths.localEssentialModsDir();
  const jars = [...jarsIn(root)];
  if (loader) {
    jars.push(...jarsIn(path.join(root, loader, 'all')));
    if (mcVersion) jars.push(...jarsIn(path.join(root, loader, mcVersion)));
  }
  return jars;
}

async function ensureEssentialMods(instance, versionMeta) {
  if (!versionMeta || versionMeta.loader === 'vanilla') return { installed: [] };
  const { mcVersion } = versionMeta;
  const { loader } = versionMeta;
  const installed = [];

  for (const jarPath of listLocalEssentialModJars(mcVersion, loader)) {
    try {
      const entry = modManager.installLocalFile(instance.id, jarPath, { essential: true });
      installed.push(entry);
    } catch (err) {
      throw new Error(`필수 모드 설치 실패 (${path.basename(jarPath)}): ${err.message}`);
    }
  }

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

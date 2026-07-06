const zipReader = require('./zipReader');

function readFabricMeta(jarPath) {
  const raw = zipReader.readZipEntry(jarPath, 'fabric.mod.json');
  if (!raw) return null;
  let json;
  try {
    json = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    return null;
  }
  const depends = { ...(json.depends || {}) };
  const mcVersionRange = depends.minecraft || null;
  delete depends.minecraft;
  const breaks = { ...(json.breaks || {}), ...(json.conflicts || {}) };
  return {
    loader: 'fabric',
    modId: json.id || null,
    version: json.version || null,
    name: json.name || json.id || null,
    mcVersionRange,
    depends,
    breaks,
  };
}

function readForgeMeta(jarPath) {
  const raw = zipReader.readZipEntry(jarPath, 'META-INF/mods.toml');
  if (!raw) return null;
  const text = raw.toString('utf8');
  const modIdMatch = /^\s*modId\s*=\s*"([^"]+)"/m.exec(text);
  const versionMatch = /^\s*version\s*=\s*"([^"]+)"/m.exec(text);
  const displayNameMatch = /^\s*displayName\s*=\s*"([^"]+)"/m.exec(text);

  const depends = {};
  let mcVersionRange = null;
  const depBlockRegex = /\[\[dependencies\.[^\]]+]]([\s\S]*?)(?=\[\[|$)/g;
  let block;
  while ((block = depBlockRegex.exec(text))) {
    const body = block[1];
    const modIdM = /modId\s*=\s*"([^"]+)"/.exec(body);
    const rangeM = /versionRange\s*=\s*"([^"]+)"/.exec(body);
    if (!modIdM) continue;
    if (modIdM[1] === 'minecraft') {
      mcVersionRange = rangeM ? rangeM[1] : null;
    } else if (rangeM) {
      depends[modIdM[1]] = rangeM[1];
    }
  }

  return {
    loader: 'forge',
    modId: modIdMatch ? modIdMatch[1] : null,
    version: versionMatch ? versionMatch[1] : null,
    name: displayNameMatch ? displayNameMatch[1] : (modIdMatch ? modIdMatch[1] : null),
    mcVersionRange,
    depends,
    breaks: {},
  };
}

function normalizeMavenRange(range) {
  if (!range) return range;
  const match = /^([[(])\s*([^,]*)\s*,\s*([^)\]]*)\s*([)\]])$/.exec(range.trim());
  if (!match) return range;
  const [, openBracket, low, high, closeBracket] = match;
  const clauses = [];
  if (low) clauses.push(`${openBracket === '[' ? '>=' : '>'}${low}`);
  if (high) clauses.push(`${closeBracket === ']' ? '<=' : '<'}${high}`);
  return clauses.join(',') || '*';
}

function readModMetadata(jarPath) {
  const fabric = readFabricMeta(jarPath);
  if (fabric) return fabric;
  const forge = readForgeMeta(jarPath);
  if (forge) {
    forge.mcVersionRange = normalizeMavenRange(forge.mcVersionRange);
    Object.keys(forge.depends).forEach((k) => {
      forge.depends[k] = normalizeMavenRange(forge.depends[k]);
    });
    return forge;
  }
  return null;
}

module.exports = { readModMetadata, normalizeMavenRange };

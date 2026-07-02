const os = require('os');

function getPlatform() {
  const nameMap = { win32: 'windows', darwin: 'osx', linux: 'linux' };
  const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'x86';
  return {
    name: nameMap[process.platform] || process.platform,
    arch,
    bits: arch === 'x86' ? '32' : '64',
    release: os.release(),
  };
}

function ruleMatches(rule, platform, features) {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== platform.name) return false;
    if (rule.os.arch && rule.os.arch !== platform.arch) return false;
    if (rule.os.version && !new RegExp(rule.os.version).test(platform.release)) return false;
  }
  if (rule.features) {
    for (const [key, val] of Object.entries(rule.features)) {
      if (Boolean(features && features[key]) !== Boolean(val)) return false;
    }
  }
  return true;
}

function evaluateRules(rules, platform, features) {
  if (!rules || !rules.length) return true;
  let allowed = false;
  for (const rule of rules) {
    if (ruleMatches(rule, platform, features)) {
      allowed = rule.action === 'allow';
    }
  }
  return allowed;
}

function mavenNameToPath(name) {
  const [group, artifact, version, classifier] = name.split(':');
  const groupPath = group.replace(/\./g, '/');
  const fileName = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
  return `${groupPath}/${artifact}/${version}/${fileName}`;
}

function resolveLibraries(versionJson, platform = getPlatform()) {
  const classpathLibs = [];
  const natives = [];

  for (const lib of versionJson.libraries || []) {
    if (!evaluateRules(lib.rules, platform)) continue;

    const artifact = lib.downloads?.artifact;
    if (artifact) {
      classpathLibs.push({
        name: lib.name,
        path: artifact.path || mavenNameToPath(lib.name),
        url: artifact.url,
        sha1: artifact.sha1 || null,
        size: artifact.size ?? null,
      });
    } else if (lib.name && !lib.downloads) {
      const relPath = mavenNameToPath(lib.name);
      const base = (lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/');
      classpathLibs.push({
        name: lib.name,
        path: relPath,
        url: base + relPath,
        sha1: null,
        size: null,
      });
    }

    if (lib.natives) {
      let classifierKey = lib.natives[platform.name];
      if (classifierKey) {
        classifierKey = classifierKey.replace('${arch}', platform.bits);
        const nativeArtifact = lib.downloads?.classifiers?.[classifierKey];
        if (nativeArtifact) {
          natives.push({
            name: lib.name,
            path: nativeArtifact.path,
            url: nativeArtifact.url,
            sha1: nativeArtifact.sha1 || null,
            size: nativeArtifact.size ?? null,
            exclude: lib.extract?.exclude || [],
          });
        }
      }
    }
  }

  return { classpathLibs, natives };
}

module.exports = { getPlatform, evaluateRules, resolveLibraries, mavenNameToPath };

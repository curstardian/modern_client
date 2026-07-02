const path = require('path');
const { evaluateRules, getPlatform } = require('./libraryResolver');
const paths = require('./paths');

function substitute(str, tokens) {
  return str.replace(/\$\{([^}]+)\}/g, (match, key) => (key in tokens ? String(tokens[key]) : ''));
}

function resolveArgumentList(list, tokens, platform, features) {
  const out = [];
  for (const item of list || []) {
    if (typeof item === 'string') {
      out.push(substitute(item, tokens));
      continue;
    }
    if (!evaluateRules(item.rules, platform, features)) continue;
    const values = Array.isArray(item.value) ? item.value : [item.value];
    for (const v of values) out.push(substitute(v, tokens));
  }
  return out;
}

function buildTokens({ versionJson, session, gameDir, assetsRoot, nativesDir, classpath }) {
  const uuidNoDashes = session.uuid.replace(/-/g, '');
  return {
    auth_player_name: session.username,
    version_name: versionJson.id,
    game_directory: gameDir,
    assets_root: assetsRoot,
    game_assets: assetsRoot,
    assets_index_name: versionJson.assetIndex?.id || versionJson.assets || versionJson.id,
    auth_uuid: uuidNoDashes,
    auth_access_token: session.accessToken,
    auth_session: `token:${session.accessToken}:${uuidNoDashes}`,
    user_type: session.userType,
    version_type: versionJson.type || 'release',
    natives_directory: nativesDir,
    launcher_name: 'modern-client',
    launcher_version: '1.0.0',
    classpath,
    classpath_separator: path.delimiter,
    library_directory: paths.librariesRoot(),
    user_properties: '{}',
    clientid: '',
    auth_xuid: session.xuid || '',
    resolution_width: '854',
    resolution_height: '480',
  };
}

function buildLaunchArgs({ versionJson, session, gameDir, assetsRoot, nativesDir, classpathEntries, ramMinMb, ramMaxMb }) {
  const platform = getPlatform();
  const classpath = classpathEntries.join(path.delimiter);
  const tokens = buildTokens({ versionJson, session, gameDir, assetsRoot, nativesDir, classpath });

  const memoryArgs = [`-Xms${ramMinMb}M`, `-Xmx${ramMaxMb}M`];

  let jvmArgs;
  const isModern = Array.isArray(versionJson.arguments?.jvm);
  if (isModern) {
    jvmArgs = [...memoryArgs, ...resolveArgumentList(versionJson.arguments.jvm, tokens, platform, {})];
  } else {
    jvmArgs = [
      ...memoryArgs,
      `-Djava.library.path=${nativesDir}`,
      `-Dminecraft.launcher.brand=${tokens.launcher_name}`,
      `-Dminecraft.launcher.version=${tokens.launcher_version}`,
      '-cp',
      classpath,
    ];
  }

  let gameArgs;
  const isModernGame = Array.isArray(versionJson.arguments?.game);
  if (isModernGame) {
    gameArgs = resolveArgumentList(versionJson.arguments.game, tokens, platform, {});
  } else if (typeof versionJson.minecraftArguments === 'string') {
    gameArgs = versionJson.minecraftArguments.split(/\s+/).map((tok) => substitute(tok, tokens));
  } else {
    gameArgs = [];
  }

  return {
    mainClass: versionJson.mainClass,
    jvmArgs,
    gameArgs,
    argv: [...jvmArgs, versionJson.mainClass, ...gameArgs],
  };
}

module.exports = { substitute, resolveArgumentList, buildLaunchArgs };

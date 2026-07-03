const { randomUUID } = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const paths = require('./paths');
const versionJsonSvc = require('./versionJson');
const libraryResolver = require('./libraryResolver');
const downloader = require('./downloader');
const assetsManager = require('./assetsManager');
const zipReader = require('./zipReader');
const argsBuilder = require('./argsBuilder');
const instancesSvc = require('./instances');
const accountsSvc = require('./accounts');
const settingsSvc = require('./settings');
const msAuth = require('./msAuth');
const versionsLibrary = require('./versionsLibrary');
const essentialMods = require('./essentialMods');
const modCompat = require('./modCompat');

const activeProcesses = new Map();

function emit(handlers, name, payload) {
  if (handlers && typeof handlers[name] === 'function') handlers[name](payload);
}

async function ensureClientJar(versionId, versionJson) {
  const dest = paths.versionJarFile(versionId);
  const dl = versionJson.downloads?.client;
  if (!dl) throw new Error('클라이언트 jar 다운로드 정보가 없습니다.');
  await downloader.downloadOne({ dest, url: dl.url, sha1: dl.sha1, size: dl.size, name: `${versionId}.jar` });
  return dest;
}

async function ensureLibraries(versionJson, onProgress) {
  const { classpathLibs, natives } = libraryResolver.resolveLibraries(versionJson);
  const tasks = classpathLibs.map((lib) => ({
    name: lib.name, dest: paths.libraryFile(lib.path), url: lib.url, sha1: lib.sha1, size: lib.size,
  }));
  const nativeTasks = natives.map((n) => ({
    name: n.name, dest: paths.libraryFile(n.path), url: n.url, sha1: n.sha1, size: n.size,
  }));
  await downloader.downloadAll([...tasks, ...nativeTasks], { concurrency: 8, onProgress });
  return {
    classpathPaths: classpathLibs.map((lib) => paths.libraryFile(lib.path)),
    natives: natives.map((n) => ({ jarPath: paths.libraryFile(n.path), exclude: n.exclude })),
  };
}

async function ensureNatives(versionId, natives) {
  const nativesDir = paths.versionNativesDir(versionId);
  if (!natives.length) return nativesDir;
  const already = fs.readdirSync(nativesDir);
  if (already.length > 0) return nativesDir;
  zipReader.extractNatives(natives, nativesDir);
  return nativesDir;
}

async function buildSession(account) {
  if (account.type === 'microsoft') {
    const refreshToken = accountsSvc.getMicrosoftRefreshToken(account.id);
    const msSession = await msAuth.refreshMicrosoftSession(refreshToken);
    accountsSvc.updateMicrosoftToken(account.id, msSession.refreshToken);
    return {
      username: msSession.username, uuid: msSession.uuid, accessToken: msSession.accessToken, userType: 'msa', xuid: msSession.xuid,
    };
  }
  return {
    username: account.username, uuid: account.uuid, accessToken: '0', userType: 'legacy', xuid: '',
  };
}

async function startLaunch(instanceId, handlers = {}, { force = false } = {}) {
  const launchId = randomUUID();
  runLaunch(launchId, instanceId, handlers, { force }).catch((err) => {
    emit(handlers, 'onError', { launchId, phase: 'launch', message: err.message });
  });
  return { launchId };
}

async function runLaunch(launchId, instanceId, handlers, { force = false } = {}) {
  const instance = instancesSvc.get(instanceId);
  if (!instance) throw new Error('존재하지 않는 인스턴스입니다.');
  const account = accountsSvc.getActive();
  if (!account) throw new Error('활성화된 계정이 없습니다. 먼저 계정을 추가해주세요.');
  const settings = settingsSvc.get();

  const progress = (phase) => (p) => emit(handlers, 'onProgress', { launchId, phase, ...p });

  emit(handlers, 'onProgress', { launchId, phase: 'auth', current: 0, total: 1 });
  const session = await buildSession(account);

  emit(handlers, 'onProgress', { launchId, phase: 'manifest', current: 0, total: 1 });
  const versionJson = await versionJsonSvc.getEffectiveVersionJson(instance.versionId);
  versionsLibrary.recordMetaIfMissing(instance.versionId, {
    loader: 'vanilla', mcVersion: versionJson.inheritsFrom || versionJson.id,
  });

  if (versionJsonSvc.isLegacyAssets(versionJson)) {
    throw new Error('이 버전은 구버전 에셋 형식(legacy)을 사용해 아직 지원되지 않습니다.');
  }

  const versionMeta = versionsLibrary.getMeta(instance.versionId);
  if (versionMeta.loader !== 'vanilla') {
    emit(handlers, 'onProgress', { launchId, phase: 'mods-essential', current: 0, total: 1 });
    await essentialMods.ensureEssentialMods(instance, versionMeta);

    emit(handlers, 'onProgress', { launchId, phase: 'mods-check', current: 0, total: 1 });
    const compat = await modCompat.preflightCheck(instance, versionMeta);
    if (!compat.ok && !force) {
      emit(handlers, 'onCompatWarning', { launchId, problems: compat.problems });
      return;
    }
  }

  emit(handlers, 'onProgress', { launchId, phase: 'libraries', current: 0, total: 1 });
  const { classpathPaths, natives } = await ensureLibraries(versionJson, progress('libraries'));

  emit(handlers, 'onProgress', { launchId, phase: 'client-jar', current: 0, total: 1 });
  await ensureClientJar(instance.versionId, versionJson);

  emit(handlers, 'onProgress', { launchId, phase: 'assets', current: 0, total: 1 });
  await assetsManager.downloadAssets(versionJson, { onProgress: progress('assets') });

  emit(handlers, 'onProgress', { launchId, phase: 'natives', current: 0, total: 1 });
  const nativesDir = await ensureNatives(instance.versionId, natives);

  emit(handlers, 'onProgress', { launchId, phase: 'starting', current: 0, total: 1 });

  const overrides = instance.overrides || {};
  const javaPath = overrides.javaPath || settings.javaPath || 'java';
  const ramMinMb = overrides.ramMinMb || settings.ramMinMb;
  const ramMaxMb = overrides.ramMaxMb || settings.ramMaxMb;

  const classpathEntries = [...classpathPaths, paths.versionJarFile(instance.versionId)];
  const gameDir = paths.instanceGameDir(instanceId);
  const assetsRoot = paths.assetsRoot();

  const { argv } = argsBuilder.buildLaunchArgs({
    versionJson, session, gameDir, assetsRoot, nativesDir, classpathEntries, ramMinMb, ramMaxMb,
  });

  const extraJvmArgs = (overrides.jvmArgs || '').trim().split(/\s+/).filter(Boolean);
  const finalArgv = [...extraJvmArgs, ...argv];

  let child;
  try {
    child = spawn(javaPath, finalArgv, { cwd: gameDir });
  } catch (err) {
    emit(handlers, 'onError', { launchId, phase: 'spawn', message: `Java 실행 실패: ${err.message}` });
    return;
  }
  activeProcesses.set(launchId, child);

  child.stdout.on('data', (chunk) => emit(handlers, 'onLog', { launchId, stream: 'stdout', line: chunk.toString() }));
  child.stderr.on('data', (chunk) => emit(handlers, 'onLog', { launchId, stream: 'stderr', line: chunk.toString() }));

  child.on('error', (err) => {
    activeProcesses.delete(launchId);
    emit(handlers, 'onError', { launchId, phase: 'spawn', message: `Java 실행 실패: ${err.message}` });
  });

  child.on('close', (code, signal) => {
    activeProcesses.delete(launchId);
    settingsSvc.addRecentLaunch({
      instanceId, instanceName: instance.name, versionId: instance.versionId, timestamp: Date.now(),
    });
    emit(handlers, 'onExit', { launchId, code, signal });
  });
}

function cancelLaunch(launchId) {
  const child = activeProcesses.get(launchId);
  if (child) {
    child.kill();
    activeProcesses.delete(launchId);
  }
  return { ok: true };
}

async function installVanillaVersion(versionId, { onProgress } = {}) {
  const progress = (phase) => (p) => emit({ onProgress }, 'onProgress', { phase, ...p });
  const versionJson = await versionJsonSvc.getVersionJson(versionId);
  if (versionJsonSvc.isLegacyAssets(versionJson)) {
    throw new Error('이 버전은 구버전 에셋 형식(legacy)을 사용해 아직 지원되지 않습니다.');
  }
  const { natives } = await ensureLibraries(versionJson, progress('libraries'));
  await ensureClientJar(versionId, versionJson);
  await assetsManager.downloadAssets(versionJson, { onProgress: progress('assets') });
  await ensureNatives(versionId, natives);
  versionsLibrary.recordMeta(versionId, { loader: 'vanilla', mcVersion: versionId });
  return { versionId };
}

module.exports = {
  startLaunch, cancelLaunch, installVanillaVersion,
};

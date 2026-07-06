const { ipcMain, shell } = require('electron');
const channels = require('../../shared/ipcChannels');
const modManager = require('../services/modManager');
const modrinth = require('../services/modSources/modrinth');
const curseforge = require('../services/modSources/curseforge');
const instancesSvc = require('../services/instances');
const versionsLibrary = require('../services/versionsLibrary');

function sourceClient(source) {
  if (source === 'modrinth') return modrinth;
  if (source === 'curseforge') return curseforge;
  throw new Error(`알 수 없는 모드 소스: ${source}`);
}

function instanceContext(instanceId) {
  const instance = instancesSvc.get(instanceId);
  if (!instance) throw new Error('존재하지 않는 인스턴스입니다.');
  const meta = versionsLibrary.getMeta(instance.versionId);
  return { instance, meta };
}

function register(getWin) {
  ipcMain.handle(channels.MODS_SEARCH, async (event, {
    instanceId, source, query,
  } = {}) => {
    const { meta } = instanceContext(instanceId);
    const client = sourceClient(source);
    return client.search({ query, mcVersion: meta.mcVersion, loader: meta.loader });
  });

  ipcMain.handle(channels.MODS_LIST_INSTALLED, (event, { instanceId } = {}) => modManager.listMods(instanceId));

  ipcMain.handle(channels.MODS_INSTALL, async (event, {
    instanceId, source, modId, versionId,
  } = {}) => {
    const { meta } = instanceContext(instanceId);
    return modManager.installMod(
      instanceId,
      { source, modId, versionId },
      { mcVersion: meta.mcVersion, loader: meta.loader },
    );
  });

  ipcMain.handle(channels.MODS_REMOVE, (event, { instanceId, modId } = {}) => modManager.removeMod(instanceId, modId));

  ipcMain.handle(
    channels.MODS_SET_ENABLED,
    (event, { instanceId, modId, enabled } = {}) => modManager.setEnabled(instanceId, modId, enabled),
  );

  ipcMain.handle(channels.MODS_OPEN_FOLDER, (event, { instanceId } = {}) => {
    const folder = modManager.getModsFolder(instanceId);
    return shell.openPath(folder);
  });

  ipcMain.handle(channels.MODS_IMPORT_LOCAL, (event, { instanceId } = {}) => {
    const { meta } = instanceContext(instanceId);
    return modManager.importFromSystemMods(instanceId, getWin(), meta);
  });

  ipcMain.handle(channels.MODS_UPLOAD_LOCAL, (event, { instanceId } = {}) => {
    const { meta } = instanceContext(instanceId);
    return modManager.uploadLocalMods(instanceId, getWin(), meta);
  });

  ipcMain.handle(channels.MODS_AUTO_RESOLVE_VERSION, (event, { instanceId, modId } = {}) => {
    const { instance, meta } = instanceContext(instanceId);
    return modManager.autoResolveModVersion(instanceId, modId, meta, instance.name);
  });
}

module.exports = { register };

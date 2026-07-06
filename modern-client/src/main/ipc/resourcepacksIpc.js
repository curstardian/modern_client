const { ipcMain, shell } = require('electron');
const channels = require('../../shared/ipcChannels');
const resourcePackManager = require('../services/resourcePackManager');
const instancesSvc = require('../services/instances');
const versionsLibrary = require('../services/versionsLibrary');

function instanceMcVersion(instanceId) {
  const instance = instancesSvc.get(instanceId);
  if (!instance) throw new Error('존재하지 않는 인스턴스입니다.');
  const meta = versionsLibrary.getMeta(instance.versionId);
  return meta.mcVersion;
}

function register() {
  ipcMain.handle(channels.RESOURCEPACKS_SEARCH, async (event, { instanceId, source, query } = {}) => resourcePackManager.search({
    source, query, mcVersion: instanceMcVersion(instanceId),
  }));

  ipcMain.handle(channels.RESOURCEPACKS_LIST_INSTALLED, (event, { instanceId } = {}) => resourcePackManager.listPacks(instanceId));

  ipcMain.handle(channels.RESOURCEPACKS_INSTALL, async (event, {
    instanceId, source, modId, versionId,
  } = {}) => resourcePackManager.installPack(
    instanceId,
    { source, modId, versionId },
    { mcVersion: instanceMcVersion(instanceId) },
  ));

  ipcMain.handle(channels.RESOURCEPACKS_REMOVE, (event, { instanceId, packId } = {}) => resourcePackManager.removePack(instanceId, packId));

  ipcMain.handle(
    channels.RESOURCEPACKS_SET_ENABLED,
    (event, { instanceId, packId, enabled } = {}) => resourcePackManager.setEnabled(instanceId, packId, enabled),
  );

  ipcMain.handle(channels.RESOURCEPACKS_OPEN_FOLDER, (event, { instanceId } = {}) => {
    const folder = resourcePackManager.getPacksFolder(instanceId);
    return shell.openPath(folder);
  });
}

module.exports = { register };

const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const versionManifest = require('../services/versionManifest');
const versionsLibrary = require('../services/versionsLibrary');
const fabricInstaller = require('../services/fabricInstaller');
const forgeInstaller = require('../services/forgeInstaller');
const settingsSvc = require('../services/settings');
const launcher = require('../services/launcher');

function register(getWin) {
  ipcMain.handle(channels.VERSIONS_LIST, (event, { refresh } = {}) => versionManifest.list({ refresh }));
  ipcMain.handle(channels.VERSIONS_LIST_INSTALLED, () => versionsLibrary.listInstalled());
  ipcMain.handle(channels.VERSIONS_DELETE_INSTALLED, (event, { versionId } = {}) => versionsLibrary.deleteInstalled(versionId));
  ipcMain.handle(channels.VERSIONS_LIST_FABRIC_LOADERS, (event, { mcVersion } = {}) => fabricInstaller.listLoaderVersions(mcVersion));
  ipcMain.handle(channels.VERSIONS_LIST_FORGE_VERSIONS, (event, { mcVersion } = {}) => forgeInstaller.listForgeVersions(mcVersion));

  const send = (channel, payload) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  ipcMain.handle(channels.VERSIONS_INSTALL_VANILLA, (event, { versionId } = {}) => launcher.installVanillaVersion(versionId, {
    onProgress: (p) => send(channels.VERSIONS_INSTALL_PROGRESS, p),
  }));

  ipcMain.handle(channels.VERSIONS_INSTALL_FABRIC, (event, { mcVersion, loaderVersion } = {}) => fabricInstaller.installFabric(mcVersion, loaderVersion));

  ipcMain.handle(channels.VERSIONS_INSTALL_FORGE, (event, { mcVersion, forgeVersion } = {}) => {
    const settings = settingsSvc.get();
    return forgeInstaller.installForge(mcVersion, forgeVersion, {
      javaPath: settings.javaPath,
      onProgress: (p) => send(channels.VERSIONS_INSTALL_PROGRESS, p),
      onLog: (p) => send(channels.VERSIONS_INSTALL_LOG, p),
    });
  });
}

module.exports = { register };

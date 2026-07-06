const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const settings = require('../services/settings');
const javaCheck = require('../services/javaCheck');

function register(getWin) {
  ipcMain.handle(channels.SETTINGS_GET, () => settings.get());
  ipcMain.handle(channels.SETTINGS_SET, (event, patch) => settings.set(patch || {}));
  ipcMain.handle(channels.SETTINGS_BROWSE_JAVA, () => javaCheck.browseJava(getWin()));
  ipcMain.handle(channels.SETTINGS_VALIDATE_JAVA, (event, { path } = {}) => javaCheck.validateJava(path));
}

module.exports = { register };

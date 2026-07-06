const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const mcSettings = require('../services/mcSettings');

function register() {
  ipcMain.handle(channels.MC_SETTINGS_GET, (event, { instanceId } = {}) => mcSettings.getSettings(instanceId));
  ipcMain.handle(
    channels.MC_SETTINGS_SET,
    (event, { instanceId, patch } = {}) => mcSettings.setSettings(instanceId, patch),
  );
}

module.exports = { register };

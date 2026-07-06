const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const instances = require('../services/instances');

function register() {
  ipcMain.handle(channels.INSTANCES_LIST, () => instances.list());
  ipcMain.handle(channels.INSTANCES_CREATE, (event, payload) => instances.create(payload || {}));
  ipcMain.handle(channels.INSTANCES_UPDATE, (event, { id, patch } = {}) => instances.update(id, patch || {}));
  ipcMain.handle(channels.INSTANCES_DELETE, (event, { id } = {}) => instances.remove(id));
  ipcMain.handle(channels.INSTANCES_SET_ACTIVE, (event, { id } = {}) => instances.setActive(id));
  ipcMain.handle(channels.INSTANCES_GET_ACTIVE, () => instances.getActive());
}

module.exports = { register };

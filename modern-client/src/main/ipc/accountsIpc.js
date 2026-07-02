const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const accounts = require('../services/accounts');
const msAuth = require('../services/msAuth');

function register(getWin) {
  ipcMain.handle(channels.ACCOUNTS_LIST, () => accounts.list());
  ipcMain.handle(channels.ACCOUNTS_CREATE, (event, { username } = {}) => accounts.create(username));
  ipcMain.handle(channels.ACCOUNTS_DELETE, (event, { id } = {}) => accounts.remove(id));
  ipcMain.handle(channels.ACCOUNTS_SET_ACTIVE, (event, { id } = {}) => accounts.setActive(id));
  ipcMain.handle(channels.ACCOUNTS_GET_ACTIVE, () => accounts.getActive());

  ipcMain.handle(channels.ACCOUNTS_LOGIN_MICROSOFT, async () => {
    const session = await msAuth.loginWithMicrosoft(getWin());
    return accounts.createMicrosoft(session);
  });

  ipcMain.handle(channels.ACCOUNTS_CANCEL_MS_LOGIN, () => msAuth.cancelLogin());
}

module.exports = { register };

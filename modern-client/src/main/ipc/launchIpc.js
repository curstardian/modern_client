const { ipcMain } = require('electron');
const channels = require('../../shared/ipcChannels');
const launcher = require('../services/launcher');

function register(getWin) {
  const send = (channel, payload) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  ipcMain.handle(channels.LAUNCH_START, (event, { instanceId } = {}) => launcher.startLaunch(instanceId, {
    onProgress: (p) => send(channels.LAUNCH_PROGRESS, p),
    onLog: (p) => send(channels.LAUNCH_LOG, p),
    onExit: (p) => send(channels.LAUNCH_EXIT, p),
    onError: (p) => send(channels.LAUNCH_ERROR, p),
  }));

  ipcMain.handle(channels.LAUNCH_CANCEL, (event, { launchId } = {}) => launcher.cancelLaunch(launchId));
}

module.exports = { register };

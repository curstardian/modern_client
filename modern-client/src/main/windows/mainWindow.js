const path = require('path');
const { BrowserWindow } = require('electron');

const APP_ICON = path.join(__dirname, '..', '..', 'renderer', 'assets', 'icon.png');

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#f4f6fb',
    title: 'Modern Client',
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

  const notifyBoundsChanged = () => {
    if (!win.isDestroyed()) win.webContents.send('window:boundsChanged');
  };
  win.on('resize', notifyBoundsChanged);
  win.on('maximize', notifyBoundsChanged);
  win.on('unmaximize', notifyBoundsChanged);
  win.on('enter-full-screen', notifyBoundsChanged);
  win.on('leave-full-screen', notifyBoundsChanged);

  return win;
}

module.exports = { createMainWindow };

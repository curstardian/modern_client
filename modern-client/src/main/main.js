const { app, BrowserWindow } = require('electron');
const { createMainWindow } = require('./windows/mainWindow');
const ipc = require('./ipc');

app.setName('modern-client');
if (process.platform === 'win32') app.setAppUserModelId('modern-client');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipc.registerAll(() => mainWindow);
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

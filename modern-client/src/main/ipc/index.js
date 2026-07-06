const accountsIpc = require('./accountsIpc');
const instancesIpc = require('./instancesIpc');
const settingsIpc = require('./settingsIpc');
const versionsIpc = require('./versionsIpc');
const launchIpc = require('./launchIpc');
const modsIpc = require('./modsIpc');
const resourcepacksIpc = require('./resourcepacksIpc');
const mcSettingsIpc = require('./mcSettingsIpc');

function registerAll(getWin) {
  accountsIpc.register(getWin);
  instancesIpc.register();
  versionsIpc.register(getWin);
  settingsIpc.register(getWin);
  launchIpc.register(getWin);
  modsIpc.register(getWin);
  resourcepacksIpc.register();
  mcSettingsIpc.register();
}

module.exports = { registerAll };

const accountsIpc = require('./accountsIpc');
const instancesIpc = require('./instancesIpc');
const settingsIpc = require('./settingsIpc');
const versionsIpc = require('./versionsIpc');
const launchIpc = require('./launchIpc');
const modsIpc = require('./modsIpc');

function registerAll(getWin) {
  accountsIpc.register(getWin);
  instancesIpc.register();
  versionsIpc.register(getWin);
  settingsIpc.register(getWin);
  launchIpc.register(getWin);
  modsIpc.register();
}

module.exports = { registerAll };

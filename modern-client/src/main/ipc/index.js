const accountsIpc = require('./accountsIpc');
const instancesIpc = require('./instancesIpc');
const settingsIpc = require('./settingsIpc');
const versionsIpc = require('./versionsIpc');
const launchIpc = require('./launchIpc');

function registerAll(getWin) {
  accountsIpc.register(getWin);
  instancesIpc.register();
  versionsIpc.register(getWin);
  settingsIpc.register(getWin);
  launchIpc.register(getWin);
}

module.exports = { registerAll };

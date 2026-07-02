const { readJson, writeJson } = require('./jsonStore');
const { settingsFile } = require('./paths');

const DEFAULTS = {
  ramMinMb: 1024,
  ramMaxMb: 2048,
  javaPath: '',
  theme: 'light',
  recentLaunches: [],
};

function get() {
  return { ...DEFAULTS, ...readJson(settingsFile(), {}) };
}

function set(patch) {
  const current = get();
  const next = { ...current, ...patch };
  writeJson(settingsFile(), next);
  return next;
}

function addRecentLaunch(entry) {
  const current = get();
  const recentLaunches = [entry, ...current.recentLaunches].slice(0, 10);
  return set({ recentLaunches });
}

module.exports = { get, set, addRecentLaunch, DEFAULTS };

const { readJson, writeJson } = require('./jsonStore');
const { settingsFile } = require('./paths');

const DEFAULT_JAVA_OPTIONS = '-Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 '
  + '-XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M';

const DEFAULTS = {
  javaOptions: DEFAULT_JAVA_OPTIONS,
  javaPath: '',
  theme: 'light',
  language: 'ko',
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

module.exports = {
  get, set, addRecentLaunch, DEFAULTS, DEFAULT_JAVA_OPTIONS,
};

const fs = require('fs');
const paths = require('./paths');
const { readJson, writeJson } = require('./jsonStore');

const DEFAULTS = {
  mouseSensitivity: 0.5,
  invertMouse: false,
  keyBindings: {
    forward: 'key.keyboard.w',
    back: 'key.keyboard.s',
    left: 'key.keyboard.a',
    right: 'key.keyboard.d',
    jump: 'key.keyboard.space',
    sneak: 'key.keyboard.left.shift',
    sprint: 'key.keyboard.left.control',
    inventory: 'key.keyboard.e',
    drop: 'key.keyboard.q',
    attack: 'key.mouse.left',
    use: 'key.mouse.right',
  },
  sound: {
    master: 1.0,
    music: 1.0,
    record: 1.0,
    weather: 1.0,
    block: 1.0,
    hostile: 1.0,
    neutral: 1.0,
    player: 1.0,
    ambient: 1.0,
    voice: 1.0,
  },
  video: {
    renderDistance: 12,
    guiScale: 0,
    maxFps: 120,
    fullscreen: false,
    vsync: true,
    graphicsMode: 1,
    smoothLighting: true,
  },
  language: 'ko_kr',
  resourcePacks: [],
};

const KEY_BINDING_OPTION = {
  forward: 'key_key.forward',
  back: 'key_key.back',
  left: 'key_key.left',
  right: 'key_key.right',
  jump: 'key_key.jump',
  sneak: 'key_key.sneak',
  sprint: 'key_key.sprint',
  inventory: 'key_key.inventory',
  drop: 'key_key.drop',
  attack: 'key_key.attack',
  use: 'key_key.use',
};

const SOUND_OPTION = {
  master: 'soundCategory_master',
  music: 'soundCategory_music',
  record: 'soundCategory_record',
  weather: 'soundCategory_weather',
  block: 'soundCategory_block',
  hostile: 'soundCategory_hostile',
  neutral: 'soundCategory_neutral',
  player: 'soundCategory_player',
  ambient: 'soundCategory_ambient',
  voice: 'soundCategory_voice',
};

function deepMerge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof base[key] === 'object') {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getSettings(instanceId) {
  return deepMerge(DEFAULTS, readJson(paths.instanceMcSettingsFile(instanceId), {}));
}

function setSettings(instanceId, patch) {
  const merged = deepMerge(getSettings(instanceId), patch || {});
  writeJson(paths.instanceMcSettingsFile(instanceId), merged);
  return merged;
}

function parseOptionsFile(filePath) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    map.set(line.slice(0, idx), line.slice(idx + 1));
  }
  return map;
}

function serializeOptionsFile(map) {
  return `${Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join('\n')}\n`;
}

function applyToOptionsFile(instanceId) {
  const settings = getSettings(instanceId);
  const optionsPath = paths.instanceOptionsFile(instanceId);
  const map = parseOptionsFile(optionsPath);

  map.set('mouseSensitivity', String(settings.mouseSensitivity));
  map.set('invertYMouse', String(!!settings.invertMouse));
  Object.entries(settings.keyBindings || {}).forEach(([action, key]) => {
    const optionKey = KEY_BINDING_OPTION[action];
    if (optionKey && key) map.set(optionKey, key);
  });
  Object.entries(settings.sound || {}).forEach(([category, value]) => {
    const optionKey = SOUND_OPTION[category];
    if (optionKey) map.set(optionKey, String(value));
  });

  const { video } = settings;
  if (video) {
    map.set('renderDistance', String(video.renderDistance));
    map.set('guiScale', String(video.guiScale));
    map.set('maxFps', String(video.maxFps));
    map.set('fullscreen', String(!!video.fullscreen));
    map.set('enableVsync', String(!!video.vsync));
    map.set('graphicsMode', String(video.graphicsMode));
    map.set('ao', String(!!video.smoothLighting));
  }

  if (settings.language) map.set('lang', settings.language);
  if (Array.isArray(settings.resourcePacks)) {
    map.set('resourcePacks', JSON.stringify(settings.resourcePacks));
  }

  fs.writeFileSync(optionsPath, serializeOptionsFile(map));
  return { ok: true };
}

module.exports = {
  getSettings, setSettings, applyToOptionsFile, DEFAULTS,
};

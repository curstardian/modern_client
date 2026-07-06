const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function userDataRoot() {
  return app.getPath('userData');
}

function accountsFile() {
  return path.join(userDataRoot(), 'accounts.json');
}

function settingsFile() {
  return path.join(userDataRoot(), 'settings.json');
}

function instancesRoot() {
  return ensureDir(path.join(userDataRoot(), 'instances'));
}

function instanceDir(instanceId) {
  return ensureDir(path.join(instancesRoot(), instanceId));
}

function instanceFile(instanceId) {
  return path.join(instanceDir(instanceId), 'instance.json');
}

function instanceGameDir(instanceId) {
  return ensureDir(path.join(instanceDir(instanceId), 'gamedir'));
}

function instanceModsDir(instanceId) {
  return ensureDir(path.join(instanceGameDir(instanceId), 'mods'));
}

function instanceModsFile(instanceId) {
  return path.join(instanceDir(instanceId), 'mods.json');
}

function instanceMcSettingsFile(instanceId) {
  return path.join(instanceDir(instanceId), 'mcSettings.json');
}

function instanceOptionsFile(instanceId) {
  return path.join(instanceGameDir(instanceId), 'options.txt');
}

function versionsRoot() {
  return ensureDir(path.join(userDataRoot(), 'versions'));
}

function versionDir(versionId) {
  return ensureDir(path.join(versionsRoot(), versionId));
}

function versionJsonFile(versionId) {
  return path.join(versionDir(versionId), `${versionId}.json`);
}

function versionJarFile(versionId) {
  return path.join(versionDir(versionId), `${versionId}.jar`);
}

function versionNativesDir(versionId) {
  return ensureDir(path.join(versionDir(versionId), `natives-${process.platform}-${process.arch}`));
}

function librariesRoot() {
  return ensureDir(path.join(userDataRoot(), 'libraries'));
}

function libraryFile(relativePath) {
  const full = path.join(librariesRoot(), relativePath);
  ensureDir(path.dirname(full));
  return full;
}

function assetsRoot() {
  return ensureDir(path.join(userDataRoot(), 'assets'));
}

function assetIndexesDir() {
  return ensureDir(path.join(assetsRoot(), 'indexes'));
}

function assetIndexFile(assetIndexId) {
  return path.join(assetIndexesDir(), `${assetIndexId}.json`);
}

function assetObjectFile(hash) {
  const full = path.join(assetsRoot(), 'objects', hash.slice(0, 2), hash);
  ensureDir(path.dirname(full));
  return full;
}

function manifestCacheFile() {
  return path.join(userDataRoot(), 'version_manifest_v2.json');
}

function installersDir() {
  return ensureDir(path.join(userDataRoot(), 'installers'));
}

function installerFile(name) {
  return path.join(installersDir(), name);
}

function launcherProfilesFile() {
  return path.join(userDataRoot(), 'launcher_profiles.json');
}

function projectRoot() {
  return path.join(__dirname, '..', '..', '..');
}

function localEssentialModsDir() {
  return ensureDir(path.join(projectRoot(), 'mod'));
}

function instanceResourcePacksDir(instanceId) {
  return ensureDir(path.join(instanceGameDir(instanceId), 'resourcepacks'));
}

function instanceResourcePacksFile(instanceId) {
  return path.join(instanceDir(instanceId), 'resourcepacks.json');
}

function systemMinecraftDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Roaming'), '.minecraft');
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
  }
  return path.join(app.getPath('home'), '.minecraft');
}

function sanitizeName(name) {
  return String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'instance';
}

function tempRoot() {
  return ensureDir(path.join(userDataRoot(), 'temp'));
}

function tempInstanceModsDir(instanceName) {
  return ensureDir(path.join(tempRoot(), sanitizeName(instanceName)));
}

module.exports = {
  ensureDir,
  userDataRoot,
  accountsFile,
  settingsFile,
  instancesRoot,
  instanceDir,
  instanceFile,
  instanceGameDir,
  instanceModsDir,
  instanceModsFile,
  versionsRoot,
  versionDir,
  versionJsonFile,
  versionJarFile,
  versionNativesDir,
  librariesRoot,
  libraryFile,
  assetsRoot,
  assetIndexesDir,
  assetIndexFile,
  assetObjectFile,
  manifestCacheFile,
  installersDir,
  installerFile,
  launcherProfilesFile,
  projectRoot,
  localEssentialModsDir,
  instanceResourcePacksDir,
  instanceResourcePacksFile,
  systemMinecraftDir,
  sanitizeName,
  tempRoot,
  tempInstanceModsDir,
  instanceMcSettingsFile,
  instanceOptionsFile,
};

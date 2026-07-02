const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preload scripts cannot require() arbitrary local project files
// (only a small built-in module allowlist is supported), so these channel
// names are inlined here rather than shared via src/shared/ipcChannels.js.
// Keep in sync with that file.
const channels = {
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_CREATE: 'accounts:create',
  ACCOUNTS_DELETE: 'accounts:delete',
  ACCOUNTS_SET_ACTIVE: 'accounts:setActive',
  ACCOUNTS_GET_ACTIVE: 'accounts:getActive',
  ACCOUNTS_LOGIN_MICROSOFT: 'accounts:loginMicrosoft',
  ACCOUNTS_CANCEL_MS_LOGIN: 'accounts:cancelMsLogin',

  INSTANCES_LIST: 'instances:list',
  INSTANCES_CREATE: 'instances:create',
  INSTANCES_UPDATE: 'instances:update',
  INSTANCES_DELETE: 'instances:delete',
  INSTANCES_SET_ACTIVE: 'instances:setActive',
  INSTANCES_GET_ACTIVE: 'instances:getActive',

  VERSIONS_LIST: 'versions:list',
  VERSIONS_LIST_INSTALLED: 'versions:listInstalled',
  VERSIONS_DELETE_INSTALLED: 'versions:deleteInstalled',
  VERSIONS_LIST_FABRIC_LOADERS: 'versions:listFabricLoaders',
  VERSIONS_LIST_FORGE_VERSIONS: 'versions:listForgeVersions',
  VERSIONS_INSTALL_VANILLA: 'versions:installVanilla',
  VERSIONS_INSTALL_FABRIC: 'versions:installFabric',
  VERSIONS_INSTALL_FORGE: 'versions:installForge',
  VERSIONS_INSTALL_PROGRESS: 'versions:installProgress',
  VERSIONS_INSTALL_LOG: 'versions:installLog',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_BROWSE_JAVA: 'settings:browseJava',
  SETTINGS_VALIDATE_JAVA: 'settings:validateJava',

  LAUNCH_START: 'launch:start',
  LAUNCH_CANCEL: 'launch:cancel',
  LAUNCH_PROGRESS: 'launch:progress',
  LAUNCH_LOG: 'launch:log',
  LAUNCH_EXIT: 'launch:exit',
  LAUNCH_ERROR: 'launch:error',
};

function on(channel, callback) {
  const listener = (event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  accounts: {
    list: () => ipcRenderer.invoke(channels.ACCOUNTS_LIST),
    create: (username) => ipcRenderer.invoke(channels.ACCOUNTS_CREATE, { username }),
    remove: (id) => ipcRenderer.invoke(channels.ACCOUNTS_DELETE, { id }),
    setActive: (id) => ipcRenderer.invoke(channels.ACCOUNTS_SET_ACTIVE, { id }),
    getActive: () => ipcRenderer.invoke(channels.ACCOUNTS_GET_ACTIVE),
    loginMicrosoft: () => ipcRenderer.invoke(channels.ACCOUNTS_LOGIN_MICROSOFT),
    cancelMsLogin: () => ipcRenderer.invoke(channels.ACCOUNTS_CANCEL_MS_LOGIN),
  },
  instances: {
    list: () => ipcRenderer.invoke(channels.INSTANCES_LIST),
    create: (payload) => ipcRenderer.invoke(channels.INSTANCES_CREATE, payload),
    update: (id, patch) => ipcRenderer.invoke(channels.INSTANCES_UPDATE, { id, patch }),
    remove: (id) => ipcRenderer.invoke(channels.INSTANCES_DELETE, { id }),
    setActive: (id) => ipcRenderer.invoke(channels.INSTANCES_SET_ACTIVE, { id }),
    getActive: () => ipcRenderer.invoke(channels.INSTANCES_GET_ACTIVE),
  },
  versions: {
    list: (refresh) => ipcRenderer.invoke(channels.VERSIONS_LIST, { refresh }),
    listInstalled: () => ipcRenderer.invoke(channels.VERSIONS_LIST_INSTALLED),
    deleteInstalled: (versionId) => ipcRenderer.invoke(channels.VERSIONS_DELETE_INSTALLED, { versionId }),
    listFabricLoaders: (mcVersion) => ipcRenderer.invoke(channels.VERSIONS_LIST_FABRIC_LOADERS, { mcVersion }),
    listForgeVersions: (mcVersion) => ipcRenderer.invoke(channels.VERSIONS_LIST_FORGE_VERSIONS, { mcVersion }),
    installVanilla: (versionId) => ipcRenderer.invoke(channels.VERSIONS_INSTALL_VANILLA, { versionId }),
    installFabric: (mcVersion, loaderVersion) => ipcRenderer.invoke(channels.VERSIONS_INSTALL_FABRIC, { mcVersion, loaderVersion }),
    installForge: (mcVersion, forgeVersion) => ipcRenderer.invoke(channels.VERSIONS_INSTALL_FORGE, { mcVersion, forgeVersion }),
    onInstallProgress: (cb) => on(channels.VERSIONS_INSTALL_PROGRESS, cb),
    onInstallLog: (cb) => on(channels.VERSIONS_INSTALL_LOG, cb),
  },
  settings: {
    get: () => ipcRenderer.invoke(channels.SETTINGS_GET),
    set: (patch) => ipcRenderer.invoke(channels.SETTINGS_SET, patch),
    browseJava: () => ipcRenderer.invoke(channels.SETTINGS_BROWSE_JAVA),
    validateJava: (path) => ipcRenderer.invoke(channels.SETTINGS_VALIDATE_JAVA, { path }),
  },
  launch: {
    start: (instanceId) => ipcRenderer.invoke(channels.LAUNCH_START, { instanceId }),
    cancel: (launchId) => ipcRenderer.invoke(channels.LAUNCH_CANCEL, { launchId }),
    onProgress: (cb) => on(channels.LAUNCH_PROGRESS, cb),
    onLog: (cb) => on(channels.LAUNCH_LOG, cb),
    onExit: (cb) => on(channels.LAUNCH_EXIT, cb),
    onError: (cb) => on(channels.LAUNCH_ERROR, cb),
  },
});

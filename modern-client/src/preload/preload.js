const { contextBridge, ipcRenderer } = require('electron');
const channels = {
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_DELETE: 'accounts:delete',
  ACCOUNTS_SET_ACTIVE: 'accounts:setActive',
  ACCOUNTS_GET_ACTIVE: 'accounts:getActive',
  ACCOUNTS_LOGIN_MICROSOFT: 'accounts:loginMicrosoft',
  ACCOUNTS_CANCEL_MS_LOGIN: 'accounts:cancelMsLogin',
  ACCOUNTS_REFRESH_ACTIVE_SESSION: 'accounts:refreshActiveSession',

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

  MODS_SEARCH: 'mods:search',
  MODS_LIST_INSTALLED: 'mods:listInstalled',
  MODS_INSTALL: 'mods:install',
  MODS_REMOVE: 'mods:remove',
  MODS_SET_ENABLED: 'mods:setEnabled',
  MODS_OPEN_FOLDER: 'mods:openFolder',
  MODS_IMPORT_LOCAL: 'mods:importLocal',
  MODS_UPLOAD_LOCAL: 'mods:uploadLocal',
  MODS_AUTO_RESOLVE_VERSION: 'mods:autoResolveVersion',

  RESOURCEPACKS_SEARCH: 'resourcepacks:search',
  RESOURCEPACKS_LIST_INSTALLED: 'resourcepacks:listInstalled',
  RESOURCEPACKS_INSTALL: 'resourcepacks:install',
  RESOURCEPACKS_REMOVE: 'resourcepacks:remove',
  RESOURCEPACKS_SET_ENABLED: 'resourcepacks:setEnabled',
  RESOURCEPACKS_OPEN_FOLDER: 'resourcepacks:openFolder',

  MC_SETTINGS_GET: 'mcSettings:get',
  MC_SETTINGS_SET: 'mcSettings:set',

  LAUNCH_START: 'launch:start',
  LAUNCH_CANCEL: 'launch:cancel',
  LAUNCH_PROGRESS: 'launch:progress',
  LAUNCH_LOG: 'launch:log',
  LAUNCH_EXIT: 'launch:exit',
  LAUNCH_ERROR: 'launch:error',
  LAUNCH_CRASH: 'launch:crash',
  LAUNCH_COMPAT_WARNING: 'launch:compatWarning',
  LAUNCH_SNAPSHOT_WARNING: 'launch:snapshotWarning',
};

function on(channel, callback) {
  const listener = (event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  accounts: {
    list: () => ipcRenderer.invoke(channels.ACCOUNTS_LIST),
    remove: (id) => ipcRenderer.invoke(channels.ACCOUNTS_DELETE, { id }),
    setActive: (id) => ipcRenderer.invoke(channels.ACCOUNTS_SET_ACTIVE, { id }),
    getActive: () => ipcRenderer.invoke(channels.ACCOUNTS_GET_ACTIVE),
    loginMicrosoft: () => ipcRenderer.invoke(channels.ACCOUNTS_LOGIN_MICROSOFT),
    cancelMsLogin: () => ipcRenderer.invoke(channels.ACCOUNTS_CANCEL_MS_LOGIN),
    refreshActiveSession: () => ipcRenderer.invoke(channels.ACCOUNTS_REFRESH_ACTIVE_SESSION),
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
    listInstalled: (withSize) => ipcRenderer.invoke(channels.VERSIONS_LIST_INSTALLED, { withSize }),
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
  mods: {
    search: (instanceId, source, query) => ipcRenderer.invoke(channels.MODS_SEARCH, { instanceId, source, query }),
    listInstalled: (instanceId) => ipcRenderer.invoke(channels.MODS_LIST_INSTALLED, { instanceId }),
    install: (instanceId, source, modId, versionId) => ipcRenderer.invoke(channels.MODS_INSTALL, {
      instanceId, source, modId, versionId,
    }),
    remove: (instanceId, modId) => ipcRenderer.invoke(channels.MODS_REMOVE, { instanceId, modId }),
    setEnabled: (instanceId, modId, enabled) => ipcRenderer.invoke(channels.MODS_SET_ENABLED, {
      instanceId, modId, enabled,
    }),
    openFolder: (instanceId) => ipcRenderer.invoke(channels.MODS_OPEN_FOLDER, { instanceId }),
    importLocal: (instanceId) => ipcRenderer.invoke(channels.MODS_IMPORT_LOCAL, { instanceId }),
    uploadLocal: (instanceId) => ipcRenderer.invoke(channels.MODS_UPLOAD_LOCAL, { instanceId }),
    autoResolveVersion: (instanceId, modId) => ipcRenderer.invoke(channels.MODS_AUTO_RESOLVE_VERSION, { instanceId, modId }),
  },
  resourcepacks: {
    search: (instanceId, source, query) => ipcRenderer.invoke(channels.RESOURCEPACKS_SEARCH, { instanceId, source, query }),
    listInstalled: (instanceId) => ipcRenderer.invoke(channels.RESOURCEPACKS_LIST_INSTALLED, { instanceId }),
    install: (instanceId, source, modId, versionId) => ipcRenderer.invoke(channels.RESOURCEPACKS_INSTALL, {
      instanceId, source, modId, versionId,
    }),
    remove: (instanceId, packId) => ipcRenderer.invoke(channels.RESOURCEPACKS_REMOVE, { instanceId, packId }),
    setEnabled: (instanceId, packId, enabled) => ipcRenderer.invoke(channels.RESOURCEPACKS_SET_ENABLED, {
      instanceId, packId, enabled,
    }),
    openFolder: (instanceId) => ipcRenderer.invoke(channels.RESOURCEPACKS_OPEN_FOLDER, { instanceId }),
  },
  mcSettings: {
    get: (instanceId) => ipcRenderer.invoke(channels.MC_SETTINGS_GET, { instanceId }),
    set: (instanceId, patch) => ipcRenderer.invoke(channels.MC_SETTINGS_SET, { instanceId, patch }),
  },
  launch: {
    start: (instanceId, force) => ipcRenderer.invoke(channels.LAUNCH_START, { instanceId, force }),
    cancel: (launchId) => ipcRenderer.invoke(channels.LAUNCH_CANCEL, { launchId }),
    onProgress: (cb) => on(channels.LAUNCH_PROGRESS, cb),
    onLog: (cb) => on(channels.LAUNCH_LOG, cb),
    onExit: (cb) => on(channels.LAUNCH_EXIT, cb),
    onError: (cb) => on(channels.LAUNCH_ERROR, cb),
    onCrash: (cb) => on(channels.LAUNCH_CRASH, cb),
    onCompatWarning: (cb) => on(channels.LAUNCH_COMPAT_WARNING, cb),
    onSnapshotWarning: (cb) => on(channels.LAUNCH_SNAPSHOT_WARNING, cb),
  },
  window: {
    onBoundsChanged: (cb) => on('window:boundsChanged', cb),
  },
});

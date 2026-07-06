(function bootstrap() {
  const views = {
    home: { section: document.getElementById('view-home'), render: HomeView.render },
    instances: { section: document.getElementById('view-instances'), render: InstancesView.render },
    mods: { section: document.getElementById('view-mods'), render: ModsView.render },
    resourcepacks: { section: document.getElementById('view-resourcepacks'), render: ResourcePacksView.render },
    versions: { section: document.getElementById('view-versions'), render: VersionsView.render },
    mcsettings: { section: document.getElementById('view-mcsettings'), render: McSettingsView.render },
    settings: { section: document.getElementById('view-settings'), render: SettingsView.render },
  };

  function renderAccountSwitcher(state) {
    const nameEl = document.getElementById('account-name');
    const avatarEl = document.getElementById('account-avatar');
    if (state.activeAccount) {
      nameEl.textContent = state.sessionWarning ? `${state.activeAccount.username} · ${I18N.t('account.session.warning')}` : state.activeAccount.username;
      avatarEl.textContent = state.activeAccount.username.slice(0, 1).toUpperCase();
    } else {
      nameEl.textContent = I18N.t('account.name.none');
      avatarEl.textContent = '?';
    }
  }

  function renderCurrentView() {
    const state = Store.get();
    document.getElementById('nav-mods').hidden = !state.hasModdedInstances;
    Object.entries(views).forEach(([name, v]) => {
      const active = name === state.view;
      v.section.hidden = !active;
      if (active) v.render(v.section);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === state.view);
    });
    renderAccountSwitcher(state);
    I18N.applyStaticLabels();
  }

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      Store.set({ view: btn.dataset.view });
      renderCurrentView();
    });
  });

  document.getElementById('account-switcher').addEventListener('click', () => {
    Store.set({ view: 'settings' });
    renderCurrentView();
  });

  async function refreshAccounts() {
    const [accounts, activeAccount] = await Promise.all([
      window.api.accounts.list(),
      window.api.accounts.getActive(),
    ]);
    Store.set({ accounts, activeAccount });
    renderCurrentView();
  }

  async function refreshInstances() {
    const [instances, activeInstance] = await Promise.all([
      window.api.instances.list(),
      window.api.instances.getActive(),
    ]);
    const fallbackId = instances.length ? instances[0].id : null;
    const activeInstanceId = activeInstance ? activeInstance.id : fallbackId;
    Store.set({ instances, activeInstanceId });
    renderCurrentView();
  }

  async function refreshSettings() {
    const settings = await window.api.settings.get();
    Store.set({ settings });
  }

  function refreshVersions() {
    renderCurrentView();
  }

  async function refreshModAvailability() {
    const state = Store.get();
    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const loaderById = new Map(installed.map((v) => [v.versionId, v.loader]));
    const hasModdedInstances = state.instances.some((i) => (loaderById.get(i.versionId) || 'vanilla') !== 'vanilla');
    const patch = { hasModdedInstances };
    if (!hasModdedInstances && state.view === 'mods') patch.view = 'home';
    Store.set(patch);
    renderCurrentView();
  }

  async function forceLaunch(instanceId) {
    Modal.close();
    Store.set({ currentLaunch: { launchId: null, phase: 'manifest', current: 0, total: 1 }, logs: [] });
    try {
      await window.api.launch.start(instanceId, true);
    } catch (err) {
      Store.set({ currentLaunch: null });
      window.alert(err.message || String(err));
    }
  }

  window.App = {
    refreshAccounts,
    refreshInstances,
    refreshSettings,
    refreshVersions,
    refreshModAvailability,
    forceLaunch,
    renderCurrentView,
  };

  window.api.launch.onProgress((payload) => {
    Store.set({ currentLaunch: payload });
    renderCurrentView();
  });
  window.api.launch.onLog((payload) => {
    const nextLogs = Store.get().logs.concat(payload.line.split(/\r?\n/).filter(Boolean));
    Store.set({ logs: nextLogs.slice(-500) });
    renderCurrentView();
  });
  window.api.launch.onExit(async () => {
    Store.set({ currentLaunch: null });
    await refreshSettings();
    renderCurrentView();
  });
  window.api.launch.onError((payload) => {
    Store.set({ currentLaunch: null });
    renderCurrentView();
    window.alert(`${I18N.t('launch.error.prefix')}${payload.message}`);
  });
  window.api.launch.onCrash((payload) => {
    showCrashModal(payload);
  });
  window.api.launch.onCompatWarning((payload) => {
    Store.set({ currentLaunch: null });
    renderCurrentView();
    showCompatWarningModal(payload);
  });
  window.api.launch.onSnapshotWarning((payload) => {
    Store.set({ currentLaunch: null });
    renderCurrentView();
    showSnapshotWarningModal(payload);
  });

  function showCompatWarningModal({ launchId, problems }) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('compat.title')}</h3>
      <p class="form-hint">${I18N.t('compat.hint')}</p>
      <div class="problem-list">
        ${problems.map((p) => `<div class="problem-item severe">${p.message}</div>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn" id="compat-cancel">${I18N.t('compat.cancel')}</button>
        <button class="btn" id="compat-manage">${I18N.t('compat.manage')}</button>
        <button class="btn btn-primary" id="compat-force">${I18N.t('compat.force')}</button>
      </div>
    `;
    Modal.open(node, { large: true });
    node.querySelector('#compat-cancel').addEventListener('click', () => Modal.close());
    node.querySelector('#compat-manage').addEventListener('click', () => {
      Modal.close();
      Store.set({ view: 'instances' });
      renderCurrentView();
    });
    node.querySelector('#compat-force').addEventListener('click', () => {
      const state = Store.get();
      forceLaunch(state.activeInstanceId);
    });
  }

  function showSnapshotWarningModal({ mcVersion }) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('snapshot.title')}</h3>
      <p class="form-hint">${I18N.t('snapshot.hint', { version: mcVersion || '' })}</p>
      <div class="modal-actions">
        <button class="btn" id="snapshot-cancel">${I18N.t('common.cancel')}</button>
        <button class="btn btn-primary" id="snapshot-force">${I18N.t('snapshot.force')}</button>
      </div>
    `;
    Modal.open(node);
    node.querySelector('#snapshot-cancel').addEventListener('click', () => Modal.close());
    node.querySelector('#snapshot-force').addEventListener('click', () => {
      const state = Store.get();
      forceLaunch(state.activeInstanceId);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showCrashModal({ code, signal, logTail }) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('crash.title')}</h3>
      <p class="form-hint">${I18N.t('crash.hint', { code: code != null ? code : (signal || '?') })}</p>
      <div class="log-box">${(logTail || []).map(escapeHtml).join('\n')}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="crash-close">${I18N.t('common.close')}</button>
      </div>
    `;
    Modal.open(node, { large: true });
    node.querySelector('#crash-close').addEventListener('click', () => Modal.close());
  }

  async function init() {
    const [accounts, activeAccount, instances, activeInstance, settings, versions] = await Promise.all([
      window.api.accounts.list(),
      window.api.accounts.getActive(),
      window.api.instances.list(),
      window.api.instances.getActive(),
      window.api.settings.get(),
      window.api.versions.list().catch(() => ({ latest: null, versions: [] })),
    ]);

    const fallbackId = instances.length ? instances[0].id : null;

    Store.set({
      accounts,
      activeAccount,
      instances,
      activeInstanceId: activeInstance ? activeInstance.id : fallbackId,
      settings,
      versions,
    });

    document.body.className = `theme-${settings.theme || 'light'}`;
    renderCurrentView();
    refreshModAvailability();

    if (activeAccount && activeAccount.type === 'microsoft') {
      window.api.accounts.refreshActiveSession().then((result) => {
        Store.set({ sessionWarning: !result.ok });
        renderCurrentView();
      }).catch(() => {
        Store.set({ sessionWarning: true });
        renderCurrentView();
      });
    }
  }

  init();
}());

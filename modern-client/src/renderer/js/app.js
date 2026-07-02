(function bootstrap() {
  const views = {
    home: { section: document.getElementById('view-home'), render: HomeView.render },
    instances: { section: document.getElementById('view-instances'), render: InstancesView.render },
    versions: { section: document.getElementById('view-versions'), render: VersionsView.render },
    settings: { section: document.getElementById('view-settings'), render: SettingsView.render },
  };

  function renderAccountSwitcher(state) {
    const nameEl = document.getElementById('account-name');
    const avatarEl = document.getElementById('account-avatar');
    if (state.activeAccount) {
      nameEl.textContent = state.activeAccount.username;
      avatarEl.textContent = state.activeAccount.username.slice(0, 1).toUpperCase();
    } else {
      nameEl.textContent = '계정 추가 필요';
      avatarEl.textContent = '?';
    }
  }

  function renderCurrentView() {
    const state = Store.get();
    Object.entries(views).forEach(([name, v]) => {
      const active = name === state.view;
      v.section.hidden = !active;
      if (active) v.render(v.section);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === state.view);
    });
    renderAccountSwitcher(state);
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

  window.App = {
    refreshAccounts, refreshInstances, refreshSettings, refreshVersions, renderCurrentView,
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
    window.alert(`실행 오류: ${payload.message}`);
  });

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
  }

  init();
}());

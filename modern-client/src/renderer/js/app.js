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
      nameEl.textContent = state.sessionWarning ? `${state.activeAccount.username} · 다시 로그인 필요` : state.activeAccount.username;
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
    refreshAccounts, refreshInstances, refreshSettings, refreshVersions, forceLaunch, renderCurrentView,
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
  window.api.launch.onCompatWarning((payload) => {
    Store.set({ currentLaunch: null });
    renderCurrentView();
    showCompatWarningModal(payload);
  });

  function showCompatWarningModal({ launchId, problems }) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">실행 전 모드 호환성 문제 발견</h3>
      <p class="form-hint">아래 문제를 해결하지 않고 실행하면 마인크래프트가 제대로 동작하지 않을 수 있습니다.</p>
      <div class="problem-list">
        ${problems.map((p) => `<div class="problem-item severe">${p.message}</div>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn" id="compat-cancel">취소</button>
        <button class="btn" id="compat-manage">모드 관리로 이동</button>
        <button class="btn btn-primary" id="compat-force">그래도 실행</button>
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

window.HomeView = (function createHomeView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function phaseLabels() {
    return {
      auth: I18N.t('home.phase.auth'),
      manifest: I18N.t('home.phase.manifest'),
      libraries: I18N.t('home.phase.libraries'),
      'client-jar': I18N.t('home.phase.clientJar'),
      assets: I18N.t('home.phase.assets'),
      natives: I18N.t('home.phase.natives'),
      starting: I18N.t('home.phase.starting'),
    };
  }

  function progressPercent(launch) {
    if (!launch || !launch.total) return 0;
    return Math.min(100, Math.round((launch.current / launch.total) * 100));
  }

  function instanceOptionsHtml(instances, activeId) {
    if (!instances.length) return `<option value="">${I18N.t('home.instance.selectPlaceholder')}</option>`;
    return instances.map((inst) => `<option value="${inst.id}" ${inst.id === activeId ? 'selected' : ''}>${escapeHtml(inst.name)} (${escapeHtml(inst.versionId)})</option>`).join('');
  }

  function recentListHtml(state) {
    const recent = (state.settings && state.settings.recentLaunches) || [];
    if (!recent.length) return `<div class="empty-hint">${I18N.t('home.recent.empty')}</div>`;
    return recent.map((r) => `
      <div class="recent-item">
        <span>${escapeHtml(r.instanceName)}</span>
        <span class="recent-item-meta">${escapeHtml(r.versionId)} · ${fmtDate(r.timestamp)}</span>
      </div>
    `).join('');
  }

  function render(container) {
    const state = Store.get();
    const activeInstance = state.instances.find((i) => i.id === state.activeInstanceId) || null;
    const launch = state.currentLaunch;
    const isBusy = !!launch;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('page.home.title')}</h1>
          <p class="page-subtitle">${state.activeAccount ? I18N.t('home.welcome', { name: escapeHtml(state.activeAccount.username) }) : I18N.t('home.welcome.none')}</p>
        </div>
      </div>

      <div class="card hero-card">
        <div>
          <div class="hero-instance-name">${activeInstance ? escapeHtml(activeInstance.name) : I18N.t('home.instance.none')}</div>
          <div class="hero-instance-meta">${activeInstance ? I18N.t('home.instance.version', { version: escapeHtml(activeInstance.versionId) }) : I18N.t('home.instance.selectHint')}</div>
        </div>
        <div class="play-row">
          <select class="instance-picker" id="home-instance-select">
            ${instanceOptionsHtml(state.instances, state.activeInstanceId)}
          </select>
          <button class="play-button" id="home-play-btn" ${isBusy || !state.instances.length || !state.activeAccount ? 'disabled' : ''}>
            ${isBusy ? I18N.t('home.play.preparing') : I18N.t('home.play')}
          </button>
        </div>
        <div class="progress-wrap ${isBusy ? 'active' : ''}">
          <div class="progress-label">${launch ? (phaseLabels()[launch.phase] || launch.phase) : ''}</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${progressPercent(launch)}%"></div></div>
        </div>
        <div class="log-box">${(state.logs || []).slice(-200).map(escapeHtml).join('\n')}</div>
      </div>

      <div class="card">
        <h2 class="section-title">${I18N.t('home.recent.title')}</h2>
        <div class="recent-list">${recentListHtml(state)}</div>
      </div>
    `;

    const logBox = container.querySelector('.log-box');
    if (logBox) logBox.scrollTop = logBox.scrollHeight;

    const select = container.querySelector('#home-instance-select');
    if (select) {
      select.addEventListener('change', async () => {
        const id = select.value;
        if (!id) return;
        await window.api.instances.setActive(id);
        Store.set({ activeInstanceId: id });
      });
    }

    const playBtn = container.querySelector('#home-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async () => {
        const current = Store.get();
        if (!current.activeInstanceId) return;
        Store.set({ currentLaunch: { launchId: null, phase: 'manifest', current: 0, total: 1 }, logs: [] });
        try {
          await window.api.launch.start(current.activeInstanceId);
        } catch (err) {
          Store.set({ currentLaunch: null });
          window.alert(err.message || String(err));
        }
      });
    }
  }

  return { render };
}());

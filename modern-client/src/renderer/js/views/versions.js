window.VersionsView = (function createVersionsView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  let installed = [];
  const MIN_MC_VERSION = [1, 8, 9];

  function parseVersion(id) {
    const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(id || '');
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  }

  function isAtLeastMinVersion(id) {
    const parsed = parseVersion(id);
    if (!parsed) return false;
    for (let i = 0; i < 3; i += 1) {
      if (parsed[i] > MIN_MC_VERSION[i]) return true;
      if (parsed[i] < MIN_MC_VERSION[i]) return false;
    }
    return true;
  }

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('page.versions.title')}</h1>
          <p class="page-subtitle">${I18N.t('page.versions.subtitle')}</p>
        </div>
        <button class="btn btn-primary" id="install-version-btn">${I18N.t('versions.installBtn')}</button>
      </div>
      <div class="recent-list" id="installed-version-list">
        <div class="empty-hint">${I18N.t('common.loading')}</div>
      </div>
    `;

    container.querySelector('#install-version-btn').addEventListener('click', openInstallModal);

    try {
      installed = await window.api.versions.listInstalled(true);
    } catch (err) {
      installed = [];
    }
    renderList(container);
  }

  function versionLabel(v) {
    return v.loaderVersion ? `${v.mcVersion || v.versionId} (${v.loaderVersion})` : (v.mcVersion || v.versionId);
  }

  function renderList(container) {
    const list = container.querySelector('#installed-version-list');
    if (!list) return;
    if (!installed.length) {
      list.innerHTML = `<div class="empty-hint">${I18N.t('versions.empty')}</div>`;
      return;
    }
    list.innerHTML = '';
    installed.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'recent-item';
      row.innerHTML = `
        <span>
          <span class="badge">${escapeHtml(window.LOADER_LABELS[v.loader] || v.loader)}</span>
          &nbsp;${escapeHtml(versionLabel(v))}
        </span>
        <span class="recent-item-meta">
          ${fmtBytes(v.sizeBytes)} · ${fmtDate(v.installedAt)}
          <button class="btn btn-sm btn-danger delete-version-btn">${I18N.t('common.delete')}</button>
        </span>
      `;
      row.querySelector('.delete-version-btn').addEventListener('click', async () => {
        if (!window.confirm(I18N.t('versions.deleteConfirm', { id: versionLabel(v) }))) return;
        await window.api.versions.deleteInstalled(v.versionId);
        installed = await window.api.versions.listInstalled(true);
        renderList(document.getElementById('view-versions'));
      });
      list.appendChild(row);
    });
  }

  async function openInstallModal() {
    const state = Store.get();
    let manifestVersions = state.versions.versions;
    if (!manifestVersions.length) {
      try {
        const list = await window.api.versions.list();
        Store.set({ versions: list });
        manifestVersions = list.versions;
      } catch (err) {
        window.alert(I18N.t('versions.fetchFailed', { error: err.message }));
        return;
      }
    }
    const releaseVersions = manifestVersions.filter((v) => v.type === 'release' && isAtLeastMinVersion(v.id));

    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('versions.modal.title')}</h3>
      <div class="form-row">
        <label class="form-label">${I18N.t('versions.modal.loader')}</label>
        <select class="form-select" id="install-loader">
          <option value="fabric">Fabric</option>
          <option value="forge">Forge</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">${I18N.t('versions.modal.mcVersion')}</label>
        <select class="form-select" id="install-mc-version">
          ${releaseVersions.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.id)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row" id="install-loader-version-row">
        <label class="form-label">${I18N.t('versions.modal.loaderVersion')}</label>
        <select class="form-select" id="install-loader-version"></select>
      </div>
      <div class="progress-wrap" id="install-progress-wrap">
        <div class="progress-label" id="install-progress-label"></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="install-progress-fill" style="width:0%"></div></div>
      </div>
      <div class="error-text" id="install-error"></div>
      <div class="modal-actions">
        <button class="btn" id="cancel-install-version">${I18N.t('common.cancel')}</button>
        <button class="btn btn-primary" id="submit-install-version">${I18N.t('versions.modal.install')}</button>
      </div>
    `;
    Modal.open(node);

    const loaderSelect = node.querySelector('#install-loader');
    const mcVersionSelect = node.querySelector('#install-mc-version');
    const loaderVersionSelect = node.querySelector('#install-loader-version');
    const errorEl = node.querySelector('#install-error');
    const progressWrap = node.querySelector('#install-progress-wrap');
    const progressLabel = node.querySelector('#install-progress-label');
    const progressFill = node.querySelector('#install-progress-fill');
    const submitBtn = node.querySelector('#submit-install-version');

    async function refreshLoaderVersions() {
      const loader = loaderSelect.value;
      const mcVersion = mcVersionSelect.value;
      loaderVersionSelect.innerHTML = `<option>${I18N.t('common.loading')}</option>`;
      try {
        if (loader === 'fabric') {
          const versions = await window.api.versions.listFabricLoaders(mcVersion);
          loaderVersionSelect.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.loaderVersion)}">${escapeHtml(v.loaderVersion)}${v.stable ? '' : I18N.t('versions.modal.beta')}</option>`).join('');
        } else {
          const versions = await window.api.versions.listForgeVersions(mcVersion);
          if (!versions.length) {
            loaderVersionSelect.innerHTML = `<option value="">${I18N.t('versions.modal.forgeUnsupported')}</option>`;
          } else {
            loaderVersionSelect.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.forgeVersion)}">${escapeHtml(v.forgeVersion)} (${v.label})</option>`).join('');
          }
        }
      } catch (err) {
        loaderVersionSelect.innerHTML = `<option value="">${I18N.t('versions.modal.loadFailed')}</option>`;
      }
    }

    loaderSelect.addEventListener('change', refreshLoaderVersions);
    mcVersionSelect.addEventListener('change', refreshLoaderVersions);
    refreshLoaderVersions();

    const offProgress = window.api.versions.onInstallProgress((p) => {
      progressWrap.classList.add('active');
      const percent = p.total ? Math.min(100, Math.round((p.current / p.total) * 100)) : 0;
      progressFill.style.width = `${percent}%`;
      progressLabel.textContent = p.fileName ? `${p.phase}: ${p.fileName}` : p.phase;
    });

    function cleanup() {
      offProgress();
    }

    node.querySelector('#cancel-install-version').addEventListener('click', () => {
      cleanup();
      Modal.close();
    });

    submitBtn.addEventListener('click', async () => {
      errorEl.textContent = '';
      submitBtn.disabled = true;
      const loader = loaderSelect.value;
      const mcVersion = mcVersionSelect.value;
      try {
        if (loader === 'fabric') {
          await window.api.versions.installFabric(mcVersion, loaderVersionSelect.value);
        } else {
          if (!loaderVersionSelect.value) throw new Error(I18N.t('versions.modal.noForgeVersions'));
          await window.api.versions.installForge(mcVersion, loaderVersionSelect.value);
        }
        cleanup();
        Modal.close();
        window.App.refreshVersions();
      } catch (err) {
        errorEl.textContent = err.message || String(err);
        submitBtn.disabled = false;
      }
    });
  }

  return { render };
}());

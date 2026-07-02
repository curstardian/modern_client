window.VersionsView = (function createVersionsView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  let installed = [];

  async function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Versions</h1>
          <p class="page-subtitle">설치된 바닐라/Fabric/Forge 버전을 관리하세요</p>
        </div>
        <button class="btn btn-primary" id="install-version-btn">+ 새 버전 설치</button>
      </div>
      <div class="recent-list" id="installed-version-list">
        <div class="empty-hint">불러오는 중...</div>
      </div>
    `;

    container.querySelector('#install-version-btn').addEventListener('click', openInstallModal);

    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    renderList(container);
  }

  function renderList(container) {
    const list = container.querySelector('#installed-version-list');
    if (!list) return;
    if (!installed.length) {
      list.innerHTML = '<div class="empty-hint">설치된 버전이 없습니다. 새 버전을 설치해보세요.</div>';
      return;
    }
    list.innerHTML = '';
    installed.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'recent-item';
      row.innerHTML = `
        <span>
          <span class="badge">${escapeHtml(window.LOADER_LABELS[v.loader] || v.loader)}</span>
          &nbsp;${escapeHtml(v.versionId)}
        </span>
        <span class="recent-item-meta">
          ${escapeHtml(v.mcVersion || '')} · ${fmtBytes(v.sizeBytes)} · ${fmtDate(v.installedAt)}
          <button class="btn btn-sm btn-danger delete-version-btn">삭제</button>
        </span>
      `;
      row.querySelector('.delete-version-btn').addEventListener('click', async () => {
        if (!window.confirm(`"${v.versionId}" 버전을 삭제할까요?`)) return;
        await window.api.versions.deleteInstalled(v.versionId);
        installed = await window.api.versions.listInstalled();
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
        window.alert('버전 목록을 불러오지 못했습니다: ' + err.message);
        return;
      }
    }
    const releaseVersions = manifestVersions.filter((v) => v.type === 'release');

    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">새 버전 설치</h3>
      <div class="form-row">
        <label class="form-label">로더</label>
        <select class="form-select" id="install-loader">
          <option value="vanilla">바닐라</option>
          <option value="fabric">Fabric</option>
          <option value="forge">Forge</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">마인크래프트 버전</label>
        <select class="form-select" id="install-mc-version">
          ${releaseVersions.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.id)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row" id="install-loader-version-row" hidden>
        <label class="form-label">로더 버전</label>
        <select class="form-select" id="install-loader-version"></select>
      </div>
      <div class="progress-wrap" id="install-progress-wrap">
        <div class="progress-label" id="install-progress-label"></div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="install-progress-fill" style="width:0%"></div></div>
      </div>
      <div class="error-text" id="install-error"></div>
      <div class="modal-actions">
        <button class="btn" id="cancel-install-version">취소</button>
        <button class="btn btn-primary" id="submit-install-version">설치</button>
      </div>
    `;
    Modal.open(node);

    const loaderSelect = node.querySelector('#install-loader');
    const mcVersionSelect = node.querySelector('#install-mc-version');
    const loaderVersionRow = node.querySelector('#install-loader-version-row');
    const loaderVersionSelect = node.querySelector('#install-loader-version');
    const errorEl = node.querySelector('#install-error');
    const progressWrap = node.querySelector('#install-progress-wrap');
    const progressLabel = node.querySelector('#install-progress-label');
    const progressFill = node.querySelector('#install-progress-fill');
    const submitBtn = node.querySelector('#submit-install-version');

    async function refreshLoaderVersions() {
      const loader = loaderSelect.value;
      const mcVersion = mcVersionSelect.value;
      if (loader === 'vanilla') {
        loaderVersionRow.hidden = true;
        return;
      }
      loaderVersionRow.hidden = false;
      loaderVersionSelect.innerHTML = '<option>불러오는 중...</option>';
      try {
        if (loader === 'fabric') {
          const versions = await window.api.versions.listFabricLoaders(mcVersion);
          loaderVersionSelect.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.loaderVersion)}">${escapeHtml(v.loaderVersion)}${v.stable ? '' : ' (베타)'}</option>`).join('');
        } else {
          const versions = await window.api.versions.listForgeVersions(mcVersion);
          if (!versions.length) {
            loaderVersionSelect.innerHTML = '<option value="">이 버전은 Forge를 지원하지 않습니다</option>';
          } else {
            loaderVersionSelect.innerHTML = versions.map((v) => `<option value="${escapeHtml(v.forgeVersion)}">${escapeHtml(v.forgeVersion)} (${v.label})</option>`).join('');
          }
        }
      } catch (err) {
        loaderVersionSelect.innerHTML = '<option value="">목록을 불러오지 못했습니다</option>';
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
        if (loader === 'vanilla') {
          await window.api.versions.installVanilla(mcVersion);
        } else if (loader === 'fabric') {
          await window.api.versions.installFabric(mcVersion, loaderVersionSelect.value);
        } else {
          if (!loaderVersionSelect.value) throw new Error('설치 가능한 Forge 버전이 없습니다.');
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

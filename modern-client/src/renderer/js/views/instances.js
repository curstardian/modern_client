window.InstancesView = (function createInstancesView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function render(container) {
    const state = Store.get();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Instances</h1>
          <p class="page-subtitle">버전별 인스턴스를 만들고 관리하세요</p>
        </div>
        <button class="btn btn-primary" id="create-instance-btn">+ 새 인스턴스</button>
      </div>
      <div class="instance-grid" id="instance-grid"></div>
    `;

    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const loaderById = new Map(installed.map((v) => [v.versionId, v.loader]));

    const grid = container.querySelector('#instance-grid');
    if (!state.instances.length) {
      grid.innerHTML = '<div class="empty-hint">아직 생성된 인스턴스가 없습니다. 새 인스턴스를 만들어보세요.</div>';
    } else {
      grid.innerHTML = '';
      state.instances.forEach((inst) => grid.appendChild(buildCard(inst, state.activeInstanceId, loaderById)));
    }

    container.querySelector('#create-instance-btn').addEventListener('click', openCreateModal);
  }

  function buildCard(inst, activeId, loaderById) {
    const loader = loaderById.get(inst.versionId) || 'vanilla';
    const card = document.createElement('div');
    card.className = `instance-card${inst.id === activeId ? ' selected' : ''}`;
    card.innerHTML = `
      <span class="badge">${escapeHtml(window.LOADER_LABELS[loader] || loader)} · ${escapeHtml(inst.versionId)}</span>
      <div class="instance-card-name">${escapeHtml(inst.name)}</div>
      <div class="instance-card-version">생성일 ${fmtDate(inst.createdAt)}</div>
      <div class="instance-card-actions">
        <button class="btn btn-sm select-btn">선택</button>
        <button class="btn btn-sm manage-btn">관리</button>
        <button class="btn btn-sm btn-danger delete-btn">삭제</button>
      </div>
    `;
    card.querySelector('.select-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.instances.setActive(inst.id);
      Store.set({ activeInstanceId: inst.id });
      window.App.refreshInstances();
    });
    card.querySelector('.manage-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openManageModal(inst, loader);
    });
    card.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!window.confirm(`"${inst.name}" 인스턴스를 삭제할까요?`)) return;
      await window.api.instances.remove(inst.id);
      window.App.refreshInstances();
    });
    return card;
  }

  async function openCreateModal() {
    const state = Store.get();
    let versions = state.versions.versions;
    if (!versions.length) {
      try {
        const list = await window.api.versions.list();
        Store.set({ versions: list });
        versions = list.versions;
      } catch (err) {
        window.alert('버전 목록을 불러오지 못했습니다: ' + err.message);
        return;
      }
    }
    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const installedIds = new Set(installed.map((v) => v.versionId));

    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">새 인스턴스</h3>
      <div class="form-row">
        <label class="form-label">이름</label>
        <input class="form-input" id="new-instance-name" placeholder="예: 나만의 서버용" />
      </div>
      <div class="form-row">
        <label class="form-label">
          <input type="checkbox" id="show-snapshots" /> 스냅샷 포함
        </label>
        <select class="form-select" id="new-instance-version"></select>
      </div>
      <div class="error-text" id="create-instance-error"></div>
      <div class="modal-actions">
        <button class="btn" id="cancel-create-instance">취소</button>
        <button class="btn btn-primary" id="submit-create-instance">만들기</button>
      </div>
    `;
    Modal.open(node);

    const versionSelect = node.querySelector('#new-instance-version');
    const snapshotCheck = node.querySelector('#show-snapshots');

    function fillVersions() {
      const installedOptions = installed.map((v) => `<option value="${escapeHtml(v.versionId)}">${escapeHtml(v.versionId)} (${escapeHtml(window.LOADER_LABELS[v.loader] || v.loader)})</option>`).join('');
      const downloadable = versions.filter((v) => !installedIds.has(v.id) && (snapshotCheck.checked || v.type === 'release'));
      const downloadableOptions = downloadable.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.id)} (${v.type})</option>`).join('');
      versionSelect.innerHTML = `
        ${installedOptions ? `<optgroup label="설치됨">${installedOptions}</optgroup>` : ''}
        <optgroup label="다운로드 가능 (바닐라)">${downloadableOptions}</optgroup>
      `;
    }
    snapshotCheck.addEventListener('change', fillVersions);
    fillVersions();

    node.querySelector('#cancel-create-instance').addEventListener('click', () => Modal.close());
    node.querySelector('#submit-create-instance').addEventListener('click', async () => {
      const name = node.querySelector('#new-instance-name').value.trim();
      const versionId = versionSelect.value;
      const errorEl = node.querySelector('#create-instance-error');
      try {
        await window.api.instances.create({ name, versionId });
        Modal.close();
        window.App.refreshInstances();
      } catch (err) {
        errorEl.textContent = err.message || String(err);
      }
    });
  }

  async function openManageModal(inst, loader) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${escapeHtml(inst.name)} 관리</h3>
      <p class="form-hint">버전 ${escapeHtml(inst.versionId)} · ${escapeHtml(window.LOADER_LABELS[loader] || loader)}</p>
      <div id="manage-body"></div>
      <div class="modal-actions">
        <button class="btn" id="close-manage-modal">닫기</button>
      </div>
    `;
    Modal.open(node, { large: true });
    node.querySelector('#close-manage-modal').addEventListener('click', () => Modal.close());

    const body = node.querySelector('#manage-body');
    if (loader === 'vanilla') {
      body.innerHTML = '<div class="empty-hint">바닐라 인스턴스에는 모드를 설치할 수 없습니다. Versions 화면에서 Fabric/Forge 버전을 설치한 뒤 해당 버전으로 인스턴스를 만들어보세요.</div>';
      return;
    }

    body.innerHTML = `
      <div class="mod-search-row">
        <select class="form-select" id="mod-source" style="width:140px">
          <option value="modrinth">Modrinth</option>
          <option value="curseforge">CurseForge</option>
        </select>
        <input class="form-input" id="mod-search-input" placeholder="모드 이름 검색..." />
        <button class="btn btn-primary" id="mod-search-btn">검색</button>
      </div>
      <div class="error-text" id="mod-search-error"></div>
      <div class="mod-list" id="mod-search-results"></div>
      <h2 class="section-title" style="margin-top:12px">설치된 모드</h2>
      <div class="mod-list" id="mod-installed-list"></div>
    `;

    const sourceSelect = body.querySelector('#mod-source');
    const searchInput = body.querySelector('#mod-search-input');
    const searchBtn = body.querySelector('#mod-search-btn');
    const searchError = body.querySelector('#mod-search-error');
    const resultsList = body.querySelector('#mod-search-results');
    const installedList = body.querySelector('#mod-installed-list');

    async function refreshInstalled() {
      const mods = await window.api.mods.listInstalled(inst.id);
      if (!mods.length) {
        installedList.innerHTML = '<div class="empty-hint">설치된 모드가 없습니다.</div>';
        return;
      }
      installedList.innerHTML = '';
      mods.forEach((mod) => installedList.appendChild(buildInstalledModRow(inst, mod, refreshInstalled)));
    }

    async function doSearch() {
      searchError.textContent = '';
      resultsList.innerHTML = '<div class="empty-hint">검색 중...</div>';
      try {
        const results = await window.api.mods.search(inst.id, sourceSelect.value, searchInput.value.trim());
        if (!results.length) {
          resultsList.innerHTML = '<div class="empty-hint">검색 결과가 없습니다.</div>';
          return;
        }
        resultsList.innerHTML = '';
        results.forEach((mod) => resultsList.appendChild(buildSearchResultRow(inst, mod, refreshInstalled)));
      } catch (err) {
        resultsList.innerHTML = '';
        searchError.textContent = err.message || String(err);
      }
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    await refreshInstalled();
  }

  function buildSearchResultRow(inst, mod, onInstalled) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      ${mod.iconUrl ? `<img class="mod-icon" src="${escapeHtml(mod.iconUrl)}" />` : '<div class="mod-icon"></div>'}
      <div class="mod-info">
        <div class="mod-name">${escapeHtml(mod.name)}</div>
        <div class="mod-summary">${escapeHtml(mod.summary || '')}</div>
      </div>
      <div class="mod-actions">
        <button class="btn btn-sm btn-primary install-btn">설치</button>
      </div>
    `;
    const installBtn = row.querySelector('.install-btn');
    installBtn.addEventListener('click', async () => {
      installBtn.disabled = true;
      installBtn.textContent = '설치 중...';
      try {
        const result = await window.api.mods.install(inst.id, mod.source, mod.id);
        if (result.blocked && result.blocked.length) {
          const lines = result.blocked.map((b) => (b.webUrl ? `${b.fileName || b.modId}: ${b.webUrl}` : `${b.modId}: ${b.error || '설치 불가'}`));
          window.alert(`일부 모드는 자동 설치할 수 없습니다:\n${lines.join('\n')}`);
        }
        installBtn.textContent = '설치됨';
        await onInstalled();
      } catch (err) {
        installBtn.disabled = false;
        installBtn.textContent = '설치';
        window.alert(err.message || String(err));
      }
    });
    return row;
  }

  function buildInstalledModRow(inst, mod, onChange) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      <div class="mod-icon"></div>
      <div class="mod-info">
        <div class="mod-name">
          ${escapeHtml(mod.fileName)}
          ${mod.essential ? '<span class="mod-lock" title="Modern Client 실행에 필요">🔒</span>' : ''}
          ${!mod.present ? '<span class="badge" style="background:#fee2e2;color:#b91c1c">파일 없음</span>' : ''}
        </div>
        <div class="mod-summary">${escapeHtml(mod.source)} · ${mod.enabled ? '활성' : '비활성'}</div>
      </div>
      <div class="mod-actions">
        <button class="btn btn-sm toggle-btn">${mod.enabled ? '비활성화' : '활성화'}</button>
        <button class="btn btn-sm btn-danger remove-btn">삭제</button>
      </div>
    `;
    const toggleBtn = row.querySelector('.toggle-btn');
    const removeBtn = row.querySelector('.remove-btn');
    if (mod.essential) {
      toggleBtn.disabled = true;
      removeBtn.disabled = true;
      toggleBtn.title = '필수 모드는 비활성화할 수 없습니다';
      removeBtn.title = '필수 모드는 삭제할 수 없습니다';
    }
    toggleBtn.addEventListener('click', async () => {
      try {
        await window.api.mods.setEnabled(inst.id, mod.id, !mod.enabled);
        await onChange();
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });
    removeBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${mod.fileName}"을(를) 삭제할까요?`)) return;
      try {
        await window.api.mods.remove(inst.id, mod.id);
        await onChange();
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });
    return row;
  }

  return { render };
}());

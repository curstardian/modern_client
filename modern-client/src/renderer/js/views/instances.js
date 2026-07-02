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
        <button class="btn btn-sm btn-danger delete-btn">삭제</button>
      </div>
    `;
    card.querySelector('.select-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.instances.setActive(inst.id);
      Store.set({ activeInstanceId: inst.id });
      window.App.refreshInstances();
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

  return { render };
}());

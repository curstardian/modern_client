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
          <h1 class="page-title">${I18N.t('page.instances.title')}</h1>
          <p class="page-subtitle">${I18N.t('page.instances.subtitle')}</p>
        </div>
        <button class="btn btn-primary" id="create-instance-btn">${I18N.t('instances.createBtn')}</button>
      </div>
      <div class="instance-grid" id="instance-grid"></div>
    `;

    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const metaById = new Map(installed.map((v) => [v.versionId, v]));

    const grid = container.querySelector('#instance-grid');
    if (!state.instances.length) {
      grid.innerHTML = `<div class="empty-hint">${I18N.t('instances.empty')}</div>`;
    } else {
      grid.innerHTML = '';
      state.instances.forEach((inst) => grid.appendChild(buildCard(inst, state.activeInstanceId, metaById)));
    }

    container.querySelector('#create-instance-btn').addEventListener('click', openCreateModal);
  }

  function versionLabel(meta, fallbackId) {
    if (!meta) return fallbackId;
    return meta.loaderVersion ? `${meta.mcVersion || fallbackId} (${meta.loaderVersion})` : (meta.mcVersion || fallbackId);
  }

  function buildCard(inst, activeId, metaById) {
    const meta = metaById.get(inst.versionId);
    const loader = (meta && meta.loader) || 'vanilla';
    const card = document.createElement('div');
    card.className = `instance-card${inst.id === activeId ? ' selected' : ''}`;
    card.innerHTML = `
      <span class="badge">${escapeHtml(window.LOADER_LABELS[loader] || loader)} · ${escapeHtml(versionLabel(meta, inst.versionId))}</span>
      <div class="instance-card-name">${escapeHtml(inst.name)}</div>
      <div class="instance-card-version">${I18N.t('instances.card.createdAt', { date: fmtDate(inst.createdAt) })}</div>
      <div class="instance-card-actions">
        <button class="btn btn-sm select-btn">${I18N.t('instances.card.select')}</button>
        <button class="btn btn-sm manage-btn">${I18N.t('instances.card.manage')}</button>
        <button class="btn btn-sm btn-danger delete-btn">${I18N.t('instances.card.delete')}</button>
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
      openManageModal(inst, loader, meta);
    });
    card.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!window.confirm(I18N.t('instances.deleteConfirm', { name: inst.name }))) return;
      await window.api.instances.remove(inst.id);
      window.App.refreshInstances();
      window.App.refreshModAvailability();
    });
    return card;
  }

  async function openCreateModal() {
    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const moddedInstalled = installed.filter((v) => v.loader === 'fabric' || v.loader === 'forge');

    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('instances.modal.title')}</h3>
      <div class="form-row">
        <label class="form-label">${I18N.t('instances.modal.name')}</label>
        <input class="form-input" id="new-instance-name" placeholder="${I18N.t('instances.modal.namePlaceholder')}" />
      </div>
      <div class="form-row">
        <label class="form-label">${I18N.t('instances.modal.version')}</label>
        ${moddedInstalled.length
    ? `<select class="form-select" id="new-instance-version">
            ${moddedInstalled.map((v) => `<option value="${escapeHtml(v.versionId)}">${escapeHtml(window.LOADER_LABELS[v.loader] || v.loader)} · ${escapeHtml(versionLabel(v, v.versionId))}</option>`).join('')}
          </select>`
    : `<div class="empty-hint">${I18N.t('instances.modal.noModdedVersions')}</div>`}
      </div>
      <div class="error-text" id="create-instance-error"></div>
      <div class="modal-actions">
        <button class="btn" id="cancel-create-instance">${I18N.t('common.cancel')}</button>
        <button class="btn btn-primary" id="submit-create-instance" ${moddedInstalled.length ? '' : 'disabled'}>${I18N.t('instances.modal.create')}</button>
      </div>
    `;
    Modal.open(node);

    const versionSelect = node.querySelector('#new-instance-version');

    node.querySelector('#cancel-create-instance').addEventListener('click', () => Modal.close());
    node.querySelector('#submit-create-instance').addEventListener('click', async () => {
      const name = node.querySelector('#new-instance-name').value.trim();
      const versionId = versionSelect ? versionSelect.value : '';
      const errorEl = node.querySelector('#create-instance-error');
      try {
        await window.api.instances.create({ name, versionId });
        Modal.close();
        window.App.refreshInstances();
        window.App.refreshModAvailability();
      } catch (err) {
        errorEl.textContent = err.message || String(err);
      }
    });
  }

  function openManageModal(inst, loader, meta) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('instances.manage.title', { name: escapeHtml(inst.name) })}</h3>
      <p class="form-hint">${I18N.t('instances.manage.versionInfo', { version: escapeHtml(versionLabel(meta, inst.versionId)), loader: escapeHtml(window.LOADER_LABELS[loader] || loader) })}</p>
      <div id="manage-body"></div>
      <div class="modal-actions">
        <button class="btn" id="close-manage-modal">${I18N.t('common.close')}</button>
      </div>
    `;
    Modal.open(node, { large: true });
    node.querySelector('#close-manage-modal').addEventListener('click', () => Modal.close());
    ModPanel.render(node.querySelector('#manage-body'), inst, loader);
  }

  return { render };
}());

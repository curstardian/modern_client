window.ModsView = (function createModsView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function render(container) {
    const state = Store.get();
    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const metaById = new Map(installed.map((v) => [v.versionId, v]));
    const loaderById = new Map(installed.map((v) => [v.versionId, v.loader]));
    const moddedInstances = state.instances.filter((i) => (loaderById.get(i.versionId) || 'vanilla') !== 'vanilla');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('page.mods.title')}</h1>
          <p class="page-subtitle">${I18N.t('page.mods.subtitle')}</p>
        </div>
      </div>
      <div class="card">
        <div class="form-row">
          <label class="form-label">${I18N.t('common.instanceLabel')}</label>
          <select class="form-select" id="mods-instance-select"></select>
        </div>
        <div id="mods-panel-body"></div>
      </div>
    `;

    const select = container.querySelector('#mods-instance-select');
    const panelBody = container.querySelector('#mods-panel-body');

    if (!moddedInstances.length) {
      select.innerHTML = `<option value="">${I18N.t('mods.noModdedInstance')}</option>`;
      ModPanel.render(panelBody, null, null);
      return;
    }

    select.innerHTML = moddedInstances.map((i) => {
      const meta = metaById.get(i.versionId);
      const label = meta && meta.loaderVersion ? `${meta.mcVersion || i.versionId} (${meta.loaderVersion})` : (meta && meta.mcVersion) || i.versionId;
      return `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} (${escapeHtml(label)})</option>`;
    }).join('');

    function renderPanel() {
      const inst = moddedInstances.find((i) => i.id === select.value) || moddedInstances[0];
      const loader = loaderById.get(inst.versionId) || 'vanilla';
      ModPanel.render(panelBody, inst, loader);
    }
    select.addEventListener('change', renderPanel);
    renderPanel();
  }

  return { render };
}());

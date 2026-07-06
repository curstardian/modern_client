window.ResourcePacksView = (function createResourcePacksView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function render(container) {
    const state = Store.get();
    const { instances } = state;
    let installed = [];
    try {
      installed = await window.api.versions.listInstalled();
    } catch (err) {
      installed = [];
    }
    const metaById = new Map(installed.map((v) => [v.versionId, v]));

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('page.resourcepacks.title')}</h1>
          <p class="page-subtitle">${I18N.t('page.resourcepacks.subtitle')}</p>
        </div>
      </div>
      <div class="card">
        <div class="form-row">
          <label class="form-label">${I18N.t('common.instanceLabel')}</label>
          <select class="form-select" id="rp-instance-select"></select>
        </div>
        <div id="rp-panel-body"></div>
      </div>
    `;

    const select = container.querySelector('#rp-instance-select');
    const panelBody = container.querySelector('#rp-panel-body');

    if (!instances.length) {
      select.innerHTML = `<option value="">${I18N.t('resourcepacks.noInstance')}</option>`;
      ResourcePackPanel.render(panelBody, null);
      return;
    }

    select.innerHTML = instances.map((i) => {
      const meta = metaById.get(i.versionId);
      const label = meta && meta.loaderVersion ? `${meta.mcVersion || i.versionId} (${meta.loaderVersion})` : (meta && meta.mcVersion) || i.versionId;
      return `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} (${escapeHtml(label)})</option>`;
    }).join('');

    function renderPanel() {
      const inst = instances.find((i) => i.id === select.value) || instances[0];
      ResourcePackPanel.render(panelBody, inst);
    }
    select.addEventListener('change', renderPanel);
    renderPanel();
  }

  return { render };
}());

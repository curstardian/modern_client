window.ResourcePackPanel = (function createResourcePackPanel() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render(container, inst) {
    if (!inst) {
      container.innerHTML = `<div class="empty-hint">${I18N.t('rp.noInstance')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="mod-search-row">
        <select class="form-select" id="rp-source" style="width:140px">
          <option value="modrinth">Modrinth</option>
          <option value="curseforge">CurseForge</option>
        </select>
        <input class="form-input" id="rp-search-input" placeholder="${I18N.t('rp.searchPlaceholder')}" />
        <button class="btn btn-primary" id="rp-search-btn">${I18N.t('common.search')}</button>
      </div>
      <div class="error-text" id="rp-search-error"></div>
      <div class="mod-list" id="rp-search-results"></div>
      <div class="form-inline" style="justify-content:space-between;align-items:center;margin-top:12px">
        <h2 class="section-title" style="margin:0">${I18N.t('rp.installedTitle')}</h2>
        <button class="btn btn-sm" id="rp-open-folder-btn">${I18N.t('rp.openFolder')}</button>
      </div>
      <div class="mod-list" id="rp-installed-list"></div>
    `;

    container.querySelector('#rp-open-folder-btn').addEventListener('click', () => {
      window.api.resourcepacks.openFolder(inst.id);
    });

    const sourceSelect = container.querySelector('#rp-source');
    const searchInput = container.querySelector('#rp-search-input');
    const searchBtn = container.querySelector('#rp-search-btn');
    const searchError = container.querySelector('#rp-search-error');
    const resultsList = container.querySelector('#rp-search-results');
    const installedList = container.querySelector('#rp-installed-list');

    async function refreshInstalled() {
      const packs = await window.api.resourcepacks.listInstalled(inst.id);
      if (!packs.length) {
        installedList.innerHTML = `<div class="empty-hint">${I18N.t('rp.empty')}</div>`;
        return;
      }
      installedList.innerHTML = '';
      packs.forEach((pack) => installedList.appendChild(buildInstalledRow(inst, pack, refreshInstalled)));
    }

    async function doSearch() {
      searchError.textContent = '';
      resultsList.innerHTML = `<div class="empty-hint">${I18N.t('common.searching')}</div>`;
      try {
        const results = await window.api.resourcepacks.search(inst.id, sourceSelect.value, searchInput.value.trim());
        if (!results.length) {
          resultsList.innerHTML = `<div class="empty-hint">${I18N.t('modpanel.noResults')}</div>`;
          return;
        }
        resultsList.innerHTML = '';
        results.forEach((pack) => resultsList.appendChild(buildSearchRow(inst, pack, refreshInstalled)));
      } catch (err) {
        resultsList.innerHTML = '';
        searchError.textContent = err.message || String(err);
      }
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    refreshInstalled();
  }

  function buildSearchRow(inst, pack, onInstalled) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      ${pack.iconUrl ? `<img class="mod-icon" src="${escapeHtml(pack.iconUrl)}" referrerpolicy="no-referrer" />` : '<div class="mod-icon"></div>'}
      <div class="mod-info">
        <div class="mod-name">${escapeHtml(pack.name)}</div>
        <div class="mod-summary">${escapeHtml(pack.summary || '')}</div>
      </div>
      <div class="mod-actions">
        <button class="btn btn-sm btn-primary install-btn">${I18N.t('common.install')}</button>
      </div>
    `;
    const installBtn = row.querySelector('.install-btn');
    installBtn.addEventListener('click', async () => {
      installBtn.disabled = true;
      installBtn.textContent = I18N.t('common.installing');
      try {
        const result = await window.api.resourcepacks.install(inst.id, pack.source, pack.id);
        if (result.blocked) {
          window.alert(result.blocked.webUrl
            ? I18N.t('rp.blockedWebsite', { url: result.blocked.webUrl })
            : I18N.t('rp.blockedGeneric'));
        }
        installBtn.textContent = I18N.t('common.installed');
        await onInstalled();
      } catch (err) {
        installBtn.disabled = false;
        installBtn.textContent = I18N.t('common.install');
        window.alert(err.message || String(err));
      }
    });
    return row;
  }

  function buildInstalledRow(inst, pack, onChange) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      <div class="mod-icon"></div>
      <div class="mod-info">
        <div class="mod-name">
          ${escapeHtml(pack.fileName)}
          ${!pack.present ? `<span class="badge" style="background:#fee2e2;color:#b91c1c">${I18N.t('common.noFile')}</span>` : ''}
        </div>
        <div class="mod-summary">${escapeHtml(pack.source)} · ${pack.enabled ? I18N.t('common.enabled') : I18N.t('common.disabled')}</div>
      </div>
      <div class="mod-actions">
        <button class="btn btn-sm toggle-btn">${pack.enabled ? I18N.t('common.disable') : I18N.t('common.enable')}</button>
        <button class="btn btn-sm btn-danger remove-btn">${I18N.t('common.delete')}</button>
      </div>
    `;
    row.querySelector('.toggle-btn').addEventListener('click', async () => {
      try {
        await window.api.resourcepacks.setEnabled(inst.id, pack.id, !pack.enabled);
        await onChange();
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });
    row.querySelector('.remove-btn').addEventListener('click', async () => {
      if (!window.confirm(I18N.t('rp.removeConfirm', { name: pack.fileName }))) return;
      try {
        await window.api.resourcepacks.remove(inst.id, pack.id);
        await onChange();
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });
    return row;
  }

  return { render };
}());

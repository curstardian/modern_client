window.ModPanel = (function createModPanel() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render(container, inst, loader) {
    if (!inst) {
      container.innerHTML = `<div class="empty-hint">${I18N.t('modpanel.noInstance')}</div>`;
      return;
    }
    if (loader === 'vanilla') {
      container.innerHTML = `<div class="empty-hint">${I18N.t('modpanel.vanillaBlocked')}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="mod-search-row">
        <select class="form-select" id="mod-source" style="width:140px">
          <option value="modrinth">Modrinth</option>
          <option value="curseforge">CurseForge</option>
        </select>
        <input class="form-input" id="mod-search-input" placeholder="${I18N.t('modpanel.searchPlaceholder')}" />
        <button class="btn btn-primary" id="mod-search-btn">${I18N.t('common.search')}</button>
      </div>
      <div class="error-text" id="mod-search-error"></div>
      <div class="mod-list" id="mod-search-results"></div>
      <div class="form-inline" style="justify-content:space-between;align-items:center;margin-top:12px">
        <h2 class="section-title" style="margin:0">${I18N.t('modpanel.installedTitle')}</h2>
        <span>
          <button class="btn btn-sm" id="mod-upload-btn">${I18N.t('modpanel.uploadLocal')}</button>
          <button class="btn btn-sm" id="mod-import-local-btn">${I18N.t('modpanel.importLocal')}</button>
          <button class="btn btn-sm" id="mod-open-folder-btn">${I18N.t('modpanel.openFolder')}</button>
        </span>
      </div>
      <div class="mod-list" id="mod-installed-list"></div>
    `;

    container.querySelector('#mod-open-folder-btn').addEventListener('click', () => {
      window.api.mods.openFolder(inst.id);
    });

    async function handleLocalImportResult(result) {
      if (result.imported && result.imported.length) await refreshInstalled();
      if (result.incompatible && result.incompatible.length) {
        showIncompatibleModsModal(inst, result.incompatible, refreshInstalled);
      }
    }

    container.querySelector('#mod-import-local-btn').addEventListener('click', async () => {
      try {
        const result = await window.api.mods.importLocal(inst.id);
        await handleLocalImportResult(result);
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });

    container.querySelector('#mod-upload-btn').addEventListener('click', async () => {
      try {
        const result = await window.api.mods.uploadLocal(inst.id);
        await handleLocalImportResult(result);
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });

    const sourceSelect = container.querySelector('#mod-source');
    const searchInput = container.querySelector('#mod-search-input');
    const searchBtn = container.querySelector('#mod-search-btn');
    const searchError = container.querySelector('#mod-search-error');
    const resultsList = container.querySelector('#mod-search-results');
    const installedList = container.querySelector('#mod-installed-list');

    async function refreshInstalled() {
      const mods = await window.api.mods.listInstalled(inst.id);
      if (!mods.length) {
        installedList.innerHTML = `<div class="empty-hint">${I18N.t('modpanel.empty')}</div>`;
        return;
      }
      installedList.innerHTML = '';
      mods.forEach((mod) => installedList.appendChild(buildInstalledRow(inst, mod, refreshInstalled)));
    }

    async function doSearch() {
      searchError.textContent = '';
      resultsList.innerHTML = `<div class="empty-hint">${I18N.t('common.searching')}</div>`;
      try {
        const results = await window.api.mods.search(inst.id, sourceSelect.value, searchInput.value.trim());
        if (!results.length) {
          resultsList.innerHTML = `<div class="empty-hint">${I18N.t('modpanel.noResults')}</div>`;
          return;
        }
        resultsList.innerHTML = '';
        results.forEach((mod) => resultsList.appendChild(buildSearchRow(inst, mod, refreshInstalled)));
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

  function buildSearchRow(inst, mod, onInstalled) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      ${mod.iconUrl ? `<img class="mod-icon" src="${escapeHtml(mod.iconUrl)}" referrerpolicy="no-referrer" />` : '<div class="mod-icon"></div>'}
      <div class="mod-info">
        <div class="mod-name">${escapeHtml(mod.name)}</div>
        <div class="mod-summary">${escapeHtml(mod.summary || '')}</div>
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
        const result = await window.api.mods.install(inst.id, mod.source, mod.id);
        if (result.blocked && result.blocked.length) {
          const lines = result.blocked.map((b) => (b.webUrl ? `${b.fileName || b.modId}: ${b.webUrl}` : `${b.modId}: ${b.error || I18N.t('modpanel.blockedInstallError')}`));
          window.alert(I18N.t('modpanel.blockedAlert', { lines: lines.join('\n') }));
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

  function buildInstalledRow(inst, mod, onChange) {
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `
      <div class="mod-icon"></div>
      <div class="mod-info">
        <div class="mod-name">
          ${escapeHtml(mod.fileName)}
          ${mod.essential ? `<span class="mod-lock" title="${I18N.t('modpanel.essentialTitle')}">🔒</span>` : ''}
          ${!mod.present ? `<span class="badge" style="background:#fee2e2;color:#b91c1c">${I18N.t('common.noFile')}</span>` : ''}
        </div>
        <div class="mod-summary">${escapeHtml(mod.source)} · ${mod.enabled ? I18N.t('common.enabled') : I18N.t('common.disabled')}</div>
      </div>
      <div class="mod-actions">
        <button class="btn btn-sm toggle-btn">${mod.enabled ? I18N.t('common.disable') : I18N.t('common.enable')}</button>
        <button class="btn btn-sm btn-danger remove-btn">${I18N.t('common.delete')}</button>
      </div>
    `;
    const toggleBtn = row.querySelector('.toggle-btn');
    const removeBtn = row.querySelector('.remove-btn');
    if (mod.essential) {
      toggleBtn.disabled = true;
      removeBtn.disabled = true;
      toggleBtn.title = I18N.t('modpanel.essentialToggleTitle');
      removeBtn.title = I18N.t('modpanel.essentialRemoveTitle');
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
      if (!window.confirm(I18N.t('modpanel.removeConfirm', { name: mod.fileName }))) return;
      try {
        await window.api.mods.remove(inst.id, mod.id);
        await onChange();
      } catch (err) {
        window.alert(err.message || String(err));
      }
    });
    return row;
  }

  function showIncompatibleModsModal(inst, incompatible, onResolved) {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('modpanel.incompatibleTitle')}</h3>
      <div class="problem-list">
        ${incompatible.map((m) => `<div class="problem-item severe">${I18N.t('modpanel.unsupportedVersion', { version: m.mcVersion })} (${escapeHtml(m.fileName)})</div>`).join('')}
      </div>
      <p class="form-hint">${I18N.t('modpanel.autoResolveConfirm')}</p>
      <div class="status-text" id="incompatible-status"></div>
      <div class="modal-actions">
        <button class="btn" id="incompatible-cancel">${I18N.t('common.cancel')}</button>
        <button class="btn btn-primary" id="incompatible-resolve">${I18N.t('modpanel.autoResolveButton')}</button>
      </div>
    `;
    Modal.open(node, { large: true });
    node.querySelector('#incompatible-cancel').addEventListener('click', () => Modal.close());
    node.querySelector('#incompatible-resolve').addEventListener('click', async () => {
      const statusEl = node.querySelector('#incompatible-status');
      const resolveBtn = node.querySelector('#incompatible-resolve');
      resolveBtn.disabled = true;
      const failed = [];
      for (const mod of incompatible) {
        statusEl.textContent = I18N.t('modpanel.resolving', { name: mod.fileName });
        try {
          const result = await window.api.mods.autoResolveVersion(inst.id, mod.modId);
          if (!result.ok) failed.push(mod.fileName);
        } catch (err) {
          failed.push(mod.fileName);
        }
      }
      Modal.close();
      await onResolved();
      if (failed.length) window.alert(I18N.t('modpanel.resolveFailed', { names: failed.join(', ') }));
    });
  }

  return { render };
}());

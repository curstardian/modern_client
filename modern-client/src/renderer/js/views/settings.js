window.SettingsView = (function createSettingsView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function render(container) {
    const state = Store.get();
    const settings = state.settings || {};

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('page.settings.title')}</h1>
          <p class="page-subtitle">${I18N.t('page.settings.subtitle')}</p>
        </div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('settings.account.title')}</h2>
        <div class="recent-list" id="account-list"></div>
        <div class="error-text" id="account-error"></div>
        <button class="btn btn-primary" id="ms-login-btn" style="width:fit-content">${I18N.t('settings.account.msLogin')}</button>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('settings.java.optionsTitle')}</h2>
        <p class="form-hint">${I18N.t('settings.java.optionsHint')}</p>
        <div class="form-row">
          <input class="form-input" id="java-options" value="${escapeHtml(settings.javaOptions || '')}" placeholder="${I18N.t('settings.java.optionsPlaceholder')}" />
        </div>
        <div class="form-inline" style="justify-content:flex-start">
          <button class="btn btn-primary" id="save-java-options-btn" style="width:fit-content">${I18N.t('settings.java.save')}</button>
          <button class="btn" id="reset-java-options-btn" style="width:fit-content">${I18N.t('settings.java.reset')}</button>
        </div>
        <div class="status-text" id="java-options-status"></div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('settings.java.pathTitle')}</h2>
        <div class="form-inline">
          <input class="form-input" id="java-path" readonly value="${escapeHtml(settings.javaPath || '')}" placeholder="${I18N.t('settings.java.pathPlaceholder')}" />
          <button class="btn" id="browse-java-btn">${I18N.t('settings.java.browse')}</button>
          <button class="btn" id="validate-java-btn">${I18N.t('settings.java.validate')}</button>
        </div>
        <div class="status-text" id="java-status"></div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('settings.theme.title')}</h2>
        <div class="theme-toggle">
          <button class="btn ${settings.theme === 'light' ? 'active' : ''}" data-theme="light">${I18N.t('settings.theme.light')}</button>
          <button class="btn ${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">${I18N.t('settings.theme.dark')}</button>
        </div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('settings.language.title')}</h2>
        <select class="form-select" id="language-select" style="width:200px">
          <option value="ko" ${(settings.language || 'ko') === 'ko' ? 'selected' : ''}>한국어</option>
          <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    `;

    renderAccounts(container, state);
    wireEvents(container);
  }

  function renderAccounts(container, state) {
    const list = container.querySelector('#account-list');
    if (!state.accounts.length) {
      list.innerHTML = `<div class="empty-hint">${I18N.t('settings.account.empty')}</div>`;
      return;
    }
    list.innerHTML = state.accounts.map((acc) => `
      <div class="recent-item" data-account-id="${acc.id}">
        <span>
          <span class="badge">${acc.type === 'microsoft' ? I18N.t('settings.account.badgeMicrosoft') : I18N.t('settings.account.badgeOffline')}</span>
          &nbsp;${escapeHtml(acc.username)} ${state.activeAccount && state.activeAccount.id === acc.id ? `<span class="badge">${I18N.t('settings.account.badgeActive')}</span>` : ''}
        </span>
        <span>
          <button class="btn btn-sm select-account-btn" data-id="${acc.id}">${I18N.t('settings.account.select')}</button>
          <button class="btn btn-sm btn-danger delete-account-btn" data-id="${acc.id}">${I18N.t('settings.account.delete')}</button>
        </span>
      </div>
    `).join('');

    list.querySelectorAll('.select-account-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.accounts.setActive(btn.dataset.id);
        window.App.refreshAccounts();
      });
    });
    list.querySelectorAll('.delete-account-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm(I18N.t('settings.account.deleteConfirm'))) return;
        await window.api.accounts.remove(btn.dataset.id);
        window.App.refreshAccounts();
      });
    });
  }

  function wireEvents(container) {
    container.querySelector('#save-java-options-btn').addEventListener('click', async () => {
      const javaOptions = container.querySelector('#java-options').value.trim();
      const statusEl = container.querySelector('#java-options-status');
      const settings = await window.api.settings.set({ javaOptions });
      Store.set({ settings });
      statusEl.textContent = I18N.t('settings.java.saved');
      statusEl.className = 'status-text';
    });

    container.querySelector('#reset-java-options-btn').addEventListener('click', async () => {
      const input = container.querySelector('#java-options');
      input.value = '-Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 '
        + '-XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M';
    });

    container.querySelector('#browse-java-btn').addEventListener('click', async () => {
      const result = await window.api.settings.browseJava();
      if (result.canceled) return;
      const settings = await window.api.settings.set({ javaPath: result.path });
      Store.set({ settings });
      container.querySelector('#java-path').value = result.path;
    });

    container.querySelector('#validate-java-btn').addEventListener('click', async () => {
      const javaPath = container.querySelector('#java-path').value;
      const statusEl = container.querySelector('#java-status');
      statusEl.textContent = I18N.t('settings.java.checking');
      const result = await window.api.settings.validateJava(javaPath);
      if (result.ok) {
        statusEl.textContent = I18N.t('settings.java.ok', { version: result.version });
        statusEl.className = 'status-text';
      } else {
        statusEl.textContent = I18N.t('settings.java.error', { error: result.error });
        statusEl.className = 'error-text';
      }
    });

    container.querySelector('#ms-login-btn').addEventListener('click', openMicrosoftLoginModal);

    container.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { theme } = btn.dataset;
        const settings = await window.api.settings.set({ theme });
        Store.set({ settings });
        document.body.className = `theme-${theme}`;
        render(container);
      });
    });

    container.querySelector('#language-select').addEventListener('change', async (e) => {
      const settings = await window.api.settings.set({ language: e.target.value });
      Store.set({ settings });
      window.App.renderCurrentView();
    });
  }

  function openMicrosoftLoginModal() {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">${I18N.t('settings.msModal.title')}</h3>
      <div class="status-text" id="ms-login-status">${I18N.t('settings.msModal.opening')}</div>
      <div class="error-text" id="ms-login-error"></div>
      <div class="modal-actions">
        <button class="btn" id="ms-login-cancel">${I18N.t('settings.msModal.cancel')}</button>
      </div>
    `;
    Modal.open(node);

    const statusEl = node.querySelector('#ms-login-status');
    const errorEl = node.querySelector('#ms-login-error');
    statusEl.textContent = I18N.t('settings.msModal.hint');

    let cancelled = false;
    node.querySelector('#ms-login-cancel').addEventListener('click', async () => {
      cancelled = true;
      try { await window.api.accounts.cancelMsLogin(); } catch (err) { }
      Modal.close();
    });

    window.api.accounts.loginMicrosoft()
      .then(() => {
        if (cancelled) return;
        Modal.close();
        window.App.refreshAccounts();
      })
      .catch((err) => {
        if (cancelled) return;
        errorEl.textContent = err.message || String(err);
      });
  }

  return { render };
}());

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
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">계정, 실행 환경, 테마를 설정하세요</p>
        </div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">계정</h2>
        <div class="recent-list" id="account-list"></div>
        <div class="form-inline">
          <input class="form-input" id="new-account-name" placeholder="새 오프라인 계정 이름 (3~16자, 영문/숫자/밑줄)" />
          <button class="btn btn-primary" id="add-account-btn">추가</button>
        </div>
        <div class="error-text" id="account-error"></div>
        <button class="btn" id="ms-login-btn" style="width:fit-content">Microsoft로 로그인</button>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">메모리 (RAM)</h2>
        <div class="form-row">
          <label class="form-label">최소 (MB)</label>
          <input class="form-input" type="number" id="ram-min" step="256" value="${settings.ramMinMb}" />
        </div>
        <div class="form-row">
          <label class="form-label">최대 (MB)</label>
          <input class="form-input" type="number" id="ram-max" step="256" value="${settings.ramMaxMb}" />
        </div>
        <button class="btn btn-primary" id="save-ram-btn" style="width:fit-content">저장</button>
        <div class="status-text" id="ram-status"></div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">Java 경로</h2>
        <div class="form-inline">
          <input class="form-input" id="java-path" readonly value="${escapeHtml(settings.javaPath || '')}" placeholder="시스템 기본 java 사용" />
          <button class="btn" id="browse-java-btn">찾아보기</button>
          <button class="btn" id="validate-java-btn">확인</button>
        </div>
        <div class="status-text" id="java-status"></div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">테마</h2>
        <div class="theme-toggle">
          <button class="btn ${settings.theme === 'light' ? 'active' : ''}" data-theme="light">라이트</button>
          <button class="btn ${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">다크</button>
        </div>
      </div>
    `;

    renderAccounts(container, state);
    wireEvents(container);
  }

  function renderAccounts(container, state) {
    const list = container.querySelector('#account-list');
    if (!state.accounts.length) {
      list.innerHTML = '<div class="empty-hint">등록된 계정이 없습니다.</div>';
      return;
    }
    list.innerHTML = state.accounts.map((acc) => `
      <div class="recent-item" data-account-id="${acc.id}">
        <span>
          <span class="badge">${acc.type === 'microsoft' ? 'Microsoft' : '오프라인'}</span>
          &nbsp;${escapeHtml(acc.username)} ${state.activeAccount && state.activeAccount.id === acc.id ? '<span class="badge">활성</span>' : ''}
        </span>
        <span>
          <button class="btn btn-sm select-account-btn" data-id="${acc.id}">선택</button>
          <button class="btn btn-sm btn-danger delete-account-btn" data-id="${acc.id}">삭제</button>
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
        if (!window.confirm('이 계정을 삭제할까요?')) return;
        await window.api.accounts.remove(btn.dataset.id);
        window.App.refreshAccounts();
      });
    });
  }

  function wireEvents(container) {
    container.querySelector('#add-account-btn').addEventListener('click', async () => {
      const input = container.querySelector('#new-account-name');
      const errorEl = container.querySelector('#account-error');
      errorEl.textContent = '';
      try {
        await window.api.accounts.create(input.value.trim());
        input.value = '';
        window.App.refreshAccounts();
      } catch (err) {
        errorEl.textContent = err.message || String(err);
      }
    });

    container.querySelector('#save-ram-btn').addEventListener('click', async () => {
      const ramMinMb = parseInt(container.querySelector('#ram-min').value, 10);
      const ramMaxMb = parseInt(container.querySelector('#ram-max').value, 10);
      const statusEl = container.querySelector('#ram-status');
      if (!ramMinMb || !ramMaxMb || ramMinMb > ramMaxMb) {
        statusEl.textContent = '올바른 값을 입력해주세요 (최소 ≤ 최대).';
        statusEl.className = 'error-text';
        return;
      }
      const settings = await window.api.settings.set({ ramMinMb, ramMaxMb });
      Store.set({ settings });
      statusEl.textContent = '저장되었습니다.';
      statusEl.className = 'status-text';
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
      statusEl.textContent = '확인 중...';
      const result = await window.api.settings.validateJava(javaPath);
      if (result.ok) {
        statusEl.textContent = `정상: Java ${result.version}`;
        statusEl.className = 'status-text';
      } else {
        statusEl.textContent = `오류: ${result.error}`;
        statusEl.className = 'error-text';
      }
    });

    container.querySelector('#ms-login-btn').addEventListener('click', openMicrosoftLoginModal);

    container.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        const settings = await window.api.settings.set({ theme });
        Store.set({ settings });
        document.body.className = `theme-${theme}`;
        render(container);
      });
    });
  }

  function openMicrosoftLoginModal() {
    const node = document.createElement('div');
    node.innerHTML = `
      <h3 class="modal-title">Microsoft로 로그인</h3>
      <div class="status-text" id="ms-login-status">로그인 창을 여는 중...</div>
      <div class="error-text" id="ms-login-error"></div>
      <div class="modal-actions">
        <button class="btn" id="ms-login-cancel">취소</button>
      </div>
    `;
    Modal.open(node);

    const statusEl = node.querySelector('#ms-login-status');
    const errorEl = node.querySelector('#ms-login-error');
    statusEl.textContent = '별도 창에서 Microsoft 계정으로 로그인해주세요...';

    let cancelled = false;
    node.querySelector('#ms-login-cancel').addEventListener('click', async () => {
      cancelled = true;
      try { await window.api.accounts.cancelMsLogin(); } catch (err) { /* ignore */ }
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

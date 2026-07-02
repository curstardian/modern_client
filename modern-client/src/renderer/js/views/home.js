window.HomeView = (function createHomeView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const PHASE_LABELS = {
    auth: '계정 인증 중',
    manifest: '버전 정보 확인 중',
    libraries: '라이브러리 다운로드 중',
    'client-jar': '클라이언트 다운로드 중',
    assets: '리소스 다운로드 중',
    natives: '네이티브 라이브러리 준비 중',
    starting: '마인크래프트 시작 중',
  };

  function progressPercent(launch) {
    if (!launch || !launch.total) return 0;
    return Math.min(100, Math.round((launch.current / launch.total) * 100));
  }

  function instanceOptionsHtml(instances, activeId) {
    if (!instances.length) return '<option value="">인스턴스를 먼저 생성하세요</option>';
    return instances.map((inst) => `<option value="${inst.id}" ${inst.id === activeId ? 'selected' : ''}>${escapeHtml(inst.name)} (${escapeHtml(inst.versionId)})</option>`).join('');
  }

  function recentListHtml(state) {
    const recent = (state.settings && state.settings.recentLaunches) || [];
    if (!recent.length) return '<div class="empty-hint">아직 실행 기록이 없습니다.</div>';
    return recent.map((r) => `
      <div class="recent-item">
        <span>${escapeHtml(r.instanceName)}</span>
        <span class="recent-item-meta">${escapeHtml(r.versionId)} · ${fmtDate(r.timestamp)}</span>
      </div>
    `).join('');
  }

  function render(container) {
    const state = Store.get();
    const activeInstance = state.instances.find((i) => i.id === state.activeInstanceId) || null;
    const launch = state.currentLaunch;
    const isBusy = !!launch;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Home</h1>
          <p class="page-subtitle">${state.activeAccount ? `${escapeHtml(state.activeAccount.username)}님, 환영합니다` : '먼저 계정을 추가해주세요'}</p>
        </div>
      </div>

      <div class="card hero-card">
        <div>
          <div class="hero-instance-name">${activeInstance ? escapeHtml(activeInstance.name) : '선택된 인스턴스 없음'}</div>
          <div class="hero-instance-meta">${activeInstance ? `버전 ${escapeHtml(activeInstance.versionId)}` : '인스턴스를 선택하거나 새로 만들어주세요'}</div>
        </div>
        <div class="play-row">
          <select class="instance-picker" id="home-instance-select">
            ${instanceOptionsHtml(state.instances, state.activeInstanceId)}
          </select>
          <button class="play-button" id="home-play-btn" ${isBusy || !state.instances.length || !state.activeAccount ? 'disabled' : ''}>
            ${isBusy ? '준비 중...' : 'Play'}
          </button>
        </div>
        <div class="progress-wrap ${isBusy ? 'active' : ''}">
          <div class="progress-label">${launch ? (PHASE_LABELS[launch.phase] || launch.phase) : ''}</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${progressPercent(launch)}%"></div></div>
        </div>
        <div class="log-box">${(state.logs || []).slice(-200).map(escapeHtml).join('\n')}</div>
      </div>

      <div class="card">
        <h2 class="section-title">최근 실행</h2>
        <div class="recent-list">${recentListHtml(state)}</div>
      </div>
    `;

    const logBox = container.querySelector('.log-box');
    if (logBox) logBox.scrollTop = logBox.scrollHeight;

    const select = container.querySelector('#home-instance-select');
    if (select) {
      select.addEventListener('change', async () => {
        const id = select.value;
        if (!id) return;
        await window.api.instances.setActive(id);
        Store.set({ activeInstanceId: id });
      });
    }

    const playBtn = container.querySelector('#home-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', async () => {
        const current = Store.get();
        if (!current.activeInstanceId) return;
        Store.set({ currentLaunch: { launchId: null, phase: 'manifest', current: 0, total: 1 }, logs: [] });
        try {
          await window.api.launch.start(current.activeInstanceId);
        } catch (err) {
          Store.set({ currentLaunch: null });
          window.alert(err.message || String(err));
        }
      });
    }
  }

  return { render };
}());

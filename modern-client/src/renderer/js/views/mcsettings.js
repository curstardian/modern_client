window.McSettingsView = (function createMcSettingsView() {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const KEY_ACTIONS = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint', 'inventory', 'drop', 'attack', 'use'];
  const SOUND_CATEGORIES = ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice'];
  const LANGUAGES = [
    ['ko_kr', '한국어'], ['en_us', 'English'], ['ja_jp', '日本語'], ['zh_cn', '简体中文'],
    ['zh_tw', '繁體中文'], ['es_es', 'Español'], ['fr_fr', 'Français'], ['de_de', 'Deutsch'],
    ['ru_ru', 'Русский'], ['pt_br', 'Português (Brasil)'],
  ];
  const GUI_SCALE_VALUES = [0, 1, 2, 3, 4];
  const MAX_FPS_OPTIONS = [30, 60, 120, 144, 240, 260];
  const GRAPHICS_MODE_VALUES = [0, 1, 2];

  function minecraftKeyLabel(key) {
    if (!key) return '-';
    const parts = key.split('.');
    return parts[parts.length - 1].replace(/\./g, ' ').toUpperCase();
  }

  function codeToMinecraftKey(code, isMouse, button) {
    if (isMouse) {
      if (button === 0) return 'key.mouse.left';
      if (button === 1) return 'key.mouse.middle';
      if (button === 2) return 'key.mouse.right';
      return `key.mouse.${button + 1}`;
    }
    const map = {
      Space: 'space',
      ShiftLeft: 'left.shift',
      ShiftRight: 'right.shift',
      ControlLeft: 'left.control',
      ControlRight: 'right.control',
      AltLeft: 'left.alt',
      AltRight: 'right.alt',
      Tab: 'tab',
      Escape: 'escape',
      Enter: 'enter',
      Backspace: 'backspace',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    if (map[code]) return `key.keyboard.${map[code]}`;
    const letterMatch = /^Key([A-Z])$/.exec(code);
    if (letterMatch) return `key.keyboard.${letterMatch[1].toLowerCase()}`;
    const digitMatch = /^Digit([0-9])$/.exec(code);
    if (digitMatch) return `key.keyboard.${digitMatch[1]}`;
    const fMatch = /^F([0-9]+)$/.exec(code);
    if (fMatch) return `key.keyboard.f${fMatch[1]}`;
    return `key.keyboard.${code.toLowerCase()}`;
  }

  async function render(container) {
    const state = Store.get();
    const { instances } = state;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${I18N.t('mcsettings.title')}</h1>
          <p class="page-subtitle">${I18N.t('mcsettings.subtitle')}</p>
        </div>
      </div>
      <div class="card">
        <div class="form-row">
          <label class="form-label">${I18N.t('common.instanceLabel')}</label>
          <select class="form-select" id="mcs-instance-select"></select>
        </div>
      </div>
      <div id="mcs-body"></div>
    `;

    const select = container.querySelector('#mcs-instance-select');
    const body = container.querySelector('#mcs-body');

    if (!instances.length) {
      select.innerHTML = `<option value="">${I18N.t('resourcepacks.noInstance')}</option>`;
      body.innerHTML = `<div class="empty-hint">${I18N.t('rp.noInstance')}</div>`;
      return;
    }

    select.innerHTML = instances.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`).join('');

    async function renderPanel() {
      const inst = instances.find((i) => i.id === select.value) || instances[0];
      await renderInstancePanel(body, inst);
    }
    select.addEventListener('change', renderPanel);
    await renderPanel();
  }

  async function renderInstancePanel(body, inst) {
    const [settings, packs] = await Promise.all([
      window.api.mcSettings.get(inst.id),
      window.api.resourcepacks.listInstalled(inst.id),
    ]);

    const enabledPackIds = new Set(settings.resourcePacks || []);
    const packList = packs.map((p) => ({ id: `file/${p.fileName}`, fileName: p.fileName }));
    const orderedIds = (settings.resourcePacks || []).filter((id) => packList.some((p) => p.id === id));
    packList.forEach((p) => { if (!orderedIds.includes(p.id)) orderedIds.push(p.id); });

    body.innerHTML = `
      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('mcsettings.controls')}</h2>
        <div class="form-row">
          <label class="form-label">${I18N.t('mcsettings.mouseSensitivity')}</label>
          <input type="range" min="0" max="200" id="mcs-sensitivity" value="${Math.round((settings.mouseSensitivity || 0) * 200)}" />
          <span id="mcs-sensitivity-value">${Math.round((settings.mouseSensitivity || 0) * 200)}%</span>
        </div>
        <div class="form-row">
          <label class="form-label"><input type="checkbox" id="mcs-invert-mouse" ${settings.invertMouse ? 'checked' : ''} /> ${I18N.t('mcsettings.invertMouse')}</label>
        </div>
        <div class="mod-list" id="mcs-keybinds">
          ${KEY_ACTIONS.map((action) => `
            <div class="mod-row">
              <div class="mod-info"><div class="mod-name">${I18N.t(`mcsettings.key.${action}`)}</div></div>
              <div class="mod-actions">
                <button class="btn btn-sm" data-action="${action}" data-key="${escapeHtml(settings.keyBindings[action] || '')}">${escapeHtml(minecraftKeyLabel(settings.keyBindings[action]))}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('mcsettings.sound')}</h2>
        ${SOUND_CATEGORIES.map((cat) => `
          <div class="form-row">
            <label class="form-label">${I18N.t(`mcsettings.sound.${cat}`)}</label>
            <input type="range" min="0" max="100" class="mcs-sound" data-category="${cat}" value="${Math.round((settings.sound[cat] ?? 1) * 100)}" />
            <span class="mcs-sound-value">${Math.round((settings.sound[cat] ?? 1) * 100)}%</span>
          </div>
        `).join('')}
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('mcsettings.video')}</h2>
        <div class="form-row">
          <label class="form-label">${I18N.t('mcsettings.renderDistance')}</label>
          <input type="range" min="2" max="32" id="mcs-render-distance" value="${settings.video.renderDistance}" />
          <span id="mcs-render-distance-value">${settings.video.renderDistance}</span>
        </div>
        <div class="form-row">
          <label class="form-label">${I18N.t('mcsettings.guiScale')}</label>
          <select class="form-select" id="mcs-gui-scale">
            ${GUI_SCALE_VALUES.map((v) => `<option value="${v}" ${settings.video.guiScale === v ? 'selected' : ''}>${v === 0 ? I18N.t('mcsettings.guiScaleAuto') : `${v}x`}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">${I18N.t('mcsettings.maxFps')}</label>
          <select class="form-select" id="mcs-max-fps">
            ${MAX_FPS_OPTIONS.map((v) => `<option value="${v}" ${settings.video.maxFps === v ? 'selected' : ''}>${v >= 260 ? I18N.t('mcsettings.unlimited') : v}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">${I18N.t('mcsettings.graphicsMode')}</label>
          <select class="form-select" id="mcs-graphics-mode">
            ${GRAPHICS_MODE_VALUES.map((v) => `<option value="${v}" ${settings.video.graphicsMode === v ? 'selected' : ''}>${I18N.t(`mcsettings.graphicsMode.${v}`)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label"><input type="checkbox" id="mcs-fullscreen" ${settings.video.fullscreen ? 'checked' : ''} /> ${I18N.t('mcsettings.fullscreen')}</label>
        </div>
        <div class="form-row">
          <label class="form-label"><input type="checkbox" id="mcs-vsync" ${settings.video.vsync ? 'checked' : ''} /> ${I18N.t('mcsettings.vsync')}</label>
        </div>
        <div class="form-row">
          <label class="form-label"><input type="checkbox" id="mcs-smooth-lighting" ${settings.video.smoothLighting ? 'checked' : ''} /> ${I18N.t('mcsettings.smoothLighting')}</label>
        </div>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('mcsettings.language')}</h2>
        <select class="form-select" id="mcs-language" style="width:220px">
          ${LANGUAGES.map(([code, label]) => `<option value="${code}" ${settings.language === code ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>

      <div class="card settings-grid">
        <h2 class="section-title">${I18N.t('mcsettings.resourcePacks')}</h2>
        ${!packList.length ? `<div class="empty-hint">${I18N.t('rp.empty')}</div>` : `
        <div class="mod-list" id="mcs-resource-packs">
          ${orderedIds.map((id) => {
    const pack = packList.find((p) => p.id === id);
    return `
              <div class="mod-row" data-pack-id="${escapeHtml(id)}">
                <div class="mod-info">
                  <label class="mod-name"><input type="checkbox" class="mcs-pack-toggle" ${enabledPackIds.has(id) ? 'checked' : ''} /> ${escapeHtml(pack.fileName)}</label>
                </div>
                <div class="mod-actions">
                  <button class="btn btn-sm mcs-pack-up">↑</button>
                  <button class="btn btn-sm mcs-pack-down">↓</button>
                </div>
              </div>
            `;
  }).join('')}
        </div>`}
      </div>

      <div class="form-inline" style="justify-content:flex-start">
        <button class="btn btn-primary" id="mcs-save-btn" style="width:fit-content">${I18N.t('common.save')}</button>
        <span class="status-text" id="mcs-save-status"></span>
      </div>
    `;

    wirePanelEvents(body, inst, settings);
  }

  function wirePanelEvents(body, inst, settings) {
    const sensitivityInput = body.querySelector('#mcs-sensitivity');
    const sensitivityValue = body.querySelector('#mcs-sensitivity-value');
    sensitivityInput.addEventListener('input', () => {
      sensitivityValue.textContent = `${sensitivityInput.value}%`;
    });

    body.querySelectorAll('.mcs-sound').forEach((input) => {
      const valueEl = input.parentElement.querySelector('.mcs-sound-value');
      input.addEventListener('input', () => { valueEl.textContent = `${input.value}%`; });
    });

    const renderDistanceInput = body.querySelector('#mcs-render-distance');
    const renderDistanceValue = body.querySelector('#mcs-render-distance-value');
    renderDistanceInput.addEventListener('input', () => {
      renderDistanceValue.textContent = renderDistanceInput.value;
    });

    const keyBindings = { ...settings.keyBindings };
    body.querySelectorAll('#mcs-keybinds button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const originalLabel = btn.textContent;
        btn.textContent = I18N.t('mcsettings.pressKey');
        btn.disabled = true;
        const cleanup = () => {
          document.removeEventListener('keydown', onKeydown, true);
          document.removeEventListener('mousedown', onMousedown, true);
          btn.disabled = false;
        };
        function onKeydown(e) {
          e.preventDefault();
          const key = codeToMinecraftKey(e.code, false);
          keyBindings[btn.dataset.action] = key;
          btn.textContent = minecraftKeyLabel(key);
          cleanup();
        }
        function onMousedown(e) {
          e.preventDefault();
          const key = codeToMinecraftKey(null, true, e.button);
          keyBindings[btn.dataset.action] = key;
          btn.textContent = minecraftKeyLabel(key);
          cleanup();
        }
        document.addEventListener('keydown', onKeydown, true);
        document.addEventListener('mousedown', onMousedown, true);
        void originalLabel;
      });
    });

    const packsContainer = body.querySelector('#mcs-resource-packs');
    if (packsContainer) {
      function moveRow(row, direction) {
        if (direction < 0 && row.previousElementSibling) {
          packsContainer.insertBefore(row, row.previousElementSibling);
        } else if (direction > 0 && row.nextElementSibling) {
          packsContainer.insertBefore(row.nextElementSibling, row);
        }
      }
      packsContainer.querySelectorAll('.mcs-pack-up').forEach((btn) => {
        btn.addEventListener('click', () => moveRow(btn.closest('.mod-row'), -1));
      });
      packsContainer.querySelectorAll('.mcs-pack-down').forEach((btn) => {
        btn.addEventListener('click', () => moveRow(btn.closest('.mod-row'), 1));
      });
    }

    body.querySelector('#mcs-save-btn').addEventListener('click', async () => {
      const statusEl = body.querySelector('#mcs-save-status');
      const sound = {};
      body.querySelectorAll('.mcs-sound').forEach((input) => {
        sound[input.dataset.category] = Number(input.value) / 100;
      });
      const resourcePacks = packsContainer
        ? Array.from(packsContainer.querySelectorAll('.mod-row'))
          .filter((row) => row.querySelector('.mcs-pack-toggle').checked)
          .map((row) => row.dataset.packId)
        : [];

      const patch = {
        mouseSensitivity: Number(sensitivityInput.value) / 200,
        invertMouse: body.querySelector('#mcs-invert-mouse').checked,
        keyBindings,
        sound,
        video: {
          renderDistance: Number(renderDistanceInput.value),
          guiScale: Number(body.querySelector('#mcs-gui-scale').value),
          maxFps: Number(body.querySelector('#mcs-max-fps').value),
          fullscreen: body.querySelector('#mcs-fullscreen').checked,
          vsync: body.querySelector('#mcs-vsync').checked,
          graphicsMode: Number(body.querySelector('#mcs-graphics-mode').value),
          smoothLighting: body.querySelector('#mcs-smooth-lighting').checked,
        },
        language: body.querySelector('#mcs-language').value,
        resourcePacks,
      };

      await window.api.mcSettings.set(inst.id, patch);
      statusEl.textContent = I18N.t('settings.java.saved');
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    });
  }

  return { render };
}());

window.Store = (function createStore() {
  const state = {
    view: 'home',
    accounts: [],
    activeAccount: null,
    instances: [],
    activeInstanceId: null,
    versions: { latest: null, versions: [] },
    settings: null,
    currentLaunch: null,
    logs: [],
    sessionWarning: false,
    hasModdedInstances: false,
  };
  const listeners = new Set();

  function get() {
    return state;
  }
  function set(patch) {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn(state));
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
}());

window.Modal = (function createModal() {
  const overlay = document.getElementById('modal-overlay');
  const root = document.getElementById('modal-root');

  function open(node, { large = false } = {}) {
    root.innerHTML = '';
    root.classList.toggle('modal-lg', large);
    root.appendChild(node);
    overlay.hidden = false;
  }
  function close() {
    overlay.hidden = true;
    root.innerHTML = '';
    root.classList.remove('modal-lg');
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { open, close };
}());

window.fmtDate = function fmtDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

window.fmtBytes = function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

window.LOADER_LABELS = new Proxy({}, {
  get(_target, loader) {
    return window.I18N ? window.I18N.t(`loader.${loader}`) : loader;
  },
});

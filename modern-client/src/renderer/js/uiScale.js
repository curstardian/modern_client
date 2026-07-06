(function setupUiScale() {
  const BASE_WIDTH = 1100;
  const BASE_HEIGHT = 720;
  const MIN_SCALE = 1;
  const MAX_SCALE = 2.2;

  function applyScale() {
    const scaleW = window.innerWidth / BASE_WIDTH;
    const scaleH = window.innerHeight / BASE_HEIGHT;
    const scale = Math.min(scaleW, scaleH, MAX_SCALE);
    document.documentElement.style.zoom = Math.max(MIN_SCALE, scale);
  }

  window.addEventListener('resize', applyScale);
  if (window.api && window.api.window && window.api.window.onBoundsChanged) {
    window.api.window.onBoundsChanged(applyScale);
  }
  applyScale();
}());

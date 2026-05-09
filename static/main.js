// ── Shared application state ─────────────────────────────────────────────────
window.state = {
  selection: new Set(),   // Set of FIPS strings; empty = all selected
  colorVar:  'Life Expectancy',
  xVar:      'Median Household Income',
  yVar:      'Life Expectancy',
  data:      [],
  columns:   [],
};

// ── Central dispatch ─────────────────────────────────────────────────────────
// All charts call window.dispatch() to communicate state changes.
//
// Brush updates are coalesced via requestAnimationFrame: if multiple events
// fire in the same frame (e.g. brush end + scroll), we still only repaint
// once. With ~3,000 SVG nodes per panel this matters.
let _brushFrame = null;
function _flushBrushUpdate() {
  _brushFrame = null;
  MapChart.update();
  ScatterChart.update();
  ParallelChart.update();
}

window.dispatch = function (type, payload) {
  if (type === 'brush') {
    window.state.selection = payload;
    const n = payload.size;
    document.getElementById('sel-count').textContent =
      n > 0 ? `${n} ${n !== 1 ? 'counties' : 'county'} selected` : '';
    if (_brushFrame == null) {
      _brushFrame = requestAnimationFrame(_flushBrushUpdate);
    }
    // Heatmap has no selection-based update

  } else if (type === 'colorVar') {
    window.state.colorVar = payload;
    document.getElementById('map-var-label').textContent = payload;
    MapChart.recolor();        // heavy: rebuild scale + repaint counties + legend
    ParallelChart.recolor();   // recolor lines to match new variable

  } else if (type === 'setAxes') {
    window.state.xVar = payload.x;
    window.state.yVar = payload.y;
    document.getElementById('scatter-x-select').value = payload.x;
    document.getElementById('scatter-y-select').value = payload.y;
    ScatterChart.redraw();

  } else if (type === 'xVar') {
    window.state.xVar = payload;
    ScatterChart.redraw();

  } else if (type === 'yVar') {
    window.state.yVar = payload;
    ScatterChart.redraw();
  }
};

// ── Theme toggle ─────────────────────────────────────────────────────────────
// Default theme is dark (no class on body). Adding `light` flips every CSS
// variable defined in style.css. Preference is persisted in localStorage so
// reloads keep the user's choice.
function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = (theme === 'light') ? '☾' : '☀';
}
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}
function toggleTheme() {
  const next = document.body.classList.contains('light') ? 'dark' : 'light';
  localStorage.setItem('theme', next);
  applyTheme(next);
}
// Apply saved theme as early as possible so the page never flashes the wrong one.
initTheme();

// ── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Re-apply (the body element exists for sure now) and wire up the button.
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

  Promise.all([
    fetch('/api/data').then(r => r.json()),
    fetch('/api/correlations').then(r => r.json()),
    fetch(TOPO_URL).then(r => r.json()),
  ])
  .then(([apiData, corrData, topology]) => {
    window.state.data    = apiData.data;
    window.state.columns = apiData.columns;

    // ── Populate all dropdowns ──────────────────────────────────────
    const cols = apiData.columns;

    ['map-var-select', 'scatter-x-select', 'scatter-y-select'].forEach(id => {
      const sel = document.getElementById(id);
      cols.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    });

    document.getElementById('map-var-select').value   = window.state.colorVar;
    document.getElementById('scatter-x-select').value = window.state.xVar;
    document.getElementById('scatter-y-select').value = window.state.yVar;
    document.getElementById('map-var-label').textContent = window.state.colorVar;

    // ── Dropdown listeners ──────────────────────────────────────────
    document.getElementById('map-var-select').addEventListener('change', e => {
      window.dispatch('colorVar', e.target.value);
    });
    document.getElementById('scatter-x-select').addEventListener('change', e => {
      window.dispatch('xVar', e.target.value);
    });
    document.getElementById('scatter-y-select').addEventListener('change', e => {
      window.dispatch('yVar', e.target.value);
    });

    // ── Clear button ────────────────────────────────────────────────
    document.getElementById('clear-btn').addEventListener('click', () => {
      ParallelChart.clearBrushes();
      window.dispatch('brush', new Set());
    });

    // ── Show dashboard FIRST so panels have real pixel dimensions ───
    // Charts must be initialized after layout is computed, otherwise
    // clientWidth/clientHeight return 0 (panels are display:none).
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = '';

    // requestAnimationFrame ensures one layout pass has occurred
    // before we measure element sizes and build the SVGs.
    requestAnimationFrame(() => {
      MapChart.init(apiData.data, topology);
      ScatterChart.init(apiData.data);
      ParallelChart.init(apiData.data, apiData.columns);
      HeatmapChart.init(corrData);
    });
  })
  .catch(err => {
    document.getElementById('loading').textContent =
      'Error loading data: ' + err.message;
    console.error(err);
  });
});

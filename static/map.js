// ── Choropleth Map ───────────────────────────────────────────────────────────
// Renders U.S. counties colored by the selected health/socioeconomic variable.
// Click a county to select it (updates all linked views).
// Shift/Ctrl+click to add/remove from multi-selection.
// Click ocean/background to clear selection.

window.MapChart = (() => {
  let svg, pathG, legendG;
  let pathFn, colorScale;
  let allData = [];
  let fipsMap  = {};    // "01001" -> data record
  let gradUid  = 'map-grad-' + Math.random().toString(36).slice(2);

  const tip = () => d3.select('#tooltip');

  // ── Public: init ────────────────────────────────────────────────────
  function init(data, topology) {
    allData = data;
    data.forEach(d => { fipsMap[d.fips] = d; });

    const el = document.getElementById('map-wrap');
    const w  = el.clientWidth;
    const h  = el.clientHeight;

    svg = d3.select('#map-wrap')
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .style('cursor', 'default');

    // Gradient definition for legend
    const defs = svg.append('defs');
    defs.append('linearGradient').attr('id', gradUid);

    // Extract county and state features
    const counties  = topojson.feature(topology, topology.objects.counties);
    const stateMesh = topojson.mesh(topology, topology.objects.states, (a, b) => a !== b);

    // counties-10m.json from us-atlas v3 stores geographic (lat/lon) coordinates.
    // Use geoAlbersUsa and fit it to the panel size.
    const proj = d3.geoAlbersUsa()
      .fitExtent([[10, 10], [w - 10, h - 26]], counties);
    pathFn = d3.geoPath().projection(proj);

    // ── County paths ────────────────────────────────────────────────
    pathG = svg.append('g').attr('class', 'counties');

    pathG.selectAll('path.county-path')
      .data(counties.features)
      .join('path')
        .attr('class', 'county-path')
        .attr('d', pathFn)
        .on('mouseover', onMouseover)
        .on('mousemove', onMousemove)
        .on('mouseout',  () => tip().style('opacity', 0))
        .on('click', onClick);

    // ── State borders ────────────────────────────────────────────────
    svg.append('path')
      .datum(stateMesh)
      .attr('class', 'state-border')
      .attr('d', pathFn);

    // ── Legend ───────────────────────────────────────────────────────
    legendG = svg.append('g')
      .attr('class', 'map-legend')
      .attr('transform', `translate(${w - 175}, ${h - 22})`);

    // Click background → clear selection
    svg.on('click', (e) => {
      if (e.target === svg.node()) {
        window.dispatch('brush', new Set());
      }
    });

    update();
  }

  // ── Public: update (re-color + apply dimming based on current state) ──
  function update() {
    if (!svg) return;

    const col = window.state.colorVar;
    const sel = window.state.selection;

    // Build color scale from valid values
    const vals = allData.filter(d => d[col] != null).map(d => d[col]);
    const ext  = d3.extent(vals);
    colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain(ext);

    pathG.selectAll('.county-path')
      .attr('fill', f => {
        const d = fipsMap[String(f.id).padStart(5, '0')];
        if (!d || d[col] == null) return '#e0e4ea';
        return colorScale(d[col]);
      })
      .classed('dimmed', f => {
        if (sel.size === 0) return false;
        const d = fipsMap[String(f.id).padStart(5, '0')];
        return d ? !sel.has(d.fips) : false;
      });

    drawLegend(col, ext[0], ext[1]);
  }

  // ── Tooltip handlers ─────────────────────────────────────────────────
  function onMouseover(event, f) {
    const d = fipsMap[String(f.id).padStart(5, '0')];
    if (!d) return;
    const col = window.state.colorVar;
    const val = d[col];
    tip()
      .html(`<b>${d.county}, ${d.state}</b><br>${col}:<br><b>${
        val != null ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : 'N/A'
      }</b>`)
      .style('opacity', 1)
      .style('left',  (event.clientX + 15) + 'px')
      .style('top',   (event.clientY - 10) + 'px');
  }

  function onMousemove(event) {
    tip()
      .style('left', (event.clientX + 15) + 'px')
      .style('top',  (event.clientY - 10) + 'px');
  }

  // ── Click handler ─────────────────────────────────────────────────────
  function onClick(event, f) {
    event.stopPropagation();
    const d = fipsMap[String(f.id).padStart(5, '0')];
    if (!d) return;

    const sel = new Set(window.state.selection);

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      // Multi-select toggle
      sel.has(d.fips) ? sel.delete(d.fips) : sel.add(d.fips);
    } else {
      // Single-select toggle
      if (sel.size === 1 && sel.has(d.fips)) {
        sel.clear();
      } else {
        sel.clear();
        sel.add(d.fips);
      }
    }
    window.dispatch('brush', sel);
  }

  // ── Legend ────────────────────────────────────────────────────────────
  function drawLegend(col, mn, mx) {
    legendG.selectAll('*').remove();
    if (mn == null || mx == null) return;

    const lw = 160, lh = 9;

    // Update gradient stops
    const grad = d3.select('#' + gradUid);
    grad.selectAll('stop').remove();
    d3.range(8).forEach(i => {
      const t = i / 7;
      grad.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(mn + t * (mx - mn)));
    });

    legendG.append('rect')
      .attr('width', lw).attr('height', lh)
      .attr('fill', `url(#${gradUid})`)
      .attr('rx', 2);

    const fmt = mx > 10000 ? d3.format(',.0f') : d3.format(',.1f');
    legendG.append('text').attr('y', lh + 9).attr('font-size', 8.5).attr('fill', '#6a8aaa')
      .text(fmt(mn));
    legendG.append('text').attr('x', lw / 2).attr('y', lh + 9).attr('font-size', 8.5)
      .attr('fill', '#6a8aaa').attr('text-anchor', 'middle').text(col.length > 22 ? col.slice(0, 22) + '…' : col);
    legendG.append('text').attr('x', lw).attr('y', lh + 9).attr('font-size', 8.5)
      .attr('fill', '#6a8aaa').attr('text-anchor', 'end').text(fmt(mx));
  }

  return { init, update };
})();

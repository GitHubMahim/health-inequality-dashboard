// ── Ranked Bar Chart ──────────────────────────────────────────────────────────
// Shows the top-N and bottom-N counties for the currently selected variable.
// Bars are colored by the same RdYlGn scale used by the other panels.
// Click a bar to select that county and update all linked views.
// Redraws fully when colorVar changes; dims/highlights when selection changes.

window.RankedBar = (() => {
  let svg, g, barsG;
  let allData = [];
  const M = { top: 20, right: 56, bottom: 22, left: 145 };

  const tip = () => d3.select('#tooltip');

  // ── Public: init ────────────────────────────────────────────────────────
  function init(data) {
    allData = data;
    draw();
  }

  // ── Internal: draw (full rebuild) ────────────────────────────────────────
  function draw() {
    d3.select('#ranked-wrap svg').remove();

    const el = document.getElementById('ranked-wrap');
    const W  = el.clientWidth;
    const H  = el.clientHeight;
    if (H < 10 || W < 10) return;

    const col    = window.state.colorVar;
    const sorted = allData
      .filter(d => d[col] != null)
      .sort((a, b) => b[col] - a[col]);

    const iw = W - M.left - M.right;
    const ih = H - M.top  - M.bottom;

    // Determine how many bars fit: leave a gap between top and bottom groups
    const GAP     = 10;
    const MIN_BAR = 9;
    const N       = Math.max(4, Math.min(10, Math.floor((ih - GAP) / (MIN_BAR * 2))));
    const barH    = Math.max(MIN_BAR, Math.floor((ih - GAP) / (N * 2)));

    const top = sorted.slice(0, N);
    const bot = sorted.slice(-N).reverse();   // lowest-to-highest order

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain(d3.extent(sorted, d => d[col]));

    // X scale: span data range with a little padding
    const xMin  = d3.min(sorted, d => d[col]);
    const xMax  = d3.max(sorted, d => d[col]);
    const xPad  = (xMax - xMin) * 0.015;
    const x     = d3.scaleLinear().domain([xMin - xPad, xMax + xPad]).range([0, iw]);
    const baseX = x(xMin - xPad);

    svg = d3.select('#ranked-wrap')
      .append('svg').attr('width', W).attr('height', H);
    g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    barsG = g.append('g').attr('class', 'rb-bars');

    // ── Section separator ─────────────────────────────────────────────────
    const topSectionH = N * barH;
    const gapY        = topSectionH + GAP / 2;

    g.append('line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', gapY).attr('y2', gapY)
      .attr('stroke', '#2a3a52').attr('stroke-dasharray', '4,4').attr('stroke-width', 0.75);

    // ── Section labels (right side) ───────────────────────────────────────
    g.append('text')
      .attr('x', iw + 4).attr('y', barH * 0.75)
      .attr('fill', '#a8d5a2').attr('font-size', 8)
      .text(`top ${N}`);
    g.append('text')
      .attr('x', iw + 4).attr('y', topSectionH + GAP + barH * 0.75)
      .attr('fill', '#f4a9a8').attr('font-size', 8)
      .text(`bot ${N}`);

    // ── Draw bars ─────────────────────────────────────────────────────────
    function makeBar(d, i, isTop) {
      const yy       = isTop ? i * barH : topSectionH + GAP + i * barH;
      const barW     = Math.max(0, x(d[col]) - baseX);
      const rawLabel = `${d.county}, ${d.state}`;
      const label    = rawLabel.length > 26 ? rawLabel.slice(0, 26) + '…' : rawLabel;
      const valFmt   = Math.abs(d[col]) >= 10000
        ? d[col].toLocaleString(undefined, { maximumFractionDigits: 0 })
        : d[col].toLocaleString(undefined, { maximumFractionDigits: 1 });

      const barG = barsG.append('g')
        .attr('class', 'rb-bar')
        .datum(d)
        .attr('cursor', 'pointer');

      // Bar rectangle
      barG.append('rect')
        .attr('x', baseX).attr('y', yy)
        .attr('width', barW)
        .attr('height', Math.max(1, barH - 2))
        .attr('fill', colorScale(d[col])).attr('opacity', 0.85).attr('rx', 2);

      // Value label (right of bar)
      barG.append('text')
        .attr('x', x(d[col]) + 3)
        .attr('y', yy + barH * 0.72)
        .attr('fill', '#8aa0bb').attr('font-size', 8)
        .text(valFmt);

      // County label (left, right-aligned)
      barG.append('text')
        .attr('x', -4).attr('y', yy + barH * 0.72)
        .attr('text-anchor', 'end').attr('font-size', 8)
        .attr('fill', isTop ? '#a8d5a2' : '#f4a9a8')
        .text(label);

      // Interactions
      barG
        .on('mouseover', (e, datum) => tip()
          .html(`<b>${datum.county}, ${datum.state}</b><br>${col}: <b>${valFmt}</b>`)
          .style('opacity', 1)
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mousemove', e => tip()
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mouseout', () => tip().style('opacity', 0))
        .on('click', (e, datum) => {
          e.stopPropagation();
          window.dispatch('brush', new Set([datum.fips]));
        });
    }

    top.forEach((d, i) => makeBar(d, i, true));
    bot.forEach((d, i) => makeBar(d, i, false));

    // ── Baseline (left edge of bars) ──────────────────────────────────────
    g.append('line')
      .attr('x1', baseX).attr('x2', baseX)
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', '#2a3a52').attr('stroke-width', 0.75);

    // ── X axis ────────────────────────────────────────────────────────────
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3).tickFormat(d3.format('~s')))
      .call(a => a.select('.domain').attr('stroke', '#2a3a52'))
      .call(a => a.selectAll('text').attr('fill', '#8aa0bb').attr('font-size', 8.5));

    update();
  }

  // ── Public: update (selection changed) ──────────────────────────────────
  function update() {
    if (!barsG) return;
    const sel    = window.state.selection;
    const hasSel = sel.size > 0;

    barsG.selectAll('.rb-bar')
      .classed('rb-dimmed',   d => hasSel && !sel.has(d.fips))
      .classed('rb-selected', d => hasSel &&  sel.has(d.fips));
  }

  // ── Public: recolor (colorVar changed) ──────────────────────────────────
  function recolor() {
    draw();
  }

  return { init, update, recolor };
})();

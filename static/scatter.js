// ── Scatter Plot ─────────────────────────────────────────────────────────────
// Plots each county as a dot on user-selected X and Y variables.
// Drag a rectangle to brush-select counties → updates all linked views.
// Click a dot for single-select; Shift+click to multi-select.
// When axes change (dropdown or heatmap click), call redraw().

window.ScatterChart = (() => {
  let svg, dotsG, brushG, xScale, yScale;
  let allData = [];
  const M = { top: 18, right: 18, bottom: 44, left: 56 };

  const tip = () => d3.select('#tooltip');

  // ── Helpers ──────────────────────────────────────────────────────────
  function dim() {
    const el = document.getElementById('scatter-wrap');
    return { w: el.clientWidth, h: el.clientHeight };
  }

  // ── Public: init ─────────────────────────────────────────────────────
  function init(data) {
    allData = data;
    redraw();
  }

  // ── Public: redraw (new axes or data) ────────────────────────────────
  function redraw() {
    d3.select('#scatter-wrap svg').remove();

    const { w, h } = dim();
    const iw = w - M.left - M.right;
    const ih = h - M.top  - M.bottom;

    const xVar = window.state.xVar;
    const yVar = window.state.yVar;

    svg = d3.select('#scatter-wrap')
      .append('svg').attr('width', w).attr('height', h);

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // ── Scales ─────────────────────────────────────────────────────────
    const valid = allData.filter(d => d[xVar] != null && d[yVar] != null);
    xScale = d3.scaleLinear()
      .domain(d3.extent(valid, d => d[xVar])).nice()
      .range([0, iw]);
    yScale = d3.scaleLinear()
      .domain(d3.extent(valid, d => d[yVar])).nice()
      .range([ih, 0]);

    // ── Grid lines ──────────────────────────────────────────────────────
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-iw).tickFormat(''))
      .call(gr => gr.select('.domain').remove());
    g.append('g').attr('class', 'grid').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(-ih).tickFormat(''))
      .call(gr => gr.select('.domain').remove());

    // ── Axes ────────────────────────────────────────────────────────────
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('~s')));
    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('~s')));

    // ── Axis labels ─────────────────────────────────────────────────────
    const xLabel = xVar.length > 30 ? xVar.slice(0, 30) + '…' : xVar;
    const yLabel = yVar.length > 30 ? yVar.slice(0, 30) + '…' : yVar;

    g.append('text')
      .attr('x', iw / 2).attr('y', ih + 38)
      .attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#6a8aaa')
      .text(xLabel);
    g.append('text')
      .attr('transform', `translate(-44, ${ih / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#6a8aaa')
      .text(yLabel);

    // ── Dots ─────────────────────────────────────────────────────────────
    dotsG = g.append('g');

    dotsG.selectAll('circle.dot')
      .data(valid)
      .join('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d[xVar]))
        .attr('cy', d => yScale(d[yVar]))
        .attr('r', 4)
        .attr('fill', '#3b82f6')
        .attr('opacity', 0.65)
        .on('mouseover', (e, d) => {
          tip()
            .html(`<b>${d.county}, ${d.state}</b><br>
              ${xVar}: <b>${fmt(d[xVar])}</b><br>
              ${yVar}: <b>${fmt(d[yVar])}</b>`)
            .style('opacity', 1)
            .style('left', (e.clientX + 15) + 'px')
            .style('top',  (e.clientY - 10) + 'px');
        })
        .on('mousemove', e => tip()
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mouseout', () => tip().style('opacity', 0))
        .on('click', (e, d) => {
          e.stopPropagation();
          const sel = new Set(window.state.selection);
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            sel.has(d.fips) ? sel.delete(d.fips) : sel.add(d.fips);
          } else {
            if (sel.size === 1 && sel.has(d.fips)) sel.clear();
            else { sel.clear(); sel.add(d.fips); }
          }
          window.dispatch('brush', sel);
        });

    // ── d3.brush for rectangle selection ────────────────────────────────
    brushG = g.append('g').attr('class', 'brush');

    const brush = d3.brush()
      .extent([[0, 0], [iw, ih]])
      .on('end', ({ selection }) => {
        if (!selection) return;
        const [[x0, y0], [x1, y1]] = selection;
        const brushed = new Set(
          valid.filter(d => {
            const cx = xScale(d[xVar]);
            const cy = yScale(d[yVar]);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
          }).map(d => d.fips)
        );
        window.dispatch('brush', brushed);
        // Clear visual brush after dispatching
        brushG.call(brush.clear);
      });

    brushG.call(brush);

    // Apply current selection state to freshly drawn dots
    update();
  }

  // ── Public: update (selection changed, axes unchanged) ───────────────
  function update() {
    if (!dotsG) return;
    const sel = window.state.selection;

    dotsG.selectAll('circle.dot')
      .classed('dimmed',   d => sel.size > 0 && !sel.has(d.fips))
      .classed('selected', d => sel.size > 0 &&  sel.has(d.fips))
      .attr('r',       d => sel.size > 0 && sel.has(d.fips) ? 5.5 : 4)
      .attr('fill',    d => sel.size > 0 && sel.has(d.fips) ? '#e85d04' : '#3b82f6')
      .attr('opacity', d => {
        if (sel.size === 0) return 0.65;
        return sel.has(d.fips) ? 1 : 0.06;
      });
  }

  // ── Utility ──────────────────────────────────────────────────────────
  function fmt(v) {
    if (v == null) return 'N/A';
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  return { init, update, redraw };
})();

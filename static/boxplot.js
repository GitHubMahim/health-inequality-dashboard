// ── State-Level Box Plot ──────────────────────────────────────────────────────
// Shows the distribution of the active variable across counties within each
// state. States are sorted left-to-right by median value so trends are visible.
// Click a state box to select all its counties → updates all linked views.
// Redraws fully when colorVar changes (different column, different scale).
// Dims/highlights state boxes when a brush selection is active.

window.BoxPlot = (() => {
  let svg, g, boxesG;
  let allData = [];
  let currentStats = [];
  const M = { top: 22, right: 16, bottom: 28, left: 48 };

  const STATE_ABBR = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY',
  };

  const tip = () => d3.select('#tooltip');

  // ── Public: init ────────────────────────────────────────────────────────
  function init(data) {
    allData = data;
    draw();
  }

  // ── Compute per-state box statistics ────────────────────────────────────
  function computeStats(col) {
    const byState = d3.group(allData, d => d.state);
    const stats = [];
    byState.forEach((counties, state) => {
      const vals = counties
        .map(d => d[col])
        .filter(v => v != null)
        .sort((a, b) => a - b);
      if (vals.length < 3) return;
      stats.push({
        state,
        abbr: STATE_ABBR[state] || state.slice(0, 2).toUpperCase(),
        // Use 5th/95th percentile for whiskers to reduce extreme outlier effect
        wlo:  d3.quantile(vals, 0.05),
        whi:  d3.quantile(vals, 0.95),
        q1:   d3.quantile(vals, 0.25),
        med:  d3.quantile(vals, 0.50),
        q3:   d3.quantile(vals, 0.75),
        fips: counties.map(c => c.fips),
        count: vals.length,
      });
    });
    // Sort states left-to-right by median (ascending)
    return stats.sort((a, b) => a.med - b.med);
  }

  // ── Internal: draw (full rebuild) ────────────────────────────────────────
  function draw() {
    d3.select('#boxplot-wrap svg').remove();

    const el = document.getElementById('boxplot-wrap');
    const W  = el.clientWidth;
    const H  = el.clientHeight;
    if (H < 10 || W < 10) return;

    const col   = window.state.colorVar;
    const stats = computeStats(col);
    currentStats = stats;

    const iw = W - M.left - M.right;
    const ih = H - M.top  - M.bottom;

    const vals = allData.filter(d => d[col] != null).map(d => d[col]);
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain(d3.extent(vals));

    const xScale = d3.scaleBand()
      .domain(stats.map(d => d.abbr))
      .range([0, iw])
      .padding(0.22);

    const allExtent = d3.extent(stats.flatMap(d => [d.wlo, d.whi]));
    const yScale = d3.scaleLinear().domain(allExtent).nice().range([ih, 0]);

    svg = d3.select('#boxplot-wrap')
      .append('svg').attr('width', W).attr('height', H);
    g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // ── Grid ──────────────────────────────────────────────────────────────
    g.selectAll('.bp-gl').data(yScale.ticks(4)).join('line')
      .attr('class', 'bp-gl')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('stroke', '#1a2230').attr('stroke-dasharray', '3,3');

    // ── Boxes layer ───────────────────────────────────────────────────────
    boxesG = g.append('g').attr('class', 'bp-boxes');
    renderBoxes(stats, xScale, yScale, colorScale);

    // ── Axes ──────────────────────────────────────────────────────────────
    // X axis — suppress per-state tick labels; user hovers to see state name
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).tickSize(0).tickFormat(''))
      .call(a => a.select('.domain').attr('stroke', '#2a3a52'));

    // Single "States" label centered below the axis
    g.append('text').attr('class', 'chart-label')
      .attr('x', iw / 2).attr('y', ih + 16)
      .attr('text-anchor', 'middle').attr('font-size', 8.5)
      .text('States (sorted by median ↑)');

    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(yScale).ticks(4).tickSize(3).tickFormat(d3.format('~s')))
      .call(a => a.select('.domain').attr('stroke', '#2a3a52'))
      .call(a => a.selectAll('text').attr('fill', '#8aa0bb').attr('font-size', 9));

    // ── Y-axis label ──────────────────────────────────────────────────────
    const shortLabel = col.length > 22 ? col.slice(0, 22) + '…' : col;
    g.append('text').attr('class', 'chart-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -ih / 2).attr('y', -38)
      .attr('text-anchor', 'middle').attr('font-size', 8.5)
      .text(shortLabel);

    update();
  }

  // ── Render individual boxes ───────────────────────────────────────────────
  function renderBoxes(stats, xScale, yScale, colorScale) {
    boxesG.selectAll('*').remove();

    stats.forEach(d => {
      const bw  = xScale.bandwidth();
      const cx  = xScale(d.abbr) + bw / 2;
      const col = colorScale(d.med);

      const stG = boxesG.append('g')
        .attr('class', 'bp-state')
        .datum(d);

      // Whisker line (5th–95th percentile)
      stG.append('line').attr('class', 'bp-whisker')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', yScale(d.wlo)).attr('y2', yScale(d.whi))
        .attr('stroke', '#5a7a9a').attr('stroke-width', 1);

      // Whisker caps
      [d.wlo, d.whi].forEach(v => stG.append('line').attr('class', 'bp-cap')
        .attr('x1', cx - bw * 0.3).attr('x2', cx + bw * 0.3)
        .attr('y1', yScale(v)).attr('y2', yScale(v))
        .attr('stroke', '#5a7a9a').attr('stroke-width', 1));

      // IQR box (Q1–Q3)
      stG.append('rect').attr('class', 'bp-iqr')
        .attr('x', xScale(d.abbr))
        .attr('y', yScale(d.q3))
        .attr('width', bw)
        .attr('height', Math.max(1, yScale(d.q1) - yScale(d.q3)))
        .attr('fill', col).attr('fill-opacity', 0.72)
        .attr('stroke', col).attr('stroke-width', 0.8).attr('rx', 2);

      // Median line
      stG.append('line').attr('class', 'bp-med')
        .attr('x1', xScale(d.abbr)).attr('x2', xScale(d.abbr) + bw)
        .attr('y1', yScale(d.med)).attr('y2', yScale(d.med))
        .attr('stroke', '#fff').attr('stroke-width', 1.5);

      // Invisible hover/click overlay spanning full whisker range
      stG.append('rect')
        .attr('x', xScale(d.abbr))
        .attr('y', yScale(d.whi))
        .attr('width', bw)
        .attr('height', Math.max(1, yScale(d.wlo) - yScale(d.whi)))
        .attr('fill', 'transparent').attr('cursor', 'pointer')
        .on('mouseover', (e, datum) => tip()
          .html(`<b>${datum.state}</b><br>${window.state.colorVar}:<br>
            Median <b>${datum.med.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><br>
            IQR ${datum.q1.toLocaleString(undefined, { maximumFractionDigits: 1 })}–${datum.q3.toLocaleString(undefined, { maximumFractionDigits: 1 })}<br>
            ${datum.count} counties`)
          .style('opacity', 1)
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mousemove', e => tip()
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mouseout', () => tip().style('opacity', 0))
        .on('click', (e, datum) => {
          e.stopPropagation();
          window.dispatch('brush', new Set(datum.fips));
        });
    });
  }

  // ── Public: update (selection changed) ──────────────────────────────────
  function update() {
    if (!boxesG) return;
    const sel    = window.state.selection;
    const hasSel = sel.size > 0;

    boxesG.selectAll('.bp-state')
      .classed('bp-dimmed',      d => hasSel && !d.fips.some(f => sel.has(f)))
      .classed('bp-highlighted', d => hasSel &&  d.fips.some(f => sel.has(f)));
  }

  // ── Public: recolor (colorVar changed) ──────────────────────────────────
  // Full redraw because the column, scale domain, and box positions all change.
  function recolor() {
    draw();
  }

  return { init, update, recolor };
})();

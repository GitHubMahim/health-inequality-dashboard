// ── Parallel Coordinates Plot ────────────────────────────────────────────────
// Each county is a polyline crossing all 20 variable axes.
// Lines are colored by Life Expectancy (same scale as the map default).
// Brush any axis to filter counties → updates all linked views.
// Multiple axis brushes are AND-combined.
// Panel scrolls horizontally to fit all axes.

window.ParallelChart = (() => {
  let svg, linesG;
  let allData = [], cols = [];
  let yScales  = {};
  let colorScale;
  const activeBrushes = {};     // col -> [dataMin, dataMax] | null
  const brushInstances = {};    // col -> d3.brushY instance (stored for clearBrushes)

  const AXIS_SPACING = 78;    // px between axes
  const M = { top: 26, right: 40, bottom: 8, left: 40 };

  // Abbreviated axis labels (keep ≤ 14 chars for readability)
  const SHORT = {
    'Life Expectancy':                          'Life Expect.',
    'Years of Potential Life Lost Rate':        'YPLL Rate',
    '% Fair or Poor Health':                    '% Poor Health',
    'Average Number of Physically Unhealthy Days': 'Phys Unhlthy',
    'Average Number of Mentally Unhealthy Days':   'Mental Unhlthy',
    'Drug Overdose Mortality Rate':             'Drug OD Rate',
    'Firearm Fatalities Rate':                  'Firearm Fatal.',
    'Homicide Rate':                            'Homicide Rate',
    'Injury Death Rate':                        'Injury Deaths',
    'Primary Care Physicians Rate':             'PCP Rate',
    '% Uninsured':                              '% Uninsured',
    '% Unemployed':                             '% Unemployed',
    'Income Ratio':                             'Income Ratio',
    '% Children in Poverty':                    '% Child Poverty',
    'Median Household Income':                  'Med. Income',
    'High School Graduation Rate':              'HS Grad %',
    '% Adults with Obesity':                    '% Obese',
    '% Adults Reporting Currently Smoking':     '% Smoking',
    '% Rural':                                  '% Rural',
    'Population':                               'Population',
  };

  const tip = () => d3.select('#tooltip');

  // ── Public: init ─────────────────────────────────────────────────────
  function init(data, columns) {
    allData = data;
    cols    = columns;
    cols.forEach(c => { activeBrushes[c] = null; });
    draw();
  }

  // ── Internal: draw (builds SVG from scratch) ──────────────────────────
  function draw() {
    d3.select('#parallel-wrap svg').remove();

    const el  = document.getElementById('parallel-wrap');
    const elH = el.clientHeight;

    // Guard: don't draw into a zero-size panel (dashboard not yet visible)
    if (elH < 10) return;
    const ih  = elH - M.top - M.bottom;

    // SVG is wide enough for all axes (may exceed panel width → panel scrolls)
    const svgW = M.left + (cols.length - 1) * AXIS_SPACING + M.right;
    const svgH = elH;

    svg = d3.select('#parallel-wrap')
      .append('svg')
      .attr('width',  Math.max(svgW, el.clientWidth))
      .attr('height', svgH);

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    // ── Per-axis scales ────────────────────────────────────────────────
    cols.forEach(c => {
      const vals = allData.filter(d => d[c] != null).map(d => d[c]);
      yScales[c] = d3.scaleLinear()
        .domain(d3.extent(vals)).nice()
        .range([ih, 0]);
    });

    // ── Color scale (Life Expectancy) ───────────────────────────────────
    recolor();

    // ── Line generator (skips null points) ──────────────────────────────
    const lineGen = d3.line()
      .defined(([, y]) => y != null)
      .x(([x]) => x)
      .y(([, y]) => y);

    function makePath(d) {
      const pts = cols.map((c, i) => [
        i * AXIS_SPACING,
        d[c] != null ? yScales[c](d[c]) : null,
      ]);
      return lineGen(pts);
    }

    // ── Lines ────────────────────────────────────────────────────────────
    linesG = g.append('g').attr('class', 'pcp-lines');

    linesG.selectAll('path.pcp-line')
      .data(allData)
      .join('path')
        .attr('class', 'pcp-line')
        .attr('d', makePath)
        .attr('stroke', d => {
          const v = d['Life Expectancy'];
          return v != null ? colorScale(v) : '#aaa';
        })
        .attr('opacity', 0.38)
        .on('mouseover', (e, d) => {
          tip()
            .html(`<b>${d.county}, ${d.state}</b><br>Life Expect.: <b>${
              d['Life Expectancy'] != null
                ? d['Life Expectancy'].toFixed(1)
                : 'N/A'
            }</b>`)
            .style('opacity', 1)
            .style('left', (e.clientX + 15) + 'px')
            .style('top',  (e.clientY - 10) + 'px');
        })
        .on('mousemove', e => tip()
          .style('left', (e.clientX + 15) + 'px')
          .style('top',  (e.clientY - 10) + 'px'))
        .on('mouseout', () => tip().style('opacity', 0));

    // ── Axes + brushes ───────────────────────────────────────────────────
    cols.forEach((col, i) => {
      const axG = g.append('g')
        .attr('class', 'pcp-axis')
        .attr('transform', `translate(${i * AXIS_SPACING}, 0)`);

      // Axis
      axG.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScales[col]).ticks(4).tickSize(3))
        .call(ax => ax.select('.domain').attr('stroke', '#c5d8ef'));

      // Label
      axG.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -10)
        .attr('font-size', 8.5)
        .attr('font-weight', '600')
        .attr('fill', '#1565c0')
        .text(SHORT[col] || col);

      // d3.brushY for this axis
      const axisBrush = d3.brushY()
        .extent([[-9, 0], [9, ih]])
        .on('end', ({ selection }) => {
          activeBrushes[col] = selection
            ? [yScales[col].invert(selection[1]), yScales[col].invert(selection[0])]
            : null;
          applyFilters();
        });

      brushInstances[col] = axisBrush;   // store for clearBrushes

      axG.append('g')
        .attr('class', `pcp-brush pcp-brush-${i}`)
        .call(axisBrush);
    });

    update();
  }

  // ── Apply all active axis brushes → dispatch selection ───────────────
  function applyFilters() {
    const active = Object.entries(activeBrushes).filter(([, v]) => v !== null);

    let sel;
    if (active.length === 0) {
      sel = new Set();
    } else {
      sel = new Set(
        allData.filter(d =>
          active.every(([c, [lo, hi]]) => d[c] != null && d[c] >= lo && d[c] <= hi)
        ).map(d => d.fips)
      );
    }
    window.dispatch('brush', sel);
  }

  // ── Public: update (dim/highlight based on selection) ─────────────────
  function update() {
    if (!linesG) return;
    const sel = window.state.selection;

    linesG.selectAll('path.pcp-line')
      .classed('dimmed',      d => sel.size > 0 && !sel.has(d.fips))
      .classed('highlighted', d => sel.size > 0 &&  sel.has(d.fips))
      .attr('opacity', d => {
        if (sel.size === 0) return 0.38;
        return sel.has(d.fips) ? 0.82 : 0.04;
      });
  }

  // ── Public: recolor lines when colorVar changes ───────────────────────
  function recolor() {
    const col  = window.state.colorVar || 'Life Expectancy';
    const vals = allData.filter(d => d[col] != null).map(d => d[col]);
    colorScale  = d3.scaleSequential(d3.interpolateRdYlGn).domain(d3.extent(vals));

    if (linesG) {
      linesG.selectAll('path.pcp-line')
        .attr('stroke', d => {
          const v = d[col];
          return v != null ? colorScale(v) : '#aaa';
        });
    }
  }

  // ── Public: clear all axis brushes ───────────────────────────────────
  function clearBrushes() {
    cols.forEach((col, i) => {
      activeBrushes[col] = null;
      // Use the stored brush instance to programmatically clear each brush
      if (svg && brushInstances[col]) {
        svg.select(`.pcp-brush-${i}`).call(brushInstances[col].move, null);
      }
    });
  }

  return { init, update, recolor, clearBrushes };
})();

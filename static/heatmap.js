// ── Correlation Heatmap ──────────────────────────────────────────────────────
// Displays the Pearson correlation matrix for all 20 numeric variables.
// Color: diverging red (−1) → white (0) → blue (+1).
// Hover a cell to see the exact correlation value in the tooltip.
// Click a cell to update the scatter plot axes to those two variables.
// Currently selected scatter axes are highlighted with an orange border.

window.HeatmapChart = (() => {
  let svgEl;          // the D3 selection for the svg
  let corrCols = [];
  let corrMatrix = [];

  const SHORT = {
    'Life Expectancy':                          'Life Expect.',
    'Years of Potential Life Lost Rate':        'YPLL Rate',
    '% Fair or Poor Health':                    '% Poor Health',
    'Average Number of Physically Unhealthy Days': 'Phys Unhlthy',
    'Average Number of Mentally Unhealthy Days':   'Ment Unhlthy',
    'Drug Overdose Mortality Rate':             'Drug OD Rate',
    'Firearm Fatalities Rate':                  'Firearm Fatal.',
    'Homicide Rate':                            'Homicide Rate',
    'Injury Death Rate':                        'Injury Deaths',
    'Primary Care Physicians Rate':             'PCP Rate',
    '% Uninsured':                              '% Uninsured',
    '% Unemployed':                             '% Unemployed',
    'Income Ratio':                             'Income Ratio',
    '% Children in Poverty':                    '% Child Pov.',
    'Median Household Income':                  'Med. Income',
    'High School Graduation Rate':              'HS Grad %',
    '% Adults with Obesity':                    '% Obese',
    '% Adults Reporting Currently Smoking':     '% Smoking',
    '% Rural':                                  '% Rural',
    'Population':                               'Population',
  };

  const tip = () => d3.select('#tooltip');

  // ── Public: init ─────────────────────────────────────────────────────
  function init(corrData) {
    corrCols   = corrData.columns;
    corrMatrix = corrData.matrix;
    draw();
  }

  // ── Internal: draw ────────────────────────────────────────────────────
  function draw() {
    d3.select('#heatmap-wrap svg').remove();

    const el = document.getElementById('heatmap-wrap');
    const W  = el.clientWidth;
    const H  = el.clientHeight;
    const n  = corrCols.length;

    // Fit cell size to available space
    const labelW = 70;
    const labelH = 70;
    const legH   = 22;
    const cellSize = Math.max(
      6,
      Math.min(
        Math.floor((W - labelW - 4) / n),
        Math.floor((H - labelH - legH - 4) / n)
      )
    );

    const svgW = labelW + n * cellSize + 4;
    const svgH = labelH + n * cellSize + legH + 4;

    svgEl = d3.select('#heatmap-wrap')
      .append('svg')
      .attr('width',  svgW)
      .attr('height', svgH);

    // Diverging color scale: red → white → blue
    const colorScale = d3.scaleDiverging(d3.interpolateRdBu).domain([-1, 0, 1]);

    // ── Cells ──────────────────────────────────────────────────────────
    const cellG = svgEl.append('g')
      .attr('transform', `translate(${labelW}, ${labelH})`);

    corrCols.forEach((rowVar, ri) => {
      corrCols.forEach((colVar, ci) => {
        const val = corrMatrix[ri][ci];
        if (val == null) return;

        cellG.append('rect')
          .attr('class', 'hm-cell')
          .attr('data-row', ri)
          .attr('data-col', ci)
          .attr('x', ci * cellSize)
          .attr('y', ri * cellSize)
          .attr('width',  cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', colorScale(val))
          .attr('rx', 1)
          .on('mouseover', e => {
            tip()
              .html(`<b>${SHORT[rowVar] || rowVar}</b> ×<br>
                <b>${SHORT[colVar] || colVar}</b><br>
                r = <b>${val.toFixed(3)}</b>`)
              .style('opacity', 1)
              .style('left', (e.clientX + 15) + 'px')
              .style('top',  (e.clientY - 10) + 'px');
          })
          .on('mousemove', e => tip()
            .style('left', (e.clientX + 15) + 'px')
            .style('top',  (e.clientY - 10) + 'px'))
          .on('mouseout', () => tip().style('opacity', 0))
          .on('click', () => {
            // Skip diagonal (self-correlation)
            if (rowVar === colVar) return;
            // Set scatter axes: X = colVar, Y = rowVar
            window.dispatch('setAxes', { x: colVar, y: rowVar });
            highlightAxes(colVar, rowVar);
          });
      });
    });

    // ── X-axis labels (diagonal, top) ──────────────────────────────────
    const xLabG = svgEl.append('g')
      .attr('transform', `translate(${labelW}, ${labelH - 2})`);

    corrCols.forEach((c, i) => {
      xLabG.append('text')
        .attr('class', 'hm-label')
        .attr('x', i * cellSize + cellSize / 2)
        .attr('y', 0)
        .attr('text-anchor', 'end')
        .attr('transform', `rotate(-45, ${i * cellSize + cellSize / 2}, 0)`)
        .text(SHORT[c] || c);
    });

    // ── Y-axis labels (right-aligned, left side) ────────────────────────
    const yLabG = svgEl.append('g')
      .attr('transform', `translate(${labelW - 3}, ${labelH})`);

    corrCols.forEach((c, i) => {
      yLabG.append('text')
        .attr('class', 'hm-label')
        .attr('x', 0)
        .attr('y', i * cellSize + cellSize / 2 + 3)
        .attr('text-anchor', 'end')
        .text(SHORT[c] || c);
    });

    // ── Color legend bar ───────────────────────────────────────────────
    const legW   = n * cellSize;
    const legY   = labelH + n * cellSize + 6;
    const legDefs = svgEl.append('defs');
    const legGrad = legDefs.append('linearGradient').attr('id', 'hm-leg-grad');

    [-1, -0.5, 0, 0.5, 1].forEach((v, i) => {
      legGrad.append('stop')
        .attr('offset', `${i * 25}%`)
        .attr('stop-color', colorScale(v));
    });

    const legG = svgEl.append('g')
      .attr('transform', `translate(${labelW}, ${legY})`);

    legG.append('rect')
      .attr('width', legW).attr('height', 9)
      .attr('fill', 'url(#hm-leg-grad)').attr('rx', 2);

    [{ x: 0, label: '−1', anchor: 'start' },
     { x: legW / 2, label: '0', anchor: 'middle' },
     { x: legW, label: '+1', anchor: 'end' }]
      .forEach(({ x, label, anchor }) => {
        legG.append('text')
          .attr('x', x).attr('y', 18)
          .attr('font-size', 8).attr('fill', '#6a8aaa')
          .attr('text-anchor', anchor)
          .text(label);
      });

    legG.append('text')
      .attr('x', legW / 2).attr('y', 28)
      .attr('font-size', 7.5).attr('fill', '#9ab').attr('text-anchor', 'middle')
      .text('Pearson r');

    // Highlight initially selected axes
    highlightAxes(window.state.xVar, window.state.yVar);
  }

  // ── Highlight cells whose row/col correspond to current scatter axes ──
  function highlightAxes(xVar, yVar) {
    if (!svgEl) return;
    const xi = corrCols.indexOf(xVar);
    const yi = corrCols.indexOf(yVar);

    svgEl.selectAll('.hm-cell')
      .classed('axis-highlight', function () {
        const ri = +this.dataset.row;
        const ci = +this.dataset.col;
        return (ri === yi && ci === xi) || (ri === xi && ci === yi);
      });
  }

  return { init, highlightAxes };
})();

"use strict";

/*
TimeArcs-style co-authorship timeline renderer

- Each author is assigned a horizontal lane (row).
- For each year Y, every coauthor pair (A,B) in that year creates an arc:
    * Both endpoints sit at x = Jan 1 of Y
    * One endpoint at row(A), the other at row(B)
    * Arc bows outward (circular arc)
- Stroke width is constant for now.
- Vertical ordering:
    1. start with a deterministic order (degree, total pubs, first pub year, alpha)
    2. run a tiny 1D "force" pass so authors who co-write a lot pull closer,
       then discretize rows from top to bottom.
- You can zoom horizontally (x-scale zoom) and drag vertically to pan.

D3 version: v3.5.17
*/

// -------------------------------------------------------------
// Layout / sizing globals
// -------------------------------------------------------------
var margin = { top: 36, right: 30, bottom: 24, left: 200 };

var width  = window.innerWidth  - margin.left - margin.right;
var height = window.innerHeight - 90 /* header-ish */ - margin.top - margin.bottom;

var rowHeight   = 16;
var plotYOffset = 8;
var TOP_N       = 100000;

// vertical scrolling state
var yOffset       = 0;
var contentHeight = 0;

// left zoom clamp (earliest interesting date)
var minDate = null;

// D3 selections (assigned in initChart)
var svg, rootG, xScale, plotG, gridG, arcG, labelsG, axisG;
var tooltip = d3.select('#tooltip');

// we keep xAxis in outer scope so render() can reuse/refresh ticks
var xAxis = null;

// -------------------------------------------------------------
// Helpers to parse authors, clean names, parse year
// -------------------------------------------------------------
function isInvalidName(name) {
  if (!name) return true;
  var n = name.trim();
  if (!n) return true;
  return n.toLowerCase() === 'others';
}

function extractAuthors(row) {
  // Collect Author_* columns plus "List of Authors"
  var names = [];

  var authorCols = Object.keys(row).filter(function (k) {
    return k.indexOf('Author_') === 0;
  });

  authorCols.forEach(function (col) {
    var v = row[col];
    if (v && v.trim() && v.toLowerCase() !== 'na' && !isInvalidName(v)) {
      names.push(v.trim());
    }
  });

  if (row['List of Authors']) {
    row['List of Authors']
      .split(/\s+(?:and|&)\s+|;/)
      .forEach(function (p) {
        var n = p.trim();
        if (n && n.toLowerCase() !== 'na' && !isInvalidName(n)) names.push(n);
      });
  }

  // dedupe in insertion order
  var seen = {};
  var out = [];
  names.forEach(function (n) {
    if (!seen[n]) {
      seen[n] = true;
      out.push(n);
    }
  });

  return out;
}

function parseYear(s) {
  var y = parseInt(s, 10);
  return isNaN(y) ? null : y;
}

// -------------------------------------------------------------
// Step 1: process CSV rows -> list of {authors[], year, date}
// plus per-author counts, firstYear, ranking list
// -------------------------------------------------------------
function processData(csv) {
  var rows = csv.map(function (r) {
    var y = parseYear(r.Year);
    return {
      authors: extractAuthors(r),
      year:    y,
      date:    y ? new Date(y, 0, 1) : null
    };
  }).filter(function (r) {
    // only keep rows with valid year + >=2 authors
    return r.year && r.authors.length >= 2;
  });

  var counts    = {};
  var firstYear = {};

  rows.forEach(function (r) {
    r.authors.forEach(function (a) {
      counts[a] = (counts[a] || 0) + 1;
      if (!firstYear[a]) firstYear[a] = r.year;
    });
  });

  // rank authors globally:
  //   1. higher pub count first
  //   2. earlier first pub
  //   3. alphabetical
  var sorted = Object.keys(counts).sort(function (a, b) {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    var ya = firstYear[a] || Infinity;
    var yb = firstYear[b] || Infinity;
    if (ya !== yb) return ya - yb;
    return a.localeCompare(b);
  });

  return {
    rows: rows,
    counts: counts,
    firstYear: firstYear,
    sortedAuthors: sorted
  };
}

// -------------------------------------------------------------
// Step 2: build coauthorship graph for top authors
// Returns:
//   nodes: [{id,label}, ...]
//   links: [{source:<name>, target:<name>, year:<Y>, date:<Date Jan1 Y>}]
//   topSet: {name: true, ...}
//   pairWeights: {"A||B": totalCollabCountAcrossAllYears}
// -------------------------------------------------------------
function buildGraph(rows, topAuthors) {
  var topSet = {};
  topAuthors.forEach(function (a) { topSet[a] = true; });

  var nodes = topAuthors.map(function (a) {
    return { id: a, label: a };
  });

  var links = [];
  var pairWeights = {}; // how strong A<->B overall

  rows.forEach(function (r) {
    // keep only top authors for this publication
    var aa = r.authors.filter(function (a) { return topSet[a]; }).sort();
    if (aa.length < 2) return;

    for (var i = 0; i < aa.length; i++) {
      for (var j = i + 1; j < aa.length; j++) {
        var a = aa[i], b = aa[j];

        links.push({
          source: a,
          target: b,
          year:   r.year,
          date:   new Date(r.year, 0, 1) // anchor at Jan 1 of that year
        });

        var key = a + "||" + b;
        pairWeights[key] = (pairWeights[key] || 0) + 1;
      }
    }
  });

  return {
    nodes: nodes,
    links: links,
    topSet: topSet,
    pairWeights: pairWeights
  };
}

// -------------------------------------------------------------
// Degree helper
// -------------------------------------------------------------
function degrees(links) {
  var d = {};
  links.forEach(function (l) {
    d[l.source] = (d[l.source] || 0) + 1;
    d[l.target] = (d[l.target] || 0) + 1;
  });
  return d;
}

// -------------------------------------------------------------
// Step 3: vertical layout with a small 1D force
//
// 1. Start with deterministic ordering (your old heuristic).
// 2. Build weighted edges between coauthors (pairWeights).
// 3. Apply iterative 1D attraction + collision.
// 4. Sort by final y to get rows 0..N-1.
// -------------------------------------------------------------
function layoutWithForce(nodes, links, counts, firstYear, pairWeights) {
  var deg = degrees(links);

  // initial sort: higher degree, then pub count, then earlier year, then alpha
  nodes = nodes.slice().sort(function (a, b) {
    var da = deg[a.id] || 0;
    var db = deg[b.id] || 0;
    if (db !== da) return db - da;

    var ca = counts[a.id] || 0;
    var cb = counts[b.id] || 0;
    if (cb !== ca) return cb - ca;

    var ya = firstYear[a.id] || Infinity;
    var yb = firstYear[b.id] || Infinity;
    if (ya !== yb) return ya - yb;

    return a.label.localeCompare(b.label);
  });

  // map node.id -> index
  var indexOf = {};
  nodes.forEach(function (n, i) { indexOf[n.id] = i; });

  // weighted edges
  var forceEdges = [];
  Object.keys(pairWeights).forEach(function (key) {
    var parts = key.split("||");
    var a = parts[0], b = parts[1];
    if (indexOf[a] == null || indexOf[b] == null) return;
    forceEdges.push({
      a: indexOf[a],
      b: indexOf[b],
      w: pairWeights[key]
    });
  });

  // initialize y positions and velocities
  nodes.forEach(function (n, i) {
    n._y = i * rowHeight;
    n.vy = 0;
  });

  // small force iteration
  var ITER = 200;
  for (var it = 0; it < ITER; it++) {

    // attract collaborators
    forceEdges.forEach(function (e) {
      var na = nodes[e.a];
      var nb = nodes[e.b];
      var dy = nb._y - na._y;
      var k  = 0.001 * e.w; // spring strength
      var adj = dy * k;
      na.vy += adj;
      nb.vy -= adj;
    });

    // collision so rows don't sit on top of each other
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var n1 = nodes[i];
        var n2 = nodes[j];
        var diff = n2._y - n1._y;
        var dist = Math.abs(diff) + 1e-6;
        var minDist = rowHeight;
        if (dist < minDist) {
          // push them apart symmetrically
          var push = (minDist - dist) * 0.5;
          if (diff >= 0) {
            n1.vy -= push;
            n2.vy += push;
          } else {
            n1.vy += push;
            n2.vy -= push;
          }
        }
      }
    }

    // integrate and damp
    nodes.forEach(function (n) {
      n._y += n.vy;
      n.vy *= 0.5;
    });
  }

  // freeze final order by _y
  nodes.sort(function (a, b) { return a._y - b._y; });

  // assign discrete row index based on sorted order
  nodes.forEach(function (n, i) {
    n.row = i;
  });

  return { nodes: nodes, deg: deg };
}

// -------------------------------------------------------------
// Step 4: init the SVG scene for the given number of rows
// -------------------------------------------------------------
function initChart(totalRows) {
  // Clear any previous render
  d3.select('.timearcs-panel').selectAll('*').remove();

  svg = d3.select('.timearcs-panel')
    .append('svg')
    .attr('width',  width  + margin.left + margin.right)
    .attr('height', height + margin.top  + margin.bottom)
    .style('background', '#fff');

  rootG = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  // Clip region so vertical pan doesn't draw outside the panel
  var defs = svg.append('defs');
  defs.append('clipPath')
    .attr('id', 'plot-clip')
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width',  width)
    .attr('height', height);

  axisG = rootG.append('g').attr('class', 'x axis');

  plotG = rootG.append('g')
    .attr('class', 'plot')

  gridG   = plotG.append('g').attr('class', 'grid');
  arcG    = plotG.append('g').attr('class', 'arcs');
  labelsG = rootG.append('g').attr('class', 'labels');

  xScale = d3.time.scale().range([0, width]);

  // total scrollable vertical content = rows * rowHeight
  contentHeight = totalRows * rowHeight;

  // clamp yOffset so we don't jump
  yOffset = Math.min(
    Math.max(0, yOffset),
    Math.max(0, contentHeight - height)
  );
}

// -------------------------------------------------------------
// Step 5: draw() builds axes, zoom, render() loop
// -------------------------------------------------------------
function draw(nodes, links, timeDomain) {
  xScale.domain(timeDomain);

  // precompute all whole years in domain
  var fullYears = d3.time.years(timeDomain[0], timeDomain[1], 1);

  xAxis = d3.svg.axis()
    .scale(xScale)
    .orient('top')
    .tickFormat(d3.time.format('%Y'))
    .tickValues(fullYears);

  // render axis initially
  axisG.call(xAxis);
  axisG.selectAll('.tick line')
    .attr('y2', height)
    .style('stroke', '#eee');

  // first pass render
  render();

  // ------------- zoom + vertical drag -------------
  var zoom = d3.behavior.zoom()
    .x(xScale)
    .scaleExtent([1, 50])
    .on('zoom', function () {
      clampLeft();
      render();
    });

  // create interaction rect
  rootG.append('rect')
    .attr('class', 'zoom-pane')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width',  width)
    .attr('height', height)
    .style('fill', 'transparent')
    .style('pointer-events', 'all')
    .style('cursor', 'move')
    .call(zoom)
    // vertical pan on drag
    .call(
      d3.behavior.drag().on('drag', function () {
        var maxOffset = Math.max(0, contentHeight - height);
        yOffset -= d3.event.dy;
        yOffset = Math.max(0, Math.min(maxOffset, yOffset));
        render();
      })
    );

  // keep left boundary >= minDate
  function clampLeft() {
    if (!minDate) return;
    var dom = xScale.domain();
    if (dom[0] < minDate) {
      var span = dom[1].getTime() - dom[0].getTime();
      var new0 = +minDate;
      var new1 = new0 + span;
      xScale.domain([ new Date(new0), new Date(new1) ]);
    }
  }

  // ------------- inner render function -------------
  function render() {
    var dom = xScale.domain();

    // figure out which ticks (years) are in view
    var visYears = fullYears.filter(function (d) {
      return d >= dom[0] && d <= dom[1];
    });

    // refresh axis ticks to only show what’s in the current zoom window
    xAxis.tickValues(visYears);
    axisG.call(xAxis);
    axisG.selectAll('.tick line')
      .attr('y2', height)
      .style('stroke', '#eee');

    // vertical pan via transform
    plotG.attr('transform', 'translate(0,' + (-yOffset) + ')');

    // === GRID LINES FOR YEARS ===
    var yearLines = gridG.selectAll('line.year')
      .data(visYears, function(d){ return +d; });

    yearLines.enter()
      .append('line')
      .attr('class', 'year')
      .style('stroke', '#eee')
      .style('shape-rendering', 'crispEdges');

    yearLines.exit().remove();

    gridG.selectAll('line.year')
      .attr('x1', function (d) { return xScale(d); })
      .attr('x2', function (d) { return xScale(d); })
      .attr('y1', 0)
      .attr('y2', contentHeight);

    // === AUTHOR LABELS (scroll with plot) ===
    labelsG.attr('transform', 'translate(0,' + (-yOffset) + ')');

    var labels = labelsG.selectAll('text.author-label')
      .data(nodes, function (d) { return d.id; });

    var labelsEnter = labels.enter()
      .append('text')
      .attr('class', 'author-label')
      .attr('x', -10)
      .attr('dy', '0.35em')
      .style('text-anchor', 'end')
      .text(function (d) { return d.label; })
      .on('mouseover', function (d) {
        // fade non-neighbor arcs
        arcG.selectAll('path.arc')
          .style('stroke-opacity', function (a) {
            return (a.source === d.id || a.target === d.id) ? 1 : 0.15;
          });
      })
      .on('mouseout', function () {
        arcG.selectAll('path.arc').style('stroke-opacity', 0.85);
      });

    labels.merge = labels.merge || function(sel){ return sel; }; // d3v4 pattern guard, harmless in v3
    labelsEnter.attr('y', function (d) {
      return d.row * rowHeight + plotYOffset;
    });

    labels
      .attr('y', function (d) {
        return d.row * rowHeight + plotYOffset;
      });

    labels.exit().remove();

    // === ARCS ===
    // lookup table id -> node (for row calc)
    var nodeById = {};
    nodes.forEach(function (n) { nodeById[n.id] = n; });

    var arcs = arcG.selectAll('path.arc')
      .data(links);

    var arcsEnter = arcs.enter()
      .append('path')
      .attr('class', 'arc')
      .style('fill', 'none')
      .style('stroke', '#1e88e5')
      .style('stroke-width', 1.25)
      .style('stroke-opacity', 0.85)
      .on('mouseover', function (d) {
        tooltip
          .style('display', 'block')
          .html(
            '<strong>' + d.source + '</strong> × <strong>' +
            d.target + '</strong><br>Year: ' + d.year
          );

        d3.select(this).style('stroke-opacity', 1);

        arcG.selectAll('path.arc')
          .style('stroke-opacity', function (a) {
            return a === d ? 1 : 0.15;
          });
      })
      .on('mousemove', function () {
        var e = d3.event;
        tooltip
          .style('left',  (e.pageX + 10) + 'px')
          .style('top',   (e.pageY + 10) + 'px');
      })
      .on('mouseout', function () {
        tooltip.style('display', 'none');
        arcG.selectAll('path.arc')
          .style('stroke-opacity', 0.85);
      });

    // draw/update path geometry for both enter + update
    function arcPath(d) {
      // X anchor = Jan 1 of that year
      var x = xScale(new Date(d.year, 0, 1));

      var y1 = nodeById[d.source].row * rowHeight + plotYOffset;
      var y2 = nodeById[d.target].row * rowHeight + plotYOffset;

      var yStart = Math.min(y1, y2);
      var yEnd   = Math.max(y1, y2);
      var dy     = Math.abs(y2 - y1);

      // radius ~ half vertical distance, with a floor
      var r = Math.max(6, dy / 2);

      // SVG arc going "to the right":
      // large-arc-flag = 0, sweep-flag = 1
      return 'M' + x + ',' + yStart +
             'A' + r + ',' + r + ' 0 0,1 ' +
             x + ',' + yEnd;
    }

    arcsEnter.attr('d', arcPath);
    arcs.attr('d', arcPath);

    arcs.exit().remove();
  }
}

// -------------------------------------------------------------
// Step 6: File input -> parse -> pipeline -> render
// -------------------------------------------------------------
document.getElementById('fileInput').addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    complete: function (res) {
      var parsed = processData(res.data);

      // take top N authors
      var topAuthors = parsed.sortedAuthors.slice(0, TOP_N);

      // build graph restricted to those authors
      var graph = buildGraph(parsed.rows, topAuthors);

      // vertical force layout to cluster collaborators
      var lay = layoutWithForce(
        graph.nodes,
        graph.links,
        parsed.counts,
        parsed.firstYear,
        graph.pairWeights
      );

      // compute time domain
      // gather years with any top author
      var topSet = graph.topSet;
      var yearsWithAnyTop = parsed.rows
        .filter(function (r) {
          return r.authors.some(function (a) { return !!topSet[a]; });
        })
        .map(function (r) { return r.year; });

      // include years where we actually have pair links
      var yearsLinks = graph.links.map(function (l) { return l.year; });

      var allYears = yearsLinks.concat(yearsWithAnyTop);
      if (allYears.length === 0) {
        // no valid data, bail gracefully
        console.warn("No valid co-authorship data in this file.");
        return;
      }

      var minYear = d3.min(allYears);
      var maxYear = d3.max(allYears);

      // Left zoom clamp anchor
      minDate = new Date(minYear, 0, 1);

      // Domain spans [Jan 1 minYear, Jan 1 (maxYear+1)]
      var domain = [
        new Date(minYear, 0, 1),
        new Date(maxYear + 1, 0, 1)
      ];

      // Init SVG scene sized to author count
      initChart(lay.nodes.length);

      // Draw it
      draw(lay.nodes, graph.links, domain);
    }
  });
});

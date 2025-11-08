// ===== Config =====
const CSV_PATH = "../../tracing-the-evolution-of-word-embeddings-in-nlp-first-affiliation.csv";     // hardcoded path as requested
const AUTHOR_COLS = Array.from({length: 10}, (_, i) => `Author_${i+1}`);
const LIST_COL = "List of Authors";       // used as fallback
const CATEGORY_COL = "Category";          // embedding family (e.g., Statistical / Static / Contextual)
const WIDTH_PADDING = 16;                 // padding for responsive calc

// Visual scale ranges (tuned for 1–5 papers)
const NODE_RADIUS_RANGE = [14, 54];       // px (larger for small counts)
const EDGE_WIDTH_RANGE  = [0.75, 7];      // px

// ===== DOM =====
const svg = d3.select("#graph");
const tooltip = d3.select("#tooltip");
const colorLegendEl = document.getElementById("colorLegend");
const legendListEl  = document.getElementById("legendList");
const exportBtn = document.getElementById("exportPngBtn");

const toggleClampBtn = document.getElementById("toggleClampBtn");
const topNInput      = document.getElementById("topNInput");
const applyTopNBtn   = document.getElementById("applyTopNBtn");
const resetTopNBtn   = document.getElementById("resetTopNBtn");

// Root <g> for zoom/pan
const rootG = svg.append("g");
const linksG = rootG.append("g").attr("class", "links");
const nodesG = rootG.append("g").attr("class", "nodes");
const labelsG = rootG.append("g").attr("class", "labels");

// Zoom behavior
const zoom = d3.zoom()
  .scaleExtent([0.1, 5])
  .on("zoom", (ev) => {
    rootG.attr("transform", ev.transform);
  });
svg.call(zoom);

// Simulation (global so drag can access)
const simulation = d3.forceSimulation();

// State
let clampEnabled = true;     // start clamped (inside viewport)
let fullGraph = null;        // { nodes, links } for the whole dataset
let currentGraph = null;     // currently rendered { nodes, links }

// ===== Helpers – name normalization =====
const BAD_TOKENS = new Set(["na", "n/a", "none", "", "loading...", "loading…", "null", "undefined"]);

function toTitleCase(str){
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normalizeWhitespaceHyphen(s){
  return s
    .replace(/[.\u200b]/g, "")           // drop periods & zero-widths
    .replace(/\s*-\s*/g, "-")            // unify hyphens
    .replace(/\s+/g, " ")                // collapse spaces
    .trim();
}

function flipLastnameCommaFirstname(s){
  // "Lastname, First M" -> "First M Lastname"
  const parts = s.split(",");
  if (parts.length === 2){
    const last = parts[0].trim();
    const first = parts[1].trim();
    if (last && first){
      return `${first} ${last}`;
    }
  }
  return s;
}

function stripEtAlEtc(s){
  return s
    .replace(/\bet\s*al\.?\b/gi, "")
    .replace(/\band others\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeName(raw){
  if (!raw) return null;
  let s = String(raw);

  s = s.replace(/\u2013|\u2014/g, "-");  // normalize dashes to '-'
  s = stripEtAlEtc(s);
  s = normalizeWhitespaceHyphen(s);

  if (!s) return null;

  // If it looks like "Lastname, First..."
  if (s.includes(",")) s = flipLastnameCommaFirstname(s);

  // clean again
  s = normalizeWhitespaceHyphen(s);

  const lowered = s.toLowerCase();
  if (BAD_TOKENS.has(lowered)) return null;

  // build a key for merging (lower, drop punctuation)
  const key = lowered.replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, " ").trim();

  // nicer display (Title Case basic)
  const display = toTitleCase(s);

  return { key, display };
}

// Fallback parser for "List of Authors"
function parseListOfAuthors(raw){
  if (!raw) return [];
  let s = String(raw);

  // Replace ' and ' with ';' then split on ';'
  s = s.replace(/\s+and\s+/gi, ";");
  // Some datasets use ' ; ' already
  const parts = s.split(/\s*;\s*/);

  return parts
    .map(p => normalizeName(p))
    .filter(Boolean);
}

// Extract authors from a row using Author_1..10; fallback to List of Authors
function authorsFromRow(row){
  let list = [];
  for (const col of AUTHOR_COLS){
    const v = row[col];
    const n = normalizeName(v);
    if (n) list.push(n);
  }
  if (list.length === 0 && row[LIST_COL]){
    list = parseListOfAuthors(row[LIST_COL]);
  }
  // De-duplicate by key within a single paper
  const seen = new Set();
  const unique = [];
  for (const a of list){
    if (!seen.has(a.key)){
      seen.add(a.key);
      unique.push(a);
    }
  }
  return unique;
}

// ===== Data -> Graph build =====
function buildGraph(rows){
  const authors = new Map();            // key -> { id, key, name, papers:Set, catCounts: Map }
  const edgeWeights = new Map();        // "a|b" sorted key -> count

  // helper to get or create author object
  function ensureAuthor(a){
    if (!authors.has(a.key)){
      authors.set(a.key, {
        id: a.key,
        key: a.key,
        name: a.display,
        papers: new Set(),
        catCounts: new Map()
      });
    }
    return authors.get(a.key);
  }

  for (const row of rows){
    const paperId = row.BE || row.Title || JSON.stringify(row);
    const category = (row[CATEGORY_COL] || "").trim() || "Unspecified";

    const people = authorsFromRow(row);
    if (people.length === 0) continue;

    // assign per-author paper and category tallies
    for (const p of people){
      const A = ensureAuthor(p);
      A.papers.add(paperId);
      A.catCounts.set(category, (A.catCounts.get(category) || 0) + 1);
    }

    // build pairwise edges once per paper
    for (let i = 0; i < people.length; i++){
      for (let j = i+1; j < people.length; j++){
        const a = people[i].key;
        const b = people[j].key;
        const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) || 0) + 1);
      }
    }
  }

  // finalize nodes array
  const nodes = Array.from(authors.values()).map(a => {
    const paperCount = a.papers.size;
    // dominant category color by max count
    let dominantCat = "Unspecified", maxC = -1;
    for (const [c,v] of a.catCounts.entries()){
      if (v > maxC){ maxC = v; dominantCat = c; }
    }
    return {
      id: a.id,
      key: a.key,
      name: a.name,
      paperCount,
      category: dominantCat
    };
  });

  // numbering: most prolific first, then name
  nodes.sort((x,y) => d3.descending(x.paperCount, y.paperCount) || d3.ascending(x.name, y.name));
  nodes.forEach((n, i) => { n.num = i+1; });

  // links array
  const links = Array.from(edgeWeights.entries()).map(([k, w]) => {
    const [a, b] = k.split("|");
    return { source: a, target: b, weight: w };
  });

  return { nodes, links };
}

// ===== Rendering =====
function renderGraph({nodes, links}){
  // Dimensions
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width;
  const height = bbox.height;

  // Scales (robust to degenerate domains)
  let minC = d3.min(nodes, d => d.paperCount) ?? 1;
  let maxC = d3.max(nodes, d => d.paperCount) ?? 1;
  if (minC === maxC){ minC = Math.max(0, minC - 1); maxC = maxC + 1; } // avoid degenerate domain

  const rScale = d3.scaleSqrt()
    .domain([minC, maxC])
    .range(NODE_RADIUS_RANGE);

  const maxW = d3.max(links, d => d.weight) || 1;
  const wScale = d3.scaleLinear()
    .domain([1, maxW])
    .range(EDGE_WIDTH_RANGE);

  // Colors by category
  const cats = Array.from(new Set(nodes.map(n => n.category)));
  const color = d3.scaleOrdinal()
    .domain(cats)
    .range(d3.schemeTableau10.concat(d3.schemeSet3).slice(0, cats.length));

  // Links
  const link = linksG.selectAll("line")
    .data(links, d => `${d.source}|${d.target}`)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", d => wScale(d.weight));

  // Nodes
  const node = nodesG.selectAll("circle")
    .data(nodes, d => d.id)
    .join("circle")
    .attr("class", "node")
    .attr("r", d => rScale(d.paperCount))
    .attr("fill", d => color(d.category))
    .call(drag(simulation));

  // --- helper to size label to fit the node diameter & digit count
  function labelFontPxForNode(d){
    const r = rScale(d.paperCount);
    const digits = String(d.num).length;      // 1..3 (maybe 4)
    // Approx text width per digit ≈ 0.6 * fontSize (Inter, bold)
    const maxByWidth  = (2 * r * 0.90) / (0.6 * digits); // keep 10% padding
    const maxByHeight = 1.25 * r;                          // vertical fit
    const px = Math.min(maxByWidth, maxByHeight);
    return Math.max(10, Math.floor(px));                   // clamp small
  }

  // Node labels (numbers only)
  const label = labelsG.selectAll("text")
    .data(nodes, d => d.id)
    .join("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text(d => d.num)
    .style("font-size", d => labelFontPxForNode(d) + "px");

  // Tooltips
  node.on("mouseover", (ev, d) => {
    const html = nodeTooltipHTML(d, links, nodes);
    showTooltip(html, ev.pageX, ev.pageY);
  }).on("mousemove", (ev) => {
    moveTooltip(ev.pageX, ev.pageY);
  }).on("mouseout", hideTooltip);

  link.on("mouseover", (ev, d) => {
    const s = nodes.find(n => n.id === (d.source.id || d.source));
    const t = nodes.find(n => n.id === (d.target.id || d.target));
    showTooltip(
      `<div><strong>Coauthors:</strong> ${s ? s.name : "?"}  &mdash;  ${t ? t.name : "?"}</div>
       <div><strong>Together on:</strong> ${d.weight} paper${d.weight>1?"s":""}</div>`,
      ev.pageX, ev.pageY
    );
  }).on("mousemove", (ev) => moveTooltip(ev.pageX, ev.pageY))
    .on("mouseout", hideTooltip);

  // Simulation
  simulation.nodes(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(d => 40 + (rScale(d.source.paperCount) + rScale(d.target.paperCount)))
      .strength(0.2))
    .force("charge", d3.forceManyBody().strength(-60))
    .force("center", d3.forceCenter(width/2, height/2))
    .force("collision", d3.forceCollide().radius(d => rScale(d.paperCount) + 2))
    .on("tick", ticked);

  function ticked(){
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => {
        if (clampEnabled){
          return d.x = clamp(d.x, rScale(d.paperCount), width - rScale(d.paperCount));
        } else {
          return d.x; // no clamping
        }
      })
      .attr("cy", d => {
        if (clampEnabled){
          return d.y = clamp(d.y, rScale(d.paperCount), height - rScale(d.paperCount));
        } else {
          return d.y; // no clamping
        }
      });

    label
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  }

  // Color legend
  colorLegendEl.innerHTML = "";
  cats.forEach(c => {
    const li = document.createElement("li");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = color(c);
    const text = document.createElement("span");
    text.textContent = c;
    li.appendChild(sw); li.appendChild(text);
    colorLegendEl.appendChild(li);
  });

  // Number → Author legend (only visible nodes)
  legendListEl.innerHTML = "";
  nodes
    .slice() // current set already sorted globally when built; keep order by global num
    .sort((a,b) => d3.ascending(a.num, b.num))
    .forEach(n => {
      const row = document.createElement("div");
      row.className = "legend-item";
      const left = document.createElement("span");
      left.className = "num";
      left.textContent = n.num;
      const mid = document.createElement("span");
      mid.textContent = n.name;
      const right = document.createElement("span");
      right.className = "meta";
      right.textContent = `${n.paperCount} paper${n.paperCount>1?"s":""}`;
      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);
      legendListEl.appendChild(row);
    });

  // Export PNG
  exportBtn.onclick = () => exportSvgToPng(svg.node(), "coauthor-network.png", { background: "#ffffff" });
}

// Tooltip utils
function showTooltip(html, x, y){
  tooltip.style("opacity", 1).html(html);
  moveTooltip(x, y);
}
function moveTooltip(x, y){
  const pad = 14;
  tooltip.style("left", (x + pad) + "px").style("top", (y + pad) + "px");
}
function hideTooltip(){ tooltip.style("opacity", 0); }

function nodeTooltipHTML(d, links, nodes){
  // Top coauthors by edge weight
  const neighbors = [];
  for (const L of links){
    const sid = L.source.id || L.source;
    const tid = L.target.id || L.target;
    if (sid === d.id || tid === d.id){
      const otherId = sid === d.id ? tid : sid;
      const other = nodes.find(n => n.id === otherId);
      if (other) neighbors.push({ name: other.name, weight: L.weight });
    }
  }
  neighbors.sort((a,b) => d3.descending(a.weight, b.weight) || d3.ascending(a.name, b.name));
  const top = neighbors.slice(0, 6).map(n => `<li>${n.name} <span style="color:#9aa6b2">(${n.weight})</span></li>`).join("");

  return `
    <div style="font-weight:800; margin-bottom:4px;">#${d.num} — ${d.name}</div>
    <div><strong>Papers:</strong> ${d.paperCount}</div>
    <div><strong>Category:</strong> ${d.category}</div>
    ${top ? `<div style="margin-top:6px;"><strong>Top coauthors</strong><ul style="margin:4px 0 0 16px; padding:0">${top}</ul></div>` : ""}
  `;
}

// Clamp utility
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// Drag behavior
function drag(sim){
  function dragstarted(event, d){
    if (!event.active) sim.alphaTarget(0.2).restart();
    d.fx = d.x; d.fy = d.y;
  }
  function dragged(event, d){
    d.fx = event.x; d.fy = event.y;
  }
  function dragended(event, d){
    if (!event.active) sim.alphaTarget(0);
    d.fx = null; d.fy = null;
  }
  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

// Responsive SVG
function resize(){
  const el = svg.node();
  const parent = el.parentElement;
  const w = parent.clientWidth - WIDTH_PADDING;
  const h = parent.clientHeight - WIDTH_PADDING;
  svg.attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
}
window.addEventListener("resize", resize);

// ===== Filtering helpers =====
function sortNodesForRanking(nodes){
  return nodes.slice().sort(
    (x, y) => d3.descending(x.paperCount, y.paperCount) || d3.ascending(x.name, y.name)
  );
}

function applyTopNFilter(N){
  if (!fullGraph){ return; }

  if (!Number.isFinite(N) || N < 1 || N >= fullGraph.nodes.length){
    currentGraph = fullGraph;          // show all
  } else {
    const ranked = sortNodesForRanking(fullGraph.nodes);
    const topNodes = ranked.slice(0, N);

    // Keep original global numbers for consistency
    const keepIds = new Set(topNodes.map(n => n.id));
    const topLinks = fullGraph.links.filter(l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      return keepIds.has(sid) && keepIds.has(tid);
    });

    currentGraph = { nodes: topNodes, links: topLinks };
  }

  renderGraph(currentGraph);
}

// ===== Controls =====
toggleClampBtn.addEventListener("click", () => {
  clampEnabled = !clampEnabled;
  toggleClampBtn.setAttribute("aria-pressed", String(clampEnabled));
  toggleClampBtn.textContent = clampEnabled ? "Clamp: On" : "Clamp: Off";
  simulation.alpha(0.2).restart();
});

applyTopNBtn.addEventListener("click", () => {
  const N = parseInt(topNInput.value, 10);
  applyTopNFilter(N);
});

topNInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter"){
    const N = parseInt(topNInput.value, 10);
    applyTopNFilter(N);
  }
});

resetTopNBtn.addEventListener("click", () => {
  topNInput.value = "";
  applyTopNFilter(NaN); // show all
});

// ===== Load & go =====
d3.csv(CSV_PATH).then(rows => {
  resize();
  fullGraph = buildGraph(rows);   // save the full dataset graph
  currentGraph = fullGraph;
  renderGraph(currentGraph);
}).catch(err => {
  console.error("Failed to load CSV:", err);
  alert("Could not load ./data/papers.csv — run a local server or check the path.");
});

// ===== Export SVG → PNG =====
function exportSvgToPng(svgNode, filename, { background = "#ffffff", scale = 2 } = {}){
  const serializer = new XMLSerializer();
  const clone = svgNode.cloneNode(true);

  // Ensure background via canvas fill
  const vb = clone.getAttribute("viewBox").split(/\s+/).map(Number);
  const [w, h] = [vb[2], vb[3]];

  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = function(){
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob(blob => {
      const a = document.createElement("a");
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  };
  img.src = url;
}

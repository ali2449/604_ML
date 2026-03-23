(function () {
  function el(id) { return document.getElementById(id); }
  function safeText(id, value) { const n = el(id); if (n) n.textContent = value; }
  function bodyTheme() { return document.body.getAttribute('data-theme') === 'day' ? 'day' : 'night'; }
  function palette() {
    const day = bodyTheme() === 'day';
    return {
      text: day ? '#0F172A' : '#EAF0FF',
      grid: day ? 'rgba(15,23,42,0.12)' : 'rgba(234,240,255,0.12)',
      noise: day ? '#94A3B8' : '#A3A3A3',
      centroid: day ? '#111827' : '#FFFFFF'
    };
  }
  function pointColors(k) {
    const base = ['#2563EB', '#7C3AED', '#DB2777', '#10B981', '#F59E0B', '#EF4444', '#0891B2', '#7C2D12'];
    const dark = ['#60A5FA', '#A78BFA', '#F472B6', '#34D399', '#FBBF24', '#FB7185', '#22D3EE', '#FB923C'];
    return (bodyTheme() === 'day' ? base : dark).slice(0, k);
  }
  function resizeCanvas(canvas) {
    if (!canvas) return;
    const parent = canvas.parentElement || canvas;
    const w = Math.max(300, Math.floor(parent.clientWidth || canvas.width || 600));
    const h = Math.max(260, Math.floor(parent.clientHeight || canvas.height || 360));
    canvas.width = w;
    canvas.height = h;
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mean(points) {
    if (!points.length) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }
  function overallMean(points) { return mean(points); }
  function unique(arr) { return [...new Set(arr)]; }
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function generateBlobs(n, centers, noise) {
    const base = [{ x: -3.5, y: -1.5 }, { x: 0.5, y: 2.8 }, { x: 3.6, y: -0.3 }, { x: -0.5, y: -4 }, { x: 4.5, y: 3.5 }];
    const pts = [];
    const per = Math.floor(n / centers);
    for (let c = 0; c < centers; c++) {
      const center = base[c % base.length];
      for (let i = 0; i < per; i++) {
        pts.push({ x: center.x + randn() * (0.55 + noise * 1.4), y: center.y + randn() * (0.55 + noise * 1.4) });
      }
    }
    while (pts.length < n) pts.push({ ...base[0] });
    return pts;
  }
  function generateMoons(n, noise) {
    const pts = [];
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
      const t = Math.PI * (i / Math.max(half - 1, 1));
      pts.push({ x: Math.cos(t) * 3 + randn() * noise, y: Math.sin(t) * 3 + randn() * noise });
    }
    for (let i = 0; i < n - half; i++) {
      const t = Math.PI * (i / Math.max(n - half - 1, 1));
      pts.push({ x: 3 - Math.cos(t) * 3 + randn() * noise, y: 1.5 - Math.sin(t) * 3 + randn() * noise });
    }
    return pts;
  }
  function generateCircles(n, noise) {
    const pts = [];
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
      const t = 2 * Math.PI * i / half;
      pts.push({ x: Math.cos(t) * 1.8 + randn() * noise, y: Math.sin(t) * 1.8 + randn() * noise });
    }
    for (let i = 0; i < n - half; i++) {
      const t = 2 * Math.PI * i / (n - half);
      pts.push({ x: Math.cos(t) * 4 + randn() * noise, y: Math.sin(t) * 4 + randn() * noise });
    }
    return pts;
  }
  function generateVaried(n, noise) {
    const pts = [];
    const configs = [
      { x: -3.8, y: -2.2, sx: 0.35, sy: 0.35, count: Math.floor(n * 0.25) },
      { x: 1.8, y: 2.7, sx: 0.95, sy: 0.5, count: Math.floor(n * 0.45) },
      { x: 4.7, y: -0.6, sx: 0.45, sy: 1.15, count: n - Math.floor(n * 0.25) - Math.floor(n * 0.45) }
    ];
    for (const cfg of configs) {
      for (let i = 0; i < cfg.count; i++) pts.push({ x: cfg.x + randn() * (cfg.sx + noise), y: cfg.y + randn() * (cfg.sy + noise) });
    }
    return pts;
  }
  function generateNoisy(n, noise) {
    const pts = generateBlobs(Math.floor(n * 0.85), 3, noise);
    while (pts.length < n) pts.push({ x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 10 });
    return pts;
  }
  function generatePattern(pattern, n, noise) {
    switch (pattern) {
      case 'moons': return generateMoons(n, 0.12 + noise);
      case 'circles': return generateCircles(n, 0.10 + noise);
      case 'varied': return generateVaried(n, noise);
      case 'noisy': return generateNoisy(n, noise);
      default: return generateBlobs(n, 3, noise);
    }
  }

  function kmeans(points, k, maxIter) {
    const centroids = [];
    const used = new Set();
    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * points.length);
      if (!used.has(idx)) { used.add(idx); centroids.push({ x: points[idx].x, y: points[idx].y }); }
    }
    const labels = new Array(points.length).fill(0);
    let iterations = 0;
    let changed = true;
    while (changed && iterations < (maxIter || 30)) {
      changed = false;
      for (let i = 0; i < points.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = dist(points[i], centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (labels[i] !== best) changed = true;
        labels[i] = best;
      }
      const groups = Array.from({ length: k }, () => []);
      for (let i = 0; i < points.length; i++) groups[labels[i]].push(points[i]);
      for (let c = 0; c < k; c++) if (groups[c].length) centroids[c] = mean(groups[c]);
      iterations += 1;
    }
    let inertia = 0;
    for (let i = 0; i < points.length; i++) inertia += Math.pow(dist(points[i], centroids[labels[i]]), 2);
    return { labels, centroids, iterations, inertia };
  }

  function clusterDistance(points, ca, cb, linkage) {
    if (linkage === 'ward') {
      const ma = mean(ca.map(i => points[i]));
      const mb = mean(cb.map(i => points[i]));
      return (ca.length * cb.length / (ca.length + cb.length)) * Math.pow(dist(ma, mb), 2);
    }
    let vals = [];
    for (const a of ca) for (const b of cb) vals.push(dist(points[a], points[b]));
    if (linkage === 'single') return Math.min(...vals);
    if (linkage === 'complete') return Math.max(...vals);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }
  function hierarchical(points, k, linkage) {
    let clusters = points.map((_, i) => [i]);
    while (clusters.length > k) {
      let bi = 0, bj = 1, bd = Infinity;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = clusterDistance(points, clusters[i], clusters[j], linkage || 'average');
          if (d < bd) { bd = d; bi = i; bj = j; }
        }
      }
      clusters[bi] = clusters[bi].concat(clusters[bj]);
      clusters.splice(bj, 1);
    }
    const labels = new Array(points.length).fill(-1);
    const centroids = [];
    clusters.forEach((cluster, idx) => {
      const pts = cluster.map(i => points[i]);
      centroids[idx] = mean(pts);
      cluster.forEach(i => { labels[i] = idx; });
    });
    return { labels, centroids, merges: points.length - clusters.length };
  }

  function dbscan(points, eps, minPts) {
    const n = points.length;
    const labels = new Array(n).fill(undefined);
    const neighbors = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (dist(points[i], points[j]) <= eps) neighbors[i].push(j);
    const core = neighbors.map(nb => nb.length >= minPts);
    let cid = 0;
    for (let i = 0; i < n; i++) {
      if (!core[i] || labels[i] !== undefined) continue;
      labels[i] = cid;
      const queue = [i];
      while (queue.length) {
        const p = queue.shift();
        for (const q of neighbors[p]) {
          if (labels[q] === undefined) {
            labels[q] = cid;
            if (core[q]) queue.push(q);
          }
        }
      }
      cid += 1;
    }
    for (let i = 0; i < n; i++) if (labels[i] === undefined) labels[i] = -1;
    return { labels, coreFlags: core, clusterCount: cid };
  }

  function silhouette(points, labels) {
    const valid = unique(labels.filter(v => v >= 0));
    if (valid.length < 2) return 0;
    const scores = [];
    for (let i = 0; i < points.length; i++) {
      if (labels[i] < 0) continue;
      let aSum = 0, aCount = 0;
      for (let j = 0; j < points.length; j++) {
        if (i !== j && labels[j] === labels[i]) { aSum += dist(points[i], points[j]); aCount += 1; }
      }
      const a = aCount ? aSum / aCount : 0;
      let b = Infinity;
      for (const c of valid) {
        if (c === labels[i]) continue;
        let s = 0, cnt = 0;
        for (let j = 0; j < points.length; j++) if (labels[j] === c) { s += dist(points[i], points[j]); cnt += 1; }
        if (cnt) b = Math.min(b, s / cnt);
      }
      if (isFinite(b) && Math.max(a, b) > 0) scores.push((b - a) / Math.max(a, b));
    }
    return scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  }

  function buildDatasets(points, labels, centroids, includeNoise) {
    const ids = unique(labels.filter(v => includeNoise ? true : v >= 0));
    const colors = pointColors(Math.max(ids.filter(v => v >= 0).length, 1));
    const sets = [];
    for (const id of ids) {
      const data = [];
      for (let i = 0; i < points.length; i++) if (labels[i] === id) data.push(points[i]);
      if (!data.length) continue;
      sets.push({
        label: id >= 0 ? `Cluster ${id + 1}` : 'Noise',
        data,
        backgroundColor: id >= 0 ? colors[id % colors.length] : palette().noise,
        pointRadius: id >= 0 ? 5 : 4,
        pointHoverRadius: id >= 0 ? 6 : 5,
        showLine: false
      });
    }
    if (centroids && centroids.length) {
      sets.push({ label: 'Centroids', data: centroids, backgroundColor: palette().centroid, pointBackgroundColor: palette().centroid, pointRadius: 8, pointStyle: 'rectRot', showLine: false });
    }
    return sets;
  }
  function commonChartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { labels: { color: palette().text } }, title: title ? { display: true, text: title, color: palette().text } : undefined },
      scales: {
        x: { type: 'linear', ticks: { color: palette().text }, grid: { color: palette().grid } },
        y: { type: 'linear', ticks: { color: palette().text }, grid: { color: palette().grid } }
      }
    };
  }

  let kmeansPoints = [], hierPoints = [], dbscanPoints = [];
  let kmeansChart = null, hierChart = null, dbscanChart = null, evalChart = null;

  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem('cluster-theme', theme); } catch (e) {}
    const label = document.querySelector('#themeToggle .label');
    if (label) label.textContent = theme === 'day' ? 'Day Mode' : 'Night Mode';
    rerenderVisible();
  }

  function rerenderVisible() {
    if (el('kmeans') && el('kmeans').classList.contains('active')) runKMeans();
    if (el('hierarchical') && el('hierarchical').classList.contains('active')) runHierarchical();
    if (el('dbscan') && el('dbscan').classList.contains('active')) runDBSCAN();
    initEvalChart();
    if (window.updateMetricsExplorer) window.updateMetricsExplorer();
    if (window.runAllAlgorithms) window.runAllAlgorithms();
  }

  function generateKMeansData() {
    const noise = parseFloat(el('kmeansNoise')?.value || '0.1');
    kmeansPoints = generateBlobs(210, 3, noise);
    safeText('kmeansPoints', String(kmeansPoints.length));
    runKMeans();
  }
  function runKMeans() {
    const canvas = el('kmeansChart');
    if (!canvas || typeof Chart === 'undefined') return;
    resizeCanvas(canvas);
    const k = parseInt(el('kmeansK')?.value || '3', 10);
    const noise = parseFloat(el('kmeansNoise')?.value || '0.1');
    safeText('kmeansKVal', String(k));
    safeText('kmeansNoiseVal', noise.toFixed(2));
    if (!kmeansPoints.length) kmeansPoints = generateBlobs(210, 3, noise);
    const res = kmeans(kmeansPoints, k, 40);
    safeText('kmeansInertia', res.inertia.toFixed(0));
    safeText('kmeansSil', silhouette(kmeansPoints, res.labels).toFixed(3));
    safeText('kmeansIter', String(res.iterations));
    safeText('kmeansPoints', String(kmeansPoints.length));
    if (kmeansChart) kmeansChart.destroy();
    kmeansChart = new Chart(canvas.getContext('2d'), { type: 'scatter', data: { datasets: buildDatasets(kmeansPoints, res.labels, res.centroids, false) }, options: commonChartOptions() });
  }

  function generateHierarchicalData() {
    const pattern = el('hierDataPattern')?.value || 'blobs';
    hierPoints = generatePattern(pattern, 150, 0.08);
    runHierarchical();
  }
  function runHierarchical() {
    const canvas = el('hierarchicalChart');
    if (!canvas || typeof Chart === 'undefined') return;
    resizeCanvas(canvas);
    const k = parseInt(el('hierCut')?.value || '3', 10);
    const linkage = el('linkageMethod')?.value || 'complete';
    safeText('hierCutVal', String(k));
    if (!hierPoints.length) generateHierarchicalData();
    const res = hierarchical(hierPoints, k, linkage);
    if (hierChart) hierChart.destroy();
    hierChart = new Chart(canvas.getContext('2d'), { type: 'scatter', data: { datasets: buildDatasets(hierPoints, res.labels, [], false) }, options: commonChartOptions() });
    safeText('hierSil', silhouette(hierPoints, res.labels).toFixed(3));
    safeText('hierPoints', String(hierPoints.length));
    safeText('hierSteps', String(Math.max(hierPoints.length - 1, 0)));
    safeText('hierCurrentK', String(k));
  }

  function generateDBSCANData() {
    const pattern = el('dbscanDataPattern')?.value || 'moons';
    dbscanPoints = generatePattern(pattern, 180, 0.08);
    runDBSCAN();
  }
  function resetDBSCANParams() {
    if (el('eps')) el('eps').value = '0.5';
    if (el('minPts')) el('minPts').value = '4';
    if (el('dbscanDataPattern')) el('dbscanDataPattern').value = 'moons';
    generateDBSCANData();
  }
  function runDBSCAN() {
    const canvas = el('dbscanChart');
    if (!canvas || typeof Chart === 'undefined') return;
    resizeCanvas(canvas);
    const eps = parseFloat(el('eps')?.value || '0.5');
    const minPts = parseInt(el('minPts')?.value || '4', 10);
    safeText('epsVal', eps.toFixed(2));
    safeText('minPtsVal', String(minPts));
    if (!dbscanPoints.length) generateDBSCANData();
    const res = dbscan(dbscanPoints, eps, minPts);
    if (dbscanChart) dbscanChart.destroy();
    dbscanChart = new Chart(canvas.getContext('2d'), { type: 'scatter', data: { datasets: buildDatasets(dbscanPoints, res.labels, [], true) }, options: commonChartOptions() });
    safeText('dbscanClusters', String(res.clusterCount));
    safeText('dbscanNoise', String(res.labels.filter(v => v === -1).length));
    safeText('dbscanSil', silhouette(dbscanPoints, res.labels).toFixed(3));
    safeText('dbscanCore', String(res.coreFlags.filter(Boolean).length));
  }

  function initEvalChart() {
    const canvas = el('evalChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const pts = generateBlobs(210, 4, 0.12);
    const ks = [2, 3, 4, 5, 6, 7, 8];
    const inertias = ks.map(k => kmeans(pts, k, 25).inertia.toFixed(0));
    if (evalChart) evalChart.destroy();
    evalChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: ks, datasets: [{ label: 'Inertia (WCSS)', data: inertias, borderColor: pointColors(1)[0], backgroundColor: pointColors(1)[0], tension: 0.15, fill: false }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: palette().text } } }, scales: { x: { ticks: { color: palette().text }, grid: { color: palette().grid } }, y: { ticks: { color: palette().text }, grid: { color: palette().grid } } } }
    });
  }

  function downloadSampleData() {
    let csv = 'Age,Annual_Income,Spending_Score,Purchase_Frequency\n';
    for (let i = 0; i < 200; i++) csv += `${18 + Math.floor(Math.random() * 50)},${15000 + Math.floor(Math.random() * 105000)},${1 + Math.floor(Math.random() * 99)},${1 + Math.floor(Math.random() * 29)}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customer_data.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
    const targetId = btn.dataset.module;
    const target = el(targetId);
    if (!target) return;
    document.querySelectorAll('.module-content').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    target.classList.add('active');
    btn.classList.add('active');
    setTimeout(rerenderVisible, 60);
  }));

  el('themeToggle')?.addEventListener('click', () => setTheme(bodyTheme() === 'day' ? 'night' : 'day'));
  try { setTheme(localStorage.getItem('cluster-theme') || document.body.getAttribute('data-theme') || 'night'); } catch (e) { setTheme('night'); }

  if (typeof ClipboardJS !== 'undefined') {
    const clipboard = new ClipboardJS('.copy-btn');
    clipboard.on('success', e => {
      const btn = e.trigger;
      const old = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      setTimeout(() => { btn.innerHTML = old; }, 1600);
      e.clearSelection();
    });
  }

  ['kmeansK', 'kmeansNoise'].forEach(id => el(id)?.addEventListener('input', () => id === 'kmeansNoise' ? generateKMeansData() : runKMeans()));
  ['hierCut'].forEach(id => el(id)?.addEventListener('input', runHierarchical));
  ['linkageMethod', 'hierDataPattern'].forEach(id => el(id)?.addEventListener('change', () => id === 'hierDataPattern' ? generateHierarchicalData() : runHierarchical()));
  ['eps', 'minPts'].forEach(id => el(id)?.addEventListener('input', runDBSCAN));
  el('dbscanDataPattern')?.addEventListener('change', generateDBSCANData);
  window.addEventListener('resize', () => setTimeout(rerenderVisible, 100));

  generateKMeansData();
  generateHierarchicalData();
  generateDBSCANData();
  initEvalChart();

  window.runKMeans = runKMeans;
  window.generateKMeansData = generateKMeansData;
  window.runHierarchical = runHierarchical;
  window.generateHierarchicalData = generateHierarchicalData;
  window.runDBSCAN = runDBSCAN;
  window.generateDBSCANData = generateDBSCANData;
  window.resetDBSCANParams = resetDBSCANParams;
  window.downloadSampleData = downloadSampleData;
  window.ClusterViz = { palette, pointColors, dist, mean, unique, randn, generatePattern, generateBlobs, generateMoons, generateCircles, generateVaried, generateNoisy, kmeans, hierarchical, dbscan, silhouette, resizeCanvas };
})();

(function () {
  function el(id) { return document.getElementById(id); }
  function safeText(id, value) { const n = el(id); if (n) n.textContent = value; }
  function viz() { return window.ClusterViz; }

  let comparisonData = [];

  function normalize(points) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    return points.map(p => ({ x: ((p.x - minX) / dx) * 8 - 4, y: ((p.y - minY) / dy) * 8 - 4 }));
  }

  function generateComparisonData() {
    if (!viz()) return;
    const pattern = el('comparisonDataPattern')?.value || 'blobs';
    const noise = parseFloat(el('comparisonNoise')?.value || '0.05');
    safeText('comparisonNoiseVal', noise.toFixed(2));
    comparisonData = normalize(viz().generatePattern(pattern, 180, noise));
    runAllAlgorithms();
  }

  function estimateK(pattern) {
    if (pattern === 'moons' || pattern === 'circles') return 2;
    if (pattern === 'varied' || pattern === 'anisotropic' || pattern === 'noisy') return 3;
    return 3;
  }

  function anisotropicTransform(points) {
    return points.map(p => ({ x: p.x * 1.4 + p.y * 0.7, y: p.y * 0.6 }));
  }

  function spectralApprox(points, pattern) {
    let transformed = points;
    if (pattern === 'circles') transformed = points.map(p => ({ x: Math.atan2(p.y, p.x), y: Math.hypot(p.x, p.y) }));
    else if (pattern === 'moons') transformed = points.map(p => ({ x: p.x, y: Math.sin(p.x) + p.y * 0.2 }));
    else if (pattern === 'anisotropic') transformed = anisotropicTransform(points);
    const res = viz().kmeans(transformed, estimateK(pattern), 30);
    return { labels: res.labels, sil: viz().silhouette(points, res.labels) };
  }

  function opticsApprox(points, pattern) {
    let eps = 0.45, minPts = 5;
    if (pattern === 'circles' || pattern === 'moons') eps = 0.42;
    if (pattern === 'varied') eps = 0.38;
    if (pattern === 'noisy') eps = 0.46;
    const res = viz().dbscan(points, eps, minPts);
    return { labels: res.labels, sil: viz().silhouette(points, res.labels) };
  }

  function renderCanvas(canvasId, labels) {
    const canvas = el(canvasId);
    if (!canvas || !viz()) return;
    viz().resizeCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const colors = viz().pointColors(8);
    ctx.save();
    for (let i = 0; i < comparisonData.length; i++) {
      const p = comparisonData[i];
      const x = ((p.x + 4.5) / 9) * (w - 30) + 15;
      const y = ((4.5 - p.y) / 9) * (h - 30) + 15;
      const label = labels[i];
      ctx.fillStyle = label >= 0 ? colors[label % colors.length] : viz().palette().noise;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function runAllAlgorithms() {
    if (!viz()) return;
    if (!comparisonData.length) generateComparisonData();
    const pattern = el('comparisonDataPattern')?.value || 'blobs';
    const k = estimateK(pattern);

    const km = viz().kmeans(comparisonData, k, 30);
    const hr = viz().hierarchical(comparisonData, k, pattern === 'anisotropic' ? 'average' : 'ward');
    const db = viz().dbscan(comparisonData, pattern === 'blobs' ? 0.55 : 0.42, 5);
    const gm = viz().kmeans(pattern === 'anisotropic' ? anisotropicTransform(comparisonData) : comparisonData, k, 35);
    const sp = spectralApprox(comparisonData, pattern);
    const op = opticsApprox(comparisonData, pattern);

    renderCanvas('comparisonKMeansChart', km.labels);
    renderCanvas('comparisonHierChart', hr.labels);
    renderCanvas('comparisonDBSCANChart', db.labels);
    renderCanvas('comparisonGMMChart', gm.labels);
    renderCanvas('comparisonSpectralChart', sp.labels);
    renderCanvas('comparisonOPTICSChart', op.labels);

    safeText('kmeansComparisonSil', viz().silhouette(comparisonData, km.labels).toFixed(3));
    safeText('hierComparisonSil', viz().silhouette(comparisonData, hr.labels).toFixed(3));
    safeText('dbscanComparisonSil', viz().silhouette(comparisonData, db.labels).toFixed(3));
    safeText('gmmComparisonSil', viz().silhouette(comparisonData, gm.labels).toFixed(3));
    safeText('spectralComparisonSil', sp.sil.toFixed(3));
    safeText('opticsComparisonSil', op.sil.toFixed(3));
  }

  function recommendAlgorithm() {
    const q1 = el('q1')?.value;
    const q2 = el('q2')?.value;
    const q3 = el('q3')?.value;
    const q4 = el('q4')?.value;
    const q5 = el('q5')?.value;
    let recommendation = 'K-Means';
    let reason = 'Good fast baseline.';
    if (q5 === 'yes') {
      recommendation = 'Gaussian Mixture Model (GMM)';
      reason = 'You want soft assignments or probabilistic membership.';
    } else if (q3 === 'yes') {
      recommendation = 'DBSCAN or OPTICS';
      reason = 'These methods can isolate noise and outliers instead of forcing them into clusters.';
    } else if (q2 === 'irregular') {
      recommendation = 'DBSCAN or Spectral Clustering';
      reason = 'Irregular shapes usually break the spherical-cluster assumption of K-Means.';
    } else if (q1 === 'no' && q4 === 'small') {
      recommendation = 'Hierarchical Clustering';
      reason = 'A dendrogram helps you discover a natural number of clusters for smaller datasets.';
    } else if (q1 === 'no') {
      recommendation = 'DBSCAN';
      reason = 'It does not require setting K ahead of time.';
    } else if (q4 === 'large') {
      recommendation = 'Mini-Batch K-Means';
      reason = 'It scales better on very large datasets.';
    }
    if (el('recommendationText')) el('recommendationText').innerHTML = `<span style="color: var(--primary); font-size: 1.3rem;">${recommendation}</span>`;
    if (el('recommendationReason')) el('recommendationReason').textContent = reason;
    if (el('recommendationResult')) el('recommendationResult').style.display = 'block';
  }

  ['comparisonNoise'].forEach(id => el(id)?.addEventListener('input', generateComparisonData));
  el('comparisonDataPattern')?.addEventListener('change', generateComparisonData);
  window.addEventListener('resize', () => { if (comparisonData.length) runAllAlgorithms(); });

  if (viz()) generateComparisonData();
  window.generateComparisonData = generateComparisonData;
  window.runAllAlgorithms = runAllAlgorithms;
  window.recommendAlgorithm = recommendAlgorithm;
})();

(function () {
  function el(id) { return document.getElementById(id); }
  function safeText(id, value) { const n = el(id); if (n) n.textContent = value; }
  function viz() { return window.ClusterViz; }

  function getValues() {
    return {
      k: parseInt(el('metricsK')?.value || '3', 10),
      separation: parseFloat(el('metricsSeparation')?.value || '1.5'),
      compactness: parseFloat(el('metricsCompactness')?.value || '0.8'),
      noise: parseFloat(el('metricsNoise')?.value || '0')
    };
  }

  function generateMetricsData() {
    const { k, separation, compactness, noise } = getValues();
    const pts = [];
    const angleStep = (2 * Math.PI) / k;
    for (let c = 0; c < k; c++) {
      const angle = c * angleStep;
      const cx = Math.cos(angle) * separation * 2.2;
      const cy = Math.sin(angle) * separation * 2.2;
      for (let i = 0; i < 90; i++) {
        pts.push({ x: cx + viz().randn() * compactness, y: cy + viz().randn() * compactness });
      }
    }
    const nNoise = Math.floor(pts.length * noise);
    for (let i = 0; i < nNoise; i++) pts.push({ x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 });
    return pts;
  }

  function computeDaviesBouldin(points, labels, centroids) {
    const k = centroids.length;
    let s = Array(k).fill(0), counts = Array(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      if (labels[i] < 0) continue;
      s[labels[i]] += viz().dist(points[i], centroids[labels[i]]);
      counts[labels[i]] += 1;
    }
    for (let c = 0; c < k; c++) s[c] = counts[c] ? s[c] / counts[c] : 0;
    let total = 0;
    for (let i = 0; i < k; i++) {
      let worst = 0;
      for (let j = 0; j < k; j++) {
        if (i === j) continue;
        const d = viz().dist(centroids[i], centroids[j]) || 1e-9;
        worst = Math.max(worst, (s[i] + s[j]) / d);
      }
      total += worst;
    }
    return total / Math.max(k, 1);
  }

  function computeCH(points, labels, centroids) {
    const k = centroids.length;
    const overall = viz().mean(points);
    let between = 0, within = 0;
    for (let c = 0; c < k; c++) {
      const cluster = points.filter((_, i) => labels[i] === c);
      if (!cluster.length) continue;
      between += cluster.length * Math.pow(viz().dist(centroids[c], overall), 2);
      for (const p of cluster) within += Math.pow(viz().dist(p, centroids[c]), 2);
    }
    return (between / Math.max(k - 1, 1)) / ((within / Math.max(points.length - k, 1)) || 1e-9);
  }

  function interpretationSil(v) {
    if (v >= 0.7) return 'Strong separation';
    if (v >= 0.5) return 'Reasonably good';
    if (v >= 0.25) return 'Weak to moderate';
    return 'Poor separation';
  }

  function renderMetricsChart(points, labels, centroids) {
    const canvas = el('metricsExplorerChart');
    if (!canvas) return;
    viz().resizeCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const colors = viz().pointColors(8);
    const pad = 20, dx = (maxX - minX) || 1, dy = (maxY - minY) || 1;
    const mapX = x => pad + ((x - minX) / dx) * (w - 2 * pad);
    const mapY = y => h - pad - ((y - minY) / dy) * (h - 2 * pad);
    for (let i = 0; i < points.length; i++) {
      ctx.fillStyle = colors[labels[i] % colors.length];
      ctx.beginPath();
      ctx.arc(mapX(points[i].x), mapY(points[i].y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let c = 0; c < centroids.length; c++) {
      ctx.fillStyle = viz().palette().centroid;
      ctx.beginPath();
      ctx.arc(mapX(centroids[c].x), mapY(centroids[c].y), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors[c % colors.length];
      ctx.beginPath();
      ctx.arc(mapX(centroids[c].x), mapY(centroids[c].y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function updateMetricsExplorer() {
    if (!viz()) return;
    const vals = getValues();
    safeText('metricsKVal', String(vals.k));
    safeText('metricsSeparationVal', vals.separation.toFixed(2));
    safeText('metricsCompactnessVal', vals.compactness.toFixed(2));
    safeText('metricsNoiseVal', vals.noise.toFixed(2));
    const points = generateMetricsData();
    const km = viz().kmeans(points, vals.k, 30);
    const sil = viz().silhouette(points, km.labels);
    const db = computeDaviesBouldin(points, km.labels, km.centroids);
    const ch = computeCH(points, km.labels, km.centroids);
    safeText('expSilhouette', sil.toFixed(3));
    safeText('expDavies', db.toFixed(3));
    safeText('expCalinski', ch.toFixed(1));
    safeText('expInertia', km.inertia.toFixed(0));
    safeText('silInterpretation', interpretationSil(sil));
    renderMetricsChart(points, km.labels, km.centroids);
  }

  function resetMetricsExplorer() {
    if (el('metricsK')) el('metricsK').value = '3';
    if (el('metricsSeparation')) el('metricsSeparation').value = '1.5';
    if (el('metricsCompactness')) el('metricsCompactness').value = '0.8';
    if (el('metricsNoise')) el('metricsNoise').value = '0';
    updateMetricsExplorer();
  }

  function updateElbowChart() {
    const canvas = el('elbowChart');
    if (!canvas || !viz()) return;
    viz().resizeCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pts = viz().generateBlobs(240, 4, 0.12);
    const ks = [1, 2, 3, 4, 5, 6, 7, 8];
    const vals = ks.map(k => viz().kmeans(pts, k, 25).inertia);
    const minV = Math.min(...vals), maxV = Math.max(...vals), pad = 40;
    const mapX = i => pad + (i / (ks.length - 1)) * (w - 2 * pad);
    const mapY = v => h - pad - ((v - minV) / ((maxV - minV) || 1)) * (h - 2 * pad);
    ctx.strokeStyle = viz().palette().grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = pad + i * (h - 2 * pad) / 4;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }
    ctx.strokeStyle = viz().pointColors(1)[0];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ks.forEach((k, i) => { const x = mapX(i), y = mapY(vals[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
    const elbowIndex = 3;
    ks.forEach((k, i) => {
      const x = mapX(i), y = mapY(vals[i]);
      ctx.fillStyle = i === elbowIndex ? (viz().palette().warning || '#F59E0B') : viz().pointColors(1)[0];
      ctx.beginPath(); ctx.arc(x, y, i === elbowIndex ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = viz().palette().text;
      ctx.font = '12px sans-serif';
      ctx.fillText(String(k), x - 3, h - 15);
    });
    ctx.fillStyle = viz().palette().text;
    ctx.font = '13px sans-serif';
    ctx.fillText('Elbow near K = 4', mapX(elbowIndex) + 10, mapY(vals[elbowIndex]) - 12);
  }

  ['metricsK', 'metricsSeparation', 'metricsCompactness', 'metricsNoise'].forEach(id => el(id)?.addEventListener('input', updateMetricsExplorer));
  window.addEventListener('resize', () => { updateMetricsExplorer(); updateElbowChart(); });

  if (viz()) {
    updateMetricsExplorer();
    updateElbowChart();
  }
  window.updateMetricsExplorer = updateMetricsExplorer;
  window.resetMetricsExplorer = resetMetricsExplorer;
  window.updateElbowChart = updateElbowChart;
})();

// Gráfico de barras en <canvas> sin librerías externas.

const COLORS = { gold: ['#f3d98b', '#b8901f'], ok: ['#8fe0b4', '#3f9b6b'], warn: ['#f0c36a', '#b9822a'], danger: ['#eb8f84', '#a64a40'] };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{label: string, value: number, tone?: keyof COLORS}[]} data
 */
export function drawBarChart(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 28, right: 16, bottom: 46, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = Math.ceil(Math.max(max, 4) / 4) * 4; // 4 divisiones con valores enteros

  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a39d8c';
  ctx.strokeStyle = 'rgba(212,175,55,.12)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + plotH - (plotH * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillText(String(Math.round((top * i) / 4)), pad.left - 8, y + 4);
  }

  const slot = plotW / data.length;
  const barW = Math.min(64, slot * 0.55);
  data.forEach((d, i) => {
    const h = (d.value / top) * plotH;
    const x = pad.left + slot * i + (slot - barW) / 2;
    const y = pad.top + plotH - h;
    const [c1, c2] = COLORS[d.tone ?? 'gold'];
    const grad = ctx.createLinearGradient(0, y, 0, y + Math.max(h, 1));
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, Math.max(h, 2), [8, 8, 2, 2]);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2eee3';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillText(String(d.value), x + barW / 2, y - 8);
    ctx.fillStyle = '#a39d8c';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText(d.label, x + barW / 2, height - pad.bottom + 20);
  });
}

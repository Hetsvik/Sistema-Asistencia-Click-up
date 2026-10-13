// Fondo animado de ondas doradas (pantalla de login).
// Mejoras: respeta "reducir movimiento", pausa si la pestaña está oculta y ajusta a pantallas HiDPI.

export function startWaves(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, step = 0, raf = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const sets = [{ y: 0.3, speed: 0.005 }, { y: 0.6, speed: 0.003 }];
  const LINES = 14;

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    for (const set of sets) {
      for (let i = 0; i < LINES; i++) {
        const alpha = (1 - i / LINES) * 0.5 + 0.4;
        ctx.strokeStyle = i % 2 ? `rgba(234,179,8,${alpha})` : `rgba(255,223,0,${alpha})`;
        ctx.beginPath();
        for (let x = 0; x <= width + 25; x += 25) {
          const y = height * set.y
            + Math.sin(x * 0.0015 + step * set.speed + i * 0.08) * (140 + i * 5)
            + Math.cos(x * 0.003 - step * 0.004) * 70;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    step += 1;
  }

  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  const start = () => { cancelAnimationFrame(raf); if (reduce.matches) draw(); else loop(); };
  const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());

  resize(); start();
  window.addEventListener('resize', () => { resize(); if (reduce.matches) draw(); });
  document.addEventListener('visibilitychange', onVisibility);
  reduce.addEventListener('change', start);
  return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
}

import { useEffect, useRef } from 'react';

export default function AnimatedBg({ particleCount = 60, color = 'rgba(57,255,20,0.12)' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const DPR = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(DPR, DPR);

    const rand = (min, max) => Math.random() * (max - min) + min;

    const particles = new Array(particleCount).fill().map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(0.8, 3.2),
      vx: rand(-0.15, 0.15),
      vy: rand(-0.05, 0.05),
      alpha: rand(0.02, 0.25),
    }));

    let raf = null;

    function onResize() {
      w = canvas.width = window.innerWidth * DPR;
      h = canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // subtle gradient background overlay
      // draw particles
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;

        ctx.beginPath();
        ctx.fillStyle = `rgba(57,255,20,${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // optional linking lines for nearby particles (very subtle)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 10000) {
            const alpha = Math.max(0, 0.06 - d2 / 10000 * 0.06);
            ctx.strokeStyle = `rgba(57,255,20,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', onResize);
    draw();

    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [particleCount, color]);

  return (
    <canvas
      ref={ref}
      className="animated-bg-canvas"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The hero wordmark, rendered live on the GPU.
 *
 * The <h1> stays in the DOM exactly as before (SEO, a11y, layout, and
 * the fallback for browsers without WebGPU). When vgpu comes up we
 * rasterize the same text with the same font into a mask texture,
 * hand it to the shader, and make the DOM glyphs transparent so the
 * canvas shows through in their place.
 *
 * - WebGPU missing / init fails / device lost -> plain text, no canvas.
 * - prefers-reduced-motion -> one static frame, no loop.
 * - Off-screen or hidden tab -> loop paused.
 * - Theme toggle -> re-tinted on the next frame.
 */
export function ShaderWordmark({ text = 'flicky' }: { text?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const h1Ref = useRef<HTMLHeadingElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const h1 = h1Ref.current;
    const canvas = canvasRef.current;
    if (!wrap || !h1 || !canvas) return;
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      await document.fonts.ready;
      if (cancelled) return;

      const [vgpu, shader] = await Promise.all([
        import('vgpu'),
        import('./wordmark.wgsl'),
      ]);
      if (cancelled) return;

      let gpu: Awaited<ReturnType<typeof vgpu.init>>;
      try {
        gpu = await vgpu.init();
      } catch {
        return; // no adapter — leave the DOM text alone
      }
      if (cancelled) {
        gpu.dispose();
        return;
      }
      cleanups.push(() => gpu.dispose());

      const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

      // --- pad the canvas so the halo has room outside the glyph box
      const fontPx = () => parseFloat(getComputedStyle(h1).fontSize) || 100;
      const applyPad = () => wrap.style.setProperty('--wm-pad', `${Math.round(fontPx() * 0.4)}px`);
      applyPad();

      const surf = vgpu.surface(gpu, canvas, { dpr: [1, 2], alphaMode: 'premultiplied', label: 'wordmark' });
      cleanups.push(() => surf.dispose());

      const linear = vgpu.sampler(gpu, {
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      // --- rasterize the DOM text into an R (sharp) / G (blurred) mask
      let maskTex: ReturnType<typeof vgpu.texture> | null = null;
      const buildMask = (width: number, height: number, dpr: number) => {
        const cs = getComputedStyle(h1);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const pad = fontPx() * 0.4;

        const draw = (ctx: CanvasRenderingContext2D, blur: number) => {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.font = font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing;
          if (blur > 0) ctx.filter = `blur(${blur}px)`;
          const cssW = width / dpr;
          const cssH = height / dpr;
          // canvas is the h1 box plus pad on every side; center the run
          // in the h1 box. letter-spacing adds trailing space after the
          // last glyph, so nudge left by half of it.
          const ls = parseFloat(cs.letterSpacing) || 0;
          ctx.fillText(text, cssW / 2 + ls / 2, cssH / 2 + pad * 0.02);
          ctx.restore();
        };

        const sharp = document.createElement('canvas');
        sharp.width = width;
        sharp.height = height;
        const sc = sharp.getContext('2d')!;
        sc.fillStyle = '#000';
        sc.fillRect(0, 0, width, height);
        sc.fillStyle = '#f00';
        draw(sc, 0);

        const glow = document.createElement('canvas');
        glow.width = width;
        glow.height = height;
        const gc = glow.getContext('2d')!;
        gc.fillStyle = '#0f0';
        draw(gc, fontPx() * 0.16);

        sc.globalCompositeOperation = 'lighter';
        sc.drawImage(glow, 0, 0);

        const next = vgpu.texture(gpu, {
          kind: '2d',
          size: [width, height],
          format: 'rgba8unorm',
          usage: ['texture_binding', 'copy_dst', 'render_attachment'], // copyExternalImageToTexture requires render_attachment
          label: 'wordmark-mask',
        });
        gpu.gpu.queue.copyExternalImageToTexture(
          { source: sharp },
          { texture: next.gpu },
          [width, height],
        );
        const prev = maskTex;
        maskTex = next;
        return { next, prev };
      };

      const fx = vgpu.effect(gpu, shader.default, {
        label: 'wordmark',
        set: {
          params: {
            time: 0,
            theme: isDark() ? 1 : 0,
            aspect: 1,
            reveal: reduceMq.matches ? 1 : 0,
            pointer: [-10, -10],
            texel: surf.texelSize,
            pointerStrength: 0,
            motion: reduceMq.matches ? 0 : 1,
          },
          samp: linear,
        },
      });

      // --- state driven from DOM events, consumed per frame
      let pointer: [number, number] = [-10, -10];
      let pointerTarget = 0;
      let pointerStrength = 0;
      let reveal = reduceMq.matches ? 1 : 0;
      let revealStart = -1;
      let visible = true;
      let dirty = true; // something changed that a static render must pick up
      let loopHandle: { stop(): void } | null = null;
      let firstFrameShown = false;
      const clk = vgpu.clock(gpu);

      const renderOnce = () => {
        if (cancelled || !maskTex) return;
        vgpu.frame(gpu, (f) => f.pass(surf, fx));
        if (!firstFrameShown) {
          firstFrameShown = true;
          setLive(true);
        }
      };

      const tick = () => {
        if (cancelled || !maskTex) return;
        const now = performance.now();
        if (revealStart < 0) revealStart = now;
        if (reveal < 1) {
          const u = Math.min(1, (now - revealStart) / 1500);
          reveal = 1 - Math.pow(1 - u, 3);
        }
        pointerStrength += (pointerTarget - pointerStrength) * 0.08;
        fx.set({
          params: {
            time: clk.time,
            reveal,
            pointer,
            pointerStrength,
            theme: isDark() ? 1 : 0,
          },
        });
      };

      const startLoop = () => {
        if (loopHandle || reduceMq.matches || !visible || document.hidden) return;
        loopHandle = vgpu.frameLoop(
          gpu,
          (f) => {
            tick();
            f.pass(surf, fx);
            if (!firstFrameShown) {
              firstFrameShown = true;
              setLive(true);
            }
          },
          { fps: 60 },
        );
      };
      const stopLoop = () => {
        loopHandle?.stop();
        loopHandle = null;
      };
      cleanups.push(stopLoop);

      const refresh = () => {
        if (reduceMq.matches) {
          fx.set({ params: { theme: isDark() ? 1 : 0, reveal: 1, motion: 0 } });
          renderOnce();
        } else {
          stopLoop();
          startLoop();
        }
      };

      // --- size: the surface auto-resizes from layout; rebuild the mask to match
      const offResize = surf.onResize(({ width, height, dpr }) => {
        applyPad();
        const { prev } = buildMask(width, height, dpr);
        fx.set({
          params: { aspect: width / height, texel: surf.texelSize },
          mask: maskTex!,
        });
        prev?.destroy();
        dirty = true;
        // resize callbacks may not open a frame; defer the static render
        if (reduceMq.matches) queueMicrotask(() => { if (dirty) { dirty = false; renderOnce(); } });
      });
      cleanups.push(offResize);
      cleanups.push(() => maskTex?.destroy());

      // --- pointer: ripples follow the cursor anywhere over the hero stage
      const stage = (wrap.closest('.stage') as HTMLElement | null) ?? wrap;
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        pointer = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
        pointerTarget = 1;
      };
      const onLeave = () => { pointerTarget = 0; };
      stage.addEventListener('pointermove', onMove, { passive: true });
      stage.addEventListener('pointerleave', onLeave, { passive: true });
      cleanups.push(() => {
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', onLeave);
      });

      // --- pause when off-screen or the tab is hidden
      const io = new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) startLoop(); else stopLoop();
      }, { threshold: 0.01 });
      io.observe(canvas);
      cleanups.push(() => io.disconnect());
      const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
      document.addEventListener('visibilitychange', onVis);
      cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

      // --- theme + reduced motion changes
      const mo = new MutationObserver(refresh);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      cleanups.push(() => mo.disconnect());
      reduceMq.addEventListener('change', refresh);
      cleanups.push(() => reduceMq.removeEventListener('change', refresh));

      // --- if the device dies, fall back to the DOM text
      const offErr = gpu.onError(() => {
        setLive(false);
        stopLoop();
      });
      cleanups.push(offErr);

      // go
      if (reduceMq.matches) renderOnce(); else startLoop();
    })().catch(() => {
      // any unexpected failure: keep the plain wordmark
      setLive(false);
    });

    return () => {
      cancelled = true;
      setLive(false);
      for (const fn of cleanups.splice(0).reverse()) {
        try { fn(); } catch { /* teardown is best-effort */ }
      }
    };
  }, [text]);

  return (
    <div ref={wrapRef} className={`wordmark-wrap${live ? ' is-gpu' : ''}`}>
      <h1 ref={h1Ref} className="wordmark">{text}</h1>
      <canvas ref={canvasRef} className="wordmark-gpu" aria-hidden="true" />
    </div>
  );
}

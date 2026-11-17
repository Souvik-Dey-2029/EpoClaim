import { useEffect, useRef } from "react";

/**
 * CinematicAuroraBackground
 * 
 * Recreates the immersive dark emerald aurora environment for the Landing Page:
 * - Deep black-green base (#020805 to #05140b)
 * - Fluid vertical flowing aurora curtains with organic harmonic motion
 * - Luminous emerald wave crests (#1bb96d / #2ee588 / #45dfa0)
 * - Subtle chromatic touches (turquoise #38cfc2, celestial violet #b07dc6)
 * - Vertical fluted pleats / light curtains channeling atmospheric illumination
 * - Controlled bloom and rich dark negative space ensuring peak text contrast
 * - Cursor interaction with gentle relaxation
 * - Auto-pauses when tab is hidden or prefers-reduced-motion is enabled
 */

export function CinematicAuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReducedMotion = mediaQuery.matches;
    const handleMotion = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    mediaQuery.addEventListener("change", handleMotion);

    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) lastFrameTime = performance.now();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Pointer state
    let prevX = -9999;
    let prevY = -9999;
    let currX = -9999;
    let currY = -9999;
    let isPointerActive = false;
    let lastPointerTime = performance.now();

    // Simulation grid for directional aurora strain
    const CELL = 14;
    let cols = 0;
    let rows = 0;
    let strainX = new Float32Array(0);
    let strainY = new Float32Array(0);
    let strainEnergy = new Float32Array(0);

    // Simulation rasterization buffer
    let simCanvas: HTMLCanvasElement | null = null;
    let simCtx: CanvasRenderingContext2D | null = null;
    let simImgData: ImageData | null = null;
    let simPixels32: Uint32Array | null = null;

    // Subtle tactile starlight / grain pattern
    let grainCanvas: HTMLCanvasElement | null = null;
    let grainPattern: CanvasPattern | null = null;

    const initGrid = (w: number, h: number) => {
      cols = Math.ceil(w / CELL) + 1;
      rows = Math.ceil(h / CELL) + 1;
      const total = cols * rows;

      strainX = new Float32Array(total);
      strainY = new Float32Array(total);
      strainEnergy = new Float32Array(total);

      simCanvas = document.createElement("canvas");
      simCanvas.width = cols;
      simCanvas.height = rows;
      simCtx = simCanvas.getContext("2d");
      if (simCtx) {
        simImgData = simCtx.createImageData(cols, rows);
        simPixels32 = new Uint32Array(simImgData.data.buffer);
      }

      // Procedural micro-texture
      grainCanvas = document.createElement("canvas");
      grainCanvas.width = 384;
      grainCanvas.height = 384;
      const gCtx = grainCanvas.getContext("2d");
      if (gCtx) {
        const gImg = gCtx.createImageData(384, 384);
        const data = gImg.data;
        let s = 98765;
        const rand = () => {
          s = (s * 1664525 + 1013904223) % 4294967296;
          return s / 4294967296;
        };

        for (let y = 0; y < 384; y++) {
          for (let x = 0; x < 384; x++) {
            const idx = (y * 384 + x) * 4;
            const n = (rand() - 0.5) * 20;
            if (n > 0) {
              data[idx] = 210;
              data[idx + 1] = 245;
              data[idx + 2] = 225;
              data[idx + 3] = Math.min(16, Math.floor(n * 1.2));
            } else {
              data[idx] = 1;
              data[idx + 1] = 6;
              data[idx + 2] = 3;
              data[idx + 3] = Math.min(20, Math.floor(-n * 1.4));
            }
          }
        }
        gCtx.putImageData(gImg, 0, 0);
        grainPattern = ctx.createPattern(grainCanvas, "repeat");
      }
    };

    const brushAurora = (x0: number, y0: number, x1: number, y1: number, speed: number) => {
      if (cols === 0 || rows === 0) return;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) return;

      const dirX = dx / dist;
      const dirY = dy / dist;

      const radiusPx = 160;
      const rGrid = radiusPx / CELL;
      const speedNorm = Math.min(1.0, speed / 25);
      const force = 0.38 + speedNorm * 0.42;

      const step = radiusPx * 0.35;
      const steps = Math.max(1, Math.ceil(dist / step));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = x0 + dx * t;
        const py = y0 + dy * t;
        const cc = px / CELL;
        const cr = py / CELL;

        const minC = Math.max(0, Math.floor(cc - rGrid * 1.25));
        const maxC = Math.min(cols - 1, Math.ceil(cc + rGrid * 1.25));
        const minR = Math.max(0, Math.floor(cr - rGrid * 1.25));
        const maxR = Math.min(rows - 1, Math.ceil(cr + rGrid * 1.25));

        for (let r = minR; r <= maxR; r++) {
          const rOffset = r * cols;
          const dr = r - cr;
          for (let c = minC; c <= maxC; c++) {
            const dc = c - cc;
            const elDist = Math.hypot(dc * 0.85, dr * 1.15);

            if (elDist < rGrid) {
              const norm = elDist / rGrid;
              const falloff = Math.cos(norm * Math.PI * 0.5) ** 2;
              const alpha = Math.min(0.85, force * falloff * 0.6);
              const idx = rOffset + c;

              strainX[idx] = strainX[idx] * (1 - alpha) + dirX * alpha;
              strainY[idx] = strainY[idx] * (1 - alpha) + dirY * alpha;
              strainEnergy[idx] = Math.min(1.0, strainEnergy[idx] * (1 - alpha) + force * falloff);
            }
          }
        }
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastPointerTime);
      lastPointerTime = now;

      const px = e.clientX;
      const py = e.clientY;

      if (!isPointerActive || prevX === -9999) {
        prevX = px;
        prevY = py;
        currX = px;
        currY = py;
        isPointerActive = true;
        return;
      }

      currX = px;
      currY = py;
      const dx = currX - prevX;
      const dy = currY - prevY;
      const dist = Math.hypot(dx, dy);
      const speed = (dist / dt) * 16.67;

      if (!prefersReducedMotion && dist > 1) {
        brushAurora(prevX, prevY, currX, currY, speed);
      }

      prevX = currX;
      prevY = currY;
    };

    const onPointerLeave = () => {
      isPointerActive = false;
      prevX = -9999;
      prevY = -9999;
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);

    let animId: number;
    let lastFrameTime = performance.now();
    let timeAccumulator = 0;

    const render = (now: number) => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(50, now - lastFrameTime);
      lastFrameTime = now;
      if (!prefersReducedMotion) {
        timeAccumulator += dt * 0.00035; // Slow, majestic living flow
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

      const tw = Math.floor(w * dpr);
      const th = Math.floor(h * dpr);

      if (canvas.width !== tw || canvas.height !== th || cols === 0) {
        canvas.width = tw;
        canvas.height = th;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        initGrid(w, h);
      }

      // Strain decay (~1.8s relaxation)
      const decay = Math.exp(-dt * 0.00165);
      const totalCells = cols * rows;

      for (let i = 0; i < totalCells; i++) {
        let e = strainEnergy[i];
        if (e > 0.001) {
          e *= decay;
          if (e < 0.001) {
            e = 0;
            strainX[i] = 0;
            strainY[i] = 0;
          }
          strainEnergy[i] = e;
          strainX[i] *= decay;
          strainY[i] *= decay;
        }
      }

      // Rasterize the living vertical aurora curtains
      if (simPixels32 && simImgData && simCtx && simCanvas) {
        let pIdx = 0;
        const time = timeAccumulator;

        for (let r = 0; r < rows; r++) {
          const ny = r / (rows - 1);
          const rOffset = r * cols;

          for (let c = 0; c < cols; c++) {
            const nx = c / (cols - 1);
            const cIdx = rOffset + c;

            // Pointer strain deflection
            const energy = strainEnergy[cIdx];
            let flutedNx = nx;
            let brushSheen = 0;

            if (energy > 0.002) {
              const sx = strainX[cIdx];
              const sy = strainY[cIdx];
              flutedNx += sx * 0.035;
              const smag = Math.hypot(sx, sy);
              brushSheen = energy * (smag > 0.001 ? (sx * -0.58 + sy * -0.78) / smag : 0) * 0.32;
            }

            // 1. Vertical Fluting (frequency ~48 with organic waviness and slow living time drift)
            const fluteWaviness = 0.018 * Math.sin(ny * 4.2 + time * 1.8 + 0.3) + 0.008 * Math.sin(ny * 8.6 - time * 2.2 + 1.2);
            const fluteX = flutedNx + fluteWaviness;
            const fluteVal = Math.pow(Math.cos((fluteX * 46 + Math.sin(time * 0.8) * 0.2) * Math.PI * 2) * 0.5 + 0.5, 1.35);

            // 2. Primary Luminous Aurora Curtain Trajectory Y(x, t)
            const waveY1 = 0.44 + 0.16 * Math.sin(nx * 3.0 + time * 1.2 - 0.4) - 0.26 * Math.sin(nx * 4.3 - time * 0.9 - 1.1) + 0.04 * Math.cos(nx * 6.5 + time * 1.5);
            const dy1 = ny - waveY1;

            let spread1 = 0.22 + 0.06 * Math.sin(nx * 3.1 + time + 0.3);
            if (nx > 0.52 && dy1 > 0) {
              spread1 *= 0.64; // Sharp shadow chasm boundary below peak
            } else if (nx > 0.52 && dy1 < 0) {
              spread1 *= 1.48; // Upward luminous curtain expanding into upper-right
            }

            const distNorm1 = Math.abs(dy1) / Math.max(0.05, spread1);
            const ribbon1 = Math.exp(-distNorm1 * distNorm1 * 2.2);

            // 3. Secondary High-Atmosphere Aurora Veil (softer, slower upper ribbon)
            const waveY2 = 0.22 + 0.12 * Math.sin(nx * 2.2 - time * 0.7 + 1.0) + 0.06 * Math.cos(nx * 4.8 + time * 1.1);
            const dy2 = ny - waveY2;
            const distNorm2 = Math.abs(dy2) / 0.32;
            const ribbon2 = Math.exp(-distNorm2 * distNorm2 * 1.8) * 0.45;

            // Ambient background illumination with peripheral dark-forest radiance
            const topGlow = Math.max(0, 0.42 - ny * 0.44) * (0.38 + 0.62 * nx);
            const ambientCornerFill = 0.04 + 0.03 * Math.sin(nx * 2.4 + 0.4) * Math.cos(ny * 2.0);
            let baseLight = (ribbon1 + ribbon2) * (0.82 + 0.34 * Math.sin(nx * 2.8 + time * 0.6 + 0.5)) + topGlow * 0.38 + ambientCornerFill;

            // Intense luminous crest at upper-right peak (nx ~ 0.66 - 0.84, ny ~ 0.10 - 0.38)
            const peakDist = Math.hypot((nx - 0.74) * 1.35, (ny - 0.22) * 1.85);
            if (peakDist < 0.5) {
              const peakBoost = Math.cos((peakDist / 0.5) * Math.PI * 0.5) ** 2;
              baseLight += peakBoost * 0.54;
            }

            // Shadow chasm void beneath peak
            const chasmDist = Math.hypot((nx - 0.75) * 1.25, (ny - 0.78) * 1.55);
            if (chasmDist < 0.56) {
              const chasmCut = Math.cos((chasmDist / 0.56) * Math.PI * 0.5) ** 2;
              baseLight *= Math.max(0.08, 1.0 - chasmCut * 0.85);
            }

            // Bottom perimeter darkness for grounded negative space
            if (ny > 0.70) {
              const botFade = (ny - 0.70) / 0.30;
              baseLight *= Math.max(0.12, 1.0 - botFade * 0.70);
            }

            // Fluted vertical modulation
            // On mobile (w <= 768), soften fluting significantly to avoid dense barcode-like stripes
            const isMobileScreen = w <= 768;
            const fluteWeight = isMobileScreen ? 0.12 : 0.64;
            const baseWeight = isMobileScreen ? 0.88 : 0.36;
            let totalLight = baseLight * (baseWeight + fluteWeight * fluteVal) + brushSheen;

            // Atmospheric Emerald Aurora Palette Mapping:
            // Base shadow: #020805
            // Deep forest: #05190f
            // Mid emerald: #15693c
            // Radiant emerald: #25ad66
            // Aurora crest: #38d67e / #4be3a3
            let crR = 2;
            let crG = 8;
            let crB = 5;

            if (totalLight <= 0.25) {
              const t = Math.max(0, totalLight / 0.25);
              crR = 2 * (1 - t) + 5 * t;
              crG = 8 * (1 - t) + 26 * t;
              crB = 5 * (1 - t) + 16 * t;
            } else if (totalLight <= 0.60) {
              const t = (totalLight - 0.25) / (0.60 - 0.25);
              let targetR = 5 * (1 - t) + 21 * t;
              let targetG = 26 * (1 - t) + 104 * t;
              let targetB = 16 * (1 - t) + 58 * t;

              // Turquoise sea-glass infusion
              const turquoiseZone = Math.max(0, Math.sin(nx * 3.6 + ny * 2.2 + time * 0.8 - 0.3));
              const seaGlassBlend = t * 0.28 * (turquoiseZone ** 1.6);
              targetR = targetR * (1 - seaGlassBlend) + 72 * seaGlassBlend;
              targetG = targetG * (1 - seaGlassBlend) + 196 * seaGlassBlend;
              targetB = targetB * (1 - seaGlassBlend) + 172 * seaGlassBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            } else if (totalLight <= 0.95) {
              const t = (totalLight - 0.60) / (0.95 - 0.60);
              let targetR = 21 * (1 - t) + 38 * t;
              let targetG = 104 * (1 - t) + 176 * t;
              let targetB = 58 * (1 - t) + 102 * t;

              // Celestial mist-blue & violet highlights at top crest
              const mistZone = Math.max(0, Math.sin(nx * 3.2 - ny * 2.6 + time * 0.5 + 0.6));
              const mistBlend = t * 0.20 * (mistZone ** 1.8);
              targetR = targetR * (1 - mistBlend) + 160 * mistBlend;
              targetG = targetG * (1 - mistBlend) + 190 * mistBlend;
              targetB = targetB * (1 - mistBlend) + 215 * mistBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            } else {
              const t = Math.min(1.0, (totalLight - 0.95) / 0.55);
              let targetR = 38 * (1 - t) + 58 * t;
              let targetG = 176 * (1 - t) + 225 * t;
              let targetB = 102 * (1 - t) + 148 * t;

              // Violet shimmer at apex
              const shimmer = Math.max(0, Math.sin(nx * 5.0 + ny * 3.0 + time * 1.5));
              const shimmerBlend = t * 0.16 * shimmer;
              targetR = targetR * (1 - shimmerBlend) + 185 * shimmerBlend;
              targetG = targetG * (1 - shimmerBlend) + 155 * shimmerBlend;
              targetB = targetB * (1 - shimmerBlend) + 210 * shimmerBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            }

            const iR = Math.min(255, Math.max(0, Math.round(crR)));
            const iG = Math.min(255, Math.max(0, Math.round(crG)));
            const iB = Math.min(255, Math.max(0, Math.round(crB)));

            simPixels32[pIdx++] = (255 << 24) | (iB << 16) | (iG << 8) | iR;
          }
        }

        simCtx.putImageData(simImgData, 0, 0);

        // Blit to screen with smooth bicubic interpolation
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(simCanvas, 0, 0, tw, th);

        // Tactile organic micro-grain overlay
        if (grainPattern) {
          ctx.globalAlpha = 0.65;
          ctx.fillStyle = grainPattern;
          ctx.fillRect(0, 0, tw, th);
          ctx.globalAlpha = 1.0;
        }

        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("mouseleave", onPointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      mediaQuery.removeEventListener("change", handleMotion);
    };
  }, []);

  return (
    <div className="velvet-fabric-background-wrapper cinematic-aurora-wrapper" aria-hidden="true">
      <canvas ref={canvasRef} className="velvet-fabric-background-canvas" />
    </div>
  );
}

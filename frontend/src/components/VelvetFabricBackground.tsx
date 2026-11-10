import { useEffect, useRef } from "react";

/**
 * VelvetFabricBackground
 * 
 * Recreates the exact cinematic dark forest-green atmosphere from the reference image:
 * - Deep, near-black forest green shadow regions (#020905 to #05180f)
 * - Sinuous, organic luminous emerald wave traveling dynamically across the canvas:
 *   starts mid-left, dips gently, surges up into a radiant emerald crest (#25ab64 / #34ce78)
 *   in the upper-right, and drops off into a deep shadow chasm below.
 * - Vertical fluted pleats / light curtains: dense, soft vertical ribs (frequency ~50)
 *   with organic fabric waviness that catch and channel the emerald illumination.
 * - Tactile micro-velvet nap grain giving authentic physical depth.
 * - Directional velvet brushing interaction: moving the pointer deflects the vertical flutes
 *   and alters directional sheen along the stroke, smoothly relaxing back over ~1.8s.
 * - High performance 60fps canvas simulation with low CPU overhead.
 */

export function VelvetFabricBackground() {
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

    // Simulation grid for directional nap strain
    const CELL = 12;
    let cols = 0;
    let rows = 0;
    let strainX = new Float32Array(0);
    let strainY = new Float32Array(0);
    let strainEnergy = new Float32Array(0);

    // Offscreen velvet grain pattern canvas
    let grainCanvas: HTMLCanvasElement | null = null;
    let grainPattern: CanvasPattern | null = null;

    // Simulation rasterization buffer
    let simCanvas: HTMLCanvasElement | null = null;
    let simCtx: CanvasRenderingContext2D | null = null;
    let simImgData: ImageData | null = null;
    let simPixels32: Uint32Array | null = null;

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

      // Procedural micro-velvet tactile grain
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
            const n = (rand() - 0.5) * 24;
            if (n > 0) {
              data[idx] = 230;
              data[idx + 1] = 245;
              data[idx + 2] = 235;
              data[idx + 3] = Math.min(22, Math.floor(n * 1.5));
            } else {
              data[idx] = 2;
              data[idx + 1] = 8;
              data[idx + 2] = 4;
              data[idx + 3] = Math.min(28, Math.floor(-n * 1.9));
            }
          }
        }
        gCtx.putImageData(gImg, 0, 0);
        grainPattern = ctx.createPattern(grainCanvas, "repeat");
      }
    };

    const brushVelvet = (x0: number, y0: number, x1: number, y1: number, speed: number) => {
      if (cols === 0 || rows === 0) return;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) return;

      const dirX = dx / dist;
      const dirY = dy / dist;

      const radiusPx = 145;
      const rGrid = radiusPx / CELL;
      const speedNorm = Math.min(1.0, speed / 28);
      const force = 0.42 + speedNorm * 0.45;

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
            const along = dc * dirX + dr * dirY;
            const perp = -dc * dirY + dr * dirX;
            const elDist = Math.hypot(along * 0.85, perp * 1.15);

            if (elDist < rGrid) {
              const norm = elDist / rGrid;
              const falloff = Math.cos(norm * Math.PI * 0.5) ** 2;
              const alpha = Math.min(0.85, force * falloff * 0.65);
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
        brushVelvet(prevX, prevY, currX, currY, speed);
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

    const render = (now: number) => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(50, now - lastFrameTime);
      lastFrameTime = now;

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

      // Exponential strain decay (~1.8s relaxation)
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

      // Rasterize the atmospheric vertical fluted curtain reference
      if (simPixels32 && simImgData && simCtx && simCanvas) {
        let pIdx = 0;
        const lx = -0.58;
        const ly = -0.78;

        for (let r = 0; r < rows; r++) {
          const ny = r / (rows - 1);
          const rOffset = r * cols;

          for (let c = 0; c < cols; c++) {
            const nx = c / (cols - 1);
            const cIdx = rOffset + c;

            // Pointer strain offset on fabric flutes
            const energy = strainEnergy[cIdx];
            let flutedNx = nx;
            let brushSheen = 0;

            if (energy > 0.002) {
              const sx = strainX[cIdx];
              const sy = strainY[cIdx];
              flutedNx += sx * 0.032;

              const smag = Math.hypot(sx, sy);
              const dot = smag > 0.001 ? (sx * lx + sy * ly) / smag : 0;
              brushSheen = energy * dot * 0.35;
            }

            // 1. Vertical Fluting (frequency ~50 with gentle organic fabric waviness)
            const fluteWaviness = 0.016 * Math.sin(ny * 4.3 + 0.3) + 0.007 * Math.sin(ny * 8.8 + 1.2);
            const fluteX = flutedNx + fluteWaviness;
            const fluteVal = Math.pow(Math.cos(fluteX * 52 * Math.PI * 2) * 0.5 + 0.5, 1.35);

            // 2. Sinuous Luminous Curtain Trajectory Y(x)
            // Left: y ~ 0.44 -> dips center-left: y ~ 0.62 -> surges up high on right: y ~ 0.20 -> tapers: y ~ 0.35
            const waveY = 0.45 + 0.17 * Math.sin(nx * 3.0 - 0.4) - 0.28 * Math.sin(nx * 4.4 - 1.2) + 0.05 * Math.cos(nx * 6.8);
            const dy = ny - waveY;

            // Asymmetric thickness: sharp drop-off into shadow below right crest; wide illumination above
            let spread = 0.23 + 0.07 * Math.sin(nx * 3.2 + 0.3);
            if (nx > 0.52 && dy > 0) {
              spread *= 0.62; // sharp shadow boundary below peak
            } else if (nx > 0.52 && dy < 0) {
              spread *= 1.45; // upward glow expanding into top-right
            }

            const distNorm = Math.abs(dy) / Math.max(0.05, spread);
            const ribbon = Math.exp(-distNorm * distNorm * 2.3);

            // Ambient background emission fill with continuous peripheral deep-forest radiance
            // Gently softens dead near-black patches in upper-left and lower-right
            const topGlow = Math.max(0, 0.44 - ny * 0.46) * (0.42 + 0.58 * nx);
            const ambientCornerFill = 0.045 + 0.035 * Math.sin(nx * 2.5 + 0.4) * Math.cos(ny * 2.2);
            let baseLight = ribbon * (0.84 + 0.36 * Math.sin(nx * 2.8 + 0.5)) + topGlow * 0.42 + ambientCornerFill;

            // Intense luminous crest at upper-right peak (nx ~ 0.68 - 0.82, ny ~ 0.10 - 0.40)
            const peakDist = Math.hypot((nx - 0.74) * 1.35, (ny - 0.22) * 1.85);
            if (peakDist < 0.48) {
              const peakBoost = Math.cos((peakDist / 0.48) * Math.PI * 0.5) ** 2;
              baseLight += peakBoost * 0.52;
            }

            // Shadow chasm void beneath the peak (nx ~ 0.70 - 0.86, ny ~ 0.60 - 0.95)
            // Softened floor threshold so lower-right maintains subtle atmospheric presence without dead black void
            const chasmDist = Math.hypot((nx - 0.75) * 1.25, (ny - 0.78) * 1.55);
            if (chasmDist < 0.58) {
              const chasmCut = Math.cos((chasmDist / 0.58) * Math.PI * 0.5) ** 2;
              baseLight *= Math.max(0.08, 1.0 - chasmCut * 0.86);
            }

            // Bottom perimeter darkness
            // Softened floor threshold so lower regions preserve depth while keeping fabric sheen alive
            if (ny > 0.68) {
              const botFade = (ny - 0.68) / 0.32;
              baseLight *= Math.max(0.10, 1.0 - botFade * 0.72);
            }

            // Fluted vertical modulation
            let totalLight = baseLight * (0.36 + 0.64 * fluteVal) + brushSheen;

            // Color Palette mapping (Target Chromatic Aurora Palette):
            // Forest Shadow: #020905 -> rgb(  2,   9,   5)
            // Deep Forest:   #05180F -> rgb(  5,  24,  15)
            // Mid Emerald:   #15663A -> rgb( 21, 102,  58)
            // Emerald:       #25AB64 -> rgb( 37, 171, 100) (dominant luminous wave)
            // Radiant Green: #34CE78 -> rgb( 52, 206, 120) (bright wave crests)
            //
            // Chromatic Nuances (Noticeable, naturally blended atmospheric shifts):
            // - Sea Glass (Turquoise): #56C7B2 -> rgb( 86, 199, 178)
            // - Mist Blue:             #A8B9D9 -> rgb(168, 185, 217)
            // - Lavender:              #B99ACB -> rgb(185, 154, 203)
            // - Dusty Rose:            #D99B91 -> rgb(217, 155, 145)
            // - Champagne:             #E8D9B9 -> rgb(232, 217, 185)
            let crR = 2;
            let crG = 9;
            let crB = 5;

            if (totalLight <= 0.26) {
              // Deep shadow regions: transition smoothly from Forest Shadow to Deep Forest
              // with subtle emerald/mist trace so corners never drop into lifeless pitch black
              const t = Math.max(0, totalLight / 0.26);
              crR = 3 * (1 - t) + 6 * t;
              crG = 12 * (1 - t) + 28 * t;
              crB = 7 * (1 - t) + 18 * t;
            } else if (totalLight <= 0.62) {
              // Low-mid wave body: Deep Forest to Mid Emerald, with clearly perceptible Sea Glass (turquoise) in wave transitions
              const t = (totalLight - 0.26) / (0.62 - 0.26);
              let targetR = 6 * (1 - t) + 21 * t;
              let targetG = 28 * (1 - t) + 102 * t;
              let targetB = 18 * (1 - t) + 58 * t;

              // Distinct, visible turquoise (Sea Glass) in selected wave transitions
              const turquoiseZone = Math.max(0, Math.sin(nx * 3.8 + ny * 2.3 - 0.3));
              const seaGlassBlend = t * 0.28 * (turquoiseZone ** 1.6);
              targetR = targetR * (1 - seaGlassBlend) + 86 * seaGlassBlend;
              targetG = targetG * (1 - seaGlassBlend) + 199 * seaGlassBlend;
              targetB = targetB * (1 - seaGlassBlend) + 178 * seaGlassBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            } else if (totalLight <= 0.96) {
              // Mid-high emerald wave: Mid Emerald to Emerald (#25AB64)
              const t = (totalLight - 0.62) / (0.96 - 0.62);
              let targetR = 21 * (1 - t) + 37 * t;
              let targetG = 102 * (1 - t) + 171 * t;
              let targetB = 58 * (1 - t) + 100 * t;

              // Noticeable mist-blue atmospheric highlights in upper glow regions
              const mistZone = Math.max(0, Math.sin(nx * 3.4 - ny * 2.8 + 0.7));
              const mistBlend = t * 0.18 * (mistZone ** 1.8);
              targetR = targetR * (1 - mistBlend) + 168 * mistBlend;
              targetG = targetG * (1 - mistBlend) + 185 * mistBlend;
              targetB = targetB * (1 - mistBlend) + 217 * mistBlend;

              // Clearly perceptible lavender reflections in the secondary inflection & crest edges
              const lavenderZone = Math.max(0, Math.sin(nx * 5.2 + ny * 1.9 - 1.0));
              const lavenderBlend = t * 0.16 * (lavenderZone ** 1.9);
              targetR = targetR * (1 - lavenderBlend) + 185 * lavenderBlend;
              targetG = targetG * (1 - lavenderBlend) + 154 * lavenderBlend;
              targetB = targetB * (1 - lavenderBlend) + 203 * lavenderBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            } else {
              // Peak crest luminous highlights: Emerald to Radiant Green (#34CE78), with warm champagne and dusty-rose accents
              const t = Math.min(1.0, (totalLight - 0.96) / 0.48);
              let targetR = 37 * (1 - t) + 52 * t;
              let targetG = 171 * (1 - t) + 206 * t;
              let targetB = 100 * (1 - t) + 120 * t;

              // Noticeable warm champagne illumination across the highest luminosity crest
              const champagneZone = Math.max(0, Math.cos((nx - 0.74) * 3.6));
              const champagneBlend = t * 0.22 * (champagneZone ** 1.8);
              targetR = targetR * (1 - champagneBlend) + 232 * champagneBlend;
              targetG = targetG * (1 - champagneBlend) + 217 * champagneBlend;
              targetB = targetB * (1 - champagneBlend) + 185 * champagneBlend;

              // Restrained, visible warm dusty-rose reflections along crest perimeter grazing angles
              const roseZone = Math.max(0, Math.sin(nx * 5.8 - ny * 3.9 + 0.4));
              const roseBlend = t * 0.14 * (roseZone ** 2.2);
              targetR = targetR * (1 - roseBlend) + 217 * roseBlend;
              targetG = targetG * (1 - roseBlend) + 155 * roseBlend;
              targetB = targetB * (1 - roseBlend) + 145 * roseBlend;

              crR = targetR;
              crG = targetG;
              crB = targetB;
            }

            const rb = Math.min(255, Math.max(0, crR | 0));
            const gb = Math.min(255, Math.max(0, crG | 0));
            const bb = Math.min(255, Math.max(0, crB | 0));

            simPixels32[pIdx++] = (255 << 24) | (bb << 16) | (gb << 8) | rb;
          }
        }

        simCtx.putImageData(simImgData, 0, 0);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(simCanvas, 0, 0, w, h);

        // Composite subtle physical velvet grain
        if (grainPattern) {
          ctx.save();
          ctx.globalCompositeOperation = "soft-light";
          ctx.fillStyle = grainPattern;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
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
    <div className="velvet-fabric-background-wrapper" aria-hidden="true">
      <canvas ref={canvasRef} className="velvet-fabric-background-canvas" />
    </div>
  );
}

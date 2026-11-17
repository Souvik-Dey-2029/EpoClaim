import { useEffect, useRef } from "react";

interface OrbitalTrajectoryProps {
  progress: number; // 0 to 1
}

/**
 * OrbitalTrajectory
 * 
 * Signature continuous kinetic trajectory for EpoClaim:
 * - A living orbital filament passing behind, through, and around the central 3D hourglass
 * - Morphs dynamically across the 7 story stages driven directly by scroll progress
 * - Stages:
 *    0.0 - 0.14: Ascending orbital loop encircling the hourglass
 *    0.14 - 0.28: Uncoils horizontally into a sweeping temporal timeline axis
 *    0.28 - 0.44: Branches into 4 laser data conduits for claim decomposition
 *    0.44 - 0.58: Weaves an evidence provenance network
 *    0.58 - 0.72: Converges into a focused grounded truth beam
 *    0.72 - 0.86: Distributes across 5 ecosystem integration endpoints
 *    0.86 - 1.00: Closes into a monumental golden-emerald orbit around the hourglass
 */
export function OrbitalTrajectory({ progress }: OrbitalTrajectoryProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const pulseRef = useRef<SVGCircleElement | null>(null);

  // Calculate dynamic control points based on progress
  const p = Math.max(0, Math.min(1, progress));

  // Determine stage-specific path geometry
  let d = "";
  let strokeColor = "#12B981";
  let pulseOpacity = 0.9;

  if (p < 0.15) {
    // Stage 1: Ascending 3D orbital loop
    const t = p / 0.15;
    const tilt = 40 + t * 20;
    d = `M 200 650 C 350 750, 600 ${600 - tilt}, 700 450 C 800 300, 750 150, 500 220 C 300 280, 250 500, 480 520 C 650 540, 850 420, 920 280`;
    strokeColor = "#12B981";
  } else if (p < 0.30) {
    // Stage 2: Uncoiling into temporal timeline vector across screen
    const t = (p - 0.15) / 0.15;
    const yMid = 480 + Math.sin(t * Math.PI) * 40;
    d = `M 100 ${yMid} C 350 ${yMid - 60}, 500 ${yMid + 60}, 720 ${yMid} C 900 ${yMid - 40}, 1100 ${yMid + 20}, 1340 ${yMid}`;
    strokeColor = t > 0.4 ? "#F59E0B" : "#12B981";
  } else if (p < 0.45) {
    // Stage 3: Branching into 4-stage pipeline data filaments
    const t = (p - 0.30) / 0.15;
    const spread = 80 * t;
    d = `M 150 520 C 300 ${450 - spread}, 500 ${520 + spread}, 720 480 C 900 ${460 - spread}, 1150 ${540 + spread}, 1300 500`;
    strokeColor = "#34D399";
  } else if (p < 0.60) {
    // Stage 4: Forensic evidence provenance network
    const _t = (p - 0.45) / 0.15;
    void _t;
    d = `M 200 400 C 400 320, 600 620, 720 480 C 840 340, 1050 580, 1280 420`;
    strokeColor = "#10B981";
  } else if (p < 0.75) {
    // Stage 5: Converging grounded truth revision beam
    const t = (p - 0.60) / 0.15;
    d = `M 180 500 C 450 ${520 - t * 30}, 650 490, 720 490 C 850 490, 1050 ${520 - t * 30}, 1280 500`;
    strokeColor = "#12B981";
  } else if (p < 0.88) {
    // Stage 6: Distributing across developer ecosystem
    const _t = (p - 0.75) / 0.13;
    void _t;
    d = `M 220 540 C 420 380, 600 560, 720 480 C 860 400, 1080 580, 1260 460`;
    strokeColor = "#6EE7B7";
  } else {
    // Stage 7: Majestic closing ouroboros halo encircling hourglass
    const t = (p - 0.88) / 0.12;
    const r = 260 + Math.sin(t * Math.PI) * 30;
    d = `M 720 220 C ${720 + r} 220, ${720 + r} 680, 720 680 C ${720 - r} 680, ${720 - r} 220, 720 220`;
    strokeColor = "#E8D9B9";
  }

  // Update animated pulse position along the path
  useEffect(() => {
    const path = pathRef.current;
    const pulse = pulseRef.current;
    if (!path || !pulse) return;

    try {
      const len = path.getTotalLength();
      if (len > 0) {
        // Move pulse smoothly with fine scroll progress + time phase
        const pulsePos = (p * 3.5) % 1.0;
        const pt = path.getPointAtLength(pulsePos * len);
        pulse.setAttribute("cx", pt.x.toString());
        pulse.setAttribute("cy", pt.y.toString());
      }
    } catch {
      // Graceful fallback for SVG measurement
    }
  }, [p, d]);

  return (
    <div className="orbital-trajectory-viewport" aria-hidden="true">
      <svg
        className="orbital-trajectory-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Luminous dynamic glow filters */}
          <filter id="trajectory-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="traj-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#12B981" stopOpacity="0.1" />
            <stop offset="35%" stopColor={strokeColor} stopOpacity="0.75" />
            <stop offset="65%" stopColor="#F0E8D2" stopOpacity="0.9" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Ambient Secondary Depth Echo */}
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeOpacity="0.12"
          filter="url(#trajectory-glow)"
          className="trajectory-echo-path"
        />

        {/* Primary Glowing Orbital Ribbon */}
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke="url(#traj-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#trajectory-glow)"
          className="trajectory-main-path"
        />

        {/* Dynamic Energy Comet Node */}
        <circle
          ref={pulseRef}
          cx="720"
          cy="450"
          r="6"
          fill="#FFF"
          filter="url(#trajectory-glow)"
          opacity={pulseOpacity}
          className="trajectory-comet-pulse"
        />
        <circle
          cx="720"
          cy="450"
          r="14"
          fill={strokeColor}
          opacity="0.3"
          filter="url(#trajectory-glow)"
        />
      </svg>
    </div>
  );
}

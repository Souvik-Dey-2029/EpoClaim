import { CinematicScrollLanding } from "./CinematicScrollLanding";
import type { BenchmarkReport } from "../types";

export interface LandingHeroProps {
  onLaunchAnalyzer: () => void;
  onNavigateBenchmark: () => void;
  onNavigateDevelopers?: () => void;
  onOpenExtensionInstall: () => void;
  benchmarkResult?: BenchmarkReport | null;
}

/**
 * LandingHero (Cinematic Continuous Scroll Film Edition)
 *
 * Implements the continuous scroll-driven film experience:
 * One single continuous visual world where vertical scroll controls
 * the evolution of the 3D hourglass, dynamic orbital trajectory,
 * and choreographed narrative stages with zero slideshows or page-turning.
 */
export function LandingHero(props: LandingHeroProps) {
  return <CinematicScrollLanding {...props} />;
}

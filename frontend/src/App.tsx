import { useState, useEffect, useRef } from "react";
import { checkHealth, analyzeResponse, getAnalysis, runBenchmark, getTavilyStatus } from "./api";
import type { FinalReport, ClaimAnalysisDetail, BenchmarkReport, TavilyStatus } from "./types";
import { CinematicAuroraBackground } from "./components/CinematicAuroraBackground";
import { WorkspaceBackground } from "./components/WorkspaceBackground";
import { LandingHeader } from "./components/LandingHeader";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { LandingHero } from "./components/LandingHero";
import { AnalyzerWorkspace } from "./components/AnalyzerWorkspace";
import { BenchmarkSuiteView } from "./components/BenchmarkSuiteView";
import { DeveloperHubView } from "./components/DeveloperHubView";
import { EngineStartupModal } from "./components/EngineStartupModal";
import { ChromeExtensionModal } from "./components/ChromeExtensionModal";
import { CHROME_EXTENSION_STORE_URL } from "./config";

const PRESET_SCENARIOS = [
  {
    label: "OpenAI Interim Leadership (Temporally Stale)",
    prompt: "Who is the CEO of OpenAI?",
    response:
      "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    context:
      "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI.",
  },
  {
    label: "Python Latest Version (Superseded)",
    prompt: "What is the latest stable release of Python?",
    response:
      "Python 3.11 is the latest stable release of Python. It delivers substantial execution improvements.",
    context:
      "Python 3.11 was released in October 2022. Python 3.12 was released in October 2023, followed by Python 3.13 in October 2024 as the official latest release.",
  },
  {
    label: "Apollo 11 Moon Landing (Historical Invariant)",
    prompt: "When did humans first land on the moon?",
    response:
      "Apollo 11 landed on the moon on July 20, 1969. Neil Armstrong and Buzz Aldrin walked on the lunar surface.",
    context:
      "On July 20, 1969, American astronauts Neil Armstrong and Buzz Aldrin landed the Apollo 11 Lunar Module on the Moon.",
  },
];

export type AppRoute = "landing" | "analyzer" | "benchmark" | "developers";

function getRouteFromPath(pathname: string): AppRoute {
  const clean = pathname.toLowerCase().replace(/\/+$/, "");
  if (clean === "/analyzer") return "analyzer";
  if (clean === "/benchmark") return "benchmark";
  if (clean === "/developers" || clean === "/developer") return "developers";
  return "landing";
}

export function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    getRouteFromPath(window.location.pathname)
  );

  const [health, setHealth] = useState<{ status: string; integrations: Record<string, boolean> } | null>(null);
  const [healthChecking, setHealthChecking] = useState<boolean>(true);
  const [tavilyStatus, setTavilyStatus] = useState<TavilyStatus | null>(null);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);

  // Analyzer state
  const [prompt, setPrompt] = useState("");
  const [responseText, setResponseText] = useState(PRESET_SCENARIOS[0].response);
  const [contextDocs, setContextDocs] = useState(PRESET_SCENARIOS[0].context);
  const [enableLiveSearch, setEnableLiveSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimAnalysisDetail | null>(null);

  // Benchmark state
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkReport | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);

  // Chrome Extension Modal state
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  // Handle browser popstate (back / forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getRouteFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Ref to track latest health status synchronously for immediate routing decisions
  const healthRef = useRef<string | null>(null);

  // Sync route changes with window.history, triggering wakeup modal if navigating to analyzer while backend is cold
  const navigateTo = (route: AppRoute) => {
    if (route === "analyzer" && healthRef.current !== "healthy") {
      setIsWakingUp(true);
      return;
    }

    const targetPath = route === "landing" ? "/" : `/${route}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWakeupReady = () => {
    setIsWakingUp(false);
    healthRef.current = "healthy";
    setHealth({
      status: "healthy",
      integrations: { storage_sqlite: true, dense_retrieval: true, nli_verification: true },
    });
    setHealthChecking(false);

    // Transition directly to the Analyzer workspace
    const targetPath = "/analyzer";
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
    setCurrentRoute("analyzer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let isMounted = true;

    // Query backend health immediately if user is on /analyzer or /benchmark or after page load
    const shouldCheckImmediately =
      window.location.pathname.startsWith("/analyzer") ||
      window.location.pathname.startsWith("/benchmark");

    const performHealthCheck = async () => {
      try {
        const res = await checkHealth();
        if (isMounted) {
          setHealth(res);
          healthRef.current = res.status;
          setHealthChecking(false);
        }
      } catch {
        if (isMounted) {
          setHealth({ status: "offline", integrations: {} });
          healthRef.current = "offline";
          setHealthChecking(false);
        }
      }

      try {
        const tavily = await getTavilyStatus();
        if (isMounted) setTavilyStatus(tavily);
      } catch {
        if (isMounted) setTavilyStatus(null);
      }
    };

    if (shouldCheckImmediately) {
      performHealthCheck();
    } else {
      setHealthChecking(false);
      // Soft background query for landing page status indicators
      performHealthCheck();
    }

    // Polling interval (every 30 seconds) to detect engine status changes
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        performHealthCheck();
      }
    }, 30000);

    // Initial check for cached benchmark to populate active evaluation session
    fetch("/cached_benchmark.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && isMounted) setBenchmarkResult(data);
      })
      .catch(() => {});

    // Inspect URL query parameters for direct report inspection from Chrome Extension
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const reportIdParam = urlParams.get("report_id");
      if (reportIdParam) {
        getAnalysis(reportIdParam)
          .then((loadedReport) => {
            if (loadedReport && isMounted) {
              setReport(loadedReport);
              setCurrentRoute("analyzer");
              if (loadedReport.claim_results && loadedReport.claim_results.length > 0) {
                setSelectedClaim(loadedReport.claim_results[0]);
              }
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAnalyze = async () => {
    if (!responseText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeResponse({
        prompt: prompt.trim() || undefined,
        response_text: responseText,
        context_documents: contextDocs.trim() ? [contextDocs.trim()] : undefined,
        enable_live_search: enableLiveSearch,
      });
      setReport(res);
      if (res.claim_results && res.claim_results.length > 0) {
        setSelectedClaim(res.claim_results[0]);
      } else {
        setSelectedClaim(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze response");
    } finally {
      setLoading(false);
    }
  };

  const handleRunBenchmark = async (scenarioCount: number = 5) => {
    setBenchmarking(true);
    setBenchError(null);
    try {
      const res = await runBenchmark(scenarioCount);
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchError(err.message || "Failed to run benchmark");
    } finally {
      setBenchmarking(false);
    }
  };

  const isLanding = currentRoute === "landing";

  return (
    <div
      className={`epoclaim-product-experience ${
        isLanding ? "experience-landing" : "experience-workspace"
      } route-${currentRoute}`}
    >
      {/* ──────────────────────────────────────────────────────────────────────────
          TWO DISTINCT VISUAL BACKGROUNDS:
          Landing: Immersive Dark Emerald Aurora Environment
          Workspace: Deep Charcoal Technical Canvas (NO Aurora)
          ────────────────────────────────────────────────────────────────────────── */}
      {isLanding ? <CinematicAuroraBackground /> : <WorkspaceBackground />}

      <div className="app-experience-container">
        {/* ──────────────────────────────────────────────────────────────────────────
            TWO DISTINCT HEADER ARCHITECTURES:
            Landing: NO NAVBAR across the top (Brand upper-left, Status upper-right only)
            Workspace: Compact technical header bar with back to overview & tool actions
            ────────────────────────────────────────────────────────────────────────── */}
        {isLanding ? (
          <LandingHeader
            engineOnline={health?.status === "healthy"}
            engineChecking={healthChecking}
            tavilyStatus={tavilyStatus}
            onNavigate={navigateTo}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
          />
        ) : (
          <WorkspaceHeader
            currentRoute={currentRoute}
            onNavigate={navigateTo}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            engineOnline={health?.status === "healthy"}
            engineChecking={healthChecking}
            tavilyStatus={tavilyStatus}
          />
        )}

        {/* Route View Router */}
        <main className="content-container">
          {currentRoute === "landing" && (
            <LandingHero
              onLaunchAnalyzer={() => navigateTo("analyzer")}
              onNavigateBenchmark={() => navigateTo("benchmark")}
              onNavigateDevelopers={() => navigateTo("developers")}
              onOpenExtensionInstall={() => {
                if (CHROME_EXTENSION_STORE_URL && CHROME_EXTENSION_STORE_URL.trim().length > 0) {
                  window.open(CHROME_EXTENSION_STORE_URL, "_blank", "noopener,noreferrer");
                } else {
                  setIsExtensionModalOpen(true);
                }
              }}
              benchmarkResult={benchmarkResult}
            />
          )}

          {currentRoute === "analyzer" && (
            <AnalyzerWorkspace
              prompt={prompt}
              setPrompt={setPrompt}
              responseText={responseText}
              setResponseText={setResponseText}
              contextDocs={contextDocs}
              setContextDocs={setContextDocs}
              enableLiveSearch={enableLiveSearch}
              setEnableLiveSearch={setEnableLiveSearch}
              loading={loading}
              error={error}
              report={report}
              selectedClaim={selectedClaim}
              setSelectedClaim={setSelectedClaim}
              tavilyStatus={tavilyStatus}
              presets={PRESET_SCENARIOS}
              onAnalyze={handleAnalyze}
              engineOnline={health?.status === "healthy"}
              engineChecking={healthChecking}
            />
          )}

          {currentRoute === "benchmark" && (
            <BenchmarkSuiteView
              benchmarking={benchmarking}
              benchmarkResult={benchmarkResult}
              benchError={benchError}
              onRunBenchmark={handleRunBenchmark}
            />
          )}

          {currentRoute === "developers" && (
            <DeveloperHubView />
          )}
        </main>

        {/* Cold-Start & Health Wakeup Modal */}
        <EngineStartupModal
          isOpen={isWakingUp}
          onReady={handleWakeupReady}
          onCancel={() => setIsWakingUp(false)}
        />

        {/* Chrome Extension Modal */}
        <ChromeExtensionModal
          isOpen={isExtensionModalOpen}
          onClose={() => setIsExtensionModalOpen(false)}
          onNavigateToAnalyzer={() => {
            setIsExtensionModalOpen(false);
            navigateTo("analyzer");
          }}
        />
      </div>
    </div>
  );
}

export default App;

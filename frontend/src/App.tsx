import { useState, useEffect } from "react";
import { checkHealth, analyzeResponse, runBenchmark, getTavilyStatus } from "./api";
import type { FinalReport, ClaimAnalysisDetail, BenchmarkReport, TavilyStatus } from "./types";
import { VelvetFabricBackground } from "./components/VelvetFabricBackground";
import { EpoClaimLogo } from "./components/EpoClaimLogo";
import { LandingHero } from "./components/LandingHero";
import { AnalyzerWorkspace } from "./components/AnalyzerWorkspace";
import { BenchmarkSuiteView } from "./components/BenchmarkSuiteView";

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

type AppRoute = "landing" | "analyzer" | "benchmark";

function getRouteFromPath(pathname: string): AppRoute {
  const clean = pathname.toLowerCase().replace(/\/+$/, "");
  if (clean === "/analyzer") return "analyzer";
  if (clean === "/benchmark") return "benchmark";
  return "landing";
}

export function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    getRouteFromPath(window.location.pathname)
  );

  const [health, setHealth] = useState<{ status: string; integrations: Record<string, boolean> } | null>(null);
  const [tavilyStatus, setTavilyStatus] = useState<TavilyStatus | null>(null);

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

  // Handle browser popstate (back / forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getRouteFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync route changes with window.history
  const navigateTo = (route: AppRoute) => {
    const targetPath = route === "landing" ? "/" : `/${route}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: "offline", integrations: {} }));

    getTavilyStatus()
      .then(setTavilyStatus)
      .catch(() => setTavilyStatus(null));
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

  const handleRunBenchmark = async () => {
    setBenchmarking(true);
    setBenchError(null);
    try {
      const res = await runBenchmark(5);
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchError(err.message || "Failed to run benchmark");
    } finally {
      setBenchmarking(false);
    }
  };

  return (
    <div className="epoclaim-app">
      {/* Velvet / Heavy Satin Textile Background with Directional Fold Sheen */}
      <VelvetFabricBackground />

      <div className="app-foreground-layout">
        {/* PART 1: Redesigned Header with Prominent Custom Logo */}
        <header className="global-header">
          <div
            className="header-brand-container"
            onClick={() => navigateTo("landing")}
            style={{ cursor: "pointer" }}
            title="EpoClaim — Temporal Verification Engine"
          >
            <EpoClaimLogo size={58} showWordmark={true} />
          </div>

          {/* Centered Glass Navigation */}
          <nav className="glass-nav-pill">
            <button
              className={`nav-link ${currentRoute === "landing" ? "active" : ""}`}
              onClick={() => navigateTo("landing")}
            >
              Overview
            </button>
            <button
              className={`nav-link ${currentRoute === "analyzer" ? "active" : ""}`}
              onClick={() => navigateTo("analyzer")}
            >
              Answer Analyzer
            </button>
            <button
              className={`nav-link ${currentRoute === "benchmark" ? "active" : ""}`}
              onClick={() => navigateTo("benchmark")}
            >
              Benchmark Suite
            </button>
            <a
              href="https://github.com/Souvik-Dey-2029/EpoClaim"
              target="_blank"
              rel="noreferrer"
              className="nav-link"
            >
              Documentation ↗
            </a>
          </nav>

          {/* Right Status Cluster */}
          <div className="header-status-cluster">
            <div className={`status-pill ${health?.status === "healthy" ? "healthy" : "offline"}`}>
              <span className="status-dot" />
              <span>{health?.status === "healthy" ? "Engine Live" : "Engine Offline"}</span>
            </div>
            {tavilyStatus?.configured && (
              <span className="tavily-pill">
                Tavily: {tavilyStatus.available_credits} Credits
              </span>
            )}
          </div>
        </header>

        {/* Route View Router */}
        <main className="content-container">
          {currentRoute === "landing" && (
            <LandingHero
              onLaunchAnalyzer={() => navigateTo("analyzer")}
              onNavigateBenchmark={() => navigateTo("benchmark")}
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
        </main>
      </div>
    </div>
  );
}

export default App;

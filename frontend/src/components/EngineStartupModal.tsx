import React, { useState, useEffect, useRef } from "react";
import { checkHealth } from "../api";
import "./EngineStartupModal.css";

interface EngineStartupModalProps {
  isOpen: boolean;
  onReady: () => void;
  onCancel: () => void;
  /** Max timeout in seconds before offering retry (default: 60s for Render free cold start) */
  timeoutSeconds?: number;
}

const ROTATING_MESSAGES = [
  "Establishing secure connection",
  "Waking verification engine",
  "Initializing temporal reasoning",
  "Preparing evidence pipeline",
  "Loading analyzer workspace",
  "Verification engine ready",
];

export const EngineStartupModal: React.FC<EngineStartupModalProps> = ({
  isOpen,
  onReady,
  onCancel,
  timeoutSeconds = 65,
}) => {
  const [progress, setProgress] = useState<number>(1);
  const [messageIndex, setMessageIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard against duplicate polling intervals or state leaks
  const pollingRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const isHealthyRef = useRef<boolean>(false);

  const cleanupTimers = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (messageTimerRef.current) {
      window.clearInterval(messageTimerRef.current);
      messageTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const startSequence = () => {
    cleanupTimers();
    setProgress(1);
    setMessageIndex(0);
    setElapsedSeconds(0);
    setIsTimedOut(false);
    setIsReady(false);
    setErrorMessage(null);
    isHealthyRef.current = false;

    // 1. Elapsed seconds counter
    const startTime = Date.now();
    elapsedTimerRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(sec);
      if (sec >= timeoutSeconds && !isHealthyRef.current) {
        setIsTimedOut(true);
        setErrorMessage(
          "Backend instance cold start is taking longer than expected. Render free web services take up to 60-90s to spin up."
        );
      }
    }, 1000);

    // 2. Smooth staged progress simulator (caps at 88% until backend responds)
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (isHealthyRef.current) return 100;
        if (prev < 30) return prev + 3;
        if (prev < 60) return prev + 2;
        if (prev < 85) return prev + 1;
        if (prev < 89) return prev + 0.3;
        return 89; // Hold near ~89% until verified healthy
      });
    }, 350);

    // 3. Rotating status messages
    messageTimerRef.current = window.setInterval(() => {
      setMessageIndex((prev) => {
        if (isHealthyRef.current) return ROTATING_MESSAGES.length - 1;
        return (prev + 1) % (ROTATING_MESSAGES.length - 1);
      });
    }, 3200);

    // 4. Initial immediate probe followed by recurring health polling
    const probe = async () => {
      if (isHealthyRef.current) return;
      try {
        const res = await checkHealth();
        if (res && res.status === "healthy") {
          isHealthyRef.current = true;
          setIsReady(true);
          setProgress(100);
          setMessageIndex(ROTATING_MESSAGES.length - 1);
          cleanupTimers();

          // Smooth brief pause at 100% so user sees completion before transition
          window.setTimeout(() => {
            onReady();
          }, 650);
        }
      } catch {
        // Expected during Render cold start spin-up; keep polling
      }
    };

    probe();
    pollingRef.current = window.setInterval(probe, 2500);
  };

  useEffect(() => {
    if (isOpen) {
      startSequence();
    } else {
      cleanupTimers();
    }
    return cleanupTimers;
  }, [isOpen]);

  if (!isOpen) return null;

  const currentMessage = isReady
    ? ROTATING_MESSAGES[ROTATING_MESSAGES.length - 1]
    : ROTATING_MESSAGES[messageIndex];

  return (
    <div
      className={`engine-startup-overlay ${isOpen ? "active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-title"
    >
      <div className="engine-startup-card">
        <button
          type="button"
          className="engine-startup-close-btn"
          onClick={onCancel}
          aria-label="Cancel startup"
          title="Return to website"
        >
          ✕
        </button>

        {/* Cinematic Glowing Beacon */}
        <div className="startup-beacon-container">
          <div className="startup-beacon-ring" />
          <div className="startup-beacon-ring delayed" />
          <div
            className={`startup-beacon-core ${
              isTimedOut ? "error" : isReady ? "ready" : ""
            }`}
          >
            {isReady ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isTimedOut ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            )}
          </div>
        </div>

        {/* Headings */}
        <h2 id="startup-title" className="startup-brand-title">
          EPOCLAIM
        </h2>
        <div className="startup-subheading">
          INITIALIZING TEMPORAL VERIFICATION ENGINE
        </div>

        {/* Staged illustrative progress indicator */}
        <div className="startup-progress-section">
          <div className="startup-pct-row">
            <div className="startup-status-phrase">
              <span className="startup-status-dot" />
              <span>{currentMessage}</span>
            </div>
            <span className="startup-pct-num">
              {Math.min(100, Math.floor(progress)).toString().padStart(2, "0")}%
            </span>
          </div>

          <div className="startup-track">
            <div
              className={`startup-fill ${isTimedOut ? "error" : ""}`}
              style={{ width: `${Math.min(100, Math.floor(progress))}%` }}
            />
          </div>
        </div>

        {/* Context description */}
        <p className="startup-info-note">
          EpoClaim evaluates temporal validity and chronological supersedence{" "}
          <span className="highlight">(T₂ &gt; T₁)</span>. On free cloud instances,
          inactive services spin down to conserve compute and spin up dynamically on demand.
        </p>

        {elapsedSeconds > 0 && !isTimedOut && !isReady && (
          <div className="startup-timer-tag">
            Connecting to backend... {elapsedSeconds}s elapsed
          </div>
        )}

        {/* Error / Timeout box with Retry & Bypass */}
        {isTimedOut && (
          <div className="startup-error-box">
            <p className="startup-error-msg">{errorMessage}</p>
            <div className="startup-btn-group">
              <button
                type="button"
                className="startup-retry-btn"
                onClick={startSequence}
              >
                ↻ Retry Wakeup Probe
              </button>
              <button
                type="button"
                className="startup-bypass-btn"
                onClick={onReady}
                title="Enter workspace and view offline features / benchmark"
              >
                Enter Offline Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default EngineStartupModal;


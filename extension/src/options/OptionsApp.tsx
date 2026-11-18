/**
 * EpoClaim Chrome Extension — Options Page Component
 */

import React, { useEffect, useState } from "react";
import type { ExtensionSettings, TavilyStatus } from "../shared/types.ts";
import { DEFAULT_SETTINGS, DEV_BACKEND_URL, PROD_BACKEND_URL } from "../shared/types.ts";
import { loadSettings, saveSettings } from "../shared/storage.ts";

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [tavilyStatus, setTavilyStatus] = useState<TavilyStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      // Attempt to load Tavily budget on startup
      const cleanUrl = s.backendUrl.replace(/\/+$/, "");
      fetch(`${cleanUrl}/api/v1/tavily/status`, {
        headers: s.apiKey ? { "X-API-Key": s.apiKey } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setTavilyStatus(data);
        })
        .catch(() => {});
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(settings);
    setSavedStatus("Settings saved successfully.");
    setTimeout(() => setSavedStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const cleanUrl = settings.backendUrl.replace(/\/+$/, "");
      const resp = await fetch(`${cleanUrl}/api/v1/health`, {
        headers: settings.apiKey ? { "X-API-Key": settings.apiKey } : {},
      });
      if (resp.ok) {
        const data = await resp.json();
        setTestStatus(`Connected successfully! Server: ${data.service} v${data.version}`);
        // Also fetch Tavily budget
        try {
          const tResp = await fetch(`${cleanUrl}/api/v1/tavily/status`, {
            headers: settings.apiKey ? { "X-API-Key": settings.apiKey } : {},
          });
          if (tResp.ok) {
            const tData = await tResp.json();
            setTavilyStatus(tData);
          }
        } catch {}
      } else {
        setTestStatus(`Failed: Server returned HTTP status ${resp.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStatus(`Connection error: ${msg}. Is the EpoClaim backend running?`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearData = async () => {
    if (confirm("Clear all cached tab session states and temporary verification logs?")) {
      if (chrome.storage?.session) {
        await chrome.storage.session.clear();
      }
      alert("Extension session data cleared.");
    }
  };

  return (
    <div className="options-container">
      <div className="header-row">
        <img src="icons/icon-48.png" alt="EpoClaim" className="header-icon" />
        <div>
          <h1 className="header-title">EpoClaim Configuration</h1>
          <p className="header-subtitle">
            Configure backend endpoints, API authentication, and verification preferences.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Setup Guide */}
        <div className="card">
          <h2 className="card-title">Getting Started</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="step" style={{ display: "flex", gap: "1rem" }}>
              <div className="step-number" style={{ background: "#34d399", color: "#000", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>1</div>
              <div>
                <div className="field-label">Install & Configure</div>
                <div className="field-desc">
                  Ensure the extension is loaded in Developer Mode. EpoClaim comes pre-configured with the production backend.
                </div>
              </div>
            </div>
            <div className="step" style={{ display: "flex", gap: "1rem" }}>
              <div className="step-number" style={{ background: "#34d399", color: "#000", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>2</div>
              <div>
                <div className="field-label">Verify Backend Status</div>
                <div className="field-desc">
                  Ensure the status says <strong>Connected</strong>. If not, use the <strong>Test Connection</strong> button below or click <strong>Reset to Production</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backend Connection */}
        <div className="card">
          <h2 className="card-title">Backend Connection</h2>

          <div className="field-group">
            <label className="field-label" htmlFor="backend-url">
              EpoClaim Service Base URL
            </label>
            <span className="field-desc">
              Specify your local or remote FastAPI service.
            </span>
            <input
              id="backend-url"
              className="input-text"
              type="text"
              value={settings.backendUrl}
              onChange={(e) => setSettings({ ...settings, backendUrl: e.target.value })}
              required
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                onClick={() => setSettings({ ...settings, backendUrl: DEV_BACKEND_URL })}
              >
                Local Engine (localhost:8000)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                onClick={() => setSettings({ ...settings, backendUrl: PROD_BACKEND_URL })}
              >
                Production Cloud (Render)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderColor: "#fca5a5", color: "#fca5a5" }}
                onClick={() => setSettings({ ...settings, backendUrl: PROD_BACKEND_URL })}
              >
                Reset to Production
              </button>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="api-key">
              Developer API Key (Optional)
            </label>
            <span className="field-desc">
              Optional Bearer / X-API-Key token for secured server deployments.
            </span>
            <input
              id="api-key"
              className="input-text"
              type="password"
              placeholder="epoclaim_sec_..."
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </button>
            {testStatus && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: testStatus.startsWith("Connected") ? "#34d399" : "#f87171",
                }}
              >
                {testStatus}
              </span>
            )}
          </div>
        </div>

        {/* Verification Preferences */}
        <div className="card">
          <h2 className="card-title">Verification Preferences</h2>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.autoVerifyOnComplete}
              onChange={(e) => setSettings({ ...settings, autoVerifyOnComplete: e.target.checked })}
            />
            <div>
              <div className="field-label">Automatic Verification When Completed</div>
              <div className="field-desc">
                When enabled, newly completed AI answers on monitored tabs will automatically be verified.
              </div>
            </div>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.enableLiveSearch}
              onChange={(e) => setSettings({ ...settings, enableLiveSearch: e.target.checked })}
            />
            <div>
              <div className="field-label">Enable Live Web Retrieval (Tavily)</div>
              <div className="field-desc">
                Enables backend live web search to ground claims against the latest online evidence.
              </div>
            </div>
          </label>

          <div className="field-group" style={{ marginTop: 4 }}>
            <label className="field-label" htmlFor="debounce-ms">
              Streaming Debounce Window (Milliseconds)
            </label>
            <span className="field-desc">
              Quiet period before taking completion snapshots (default: 900ms).
            </span>
            <input
              id="debounce-ms"
              className="input-text"
              type="number"
              min={400}
              max={3000}
              step={100}
              style={{ width: 140 }}
              value={settings.debounceMs}
              onChange={(e) => setSettings({ ...settings, debounceMs: parseInt(e.target.value, 10) || 900 })}
            />
          </div>
          {tavilyStatus && (
            <div style={{ marginTop: "1rem", padding: "0.85rem", background: "rgba(6, 27, 19, 0.7)", borderRadius: "8px", border: "1px solid rgba(52, 211, 153, 0.3)" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#34d399", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>🌐 Tavily Search Credit Ledger</span>
                <span style={{ fontSize: "0.72rem", color: "#a8a29e" }}>Active Budget Quota</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
                <div style={{ background: "rgba(52, 211, 153, 0.12)", padding: "6px 8px", borderRadius: "6px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: "#a8a29e", textTransform: "uppercase" }}>Available</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399" }}>
                    {tavilyStatus.available_credits.toLocaleString()} / {tavilyStatus.budget_cap.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: "rgba(240, 229, 206, 0.08)", padding: "6px 8px", borderRadius: "6px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: "#a8a29e", textTransform: "uppercase" }}>Consumed</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f0e5ce" }}>
                    {tavilyStatus.consumed_credits.toLocaleString()}
                  </div>
                </div>
                <div style={{ background: "rgba(233, 166, 92, 0.1)", padding: "6px 8px", borderRadius: "6px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: "#a8a29e", textTransform: "uppercase" }}>Cache Hits</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e9a65c" }}>
                    {tavilyStatus.cache_hits.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save button and status */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button type="submit" className="btn-primary">
            Save Preferences
          </button>
          {savedStatus && <span style={{ color: "#34d399", fontWeight: 600 }}>{savedStatus}</span>}
        </div>
      </form>

      {/* Privacy and Data Disclosure */}
      <div className="privacy-banner">
        <h3 style={{ color: "#e9a65c", fontSize: "0.85rem", marginBottom: 6, fontWeight: 700 }}>
          🔒 Privacy & Data Minimization Commitment
        </h3>
        <p>
          • <strong>Local Scoping:</strong> EpoClaim only monitors explicitly supported AI platforms (ChatGPT and Google Gemini) when the user actively turns monitoring ON.
        </p>
        <p style={{ marginTop: 4 }}>
          • <strong>Assistant Only:</strong> Only assistant-generated responses are inspected and verified. Private prompts are not collected into permanent storage.
        </p>
        <p style={{ marginTop: 4 }}>
          • <strong>Zero Background Tracking:</strong> Unrelated browser tabs, browsing history, cookies, and personal credentials are never accessed or transmitted.
        </p>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={handleClearData}>
            Clear Temporary Session Data
          </button>
        </div>
      </div>
    </div>
  );
}

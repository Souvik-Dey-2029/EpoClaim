import { useEffect, useRef, useState } from "react";
import {
  CHROME_EXTENSION_STORE_URL,
  CHROME_EXTENSION_PACKAGE_URL,
  CHROME_EXTENSION_DOCS_URL,
} from "../config";

export function ChromeIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2C14.28 2 16.36 2.77 18.03 4.07L13.89 11.24C13.34 10.48 12.45 10 11.46 10H4.35C5.83 5.34 10.15 2 12 2Z"
        fill="#EA4335"
      />
      <path
        d="M21.95 11.37C21.98 11.58 22 11.79 22 12C22 16.91 18.42 21 13.71 21.84L9.58 14.67C9.92 15.26 10.45 15.72 11.08 15.93C11.71 16.14 12.4 16.09 13 15.79L20.12 11.68C20.84 11.26 21.46 10.72 21.95 10.08L21.95 11.37Z"
        fill="#34A853"
      />
      <path
        d="M9.58 14.67L5.45 21.84C2.31 20.08 2 16.34 2 12C2 9.09 3.25 6.46 5.27 4.63L9.4 11.79C8.85 12.34 8.7 13.16 9.01 13.86C9.13 14.16 9.33 14.44 9.58 14.67Z"
        fill="#FBBC05"
      />
      <circle cx="12" cy="12" r="3.5" fill="#4285F4" />
      <circle cx="12" cy="12" r="4.25" stroke="#FFFFFF" strokeWidth="1.25" />
    </svg>
  );
}

export function ChromeExtensionModal({
  isOpen,
  onClose,
  onNavigateToAnalyzer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToAnalyzer?: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showDesktopStepsOnMobile, setShowDesktopStepsOnMobile] = useState(false);

  const isStoreConfigured = Boolean(
    CHROME_EXTENSION_STORE_URL && CHROME_EXTENSION_STORE_URL.trim().length > 0
  );

  // Check mobile viewport on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunchMobileWorkspace = () => {
    onClose();
    if (onNavigateToAnalyzer) {
      onNavigateToAnalyzer();
    } else {
      window.history.pushState(null, "", "/analyzer");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      className="extension-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ext-modal-title"
    >
      <div className="extension-modal-card" ref={modalRef} tabIndex={-1}>
        {/* Modal Header */}
        <div className="extension-modal-header">
          <div className="modal-title-cluster">
            <div className="chrome-badge-box">
              <ChromeIcon size={26} />
            </div>
            <div>
              <h2 id="ext-modal-title" className="extension-modal-title">
                {isMobile ? "EpoClaim Browser Verification" : "Get EpoClaim for Google Chrome"}
              </h2>
              <span className="extension-modal-sub mono-label">
                {isMobile ? "MOBILE COMPATIBILITY NOTICE" : "MANIFEST V3 • CHATGPT & GEMINI REAL-TIME VERIFICATION"}
              </span>
            </div>
          </div>
          <button
            className="extension-modal-close-btn"
            onClick={onClose}
            aria-label="Close installation dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="extension-modal-body">
          {/* Mobile Specific Honest Advisory */}
          {isMobile && (
            <div className="modal-mobile-advisory-card">
              <div className="advisory-icon-row">
                <span className="advisory-badge mono-label">DESKTOP BROWSER EXTENSION</span>
              </div>
              <h3 className="advisory-title">Extensions Require Desktop Chrome</h3>
              <p className="advisory-body">
                The EpoClaim Chrome Extension is engineered for desktop Chrome (Manifest V3) to audit ChatGPT and Google Gemini browser sessions in real-time. Standard mobile browsers (iOS Safari, mobile Chrome) do not support browser extensions.
              </p>
              <div className="advisory-solution-box">
                <p className="solution-text">
                  You can verify any AI answer directly on mobile right now using the <strong>Web Verification Workspace</strong>.
                </p>
                <button
                  type="button"
                  className="btn-use-mobile-workspace"
                  onClick={handleLaunchMobileWorkspace}
                >
                  <span>Use EpoClaim on Mobile ➔</span>
                </button>
              </div>

              <button
                type="button"
                className="btn-toggle-desktop-instructions mono-label"
                onClick={() => setShowDesktopStepsOnMobile(!showDesktopStepsOnMobile)}
              >
                {showDesktopStepsOnMobile ? "Hide Desktop Instructions ▴" : "View Desktop Installation Instructions ▾"}
              </button>
            </div>
          )}

          {/* Desktop Installation Guide (Always shown on desktop; toggleable on mobile) */}
          {(!isMobile || showDesktopStepsOnMobile) && (
            <>
              {isStoreConfigured ? (
                /* Option A: Official Web Store Listing */
                <div className="modal-webstore-action-box">
                  <p className="modal-prose">
                    Install EpoClaim directly from the official Chrome Web Store to verify AI responses
                    inside ChatGPT and Google Gemini without manual copying.
                  </p>
                  <a
                    href={CHROME_EXTENSION_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-webstore-install"
                  >
                    <ChromeIcon size={20} />
                    <span>Add to Chrome from Web Store</span>
                    <span className="btn-arrow">↗</span>
                  </a>
                </div>
              ) : (
                /* Option B: Developer Preview / Manual Packaged Installation */
                <div className="modal-developer-preview-box">
                  <div className="preview-status-banner">
                    <span className="preview-pulse-dot" />
                    <span className="preview-tag mono-label">DEVELOPER PREVIEW &bull; READY TO RUN</span>
                  </div>

                  <p className="modal-prose">
                    The official Chrome Web Store submission is currently in review. You can install the complete,
                    fully-functional packaged extension now using Chrome's <strong>Developer Mode</strong>.
                  </p>

                  {/* Download Package Action */}
                  <div className="download-cta-strip">
                    <a
                      href={CHROME_EXTENSION_PACKAGE_URL}
                      download="epoclaim-chrome-extension.zip"
                      className="btn-download-extension"
                    >
                      <span className="dl-icon">⬇</span>
                      <span>Download Extension Package (.ZIP)</span>
                      <span className="dl-badge mono-label">v1.0.0</span>
                    </a>
                  </div>

                  {/* 4-Step Installation Guide */}
                  <div className="manual-steps-container">
                    <span className="steps-header-title mono-label">QUICK 4-STEP INSTALLATION GUIDE:</span>

                    <ol className="manual-steps-list">
                      <li className="manual-step-item">
                        <span className="step-num mono-label">01</span>
                        <div className="step-content">
                          <strong>Download and extract</strong> the ZIP archive to a folder on your computer (or locate the pre-built <code>extension/dist</code> directory).
                        </div>
                      </li>

                      <li className="manual-step-item">
                        <span className="step-num mono-label">02</span>
                        <div className="step-content">
                          Open Google Chrome and navigate to:
                          <div className="step-code-pill">
                            <code>chrome://extensions/</code>
                            <button
                              type="button"
                              className="step-copy-btn mono-label"
                              onClick={() => navigator.clipboard.writeText("chrome://extensions/")}
                              title="Copy address to clipboard"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </li>

                      <li className="manual-step-item">
                        <span className="step-num mono-label">03</span>
                        <div className="step-content">
                          Enable the <strong>Developer mode</strong> toggle switch in the top-right corner of the extensions page.
                        </div>
                      </li>

                      <li className="manual-step-item">
                        <span className="step-num mono-label">04</span>
                        <div className="step-content">
                          Click the <strong>Load unpacked</strong> button and select the extracted extension folder. EpoClaim will immediately appear in your browser toolbar!
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="extension-modal-footer">
          <div className="modal-footer-compat mono-label">
            COMPATIBLE WITH CHATGPT (OPENAI) &bull; GOOGLE GEMINI &bull; LOCAL FASTAPI ENGINE
          </div>
          <div className="modal-footer-actions">
            <a
              href={CHROME_EXTENSION_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="modal-footer-link mono-label"
            >
              Developer Docs ↗
            </a>
            <button type="button" className="modal-footer-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

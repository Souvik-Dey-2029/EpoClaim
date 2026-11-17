import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EpoClaim SidePanel] Uncaught component error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            backgroundColor: "#09271d",
            color: "#f2e8d2",
            minHeight: "100vh",
            padding: "1.5rem",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 8,
              padding: "1rem",
              color: "#fca5a5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>⚠️</span>
              <h3 style={{ margin: 0, color: "#f87171", fontSize: "0.95rem" }}>
                Side Panel Rendering Error
              </h3>
            </div>
            <p style={{ fontSize: "0.82rem", margin: "0 0 1rem 0", lineHeight: 1.4 }}>
              {this.state.error?.message || "An unexpected error occurred while rendering the side panel."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: "#d97745",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "0.45rem 0.9rem",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              Reload Side Panel
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


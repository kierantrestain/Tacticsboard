import React from "react";
import { createRoot } from "react-dom/client";
import App from "./studio/StudioApp";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./styles.css";
import "./studio/studio.css";
import "./football/football.css";
import "./studio/show.css";
import "./studio/director.css";
import "./studio/filming.css";
import "./studio/workspaceCleanup.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="error-screen">
        <div className="brand-symbol">TL</div>
        <h1>Let’s recover the workspace.</h1>
        <p>Your last saved analysis remains in this browser.</p>
        <button onClick={() => location.reload()}>Reload studio</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

import './football/intelligence.css';
import './studio/theme.css';

import './football/dataWorkspace.css';
import './studio/analysisUpgrade.css';

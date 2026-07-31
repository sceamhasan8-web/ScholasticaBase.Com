import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';

const isNativeApp = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' ||
  navigator.userAgent.includes('Electron') ||
  window.Capacitor !== undefined
);
const RouterComponent = isNativeApp ? HashRouter : BrowserRouter;
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { registerServiceWorker } from './registerServiceWorker.js';

import './styles.css';
import './responsive.css';
import './navbar-responsive.css';
import './mobile-tablet.css';
import './desktop-theme.css';
import './ResponsivePortalGlobal.css';
import './print-engine.css';

// ─────────────────────────────────────────────────────────────
// SAFE DOM REMOVECHILD / INSERTBEFORE PATCH (Google Translate & Extension Defense)
// ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      console.warn('[DOM Safe Patch] Prevented removeChild crash: node is not a child of parent', child, this);
      if (child.parentNode) {
        return child.parentNode.removeChild(child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[DOM Safe Patch] Prevented insertBefore crash: reference node is not a child of parent', referenceNode, this);
      return this.appendChild(newNode);
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

console.log('🚀 [STAGE 1/6] main.jsx script started executing');

function renderFatalErrorUI(title, message, stack) {
  const rootEl = document.getElementById('root') || document.body;
  if (!rootEl) return;

  rootEl.innerHTML = `
    <div style="
      min-height: 100vh;
      background-color: #0f172a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      box-sizing: border-box;
    ">
      <div style="
        max-width: 650px;
        width: 100%;
        background-color: #1e293b;
        padding: 2rem;
        border-radius: 12px;
        border: 1px solid #dc2626;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      ">
        <h2 style="color: #ef4444; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
          <span>⚠️</span> ${title}
        </h2>
        <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">
          An uncaught JavaScript error occurred before or during application initialization:
        </p>
        <div style="
          background-color: #0f172a;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #334155;
          color: #f87171;
          font-family: monospace;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.9rem;
        ">
          ${message || 'Unknown Pre-Mount Error'}
          ${stack ? `<hr style="border-color:#334155; margin: 10px 0;"><div style="color:#64748b; font-size: 0.8rem;">${stack}</div>` : ''}
        </div>
        <button onclick="window.location.reload()" style="
          margin-top: 1.5rem;
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
        ">Reload Application</button>
      </div>
    </div>
  `;
}

function isDOMNotFoundError(msg) {
  if (!msg) return false;
  const str = String(msg).toLowerCase();
  return str.includes('removechild') || str.includes('insertbefore') || str.includes('not a child of this node');
}

window.addEventListener('error', (event) => {
  const errorMsg = event.message || (event.error && event.error.toString());
  if (isDOMNotFoundError(errorMsg)) {
    console.warn('⚠️ Ignored non-fatal DOM unmount error in global handler:', errorMsg);
    return;
  }
  console.error('🚨 Global Error Listener Caught:', event.error || event.message);
  renderFatalErrorUI(
    'Pre-Mount Execution Error',
    errorMsg,
    event.error && event.error.stack
  );
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason);
  if (isDOMNotFoundError(msg)) {
    console.warn('⚠️ Ignored non-fatal DOM unmount rejection:', msg);
    return;
  }
  console.error('🚨 Unhandled Promise Rejection Listener Caught:', event.reason);
  const stack = event.reason?.stack;
  renderFatalErrorUI('Unhandled Async Rejection', msg, stack);
});

try {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Fatal Initialization Failure: Could not locate <div id="root"></div> in index.html');
  }

  console.log('🚀 [STAGE 2/6] Calling ReactDOM.createRoot and mounting <App />');
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <RouterComponent>
          <App />
        </RouterComponent>
      </ErrorBoundary>
    </React.StrictMode>
  );

  console.log('✅ [STAGE 6/6] ReactDOM.createRoot initiated successfully');
  registerServiceWorker();
} catch (err) {
  console.error('🔥 Fatal React Root Creation Failure:', err);
  renderFatalErrorUI('Fatal Mount Error', err.message, err.stack);
}

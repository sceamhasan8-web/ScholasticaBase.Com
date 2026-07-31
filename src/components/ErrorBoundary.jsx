import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("🔥 ErrorBoundary caught an unhandled rendering error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '650px',
            width: '100%',
            backgroundColor: '#1e293b',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>⚠️</span>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#f87171' }}>Something went wrong</h2>
            </div>
            
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              An uncaught error occurred while rendering this component. Below are the details to help you debug:
            </p>

            <div style={{
              backgroundColor: '#0f172a',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #334155',
              overflowX: 'auto',
              marginBottom: '1.25rem'
            }}>
              <p style={{ color: '#ef4444', fontFamily: 'monospace', margin: 0, fontWeight: '600' }}>
                {this.state.error && this.state.error.toString()}
              </p>
              {this.state.errorInfo && (
                <details style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#38bdf8', marginBottom: '0.5rem' }}>View Component Stack Trace</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, color: '#94a3b8' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s'
                }}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

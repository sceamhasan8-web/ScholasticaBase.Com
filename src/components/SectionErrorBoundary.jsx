import React from 'react';

export default class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`🔥 SectionErrorBoundary caught error in section "${this.props.sectionName || 'Component'}":`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '1.5rem',
            margin: '1rem 0',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#f8fafc',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#ef4444', fontWeight: '700' }}>
                Unable to load {this.props.sectionName || 'this component'}
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                A temporary error occurred while rendering this section.
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#fca5a5',
              wordBreak: 'break-word',
              marginBottom: '1rem',
            }}
          >
            {this.state.error?.toString() || 'Unknown Component Exception'}
          </div>

          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'background-color 0.2s ease',
            }}
          >
            🔄 Reload Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

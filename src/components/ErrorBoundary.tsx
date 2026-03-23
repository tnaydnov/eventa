'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            padding: '32px',
            textAlign: 'center',
            gap: '16px',
            direction: 'rtl',
          }}
        >
          <div style={{ fontSize: '48px' }} aria-hidden="true">😵</div>
          <h1 style={{ fontSize: '20px', color: '#e91e63', margin: 0 }}>
            אופס, משהו השתבש
          </h1>
          <p style={{ color: '#8892b0', fontSize: '14px', maxWidth: '280px' }}>
            קרתה שגיאה לא צפויה. נסו לרענן את הדף.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 32px',
              minHeight: '44px',
              background: '#e91e63',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            רענון
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

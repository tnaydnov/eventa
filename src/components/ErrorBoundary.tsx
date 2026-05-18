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

interface SessionLike {
  eventId?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private getEventIdFromSession(): string | undefined {
    try {
      const raw = localStorage.getItem('ws_session');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as SessionLike;
      return typeof parsed.eventId === 'string' ? parsed.eventId : undefined;
    } catch {
      return undefined;
    }
  }

  private postClientError(payload: {
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
  }) {
    const body = JSON.stringify({
      ...payload,
      event_id: this.getEventIdFromSession(),
      url: payload.url ?? window.location.pathname,
    });

    const endpoint = '/api/telemetry/error';
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* non-critical */ });
  }

  private handleWindowError = (event: ErrorEvent) => {
    this.postClientError({
      message: event.message || 'window.error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
      url: window.location.pathname,
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';

    this.postClientError({
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
      url: window.location.pathname,
    });
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.postClientError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      url: window.location.pathname,
    });
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

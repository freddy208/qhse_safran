import { Component, ErrorInfo, ReactNode } from 'react';

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erreur inattendue' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', padding: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: '40px 48px', maxWidth: 500, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            Une erreur est survenue
          </div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
            Une erreur inattendue a interrompu cette page.<br />
            Vos données sont sauvegardées — vous pouvez revenir en arrière.
          </div>
          {this.state.message && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
              padding: '10px 14px', fontSize: 13, color: '#991b1b',
              marginBottom: 24, textAlign: 'left', fontFamily: 'monospace',
            }}>
              {this.state.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.history.back(); }}
              style={{
                padding: '10px 22px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#374151',
              }}
            >
              ← Retour
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '10px 22px', borderRadius: 6, border: 'none',
                background: '#003087', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff',
              }}
            >
              Tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }
}

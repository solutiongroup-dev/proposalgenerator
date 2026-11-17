import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginGate from './Login.jsx'

// If the app ever crashes while rendering, show a way back instead of a blank page.
// Work in progress is autosaved (src/draft.js), so reloading restores it.
class CrashGuard extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>
        <h1 style={{ color: '#2B579A', fontSize: 26, marginBottom: 10 }}>Something went wrong</h1>
        <p style={{ color: '#4a5568', fontSize: 15, lineHeight: 1.6 }}>
          Your work is saved. Reload the page to pick up where you left off.
        </p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 18, background: '#2B579A', color: 'white', border: 'none', borderRadius: 6, padding: '12px 26px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Reload and restore my work
        </button>
        <p style={{ color: '#9aa5b4', fontSize: 12, marginTop: 24 }}>If this keeps happening, send Chase a screenshot of this message: {String(this.state.error?.message || this.state.error).slice(0, 200)}</p>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CrashGuard>
      <LoginGate>
        <App />
      </LoginGate>
    </CrashGuard>
  </React.StrictMode>,
)

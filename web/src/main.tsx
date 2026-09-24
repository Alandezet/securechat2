import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/dm-sans'
import App from './App'
import './styles.css'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <main className="fatal-error"><img src="/icon.svg" width="64" alt="Cipher"/><h1>Let’s start fresh.</h1><p>Cipher couldn’t open this workspace. Reload to try again. Your encrypted account data is still on the relay.</p><button onClick={() => location.reload()}>Reload Cipher</button></main> : this.props.children }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>)


import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfigScreen from './components/ConfigScreen.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { supabaseConfigMissing } from './supabaseClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>{supabaseConfigMissing ? <ConfigScreen /> : <App />}</ErrorBoundary>
  </React.StrictMode>,
)
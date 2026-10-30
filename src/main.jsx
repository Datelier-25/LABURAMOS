
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ConfigScreen from './components/ConfigScreen.jsx'
import { supabaseConfigMissing } from './supabaseClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {supabaseConfigMissing ? <ConfigScreen /> : <App />}
  </React.StrictMode>,
)
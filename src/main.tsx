import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './lib/auth'
import { LicenceProvider } from './lib/licence'
import { ThemeProvider } from './lib/theme'
import { SuperAdminProvider } from './lib/superAdminAuth'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <SuperAdminProvider>
      <AuthProvider>
        <LicenceProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' }
          }}
        />
        </LicenceProvider>
      </AuthProvider>
      </SuperAdminProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)

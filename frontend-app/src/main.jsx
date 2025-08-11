import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import './index.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                color: '#f8fafc',
                border: '1px solid #00d4ff20',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 212, 255, 0.1)',
                fontFamily: 'monospace',
                fontSize: '14px',
              },
              success: {
                duration: 3000,
                style: {
                  background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                  color: '#00ff88',
                  border: '1px solid #00ff8830',
                  boxShadow: '0 4px 20px rgba(0, 255, 136, 0.2)',
                },
              },
              error: {
                duration: 4000,
                style: {
                  background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ff4444',
                  border: '1px solid #ff444430',
                  boxShadow: '0 4px 20px rgba(255, 68, 68, 0.2)',
                },
              },
            }}
          />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
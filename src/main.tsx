import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster 
      theme="dark" 
      position="top-right" 
      richColors 
      closeButton 
      toastOptions={{
        style: { background: '#1a1b1f', border: '1px solid #2d2e33', color: '#fff' },
      }}
    />
  </StrictMode>,
)

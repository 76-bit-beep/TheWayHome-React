
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'

const isAdminPage = window.location.pathname.replace(/\/+$/, '').endsWith('/admin')

const loadPage = async () => {
  const {default: Page} = isAdminPage
    ? await import('./components/AdminLogin.jsx')
    : await import('./App.jsx')

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Page />
    </StrictMode>
  )
}

loadPage()

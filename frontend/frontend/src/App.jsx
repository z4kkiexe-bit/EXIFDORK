import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage.jsx'
import { RegisterPage } from './pages/RegisterPage.jsx'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3999'

// Dev only: set VITE_SKIP_AUTH=true in .env to see the main page without a backend.
const SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === 'true'

function App() {
  // 'checking' -> asking the backend, 'out' -> show register, 'in' -> show the app
  const [sAuth, setAuth] = useState(SKIP_AUTH ? 'in' : 'checking')

  // On every page load the browser sends the cookie to /api/me.
  // Backend answers 200 if the cookie is valid, 401 if not.
  useEffect(() => {
    if (SKIP_AUTH) return undefined

    const oController = new AbortController()

    fetch(`${API_URL}/api/me`, {
      credentials: 'include',
      signal: oController.signal
    })
      .then((oResponse) => setAuth(oResponse.ok ? 'in' : 'out'))
      .catch((oError) => {
        if (oError.name !== 'AbortError') setAuth('out') // backend down = not signed in
      })

    return () => oController.abort()
  }, [])

  if (sAuth === 'checking') return null

  if (sAuth === 'out') {
    return <RegisterPage onRegistered={() => setAuth('in')} />
  }

  return <HomePage />
}

export default App
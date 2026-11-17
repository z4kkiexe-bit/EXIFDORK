import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage.jsx'
import { RegisterPage } from './pages/RegisterPage.jsx'
import './App.css'


// Dev only: set VITE_SKIP_AUTH=true in .env to see the main page without a backend.
// (Uploads need a valid session, so inspecting a file still requires registering.)
const SKIP_AUTH = import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === 'true'

function App() {
  // 'checking' -> asking the backend, 'out' -> show register, 'in' -> show the app
  const [sAuth, setAuth] = useState(SKIP_AUTH ? 'in' : 'checking')
  const [isSlow, setIsSlow] = useState(false)

  // On every page load the browser sends the cookie to /api/me.
  // Backend answers 200 if the cookie is valid, 401 if not.
  useEffect(() => {
    if (SKIP_AUTH) return undefined

    const oController = new AbortController()

    fetch(`/api/me`, {
      credentials: 'include',
      signal: oController.signal
    })
      .then((oResponse) => setAuth(oResponse.ok ? 'in' : 'out'))
      .catch((oError) => {
        if (oError.name !== 'AbortError') setAuth('out') // backend down = not signed in
      })

    return () => oController.abort()
  }, [])

  // Free hosting sleeps when idle; tell the user instead of showing a blank page.
  useEffect(() => {
    if (sAuth !== 'checking') return undefined

    const oTimer = setTimeout(() => setIsSlow(true), 1500)

    return () => clearTimeout(oTimer)
  }, [sAuth])

  if (sAuth === 'checking') {
    return isSlow ? (
      <div
        role="status"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '0 24px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 14
        }}
      >
        Waking up the server… this can take up to a minute.
      </div>
    ) : null
  }

  if (sAuth === 'out') {
    return <RegisterPage onRegistered={() => setAuth('in')} />
  }

  return <HomePage />
}

export default App

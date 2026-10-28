import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import './LoginPage.css'

/* ------------------------------------------------------------------ *
 *  CONFIG
 *  - API_URL: where your backend lives.
 *  - SITE_KEY: the PUBLIC Turnstile site key (safe to ship to the browser).
 *    The SECRET key must only ever live on your backend.
 *    In dev we fall back to Cloudflare's "always passes" test key.
 * ------------------------------------------------------------------ */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3888'
const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  (import.meta.env.DEV ? '1x00000000000000000000AA' : '')

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Loads the Cloudflare script once, no matter how many times the page mounts.
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  if (!loadTurnstile.oPromise) {
    loadTurnstile.oPromise = new Promise((resolve, reject) => {
      const oScript = document.createElement('script')
      oScript.src = TURNSTILE_SRC
      oScript.async = true
      oScript.defer = true
      oScript.onload = () => resolve(window.turnstile)
      oScript.onerror = () => {
        loadTurnstile.oPromise = null
        reject(new Error('Could not load the Cloudflare check. Check your connection and reload.'))
      }
      document.head.appendChild(oScript)
    })
  }

  return loadTurnstile.oPromise
}

// Follows the light/dark switch in the navbar (it sets data-theme on <html>).
function useThemeName() {
  const [sTheme, setTheme] = useState('light')

  useEffect(() => {
    const oRoot = document.documentElement
    const read = () => setTheme(oRoot.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')

    read()

    const oObserver = new MutationObserver(read)
    oObserver.observe(oRoot, { attributes: true, attributeFilter: ['data-theme'] })

    return () => oObserver.disconnect()
  }, [])

  return sTheme
}

function LoginPage() {
  const sTheme = useThemeName()
  const turnstileBoxRef = useRef(null)
  const widgetIdRef = useRef(null)

  // ---- USER INPUT LIVES HERE ------------------------------------------
  const [oForm, setForm] = useState({
    identifier: '', // email or username
    password: '',
    remember: false // "keep me signed in"
  })
  // ---------------------------------------------------------------------

  const [sToken, setToken] = useState('') // Turnstile token, one use only
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sError, setError] = useState(null)

  function updateField(sName, value) {
    setForm((oPrev) => ({ ...oPrev, [sName]: value }))
  }

  // 1) "Am I already logged in?" -> ask the backend, the browser attaches the cookie.
  //    Your backend must answer 200 when the cookie is valid and 401 when it is not.
  useEffect(() => {
    const oController = new AbortController()

    fetch(`${API_URL}/api/me`, {
      credentials: 'include',
      signal: oController.signal
    })
      .then((oResponse) => {
        if (oResponse.ok) window.location.replace('/')
      })
      .catch(() => {
        // backend not running yet, or not logged in: just show the form
      })

    return () => oController.abort()
  }, [])

  // 2) Render the Cloudflare widget (re-render when the theme changes).
  useEffect(() => {
    if (!SITE_KEY) {
      setError('Missing VITE_TURNSTILE_SITE_KEY. Add it to your .env file.')
      return undefined
    }

    let bCancelled = false
    let nWidgetId = null

    loadTurnstile()
      .then((oTurnstile) => {
        if (bCancelled || !turnstileBoxRef.current) return

        nWidgetId = oTurnstile.render(turnstileBoxRef.current, {
          sitekey: SITE_KEY,
          theme: sTheme,
          callback: (sValue) => setToken(sValue),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken('')
        })
        widgetIdRef.current = nWidgetId
      })
      .catch((oError) => setError(oError.message))

    return () => {
      bCancelled = true
      setToken('')

      if (nWidgetId !== null && window.turnstile) {
        window.turnstile.remove(nWidgetId)
      }
      widgetIdRef.current = null
    }
  }, [sTheme])

  function resetTurnstile() {
    setToken('')

    if (widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) return

    const sIdentifier = oForm.identifier.trim()

    if (!sIdentifier || !oForm.password) {
      setError('Enter your email or username and your password.')
      return
    }

    if (!sToken) {
      setError('Please wait for the Cloudflare check to finish.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // ================= BACKEND HOOK =================
      // POST {API_URL}/api/login
      // JSON body:
      //   identifier     string   email or username
      //   password       string   plain text over HTTPS; the backend hashes/compares it
      //   remember       boolean  true = long-lived cookie, false = session cookie
      //   turnstileToken string   verify this on the backend with your SECRET key
      // Success: 200 + a Set-Cookie header (the browser stores it for you).
      // Failure: 4xx + JSON { "error": "message to show the user" }
      // ================================================
      const oResponse = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // required, or the browser ignores Set-Cookie
        body: JSON.stringify({
          identifier: sIdentifier,
          password: oForm.password,
          remember: oForm.remember,
          turnstileToken: sToken
        })
      })

      const oData = await oResponse.json().catch(() => ({}))

      if (!oResponse.ok) {
        throw new Error(oData.error || 'Login failed. Please try again.')
      }

      window.location.assign('/')
    } catch (oError) {
      setError(
        oError instanceof TypeError
          ? 'Cannot reach the server. Is the backend running?'
          : oError.message
      )
      resetTurnstile() // a Turnstile token can only be used once
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = Boolean(sToken) && !isSubmitting

  return (
    <div className="login-page">
      <Navbar />

      <main className="login-main">
        <div className="login-intro">
          <div className="login-eyebrow">
            <span className="login-status-dot" />
            SIGN IN
          </div>
          <h1>
            Welcome to <span>Doxxer</span>
          </h1>
          <p className="login-description">Sign in to continue.</p>
        </div>

        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="login-identifier">Email or username</label>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              value={oForm.identifier}
              onChange={(event) => updateField('identifier', event.target.value)}
              aria-invalid={Boolean(sError)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={oForm.password}
                onChange={(event) => updateField('password', event.target.value)}
                aria-invalid={Boolean(sError)}
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((bValue) => !bValue)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2.1-2.7 3.3M6.6 7.6C4.5 9 3.3 10.9 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.8-.4 4-1M9.9 10a3 3 0 0 0 4.1 4.1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={oForm.remember}
              onChange={(event) => updateField('remember', event.target.checked)}
            />
            <span>
              Keep me signed in
              <small>Stay signed in on this device.</small>
            </span>
          </label>

          <div className="login-turnstile" ref={turnstileBoxRef} />

          <p className="login-error" role="alert" aria-live="assertive">
            {sError}
          </p>

          <button className="login-submit" type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>

      <footer className="login-footer">
        <span>DOXXER <span className="login-footer-dot">/</span> BUILT FOR THE CURIOUS</span>
        <span>METADATA, MADE VISIBLE.</span>
      </footer>
    </div>
  )
}

export { LoginPage }

import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import './RegisterPage.css'

/* ------------------------------------------------------------------ *
 *  CONFIG
 *  - API_URL: where your backend lives.
 *  - SITE_KEY: the PUBLIC Turnstile site key (safe to ship to the browser).
 *    The SECRET key must only ever live on your backend.
 *    In dev we fall back to Cloudflare's "always passes" test key.
 * ------------------------------------------------------------------ */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3999'
const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  (import.meta.env.DEV ? '1x00000000000000000000AA' : '')

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Same rule the backend must enforce again (never trust the browser alone).
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,24}$/

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

function RegisterPage({ onRegistered }) {
  const sTheme = useThemeName()
  const turnstileBoxRef = useRef(null)
  const widgetIdRef = useRef(null)

  // ---- USER INPUT LIVES HERE ------------------------------------------
  const [sUsername, setUsername] = useState('')
  // ---------------------------------------------------------------------

  const [sToken, setToken] = useState('') // Turnstile token, one use only
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sError, setError] = useState(null)

  // Render the Cloudflare widget (re-render when the theme changes).
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

    const sValue = sUsername.trim()

    if (!USERNAME_PATTERN.test(sValue)) {
      setError('Use 3 to 24 characters: letters, numbers, dot, underscore or dash.')
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
      // POST {API_URL}/api/register
      // JSON body:
      //   username        string   the value typed above
      //   turnstileToken  string   verify this on the backend with your SECRET key
      // Success: 200/201 + a Set-Cookie header (the browser stores it for you).
      // Taken:   409 + JSON { "error": "That username is already taken." }
      // Other:   4xx + JSON { "error": "message to show the user" }
      // ================================================
      const oResponse = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // required, or the browser ignores Set-Cookie
        body: JSON.stringify({
          username: sValue,
          turnstileToken: sToken
        })
      })

      const oData = await oResponse.json().catch(() => ({}))

      if (!oResponse.ok) {
        throw new Error(
          oData.error ||
            (oResponse.status === 409
              ? 'That username is already taken.'
              : 'Registration failed. Please try again.')
        )
      }

      onRegistered?.() // App switches to the main page, no reload needed
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
  console.log({
  sToken,
  canSubmit,
  isSubmitting
  })
  
  return (
    <div className="register-page">
      <Navbar />

      <main className="register-main">
        <div className="register-intro">
          <div className="register-eyebrow">
            <span className="register-status-dot" />
            GET STARTED
          </div>
          <h1>
            Welcome to <span>Doxxer</span>
          </h1>
          <p className="register-description">Pick a username to continue.</p>
        </div>

        <form className="register-card" onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength={24}
              value={sUsername}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={Boolean(sError)}
              aria-describedby="register-username-hint"
              required
            />
            <p className="register-hint" id="register-username-hint">
              3 to 24 characters. Letters, numbers, dot, underscore, dash.
            </p>
          </div>

          <div className="register-turnstile" ref={turnstileBoxRef} />

          <p className="register-error" role="alert" aria-live="assertive">
            {sError}
          </p>

          <button className="register-submit" type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Registering…' : 'Register'}
          </button>
        </form>
      </main>

      <footer className="register-footer">
        <span>DOXXER <span className="register-footer-dot">/</span> BUILT FOR THE CURIOUS</span>
        <span>METADATA, MADE VISIBLE.</span>
      </footer>
    </div>
  )
}

export { RegisterPage }
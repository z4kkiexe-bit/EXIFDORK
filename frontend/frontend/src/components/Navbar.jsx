import { useEffect, useState } from 'react'
import './Navbar.css'

const THEME_KEY = 'doxxer-theme'

function getInitialTheme() {
  try {
    const sSaved = localStorage.getItem(THEME_KEY)
    if (sSaved === 'light' || sSaved === 'dark') return sSaved
  } catch {
    // storage unavailable, fall back to light
  }
  return 'light'
}

function Navbar() {
  const [sTheme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', sTheme)
    try {
      localStorage.setItem(THEME_KEY, sTheme)
    } catch {
      // ignore
    }
  }, [sTheme])

  return (
    <header className="navbar">
      <a className="brand" href="/" aria-label="Doxxer home">
        <span className="brand-mark" aria-hidden="true">
          {/* "D" with a smaller magnifying glass on its right */}
          <svg viewBox="0 0 30 24" fill="none">
            <path className="mark-d" d="M4 4.5h4.5a7.5 7.5 0 0 1 0 15H4z" />
            <circle className="mark-lens" cx="22.6" cy="12.6" r="3.5" />
            <path className="mark-handle" d="M25.3 15.4l2.6 2.7" />
          </svg>
        </span>

        <span className="brand-word" aria-hidden="true">
          D
          {/* the "O" is a magnifying glass */}
          <svg className="brand-o" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.1" />
            <path d="M10.9 10.9l3.6 3.6" />
          </svg>
          xxer
        </span>
      </a>

      <div className="navbar-right">
        <div className="theme-switch" role="group" aria-label="Color theme">
          <button
            type="button"
            className={`theme-btn${sTheme === 'light' ? ' is-active' : ''}`}
            aria-pressed={sTheme === 'light'}
            onClick={() => setTheme('light')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
            </svg>
            <span>Light</span>
          </button>
          <button
            type="button"
            className={`theme-btn${sTheme === 'dark' ? ' is-active' : ''}`}
            aria-pressed={sTheme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z" />
            </svg>
            <span>Dark</span>
          </button>
        </div>

        <span className="navbar-caption">A LITTLE MORE THAN A FILE</span>
      </div>
    </header>
  )
}

export default Navbar
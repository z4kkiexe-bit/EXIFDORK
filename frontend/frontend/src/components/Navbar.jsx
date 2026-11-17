import { useEffect, useRef, useState } from 'react'
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
  const infoDialogRef = useRef(null)

  function openInfo() {
    infoDialogRef.current?.showModal()
  }

  function closeInfo() {
    infoDialogRef.current?.close()
  }

  // clicks on the dark backdrop land on the <dialog> itself
  function handleInfoClick(event) {
    if (event.target === event.currentTarget) closeInfo()
  }

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
        <button
          type="button"
          className="info-btn"
          onClick={openInfo}
          aria-haspopup="dialog"
          aria-label="How to use Doxxer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <span>How to use</span>
        </button>

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

      <dialog
        ref={infoDialogRef}
        className="info-dialog"
        aria-labelledby="info-title"
        onClick={handleInfoClick}
      >
        <div className="info-panel">
          <div className="info-head">
            <h2 id="info-title">How to use Doxxer</h2>
            <button
              type="button"
              className="info-close"
              onClick={closeInfo}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <p className="info-lead">
            Doxxer reads the hidden metadata inside a file and shows it in a readable way.
          </p>

          <ol className="info-steps">
            <li>
              Drop a file on the upload box, or click <strong>Choose file</strong>.
              Supported: JPG, PNG, WebP and PDF, up to 10 MB.
            </li>
            <li>Pick a <strong>mode</strong> in the dropdown (see below).</li>
            <li>
              Read the result. Click <strong>Refine metadata</strong> for a cleaner,
              grouped view, and click it again to go back to the raw data.
            </li>
            <li>
              Click <strong>Remove file</strong> to clear everything and start over.
            </li>
          </ol>

          <h3>Modes</h3>
          <dl className="info-modes">
            <div>
              <dt>Standard</dt>
              <dd>Shows all the raw metadata found in the file.</dd>
            </div>
            <div>
              <dt>Auto GPS</dt>
              <dd>
                If the file has GPS coordinates, shows the location on a map with a
                link to Google Maps.
              </dd>
            </div>
            <div>
              <dt>Auto Date</dt>
              <dd>Shows when the file was taken or created, plus any other dates found.</dd>
            </div>
          </dl>

          <div className="info-note" role="note">
            <strong>Auto GPS works best on a laptop or PC</strong>
            <p>
              Android removes the location from photos you pick from the gallery
              (Android 10 and up) before the browser can read them. On a phone, GPS can
              show as missing even when the photo has it. Date, camera model and most
              other metadata usually stay.
            </p>
            <p>
              For GPS, send the photo to a laptop (cable, Google Drive, and so on) and
              upload it there. Photos sent through chat apps like WhatsApp or Telegram
              usually have their metadata removed by the app, so use the original file.
            </p>
          </div>
        </div>
      </dialog>
    </header>
  )
}

export default Navbar
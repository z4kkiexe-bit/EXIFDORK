import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import FileUpload from '../components/FileUpload.jsx'
import './HomePage.css'

function parseGpsCoordinate(value, reference) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value
  }

  const sValue = String(value).trim()

  if (!sValue) return null

  const oDecimalMatch = sValue.match(
    /^([+-]?\d+(?:\.\d+)?)\s*([NSEW])?$/i
  )

  let nCoordinate
  let sReference = String(reference ?? '').trim().toUpperCase()

  if (oDecimalMatch) {
    nCoordinate = Number(oDecimalMatch[1])
    sReference ||= oDecimalMatch[2] || ''
  } else {
    const oDmsMatch = sValue.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*(?:deg|°)\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NSEW])?\s*$/i
    )

    if (!oDmsMatch) return null

    const nDegrees = Number(oDmsMatch[1])
    const nMinutes = Number(oDmsMatch[2] ?? 0)
    const nSeconds = Number(oDmsMatch[3] ?? 0)

    if (
      nMinutes >= 60 ||
      nSeconds >= 60
    ) {
      return null
    }

    nCoordinate =
      Math.abs(nDegrees) +
      nMinutes / 60 +
      nSeconds / 3600

    if (nDegrees < 0) {
      nCoordinate *= -1
    }

    sReference ||= (oDmsMatch[4] || '').toUpperCase()
  }

  if (!Number.isFinite(nCoordinate)) return null

  if (['S', 'W', 'SOUTH', 'WEST'].includes(sReference)) {
    nCoordinate = -Math.abs(nCoordinate)
  } else if (['N', 'E', 'NORTH', 'EAST'].includes(sReference)) {
    nCoordinate = Math.abs(nCoordinate)
  }

  return nCoordinate
}


function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [error, setError] = useState(null)
  const metadataScrollRef = useRef(null)
  const [hasOverflowTop, setHasOverflowTop] = useState(false)
  const [hasOverflowBottom, setHasOverflowBottom] = useState(false)
  const [sMode, setMode] = useState('standard')
  
  function handleFileSelect(file) {
    if (!file) return

    setSelectedFile(file)
    setMetadata(null)
    setError(null)
  }

  function handleMetadataScroll() {
    const oScrollArea = metadataScrollRef.current

    if (!oScrollArea) return

    setHasOverflowTop(oScrollArea.scrollTop > 1)
    setHasOverflowBottom(
      oScrollArea.scrollTop + oScrollArea.clientHeight <
        oScrollArea.scrollHeight - 1
    )
  }

  useEffect(() => {
    const oFrame = requestAnimationFrame(handleMetadataScroll)

    return () => cancelAnimationFrame(oFrame)
  }, [metadata, isProcessing, error])

  const oExif = metadata?.metadata || {}
  const nLatitude = parseGpsCoordinate(
    oExif.GPSLatitude,
    oExif.GPSLatitudeRef
  )
  const nLongitude = parseGpsCoordinate(
    oExif.GPSLongitude,
    oExif.GPSLongitudeRef
  )
  const hasGpsCoordinates =
    nLatitude !== null &&
    nLongitude !== null &&
    Math.abs(nLatitude) <= 90 &&
    Math.abs(nLongitude) <= 180

  async function handleInspect(oFile) {
    if (!oFile) return

    setIsProcessing(true)
    setError(null)

    const oFormData = new FormData()
    oFormData.append("file", oFile)

    try {
        const oResponse = await fetch(
            "http://localhost:3888/api/metadata",
            {
                method: "POST",
                body: oFormData
            }
        )

        const oData = await oResponse.json()

        if (!oResponse.ok) {
            throw new Error(oData.error || "Failed to inspect file")
        }
        await new Promise(resolve => setTimeout(resolve, 3000))

        setMetadata(oData)
    } catch (oError) {
        setError(oError.message)
    } finally {
        setIsProcessing(false)
    }
}

  return (
    <div className={`home-page ${selectedFile ? 'has-file' : ''}`}>
      <Navbar />

      <main className="home-main">
        <div className={`home-intro ${selectedFile ? 'intro-hidden' : ''}`}>
          <div className="eyebrow">
            <span className="status-dot" />
            FILE METADATA INSPECTOR
          </div>

          <h1>search your <span>exif</span></h1>
          <p className="home-description">
            Find the details hidden inside your files.
          </p>
        </div>

        <div className={`upload-stage ${selectedFile ? 'upload-stage-active' : ''} ${sMode === 'gps' && hasGpsCoordinates ? 'has-map-preview' : ''}`}>
          <div className={`result-cards ${selectedFile ? 'result-cards-active' : ''} ${sMode === 'gps' && selectedFile ? 'gps-mode-active' : ''}`}>
          <section className="metadata-card" aria-live="polite">
            <div className="metadata-card-top">
              <span className="metadata-card-label">EXIFDORK / ANALYSIS</span>
              <span className="processing-indicator">
                <span className="processing-dot" />
                {isProcessing ? 'PROCESSING' : 'READY'}
              </span>
            </div>

            <div className="metadata-body">
              <div
                ref={metadataScrollRef}
                className="metadata-scroll"
                onScroll={handleMetadataScroll}
              >
                <div className="metadata-placeholder">
                  {isProcessing ? (
                    <>
                      <span className="metadata-skeleton skeleton-short" />
                      <span className="metadata-skeleton" />
                      <span className="metadata-skeleton skeleton-medium" />
                      <p>Processing metadata<span className="processing-ellipsis">...</span></p>
                    </>
                  ) : error ? (
                    <p className="metadata-error">{error}</p>
                  ) : metadata ? (
                    <div className="metadata-results">
                      <h2>{metadata.filename}</h2>
                      <p>Size: {metadata.size} bytes</p>
                      <p>Type: {metadata.mimetype}</p>
                      <h3>Raw Metadata</h3>
                      <pre>{JSON.stringify(metadata.metadata, null, 2)}</pre>
                    </div>
                  ) : (
                    <p>Select a file to inspect its metadata.</p>
                  )}
                </div>
              </div>

              <div
                className={`metadata-edge metadata-edge-top${hasOverflowTop ? ' is-visible' : ''}`}
                aria-hidden="true"
              />
              <div
                className={`metadata-edge metadata-edge-bottom${hasOverflowBottom ? ' is-visible' : ''}`}
                aria-hidden="true"
              />
            </div>
          </section>

          {sMode === 'gps' && selectedFile && (
            <section className="map-preview-card" aria-label="GPS map preview">
              <div className="map-preview-header">
                <span className="metadata-card-label">AUTO GPS / MAP PREVIEW</span>
                <span className={`gps-status ${hasGpsCoordinates ? 'gps-found' : ''}`}>
                  <span className="gps-status-dot" />
                  {hasGpsCoordinates ? 'GPS FOUND' : 'NO GPS'}
                </span>
              </div>
              {hasGpsCoordinates ? (
                <>
                  <a
                    className="map-preview-image"
                    href={`https://www.google.com/maps?q=${nLatitude},${nLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open GPS location in Google Maps"
                  >
                    <iframe
                      title="Google Maps GPS preview"
                      src={`https://maps.google.com/maps?q=${nLatitude},${nLongitude}&z=15&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <span className="map-open-label">OPEN IN GOOGLE MAPS ↗</span>
                  </a>
                  <div className="gps-location-text">
                    <span className="gps-location-label">GPS LOCATION</span>
                    <p>{nLatitude.toFixed(6)}, {nLongitude.toFixed(6)}</p>
                    <span className="gps-location-hint">Coordinates extracted from file metadata</span>
                  </div>
                </>
              ) : (
                <div className="gps-empty-state">
                  <span className="gps-empty-icon">⌖</span>
                  <h3>No GPS coordinates found</h3>
                  <p>This file doesn't contain readable GPS latitude and longitude metadata.</p>
                </div>
              )}
            </section>
          )}
          </div>

          <div className="blob-field" aria-hidden="true">
            <span className="blob blob-left blob-one" />
            <span className="blob blob-left blob-two" />
            <span className="blob blob-left blob-three" />
            <span className="blob blob-right blob-four" />
            <span className="blob blob-right blob-five" />
            <span className="blob blob-right blob-six" />
          </div>

          <FileUpload
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onInspect={handleInspect}
            mode={sMode}
            onModeChange={setMode}
          />
        </div>

        <p className={`privacy-note ${selectedFile ? 'note-hidden' : ''}`}>
          <span aria-hidden="true">↳</span>
          Metadata inspection, without the guesswork.
        </p>
      </main>

      <footer className="home-footer">
        <span>EXIFDORK <span className="footer-dot">/</span> BUILT FOR THE CURIOUS</span>
        <span>METADATA, MADE VISIBLE.</span>
      </footer>
    </div>
  )
}

export { HomePage }

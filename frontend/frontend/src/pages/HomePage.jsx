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


// exiftool date tags, best "when was this taken/created" first
const DATE_TAGS = [
  'DateTimeOriginal',
  'CreateDate',
  'DateCreated',
  'DateTimeCreated',
  'MediaCreateDate',
  'TrackCreateDate',
  'ModifyDate',
  'FileModifyDate',
  'FileCreateDate',
  'MetadataDate'
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

function pad2(nValue) {
  return String(nValue).padStart(2, '0')
}

function formatOffsetMinutes(nMinutes) {
  const sSign = nMinutes < 0 ? '-' : '+'
  const nAbs = Math.abs(nMinutes)
  return `UTC${sSign}${pad2(Math.floor(nAbs / 60))}:${pad2(nAbs % 60)}`
}

// Handles exiftool strings ("2024:05:12 14:30:22+07:00", "2024-05-12T14:30:22Z")
// and objects serialized by exiftool wrappers ({ year, month, day, hour, ... }).
function parseExifDate(value) {
  if (value === null || value === undefined) return null

  let nYear
  let nMonth
  let nDay
  let nHour = 0
  let nMinute = 0
  let nSecond = 0
  let bHasTime = false
  let sOffset = null

  if (typeof value === 'object') {
    if (value.year && value.month && value.day) {
      nYear = Number(value.year)
      nMonth = Number(value.month)
      nDay = Number(value.day)

      if (value.hour !== undefined && value.hour !== null) {
        bHasTime = true
        nHour = Number(value.hour)
        nMinute = Number(value.minute ?? 0)
        nSecond = Number(value.second ?? 0)
      }

      if (Number.isFinite(value.tzoffsetMinutes)) {
        sOffset = formatOffsetMinutes(value.tzoffsetMinutes)
      }
    } else if (typeof value.rawValue === 'string') {
      return parseExifDate(value.rawValue)
    } else {
      return null
    }
  } else {
    const oMatch = String(value).trim().match(
      /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i
    )

    if (!oMatch) return null

    nYear = Number(oMatch[1])
    nMonth = Number(oMatch[2])
    nDay = Number(oMatch[3])

    if (oMatch[4] !== undefined) {
      bHasTime = true
      nHour = Number(oMatch[4])
      nMinute = Number(oMatch[5])
      nSecond = Number(oMatch[6] ?? 0)
    }

    if (oMatch[7]) {
      if (oMatch[7].toUpperCase() === 'Z') {
        sOffset = 'UTC'
      } else {
        const sDigits = oMatch[7].replace(':', '')
        sOffset = `UTC${sDigits[0]}${sDigits.slice(1, 3)}:${sDigits.slice(3, 5)}`
      }
    }
  }

  if (
    ![nYear, nMonth, nDay, nHour, nMinute, nSecond].every(Number.isFinite) ||
    nYear < 1000 ||
    nMonth < 1 || nMonth > 12 ||
    nDay < 1 || nDay > 31 ||
    nHour > 23 || nMinute > 59 || nSecond > 59
  ) {
    return null
  }

  return { nYear, nMonth, nDay, nHour, nMinute, nSecond, bHasTime, sOffset }
}

function describeExifDate(oDate) {
  const sFullDate = `${oDate.nDay} ${MONTHS[oDate.nMonth - 1]} ${oDate.nYear}`
  const sWeekday =
    WEEKDAYS[new Date(Date.UTC(oDate.nYear, oDate.nMonth - 1, oDate.nDay)).getUTCDay()]

  if (oDate.bHasTime) {
    return {
      sBig: `${pad2(oDate.nHour)}:${pad2(oDate.nMinute)}:${pad2(oDate.nSecond)}`,
      sSub: `${sWeekday}, ${sFullDate}`
    }
  }

  return { sBig: sFullDate, sSub: sWeekday }
}

function shortExifDate(oDate) {
  const sDay = `${oDate.nYear}-${pad2(oDate.nMonth)}-${pad2(oDate.nDay)}`

  return oDate.bHasTime
    ? `${sDay} ${pad2(oDate.nHour)}:${pad2(oDate.nMinute)}:${pad2(oDate.nSecond)}`
    : sDay
}

// Refined metadata: group exiftool tags and turn them into readable stats.
const REFINE_GROUPS = [
  {
    title: 'Camera',
    keys: [
      'Make', 'Model', 'CameraModelName', 'LensMake', 'LensModel', 'LensID', 'Lens',
      'SerialNumber', 'BodySerialNumber', 'LensSerialNumber', 'Software'
    ]
  },
  {
    title: 'Exposure',
    keys: [
      'ExposureTime', 'ShutterSpeed', 'FNumber', 'Aperture', 'ISO', 'FocalLength',
      'FocalLengthIn35mmFormat', 'ExposureProgram', 'ExposureCompensation',
      'ExposureMode', 'Flash', 'MeteringMode', 'WhiteBalance', 'SceneCaptureType', 'LightValue'
    ]
  },
  {
    title: 'Image',
    keys: [
      'ImageSize', 'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
      'Megapixels', 'Orientation', 'ColorSpace', 'BitsPerSample', 'BitDepth', 'ColorType',
      'ColorComponents', 'Compression', 'XResolution', 'YResolution', 'ResolutionUnit',
      'EncodingProcess', 'YCbCrSubSampling'
    ]
  },
  { title: 'Location', test: (sName) => /^GPS/.test(sName) },
  {
    title: 'Dates',
    test: (sName) => DATE_TAGS.includes(sName) || /(Date|Time)$/.test(sName)
  },
  {
    title: 'File',
    test: (sName) =>
      /^File/.test(sName) ||
      ['SourceFile', 'Directory', 'MIMEType', 'ExifToolVersion'].includes(sName)
  }
]

function humanizeKey(sKey) {
  return sKey
    .split(':')
    .pop()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
}

function formatRefinedValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(formatRefinedValue).join(', ')

  if (typeof value === 'object') {
    const oDate = parseExifDate(value)

    if (oDate) {
      return shortExifDate(oDate) + (oDate.sOffset ? ` ${oDate.sOffset}` : '')
    }

    return JSON.stringify(value)
  }

  return String(value)
}

function isNumberLike(value) {
  return (
    typeof value === 'number' ||
    /^[-+]?\d[\d.,:/\- ]*\s?[A-Za-z%°"]{0,8}$/.test(String(value))
  )
}

function refineMetadata(oMeta) {
  const oSource = oMeta || {}
  const aGroups = [
    ...REFINE_GROUPS.map((oGroup) => ({ title: oGroup.title, rows: [] })),
    { title: 'Other', rows: [] }
  ]

  Object.entries(oSource).forEach(([sKey, value]) => {
    const sName = sKey.split(':').pop()
    let nIndex = REFINE_GROUPS.findIndex((oGroup) =>
      oGroup.keys ? oGroup.keys.includes(sName) : oGroup.test(sName)
    )

    if (nIndex < 0) nIndex = aGroups.length - 1

    const bDate = aGroups[nIndex].title === 'Dates'
    const oDate = bDate ? parseExifDate(value) : null

    aGroups[nIndex].rows.push({
      sLabel: humanizeKey(sKey),
      sValue: oDate
        ? shortExifDate(oDate) + (oDate.sOffset ? ` ${oDate.sOffset}` : '')
        : formatRefinedValue(value),
      bNumber: bDate || isNumberLike(value)
    })
  })

  const get = (sName) => {
    const sKey = Object.keys(oSource).find(
      (sField) => sField === sName || sField.endsWith(`:${sName}`)
    )

    return sKey ? oSource[sKey] : undefined
  }

  const aStats = []
  const sMake = get('Make') ? String(get('Make')) : ''
  const sModel = get('Model') ? String(get('Model')) : ''
  const sCamera = sModel.startsWith(sMake) ? sModel : `${sMake} ${sModel}`.trim()
  const sSize =
    get('ImageSize') !== undefined
      ? String(get('ImageSize')).replace(/x/i, ' × ')
      : get('ImageWidth') !== undefined && get('ImageHeight') !== undefined
        ? `${get('ImageWidth')} × ${get('ImageHeight')}`
        : ''
  const vAperture = get('FNumber') ?? get('Aperture')

  if (sCamera) aStats.push({ sLabel: 'Camera', sValue: sCamera })
  if (sSize) aStats.push({ sLabel: 'Resolution', sValue: sSize })
  if (get('ISO') !== undefined) aStats.push({ sLabel: 'ISO', sValue: String(get('ISO')) })
  if (vAperture !== undefined) {
    aStats.push({ sLabel: 'Aperture', sValue: `f/${String(vAperture).replace(/^f\/?/i, '')}` })
  }
  if (get('ExposureTime') !== undefined) {
    aStats.push({ sLabel: 'Shutter', sValue: String(get('ExposureTime')) })
  }
  if (get('FocalLength') !== undefined) {
    aStats.push({ sLabel: 'Focal length', sValue: String(get('FocalLength')) })
  }

  const aUsedGroups = aGroups.filter((oGroup) => oGroup.rows.length > 0)

  return {
    aStats: aStats.slice(0, 6),
    aGroups: aUsedGroups,
    nFields: aUsedGroups.reduce((nTotal, oGroup) => nTotal + oGroup.rows.length, 0)
  }
}

function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [error, setError] = useState(null)
  const metadataScrollRef = useRef(null)
  const [isRefined, setIsRefined] = useState(false)
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
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
  }, [metadata, isProcessing, error, isRefined])

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

  const aDateEntries = DATE_TAGS.map((sTag) => {
    const sKey = Object.keys(oExif).find(
      (sName) => sName === sTag || sName.endsWith(`:${sTag}`)
    )
    const oParsed = sKey ? parseExifDate(oExif[sKey]) : null

    return oParsed ? { sTag, ...oParsed } : null
  }).filter(Boolean)
  const oPrimaryDate = aDateEntries[0] || null
  const oPrimaryText = oPrimaryDate ? describeExifDate(oPrimaryDate) : null
  const aOtherDates = oPrimaryDate
    ? aDateEntries
        .slice(1)
        .filter((oEntry) => shortExifDate(oEntry) !== shortExifDate(oPrimaryDate))
        .slice(0, 4)
    : []
  const oRefined = isRefined && metadata ? refineMetadata(metadata.metadata) : null
  const hasSidePanel = (sMode === 'gps' || sMode === 'date') && Boolean(selectedFile)

  async function handleInspect(oFile) {
    if (!oFile) return

    // a newer file always wins over a request that is still running
    abortRef.current?.abort()
    const oController = new AbortController()
    abortRef.current = oController
    const nRequestId = ++requestIdRef.current

    setIsProcessing(true)
    setError(null)

    const oFormData = new FormData()
    oFormData.append("file", oFile)

    try {
      const oResponse = await fetch(
        "http://localhost:3888/api/metadata",
        {
          method: "POST",
          body: oFormData,
          signal: oController.signal
        }
      )

      const oData = await oResponse.json()

      if (!oResponse.ok) {
        throw new Error(oData.error || "Failed to inspect file")
      }
      await new Promise(resolve => setTimeout(resolve, 3000))

      // file was removed or replaced while we were waiting
      if (nRequestId !== requestIdRef.current) return

      setMetadata(oData)
    } catch (oError) {
      if (oError.name === 'AbortError' || nRequestId !== requestIdRef.current) return

      setError(oError.message)
    } finally {
      if (nRequestId === requestIdRef.current) {
        setIsProcessing(false)
      }
    }
  }

  function handleRemoveFile() {
    abortRef.current?.abort()
    requestIdRef.current += 1

    setSelectedFile(null)
    setMetadata(null)
    setError(null)
    setIsProcessing(false)
    setIsRefined(false)
  }

  function handleToggleRefine() {
    setIsRefined((bValue) => !bValue)
    metadataScrollRef.current?.scrollTo({ top: 0 })
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

          <h1><span>Doxxer</span> is ready to go</h1>
          <p className="home-description">
            Find the details hidden inside your files.
          </p>
        </div>

        <div className={`upload-stage ${selectedFile ? 'upload-stage-active' : ''} ${sMode === 'gps' && hasGpsCoordinates ? 'has-map-preview' : ''}`}>
          <div className={`result-cards ${selectedFile ? 'result-cards-active' : ''} ${hasSidePanel ? 'gps-mode-active' : ''}`}>
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
                      <div className="metadata-file-row">
                        <h2>{metadata.filename}</h2>
                        <div className="metadata-file-actions">
                          <button
                            type="button"
                            className="remove-file-button"
                            onClick={handleRemoveFile}
                            aria-label="Remove file"
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 11v5M13.5 11v5" />
                            </svg>
                            <span>Remove file</span>
                          </button>
                          <button
                            type="button"
                            className="remove-file-button refine-button"
                            onClick={handleToggleRefine}
                            aria-pressed={isRefined}
                            aria-label="Refine metadata"
                          >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z" />
                              <path d="M18 15.5v4M16 17.5h4" />
                            </svg>
                            <span>Refine metadata</span>
                          </button>
                        </div>
                      </div>
                      <p>Size: {metadata.size} bytes</p>
                      <p>Type: {metadata.mimetype}</p>
                      <h3>{oRefined ? 'Refined Metadata' : 'Raw Metadata'}</h3>
                      {oRefined ? (
                        <div className="refined-metadata">
                          <p className="refined-summary">
                            <strong>{oRefined.nFields}</strong> fields in{' '}
                            <strong>{oRefined.aGroups.length}</strong> groups
                          </p>

                          {oRefined.aStats.length > 0 && (
                            <div className="refined-stats">
                              {oRefined.aStats.map((oStat) => (
                                <div className="refined-stat" key={oStat.sLabel}>
                                  <span className="refined-stat-value">{oStat.sValue}</span>
                                  <span className="refined-stat-label">{oStat.sLabel}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {oRefined.aGroups.map((oGroup) => (
                            <section className="refined-group" key={oGroup.title}>
                              <h4>
                                {oGroup.title}
                                <span>{oGroup.rows.length}</span>
                              </h4>
                              <dl>
                                {oGroup.rows.map((oRow, nIndex) => (
                                  <div className="refined-row" key={`${oRow.sLabel}-${nIndex}`}>
                                    <dt>{oRow.sLabel}</dt>
                                    <dd className={oRow.bNumber ? 'is-number' : ''}>{oRow.sValue}</dd>
                                  </div>
                                ))}
                              </dl>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <pre>{JSON.stringify(metadata.metadata, null, 2)}</pre>
                      )}
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

          {sMode === 'date' && selectedFile && (
            <section className="date-preview-card" aria-label="Date and time preview">
              <div className="map-preview-header">
                <span className="metadata-card-label">AUTO DATE / TIMESTAMP</span>
                <span className={`gps-status ${oPrimaryDate ? 'gps-found' : ''}`}>
                  <span className="gps-status-dot" />
                  {isProcessing ? 'READING' : oPrimaryDate ? 'DATE FOUND' : 'NO DATE'}
                </span>
              </div>
              {oPrimaryDate && !isProcessing ? (
                <>
                  <div className="date-display">
                    <span className="date-clock" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3.2 2" />
                      </svg>
                    </span>
                    <div className="date-info">
                      <span className="gps-location-label">DATE &amp; TIME</span>
                      <p className="date-time">{oPrimaryText.sBig}</p>
                      <p className="date-day">{oPrimaryText.sSub}</p>
                      <span className="gps-location-hint">
                        Read from {oPrimaryDate.sTag}
                        {oPrimaryDate.sOffset ? ` · ${oPrimaryDate.sOffset}` : ''}
                      </span>
                    </div>
                  </div>
                  {aOtherDates.length > 0 && (
                    <ul className="date-others">
                      {aOtherDates.map((oEntry) => (
                        <li key={oEntry.sTag}>
                          <span>{oEntry.sTag}</span>
                          <span>{shortExifDate(oEntry)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="gps-empty-state">
                  <span className="gps-empty-icon">
                    <svg className="date-empty-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3.2 2" />
                    </svg>
                  </span>
                  <h3>{isProcessing ? 'Reading date and time' : 'No date found'}</h3>
                  <p>
                    {isProcessing
                      ? 'Looking for timestamps in the file metadata.'
                      : 'This file doesn’t contain a readable date or time in its metadata.'}
                  </p>
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
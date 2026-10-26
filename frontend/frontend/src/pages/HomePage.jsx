import { useState } from 'react'
import Navbar from '../components/Navbar.jsx'
import FileUpload from '../components/FileUpload.jsx'
import './HomePage.css'

function HomePage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [error, setError] = useState(null)
  
  function handleFileSelect(file) {
    if (!file) return

    setSelectedFile(file)
    setMetadata(null)
    setError(null)
    setIsProcessing(false)
  }

  async function handleInspect() {
    if (!selectedFile || isProcessing) return

    setIsProcessing(true)
    setError(null)

    const oFormData = new FormData()
    oFormData.append("file", selectedFile)

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

        <div className={`upload-stage ${selectedFile ? 'upload-stage-active' : ''}`}>
          <div className="metadata-card" aria-live="polite">
            <div className="metadata-card-top">
              <span className="metadata-card-label">EXIFDORK / ANALYSIS</span>
              <span className="processing-indicator">
                <span className="processing-dot" />
                {isProcessing ? 'PROCESSING' : 'READY'}
              </span>
            </div>

            <div className="metadata-placeholder">
              <span className="metadata-skeleton skeleton-short" />
              <span className="metadata-skeleton" />
              <span className="metadata-skeleton skeleton-medium" />
              <p>Processing metadata<span className="processing-ellipsis">...</span></p>
            </div>
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

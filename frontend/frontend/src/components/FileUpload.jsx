import { useRef, useState } from 'react'

import './FileUpload.css'

function FileUpload({ selectedFile, onFileSelect, onInspect, mode, onModeChange }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

    function handleDrop(event) {
      event.preventDefault()
      setIsDragging(false)

      const oFile = event.dataTransfer.files?.[0]
      if (!oFile) return

      onFileSelect(oFile)
      onInspect(oFile)
  }

  function handleChange(event) {
    const oFile = event.target.files?.[0]

    if (!oFile) return

    onFileSelect(oFile)
    onInspect(oFile)
    event.target.value = ''
  }

  return (
    <section
      className={`file-upload ${isDragging ? 'is-dragging' : ''} ${selectedFile ? 'file-upload-selected' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false)
        }
      }}
      onDrop={handleDrop}
      aria-label="Upload a file for metadata inspection"
    >
      <div className="upload-mode-control">
        <label htmlFor="doxxer-mode">MODE</label>
        <select
          id="doxxer-mode"
          value={mode}
          onChange={(event) => onModeChange(event.target.value)}
          aria-label="Choose metadata preview mode"
        >
          <option value="standard">Standard</option>
          <option value="gps">Auto GPS</option>
        </select>
      </div>

      <input
        ref={inputRef}
        className="file-input-hidden"
        type="file"
        onChange={handleChange}
      />

      <div className="upload-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
          <path d="M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4" />
        </svg>
      </div>

      {selectedFile ? (
        <>
          <p className="upload-title file-name">{selectedFile.name}</p>
          <p className="upload-subtitle">
            {(selectedFile.size / 1024).toFixed(1)} KB · Ready for inspection
          </p>
          <button
            className="browse-button"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Change file
          </button>
        </>
      ) : (
        <>
          <p className="upload-title">Drop a file here, or <button
            className="inline-browse"
            type="button"
            onClick={() => inputRef.current?.click()}
          >browse</button></p>
          <p className="upload-subtitle">Images, PDFs, documents and more</p>
          <button
            className="browse-button"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Choose file <span aria-hidden="true">↗</span>
          </button>
        </>
      )}
    </section>
  )
}

export default FileUpload

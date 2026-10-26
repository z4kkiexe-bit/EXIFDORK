import { useRef, useState } from 'react'

import './FileUpload.css'

function FileUpload({ selectedFile, onFileSelect }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    onFileSelect(event.dataTransfer.files?.[0])
  }

  function handleChange(event) {
    onFileSelect(event.target.files?.[0])
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

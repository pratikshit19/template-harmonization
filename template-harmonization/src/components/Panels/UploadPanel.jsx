import React, { useRef, useState } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

export default function UploadPanel({ setProcessing, toast }) {
  const { files, addFiles, removeFile, startSectionDetection } = useHarmonize();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const { skipped, addedCount } = addFiles([...e.dataTransfer.files]);
      if (skipped > 0) {
        toast(`${skipped} file(s) skipped — only DOCX and XLSX files are supported`, 'warning');
      }
      if (addedCount > 0) {
        toast(`Added ${addedCount} file(s)`, 'success');
      }
    }
  };

  const handleFileBrowseClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const { skipped, addedCount } = addFiles([...e.target.files]);
      if (skipped > 0) {
        toast(`${skipped} file(s) skipped — only DOCX and XLSX files are supported`, 'warning');
      }
      if (addedCount > 0) {
        toast(`Added ${addedCount} file(s)`, 'success');
      }
      e.target.value = '';
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleProceed = () => {
    if (files.length < 2) {
      toast('Please upload at least 2 documents to harmonize', 'warning');
      return;
    }
    startSectionDetection(setProcessing, toast);
  };

  return (
    <section className="step-panel active" id="panel-upload">
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        id="upload-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-zone-inner" id="upload-zone-inner">
          <div className="upload-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="12" width="32" height="40" rx="4" fill="none" stroke="#0066CC" strokeWidth="2" />
              <rect x="16" y="8" width="32" height="40" rx="4" fill="none" stroke="#00B4D8" strokeWidth="2" opacity="0.7" />
              <rect x="24" y="4" width="32" height="40" rx="4" fill="#0D1B2E" stroke="#00CFB4" strokeWidth="2" opacity="0.6" />
              <path d="M40 20v10M35 25l5-5 5 5" stroke="#00B4D8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>Drop DOCX files here</h3>
          <p>Drag &amp; drop multiple Microsoft Word documents, or click to browse</p>
          <button
            className="btn-primary btn-upload-browse"
            id="btn-upload-browse"
            onClick={handleFileBrowseClick}
          >
            Browse Files
          </button>
          <input
            type="file"
            id="file-input"
            multiple
            accept=".docx,.doc,.xlsx"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <p className="upload-hint">Supports .docx and .xlsx files · Up to 20 documents · Max 50MB each</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list-section" id="file-list-section" style={{ display: 'block' }}>
          <div className="file-list-header">
            <h3>Uploaded Documents <span className="badge" id="file-count-badge">{files.length}</span></h3>
            <button className="btn-ghost btn-sm" id="btn-add-more" onClick={handleFileBrowseClick}>+ Add More</button>
          </div>
          <div className="file-grid" id="file-grid">
            {files.map((file, index) => (
              <div className="file-card" key={`${file.name}-${index}`}>
                <div className="file-card-icon">📄</div>
                <div className="file-card-name" style={{ wordBreak: 'break-all' }}>{file.name}</div>
                <div className="file-card-size">{formatBytes(file.size)}</div>
                <button
                  className="file-card-remove"
                  onClick={() => removeFile(index)}
                  title="Remove"
                  style={{ opacity: 1 }} // Make sure delete button is visible on hover (or styled cleanly)
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="upload-actions">
            <button className="btn-primary btn-lg" id="btn-proceed-extract" onClick={handleProceed}>
              <span>Detect Sections with AI</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

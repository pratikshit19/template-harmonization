import React, { useState } from 'react';

/**
 * DocumentViewer Component.
 * Renders a DOCX document's mammoth-generated HTML inside a styled
 * "paper" panel that mimics a Word document layout, with a toolbar
 * showing the doc name and page indicator.
 *
 * @param {Object} props
 * @param {string} props.name  - Document filename.
 * @param {string} props.html  - mammoth-generated HTML string.
 */
export default function DocumentViewer({ name, html }) {
  const [zoom, setZoom] = useState(100);

  if (!html) {
    return (
      <div className="doc-viewer-empty">
        <span>No document content available</span>
      </div>
    );
  }

  return (
    <div className="doc-viewer">
      {/* ── Toolbar ── */}
      <div className="doc-viewer-toolbar">
        <div className="doc-viewer-toolbar-left">
          <span className="doc-viewer-icon">📄</span>
          <span className="doc-viewer-name" title={name}>{name}</span>
        </div>
        <div className="doc-viewer-toolbar-right">
          <button
            className="doc-viewer-zoom-btn"
            title="Zoom out"
            onClick={() => setZoom(z => Math.max(60, z - 10))}
          >−</button>
          <span className="doc-viewer-zoom-label">{zoom}%</span>
          <button
            className="doc-viewer-zoom-btn"
            title="Zoom in"
            onClick={() => setZoom(z => Math.min(150, z + 10))}
          >+</button>
        </div>
      </div>

      {/* ── Page canvas ── */}
      <div className="doc-viewer-scroll">
        <div
          className="doc-viewer-page"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

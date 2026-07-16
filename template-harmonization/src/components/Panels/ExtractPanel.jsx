import React, { useState, useRef, useEffect } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';
import { AIEngine } from '../../services/aiEngine';
import DocumentViewer from '../DocumentViewer';

/**
 * ExtractPanel Component.
 * Displays comparison layouts for original template sections. Supports side-by-side scrolling/comparisons
 * and grouped cards with triggering options to run individual section harmonization and annotation.
 * 
 * @param {Object} props - Component properties.
 * @param {function} props.toast - Toast notifier callback.
 * @returns {React.ReactElement} The render interface.
 */
export default function ExtractPanel({ toast }) {
  const {
    files,
    docsWithSections,
    sectionGroups,
    similarityData,
    annotations,
    harmonizedResults,
    excelSmartTags,
    updateHarmonizedResultInline,
    updateAnnotationInline,
    setCurrentStep,
    markStepComplete,
    unlockStep,
    startBulkAnnotations
  } = useHarmonize();

  const [activeView, setActiveView] = useState('grouped'); // 'grouped', 'sidebyside', 'documents'
  const [sbsPage, setSbsPage] = useState(0);
  const [loadingSections, setLoadingSections] = useState({}); // { [groupName]: boolean }
  const [approvedSections, setApprovedSections] = useState({}); // { [groupName]: boolean }
  const [editingSection, setEditingSection] = useState(null); // groupName being edited
  const [editDraft, setEditDraft] = useState(''); // draft text for inline editor

  /**
   * Escapes general special characters for safe inline HTML rendering context.
   * 
   * @param {string} str - Raw input text.
   * @returns {string} Escaped string.
   */
  const escHtml = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  /**
   * Shortens a document filename by removing its file extension and capping string length.
   * 
   * @param {string} name - Raw document name.
   * @returns {string} Sliced document name.
   */
  const shortenDocName = (name) => {
    return name.replace(/\.docx?$/i, '').slice(0, 22) + (name.length > 26 ? '…' : '');
  };

  // Perform inline annotation and harmonization
  /**
   * Harmonizes and annotates a single section group inline via API engine requests.
   * Updates state context immediately.
   * 
   * @param {string} groupName - Section group identifier.
   * @param {Array<Object>} sections - Sub-sections array belonging to this group.
   */
  const handleHarmonizeInline = async (groupName, sections) => {
    setLoadingSections(prev => ({ ...prev, [groupName]: true }));
    try {
      const variants = sections.map(s => ({
        docName: s.docName,
        content: s.content,
        comments: s.comments || []
      }));

      // 1. Annotate
      const annotationResult = await AIEngine.annotateSection(groupName, variants, excelSmartTags || []);
      updateAnnotationInline(groupName, annotationResult);

      // 2. Harmonize
      const harmonizationResult = await AIEngine.harmonizeSection(groupName, variants, annotationResult);

      const fullResult = {
        groupName: groupName,
        sourceCount: sections.length,
        sources: sections.map(s => s.docName),
        ...harmonizationResult,
        harmonized: harmonizationResult.standardClause || ''
      };

      updateHarmonizedResultInline(groupName, fullResult);
      toast(`Section "${groupName}" harmonized successfully!`, 'success');
    } catch (err) {
      console.error(err);
      toast(`Harmonization failed: ${err.message}`, 'error');
    } finally {
      setLoadingSections(prev => ({ ...prev, [groupName]: false }));
    }
  };

  /**
   * Moves to the next step by triggering bulk template annotation.
   */
  const handleProceed = async () => {
    // Navigate to next step and trigger bulk annotation run
    startBulkAnnotations(
      (current, total, name) => {
        // Handled in AnnotatePanel progress bar via context or state
      },
      toast
    );
  };

  // --- SBS Navigation ---
  const docsPerPage = 2;
  const totalSbsPages = Math.max(1, Math.ceil(docsWithSections.length / docsPerPage));
  const sbsDocs = docsWithSections.slice(sbsPage * docsPerPage, (sbsPage * docsPerPage) + docsPerPage);

  /**
   * Navigates side-by-side viewport back by one page.
   */
  const handleSbsPrev = () => setSbsPage(prev => Math.max(0, prev - 1));
  /**
   * Navigates side-by-side viewport forward by one page.
   */
  const handleSbsNext = () => setSbsPage(prev => Math.min(totalSbsPages - 1, prev + 1));

  return (
    <section className="step-panel active" id="panel-extract">
      <div className="extraction-results" id="extraction-results" style={{ display: 'block' }}>
        <div className="results-header">
          <div className="results-header-top">
            <div>
              <h3>Section Detection &amp; Harmonisation Analysis</h3>
              <p id="extract-summary-text">
                Found {sectionGroups.length} section groups across {files.length} documents. Compare original document sections side-by-side. Click 'Harmonize Section' under any group to generate master language inline.
              </p>
            </div>
            <div className="view-toggle-group" id="view-toggle-group">
              <button
                className={`view-toggle-btn ${activeView === 'grouped' ? 'active' : ''}`}
                id="btn-grouped-view"
                title="Section-by-section grouped view"
                onClick={() => setActiveView('grouped')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="1" y="10" width="14" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Grouped
              </button>
              <button
                className={`view-toggle-btn ${activeView === 'sidebyside' ? 'active' : ''}`}
                id="btn-sidebyside-view"
                title="Full document side-by-side comparison"
                onClick={() => setActiveView('sidebyside')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="6" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="11" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Side-by-Side
              </button>
              <button
                className={`view-toggle-btn ${activeView === 'documents' ? 'active' : ''}`}
                id="btn-documents-view"
                title="Full document view"
                onClick={() => setActiveView('documents')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="1" width="10" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="6" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="6" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Documents
              </button>
            </div>
          </div>
        </div>

        {/* ==========================================
            VIEW 1: GROUPED VIEW
            ========================================== */}
        {activeView === 'grouped' && (
          <div className="heatmap-container" id="heatmap-container">
            <div className="comparison-groups-list">
              {sectionGroups.map((group, index) => {
                const scores = similarityData[group.groupName] || [];
                const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                
                let simLabel = 'Unique Clause';
                let simClass = 'sim-badge-blue';

                if (group.sections.length > 1) {
                  if (avgScore === null) {
                    simLabel = 'Near-Duplicate';
                    simClass = 'sim-badge-med';
                  } else if (avgScore >= 90) {
                    simLabel = 'Exact Match';
                    simClass = 'sim-badge-high';
                  } else if (avgScore >= 50) {
                    simLabel = 'Near-Duplicate';
                    simClass = 'sim-badge-med';
                  } else {
                    simLabel = 'Conflict Flagged';
                    simClass = 'sim-badge-low';
                  }
                }

                const simScoreText = (avgScore !== null && group.sections.length > 1) ? ` (${avgScore}%)` : '';
                const isConflict = group.sections.length > 1 && avgScore !== null && avgScore < 50;

                const isSectionLoading = loadingSections[group.groupName];
                const harmResult = harmonizedResults.find(r => r.groupName === group.groupName);
                const sectionAnn = annotations[group.groupName];

                const isApproved = approvedSections[group.groupName];
                const isEditing = editingSection === group.groupName;

                return (
                  <GroupedSectionCard
                    key={group.groupName}
                    group={group}
                    index={index}
                    simLabel={simLabel}
                    simClass={simClass}
                    simScoreText={simScoreText}
                    isConflict={isConflict}
                    isSectionLoading={isSectionLoading}
                    harmResult={harmResult}
                    sectionAnn={sectionAnn}
                    isApproved={isApproved}
                    isEditing={isEditing}
                    editDraft={editDraft}
                    onHarmonizeInline={() => handleHarmonizeInline(group.groupName, group.sections)}
                    onApprove={() => setApprovedSections(prev => ({ ...prev, [group.groupName]: true }))}
                    onUnapprove={() => setApprovedSections(prev => ({ ...prev, [group.groupName]: false }))}
                    onEdit={() => {
                      setEditingSection(group.groupName);
                      setEditDraft(harmResult?.standardClause || harmResult?.harmonized || '');
                    }}
                    onEditSave={(newText) => {
                      if (harmResult) harmResult.standardClause = newText;
                      setEditingSection(null);
                    }}
                    onEditCancel={() => setEditingSection(null)}
                    onEditDraftChange={setEditDraft}
                    shortenDocName={shortenDocName}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ==========================================
            VIEW 2: SIDE-BY-SIDE VIEW
            ========================================== */}
        {activeView === 'sidebyside' && (
          <div className="side-by-side-container" id="side-by-side-container">
            {totalSbsPages > 1 && (
              <div className="sbs-carousel-nav">
                <button className="sbs-carousel-btn" id="sbs-prev" onClick={handleSbsPrev} disabled={sbsPage === 0}>
                  ◀ Previous
                </button>
                <span className="sbs-carousel-indicator">
                  Showing docs <strong>{(sbsPage * docsPerPage) + 1}–{Math.min((sbsPage * docsPerPage) + docsPerPage, docsWithSections.length)}</strong> of <strong>{docsWithSections.length}</strong>
                </span>
                <button className="sbs-carousel-btn" id="sbs-next" onClick={handleSbsNext} disabled={sbsPage >= totalSbsPages - 1}>
                  Next ▶
                </button>
              </div>
            )}

            <div className="sbs-doc-columns">
              {sbsDocs.map(doc => (
                <div className="sbs-doc-column" key={doc.name}>
                  <div className="sbs-doc-header">
                    <span className="sbs-doc-header-icon">📄</span>
                    <div className="sbs-doc-header-info">
                      <span className="sbs-doc-header-title" title={doc.name}>{shortenDocName(doc.name)}</span>
                      <span className="sbs-doc-header-subtitle">{doc.sections.length} sections</span>
                    </div>
                  </div>
                  <div className="sbs-doc-body">
                    {sectionGroups.map((group, idx) => {
                      const section = group.sections.find(s => s.docName === doc.name);
                      return (
                        <div
                          className={`sbs-doc-section ${!section ? 'sbs-doc-section-missing' : ''}`}
                          key={`${group.groupName}-${idx}`}
                        >
                          <div className={`sbs-doc-section-heading ${!section ? 'sbs-heading-missing' : ''}`}>
                            {idx + 1}. {group.groupName}
                          </div>
                          {section ? (
                            <div className="sbs-doc-section-text">{section.content}</div>
                          ) : (
                            <div className="sbs-doc-section-empty-text">Section not present in this document</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Proposed Harmonization Column */}
              <div className="sbs-doc-column sbs-doc-column-harmonized">
                <div className="sbs-doc-header sbs-doc-header-harmonized">
                  <span className="sbs-doc-header-icon">✦</span>
                  <div className="sbs-doc-header-info">
                    <span className="sbs-doc-header-title harmonized-title">Proposed Harmonization</span>
                    <span className="sbs-doc-header-subtitle">AI-generated master language</span>
                  </div>
                </div>
                <div className="sbs-doc-body">
                  {sectionGroups.map((group, idx) => {
                    const scores = similarityData[group.groupName] || [];
                    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                    const isLowSimilarity = avgScore !== null && avgScore < 50 && group.sections.length > 1;

                    const harmResult = harmonizedResults.find(r => r.groupName === group.groupName);
                    const isSectionLoading = loadingSections[group.groupName];

                    const isApproved = approvedSections[group.groupName];

                    return (
                      <div
                        className={`sbs-doc-section ${isLowSimilarity ? 'sbs-doc-section-different' : ''} ${harmResult && !harmResult.error ? 'sbs-doc-section-harmonized' : ''} ${isApproved ? 'sbs-doc-section-approved' : ''}`}
                        key={`harm-col-${group.groupName}-${idx}`}
                      >
                        <div className="sbs-doc-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{idx + 1}. {group.groupName}</span>
                          {isApproved && <span className="approved-badge-small">✓ Approved</span>}
                        </div>
                        {isLowSimilarity ? (
                          <div className="sbs-harm-different">
                            <span className="sbs-harm-different-icon">⚠️</span>
                            <span className="sbs-harm-different-text">Content Different — Shouldn't be harmonized</span>
                            <span className="sbs-harm-different-sub">Separate clauses will be created for each document</span>
                          </div>
                        ) : harmResult && !harmResult.error ? (
                          <>
                            <div className="sbs-doc-section-text sbs-harmonized-text">
                              {harmResult.standardClause || harmResult.harmonized || ''}
                            </div>
                            <div className="sbs-section-action-row">
                              <button
                                className="sbs-action-btn sbs-btn-edit"
                                title="Edit this harmonized text"
                                onClick={() => {
                                  setEditingSection(group.groupName);
                                  setEditDraft(harmResult.standardClause || harmResult.harmonized || '');
                                }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="sbs-action-btn sbs-btn-rerun"
                                title="Re-run AI harmonization"
                                onClick={() => handleHarmonizeInline(group.groupName, group.sections)}
                              >
                                ↺ Re-run
                              </button>
                              {!isApproved ? (
                                <button
                                  className="sbs-action-btn sbs-btn-approve"
                                  title="Approve this harmonized section"
                                  onClick={() => setApprovedSections(prev => ({ ...prev, [group.groupName]: true }))}
                                >
                                  ✓ Approve
                                </button>
                              ) : (
                                <button
                                  className="sbs-action-btn sbs-btn-unapprove"
                                  title="Revoke approval"
                                  onClick={() => setApprovedSections(prev => ({ ...prev, [group.groupName]: false }))}
                                >
                                  ✕ Revoke
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="sbs-harm-pending">
                            {!isSectionLoading ? (
                              <button
                                className="btn-harmonize-sbs"
                                onClick={() => handleHarmonizeInline(group.groupName, group.sections)}
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: '6px' }}>
                                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                Harmonize Section
                              </button>
                            ) : (
                              <div className="sbs-harm-spinner">
                                <div className="processing-pulse" style={{ width: '12px', height: '12px', margin: 0 }}></div>
                                <span>Harmonizing…</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            VIEW 3: FULL DOCUMENT VIEW
            ========================================== */}
        {activeView === 'documents' && (
          <div className="sbs-viewer-columns" style={{
            gridTemplateColumns: `repeat(${Math.min(sbsDocs.length, 2)}, 1fr)`
          }}>
            {docsWithSections.map(doc => (
              <DocumentViewer
                key={doc.name}
                name={doc.name}
                html={doc.html || ''}
              />
            ))}
          </div>
        )}

        <div className="step-actions">
          <button className="btn-primary btn-lg" id="btn-proceed-annotate" onClick={handleProceed}>
            <span>Annotate Sections (Smart Tags, CLIs)</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

// --- GroupedSectionCard Sub-Component ---
/**
 * GroupedSectionCard Sub-Component.
 * Renders an individual section card containing slider cards for each variant,
 * conflict warnings, inline run controls, and generated harmonized output sections.
 * 
 * @returns {React.ReactElement} The card component.
 */
function GroupedSectionCard({
  group,
  index,
  simLabel,
  simClass,
  simScoreText,
  isConflict,
  isSectionLoading,
  harmResult,
  sectionAnn,
  isApproved,
  isEditing,
  editDraft,
  onHarmonizeInline,
  onApprove,
  onUnapprove,
  onEdit,
  onEditSave,
  onEditCancel,
  onEditDraftChange,
  shortenDocName
}) {
  const sliderRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /**
   * Evaluates card slider element dimensions to toggle arrow visibility.
   */
  const checkScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight((scrollLeft + clientWidth) < (scrollWidth - 5));
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [group.sections]);

  /**
   * Scrolls the variant card list horizontally to the left.
   */
  const handleScrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -360, behavior: 'smooth' });
      setTimeout(checkScroll, 400);
    }
  };

  /**
   * Scrolls the variant card list horizontally to the right.
   */
  const handleScrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 360, behavior: 'smooth' });
      setTimeout(checkScroll, 400);
    }
  };

  return (
    <div className="comparison-group-card">
      <div className="comparison-group-header">
        <h4 className="comparison-group-title">{index + 1}. {group.groupName}</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`sim-badge ${simClass}`}>{simLabel}{simScoreText}</span>
          <span className="hs-docs-badge" style={{ fontSize: '12px', padding: '4px 10px' }}>
            {group.sections.length} Docs
          </span>
        </div>
      </div>

      <div className="slider-wrapper" style={{ padding: group.sections.length > 1 ? undefined : '0' }}>
        {group.sections.length > 1 && (
          <button
            className="slider-arrow slider-arrow-left"
            onClick={handleScrollLeft}
            disabled={!canScrollLeft}
            style={{ display: canScrollLeft || canScrollRight ? 'block' : 'none' }}
          >
            ◀
          </button>
        )}
        <div
          className="variants-slider"
          ref={sliderRef}
          onScroll={checkScroll}
          style={{ overflowX: 'auto', display: 'flex', gap: '16px' }}
        >
          {group.sections.map((sec, sIdx) => (
            <div className="variant-card" key={`${sec.docName}-${sIdx}`} style={{ flexShrink: 0, width: '320px' }}>
              <div className="variant-card-header" title={sec.docName}>
                📄 {shortenDocName(sec.docName)}
              </div>
              <div className="variant-card-content">{sec.content}</div>
              {sec.comments && sec.comments.length > 0 && (
                <div
                  className="variant-comments"
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: 'var(--amber-dim)',
                    border: '1px solid rgba(255, 179, 71, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: 'var(--amber)',
                    lineHeight: 1.4
                  }}
                >
                  <strong>DOCX Comment:</strong>
                  {sec.comments.map((c, cIdx) => (
                    <div key={cIdx} style={{ marginTop: '2px' }}>{c}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {group.sections.length > 1 && (
          <button
            className="slider-arrow slider-arrow-right"
            onClick={handleScrollRight}
            disabled={!canScrollRight}
            style={{ display: canScrollLeft || canScrollRight ? 'block' : 'none' }}
          >
            ▶
          </button>
        )}
      </div>

      {isConflict && (
        <div
          className="conflict-banner"
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'var(--red-dim)',
            border: '1px solid rgba(255, 92, 122, 0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--red)',
            lineHeight: '1.5'
          }}
        >
          <strong>Conflict Flagged:</strong> Contradictory legal terms detected. <br />
          <strong>Resolution:</strong> Propose variations, escalate to legal owners, or define rule selection.
        </div>
      )}

      <div className="inline-harmonize-action" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {!isSectionLoading ? (
          <>
            {!harmResult && (
              <button className="btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }} onClick={onHarmonizeInline}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Harmonize Section
              </button>
            )}
            {harmResult && (
              <>
                <button
                  className="grouped-action-btn grouped-btn-edit"
                  title="Edit this harmonized clause"
                  onClick={onEdit}
                  disabled={isEditing}
                >
                  ✏️ Edit
                </button>
                <button
                  className="grouped-action-btn grouped-btn-rerun"
                  title="Re-run AI harmonization"
                  onClick={onHarmonizeInline}
                >
                  ↺ Re-run
                </button>
                {!isApproved ? (
                  <button
                    className="grouped-action-btn grouped-btn-approve"
                    title="Approve this section"
                    onClick={onApprove}
                  >
                    ✓ Approve
                  </button>
                ) : (
                  <button
                    className="grouped-action-btn grouped-btn-unapprove"
                    title="Revoke approval"
                    onClick={onUnapprove}
                  >
                    ✕ Revoke
                  </button>
                )}
                {isApproved && (
                  <span className="approved-badge-large">✓ Approved</span>
                )}
              </>
            )}
          </>
        ) : (
          <div className="inline-spinner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="processing-pulse" style={{ width: '12px', height: '12px', margin: 0 }}></div>
            <span style={{ fontSize: '12px' }}>Harmonizing with AI...</span>
          </div>
        )}
      </div>

      {harmResult && !isSectionLoading && (
        <div
          className={`inline-results-panel ${isApproved ? 'inline-results-approved' : ''}`}
          style={{
            display: 'block',
            marginTop: '20px',
            background: isApproved ? 'rgba(0, 200, 120, 0.05)' : 'rgba(0,0,0,0.15)',
            border: isApproved ? '1px solid rgba(0, 200, 120, 0.3)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            transition: 'all 0.25s ease'
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: isApproved ? 'var(--green)' : 'var(--teal)', marginBottom: '8px', borderBottom: `1px solid ${isApproved ? 'rgba(0,200,120,0.2)' : 'rgba(0, 180, 216, 0.2)'}`, paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✦ Standard Clause</span>
              {isApproved && <span style={{ fontSize: '11px', background: 'rgba(0,200,120,0.15)', color: 'var(--green)', padding: '2px 10px', borderRadius: '99px', fontWeight: 600 }}>✓ Approved</span>}
            </div>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  value={editDraft}
                  onChange={e => onEditDraftChange(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--cyan)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="grouped-action-btn grouped-btn-approve"
                    onClick={() => onEditSave(editDraft)}
                  >
                    💾 Save
                  </button>
                  <button
                    className="grouped-action-btn grouped-btn-edit"
                    onClick={onEditCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="hs-merged-content" style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {harmResult.standardClause || harmResult.harmonized || ''}
              </div>
            )}
          </div>

          {harmResult.variations && harmResult.variations.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amber)', marginBottom: '8px', borderBottom: '1px solid rgba(230, 168, 0, 0.2)', paddingBottom: '6px' }}>
                📋 Variation Clauses
              </div>
              {harmResult.variations.map((v, vi) => (
                <div className="hs-variation-card" key={vi} style={{ marginTop: '10px', marginBottom: 0 }}>
                  <div className="hs-variation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="hs-variation-label" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber)' }}>Variation {vi + 1}</span>
                    <span className="hs-variation-source" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{shortenDocName(v.docName)}</span>
                  </div>
                  <div className="hs-variation-content" style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{v.clause}</div>
                  {v.differenceNote && (
                    <div className="hs-variation-note" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      📝 {v.differenceNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {sectionAnn && sectionAnn.smartTags && sectionAnn.smartTags.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Smart Tags Preserved</div>
              <div className="ann-tag-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sectionAnn.smartTags.map((t, ti) => (
                  <span className="smart-tag-chip" style={{ marginBottom: '4px' }} title={t.context || ''} key={ti}>
                    <span className="tag-name" style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>{t.tag}</span>
                    <span className="tag-type" style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '6px' }}>{t.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {sectionAnn && sectionAnn.cliCandidates && sectionAnn.cliCandidates.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Clause Library Candidates (CLIs)</div>
              <div className="ann-cli-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sectionAnn.cliCandidates.map((c, ci) => (
                  <div className="ann-cli-item" style={{ padding: '8px 12px', background: 'rgba(0,207,180,0.05)', border: '1px solid rgba(0,207,180,0.1)', borderRadius: 'var(--radius-sm)' }} key={ci}>
                    <div className="ann-cli-name" style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</div>
                    <span className="ann-cli-category" style={{ fontSize: '10px', color: 'var(--teal)' }}>Category: {c.category || 'General'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sectionAnn && sectionAnn.assemblyLogic && sectionAnn.assemblyLogic.length > 0 && (
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Assembly Rules</div>
              <div className="ann-rules-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sectionAnn.assemblyLogic.map((r, ri) => (
                  <div className="ann-rule-item" style={{ padding: '8px 12px', fontSize: '12px', lineHeight: '1.5', background: 'var(--amber-dim)', border: '1px solid rgba(255,179,71,0.1)', borderRadius: 'var(--radius-sm)' }} key={ri}>
                    <strong>Rule:</strong> {r.rule} <br />
                    <span className="tag-type" style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>Type: {r.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

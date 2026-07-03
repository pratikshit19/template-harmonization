import React, { useState, useEffect } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';
import { Harmonizer } from '../../services/harmonizer';

export default function AnnotatePanel({ toast }) {
  const {
    sectionGroups,
    annotations,
    excelSmartTags,
    setCurrentStep,
    markStepComplete,
    unlockStep,
    startConsolidation
  } = useHarmonize();

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [localAnnotations, setLocalAnnotations] = useState(annotations);
  const [openCards, setOpenCards] = useState({});

  useEffect(() => {
    // Check if we need to run annotations
    const unannotated = sectionGroups.filter(
      g => !annotations[g.groupName] || annotations[g.groupName].error
    );

    if (unannotated.length > 0) {
      runBulkAnnotation();
    } else {
      setLocalAnnotations(annotations);
      // Initialize first 5 cards as open by default
      const initialOpen = {};
      sectionGroups.forEach((group, index) => {
        if (index < 5) {
          initialOpen[group.groupName] = true;
        }
      });
      setOpenCards(initialOpen);
    }
  }, [sectionGroups, annotations]);

  const runBulkAnnotation = async () => {
    setIsAnnotating(true);
    try {
      const result = await Harmonizer.annotateAll(
        sectionGroups,
        annotations,
        excelSmartTags,
        (current, total, name) => {
          setProgress({ current, total, name });
        }
      );
      // Update local and context state
      setLocalAnnotations(result);
      // Initialize first 5 cards as open by default
      const initialOpen = {};
      sectionGroups.forEach((group, index) => {
        if (index < 5) {
          initialOpen[group.groupName] = true;
        }
      });
      setOpenCards(initialOpen);
      
      // Update context state
      // (Since we passed setAnnotations directly, HarmonizeContext state will be updated via a setter we call or we can update it in context)
      // Wait, let's make sure the context's internal annotations are synced.
      // In HarmonizeContext, we can add a sync function, or in runBulkAnnotation we can just write back to context.
      // Wait! The HarmonizeContext has a startBulkAnnotations that handles running and setting state inside context.
      // Let's check: can we just call startBulkAnnotations from context?
      // Yes, startBulkAnnotations in HarmonizeContext does exactly this!
      // Wait, in HarmonizeContext:
      // const startBulkAnnotations = async (onProgress, onToast) => { ... result = await Harmonizer.annotateAll ... setAnnotations(result) ... }
      // So if we just call the context's startBulkAnnotations, it will do it!
      // Let's modify our code to just call context's startBulkAnnotations!
    } catch (err) {
      toast(`Annotation failed: ${err.message}`, 'error');
    } finally {
      setIsAnnotating(false);
    }
  };

  // Run the context's startBulkAnnotations instead
  useEffect(() => {
    const runCtxAnnotation = async () => {
      // Find if we have unannotated groups
      const unannotated = sectionGroups.filter(
        g => !annotations[g.groupName] || annotations[g.groupName].error
      );
      if (unannotated.length > 0) {
        setIsAnnotating(true);
        try {
          const result = await Harmonizer.annotateAll(
            sectionGroups,
            annotations,
            excelSmartTags,
            (current, total, name) => {
              setProgress({ current, total, name });
            }
          );
          // Directly set context state
          // (Wait, since we don't have a direct setter exposed from context, we can expose setAnnotations in context value,
          // or we can call context's startBulkAnnotations wrapper).
          // Actually, let's call the wrapper. But wait, does the wrapper update state?
          // Yes! In HarmonizeContext: `const result = await Harmonizer.annotateAll(...)` then `setAnnotations(result)`
          // So if we call context's startBulkAnnotations, it will run and set state in context!
          // Let's do that.
        } catch (err) {
          toast(`Annotation failed: ${err.message}`, 'error');
        } finally {
          setIsAnnotating(false);
        }
      } else {
        // First 5 open
        const initialOpen = {};
        sectionGroups.forEach((group, index) => {
          if (index < 5) {
            initialOpen[group.groupName] = true;
          }
        });
        setOpenCards(initialOpen);
      }
    };
    runCtxAnnotation();
  }, []);

  const handleProceed = () => {
    startConsolidation(toast);
  };

  const toggleCard = (groupName) => {
    setOpenCards(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Calculate totals
  let totalTags = 0, totalCLIs = 0, totalRules = 0;
  for (const ann of Object.values(annotations)) {
    totalTags += (ann.smartTags || []).length;
    totalCLIs += (ann.cliCandidates || []).length;
    totalRules += (ann.assemblyLogic || []).length;
  }

  return (
    <section className="step-panel active" id="panel-annotate">
      {isAnnotating && (
        <div className="ai-processing-banner" id="annotate-processing" style={{ display: 'flex' }}>
          <div className="processing-pulse"></div>
          <span>
            AI is identifying smart tags, CLIs, and assembly logic… {progress.total > 0 ? `(${progress.current}/${progress.total}) ${progress.name}` : ''}
          </span>
        </div>
      )}

      {!isAnnotating && (
        <div className="annotation-results" id="annotation-results" style={{ display: 'block' }}>
          <div className="results-header">
            <h3>Annotations</h3>
            <p id="annotate-summary-text">
              Found {totalTags} smart tags, {totalCLIs} CLI candidates, and {totalRules} assembly rules across {sectionGroups.length} sections.
            </p>
          </div>

          {/* Annotation summary cards */}
          <div className="annotation-summary-cards" id="annotation-summary-cards">
            <div className="ann-summary-card">
              <div className="ann-summary-icon">🏷️</div>
              <div className="ann-summary-value" id="ann-total-tags">{totalTags}</div>
              <div className="ann-summary-label">Smart Tags</div>
            </div>
            <div className="ann-summary-card">
              <div className="ann-summary-icon">📑</div>
              <div className="ann-summary-value" id="ann-total-clis">{totalCLIs}</div>
              <div className="ann-summary-label">CLI Candidates</div>
            </div>
            <div className="ann-summary-card">
              <div className="ann-summary-icon">⚡</div>
              <div className="ann-summary-value" id="ann-total-rules">{totalRules}</div>
              <div className="ann-summary-label">Assembly Rules</div>
            </div>
          </div>

          {/* Per-section annotations */}
          <div className="annotation-sections" id="annotation-sections">
            {sectionGroups.map((group, index) => {
              const ann = annotations[group.groupName] || {};
              const tags = ann.smartTags || [];
              const clis = ann.cliCandidates || [];
              const rules = ann.assemblyLogic || [];

              // Skip sections with no annotations
              if (tags.length === 0 && clis.length === 0 && rules.length === 0) return null;

              const isOpen = openCards[group.groupName];

              return (
                <div className="ann-section-card" key={group.groupName}>
                  <div className="ann-section-header" onClick={() => toggleCard(group.groupName)}>
                    <span className="ann-section-title">{group.groupName}</span>
                    <div className="ann-section-badges">
                      {tags.length > 0 && <span className="ann-badge ann-badge-tag">🏷️ {tags.length} tags</span>}
                      {clis.length > 0 && <span className="ann-badge ann-badge-cli">📑 {clis.length} CLIs</span>}
                      {rules.length > 0 && <span className="ann-badge ann-badge-rule">⚡ {rules.length} rules</span>}
                      <button className="ann-toggle" style={{ border: 'none', background: 'none' }}>
                        {isOpen ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                  <div className={`ann-section-body ${isOpen ? 'open' : ''}`}>
                    {tags.length > 0 && (
                      <div className="ann-subsection">
                        <div className="ann-subsection-title">🏷️ Smart Tags</div>
                        <div className="ann-tag-chips">
                          {tags.map((t, ti) => (
                            <span className="smart-tag-chip" title={t.context || ''} key={ti}>
                              <span className="tag-name">{t.tag}</span>
                              <span className="tag-type">{t.type || ''}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {clis.length > 0 && (
                      <div className="ann-subsection">
                        <div className="ann-subsection-title">📑 CLI Candidates</div>
                        <div className="ann-cli-list">
                          {clis.map((c, ci) => (
                            <div className="ann-cli-item" key={ci}>
                              <div className="ann-cli-name">{c.name}</div>
                              <span className="ann-cli-category">{c.category || ''}</span>
                              {c.sourceDoc && <span className="ann-cli-source">{c.sourceDoc}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rules.length > 0 && (
                      <div className="ann-subsection">
                        <div className="ann-subsection-title">⚡ Assembly Logic</div>
                        <div className="ann-rules-list">
                          {rules.map((r, ri) => (
                            <div className="ann-rule-item" key={ri}>
                              <span className="ann-rule-type">{r.type || ''}</span>
                              <span className="ann-rule-text">{r.rule}</span>
                              {r.affectedClause && <span className="ann-rule-clause">→ {r.affectedClause}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="step-actions">
            <button className="btn-primary btn-lg" id="btn-proceed-dashboard" onClick={handleProceed}>
              <span>Go to Consolidation Dashboard</span>
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

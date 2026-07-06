import React, { useState, useEffect } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

export default function DashboardPanel({ setCurrentStep, markStepComplete, unlockStep }) {
  const {
    files,
    parsedDocs,
    clauseInventory,
    sectionGroups,
    harmonizedResults,
    similarityData
  } = useHarmonize();

  // Collapsed state for the architecture tree categories
  const [treeOpen, setTreeOpen] = useState({
    general: true,
    commercial: true,
    ip: true,
    liability: true,
    country: true
  });

  const toggleFolder = (key) => {
    setTreeOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const origTemplates = parsedDocs.length || files.length || 2;
  const targetTemplates = Math.max(1, Math.min(2, Math.floor(origTemplates / 3)));
  const templateReductionPct = Math.round(((origTemplates - targetTemplates) / origTemplates) * 100);

  const origClauses = clauseInventory ? clauseInventory.length : 20;
  const targetClauses = harmonizedResults ? harmonizedResults.length : 8;
  const clauseReductionPct = origClauses > 0 ? Math.round(((origClauses - targetClauses) / origClauses) * 100) : 0;
  const duplicatesMerged = Math.max(0, origClauses - targetClauses);

  // Categorize sections for recommended template architecture tree
  const modules = {
    general: { label: '📂 Core General Terms', clauses: [] },
    commercial: { label: '📂 Commercial & Payment Module', clauses: [] },
    ip: { label: '📂 IP & Confidentiality Module', clauses: [] },
    liability: { label: '📂 Liability & Termination Module', clauses: [] },
    country: { label: '📂 Country Localization Rules', clauses: [] }
  };

  harmonizedResults.forEach(h => {
    const name = h.groupName.toLowerCase();
    if (name.includes('payment') || name.includes('charge') || name.includes('fee') || name.includes('billing') || name.includes('tax')) {
      modules.commercial.clauses.push(h);
    } else if (name.includes('confidential') || name.includes('ip ') || name.includes('intellectual') || name.includes('proprietary') || name.includes('disclosure')) {
      modules.ip.clauses.push(h);
    } else if (name.includes('liabilit') || name.includes('indemnity') || name.includes('terminate') || name.includes('termination') || name.includes('risk')) {
      modules.liability.clauses.push(h);
    } else if (name.includes('local') || name.includes('country') || name.includes('governing law') || name.includes('jurisdiction') || name.includes('region')) {
      modules.country.clauses.push(h);
    } else {
      modules.general.clauses.push(h);
    }
  });

  // Top clustered sections for redundancy report (sort by occurrences desc, show top 5)
  const sortedGroupsForRedundancy = [...sectionGroups].sort((a, b) => b.sections.length - a.sections.length);
  const topRedundancies = sortedGroupsForRedundancy.slice(0, 5);

  const handleProceed = () => {
    markStepComplete('dashboard');
    unlockStep('export');
    setCurrentStep('export');
  };

  const shortenName = (name) => {
    return name.replace(/\.docx?$/i, '').slice(0, 18);
  };

  return (
    <section className="step-panel active" id="panel-dashboard">
      <div className="results-header">
        <h3>Consolidation Dashboard</h3>
        <p>Review harmonization analytics, template consolidation metrics, and the recommended modular contract architecture.</p>
      </div>

      {/* KPI Row */}
      <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="kpi-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <div className="kpi-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
          <div className="kpi-value" id="kpi-templates-reduction" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--cyan)', marginBottom: '4px' }}>{templateReductionPct}%</div>
          <div className="kpi-label" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Template Count Reduction</div>
          <div className="kpi-subtext" id="kpi-templates-subtext" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{origTemplates} → {targetTemplates} templates</div>
        </div>
        <div className="kpi-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <div className="kpi-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>📑</div>
          <div className="kpi-value" id="kpi-clauses-reduction" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--teal)', marginBottom: '4px' }}>{clauseReductionPct}%</div>
          <div className="kpi-label" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Clause Count Reduction</div>
          <div className="kpi-subtext" id="kpi-clauses-subtext" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{origClauses} → {targetClauses} clauses</div>
        </div>
        <div className="kpi-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', textAlign: 'center', boxShadow: 'var(--shadow-card)' }}>
          <div className="kpi-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
          <div className="kpi-value" id="kpi-duplicates-merged" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--green)', marginBottom: '4px' }}>{duplicatesMerged}</div>
          <div className="kpi-label" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Duplicate Clauses Merged</div>
          <div className="kpi-subtext" id="kpi-duplicates-subtext" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Redundancies eliminated</div>
        </div>
      </div>

      {/* Main Columns: Tree & Redundancy */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        {/* Left: Recommended Template Architecture Tree */}
        <div className="dashboard-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-primary)' }}>Recommended Template Architecture</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Modular clause structure recommended for Sirion CLM template configuration. Expand nodes to view localizations.</p>
          
          <div className="architecture-tree" id="architecture-tree-container">
            {Object.entries(modules).map(([key, item]) => {
              if (item.clauses.length === 0 && key !== 'general') return null;
              const isOpen = treeOpen[key];
              return (
                <div className="tree-node" key={key}>
                  <div className="tree-node-title" onClick={() => toggleFolder(key)}>
                    <span className="tree-node-icon">{isOpen ? '▼' : '▶'}</span>
                    <span>{item.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>({item.clauses.length} standard clauses)</span>
                  </div>
                  {isOpen && (
                    <div className="tree-node-content" style={{ display: 'block' }}>
                      {item.clauses.map(c => {
                        const varCount = c.variations ? c.variations.length : 0;
                        return (
                          <div className="tree-leaf" key={c.groupName}>
                            <span className="tree-leaf-icon">📄</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.groupName}</span>
                            {varCount > 0 && (
                              <span className="tree-leaf-tag">{varCount} regional variations</span>
                            )}
                          </div>
                        );
                      })}
                      {item.clauses.length === 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                          No clauses in this module.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Redundancy Report Preview */}
        <div className="dashboard-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-primary)' }}>Redundancy Report Preview</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Top clustered sections and their source templates, indicating high rates of redundancy.</p>
          
          <div className="table-wrapper" style={{ overflowX: 'auto', maxHeight: '350px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Section Group</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '80px' }}>Occurrences</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody id="redundancy-table-body">
                {topRedundancies.map(g => {
                  const percent = Math.round((g.sections.length / origTemplates) * 100);
                  let statusBadge = <span className="sim-badge sim-badge-high">High Duplication</span>;
                  if (g.sections.length === 1) {
                    statusBadge = <span className="sim-badge sim-badge-blue">Unique Section</span>;
                  } else if (percent < 50) {
                    statusBadge = <span className="sim-badge sim-badge-med">Moderate</span>;
                  }

                  return (
                    <tr key={g.groupName} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{g.groupName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--cyan)' }}>{g.sections.length} templates</td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      {/* Full-width Excel Tracking Sheet Dynamic Section */}
      <div className="dashboard-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '32px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-primary)' }}>
          Excel Tracking Sheet Analysis
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Calculated metrics mapping commonality thresholds, unique clause volumes, and recommended consolidation actions for each document.
        </p>
        
        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Template</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Common Content %</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Unique Clauses</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docsWithSections.map(doc => {
                const totalSecs = doc.sections.length;
                let commonCount = 0;
                doc.sections.forEach(sec => {
                  const group = sectionGroups.find(g =>
                    g.sections.some(s => s.docName === doc.name && (s.originalHeader === sec.header || s.originalHeader === sec.rawHeader))
                  );
                  if (group && group.sections.length > 1) {
                    commonCount++;
                  }
                });

                const commonPercent = totalSecs > 0 ? Math.round((commonCount / totalSecs) * 100) : 0;
                const uniqueCount = totalSecs - commonCount;
                const action = commonPercent >= 50 ? 'Merge' : 'Separate Review';

                return (
                  <tr key={doc.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 500 }}>{shortenName(doc.name)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--cyan)' }}>{commonPercent}%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--teal)' }}>{uniqueCount}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`sim-badge ${action === 'Merge' ? 'sim-badge-high' : 'sim-badge-med'}`}>
                        {action}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      </div>

      <div className="step-actions">
        <button className="btn-primary btn-lg" id="btn-proceed-to-export" onClick={handleProceed}>
          <span>Go to Export Deliverables</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

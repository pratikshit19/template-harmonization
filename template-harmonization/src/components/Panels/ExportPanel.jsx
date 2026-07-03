import React, { useState } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';
import { Harmonizer } from '../../services/harmonizer';
import { ExcelExport } from '../../services/excelExport';
import { GovernanceLog } from '../../services/governance';
import { Redline } from '../../services/redline';

export default function ExportPanel({ toast }) {
  const {
    files,
    sectionGroups,
    similarityData,
    annotations,
    clauseInventory,
    harmonizedResults,
    resetSession
  } = useHarmonize();

  const [preserveFormatting, setPreserveFormatting] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const docNames = files.map(f => f.name);

  // Generate date stamp
  const dateStamp = () => new Date().toISOString().slice(0, 10);

  // Totals for Excel info
  let totalTags = 0, totalCLIs = 0;
  for (const ann of Object.values(annotations)) {
    totalTags += (ann.smartTags || []).length;
    totalCLIs += (ann.cliCandidates || []).length;
  }

  const variationCount = harmonizedResults.reduce((sum, h) => sum + (h.variations || []).length, 0);

  const handleExportDocx = async () => {
    try {
      await Harmonizer.downloadAsDocx(harmonizedResults, `harmonized-template-${dateStamp()}.docx`);
      GovernanceLog.log('export_docx', { sections: harmonizedResults.length });
      toast('Harmonized template downloaded!', 'success');
    } catch (err) {
      console.error(err);
      toast(`DOCX export failed: ${err.message}`, 'error');
      // Fallback
      const content = Harmonizer.buildDocument(harmonizedResults, 'Harmonized Contract Template');
      Harmonizer.downloadAsText(content, `harmonized-template-${dateStamp()}.txt`);
      toast('Downloaded text fallback.', 'warning');
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = ExcelExport.generate(
        sectionGroups,
        harmonizedResults,
        docNames,
        annotations,
        clauseInventory,
        similarityData
      );
      ExcelExport.download(wb, `clm-config-${dateStamp()}.xlsx`);
      GovernanceLog.log('export_excel', { sheets: 9 });
      toast('CLM Configuration Excel downloaded!', 'success');
    } catch (err) {
      toast(`Excel export failed: ${err.message}`, 'error');
    }
  };

  const handleExportLog = () => {
    GovernanceLog.exportJSON();
    toast('Audit log downloaded!', 'success');
  };

  const handleExportRedline = () => {
    try {
      Redline.downloadRedlineHTML(harmonizedResults, sectionGroups, docNames);
      GovernanceLog.log('export_redline', { sections: harmonizedResults.length });
      toast('Redlined document downloaded!', 'success');
    } catch (err) {
      toast(`Redline export failed: ${err.message}`, 'error');
    }
  };

  const handleStartOver = () => {
    if (window.confirm('Start a new session? This will clear all current data.')) {
      resetSession();
    }
  };

  // Build plain text preview
  const previewContent = harmonizedResults
    .map(h => {
      let text = `${h.groupName.toUpperCase()} [${h.similarityLevel || '?'}]\n${'─'.repeat(50)}\n`;
      text += `STANDARD: ${h.standardClause || h.harmonized || ''}`;
      if (h.variations && h.variations.length > 0) {
        h.variations.forEach((v, i) => {
          text += `\n\nVARIATION ${i + 1} (${v.docName}): ${v.clause}`;
        });
      }
      return text;
    })
    .join('\n\n');

  return (
    <section className="step-panel active" id="panel-export">
      <div className="export-hero">
        <div className="export-success-icon">✓</div>
        <h2>Harmonization Complete</h2>
        <p id="export-summary-text">
          {harmonizedResults.length} sections harmonized from {files.length} documents.{' '}
          {harmonizedResults.filter(h => h.sourceCount > 1).length} sections merged.{' '}
          {variationCount} variation clause{variationCount !== 1 ? 's' : ''} identified.
        </p>
      </div>

      <div className="export-cards">
        {/* DOCX Card */}
        <div className="export-card" id="export-card-docx">
          <div className="export-card-icon">📄</div>
          <h3>Harmonized Template</h3>
          <p>Standard clauses + variation clauses in a single document.</p>
          <div className="export-meta" id="export-docx-meta">
            {harmonizedResults.length} sections · Standard + variation clauses
          </div>
          <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="preserve-formatting"
              style={{ marginRight: '6px' }}
              checked={preserveFormatting}
              onChange={(e) => setPreserveFormatting(e.target.checked)}
            />{' '}
            Preserve original formatting
          </label>
          <button className="btn-primary" id="btn-export-docx" onClick={handleExportDocx}>
            Download DOCX
          </button>
        </div>

        {/* Excel Card */}
        <div className="export-card">
          <div className="export-card-icon">📊</div>
          <h3>CLM Configuration Excel</h3>
          <p>Full config: Clause Library, Smart Tags, CLI Table, Assembly Logic, Variance Matrix, and Audit Log.</p>
          <div className="export-meta" id="export-excel-meta" style={{ fontSize: '11px', lineHeight: 1.4 }}>
            9 sheets: Summary &amp; Reduction, Clause Inventory, Harmonization Matrix, Redundancy Report, Clause Library ({totalCLIs} CLIs), Smart Tags ({totalTags}), Assembly Logic, Conflict Log, Audit Trail
          </div>
          <button className="btn-primary" id="btn-export-excel" onClick={handleExportExcel}>
            Download Excel
          </button>
        </div>

        {/* Governance Audit Log Card */}
        <div className="export-card export-card-governance">
          <div className="export-card-icon">🔒</div>
          <h3>Governance Log</h3>
          <p>Full audit trail of all AI actions for IBM/Sirion approval records.</p>
          <div className="export-meta" id="export-log-meta">
            {GovernanceLog.getAll().length} log entries
          </div>
          <button className="btn-secondary" id="btn-export-log" onClick={handleExportLog}>
            Download Audit Log
          </button>
        </div>

        {/* Redline HTML Card */}
        <div className="export-card export-card-redline">
          <div className="export-card-icon">🔴</div>
          <h3>Redlined Document</h3>
          <p>Track-changes view showing every word added or removed — per source document vs standard clause.</p>
          <div className="export-meta" id="export-redline-meta" style={{ fontSize: '11px', lineHeight: 1.4 }}>
            {harmonizedResults.length} sections · Word-level diff per source document vs standard clause
          </div>
          <button
            className="btn-primary"
            id="btn-export-redline"
            style={{ background: 'linear-gradient(135deg,#cc0000,#ff5c7a)' }}
            onClick={handleExportRedline}
          >
            Download Redline (HTML)
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="harmonized-preview">
        <div className="preview-header">
          <h3>Preview — Harmonized Template</h3>
          <button
            className="btn-ghost btn-sm"
            id="btn-toggle-preview"
            onClick={() => setPreviewExpanded(!previewExpanded)}
          >
            {previewExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        <div className={`preview-body ${previewExpanded ? 'expanded' : ''}`} id="preview-body">
          {previewContent}
        </div>
      </div>

      <div className="step-actions start-over-actions">
        <button className="btn-ghost" id="btn-start-over" onClick={handleStartOver}>
          ↺ Start New Session
        </button>
      </div>
    </section>
  );
}

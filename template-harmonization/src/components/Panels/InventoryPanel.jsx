import React, { useState } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

export default function InventoryPanel() {
  const { clauseInventory, setCurrentStep, markStepComplete, unlockStep } = useHarmonize();
  const [searchQuery, setSearchQuery] = useState('');

  const escHtml = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const shortenDocName = (name) => {
    return name.replace(/\.docx?$/i, '').slice(0, 22) + (name.length > 26 ? '…' : '');
  };

  // Filter inventory based on search query
  const query = searchQuery.toLowerCase().trim();
  const filtered = clauseInventory.filter(c => {
    if (!query) return true;
    return c.id.toLowerCase().includes(query) || 
           c.docName.toLowerCase().includes(query) || 
           c.heading.toLowerCase().includes(query) || 
           c.content.toLowerCase().includes(query);
  }).sort((a, b) => a.heading.localeCompare(b.heading));

  const handleProceed = () => {
    markStepComplete('inventory');
    unlockStep('extract');
    setCurrentStep('extract');
  };

  return (
    <section className="step-panel active" id="panel-inventory">
      <div className="results-header">
        <h3>Decomposed Clause Inventory</h3>
        <p>Explore all individual clauses parsed from the uploaded templates. Each clause has been assigned a unique Clause ID for traceability.</p>
      </div>

      <div className="inventory-controls" style={{ marginBottom: '20px', display: 'flex', gap: '16px' }}>
        <input
          type="text"
          id="inventory-search"
          placeholder="Search by text, Clause ID, template name, or heading..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div className="inventory-table-wrapper" style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)', width: '100px' }}>Clause ID</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)', width: '180px' }}>Template Source</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)', width: '200px' }}>Section / Clause Name</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Content Preview</th>
            </tr>
          </thead>
          <tbody id="inventory-table-body">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  No matching clauses found.
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--cyan)' }}>{c.id}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{shortenDocName(c.docName)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.heading}</td>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      maxWidth: '400px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={c.content}
                  >
                    {c.content}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="step-actions">
        <button className="btn-primary btn-lg" id="btn-proceed-to-extract" onClick={handleProceed}>
          <span>Analyze &amp; Group Sections</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}

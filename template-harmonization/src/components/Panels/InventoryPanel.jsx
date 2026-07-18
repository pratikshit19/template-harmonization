import React, { useState, useEffect } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';
import { AIEngine } from '../../services/aiEngine';
import { VectorStore } from '../../services/vectorStore';

/**
 * InventoryPanel Component.
 * Displays a searchable tabular inventory of all parsed individual clauses across the templates,
 * mapping each clause to its target file source, header, text preview, and ID.
 * 
 * @returns {React.ReactElement} The render interface.
 */
export default function InventoryPanel() {
  const { clauseInventory, setCurrentStep, markStepComplete, unlockStep } = useHarmonize();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState({}); // { [clauseId]: score }
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isSemanticSearch || !searchQuery.trim() || clauseInventory.length === 0) {
      setSemanticResults({});
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryEmbedding = await AIEngine.getEmbedding(searchQuery);
        const matches = VectorStore.search(queryEmbedding, 0.1, 100);
        const scores = {};
        matches.forEach(m => {
          scores[m.id] = m.similarityScore;
        });
        setSemanticResults(scores);
      } catch (err) {
        console.error('Semantic search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, isSemanticSearch, clauseInventory]);

  /**
   * Escapes HTML markup characters.
   * 
   * @param {string} str - Raw text context.
   * @returns {string} Escaped string content.
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

  // Filter and sort inventory based on search mode
  let filtered = [];
  if (isSemanticSearch && searchQuery.trim()) {
    filtered = clauseInventory
      .map(c => ({
        ...c,
        similarityScore: semanticResults[c.id] || 0
      }))
      .filter(c => c.similarityScore > 0.35) // Filter out weak matches
      .sort((a, b) => b.similarityScore - a.similarityScore);
  } else {
    const query = searchQuery.toLowerCase().trim();
    filtered = clauseInventory.filter(c => {
      if (!query) return true;
      return c.id.toLowerCase().includes(query) || 
             c.docName.toLowerCase().includes(query) || 
             c.heading.toLowerCase().includes(query) || 
             c.content.toLowerCase().includes(query);
    }).sort((a, b) => a.heading.localeCompare(b.heading));
  }

  /**
   * Navigates the workflow step forward to the Section Heatmap/Harmonization panel.
   */
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

      <div className="inventory-controls" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            id="inventory-search"
            placeholder={isSemanticSearch ? "Enter semantic topic/concept query (e.g. 'limitation of liability')..." : "Search by text, Clause ID, template name, or heading..."}
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
          <button
            className={`btn-toggle-search ${isSemanticSearch ? 'active' : ''}`}
            onClick={() => {
              setIsSemanticSearch(!isSemanticSearch);
              setSemanticResults({});
            }}
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius-md)',
              border: isSemanticSearch ? '1px solid var(--cyan)' : '1px solid var(--border)',
              background: isSemanticSearch ? 'rgba(0, 180, 216, 0.1)' : 'var(--bg-card)',
              color: isSemanticSearch ? 'var(--cyan)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              height: '46px'
            }}
          >
            <span>🧠 Semantic Search</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 5px',
              background: isSemanticSearch ? 'var(--cyan)' : 'var(--border)',
              color: isSemanticSearch ? '#000' : 'var(--text-muted)',
              borderRadius: '4px'
            }}>
              {isSemanticSearch ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
        {isSearching && (
          <div style={{ fontSize: '12px', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--cyan)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
            <span>Generating embedding and searching local vector database...</span>
          </div>
        )}
      </div>

      <div className="inventory-table-wrapper" style={{ overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-secondary)', width: '180px' }}>Clause ID</th>
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
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{c.id}</span>
                    {isSemanticSearch && searchQuery.trim() && c.similarityScore !== undefined && (
                      <span 
                        className="similarity-badge" 
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          background: c.similarityScore >= 0.7 ? 'rgba(0, 168, 107, 0.15)' : c.similarityScore >= 0.5 ? 'rgba(230, 168, 0, 0.15)' : 'rgba(204, 51, 51, 0.15)',
                          color: c.similarityScore >= 0.7 ? '#00A86B' : c.similarityScore >= 0.5 ? '#E6A800' : '#CC3333',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {Math.round(c.similarityScore * 100)}% Match
                      </span>
                    )}
                  </td>
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

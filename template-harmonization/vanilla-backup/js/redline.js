/**
 * redline.js
 * Word-level diff engine + redline document renderer
 *
 * Produces classic track-changes style output:
 *  - Deleted words: red + strikethrough
 *  - Added words:   green + underline
 *  - Unchanged:     normal
 */

const Redline = (() => {

  /* ── TOKENIZER ──────────────────────────────────────── */
  /**
   * Splits text into tokens (words + punctuation + whitespace)
   * preserving spacing so the reconstructed text is faithful.
   */
  function tokenize(text) {
    // Split on word boundaries but keep whitespace as separate tokens
    return text.match(/\S+|\s+/g) || [];
  }

  /* ── LCS DIFF (Myers-inspired, O(ND)) ──────────────── */
  /**
   * Computes the diff between two token arrays using LCS.
   * Returns an array of operations: { type: 'equal'|'insert'|'delete', tokens: [...] }
   */
  function diff(tokensA, tokensB) {
    const m = tokensA.length;
    const n = tokensB.length;

    // dp[i][j] = length of LCS of tokensA[0..i-1] and tokensB[0..j-1]
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (tokensA[i - 1] === tokensB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build diff ops
    const ops = [];
    let i = m, j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
        ops.push({ type: 'equal', token: tokensA[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'insert', token: tokensB[j - 1] });
        j--;
      } else {
        ops.push({ type: 'delete', token: tokensA[i - 1] });
        i--;
      }
    }

    return ops.reverse();
  }

  /* ── MERGE CONSECUTIVE OPS ──────────────────────────── */
  function mergeOps(ops) {
    const merged = [];
    for (const op of ops) {
      if (merged.length > 0 && merged[merged.length - 1].type === op.type) {
        merged[merged.length - 1].tokens.push(op.token);
      } else {
        merged.push({ type: op.type, tokens: [op.token] });
      }
    }
    return merged;
  }

  /* ── RENDER DIFF AS HTML ────────────────────────────── */
  /**
   * @param {string} original  - Source text (one document's version)
   * @param {string} harmonized - AI-harmonized master text
   * @returns {string} HTML string with <del> and <ins> markup
   */
  function renderDiffHTML(original, harmonized) {
    const tokA = tokenize(original);
    const tokB = tokenize(harmonized);
    const ops  = mergeOps(diff(tokA, tokB));

    let html = '';
    for (const op of ops) {
      const text = escHtmlInline(op.tokens.join(''));
      if (op.type === 'equal') {
        html += `<span class="rl-equal">${text}</span>`;
      } else if (op.type === 'delete') {
        html += `<del class="rl-delete">${text}</del>`;
      } else {
        html += `<ins class="rl-insert">${text}</ins>`;
      }
    }
    return html;
  }

  /* ── COMPUTE STATS ──────────────────────────────────── */
  function diffStats(original, harmonized) {
    const tokA = tokenize(original);
    const tokB = tokenize(harmonized);
    const ops  = diff(tokA, tokB);

    let added = 0, deleted = 0, unchanged = 0;
    for (const op of ops) {
      if (op.type === 'insert')  added++;
      else if (op.type === 'delete') deleted++;
      else unchanged++;
    }
    const total = tokA.length || 1;
    const changeRate = Math.round(((added + deleted) / total) * 100);

    return { added, deleted, unchanged, changeRate };
  }

  /* ── GENERATE FULL REDLINE HTML DOCUMENT ───────────── */
  /**
   * Generates a standalone HTML file showing all sections redlined
   * against a chosen source (first occurrence per group by default).
   */
  function generateRedlineDocument(harmonizedResults, sectionGroups, docNames) {
    const now = new Date().toLocaleString();

    const sectionsHTML = harmonizedResults.map(h => {
      // Find the source group to get original variants
      const group = sectionGroups.find(g => g.groupName === h.groupName);
      if (!group || group.sections.length === 0) return '';

      const standardText = h.standardClause || h.harmonized || '';
      const variantBlocks = group.sections.map(sec => {
        const diffHTML = renderDiffHTML(sec.content, standardText);
        const stats    = diffStats(sec.content, standardText);
        return `
          <div class="source-block">
            <div class="source-label">
              <span class="doc-badge">📄 ${escHtmlInline(sec.docName)}</span>
              <span class="stats-badge">
                <span class="stat-add">+${stats.added} added</span>
                <span class="stat-del">-${stats.deleted} removed</span>
                <span class="stat-pct">${stats.changeRate}% changed</span>
              </span>
            </div>
            <div class="diff-content">${diffHTML}</div>
          </div>`;
      }).join('');

      return `
        <section class="rl-section">
          <div class="rl-section-header">
            <h2>${escHtmlInline(h.groupName)}</h2>
            <span class="source-count">${h.sourceCount} source document${h.sourceCount !== 1 ? 's' : ''}</span>
          </div>

          <div class="harmonized-block">
            <div class="block-label">✦ Standard Clause [${escHtmlInline(h.similarityLevel || '?')}]</div>
            <div class="harmonized-text">${escHtmlInline(standardText)}</div>
            ${h.rationale ? `<div class="rationale">💡 ${escHtmlInline(h.rationale)}</div>` : ''}
          </div>

          <div class="redline-label">🔴 Redline: Original → Standard Clause (per source document)</div>
          ${variantBlocks}
        </section>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Redlined Template — Harmonize by Sirion</title>
  <style>
    :root {
      --del-bg: #fff0f0; --del-color: #cc0000;
      --ins-bg: #f0fff4; --ins-color: #007a33;
      --border: #e0e0e0; --header-bg: #f5f7fa;
      --blue: #0066cc; --teal: #00b4d8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 13px; color: #1a1a1a; background: #fff; max-width: 1100px; margin: 0 auto; padding: 40px 48px; }
    .doc-header { border-bottom: 3px solid var(--blue); padding-bottom: 20px; margin-bottom: 36px; }
    .doc-header h1 { font-size: 24px; font-weight: 700; color: var(--blue); letter-spacing: -0.5px; }
    .doc-header .meta { font-size: 12px; color: #666; margin-top: 6px; font-family: Arial, sans-serif; }
    .legend { display: flex; gap: 24px; margin: 20px 0; font-family: Arial, sans-serif; font-size: 12px; padding: 12px 16px; background: #fafafa; border: 1px solid var(--border); border-radius: 6px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    del.sample { color: var(--del-color); background: var(--del-bg); text-decoration: line-through; padding: 1px 4px; border-radius: 2px; }
    ins.sample { color: var(--ins-color); background: var(--ins-bg); text-decoration: underline; padding: 1px 4px; border-radius: 2px; text-decoration-color: var(--ins-color); }
    .rl-section { margin-bottom: 48px; page-break-inside: avoid; }
    .rl-section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--blue); }
    .rl-section-header h2 { font-size: 16px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px; }
    .source-count { font-size: 11px; color: #888; font-family: Arial, sans-serif; }
    .harmonized-block { background: #f0f8ff; border: 1px solid #b3d9f7; border-left: 4px solid var(--teal); border-radius: 4px; padding: 16px; margin-bottom: 20px; }
    .block-label { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--teal); font-family: Arial, sans-serif; margin-bottom: 8px; }
    .harmonized-text { line-height: 1.8; white-space: pre-wrap; }
    .rationale { margin-top: 12px; font-size: 11px; color: #555; font-style: italic; font-family: Arial, sans-serif; border-top: 1px solid #b3d9f7; padding-top: 10px; }
    .redline-label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #cc0000; font-family: Arial, sans-serif; margin-bottom: 12px; }
    .source-block { margin-bottom: 20px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
    .source-label { display: flex; align-items: center; justify-content: space-between; background: var(--header-bg); padding: 8px 14px; border-bottom: 1px solid var(--border); font-family: Arial, sans-serif; font-size: 11px; }
    .doc-badge { font-weight: 600; color: #444; }
    .stats-badge { display: flex; gap: 12px; }
    .stat-add { color: var(--ins-color); font-weight: 600; }
    .stat-del { color: var(--del-color); font-weight: 600; }
    .stat-pct { color: #888; }
    .diff-content { padding: 14px 16px; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }
    del.rl-delete { color: var(--del-color); background: var(--del-bg); text-decoration: line-through; border-radius: 2px; }
    ins.rl-insert { color: var(--ins-color); background: var(--ins-bg); text-decoration: underline; text-decoration-color: var(--ins-color); border-radius: 2px; }
    span.rl-equal { color: #1a1a1a; }
    .doc-footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: #aaa; font-family: Arial, sans-serif; text-align: center; }
    @media print { body { padding: 20px; } .rl-section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>🔴 Redlined Contract Template</h1>
    <div class="meta">
      Generated by Harmonize · Sirion AI Platform · ${now}<br/>
      Documents analysed: ${docNames.length > 0 ? escHtmlInline(docNames.join(', ')) : '—'}<br/>
      Total sections: ${harmonizedResults.length}
    </div>
  </div>

  <div class="legend">
    <strong style="font-family:Arial;font-size:12px;">Legend:</strong>
    <div class="legend-item"><del class="sample">deleted text</del><span>— removed from original</span></div>
    <div class="legend-item"><ins class="sample">inserted text</ins><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script><span>— added in harmonized version</span></div>
    <div class="legend-item"><span style="color:#333;">unchanged text</span><span>— kept as-is</span></div>
  </div>

  ${sectionsHTML}

  <div class="doc-footer">
    Confidential — Sirion AI Harmonization Platform · Generated ${now}
  </div>
</body>
</html>`;
  }

  /* ── INLINE HELPER (no DOM dep) ─────────────────────── */
  function escHtmlInline(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── PUBLIC API ─────────────────────────────────────── */
  function downloadRedlinePDF(harmonizedResults, sectionGroups, docNames) {
    const html = generateRedlineDocument(harmonizedResults, sectionGroups, docNames);
    // Use jsPDF to convert HTML to PDF and trigger download.
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // jsPDF's html method accepts a callback when rendering is done.
    doc.html(html, {
      callback: function (doc) {
        doc.save(`redlined-template-${new Date().toISOString().slice(0,10)}.pdf`);
      },
      x: 10,
      y: 10,
      width: 190 // fit within page width
    });
  }

  function downloadRedlineHTML(harmonizedResults, sectionGroups, docNames) {
    const html = generateRedlineDocument(harmonizedResults, sectionGroups, docNames);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    FileSaver.saveAs(blob, `redlined-template-${new Date().toISOString().slice(0,10)}.html`);
  }

  return { renderDiffHTML, diffStats, downloadRedlineHTML, downloadRedlinePDF };
})();

/**
 * DiffDetector — Deterministic difference detection between clause variants.
 *
 * Detects: value mismatches (%, $, days, months), missing obligations,
 * party name differences, liability cap differences, and date differences.
 * Zero LLM calls.
 */
export const DiffDetector = (() => {

  /**
   * Regex patterns to extract typed values from clause text.
   * Each key maps to a global regex that captures all occurrences.
   */
  const FIELD_PATTERNS = {
    PERCENTAGE:     /(\d+(?:\.\d+)?)\s*%/g,
    CURRENCY_USD:   /USD\s*[\d,]+(?:\.\d+)?|\$\s*[\d,]+(?:\.\d+)?/gi,
    CURRENCY_GBP:   /GBP\s*[\d,]+(?:\.\d+)?|£\s*[\d,]+(?:\.\d+)?/gi,
    CURRENCY_EUR:   /EUR\s*[\d,]+(?:\.\d+)?|€\s*[\d,]+(?:\.\d+)?/gi,
    DAYS:           /(\d+)\s*(?:calendar\s+|business\s+|working\s+)?days?(?!\s*%)/gi,
    MONTHS:         /(\d+)\s*months?/gi,
    YEARS:          /(\d+)\s*years?/gi,
    NOTICE_PERIOD:  /(\d+)[\s-]*(?:business|calendar|working)?\s*days?\s+(?:prior\s+)?(?:written\s+)?notice/gi,
    LIABILITY_CAP:  /(\d+)x\s+(?:the\s+)?(?:annual\s+|total\s+)?fees?|(?:one|two|three)\s+times?\s+(?:the\s+)?(?:annual\s+)?fees?/gi,
    AUTO_RENEWAL:   /auto(?:matically)?\s+renew|automatic\s+renewal/gi,
    MUTUAL_FLAG:    /\b(mutual|reciprocal|both parties)\b/gi,
    PARTY_NAMES:    /\b(Customer|Client|Buyer|Vendor|Provider|Supplier|Licensor|Licensee|Company)\b/g,
  };

  /**
   * Extracts all matched values for each field pattern from the given text.
   *
   * @param {string} text - Clause text.
   * @returns {Object} Map of field key to array of unique matched strings.
   */
  function extractFields(text) {
    const found = {};
    for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
      pattern.lastIndex = 0;
      const matches = [];
      let m;
      while ((m = pattern.exec(text)) !== null) {
        matches.push(normalizeValue(m[0]));
      }
      const unique = [...new Set(matches)];
      if (unique.length > 0) found[key] = unique;
    }
    return found;
  }

  /**
   * Normalises a matched value for stable comparison.
   * Lowercases, removes extra spaces, and strips trailing punctuation.
   *
   * @param {string} val - Raw matched string.
   * @returns {string} Normalised string.
   */
  function normalizeValue(val) {
    return val.toLowerCase().replace(/\s+/g, ' ').replace(/[,]/g, '').trim();
  }

  /**
   * Splits text into sentences using punctuation + capitalisation as boundaries.
   *
   * @param {string} text - Clause text.
   * @returns {Array<string>} Array of sentence strings.
   */
  function splitSentences(text) {
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
      .map(s => s.trim())
      .filter(s => s.length > 40);
  }

  /**
   * Computes a simple word Jaccard similarity between two text strings.
   * Ignores short stop-words.
   *
   * @param {string} textA - First text.
   * @param {string} textB - Second text.
   * @returns {number} Jaccard similarity score (0–1).
   */
  function jaccardSimilarity(textA, textB) {
    const wordsOf = t => new Set(
      t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
    );
    const setA = wordsOf(textA);
    const setB = wordsOf(textB);
    const inter = new Set([...setA].filter(w => setB.has(w)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }

  /**
   * Analyses all members of a section cluster and returns a structured diff report.
   * Purely deterministic — no LLM.
   *
   * @param {Object} cluster - Cluster object with { groupName, sections: [{docName, content}] }.
   * @returns {Object} Diff report: { hasDiffs, diffCount, diffs, summary }.
   */
  function analyzeCluster(cluster) {
    const members = cluster.sections || [];
    if (members.length < 2) {
      return { hasDiffs: false, diffCount: 0, diffs: [], summary: 'Only one source document.' };
    }

    const diffs = [];

    // Extract all fields per member
    const extracted = members.map(m => ({
      docName: m.docName,
      content: m.content || '',
      fields: extractFields(m.content || '')
    }));

    // ── Stage 1: Field-level value mismatches ─────────────────────────────────
    const allFieldKeys = new Set(extracted.flatMap(e => Object.keys(e.fields)));
    for (const key of allFieldKeys) {
      const byDoc = extracted.map(e => ({
        docName: e.docName,
        values: e.fields[key] || []
      }));

      // Collect all unique values across documents
      const allValues = new Set(byDoc.flatMap(d => d.values));

      // Only flag if there are genuinely different values (not just same value in different docs)
      if (allValues.size > 1) {
        diffs.push({
          type: 'VALUE_MISMATCH',
          field: key,
          detail: `Different ${formatFieldName(key)} values across documents`,
          byDoc,
          severity: fieldSeverity(key)
        });
      }
    }

    // ── Stage 2: Missing obligations (sentence presence) ──────────────────────
    // For each document, check if any of its sentences are absent from ALL other docs
    for (const srcEntry of extracted) {
      const sentences = splitSentences(srcEntry.content);
      for (const sent of sentences) {
        const presentInOtherDocs = extracted
          .filter(e => e.docName !== srcEntry.docName)
          .filter(e => jaccardSimilarity(sent, e.content) > 0.55);

        if (presentInOtherDocs.length === 0) {
          // Check it's not just formatting noise
          const wordCount = sent.split(/\s+/).length;
          if (wordCount >= 8) {
            diffs.push({
              type: 'MISSING_OBLIGATION',
              field: 'SENTENCE',
              detail: `Obligation present only in "${srcEntry.docName}"`,
              sentence: sent.slice(0, 200),
              sourceDoc: srcEntry.docName,
              missingFrom: extracted.filter(e => e.docName !== srcEntry.docName).map(e => e.docName),
              severity: 'medium'
            });
          }
        }
      }
    }

    // ── Stage 3: Structural / mutual flag differences ─────────────────────────
    const hasMutualArr = extracted.map(e => /\b(mutual|reciprocal|both parties)\b/i.test(e.content));
    if (hasMutualArr.some(Boolean) && !hasMutualArr.every(Boolean)) {
      diffs.push({
        type: 'MUTUAL_VS_UNILATERAL',
        field: 'MUTUALITY',
        detail: 'Some documents use mutual language, others do not',
        byDoc: extracted.map(e => ({
          docName: e.docName,
          isMutual: /\b(mutual|reciprocal|both parties)\b/i.test(e.content)
        })),
        severity: 'high'
      });
    }

    // ── Stage 4: Auto-renewal inconsistency ──────────────────────────────────
    const hasAutoRenewal = extracted.map(e => /auto(?:matically)?\s+renew|automatic\s+renewal/i.test(e.content));
    if (hasAutoRenewal.some(Boolean) && !hasAutoRenewal.every(Boolean)) {
      diffs.push({
        type: 'AUTO_RENEWAL_MISMATCH',
        field: 'AUTO_RENEWAL',
        detail: 'Some documents include automatic renewal, others do not',
        byDoc: extracted.map(e => ({
          docName: e.docName,
          hasAutoRenewal: /auto(?:matically)?\s+renew|automatic\s+renewal/i.test(e.content)
        })),
        severity: 'medium'
      });
    }

    return {
      hasDiffs: diffs.length > 0,
      diffCount: diffs.length,
      diffs,
      summary: buildSummary(diffs)
    };
  }

  /**
   * Builds a human-readable summary of the diff report.
   *
   * @param {Array<Object>} diffs - Detected differences.
   * @returns {string} Summary text.
   */
  function buildSummary(diffs) {
    if (diffs.length === 0) return 'No significant differences detected.';
    const byType = {};
    for (const d of diffs) {
      byType[d.type] = (byType[d.type] || 0) + 1;
    }
    const parts = Object.entries(byType).map(([t, n]) => `${n} ${formatTypeName(t)}`);
    return `${diffs.length} difference(s): ${parts.join(', ')}.`;
  }

  /**
   * Maps a field key to a display-friendly name.
   *
   * @param {string} key - Internal field key.
   * @returns {string} Display name.
   */
  function formatFieldName(key) {
    const map = {
      PERCENTAGE: 'percentage',
      CURRENCY_USD: 'USD currency',
      CURRENCY_GBP: 'GBP currency',
      CURRENCY_EUR: 'EUR currency',
      DAYS: 'day period',
      MONTHS: 'month period',
      YEARS: 'year period',
      NOTICE_PERIOD: 'notice period',
      LIABILITY_CAP: 'liability cap',
      AUTO_RENEWAL: 'auto-renewal',
      MUTUAL_FLAG: 'mutual obligation',
      PARTY_NAMES: 'party name'
    };
    return map[key] || key.toLowerCase();
  }

  /**
   * Maps a diff type to a display-friendly name.
   *
   * @param {string} type - Diff type key.
   * @returns {string} Display name.
   */
  function formatTypeName(type) {
    const map = {
      VALUE_MISMATCH: 'value mismatch(es)',
      MISSING_OBLIGATION: 'missing obligation(s)',
      MUTUAL_VS_UNILATERAL: 'mutuality conflict(s)',
      AUTO_RENEWAL_MISMATCH: 'auto-renewal inconsistency(ies)'
    };
    return map[type] || type.toLowerCase().replace(/_/g, ' ');
  }

  /**
   * Maps a field key to a risk severity level.
   *
   * @param {string} key - Field key.
   * @returns {string} 'high' | 'medium' | 'low'
   */
  function fieldSeverity(key) {
    if (['LIABILITY_CAP', 'MUTUAL_FLAG', 'CURRENCY_USD', 'CURRENCY_GBP', 'CURRENCY_EUR'].includes(key)) return 'high';
    if (['PERCENTAGE', 'NOTICE_PERIOD', 'DAYS', 'MONTHS', 'YEARS'].includes(key)) return 'medium';
    return 'low';
  }

  /**
   * Batch-analyses all clusters in a section groups array.
   *
   * @param {Array<Object>} sectionGroups - Section groups array.
   * @returns {Object} Map of groupName → DiffReport.
   */
  function analyzeAll(sectionGroups) {
    const result = {};
    for (const group of sectionGroups) {
      if ((group.sections || []).length >= 2) {
        result[group.groupName] = analyzeCluster(group);
      } else {
        result[group.groupName] = { hasDiffs: false, diffCount: 0, diffs: [], summary: 'Single source.' };
      }
    }
    return result;
  }

  return { analyzeCluster, analyzeAll, extractFields };
})();

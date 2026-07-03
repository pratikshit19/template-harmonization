/**
 * section-detector.js
 * Orchestrates parsing + AI grouping for section detection.
 * Uses first-level heading detection from parser.js.
 */

const SectionDetector = (() => {

  /**
   * Extract sections from parsed documents using first-level heading detection.
   * @param {Array} parsedDocs  - Output of Parser.parseAll()
   * @returns {Array} docsWithSections - [{name, sections:[{header, rawHeader, content}]}]
   */
  function extractSectionsFromDocs(parsedDocs) {
    const list = [];
    parsedDocs
      .filter(d => d.status === 'ok')
      .forEach(doc => {
        if (doc.isExcel) {
          // Group Excel sections by their docName (template name)
          const virtualDocs = {};
          (doc.sections || []).forEach(sec => {
            const dName = sec.docName || 'Excel SOW';
            if (!virtualDocs[dName]) {
              virtualDocs[dName] = {
                name: dName,
                sections: []
              };
            }
            virtualDocs[dName].sections.push({
              header: sec.header,
              rawHeader: sec.rawHeader,
              content: sec.content,
              comments: sec.comments || []
            });
          });
          
          Object.values(virtualDocs).forEach(vDoc => {
            list.push(vDoc);
          });
        } else if (doc.text) {
          list.push({
            name: doc.name,
            sections: doc.sections || Parser.detectSections(doc.text, doc.html || '')
          });
        }
      });
    return list;
  }

  /**
   * Uses AI to semantically group similar sections across docs.
   * Falls back to naive string-matching if AI fails.
   */
  async function groupSections(docsWithSections) {
    try {
      const aiGroups = await AIEngine.groupSections(docsWithSections);

      // Enrich with actual content from docs
      const docMap = {};
      for (const doc of docsWithSections) {
        docMap[doc.name] = {};
        for (const sec of doc.sections) {
          docMap[doc.name][sec.header] = sec;
          // Also map by rawHeader for backward compatibility
          if (sec.rawHeader && sec.rawHeader !== sec.header) {
            docMap[doc.name][sec.rawHeader] = sec;
          }
        }
      }

      return aiGroups.map(group => ({
        groupName: group.groupName,
        sections: (group.sections || []).map(s => {
          // Try to find content by originalHeader (which could be header or rawHeader)
          const secObj =
            (docMap[s.docName] && docMap[s.docName][s.originalHeader]) ||
            findSectionFuzzy(docMap[s.docName], s.originalHeader);
          if (!secObj) return null;
          return {
            docName: s.docName,
            originalHeader: s.originalHeader,
            content: secObj.content,
            comments: secObj.comments || []
          };
        }).filter(Boolean)
      })).filter(g => g.sections.length > 0);

    } catch (err) {
      console.warn('AI grouping failed, falling back to naive grouping:', err);
      return naiveGroup(docsWithSections);
    }
  }

  /**
   * Fuzzy section lookup — if the AI returns a slightly different header name,
   * find the closest match in the doc's sections.
   */
  function findSectionFuzzy(docSections, header) {
    if (!docSections || !header) return null;
    const normalizedTarget = normalize(header);
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, secObj] of Object.entries(docSections)) {
      const normalizedKey = normalize(key);
      // Check for substring match or high overlap
      if (normalizedKey === normalizedTarget) return secObj;
      if (normalizedKey.includes(normalizedTarget) || normalizedTarget.includes(normalizedKey)) {
        const score = Math.min(normalizedKey.length, normalizedTarget.length) / Math.max(normalizedKey.length, normalizedTarget.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = secObj;
        }
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  /**
   * Fallback: group sections by normalized header match
   */
  function naiveGroup(docsWithSections) {
    const groupMap = {};

    for (const doc of docsWithSections) {
      for (const sec of doc.sections) {
        const key = normalize(sec.header);
        if (!groupMap[key]) groupMap[key] = { groupName: sec.header, sections: [] };
        groupMap[key].sections.push({
          docName: doc.name,
          originalHeader: sec.header,
          content: sec.content,
          comments: sec.comments || []
        });
      }
    }

    return Object.values(groupMap).filter(g => g.sections.length > 0);
  }

  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  return { extractSectionsFromDocs, groupSections };
})();

import { AIEngine } from './aiEngine';
import { Parser } from './parser';

export const SectionDetector = (() => {

  /**
   * Processes successfully parsed documents and extracts section arrays.
   * Special case handling maps Excel multi-template sheets to individual virtual files.
   * 
   * @param {Array<Object>} parsedDocs - List of parsed documents.
   * @returns {Array<Object>} List of documents containing extracted section payloads.
   */
  function extractSectionsFromDocs(parsedDocs) {
    const list = [];
    parsedDocs
      .filter(d => d.status === 'ok')
      .forEach(doc => {
        if (doc.isExcel) {
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
            html: doc.html || '',
            sections: doc.sections || Parser.detectSections(doc.text, doc.html || '')
          });
        }
      });
    return list;
  }

  /**
   * Clusters section headings across multiple templates into semantic topic groups.
   * Uses AI engine-based grouping and fuzzy matching, falling back to naive case/space matching if APIs fail.
   * 
   * @param {Array<Object>} docsWithSections - Document list containing their sections.
   * @returns {Promise<Array<Object>>} Grouped list of sections.
   */
  async function groupSections(docsWithSections) {
    let rawGroups = [];
    try {
      rawGroups = await AIEngine.groupSections(docsWithSections);
    } catch (err) {
      console.warn('AI grouping failed, falling back to naive grouping:', err);
    }

    if (!rawGroups || rawGroups.length === 0) {
      rawGroups = naiveGroup(docsWithSections);
    }

    const docMap = {};
    for (const doc of docsWithSections) {
      docMap[doc.name] = {};
      for (const sec of doc.sections) {
        docMap[doc.name][sec.header] = sec;
        if (sec.rawHeader && sec.rawHeader !== sec.header) {
          docMap[doc.name][sec.rawHeader] = sec;
        }
      }
    }

    function findDocSections(targetDocName) {
      if (!targetDocName) return null;
      if (docMap[targetDocName]) return docMap[targetDocName];
      const targetNorm = targetDocName.toLowerCase().replace(/\.(docx?|xlsx?)$/i, '').trim();
      for (const [dName, sectionsObj] of Object.entries(docMap)) {
        const dNorm = dName.toLowerCase().replace(/\.(docx?|xlsx?)$/i, '').trim();
        if (dNorm === targetNorm || dNorm.includes(targetNorm) || targetNorm.includes(dNorm)) {
          return sectionsObj;
        }
      }
      return null;
    }

    function findSectionInDoc(docSections, originalHeader) {
      if (!docSections || !originalHeader) return null;
      if (docSections[originalHeader]) return docSections[originalHeader];
      const cleaned = Parser.cleanHeadingName ? Parser.cleanHeadingName(originalHeader) : originalHeader;
      if (docSections[cleaned]) return docSections[cleaned];
      return findSectionFuzzy(docSections, originalHeader);
    }

    // Step 1: Map rawGroups to actual document sections
    const resolvedGroups = rawGroups.map(group => ({
      groupName: Parser.cleanHeadingName ? Parser.cleanHeadingName(group.groupName) : group.groupName,
      sections: (group.sections || []).map(s => {
        const targetDocName = s.docName || s.doc;
        const dSections = findDocSections(targetDocName);
        const secObj = findSectionInDoc(dSections, s.originalHeader || s.header);
        if (!secObj) return null;
        return {
          docName: targetDocName && docMap[targetDocName] ? targetDocName : (secObj.docName || s.docName),
          originalHeader: s.originalHeader || s.header,
          content: secObj.content,
          comments: secObj.comments || []
        };
      }).filter(Boolean)
    })).filter(g => g.sections.length > 0);

    // Step 2: Merge groups that share the same normalized clean section title
    const mergedMap = {};
    for (const group of resolvedGroups) {
      const cleanTitle = Parser.cleanHeadingName ? Parser.cleanHeadingName(group.groupName) : group.groupName;
      const normKey = normalize(cleanTitle);
      if (!mergedMap[normKey]) {
        mergedMap[normKey] = {
          groupName: cleanTitle,
          sections: []
        };
      }
      for (const sec of group.sections) {
        const existingIdx = mergedMap[normKey].sections.findIndex(s => s.docName === sec.docName);
        if (existingIdx === -1) {
          mergedMap[normKey].sections.push(sec);
        } else {
          if ((sec.content || '').length > (mergedMap[normKey].sections[existingIdx].content || '').length) {
            mergedMap[normKey].sections[existingIdx] = sec;
          }
        }
      }
    }

    // Step 3: Safety pass to ensure every extracted section in docsWithSections is mapped into its group
    for (const doc of docsWithSections) {
      for (const sec of doc.sections) {
        const cleanHeader = Parser.cleanHeadingName ? Parser.cleanHeadingName(sec.header) : sec.header;
        const normKey = normalize(cleanHeader);
        if (mergedMap[normKey]) {
          const exists = mergedMap[normKey].sections.some(s => s.docName === doc.name);
          if (!exists) {
            mergedMap[normKey].sections.push({
              docName: doc.name,
              originalHeader: sec.header,
              content: sec.content,
              comments: sec.comments || []
            });
          }
        } else {
          mergedMap[normKey] = {
            groupName: cleanHeader,
            sections: [{
              docName: doc.name,
              originalHeader: sec.header,
              content: sec.content,
              comments: sec.comments || []
            }]
          };
        }
      }
    }

    return Object.values(mergedMap).filter(g => g.sections.length > 0);
  }

  /**
   * Performs fuzzy character matching on header titles to identify close equivalents.
   * 
   * @param {Object} docSections - Section map key-valued by headers.
   * @param {string} header - The target header to seek.
   * @returns {Object|null} Matching section object, or null if below similarity threshold.
   */
  function findSectionFuzzy(docSections, header) {
    if (!docSections || !header) return null;
    const normalizedTarget = normalize(header);
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, secObj] of Object.entries(docSections)) {
      const normalizedKey = normalize(key);
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
   * Fallback clustering that aggregates sections based on key-normalizations of headers.
   * 
   * @param {Array<Object>} docsWithSections - Document list.
   * @returns {Array<Object>} Aggregated naive section groups.
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

  /**
   * Cleans strings by converting to lowercase and stripping punctuation/multiple spaces.
   * 
   * @param {string} s - Input string.
   * @returns {string} Normalized string.
   */
  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  return { extractSectionsFromDocs, groupSections };
})();

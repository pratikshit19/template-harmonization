import { AIEngine } from './aiEngine';
import { Parser } from './parser';

export const SectionDetector = (() => {

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
            sections: doc.sections || Parser.detectSections(doc.text, doc.html || '')
          });
        }
      });
    return list;
  }

  async function groupSections(docsWithSections) {
    try {
      const aiGroups = await AIEngine.groupSections(docsWithSections);

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

      return aiGroups.map(group => ({
        groupName: group.groupName,
        sections: (group.sections || []).map(s => {
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

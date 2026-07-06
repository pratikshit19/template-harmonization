import { GovernanceLog } from './governance';
import { FileSaver } from './fileSaver';

export const ExcelExport = (() => {

  function generate(sectionGroups, harmonizedResults, docNames, annotations = {}, clauseInventory = [], similarityData = {}) {
    const XLSX = window.XLSX;
    if (!XLSX) {
      throw new Error("XLSX (SheetJS) library is not loaded. Please make sure CDN is loaded.");
    }
    const wb = XLSX.utils.book_new();

    const origTemplates = docNames.length;
    const targetTemplates = Math.max(1, Math.min(2, Math.floor(origTemplates / 3)));
    const templateReductionPct = Math.round(((origTemplates - targetTemplates) / origTemplates) * 100);

    const origClauses = clauseInventory.length;
    const targetClauses = harmonizedResults.length;
    const clauseReductionPct = origClauses > 0 ? Math.round(((origClauses - targetClauses) / origClauses) * 100) : 0;
    const duplicatesMerged = Math.max(0, origClauses - targetClauses);

    const summaryData = [
      ['SIRION AI — LEGAL TEMPLATE HARMONIZATION REPORT'],
      [`Report Generated: ${new Date().toLocaleString()}`],
      [],
      ['KPI Metrics', 'Before Harmonization', 'After Harmonization', 'Reduction % / Count'],
      ['Template Count', origTemplates, targetTemplates, `${templateReductionPct}% reduction`],
      ['Total Clauses', origClauses, targetClauses, `${clauseReductionPct}% reduction`],
      ['Duplicate Clauses Merged', '—', '—', `${duplicatesMerged} clauses merged`],
      [],
      ['Input Template Sources', 'Sections Decomposed'],
      ...docNames.map(name => {
        const count = clauseInventory.filter(c => c.docName === name).length;
        return [name, count];
      }),
      [],
      [],
      ['Template Tracking Sheet (Consolidation Action Log)'],
      ['Template Name', 'Common Content %', 'Unique Clauses', 'Recommended Action'],
      ...docNames.map(name => {
        const docClauses = clauseInventory.filter(c => c.docName === name);
        const totalClauses = docClauses.length;
        let commonCount = 0;
        docClauses.forEach(c => {
          const group = sectionGroups.find(g =>
            g.sections.some(s => s.docName === name && s.originalHeader === c.heading)
          );
          if (group && group.sections.length > 1) {
            commonCount++;
          }
        });
        const commonPercent = totalClauses > 0 ? Math.round((commonCount / totalClauses) * 100) : 0;
        const uniqueCount = totalClauses - commonCount;
        const action = commonPercent >= 50 ? 'Merge' : 'Separate Review';
        return [name, `${commonPercent}%`, uniqueCount, action];
      })
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 22 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary & Reduction');

    const inventoryHeaders = ['Clause ID', 'Template Source', 'Section / Clause Name', 'Clause Text Content'];
    const inventoryRows = clauseInventory.map(c => [
      c.id,
      c.docName,
      c.heading,
      c.content
    ]);
    const wsInventory = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryRows]);
    wsInventory['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 30 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInventory, 'Clause Inventory');

    const matrixHeaders = [
      'Original Clause ID', 
      'SOW Template', 
      'Clause Name', 
      'Original Text', 
      'Harmonized Clause Group', 
      'Harmonized Clause Text', 
      'Action (Merged/Retained)'
    ];
    const matrixRows = clauseInventory.map(c => {
      const group = sectionGroups.find(g => g.sections.some(s => s.clauseId === c.id)) || {};
      const h = harmonizedResults.find(hr => hr.groupName === group.groupName) || {};
      const standardText = h.standardClause || h.harmonized || '';
      const action = (h && h.sourceCount > 1) ? 'Merged' : 'Retained';
      return [
        c.id,
        c.docName,
        c.heading,
        c.content,
        group.groupName || '—',
        standardText,
        action
      ];
    });
    const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeaders, ...matrixRows]);
    wsMatrix['!cols'] = [
      { wch: 18 }, 
      { wch: 35 }, 
      { wch: 30 }, 
      { wch: 75 }, 
      { wch: 35 }, 
      { wch: 75 }, 
      { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Harmonization Matrix');

    const redundancyHeaders = ['Group Name', 'Count of Duplicates', 'Redundancy Description'];
    const redundancyRows = sectionGroups.map(g => {
      const dups = g.sections.length;
      return [
        g.groupName,
        dups,
        `Found in ${dups} source template(s): ${g.sections.map(s => shortenName(s.docName)).join(', ')}`
      ];
    });
    const wsRedundancy = XLSX.utils.aoa_to_sheet([redundancyHeaders, ...redundancyRows]);
    wsRedundancy['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsRedundancy, 'Redundancy Report');

    const libraryHeaders = ['Standard Clause ID', 'Clause Name', 'Standard Text', 'Variations (if any)'];
    let stdCounter = 1;
    const libraryRows = harmonizedResults.map(h => {
      const stdId = `STD-CL${String(stdCounter++).padStart(3, '0')}`;
      const varsText = h.variations && h.variations.length > 0 
        ? h.variations.map((v, i) => `Variation ${i+1} [${v.docName}]: ${v.clause}`).join('\n\n')
        : 'None';
      return [
        stdId,
        h.groupName,
        h.standardClause || h.harmonized || '',
        varsText
      ];
    });
    const wsLibrary = XLSX.utils.aoa_to_sheet([libraryHeaders, ...libraryRows]);
    wsLibrary['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 80 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsLibrary, 'Clause Library');

    const tagHeaders = ['Tag Name', 'Type', 'Section Group', 'Context'];
    const tagRows = [];
    const seenTags = new Set();
    for (const [groupName, ann] of Object.entries(annotations)) {
      if (ann.smartTags && ann.smartTags.length > 0) {
        for (const tag of ann.smartTags) {
          const key = `${tag.tag}||${groupName}`;
          if (!seenTags.has(key)) {
            seenTags.add(key);
            tagRows.push([
              tag.tag || '',
              tag.type || '',
              groupName,
              tag.context || ''
            ]);
          }
        }
      }
    }
    const wsTags = XLSX.utils.aoa_to_sheet([tagHeaders, ...tagRows]);
    wsTags['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 35 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsTags, 'Smart Tags');

    const assemblyHeaders = ['Section Group', 'Rule', 'Type', 'Affected Clause'];
    const assemblyRows = [];
    for (const [groupName, ann] of Object.entries(annotations)) {
      if (ann.assemblyLogic && ann.assemblyLogic.length > 0) {
        for (const rule of ann.assemblyLogic) {
          assemblyRows.push([
            groupName,
            rule.rule || '',
            rule.type || '',
            rule.affectedClause || ''
          ]);
        }
      }
    }
    const wsAssembly = XLSX.utils.aoa_to_sheet([assemblyHeaders, ...assemblyRows]);
    wsAssembly['!cols'] = [{ wch: 35 }, { wch: 60 }, { wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsAssembly, 'Assembly Logic');

    const conflictHeaders = ['Conflict ID', 'Section Group', 'Description', 'Status', 'Resolution Options'];
    const conflictRows = [];
    let conflictCounter = 1;
    sectionGroups.forEach(g => {
      const scores = similarityData[g.groupName] || [];
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      if (g.sections.length > 1 && avgScore !== null && avgScore < 50) {
        conflictRows.push([
          `CONF-${String(conflictCounter++).padStart(3, '0')}`,
          g.groupName,
          `Low similarity (${avgScore}%) between source versions indicates high likelihood of contradictory legal terms.`,
          'Flagged',
          'Propose variations, escalate to legal owners, or define rule selection.'
        ]);
      }
    });
    const wsConflict = XLSX.utils.aoa_to_sheet([conflictHeaders, ...conflictRows]);
    wsConflict['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 75 }, { wch: 15 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsConflict, 'Conflict Log');

    const auditHeaders = ['Log ID', 'Timestamp', 'Action', 'Details'];
    const auditRows = GovernanceLog.getAll().map(entry => [
      entry.id,
      entry.timestamp,
      entry.action,
      JSON.stringify(entry)
    ]);
    const wsAudit = XLSX.utils.aoa_to_sheet([auditHeaders, ...auditRows]);
    wsAudit['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsAudit, 'Audit Trail');

    return wb;
  }

  function download(wb, filename) {
    const XLSX = window.XLSX;
    if (!XLSX) {
      throw new Error("XLSX library is not loaded.");
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    FileSaver.saveAs(blob, filename);
  }

  function shortenName(name) {
    return name.replace(/\.docx?$/i, '').slice(0, 18);
  }

  return { generate, download };
})();

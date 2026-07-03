import { AIEngine } from './aiEngine';
import { GovernanceLog } from './governance';
import { FileSaver } from './fileSaver';

export const Harmonizer = (() => {

  async function annotateAll(sectionGroups, existingAnnotations = {}, excelSmartTags = [], onProgress) {
    const annotations = { ...existingAnnotations };
    const total = sectionGroups.length;

    for (let i = 0; i < total; i++) {
      const group = sectionGroups[i];
      if (onProgress) onProgress(i + 1, total, group.groupName);

      if (annotations[group.groupName] && !annotations[group.groupName].error && 
          (annotations[group.groupName].smartTags.length > 0 || 
           annotations[group.groupName].cliCandidates.length > 0 ||
           annotations[group.groupName].assemblyLogic.length > 0)) {
        continue;
      }

      GovernanceLog.log('annotate_section', {
        groupName: group.groupName,
        sourceCount: group.sections.length,
        sources: group.sections.map(s => s.docName)
      });

      try {
        const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
        const result = await AIEngine.annotateSection(group.groupName, variants, excelSmartTags || []);
        annotations[group.groupName] = {
          smartTags: result.smartTags || [],
          cliCandidates: result.cliCandidates || [],
          assemblyLogic: result.assemblyLogic || []
        };
      } catch (err) {
        console.error(`Failed to annotate "${group.groupName}":`, err);
        annotations[group.groupName] = {
          smartTags: [],
          cliCandidates: [],
          assemblyLogic: [],
          error: err.message
        };
      }
    }

    GovernanceLog.log('annotation_complete', {
      totalSections: total,
      totalSmartTags: Object.values(annotations).reduce((sum, a) => sum + (a.smartTags || []).length, 0),
      totalCLIs: Object.values(annotations).reduce((sum, a) => sum + (a.cliCandidates || []).length, 0)
    });

    return annotations;
  }

  async function harmonizeAll(sectionGroups, annotations, existingResults = [], onProgress) {
    const results = [ ...existingResults ];
    const total = sectionGroups.length;

    for (let i = 0; i < total; i++) {
      const group = sectionGroups[i];
      if (onProgress) onProgress(i + 1, total, group.groupName);

      const exists = results.find(r => r.groupName === group.groupName);
      if (exists && !exists.error) {
        continue;
      }

      GovernanceLog.log('harmonize_section', {
        groupName: group.groupName,
        sourceCount: group.sections.length,
        sources: group.sections.map(s => s.docName)
      });

      try {
        const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
        const sectionAnnotations = annotations ? annotations[group.groupName] : null;
        let result;

        if (variants.length === 1) {
          result = {
            similarityLevel: 'high',
            standardClause: variants[0].content,
            variations: [],
            rationale: 'Only one source document contained this section. Content used as the standard clause.'
          };
        } else {
          result = await AIEngine.harmonizeSection(group.groupName, variants, sectionAnnotations);
        }

        const fullResult = {
          groupName: group.groupName,
          sourceCount: group.sections.length,
          sources: group.sections.map(s => s.docName),
          ...result,
          harmonized: result.standardClause || ''
        };

        const existingIdx = results.findIndex(r => r.groupName === group.groupName);
        if (existingIdx >= 0) {
          results[existingIdx] = fullResult;
        } else {
          results.push(fullResult);
        }

      } catch (err) {
        console.error(`Failed to harmonize "${group.groupName}":`, err);
        const errResult = {
          groupName: group.groupName,
          error: true,
          standardClause: group.sections[0].content,
          harmonized: group.sections[0].content,
          sourceCount: group.sections.length,
          sources: group.sections.map(s => s.docName),
          similarityLevel: 'unknown',
          variations: [],
          rationale: `AI harmonization failed (${err.message}). Falling back to Document 1 content.`
        };
        const existingIdx = results.findIndex(r => r.groupName === group.groupName);
        if (existingIdx >= 0) {
          results[existingIdx] = errResult;
        } else {
          results.push(errResult);
        }
      }
    }

    GovernanceLog.log('harmonization_complete', {
      totalSections: total,
      successCount: results.filter(r => !r.error).length,
      highSimilarity: results.filter(r => r.similarityLevel === 'high').length,
      mediumSimilarity: results.filter(r => r.similarityLevel === 'medium').length,
      lowSimilarity: results.filter(r => r.similarityLevel === 'low').length
    });

    return results;
  }

  function buildDocument(harmonizedResults, docTitle = 'Harmonized Template') {
    const lines = [
      docTitle.toUpperCase(),
      '='.repeat(60),
      `Generated: ${new Date().toLocaleString()}`,
      `Sections: ${harmonizedResults.length}`,
      '',
      ''
    ];

    for (const section of harmonizedResults) {
      lines.push(section.groupName.toUpperCase());
      lines.push('-'.repeat(section.groupName.length));
      lines.push(`[Similarity: ${section.similarityLevel || 'N/A'}]`);
      lines.push('');

      lines.push('── STANDARD CLAUSE ──');
      lines.push(section.standardClause || section.harmonized || '');
      lines.push('');

      if (section.variations && section.variations.length > 0) {
        for (let i = 0; i < section.variations.length; i++) {
          const v = section.variations[i];
          lines.push(`── VARIATION ${i + 1} (${v.docName}) ──`);
          if (v.differenceNote) lines.push(`[Note: ${v.differenceNote}]`);
          lines.push(v.clause);
          lines.push('');
        }
      }

      if (section.rationale) {
        lines.push(`[AI Note: ${section.rationale}]`);
        lines.push('');
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  async function downloadAsDocx(harmonizedResults, filename = 'harmonized-template.docx') {
    const docx = window.docx;
    if (!docx) {
      throw new Error("docx library is not loaded. Please make sure CDN is loaded.");
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = docx;

    const children = [];

    children.push(new Paragraph({
      children: [new TextRun({ text: 'HARMONIZED CONTRACT TEMPLATE', bold: true, size: 32, color: '0066CC' })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }));

    children.push(new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}  |  Sections: ${harmonizedResults.length}`, size: 18, color: '888888', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));

    children.push(new Paragraph({
      border: { bottom: { color: '0066CC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { after: 300 }
    }));

    for (let i = 0; i < harmonizedResults.length; i++) {
      const section = harmonizedResults[i];
      const sectionNum = i + 1;

      children.push(new Paragraph({
        children: [new TextRun({ text: `${sectionNum}. ${section.groupName}`, bold: true, size: 28, color: '1A1A1A' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 100 }
      }));

      const simLabel = section.similarityLevel ? section.similarityLevel.toUpperCase() : 'N/A';
      const simColor = section.similarityLevel === 'high' ? '00A86B' : section.similarityLevel === 'medium' ? 'E6A800' : section.similarityLevel === 'low' ? 'CC3333' : '888888';
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `Similarity: `, size: 18, color: '888888' }),
          new TextRun({ text: simLabel, size: 18, bold: true, color: simColor }),
          new TextRun({ text: `  |  ${section.sourceCount} source document${section.sourceCount !== 1 ? 's' : ''}`, size: 18, color: '888888' })
        ],
        spacing: { after: 200 }
      }));

      children.push(new Paragraph({
        children: [new TextRun({ text: '✦ STANDARD CLAUSE', bold: true, size: 20, color: '0066CC' })],
        spacing: { before: 100, after: 80 },
        border: { bottom: { color: '0066CC', space: 1, style: BorderStyle.SINGLE, size: 2 } }
      }));

      const standardText = section.standardClause || section.harmonized || '';
      const standardParagraphs = standardText.split('\n').filter(l => l.trim());
      for (const para of standardParagraphs) {
        children.push(new Paragraph({
          children: [new TextRun({ text: para, size: 22 })],
          spacing: { after: 80 },
          indent: { left: 360 }
        }));
      }

      if (section.variations && section.variations.length > 0) {
        children.push(new Paragraph({
          spacing: { before: 200 }
        }));

        for (let vi = 0; vi < section.variations.length; vi++) {
          const v = section.variations[vi];

          children.push(new Paragraph({
            children: [
              new TextRun({ text: `VARIATION ${vi + 1}`, bold: true, size: 20, color: 'CC7A00' }),
              new TextRun({ text: ` — ${v.docName || 'Unknown Source'}`, size: 20, color: '888888' })
            ],
            spacing: { before: 160, after: 80 },
            border: { bottom: { color: 'E6A800', space: 1, style: BorderStyle.SINGLE, size: 2 } }
          }));

          if (v.differenceNote) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `📝 ${v.differenceNote}`, size: 18, italics: true, color: '666666' })],
              spacing: { after: 60 },
              indent: { left: 360 }
            }));
          }

          const varParagraphs = (v.clause || '').split('\n').filter(l => l.trim());
          for (const para of varParagraphs) {
            children.push(new Paragraph({
              children: [new TextRun({ text: para, size: 22 })],
              spacing: { after: 80 },
              indent: { left: 360 }
            }));
          }
        }
      }

      if (section.rationale) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `💡 AI Note: ${section.rationale}`, size: 18, italics: true, color: '888888' })],
          spacing: { before: 120, after: 80 },
          indent: { left: 360 }
        }));
      }

      children.push(new Paragraph({
        border: { bottom: { color: 'DDDDDD', space: 1, style: BorderStyle.SINGLE, size: 2 } },
        spacing: { before: 200, after: 200 }
      }));
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: 'Generated by Harmonize — Sirion AI Platform', size: 16, color: 'AAAAAA', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    }));

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: children
      }]
    });

    const base64 = await Packer.toBase64String(doc);
    const blob = FileSaver.base64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    FileSaver.saveAs(blob, filename);
  }

  function downloadAsText(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    FileSaver.saveAs(blob, filename);
  }

  return { annotateAll, harmonizeAll, buildDocument, downloadAsDocx, downloadAsText };
})();

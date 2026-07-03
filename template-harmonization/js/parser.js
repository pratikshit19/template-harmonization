/**
 * parser.js
 * Extracts text from DOCX files using mammoth.js
 * Detects first-level numbered headings as document sections
 */

const Parser = (() => {

  /**
   * Parse a DOCX file and extract both raw text and HTML
   */
  /**
   * Helper to extract comment texts from word/comments.xml
   */
  async function extractComments(zip) {
    const commentsFile = zip.file("word/comments.xml");
    if (!commentsFile) return {};
    
    try {
      const commentsXmlText = await commentsFile.async("text");
      const parser = new DOMParser();
      const doc = parser.parseFromString(commentsXmlText, "application/xml");
      
      const commentMap = {};
      const commentEls = doc.getElementsByTagName("w:comment");
      for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls[i];
        const id = el.getAttribute("w:id");
        
        const textParts = [];
        const tEls = el.getElementsByTagName("w:t");
        for (let j = 0; j < tEls.length; j++) {
          textParts.push(tEls[j].textContent);
        }
        const commentText = textParts.join("").trim();
        if (commentText) {
          commentMap[id] = commentText;
        }
      }
      return commentMap;
    } catch (e) {
      console.warn("Failed to parse word/comments.xml:", e);
      return {};
    }
  }

  /**
   * Helper to associate comments to detected sections based on paragraph order in word/document.xml
   */
  async function associateCommentsToSections(zip, commentMap, sections) {
    const docFile = zip.file("word/document.xml");
    if (!docFile || Object.keys(commentMap).length === 0 || sections.length === 0) return;
    
    try {
      const docXmlText = await docFile.async("text");
      const parser = new DOMParser();
      const doc = parser.parseFromString(docXmlText, "application/xml");
      
      const pEls = doc.getElementsByTagName("w:p");
      let currentSectionIdx = -1;
      
      for (let i = 0; i < pEls.length; i++) {
        const pEl = pEls[i];
        
        // Extract paragraph text
        const textParts = [];
        const tEls = pEl.getElementsByTagName("w:t");
        for (let j = 0; j < tEls.length; j++) {
          textParts.push(tEls[j].textContent);
        }
        const pText = textParts.join("").trim();
        
        // If it matches a first level heading, see if it aligns with our next section header
        if (pText && isFirstLevelHeading(pText)) {
          const nextIdx = currentSectionIdx + 1;
          if (nextIdx < sections.length) {
            currentSectionIdx = nextIdx;
          }
        }
        
        if (currentSectionIdx >= 0) {
          // Look for any comment references or comment range starts in this paragraph
          const refEls = pEl.getElementsByTagName("w:commentReference");
          const startEls = pEl.getElementsByTagName("w:commentRangeStart");
          const endEls = pEl.getElementsByTagName("w:commentRangeEnd");
          
          const ids = new Set();
          for (let j = 0; j < refEls.length; j++) {
            const id = refEls[j].getAttribute("w:id");
            if (id !== null) ids.add(id);
          }
          for (let j = 0; j < startEls.length; j++) {
            const id = startEls[j].getAttribute("w:id");
            if (id !== null) ids.add(id);
          }
          for (let j = 0; j < endEls.length; j++) {
            const id = endEls[j].getAttribute("w:id");
            if (id !== null) ids.add(id);
          }
          
          if (ids.size > 0) {
            if (!sections[currentSectionIdx].comments) {
              sections[currentSectionIdx].comments = [];
            }
            ids.forEach(id => {
              if (commentMap[id] && !sections[currentSectionIdx].comments.includes(commentMap[id])) {
                sections[currentSectionIdx].comments.push(commentMap[id]);
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn("Failed to associate comments to sections:", e);
    }
  }

  /**
   * Parse a DOCX file and extract both raw text, HTML, and comments
   */
  async function parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          // Extract both raw text and HTML for better heading detection
          const [textResult, htmlResult] = await Promise.all([
            mammoth.extractRawText({ arrayBuffer }),
            mammoth.convertToHtml({ arrayBuffer })
          ]);
          
          const sections = detectSections(textResult.value, htmlResult.value);
          
          // Try unzipping with JSZip to extract comments
          let commentsMap = {};
          try {
            if (window.JSZip) {
              const zip = await window.JSZip.loadAsync(arrayBuffer);
              commentsMap = await extractComments(zip);
              if (Object.keys(commentsMap).length > 0) {
                await associateCommentsToSections(zip, commentsMap, sections);
              }
            }
          } catch (zipErr) {
            console.warn("Failed to extract comments using JSZip:", zipErr);
          }
          
          resolve({
            name: file.name,
            size: file.size,
            text: textResult.value,
            html: htmlResult.value,
            sections: sections,
            warnings: textResult.messages
          });
        } catch (err) {
          reject(new Error(`Failed to parse ${file.name}: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse an Excel file and extract SOW clauses, conditions, notes, templates, and smart tags
   */
  async function parseXlsx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let sections = [];
          let smartTags = [];
          
          // Parse Clauses sheet
          if (workbook.Sheets['Clauses']) {
            const sheet = workbook.Sheets['Clauses'];
            // Using header: 'A' to map columns to keys A, B, C, D, E, F, G, H, I, J, K, L
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
            
            rows.forEach((row, idx) => {
              const secNum = row['A'] ? String(row['A']).trim() : null;
              const content = row['E'] ? String(row['E']).trim() : null;
              const template = row['F'] ? String(row['F']).trim() : 'Excel SOW';
              const condition = row['I'] ? String(row['I']).trim() : null;
              
              // K is standard notes, L is backup notes column
              const notes = row['K'] ? String(row['K']).trim() : (row['L'] ? String(row['L']).trim() : null);
              
              if (content && content.length > 5) {
                // Determine heading name
                const firstLine = content.split('\n')[0].trim();
                let heading = '';
                if (isFirstLevelHeading(firstLine)) {
                  heading = cleanHeadingName(firstLine);
                } else if (secNum) {
                  heading = `Section ${secNum}`;
                } else {
                  heading = 'Introductory Content';
                }
                
                const comments = [];
                if (condition) comments.push(`Condition: ${condition}`);
                if (notes) comments.push(`Notes: ${notes}`);
                
                sections.push({
                  header: heading,
                  rawHeader: firstLine || heading,
                  content: content,
                  comments: comments,
                  docName: `Excel: ${template}`
                });
              }
            });
          }
          
          // Parse Smart Tags sheet
          if (workbook.Sheets['Smart Tags']) {
            const tagSheet = workbook.Sheets['Smart Tags'];
            const tagRows = XLSX.utils.sheet_to_json(tagSheet, { header: 'A' });
            tagRows.forEach(row => {
              // Extract from column B (Smart Tag names)
              const tagName = row['B'] ? String(row['B']).trim() : null;
              if (tagName && tagName.length > 2 && !tagName.startsWith('Possible') && !tagName.startsWith('Smart Tag')) {
                smartTags.push(tagName);
              }
            });
          }
          
          resolve({
            name: file.name,
            size: file.size,
            isExcel: true,
            sections: sections,
            smartTags: smartTags,
            text: sections.map(s => s.content).join('\n\n'),
            html: '',
            warnings: []
          });
        } catch (err) {
          reject(new Error(`Failed to parse Excel ${file.name}: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Could not read Excel file: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  async function parseAll(files) {
    const results = [];
    for (const file of files) {
      try {
        let parsed;
        if (/\.xlsx$/i.test(file.name)) {
          parsed = await parseXlsx(file);
        } else {
          parsed = await parseDocx(file);
        }
        results.push({ ...parsed, status: 'ok' });
      } catch (err) {
        results.push({ name: file.name, text: '', html: '', status: 'error', error: err.message });
      }
    }
    return results;
  }

  /**
   * Try to detect sections from HTML output first (uses DOCX heading styles),
   * fall back to regex-based detection on raw text.
   */
  function detectSections(text, html) {
    // Try HTML-based detection first (more reliable for styled DOCX docs)
    if (html) {
      const htmlSections = detectSectionsFromHtml(html);
      if (htmlSections.length >= 2) {
        return htmlSections;
      }
    }
    // Fallback to regex-based detection on raw text
    return detectSectionsFromText(text);
  }

  /**
   * HTML-based section detection.
   * Looks for <h1>, <h2>, or <h3> tags that mammoth extracted from DOCX heading styles.
   * Also detects <p><strong> patterns that look like first-level numbered headings.
   */
  function detectSectionsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sections = [];
    let currentHeader = null;
    let currentContentParts = [];

    // Walk all top-level elements
    const elements = doc.body.children;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tagName = el.tagName.toLowerCase();
      const text = el.textContent.trim();

      let isHeading = false;
      let headingText = text;

      // Check if it's an actual heading tag (h1, h2, h3)
      if (['h1', 'h2', 'h3'].includes(tagName) && text.length > 2) {
        isHeading = true;
      }

      // Check if it's a bold paragraph that looks like a first-level heading
      if (!isHeading && tagName === 'p') {
        const strongEl = el.querySelector('strong');
        if (strongEl && strongEl.textContent.trim() === text && text.length > 2 && text.length < 150) {
          // Check if it matches first-level numbering pattern
          if (isFirstLevelHeading(text)) {
            isHeading = true;
          }
        }
      }

      // Also check plain text for first-level heading patterns
      if (!isHeading && text.length > 2 && text.length < 150) {
        if (isFirstLevelHeading(text)) {
          isHeading = true;
        }
      }

      if (isHeading) {
        // Save previous section
        if (currentHeader !== null) {
          sections.push({
            header: cleanHeadingName(currentHeader),
            rawHeader: currentHeader,
            content: currentContentParts.join('\n').trim()
          });
        }
        currentHeader = headingText;
        currentContentParts = [];
      } else if (currentHeader !== null) {
        currentContentParts.push(text);
      }
    }

    // Don't forget the last section
    if (currentHeader !== null && currentContentParts.join('').trim()) {
      sections.push({
        header: cleanHeadingName(currentHeader),
        rawHeader: currentHeader,
        content: currentContentParts.join('\n').trim()
      });
    }

    return sections;
  }

  /**
   * Regex-based section detection from raw text.
   * Only detects FIRST-LEVEL numbered headings.
   */
  function detectSectionsFromText(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentHeader = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed && isFirstLevelHeading(trimmed)) {
        // Save previous section
        if (currentHeader !== null) {
          sections.push({
            header: cleanHeadingName(currentHeader),
            rawHeader: currentHeader,
            content: currentContent.join('\n').trim()
          });
        }
        currentHeader = trimmed;
        currentContent = [];
      } else if (currentHeader !== null) {
        currentContent.push(line);
      }
    }

    // Last section
    if (currentHeader !== null && currentContent.join('').trim()) {
      sections.push({
        header: cleanHeadingName(currentHeader),
        rawHeader: currentHeader,
        content: currentContent.join('\n').trim()
      });
    }

    // If no headings found, treat whole doc as one block
    if (sections.length === 0 && text.trim()) {
      sections.push({
        header: 'Document Content',
        rawHeader: 'Document Content',
        content: text.trim()
      });
    }

    return sections;
  }

  /**
   * Determines if a line is a FIRST-LEVEL numbered heading.
   * 
   * ✅ Matches:
   *   "1. Overview and Approach"
   *   "2. Charges"
   *   "10. Governing Law"
   *   "1  Overview and Approach"  (number + spaces + title)
   *   "Section 1. Overview"
   *   "Section 1 - Overview"
   *   "Article 1: Overview"
   *   "ARTICLE I. DEFINITIONS"
   *   "ARTICLE II — SCOPE OF WORK"
   * 
   * ❌ Rejects:
   *   "1.1 Sub-heading"
   *   "1.1.1 Sub-sub"
   *   "a) item"
   *   "(i) item"
   *   "694907E"
   *   "{MM/DD/YYYY}"
   *   Lines that are just numbers or codes
   */
  function isFirstLevelHeading(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return false;
    if (trimmed.length > 200) return false;

    // Reject lines that look like dates, codes, or reference numbers
    if (/^\{.*\}$/.test(trimmed)) return false;           // {MM/DD/YYYY}
    if (/^[A-Z0-9]{5,}$/.test(trimmed)) return false;     // 694907E (codes)
    if (/^\d{4,}/.test(trimmed)) return false;             // Long number sequences
    if (/^\+\+\+/.test(trimmed)) return false;             // +++ markers

    // Pattern 1: "1. Title" or "1 Title" (single integer, not decimal)
    // Must have a title part after the number
    if (/^\d{1,3}[\.\)\s]\s*[A-Za-z]/.test(trimmed)) {
      // Reject sub-numbering: 1.1, 2.3, etc.
      if (/^\d+\.\d+/.test(trimmed)) return false;
      // Must have meaningful title text (not just a number + short word)
      const titlePart = trimmed.replace(/^\d{1,3}[\.\)\s]\s*/, '');
      if (titlePart.length < 3) return false;
      return true;
    }

    // Pattern 1b: "X. Title" or "X Title" or "x. Title" (literal X placeholder for unnumbered headings)
    if (/^[Xx][\.\)\s]\s*[A-Za-z]/.test(trimmed)) {
      // Reject sub-numbering: X.1, x.2, etc. (since we want first level only)
      if (/^[Xx]\.\d+/.test(trimmed)) return false;
      if (/^[Xx]\.[Xx]/.test(trimmed)) return false;
      const titlePart = trimmed.replace(/^[Xx][\.\)\s]\s*/, '');
      if (titlePart.length < 3) return false;
      return true;
    }

    // Pattern 2: "Section X" or "SECTION X" (with optional title after)
    if (/^Section\s+(\d+|[Xx])/i.test(trimmed)) return true;

    // Pattern 3: "Article X" or "ARTICLE X" or "ARTICLE I/II/III/IV/V"
    if (/^Article\s+(\d+|[IVX]+|[Xx])/i.test(trimmed)) return true;

    // Pattern 4: "SCHEDULE X" or "EXHIBIT X"
    if (/^(Schedule|Exhibit)\s+(\d+|[A-Z]|[Xx])/i.test(trimmed)) return true;

    return false;
  }

  /**
   * Clean up heading name by removing the number prefix.
   * "1. Overview and Approach" → "Overview and Approach"
   * "Section 1. Overview" → "Overview"
   * "ARTICLE II - SCOPE" → "SCOPE"
   */
  function cleanHeadingName(header) {
    let cleaned = header.trim();

    // Remove "Section X.", "Section X -", "Section X:"
    cleaned = cleaned.replace(/^Section\s+(\d+|[Xx])[\.\:\-–—]?\s*/i, '');

    // Remove "Article X.", "ARTICLE II.", "ARTICLE II -"
    cleaned = cleaned.replace(/^Article\s+(\d+|[IVX]+|[Xx])[\.\:\-–—]?\s*/i, '');

    // Remove "Schedule X." / "Exhibit X."
    cleaned = cleaned.replace(/^(Schedule|Exhibit)\s+(\d+|[A-Z]|[Xx])[\.\:\-–—]?\s*/i, '');

    // Remove leading number or literal X placeholder: "1. ", "1) ", "X. ", "x. "
    cleaned = cleaned.replace(/^[0-9Xx]{1,3}[\.\)\:\-–—]?\s*/, '');

    // Trim and clean up any remaining leading/trailing punctuation
    cleaned = cleaned.replace(/^[\-–—\.\:\s]+/, '').trim();

    // If cleaning removed everything, use original
    if (!cleaned || cleaned.length < 2) cleaned = header.trim();

    return cleaned;
  }

  return { parseAll, detectSections, isFirstLevelHeading, cleanHeadingName };
})();

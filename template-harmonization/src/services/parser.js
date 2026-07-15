export const Parser = (() => {

  /**
   * Extracts comments from a Word document zip archive.
   * Parses the `word/comments.xml` file inside the zip to map comment IDs to their clean text content.
   * 
   * @param {Object} zip - The JSZip object containing the loaded DOCX file.
   * @returns {Promise<Object>} An object mapping comment IDs to their corresponding text.
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
   * Associates the extracted Word document comments to their matching document sections.
   * Scans `word/document.xml` for comment references and attaches them to the corresponding section objects.
   * 
   * @param {Object} zip - The JSZip object containing the loaded DOCX file.
   * @param {Object} commentMap - A map of comment IDs to comment texts.
   * @param {Array<Object>} sections - The array of detected sections in the document.
   * @returns {Promise<void>}
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
        
        const textParts = [];
        const tEls = pEl.getElementsByTagName("w:t");
        for (let j = 0; j < tEls.length; j++) {
          textParts.push(tEls[j].textContent);
        }
        const pText = textParts.join("").trim();
        
        if (pText && isFirstLevelHeading(pText)) {
          const nextIdx = currentSectionIdx + 1;
          if (nextIdx < sections.length) {
            currentSectionIdx = nextIdx;
          }
        }
        
        if (currentSectionIdx >= 0) {
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
   * Parses a DOCX file using mammoth to extract raw text and HTML,
   * then detects sections and associates comments found inside the document structure.
   * 
   * @param {File} file - The file object corresponding to the uploaded DOCX document.
   * @returns {Promise<Object>} A promise resolving to an object containing file metadata, full text/HTML, and detected sections.
   */
  async function parseDocx(file) {
    const mammoth = window.mammoth;
    if (!mammoth) {
      throw new Error("mammoth library is not loaded. Please make sure CDN is loaded.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const mammothOptions = {
            arrayBuffer,
            styleMap: [
              // Preserve heading styles
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
              "p[style-name='Heading 5'] => h5:fresh",
              "p[style-name='Heading 6'] => h6:fresh",
              // Title / subtitle styles
              "p[style-name='Title'] => h1.doc-title:fresh",
              "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
              // List styles
              "p[style-name='List Paragraph'] => li:fresh",
              "p[style-name='List Bullet']    => li:fresh",
              "p[style-name='List Number']    => li:fresh",
              // Character formatting
              "r[style-name='Strong']        => strong",
              "r[style-name='Emphasis']      => em",
              "r[style-name='Intense Quote'] => em.intense-quote",
              // Highlights → coloured spans
              "r[highlight='yellow']      => mark.hl-yellow",
              "r[highlight='green']       => mark.hl-green",
              "r[highlight='cyan']        => mark.hl-cyan",
              "r[highlight='magenta']     => mark.hl-magenta",
              "r[highlight='blue']        => mark.hl-blue",
              "r[highlight='red']         => mark.hl-red",
              "r[highlight='darkBlue']    => mark.hl-darkblue",
              "r[highlight='darkGreen']   => mark.hl-darkgreen",
              "r[highlight='darkRed']     => mark.hl-darkred",
              "r[highlight='darkYellow']  => mark.hl-darkyellow",
              "r[highlight='darkMagenta'] => mark.hl-darkmagenta",
              "r[highlight='darkCyan']    => mark.hl-darkcyan",
              "r[highlight='gray']        => mark.hl-gray",
              "r[highlight='darkGray']    => mark.hl-darkgray",
              // Bold / italic / underline explicit runs
              "b => strong",
              "i => em",
              "u => u",
              "strike => s",
            ],
            includeDefaultStyleMap: true,
          };
          const [textResult, htmlResult] = await Promise.all([
            mammoth.extractRawText({ arrayBuffer }),
            mammoth.convertToHtml(mammothOptions)
          ]);
          
          const sections = detectSections(textResult.value, htmlResult.value);
          
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
   * Parses an XLSX file using SheetJS, reading rows from standard templates
   * to extract clause definitions, conditions, and smart tags.
   * 
   * @param {File} file - The file object corresponding to the uploaded Excel sheet.
   * @returns {Promise<Object>} A promise resolving to an object containing extracted sections and smart tags.
   */
  async function parseXlsx(file) {
    const XLSX = window.XLSX;
    if (!XLSX) {
      throw new Error("XLSX (SheetJS) library is not loaded. Please make sure CDN is loaded.");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let sections = [];
          let smartTags = [];
          
          if (workbook.Sheets['Clauses']) {
            const sheet = workbook.Sheets['Clauses'];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 'A' });
            
            rows.forEach((row, idx) => {
              const secNum = row['A'] ? String(row['A']).trim() : null;
              const content = row['E'] ? String(row['E']).trim() : null;
              const template = row['F'] ? String(row['F']).trim() : 'Excel SOW';
              const condition = row['I'] ? String(row['I']).trim() : null;
              
              const notes = row['K'] ? String(row['K']).trim() : (row['L'] ? String(row['L']).trim() : null);
              
              if (content && content.length > 5) {
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
          
          if (workbook.Sheets['Smart Tags']) {
            const tagSheet = workbook.Sheets['Smart Tags'];
            const tagRows = XLSX.utils.sheet_to_json(tagSheet, { header: 'A' });
            tagRows.forEach(row => {
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

  /**
   * Parses multiple document files (DOCX or XLSX) and aggregates results.
   * Handles errors gracefully by attaching a status flag to each parsed document payload.
   * 
   * @param {Array<File>} files - List of uploaded files.
   * @returns {Promise<Array<Object>>} A promise resolving to an array of parsed document objects.
   */
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
   * Detects document sections. Prioritizes parsing HTML tags (H1-H3, strong paragraphs)
   * before falling back to plain text heading regex rules.
   * 
   * @param {string} text - Raw plain text of the document.
   * @param {string} html - HTML representation of the document.
   * @returns {Array<Object>} List of section objects containing header, rawHeader, and content.
   */
  function detectSections(text, html) {
    if (html) {
      const htmlSections = detectSectionsFromHtml(html);
      if (htmlSections.length >= 2) {
        return htmlSections;
      }
    }
    return detectSectionsFromText(text);
  }

  /**
   * Detects sections based on HTML structure by evaluating H1-H3 headers and styled bold paragraphs.
   * 
   * @param {string} html - HTML string to be scanned.
   * @returns {Array<Object>} List of parsed section objects.
   */
  function detectSectionsFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sections = [];
    let currentHeader = null;
    let currentContentParts = [];

    const elements = doc.body.children;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tagName = el.tagName.toLowerCase();
      const text = el.textContent.trim();

      let isHeading = false;
      let headingText = text;

      if (['h1', 'h2', 'h3'].includes(tagName) && text.length > 2) {
        isHeading = true;
      }

      if (!isHeading && tagName === 'p') {
        const strongEl = el.querySelector('strong');
        if (strongEl && strongEl.textContent.trim() === text && text.length > 2 && text.length < 150) {
          if (isFirstLevelHeading(text)) {
            isHeading = true;
          }
        }
      }

      if (!isHeading && text.length > 2 && text.length < 150) {
        if (isFirstLevelHeading(text)) {
          isHeading = true;
        }
      }

      if (isHeading) {
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
   * Detects sections based on plain text lines, identifying headings by regex rules.
   * 
   * @param {string} text - Plain text of the document.
   * @returns {Array<Object>} List of section objects with header and body text.
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

    if (currentHeader !== null && currentContent.join('').trim()) {
      sections.push({
        header: cleanHeadingName(currentHeader),
        rawHeader: currentHeader,
        content: currentContent.join('\n').trim()
      });
    }

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
   * Determines if a given text line represents a first-level heading.
   * Evaluates standard numbering (e.g., "1. Introduction"), section/article labels, and exclusions.
   * 
   * @param {string} line - The line of text to evaluate.
   * @returns {boolean} True if the line is a first-level heading, false otherwise.
   */
  function isFirstLevelHeading(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return false;
    if (trimmed.length > 200) return false;

    if (/^\{.*\}$/.test(trimmed)) return false;
    if (/^[A-Z0-9]{5,}$/.test(trimmed)) return false;
    if (/^\d{4,}/.test(trimmed)) return false;
    if (/^\+\+\+/.test(trimmed)) return false;

    if (/^\d{1,3}[\.\)\s]\s*[A-Za-z]/.test(trimmed)) {
      if (/^\d+\.\d+/.test(trimmed)) return false;
      const titlePart = trimmed.replace(/^\d{1,3}[\.\)\s]\s*/, '');
      if (titlePart.length < 3) return false;
      return true;
    }

    if (/^[Xx][\.\)\s]\s*[A-Za-z]/.test(trimmed)) {
      if (/^[Xx]\.\d+/.test(trimmed)) return false;
      if (/^[Xx]\.[Xx]/.test(trimmed)) return false;
      const titlePart = trimmed.replace(/^[Xx][\.\)\s]\s*/, '');
      if (titlePart.length < 3) return false;
      return true;
    }

    if (/^Section\s+(\d+|[Xx])/i.test(trimmed)) return true;
    if (/^Article\s+(\d+|[IVX]+|[Xx])/i.test(trimmed)) return true;
    if (/^(Schedule|Exhibit)\s+(\d+|[A-Z]|[Xx])/i.test(trimmed)) return true;

    return false;
  }

  /**
   * Cleans a heading string by removing numbering, prefixes like "Section", "Article",
   * and leading/trailing whitespace or punctuation characters.
   * 
   * @param {string} header - The raw heading string to clean.
   * @returns {string} The cleaned heading name.
   */
  function cleanHeadingName(header) {
    let cleaned = header.trim();

    cleaned = cleaned.replace(/^Section\s+(\d+|[Xx])[\.\:\-–—]?\s*/i, '');
    cleaned = cleaned.replace(/^Article\s+(\d+|[IVX]+|[Xx])[\.\:\-–—]?\s*/i, '');
    cleaned = cleaned.replace(/^(Schedule|Exhibit)\s+(\d+|[A-Z]|[Xx])[\.\:\-–—]?\s*/i, '');
    cleaned = cleaned.replace(/^[0-9Xx]{1,3}[\.\)\:\-–—]?\s*/, '');
    cleaned = cleaned.replace(/^[\-–—\.\:\s]+/, '').trim();

    if (!cleaned || cleaned.length < 2) cleaned = header.trim();

    return cleaned;
  }

  return { parseAll, detectSections, isFirstLevelHeading, cleanHeadingName };
})();

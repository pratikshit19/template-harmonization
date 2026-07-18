export const Chunker = (() => {
  /**
   * Chunks a text string into smaller segments with character size and overlap.
   * Looks back for newlines or sentence endings to avoid splitting mid-sentence.
   *
   * @param {string} text - The input text to chunk.
   * @param {number} [size=800] - Target character size per chunk.
   * @param {number} [overlap=150] - Number of characters to overlap between chunks.
   * @returns {Array<string>} List of chunked text strings.
   */
  function chunkText(text, size = 800, overlap = 150) {
    if (!text) return [];
    if (text.length <= size) return [text.trim()];

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + size;

      // Adjust boundaries to avoid splitting mid-sentence/paragraph
      if (end < text.length) {
        const segment = text.slice(start, end);
        const lastNewLine = segment.lastIndexOf('\n');
        
        if (lastNewLine > size - 150) {
          end = start + lastNewLine + 1;
        } else {
          const lastPeriod = segment.lastIndexOf('. ');
          if (lastPeriod > size - 150) {
            end = start + lastPeriod + 2;
          }
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      start = end - overlap;
      
      // Safety guard against infinite loops
      if (start >= end) {
        start = end;
      }
      if (end >= text.length) break;
    }

    return chunks;
  }

  return { chunkText };
})();

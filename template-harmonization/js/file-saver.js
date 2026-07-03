/**
 * file-saver.js
 * Robust cross-browser file download utility.
 * Ensures proper filenames (no UUID blobs) for all browsers.
 */

const FileSaver = (() => {

  /**
   * Trigger a browser download of a Blob with the given filename.
   * Works in Chrome, Edge, Firefox, Safari.
   *
   * @param {Blob}   blob     - The file content as a Blob
   * @param {string} filename - Desired filename with extension (e.g. 'report.docx')
   */
  function saveAs(blob, filename) {
    // IE / Legacy Edge
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const a = document.createElement('a');
    a.style.display = 'none';

    // Build a blob URL
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;

    // Append BEFORE clicking — required for Firefox
    document.body.appendChild(a);

    // Use a microtask delay to ensure the DOM has settled
    requestAnimationFrame(() => {
      a.click();

      // Clean up after a generous delay so the browser finishes the download
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 10000); // 10 seconds — safe for large files
    });
  }

  /**
   * Convert a base64 string to a Blob.
   * @param {string} base64 - raw base64 data (no data: prefix)
   * @param {string} mime   - MIME type
   * @returns {Blob}
   */
  function base64ToBlob(base64, mime) {
    const sliceSize = 1024;
    const byteChars = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
      const slice = byteChars.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mime });
  }

  return { saveAs, base64ToBlob };
})();

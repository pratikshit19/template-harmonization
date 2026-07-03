export const FileSaver = (() => {
  function saveAs(blob, filename) {
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const a = document.createElement('a');
    a.style.display = 'none';

    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    requestAnimationFrame(() => {
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 10000);
    });
  }

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

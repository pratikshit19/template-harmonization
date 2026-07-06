export const GovernanceLog = (() => {
  const entries = [];

  /**
   * Logs a user or system action along with contextual details and a timestamp.
   * 
   * @param {string} action - The action description.
   * @param {Object} [details={}] - Extra contextual information to log.
   * @returns {Object} The created log entry.
   */
  function log(action, details = {}) {
    const entry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      action,
      ...details
    };
    entries.push(entry);
    return entry;
  }

  /**
   * Retrieves all logged governance entries.
   * 
   * @returns {Array<Object>} Copy of the audit log entries array.
   */
  function getAll() { return [...entries]; }

  /**
   * Triggers a browser download of the logged audit trail formatted as a JSON file.
   */
  function exportJSON() {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.style.display = 'none';
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `harmonize-audit-log-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return { log, getAll, exportJSON };
})();

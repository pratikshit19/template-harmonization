/**
 * governance.js
 * Audit trail for all AI actions — satisfies SOP Section 6
 */

const GovernanceLog = (() => {
  const entries = [];

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

  function getAll() { return [...entries]; }

  function exportJSON() {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    FileSaver.saveAs(blob, `harmonize-audit-log-${new Date().toISOString().slice(0,10)}.json`);
  }

  return { log, getAll, exportJSON };
})();

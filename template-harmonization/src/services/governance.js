export const GovernanceLog = (() => {
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

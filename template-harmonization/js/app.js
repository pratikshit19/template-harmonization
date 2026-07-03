/**
 * app.js
 * Main application controller — state machine + UI orchestration
 *
 * Workflow (per SOP):
 * Setup → Upload → Section Detection → Variance Analysis → Annotation → Harmonization → Export
 */

/* ══════════════════════════════════════════════════════
   APP STATE
══════════════════════════════════════════════════════ */
const AppState = {
  currentStep: 'setup',
  files: [],           // Raw File objects
  parsedDocs: [],      // Parser output: [{name, text, html, sections}]
  docsWithSections: [],// [{name, sections:[{header, rawHeader, content}]}]
  clauseInventory: [], // Flat list of all individual decomposed clauses
  sectionGroups: [],   // [{groupName, sections:[{docName,originalHeader,content}]}]
  similarityData: {},  // { groupName: [{docA, docB, score, summary}] }
  annotations: {},     // { groupName: { smartTags, cliCandidates, assemblyLogic } }
  harmonizedResults: [],// [{groupName, similarityLevel, standardClause, variations, rationale, ...}]
};

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function toast(message, type = 'info', duration = 4000) {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = '0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function setPageTitle(title, subtitle) {
  $('page-title').textContent = title;
  $('page-subtitle').textContent = subtitle;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ══════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════ */
const STEPS = ['setup', 'upload', 'inventory', 'extract', 'annotate', 'dashboard', 'export'];

function navigateTo(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-step').forEach(s => s.classList.remove('active'));

  const panel = $(`panel-${step}`);
  const navItem = $(`nav-${step}`);
  if (panel) panel.classList.add('active');
  if (navItem) navItem.classList.add('active');

  AppState.currentStep = step;
  window.scrollTo(0, 0);
}

function unlockStep(step) {
  const navItem = $(`nav-${step}`);
  if (navItem) navItem.classList.remove('locked');
}

function markStepComplete(step) {
  const navItem = $(`nav-${step}`);
  if (navItem) {
    navItem.classList.add('completed');
    const num = navItem.querySelector('.step-number');
    if (num) num.textContent = '✓';
  }
}

/* ══════════════════════════════════════════════════════
   MODEL-SPECIFIC UI CONFIG
══════════════════════════════════════════════════════ */
const MODEL_CONFIG = {
  gemini: {
    title: 'Google Gemini API Key',
    desc: 'Enter your API key from <a id="key-card-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>. Stored locally in your browser only.',
    placeholder: 'AIza...',
    provider: 'Gemini',
    getKey: () => AIEngine.getKey(),
    setKey: (k) => AIEngine.setKey(k),
  },
  openai: {
    title: 'OpenAI API Key',
    desc: 'Enter your API key from <a id="key-card-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Platform</a>. Stored locally in your browser only.',
    placeholder: 'sk-...',
    provider: 'OpenAI',
    getKey: () => AIEngine.getOpenAiKey(),
    setKey: (k) => AIEngine.setOpenAiKey(k),
  },
  anthropic: {
    title: 'Anthropic Claude API Key',
    desc: 'Enter your API key from <a id="key-card-link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a>. Stored locally in your browser only.',
    placeholder: 'sk-ant-...',
    provider: 'Anthropic',
    getKey: () => AIEngine.getAnthropicKey(),
    setKey: (k) => AIEngine.setAnthropicKey(k),
  }
};

function getProviderFromModel(modelValue) {
  if (!modelValue) return 'gemini';
  if (modelValue.startsWith('openai')) return 'openai';
  if (modelValue.startsWith('anthropic')) return 'anthropic';
  return 'gemini';
}

function updateKeyCardUI(provider) {
  const cfg = MODEL_CONFIG[provider] || MODEL_CONFIG.gemini;
  $('key-card-title').textContent = cfg.title;
  $('key-card-desc').innerHTML = cfg.desc;
  const input = $('api-key-input');
  input.placeholder = cfg.placeholder;
  input.value = cfg.getKey() || '';
  $('page-subtitle').textContent = `Set up your ${cfg.provider} API key to begin`;
  $('connection-result').textContent = '';
  $('connection-result').className = 'connection-result';

  // Update connection status if key already present
  if (cfg.getKey()) {
    updateConnectionStatus('connected', `${cfg.provider} key saved`);
  } else {
    updateConnectionStatus('disconnected', 'AI not connected');
  }
}

/* ══════════════════════════════════════════════════════
   SETUP STEP
══════════════════════════════════════════════════════ */
function initSetup() {
  const modelSelect = $('model-select');
  const savedModel = AIEngine.getModel();
  let currentProvider = getProviderFromModel(savedModel);

  if (modelSelect) {
    modelSelect.value = savedModel;
    modelSelect.addEventListener('change', () => {
      AIEngine.setModel(modelSelect.value);
      currentProvider = getProviderFromModel(modelSelect.value);
      updateKeyCardUI(currentProvider);
    });
  }

  // Load the correct key for the current model on init
  updateKeyCardUI(currentProvider);
  const cfg = MODEL_CONFIG[currentProvider];
  if (cfg && cfg.getKey()) {
    unlockAllSteps();
  }

  $('btn-show-key').addEventListener('click', () => {
    const input = $('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  $('btn-save-key').addEventListener('click', async () => {
    const key = $('api-key-input').value.trim();
    const provider = getProviderFromModel(AIEngine.getModel());
    const cfg = MODEL_CONFIG[provider];
    if (!key) { toast(`Please enter your ${cfg.provider} API key`, 'error'); return; }

    const btn = $('btn-save-key');
    btn.textContent = 'Testing…';
    btn.disabled = true;
    updateConnectionStatus('connecting', `Connecting to ${cfg.provider}…`);
    $('connection-result').textContent = '';
    $('connection-result').className = 'connection-result';

    try {
      cfg.setKey(key);
      await AIEngine.testConnection();
      updateConnectionStatus('connected', `${cfg.provider} connected`);
      $('connection-result').textContent = `✓ Connection successful — ${cfg.provider} API is ready`;
      $('connection-result').className = 'connection-result success';
      toast(`${cfg.provider} API connected successfully!`, 'success');
      unlockAllSteps();
      GovernanceLog.log('api_key_set', { provider: cfg.provider, timestamp: new Date().toISOString() });
    } catch (err) {
      updateConnectionStatus('disconnected', 'AI not connected');
      $('connection-result').textContent = `✕ Connection failed: ${err.message}`;
      $('connection-result').className = 'connection-result error';
      toast(`API connection failed: ${err.message}`, 'error');
    } finally {
      btn.textContent = 'Save & Test Connection';
      btn.disabled = false;
    }
  });

  $('btn-clear-key').addEventListener('click', () => {
    const provider = getProviderFromModel(AIEngine.getModel());
    const cfg = MODEL_CONFIG[provider];
    // Clear the active provider's key
    cfg.setKey('');
    localStorage.removeItem(`harmonize_${provider === 'openai' ? 'openai' : provider === 'anthropic' ? 'anthropic' : 'gemini'}_key`);
    $('api-key-input').value = '';
    updateConnectionStatus('disconnected', 'AI not connected');
    $('connection-result').textContent = '';
    toast(`${cfg.provider} API key cleared`, 'info');
  });
}

function unlockAllSteps() {
  STEPS.forEach(s => unlockStep(s));
}

function updateConnectionStatus(state, label) {
  const dot = $('status-dot');
  const lbl = $('status-label');
  dot.className = `status-dot ${state}`;
  lbl.textContent = label;
}

/* ══════════════════════════════════════════════════════
   STEP 1: UPLOAD
══════════════════════════════════════════════════════ */
function initUpload() {
  const zone = $('upload-zone');
  const fileInput = $('file-input');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });

  $('btn-upload-browse').addEventListener('click', () => fileInput.click());
  $('btn-add-more').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    handleFiles([...e.target.files]);
    fileInput.value = '';
  });

  $('btn-proceed-extract').addEventListener('click', () => {
    if (AppState.files.length < 2) {
      toast('Please upload at least 2 documents to harmonize', 'warning');
      return;
    }
    runExtraction();
  });
}

function handleFiles(newFiles) {
  const supportedFiles = newFiles.filter(f => /\.(docx?|xlsx)/i.test(f.name));
  const skipped = newFiles.length - supportedFiles.length;
  if (skipped > 0) toast(`${skipped} file(s) skipped — only DOCX and XLSX files are supported`, 'warning');

  const existing = new Set(AppState.files.map(f => f.name));
  const added = supportedFiles.filter(f => !existing.has(f.name));
  if (added.length === 0) { toast('All selected files are already added', 'info'); return; }

  AppState.files.push(...added);
  renderFileGrid();

  GovernanceLog.log('files_uploaded', {
    count: added.length,
    files: added.map(f => ({ name: f.name, size: f.size }))
  });
}

function renderFileGrid() {
  const grid = $('file-grid');
  const section = $('file-list-section');
  const badge = $('file-count-badge');
  const docBadge = $('doc-count-badge');
  const docCount = $('doc-count');

  grid.innerHTML = '';
  badge.textContent = AppState.files.length;

  if (AppState.files.length > 0) {
    section.style.display = 'block';
    docBadge.style.display = 'flex';
    docCount.textContent = AppState.files.length;
  } else {
    section.style.display = 'none';
    docBadge.style.display = 'none';
  }

  AppState.files.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-card-icon">📄</div>
      <div class="file-card-name">${escHtml(file.name)}</div>
      <div class="file-card-size">${formatBytes(file.size)}</div>
      <button class="file-card-remove" data-index="${index}" title="Remove">✕</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.file-card-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      AppState.files.splice(idx, 1);
      renderFileGrid();
    });
  });
}

/* ══════════════════════════════════════════════════════
   STEP 2: SECTION DETECTION
══════════════════════════════════════════════════════ */
async function runExtraction() {
  navigateTo('inventory');
  setPageTitle('Clause Inventory', 'AI is reading your documents…');
  
  // Show parsing toast
  toast('Parsing documents…', 'info');

  try {
    AppState.parsedDocs = await Parser.parseAll(AppState.files);

    // Collect client smart tags from uploaded Excel files
    AppState.excelSmartTags = [];
    AppState.parsedDocs.forEach(d => {
      if (d.isExcel && d.smartTags) {
        AppState.excelSmartTags.push(...d.smartTags);
      }
    });

    const failed = AppState.parsedDocs.filter(d => d.status === 'error');
    if (failed.length > 0) {
      toast(`${failed.length} document(s) failed to parse`, 'warning');
    }

    // Extract sections using first-level heading detection
    AppState.docsWithSections = SectionDetector.extractSectionsFromDocs(AppState.parsedDocs);

    // Decompose into flat clause inventory with unique Clause IDs
    AppState.clauseInventory = [];
    let clauseCounter = 1;
    AppState.docsWithSections.forEach(doc => {
      doc.sections.forEach(sec => {
        const idStr = `CL${String(clauseCounter++).padStart(3, '0')}`;
        AppState.clauseInventory.push({
          id: idStr,
          docName: doc.name,
          heading: sec.header,
          content: sec.content,
          comments: sec.comments || []
        });
        sec.clauseId = idStr;
      });
    });

    // Render the inventory table
    renderClauseInventory();
    markStepComplete('upload');
    unlockStep('inventory');
    navigateTo('inventory');
    updatePageMeta('inventory');

    // AI group sections across documents
    toast('AI is grouping similar sections across documents…', 'info');
    AppState.sectionGroups = await SectionDetector.groupSections(AppState.docsWithSections);

    GovernanceLog.log('sections_extracted', {
      totalGroups: AppState.sectionGroups.length,
      docs: AppState.docsWithSections.map(d => ({ name: d.name, sections: d.sections.length }))
    });

    // Run similarity scoring automatically
    toast('AI is comparing sections across all documents…', 'info');
    const multiDocGroups = AppState.sectionGroups.filter(g => g.sections.length > 1);

    for (const group of multiDocGroups) {
      try {
        const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
        const scores = await AIEngine.scoreSimilarity(group.groupName, variants);
        AppState.similarityData[group.groupName] = scores;
      } catch (err) {
        console.warn(`Similarity scoring failed for "${group.groupName}":`, err);
        AppState.similarityData[group.groupName] = [];
      }
    }

    GovernanceLog.log('variance_analysis_complete', {
      groupsScored: Object.keys(AppState.similarityData).length
    });

    renderExtractionResults();

  } catch (err) {
    toast(`Extraction failed: ${err.message}`, 'error');
    console.error(err);
  }
}

function renderClauseInventory() {
  const tbody = $('inventory-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const renderRows = (filterText = '') => {
    tbody.innerHTML = '';
    const query = filterText.toLowerCase().trim();
    const filtered = AppState.clauseInventory.filter(c => {
      if (!query) return true;
      return c.id.toLowerCase().includes(query) || 
             c.docName.toLowerCase().includes(query) || 
             c.heading.toLowerCase().includes(query) || 
             c.content.toLowerCase().includes(query);
    }).sort((a, b) => a.heading.localeCompare(b.heading));

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No matching clauses found.</td></tr>`;
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      tr.innerHTML = `
        <td style="padding: 12px 16px; font-weight: 600; color: var(--cyan);">${escHtml(c.id)}</td>
        <td style="padding: 12px 16px; color: var(--text-secondary);">${escHtml(shortenDocName(c.docName))}</td>
        <td style="padding: 12px 16px; font-weight: 500;">${escHtml(c.heading)}</td>
        <td style="padding: 12px 16px; color: var(--text-primary); font-family: monospace; font-size:12px; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(c.content)}">
          ${escHtml(c.content)}
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  renderRows();

  // Bind search input event
  const searchInput = $('inventory-search');
  if (searchInput) {
    // Remove previous listeners to avoid double binding
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    newSearchInput.addEventListener('input', (e) => {
      renderRows(e.target.value);
    });
  }

  // Bind proceed button
  const btnProceed = $('btn-proceed-to-extract');
  if (btnProceed) {
    const newBtn = btnProceed.cloneNode(true);
    btnProceed.parentNode.replaceChild(newBtn, btnProceed);
    newBtn.addEventListener('click', () => {
      navigateTo('extract');
      updatePageMeta('extract');
      markStepComplete('inventory');
      unlockStep('extract');
    });
  }
}

function renderExtractionResults() {
  $('extract-processing').style.display = 'none';
  $('extraction-results').style.display = 'block';

  const multiDocGroups = AppState.sectionGroups.filter(g => g.sections.length > 1);
  $('extract-summary-text').textContent =
    `Found ${AppState.sectionGroups.length} section groups across ${AppState.files.length} documents. ` +
    `${multiDocGroups.length} groups appear in multiple documents. Click 'Harmonize Section' under any group to generate master language inline.`;

  const docNames = AppState.files.map(f => f.name);
  const container = $('heatmap-container');
  container.innerHTML = '';

  const groupsList = document.createElement('div');
  groupsList.className = 'comparison-groups-list';

  AppState.sectionGroups.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = 'comparison-group-card';

    // Find similarity score
    const scores = AppState.similarityData[group.groupName] || [];
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    let simLabel = 'Unique Clause';
    let simClass = 'sim-badge-blue';

    if (group.sections.length > 1) {
      if (avgScore === null) {
        simLabel = 'Near-Duplicate';
        simClass = 'sim-badge-med';
      } else if (avgScore >= 90) {
        simLabel = 'Exact Match';
        simClass = 'sim-badge-high';
      } else if (avgScore >= 50) {
        simLabel = 'Near-Duplicate';
        simClass = 'sim-badge-med';
      } else {
        simLabel = 'Conflict Flagged';
        simClass = 'sim-badge-low';
      }
    }

    const simScoreText = (avgScore !== null && group.sections.length > 1) ? ` (${avgScore}%)` : '';
    const headingNumber = index + 1;

    const isConflict = group.sections.length > 1 && avgScore !== null && avgScore < 50;
    const conflictBannerHTML = isConflict ? `
      <div class="conflict-banner" style="margin-top: 16px; padding: 12px 16px; background: var(--red-dim); border: 1px solid rgba(255, 92, 122, 0.25); border-radius: var(--radius-md); font-size: 12px; color: var(--red); line-height: 1.5;">
        <strong>Conflict Flagged:</strong> Contradictory legal terms detected. <br/>
        <strong>Resolution:</strong> Propose variations, escalate to legal owners, or define rule selection.
      </div>
    ` : '';

    card.innerHTML = `
      <div class="comparison-group-header">
        <h4 class="comparison-group-title">${headingNumber}. ${escHtml(group.groupName)}</h4>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="sim-badge ${simClass}">${simLabel}${simScoreText}</span>
          <span class="hs-docs-badge" style="font-size:12px; padding: 4px 10px;">${group.sections.length}/${docNames.length} Docs</span>
        </div>
      </div>
      <div class="slider-wrapper">
        <button class="slider-arrow slider-arrow-left" id="arrow-left-${index}">◀</button>
        <div class="variants-slider" id="slider-${index}">
          ${group.sections.map(sec => `
            <div class="variant-card">
              <div class="variant-card-header" title="${escHtml(sec.docName)}">
                📄 ${escHtml(shortenDocName(sec.docName))}
              </div>
              <div class="variant-card-content">${escHtml(sec.content)}</div>
              ${sec.comments && sec.comments.length > 0 ? `
                <div class="variant-comments" style="margin-top: 12px; padding: 8px 12px; background: var(--amber-dim); border: 1px solid rgba(255, 179, 71, 0.25); border-radius: var(--radius-sm); font-size: 11px; color: var(--amber); line-height: 1.4;">
                  <strong>DOCX Comment:</strong>
                  ${sec.comments.map(c => `<div style="margin-top:2px;">${escHtml(c)}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        <button class="slider-arrow slider-arrow-right" id="arrow-right-${index}">▶</button>
      </div>
      ${conflictBannerHTML}
      <div class="inline-harmonize-action" id="action-container-${index}">
        <button class="btn-harmonize-inline" id="btn-harmonize-inline-${index}">Harmonize Section</button>
        <div class="inline-spinner" id="spinner-inline-${index}" style="display:none;">
          <div class="processing-pulse" style="width:12px;height:12px;margin:0;"></div>
          <span style="font-size:12px;">Harmonizing with AI...</span>
        </div>
      </div>
      <div class="inline-results-panel" id="results-inline-${index}" style="display:none;"></div>
    `;

    groupsList.appendChild(card);
  });

  container.appendChild(groupsList);

  // Bind slider arrow click events
  AppState.sectionGroups.forEach((group, index) => {
    const slider = $(`slider-${index}`);
    const arrowLeft = $(`arrow-left-${index}`);
    const arrowRight = $(`arrow-right-${index}`);

    if (slider && arrowLeft && arrowRight) {
      arrowLeft.addEventListener('click', () => {
        slider.scrollBy({ left: -360, behavior: 'smooth' });
      });
      arrowRight.addEventListener('click', () => {
        slider.scrollBy({ left: 360, behavior: 'smooth' });
      });

      // Disable/enable arrows based on scroll position
      const updateArrows = () => {
        arrowLeft.disabled = slider.scrollLeft <= 5;
        arrowRight.disabled = (slider.scrollLeft + slider.clientWidth) >= (slider.scrollWidth - 5);
      };

      slider.addEventListener('scroll', updateArrows);
      setTimeout(() => {
        updateArrows();
        if (slider.scrollWidth <= slider.clientWidth) {
          arrowLeft.style.display = 'none';
          arrowRight.style.display = 'none';
          slider.parentElement.style.padding = '0';
        }
      }, 300);
    }

    // Bind inline harmonization click event
    const btnHarmonize = $(`btn-harmonize-inline-${index}`);
    const spinner = $(`spinner-inline-${index}`);
    const resultsPanel = $(`results-inline-${index}`);

    if (btnHarmonize) {
      // Check if we already have pre-loaded harmonized results for this section
      const preLoadedResult = AppState.harmonizedResults.find(r => r.groupName === group.groupName);
      const preLoadedAnn = AppState.annotations[group.groupName];
      if (preLoadedResult && preLoadedAnn) {
        renderInlineResults(resultsPanel, preLoadedResult, preLoadedAnn);
        resultsPanel.style.display = 'block';
        btnHarmonize.textContent = 'Re-Harmonize ↺';
      }

      btnHarmonize.addEventListener('click', async () => {
        btnHarmonize.disabled = true;
        spinner.style.display = 'flex';
        resultsPanel.style.display = 'none';

        try {
          const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
          
          // 1. Annotate
          const annotationResult = await AIEngine.annotateSection(group.groupName, variants, AppState.excelSmartTags || []);
          AppState.annotations[group.groupName] = annotationResult;

          // 2. Harmonize
          const harmonizationResult = await AIEngine.harmonizeSection(group.groupName, variants, annotationResult);
          
          // Store result globally
          const existingIdx = AppState.harmonizedResults.findIndex(r => r.groupName === group.groupName);
          const fullResult = {
            groupName: group.groupName,
            sourceCount: group.sections.length,
            sources: group.sections.map(s => s.docName),
            ...harmonizationResult,
            harmonized: harmonizationResult.standardClause || ''
          };

          if (existingIdx >= 0) {
            AppState.harmonizedResults[existingIdx] = fullResult;
          } else {
            AppState.harmonizedResults.push(fullResult);
          }

          // Render results inline
          renderInlineResults(resultsPanel, fullResult, annotationResult);
          resultsPanel.style.display = 'block';
          btnHarmonize.textContent = 'Re-Harmonize ↺';
          toast(`Section "${group.groupName}" harmonized successfully!`, 'success');
        } catch (err) {
          console.error(err);
          toast(`Harmonization failed: ${err.message}`, 'error');
        } finally {
          btnHarmonize.disabled = false;
          spinner.style.display = 'none';
        }
      });
    }
  });

  $('btn-proceed-annotate').addEventListener('click', runAnnotation, { once: true });

  // ── View toggle logic ──
  const btnGrouped = $('btn-grouped-view');
  const btnSideBySide = $('btn-sidebyside-view');
  if (btnGrouped && btnSideBySide) {
    btnGrouped.addEventListener('click', () => {
      btnGrouped.classList.add('active');
      btnSideBySide.classList.remove('active');
      $('heatmap-container').style.display = 'block';
      $('side-by-side-container').style.display = 'none';
    });
    btnSideBySide.addEventListener('click', () => {
      btnSideBySide.classList.add('active');
      btnGrouped.classList.remove('active');
      $('heatmap-container').style.display = 'none';
      $('side-by-side-container').style.display = 'block';
      renderSideBySideView();
    });
  }
}

/* ══════════════════════════════════════════════════════
   SIDE-BY-SIDE DOCUMENT COMPARISON VIEW
══════════════════════════════════════════════════════ */
function renderSideBySideView() {
  const container = $('side-by-side-container');
  if (!container) return;

  const docs = AppState.docsWithSections;
  if (!docs || docs.length === 0) return;

  // Track current carousel page (show 2 docs at a time)
  let currentPage = container._sbsCurrentPage || 0;
  const docsPerPage = 2;
  const totalPages = Math.max(1, Math.ceil(docs.length / docsPerPage));
  if (currentPage >= totalPages) currentPage = 0;
  container._sbsCurrentPage = currentPage;

  const startIdx = currentPage * docsPerPage;
  const visibleDocs = docs.slice(startIdx, startIdx + docsPerPage);

  container.innerHTML = '';

  // ── Carousel nav (only if > 2 docs) ──
  if (docs.length > docsPerPage) {
    const nav = document.createElement('div');
    nav.className = 'sbs-carousel-nav';
    nav.innerHTML = `
      <button class="sbs-carousel-btn" id="sbs-prev" ${currentPage === 0 ? 'disabled' : ''}>◀ Previous</button>
      <span class="sbs-carousel-indicator">Showing docs <strong>${startIdx + 1}–${Math.min(startIdx + docsPerPage, docs.length)}</strong> of <strong>${docs.length}</strong></span>
      <button class="sbs-carousel-btn" id="sbs-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next ▶</button>
    `;
    container.appendChild(nav);
  }

  // ── 3-column document layout ──
  const columnsWrapper = document.createElement('div');
  columnsWrapper.className = 'sbs-doc-columns';

  // Build a unified section order from all groups
  const allGroups = AppState.sectionGroups;

  // Create document columns
  visibleDocs.forEach(doc => {
    const docCol = document.createElement('div');
    docCol.className = 'sbs-doc-column';

    // Document header
    const docHeader = document.createElement('div');
    docHeader.className = 'sbs-doc-header';
    docHeader.innerHTML = `
      <span class="sbs-doc-header-icon">📄</span>
      <div class="sbs-doc-header-info">
        <span class="sbs-doc-header-title" title="${escHtml(doc.name)}">${escHtml(shortenDocName(doc.name))}</span>
        <span class="sbs-doc-header-subtitle">${doc.sections.length} sections</span>
      </div>
    `;
    docCol.appendChild(docHeader);

    // Document body — sections flow like a real document
    const docBody = document.createElement('div');
    docBody.className = 'sbs-doc-body';

    allGroups.forEach((group, idx) => {
      const section = group.sections.find(s => s.docName === doc.name);
      const sectionBlock = document.createElement('div');
      sectionBlock.className = 'sbs-doc-section';
      sectionBlock.setAttribute('data-group-index', idx);

      if (section) {
        sectionBlock.innerHTML = `
          <div class="sbs-doc-section-heading">${idx + 1}. ${escHtml(group.groupName)}</div>
          <div class="sbs-doc-section-text">${escHtml(section.content)}</div>
        `;
      } else {
        sectionBlock.className += ' sbs-doc-section-missing';
        sectionBlock.innerHTML = `
          <div class="sbs-doc-section-heading sbs-heading-missing">${idx + 1}. ${escHtml(group.groupName)}</div>
          <div class="sbs-doc-section-empty-text">Section not present in this document</div>
        `;
      }
      docBody.appendChild(sectionBlock);
    });

    docCol.appendChild(docBody);
    columnsWrapper.appendChild(docCol);
  });

  // ── Harmonized column ──
  const harmCol = document.createElement('div');
  harmCol.className = 'sbs-doc-column sbs-doc-column-harmonized';

  const harmHeader = document.createElement('div');
  harmHeader.className = 'sbs-doc-header sbs-doc-header-harmonized';
  harmHeader.innerHTML = `
    <span class="sbs-doc-header-icon">✦</span>
    <div class="sbs-doc-header-info">
      <span class="sbs-doc-header-title harmonized-title">Proposed Harmonization</span>
      <span class="sbs-doc-header-subtitle">AI-generated master language</span>
    </div>
  `;
  harmCol.appendChild(harmHeader);

  const harmBody = document.createElement('div');
  harmBody.className = 'sbs-doc-body';

  allGroups.forEach((group, idx) => {
    const scores = AppState.similarityData[group.groupName] || [];
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const isLowSimilarity = avgScore !== null && avgScore < 50 && group.sections.length > 1;

    const harmResult = AppState.harmonizedResults.find(r => r.groupName === group.groupName);

    const sectionBlock = document.createElement('div');
    sectionBlock.className = 'sbs-doc-section';
    sectionBlock.setAttribute('data-group-index', idx);

    const heading = `<div class="sbs-doc-section-heading">${idx + 1}. ${escHtml(group.groupName)}</div>`;

    if (isLowSimilarity) {
      sectionBlock.className += ' sbs-doc-section-different';
      sectionBlock.innerHTML = `
        ${heading}
        <div class="sbs-harm-different">
          <span class="sbs-harm-different-icon">⚠️</span>
          <span class="sbs-harm-different-text">Content Different — Shouldn't be harmonized</span>
          <span class="sbs-harm-different-sub">Separate clauses will be created for each document</span>
        </div>
      `;
    } else if (harmResult && !harmResult.error) {
      sectionBlock.className += ' sbs-doc-section-harmonized';
      sectionBlock.innerHTML = `
        ${heading}
        <div class="sbs-doc-section-text sbs-harmonized-text">${escHtml(harmResult.standardClause || harmResult.harmonized || '')}</div>
      `;
    } else {
      sectionBlock.innerHTML = `
        ${heading}
        <div class="sbs-harm-pending">
          <button class="btn-harmonize-sbs" data-group-idx="${idx}">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Harmonize Section
          </button>
          <div class="sbs-harm-spinner" id="sbs-spinner-${idx}" style="display:none;">
            <div class="processing-pulse" style="width:12px;height:12px;margin:0;"></div>
            <span>Harmonizing…</span>
          </div>
        </div>
      `;
    }

    harmBody.appendChild(sectionBlock);
  });

  harmCol.appendChild(harmBody);
  columnsWrapper.appendChild(harmCol);
  container.appendChild(columnsWrapper);

  // ── Bind harmonize buttons ──
  container.querySelectorAll('.btn-harmonize-sbs').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.groupIdx);
      const group = AppState.sectionGroups[idx];
      if (!group) return;

      btn.disabled = true;
      btn.style.display = 'none';
      const spinner = $(`sbs-spinner-${idx}`);
      if (spinner) spinner.style.display = 'flex';

      try {
        const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));

        // 1. Annotate
        const annotationResult = await AIEngine.annotateSection(group.groupName, variants, AppState.excelSmartTags || []);
        AppState.annotations[group.groupName] = annotationResult;

        // 2. Harmonize
        const harmonizationResult = await AIEngine.harmonizeSection(group.groupName, variants, annotationResult);

        const fullResult = {
          groupName: group.groupName,
          sourceCount: group.sections.length,
          sources: group.sections.map(s => s.docName),
          ...harmonizationResult,
          harmonized: harmonizationResult.standardClause || ''
        };

        const existingIdx = AppState.harmonizedResults.findIndex(r => r.groupName === group.groupName);
        if (existingIdx >= 0) {
          AppState.harmonizedResults[existingIdx] = fullResult;
        } else {
          AppState.harmonizedResults.push(fullResult);
        }

        toast(`Section "${group.groupName}" harmonized successfully!`, 'success');
        renderSideBySideView(); // Re-render to show the harmonized content
      } catch (err) {
        console.error(err);
        toast(`Harmonization failed: ${err.message}`, 'error');
        btn.disabled = false;
        btn.style.display = 'flex';
        if (spinner) spinner.style.display = 'none';
      }
    });
  });

  // ── Carousel button handlers ──
  const btnPrev = $('sbs-prev');
  const btnNext = $('sbs-next');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      container._sbsCurrentPage = Math.max(0, currentPage - 1);
      renderSideBySideView();
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      container._sbsCurrentPage = Math.min(totalPages - 1, currentPage + 1);
      renderSideBySideView();
    });
  }
}

function renderInlineResults(container, h, ann) {
  const hasVariations = h.variations && h.variations.length > 0;
  const tags = ann.smartTags || [];
  const clis = ann.cliCandidates || [];
  const rules = ann.assemblyLogic || [];

  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--cyan); margin-bottom: 8px; border-bottom: 1px solid rgba(0, 180, 216, 0.2); padding-bottom: 6px;">✦ Standard Clause</div>
      <div class="hs-merged-content" style="font-size: 13px; color: var(--text-primary); white-space: pre-wrap; line-height: 1.6;">${escHtml(h.standardClause || h.harmonized || '')}</div>
    </div>

    ${hasVariations ? `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--amber); margin-bottom: 8px; border-bottom: 1px solid rgba(230, 168, 0, 0.2); padding-bottom: 6px;">📋 Variation Clauses</div>
        ${h.variations.map((v, vi) => `
          <div class="hs-variation-card" style="margin-top: 10px; margin-bottom: 0;">
            <div class="hs-variation-header">
              <span class="hs-variation-label">Variation ${vi + 1}</span>
              <span class="hs-variation-source">${escHtml(shortenDocName(v.docName))}</span>
            </div>
            <div class="hs-variation-content">${escHtml(v.clause)}</div>
            ${v.differenceNote ? `<div class="hs-variation-note">📝 ${escHtml(v.differenceNote)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${tags.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Smart Tags Preserved</div>
        <div class="ann-tag-chips" style="gap: 6px;">
          ${tags.map(t => `
            <span class="smart-tag-chip" style="margin-bottom: 4px;" title="${escHtml(t.context || '')}">
              <span class="tag-name">${escHtml(t.tag)}</span>
              <span class="tag-type">${escHtml(t.type || '')}</span>
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${clis.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Clause Library Candidates (CLIs)</div>
        <div class="ann-cli-list">
          ${clis.map(c => `
            <div class="ann-cli-item" style="padding: 8px 12px;">
              <div class="ann-cli-name" style="font-size:12px;">${escHtml(c.name)}</div>
              <span class="ann-cli-category" style="font-size:10px;">Category: ${escHtml(c.category || 'General')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${rules.length > 0 ? `
      <div style="margin-bottom: 0;">
        <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Assembly Rules</div>
        <div class="ann-rules-list">
          ${rules.map(r => `
            <div class="ann-rule-item" style="padding: 8px 12px; font-size: 12px; line-height: 1.5;">
              <strong>Rule:</strong> ${escHtml(r.rule)} <br/>
              <span class="tag-type" style="display:inline-block; margin-top: 4px;">Type: ${escHtml(r.type)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function showSectionDetail(groupName) {
  const group = AppState.sectionGroups.find(g => g.groupName === groupName);
  if (!group) return;

  $('detail-section-name').textContent = groupName;
  const grid = $('variants-grid');
  grid.innerHTML = '';

  group.sections.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <div class="variant-card-header" title="${escHtml(sec.docName)}">${escHtml(shortenDocName(sec.docName))}</div>
      <div class="variant-card-content">${escHtml(sec.content)}</div>
    `;
    grid.appendChild(card);
  });

  $('section-detail-panel').style.display = 'block';
  $('section-detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════════════════
   STEP 4: ANNOTATION (runs BEFORE harmonization per SOP)
══════════════════════════════════════════════════════ */
async function runAnnotation() {
  navigateTo('annotate');
  setPageTitle('Annotation', 'AI is identifying smart tags, CLIs, and assembly logic…');
  $('annotate-processing').style.display = 'flex';
  $('annotation-results').style.display = 'none';

  const counter = $('annotate-counter');

  try {
    AppState.annotations = await Harmonizer.annotateAll(
      AppState.sectionGroups,
      AppState.annotations,
      (current, total, name) => {
        counter.textContent = `(${current}/${total}) ${name}`;
      }
    );

    renderAnnotationResults();
    markStepComplete('extract');
    setPageTitle('Annotation', 'Review identified smart tags, CLIs, and assembly logic');

  } catch (err) {
    toast(`Annotation failed: ${err.message}`, 'error');
    console.error(err);
    $('annotate-processing').style.display = 'none';
  }
}

function renderAnnotationResults() {
  $('annotate-processing').style.display = 'none';
  $('annotation-results').style.display = 'block';

  // Compute totals
  let totalTags = 0, totalCLIs = 0, totalRules = 0;
  for (const ann of Object.values(AppState.annotations)) {
    totalTags += (ann.smartTags || []).length;
    totalCLIs += (ann.cliCandidates || []).length;
    totalRules += (ann.assemblyLogic || []).length;
  }

  $('ann-total-tags').textContent = totalTags;
  $('ann-total-clis').textContent = totalCLIs;
  $('ann-total-rules').textContent = totalRules;
  $('annotate-summary-text').textContent =
    `Found ${totalTags} smart tags, ${totalCLIs} CLI candidates, and ${totalRules} assembly rules across ${AppState.sectionGroups.length} sections.`;

  // Render per-section annotations
  const container = $('annotation-sections');
  container.innerHTML = '';

  AppState.sectionGroups.forEach((group, index) => {
    const ann = AppState.annotations[group.groupName] || {};
    const tags = ann.smartTags || [];
    const clis = ann.cliCandidates || [];
    const rules = ann.assemblyLogic || [];

    // Skip sections with no annotations
    if (tags.length === 0 && clis.length === 0 && rules.length === 0) return;

    const card = document.createElement('div');
    card.className = 'ann-section-card';

    const bodyId = `ann-body-${index}`;

    card.innerHTML = `
      <div class="ann-section-header" data-target="${bodyId}">
        <span class="ann-section-title">${escHtml(group.groupName)}</span>
        <div class="ann-section-badges">
          ${tags.length > 0 ? `<span class="ann-badge ann-badge-tag">🏷️ ${tags.length} tags</span>` : ''}
          ${clis.length > 0 ? `<span class="ann-badge ann-badge-cli">📑 ${clis.length} CLIs</span>` : ''}
          ${rules.length > 0 ? `<span class="ann-badge ann-badge-rule">⚡ ${rules.length} rules</span>` : ''}
          <button class="ann-toggle">▼</button>
        </div>
      </div>
      <div class="ann-section-body" id="${bodyId}">
        ${tags.length > 0 ? `
          <div class="ann-subsection">
            <div class="ann-subsection-title">🏷️ Smart Tags</div>
            <div class="ann-tag-chips">
              ${tags.map(t => `
                <span class="smart-tag-chip" title="${escHtml(t.context || '')}">
                  <span class="tag-name">${escHtml(t.tag)}</span>
                  <span class="tag-type">${escHtml(t.type || '')}</span>
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${clis.length > 0 ? `
          <div class="ann-subsection">
            <div class="ann-subsection-title">📑 CLI Candidates</div>
            <div class="ann-cli-list">
              ${clis.map(c => `
                <div class="ann-cli-item">
                  <div class="ann-cli-name">${escHtml(c.name)}</div>
                  <span class="ann-cli-category">${escHtml(c.category || '')}</span>
                  ${c.sourceDoc ? `<span class="ann-cli-source">${escHtml(c.sourceDoc)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${rules.length > 0 ? `
          <div class="ann-subsection">
            <div class="ann-subsection-title">⚡ Assembly Logic</div>
            <div class="ann-rules-list">
              ${rules.map(r => `
                <div class="ann-rule-item">
                  <span class="ann-rule-type">${escHtml(r.type || '')}</span>
                  <span class="ann-rule-text">${escHtml(r.rule)}</span>
                  ${r.affectedClause ? `<span class="ann-rule-clause">→ ${escHtml(r.affectedClause)}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(card);

    // Toggle expand/collapse
    const header = card.querySelector('.ann-section-header');
    const body = card.querySelector('.ann-section-body');
    const toggleBtn = card.querySelector('.ann-toggle');

    // First 5 open by default
    if (index < 5) {
      body.classList.add('open');
      toggleBtn.textContent = '▲';
    }

    header.addEventListener('click', (e) => {
      if (e.target.classList.contains('ann-toggle')) return;
      const isOpen = body.classList.toggle('open');
      toggleBtn.textContent = isOpen ? '▲' : '▼';
    });

    toggleBtn.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      toggleBtn.textContent = isOpen ? '▲' : '▼';
    });
  });

  $('btn-proceed-dashboard').addEventListener('click', runDashboard);
}

/* ══════════════════════════════════════════════════════
   STEP 5: CONSOLIDATION DASHBOARD
══════════════════════════════════════════════════════ */
async function runDashboard() {
  navigateTo('dashboard');
  setPageTitle('Consolidation Dashboard', 'AI is consolidating templates and calculating metrics…');
  toast('Consolidating templates & calculating metrics…', 'info');

  try {
    // Run auto-harmonization in background for any unharmonized or errored groups
    const unharmonized = AppState.sectionGroups.filter(g => !AppState.harmonizedResults.some(r => r.groupName === g.groupName && !r.error));
    if (unharmonized.length > 0) {
      toast(`AI is auto-harmonizing remaining ${unharmonized.length} sections…`, 'info');
      AppState.harmonizedResults = await Harmonizer.harmonizeAll(
        AppState.sectionGroups,
        AppState.annotations,
        AppState.harmonizedResults,
        (current, total, name) => {
          // Progress update
        }
      );
    }

    const errors = AppState.harmonizedResults.filter(r => r.error);
    if (errors.length > 0) {
      const firstErrorText = errors[0].rationale || 'AI limit reached';
      toast(`AI failed for ${errors.length} section(s). Fallback content applied so you can proceed. (${firstErrorText})`, 'warning');
    }

    renderDashboardResults();
    markStepComplete('annotate');
    unlockStep('dashboard');
    navigateTo('dashboard');
    updatePageMeta('dashboard');
  } catch (err) {
    toast(`Metric calculation failed: ${err.message}`, 'error');
    console.error(err);
  }
}

function renderDashboardResults() {
  const origTemplates = AppState.parsedDocs.length || AppState.files.length || 2;
  const targetTemplates = Math.max(1, Math.min(2, Math.floor(origTemplates / 3)));
  const templateReductionPct = Math.round(((origTemplates - targetTemplates) / origTemplates) * 100);

  const origClauses = AppState.clauseInventory ? AppState.clauseInventory.length : 20;
  const targetClauses = AppState.harmonizedResults ? AppState.harmonizedResults.length : 8;
  const clauseReductionPct = origClauses > 0 ? Math.round(((origClauses - targetClauses) / origClauses) * 100) : 0;
  const duplicatesMerged = Math.max(0, origClauses - targetClauses);

  // Set KPIs
  $('kpi-templates-reduction').textContent = `${templateReductionPct}%`;
  $('kpi-templates-subtext').textContent = `${origTemplates} → ${targetTemplates} templates`;

  $('kpi-clauses-reduction').textContent = `${clauseReductionPct}%`;
  $('kpi-clauses-subtext').textContent = `${origClauses} → ${targetClauses} clauses`;

  $('kpi-duplicates-merged').textContent = duplicatesMerged;
  $('kpi-duplicates-subtext').textContent = `Redundancies eliminated`;

  // Render Redundancy table
  const tbody = $('redundancy-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    // Sort section groups by number of clauses in them descending
    const sortedGroups = [...AppState.sectionGroups].sort((a, b) => b.sections.length - a.sections.length);
    sortedGroups.slice(0, 5).forEach(g => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      
      const percent = Math.round((g.sections.length / origTemplates) * 100);
      let statusBadge = `<span class="sim-badge sim-badge-high">High Duplication</span>`;
      if (g.sections.length === 1) {
        statusBadge = `<span class="sim-badge sim-badge-blue">Unique Section</span>`;
      } else if (percent < 50) {
        statusBadge = `<span class="sim-badge sim-badge-med">Moderate</span>`;
      }

      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 500;">${escHtml(g.groupName)}</td>
        <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: var(--cyan);">${g.sections.length} templates</td>
        <td style="padding: 10px 12px;">${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Render Architecture Tree
  const treeContainer = $('architecture-tree-container');
  if (treeContainer) {
    treeContainer.innerHTML = '';
    
    // Let's construct a professional tree dynamically
    const modules = {
      'Core General Terms': [],
      'Commercial & Payment Module': [],
      'IP & Confidentiality Module': [],
      'Liability & Termination Module': [],
      'Country Localization Rules': []
    };

    AppState.harmonizedResults.forEach(h => {
      const name = h.groupName.toLowerCase();
      if (name.includes('payment') || name.includes('charge') || name.includes('fee') || name.includes('billing') || name.includes('tax')) {
        modules['Commercial & Payment Module'].push(h);
      } else if (name.includes('confidential') || name.includes('ip ') || name.includes('intellectual') || name.includes('proprietary') || name.includes('disclosure')) {
        modules['IP & Confidentiality Module'].push(h);
      } else if (name.includes('liabilit') || name.includes('indemnity') || name.includes('terminate') || name.includes('termination') || name.includes('risk')) {
        modules['Liability & Termination Module'].push(h);
      } else if (name.includes('local') || name.includes('country') || name.includes('governing law') || name.includes('jurisdiction') || name.includes('region')) {
        modules['Country Localization Rules'].push(h);
      } else {
        modules['Core General Terms'].push(h);
      }
    });

    // Generate HTML
    let treeHTML = '';
    Object.entries(modules).forEach(([modName, clauses], mIdx) => {
      if (clauses.length === 0 && modName !== 'Core General Terms') return;
      
      const nodeId = `tree-node-${mIdx}`;
      const contentId = `tree-content-${mIdx}`;
      const toggleId = `tree-toggle-${mIdx}`;

      treeHTML += `
        <div class="tree-node">
          <div class="tree-node-title" id="${nodeId}" data-target="${contentId}" data-toggle="${toggleId}">
            <span class="tree-node-icon" id="${toggleId}">▼</span>
            <span>📂 ${escHtml(modName)}</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(${clauses.length} standard clauses)</span>
          </div>
          <div class="tree-node-content" id="${contentId}" style="display: block;">
            ${clauses.map(c => {
              const varCount = c.variations ? c.variations.length : 0;
              const hasVars = varCount > 0;
              const badge = hasVars ? `<span class="tree-leaf-tag">${varCount} regional variations</span>` : '';
              return `
                <div class="tree-leaf">
                  <span class="tree-leaf-icon">📄</span>
                  <span style="font-weight: 500; color: var(--text-primary);">${escHtml(c.groupName)}</span>
                  ${badge}
                </div>
              `;
            }).join('')}
            ${clauses.length === 0 ? `<div style="font-size:11px; color:var(--text-muted); font-style:italic; padding: 4px 0;">No clauses in this module.</div>` : ''}
          </div>
        </div>
      `;
    });

    treeContainer.innerHTML = treeHTML;

    // Bind collapse/expand clicks
    Object.keys(modules).forEach((_, mIdx) => {
      const node = $(`tree-node-${mIdx}`);
      if (node) {
        node.addEventListener('click', () => {
          const content = $(`tree-content-${mIdx}`);
          const toggle = $(`tree-toggle-${mIdx}`);
          if (content && toggle) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
          }
        });
      }
    });
  }

  // Bind proceed to export
  const btnProceed = $('btn-proceed-to-export');
  if (btnProceed) {
    const newBtn = btnProceed.cloneNode(true);
    btnProceed.parentNode.replaceChild(newBtn, btnProceed);
    newBtn.addEventListener('click', () => {
      prepareExport();
    });
  }
}

/* ══════════════════════════════════════════════════════
   STEP 6: EXPORT & CONFIGURE
══════════════════════════════════════════════════════ */
function prepareExport() {
  navigateTo('export');
  markStepComplete('dashboard');
  setPageTitle('Export Deliverables', 'Download your harmonized template and CLM configuration');

  const docNames = AppState.files.map(f => f.name);

  const variationCount = AppState.harmonizedResults.reduce((sum, h) => sum + (h.variations || []).length, 0);
  $('export-summary-text').textContent =
    `${AppState.harmonizedResults.length} sections harmonized from ${AppState.files.length} documents. ` +
    `${AppState.harmonizedResults.filter(h => h.sourceCount > 1).length} sections merged. ` +
    `${variationCount} variation clause${variationCount !== 1 ? 's' : ''} identified.`;

  $('export-docx-meta').textContent =
    `${AppState.harmonizedResults.length} sections · Standard + variation clauses`;

  // Count annotations
  let totalTags = 0, totalCLIs = 0;
  for (const ann of Object.values(AppState.annotations)) {
    totalTags += (ann.smartTags || []).length;
    totalCLIs += (ann.cliCandidates || []).length;
  }

  $('export-excel-meta').textContent =
    `9 sheets: Summary & Reduction, Clause Inventory, Harmonization Matrix, Redundancy Report, Clause Library (${totalCLIs} CLIs), Smart Tags (${totalTags}), Assembly Logic, Conflict Log, Audit Trail`;

  $('export-log-meta').textContent =
    `${GovernanceLog.getAll().length} log entries`;

  // Build preview
  const previewContent = AppState.harmonizedResults
    .map(h => {
      let text = `${h.groupName.toUpperCase()} [${h.similarityLevel || '?'}]\n${'─'.repeat(50)}\n`;
      text += `STANDARD: ${h.standardClause || h.harmonized || ''}`;
      if (h.variations && h.variations.length > 0) {
        h.variations.forEach((v, i) => {
          text += `\n\nVARIATION ${i+1} (${v.docName}): ${v.clause}`;
        });
      }
      return text;
    })
    .join('\n\n');
  $('preview-body').textContent = previewContent;

  // Download handlers
  $('btn-export-docx').addEventListener('click', async () => {
    try {
      await Harmonizer.downloadAsDocx(AppState.harmonizedResults, `harmonized-template-${dateStamp()}.docx`);
      GovernanceLog.log('export_docx', { sections: AppState.harmonizedResults.length });
      toast('Harmonized template downloaded!', 'success');
    } catch (err) {
      console.error(err);
      toast(`DOCX export failed: ${err.message}`, 'error');
      // Fallback to plain text
      const content = Harmonizer.buildDocument(AppState.harmonizedResults, 'Harmonized Contract Template');
      Harmonizer.downloadAsText(content, `harmonized-template-${dateStamp()}.txt`);
      toast('Downloaded text fallback.', 'warning');
    }
  });

  $('btn-export-excel').addEventListener('click', () => {
    try {
      const wb = ExcelExport.generate(
        AppState.sectionGroups, 
        AppState.harmonizedResults, 
        docNames, 
        AppState.annotations, 
        AppState.clauseInventory, 
        AppState.similarityData
      );
      ExcelExport.download(wb, `clm-config-${dateStamp()}.xlsx`);
      GovernanceLog.log('export_excel', { sheets: 9 });
      toast('CLM Configuration Excel downloaded!', 'success');
    } catch (err) {
      toast(`Excel export failed: ${err.message}`, 'error');
    }
  });

  $('btn-export-log').addEventListener('click', () => {
    GovernanceLog.exportJSON();
    toast('Audit log downloaded!', 'success');
  });

  // Redline export
  $('export-redline-meta').textContent =
    `${AppState.harmonizedResults.length} sections · Word-level diff per source document vs standard clause`;

  $('btn-export-redline').addEventListener('click', () => {
    try {
      const docNames = AppState.files.map(f => f.name);
      Redline.downloadRedlineHTML(AppState.harmonizedResults, AppState.sectionGroups, docNames);
      GovernanceLog.log('export_redline', { sections: AppState.harmonizedResults.length });
      toast('Redlined document downloaded!', 'success');
    } catch (err) {
      toast(`Redline export failed: ${err.message}`, 'error');
    }
  });

  $('btn-toggle-preview').addEventListener('click', () => {
    const body = $('preview-body');
    const btn = $('btn-toggle-preview');
    body.classList.toggle('expanded');
    btn.textContent = body.classList.contains('expanded') ? 'Collapse' : 'Expand';
  });

  $('btn-start-over').addEventListener('click', () => {
    if (confirm('Start a new session? This will clear all current data.')) {
      location.reload();
    }
  });
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shortenDocName(name) {
  return name.replace(/\.docx?$/i, '').slice(0, 22) + (name.length > 26 ? '…' : '');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════════════════════ */
function initSidebarToggle() {
  $('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const isHidden = sidebar.style.transform === 'translateX(-100%)';
    sidebar.style.transform = isHidden ? '' : 'translateX(-100%)';
    main.style.marginLeft = isHidden ? 'var(--sidebar-width)' : '0';
  });
}

/* ══════════════════════════════════════════════════════
   NAV CLICK HANDLERS
══════════════════════════════════════════════════════ */
function initNavClicks() {
  document.querySelectorAll('.nav-step').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('locked')) return;
      const step = item.dataset.step;
      navigateTo(step);
      updatePageMeta(step);
    });
  });
}

function updatePageMeta(step) {
  const meta = {
    setup: ['Configuration', 'Set up your Gemini API key to begin'],
    upload: ['Upload Documents', 'Import client contract templates'],
    inventory: ['Clause Inventory', 'Decomposed template clauses with unique tracking IDs'],
    extract: ['Section Harmonisation', 'Compare original document sections side-by-side'],
    annotate: ['Annotation & Assembly', 'Smart tags, CLIs, and assembly logic'],
    dashboard: ['Consolidation Dashboard', 'Harmonization metrics and recommended modular contract structure'],
    export: ['Export Deliverables', 'Download your harmonized template and CLM configuration'],
  };
  if (meta[step]) setPageTitle(...meta[step]);
}

/* ══════════════════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════════════════ */
function initThemeToggle() {
  const btn = $('theme-toggle');
  if (!btn) return;
  
  const isLight = localStorage.getItem('harmonize_light_mode') === 'true';
  if (isLight) document.body.classList.add('light-theme');
  btn.textContent = isLight ? '🌙' : '☀️';

  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const light = document.body.classList.contains('light-theme');
    localStorage.setItem('harmonize_light_mode', light);
    btn.textContent = light ? '🌙' : '☀️';
  });
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSetup();
  initUpload();
  initSidebarToggle();
  initNavClicks();
  navigateTo('setup');
  setPageTitle('Configuration', 'Set up your Gemini API key to begin');
});

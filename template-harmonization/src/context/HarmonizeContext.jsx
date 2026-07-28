/* @refresh reset */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AIEngine } from '../services/aiEngine';
import { Parser } from '../services/parser';
import { SectionDetector } from '../services/sectionDetector';
import { Harmonizer } from '../services/harmonizer';
import { GovernanceLog } from '../services/governance';
import { VectorStore } from '../services/vectorStore';
import { Chunker } from '../services/chunker';
import { RuleEngine } from '../services/ruleEngine';
import { MetadataExtractor } from '../services/metadataExtractor';
import { SmartTagDetector } from '../services/smartTagDetector';
import { SemanticMatcher } from '../services/semanticMatcher';
import supabase from '../services/supabaseClient';

const HarmonizeContext = createContext();

const MODEL_CONFIG = {
  gemini: {
    provider: 'Gemini',
    getKey: () => AIEngine.getKey(),
    setKey: (k) => AIEngine.setKey(k),
  },
  openai: {
    provider: 'OpenAI',
    getKey: () => AIEngine.getOpenAiKey(),
    setKey: (k) => AIEngine.setOpenAiKey(k),
  },
  anthropic: {
    provider: 'Anthropic',
    getKey: () => AIEngine.getAnthropicKey(),
    setKey: (k) => AIEngine.setAnthropicKey(k),
  },
  openrouter: {
    provider: 'OpenRouter',
    getKey: () => AIEngine.getOpenRouterKey(),
    setKey: (k) => AIEngine.setOpenRouterKey(k),
  }
};

/**
 * Helper utility to determine the provider key name matching a given model string.
 * 
 * @param {string} modelValue - Select option value.
 * @returns {string} The active provider key name ('gemini', 'openai', or 'anthropic').
 */
function getProviderFromModel(modelValue) {
  if (!modelValue) return 'gemini';
  if (modelValue.startsWith('openrouter')) return 'openrouter';
  if (modelValue.startsWith('openai')) return 'openai';
  if (modelValue.startsWith('anthropic')) return 'anthropic';
  return 'gemini';
}

/**
 * HarmonizeProvider Component.
 * The primary React context provider wrapping state management, upload queues,
 * parsing buffers, and semantic AI pipeline triggers across the application's panels.
 * 
 * @param {Object} props - Properties.
 * @param {React.ReactNode} props.children - Child components to render.
 * @returns {React.ReactElement} Provider wrapper element.
 */
export const HarmonizeProvider = ({ children }) => {
  const [currentStep, setCurrentStep] = useState('setup');
  const [unlockedSteps, setUnlockedSteps] = useState({
    setup: true,
    upload: true,
    inventory: true,
    extract: true,
    annotate: true,
    dashboard: true,
    export: true
  });
  const [completedSteps, setCompletedSteps] = useState({
    setup: false,
    upload: false,
    inventory: false,
    extract: false,
    annotate: false,
    dashboard: false,
    export: false
  });

  const [files, setFiles] = useState([]);
  const [parsedDocs, setParsedDocs] = useState([]);
  const [docsWithSections, setDocsWithSections] = useState([]);
  const [clauseInventory, setClauseInventory] = useState([]);
  const [sectionGroups, setSectionGroups] = useState([]);
  const [similarityData, setSimilarityData] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [harmonizedResults, setHarmonizedResults] = useState([]);
  const [excelSmartTags, setExcelSmartTags] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [clusteringMode, setClusteringMode] = useState(localStorage.getItem('harmonize_clustering_mode') || 'vector');
  const [embeddingMode, setEmbeddingMode] = useState(localStorage.getItem('harmonize_embedding_mode') || 'nlp');
  const [isIndexing, setIsIndexing] = useState(false);

  useEffect(() => {
    localStorage.setItem('harmonize_clustering_mode', clusteringMode);
  }, [clusteringMode]);

  useEffect(() => {
    localStorage.setItem('harmonize_embedding_mode', embeddingMode);
  }, [embeddingMode]);

  // Setup / Model states
  const [activeModel, setActiveModel] = useState(AIEngine.getModel());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [connectionLabel, setConnectionLabel] = useState('AI not connected');
  const [connectionResult, setConnectionResult] = useState({ text: '', type: '' }); // {text, type: 'success'|'error'}

  // Theme state
  const [lightTheme, setLightTheme] = useState(localStorage.getItem('harmonize_light_mode') === 'true');

  // Sidebar toggle state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /**
   * Toggles the collapsible state of the sidebar.
   */
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  /**
   * Extracts a clean, human-readable error message from raw API error responses.
   * The Google/OpenAI/Anthropic SDKs sometimes embed full JSON in err.message.
   *
   * @param {Error} err - The caught error object.
   * @returns {string} A readable error string.
   */
  function parseApiError(err) {
    const raw = err.message || String(err);
    // Try to parse embedded JSON (e.g. from Gemini SDK)
    try {
      const parsed = JSON.parse(raw);
      const msg = parsed?.error?.message || parsed?.message;
      if (msg) {
        return msg.split('\n')[0].trim();
      }
    } catch {
      // not JSON — fall through
    }
    // Trim to the first sentence / 200 chars max
    return raw.split('\n')[0].slice(0, 200).trim();
  }

  // Load key on init or when activeModel changes
  useEffect(() => {
    let isCurrent = true;
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];

    if (cfg) {
      const key = cfg.getKey();
      setApiKeyInput(key || '');
      if (key) {
        if (key === 'mock-key') {
          setConnectionStatus('connected');
          setConnectionLabel(`${cfg.provider} (Offline Demo)`);
          setConnectionResult({ text: '✓ Demo / Offline Mode activated — Steps unlocked', type: 'success' });
          unlockAllSteps();
          markStepComplete('setup');
          return;
        }

        const isEnvKey = (provider === 'gemini' && !!import.meta.env.VITE_GEMINI_API_KEY) ||
          (provider === 'openai' && !!import.meta.env.VITE_OPENAI_API_KEY) ||
          (provider === 'anthropic' && !!import.meta.env.VITE_ANTHROPIC_API_KEY) ||
          (provider === 'openrouter' && !!import.meta.env.VITE_OPENROUTER_API_KEY);

        setConnectionStatus('connecting');
        setConnectionLabel(`Connecting to ${cfg.provider}…`);
        setConnectionResult({ text: '', type: '' });

        AIEngine.testConnection()
          .then((success) => {
            if (!isCurrent) return;
            if (success) {
              setConnectionStatus('connected');
              if (isEnvKey) {
                setConnectionLabel(`${cfg.provider} connected (.env)`);
                setConnectionResult({ text: `✓ Connected via .env — ${cfg.provider} API is ready`, type: 'success' });
              } else {
                setConnectionLabel(`${cfg.provider} key saved`);
                setConnectionResult({ text: `✓ Connection successful — ${cfg.provider} API is ready`, type: 'success' });
              }
              unlockAllSteps();
              markStepComplete('setup');
            } else {
              throw new Error('Connection verification returned empty response.');
            }
          })
          .catch((err) => {
            if (!isCurrent) return;
            setConnectionStatus('disconnected');
            setConnectionLabel('AI not connected');
            setConnectionResult({ text: `✕ Connection failed: ${parseApiError(err)}`, type: 'error' });
            unlockAllSteps();
            setCompletedSteps(prev => ({
              ...prev,
              setup: false
            }));
          });
      } else {
        setConnectionStatus('disconnected');
        setConnectionLabel('AI not connected');
        setConnectionResult({ text: '', type: '' });
      }
    }
    return () => {
      isCurrent = false;
    };
  }, [activeModel]);

  // Sync theme to body tag
  useEffect(() => {
    if (lightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('harmonize_light_mode', lightTheme);
  }, [lightTheme]);

  /**
   * Toggles the UI light mode/dark mode theme state.
   */
  const toggleTheme = () => setLightTheme(!lightTheme);

  /**
   * Unlocks the given step in the workflow process.
   * 
   * @param {string} step - The workflow step key.
   */
  const unlockStep = (step) => {
    setUnlockedSteps(prev => ({ ...prev, [step]: true }));
  };

  /**
   * Marks a workflow step as completed.
   * 
   * @param {string} step - The step key identifier.
   */
  const markStepComplete = (step) => {
    setCompletedSteps(prev => ({ ...prev, [step]: true }));
  };

  /**
   * Unlocks all workflow steps (used when an API key is verified/pre-saved).
   */
  const unlockAllSteps = () => {
    setUnlockedSteps({
      setup: true,
      upload: true,
      inventory: true,
      extract: true,
      annotate: true,
      dashboard: true,
      export: true
    });
  };

  /**
   * Updates the selected AI model and saves it to global storage.
   * 
   * @param {string} model - Selected model name key.
   */
  const changeModel = (model) => {
    AIEngine.setModel(model);
    setActiveModel(model);
  };

  /**
   * Saves the provided API key for the active provider and triggers a lightweight connection verification query.
   * On success, unlocks steps and marks setup as complete.
   * 
   * @param {string} key - Raw API key string.
   * @returns {Promise<boolean>} True on success.
   */
  const saveAndTestKey = async (key) => {
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    if (!key) throw new Error(`Please enter your ${cfg.provider} API key`);

    if (key === 'mock-key') {
      cfg.setKey(key);
      setApiKeyInput(key);
      setConnectionStatus('connected');
      setConnectionLabel(`${cfg.provider} (Offline Demo)`);
      setConnectionResult({ text: '✓ Demo / Offline Mode activated — Steps unlocked', type: 'success' });
      unlockAllSteps();
      markStepComplete('setup');
      GovernanceLog.log('api_key_set_offline', { provider: cfg.provider, timestamp: new Date().toISOString() });
      return true;
    }

    setConnectionStatus('connecting');
    setConnectionLabel(`Connecting to ${cfg.provider}…`);
    setConnectionResult({ text: '', type: '' });

    try {
      cfg.setKey(key);
      setApiKeyInput(key);
      await AIEngine.testConnection();

      setConnectionStatus('connected');
      setConnectionLabel(`${cfg.provider} connected`);
      setConnectionResult({ text: `✓ Connection successful — ${cfg.provider} API is ready`, type: 'success' });
      unlockAllSteps();
      markStepComplete('setup');
      GovernanceLog.log('api_key_set', { provider: cfg.provider, timestamp: new Date().toISOString() });
      return true;
    } catch (err) {
      setConnectionStatus('disconnected');
      setConnectionLabel('AI not connected');
      setConnectionResult({ text: `✕ Connection failed: ${parseApiError(err)}`, type: 'error' });
      // We no longer lock steps on API failure since API is only needed at the end
      unlockAllSteps();
      setCompletedSteps(prev => ({
        ...prev,
        setup: false
      }));
      throw err;
    }
  };

  /**
   * Clears the API key saved for the current provider in memory and storage.
   */
  const clearSavedKey = () => {
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    cfg.setKey('');
    localStorage.removeItem(`harmonize_${provider === 'openai' ? 'openai' : provider === 'anthropic' ? 'anthropic' : 'gemini'}_key`);
    setApiKeyInput('');
    setConnectionStatus('disconnected');
    setConnectionLabel('AI not connected');
    setConnectionResult({ text: '', type: '' });
  };

  const enableDemoMode = () => {
    // Set mock-key for all providers to ensure they all operate in demo mode when switched
    Object.keys(MODEL_CONFIG).forEach(prov => {
      MODEL_CONFIG[prov].setKey('mock-key');
    });
    setApiKeyInput('mock-key');
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider] || MODEL_CONFIG.gemini;
    setConnectionStatus('connected');
    setConnectionLabel(`${cfg.provider} (Offline Demo)`);
    setConnectionResult({ text: '✓ Demo / Offline Mode activated — Steps unlocked', type: 'success' });
    unlockAllSteps();
    markStepComplete('setup');
    GovernanceLog.log('api_key_set_offline', { provider: cfg.provider, timestamp: new Date().toISOString() });
  };


  // State Reset for starting over
  /**
   * Clears parsed buffers, lists, and workflow tracking states to prepare for a fresh session.
   */
  const resetSession = () => {
    setFiles([]);
    setParsedDocs([]);
    setDocsWithSections([]);
    setClauseInventory([]);
    setSectionGroups([]);
    setSimilarityData({});
    setAnnotations({});
    setHarmonizedResults([]);
    setExcelSmartTags([]);
    VectorStore.clear();
    setCurrentStep('setup');
    setCompletedSteps({
      setup: false,
      upload: false,
      inventory: false,
      extract: false,
      annotate: false,
      dashboard: false,
      export: false
    });
    // Keep setup step unlocked
    setUnlockedSteps({
      setup: true,
      upload: false,
      inventory: false,
      extract: false,
      annotate: false,
      dashboard: false,
      export: false
    });
    // Check if key exists to re-unlock
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    if (cfg && cfg.getKey()) {
      unlockAllSteps();
    }
  };

  /**
   * Evaluates and adds supported (.docx or .xlsx) files to the upload queue.
   * 
   * @param {Array<File>} newFiles - Dragged or browsed files list.
   * @returns {Object} Metric counts of skipped vs. added files.
   */
  const addFiles = (newFiles) => {
    const supported = newFiles.filter(f => /\.(docx?|xlsx)/i.test(f.name));
    const skipped = newFiles.length - supported.length;

    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const added = supported.filter(f => !existing.has(f.name));

      if (added.length > 0) {
        GovernanceLog.log('files_uploaded', {
          count: added.length,
          files: added.map(f => ({ name: f.name, size: f.size }))
        });
      }
      return [...prev, ...added];
    });

    return { skipped, addedCount: supported.length };
  };

  /**
   * Removes a file from the active upload queue index.
   * 
   * @param {number} index - Index of file in array.
   */
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Clusters section headings across multiple templates into semantic topic groups using vector similarity.
   * Matches headings based on local cosine similarity vectors stored in VectorStore.
   *
   * @param {Array<Object>} docsSecs - Document list with section items.
   * @returns {Array<Object>} Grouped section collection.
   */
  function groupSectionsByVector(docsSecs) {
    const rawGroups = [];
    const clauses = VectorStore.getIndex();
    
    function normHeader(h) {
      if (!h) return '';
      const clean = Parser.cleanHeadingName ? Parser.cleanHeadingName(h) : h;
      return clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    if (clauses.length === 0) {
      return SectionDetector.groupSections(docsSecs);
    }

    for (const doc of docsSecs) {
      for (const sec of doc.sections) {
        const secNorm = normHeader(sec.header);
        const clauseObj = clauses.find(c => c.docName === doc.name && normHeader(c.heading) === secNorm);

        // 1. Direct Heading Title Match check first
        let matchedGroupIdx = rawGroups.findIndex(g => {
          const hasSameDoc = g.sections.some(s => s.docName === doc.name);
          return !hasSameDoc && normHeader(g.groupName) === secNorm;
        });

        if (matchedGroupIdx >= 0) {
          rawGroups[matchedGroupIdx].sections.push({
            docName: doc.name,
            originalHeader: sec.header,
            content: sec.content,
            comments: sec.comments || []
          });
          continue;
        }

        // 2. Vector Cosine Similarity match check
        let bestGroupIdx = -1;
        let bestSim = -1;

        if (clauseObj && clauseObj.embedding) {
          for (let g = 0; g < rawGroups.length; g++) {
            const group = rawGroups[g];
            const hasSameDoc = group.sections.some(s => s.docName === doc.name);
            if (hasSameDoc) continue;

            let simSum = 0;
            let matchCount = 0;
            for (const groupSec of group.sections) {
              const gNorm = normHeader(groupSec.originalHeader);
              const gClause = clauses.find(c => c.docName === groupSec.docName && normHeader(c.heading) === gNorm);
              if (gClause && gClause.embedding) {
                simSum += VectorStore.cosineSimilarity(clauseObj.embedding, gClause.embedding);
                matchCount++;
              }
            }
            if (matchCount > 0) {
              const avgSim = simSum / matchCount;
              if (avgSim > bestSim) {
                bestSim = avgSim;
                bestGroupIdx = g;
              }
            }
          }
        }

        if (bestSim >= 0.65 && bestGroupIdx >= 0) {
          rawGroups[bestGroupIdx].sections.push({
            docName: doc.name,
            originalHeader: sec.header,
            content: sec.content,
            comments: sec.comments || []
          });
        } else {
          rawGroups.push({
            groupName: Parser.cleanHeadingName ? Parser.cleanHeadingName(sec.header) : sec.header,
            sections: [{
              docName: doc.name,
              originalHeader: sec.header,
              content: sec.content,
              comments: sec.comments || []
            }]
          });
        }
      }
    }

    // Post-pass: Merge groups that share the same normalized clean heading
    const mergedMap = {};
    for (const group of rawGroups) {
      const cleanTitle = Parser.cleanHeadingName ? Parser.cleanHeadingName(group.groupName) : group.groupName;
      const normKey = normHeader(cleanTitle);
      if (!mergedMap[normKey]) {
        mergedMap[normKey] = {
          groupName: cleanTitle,
          sections: []
        };
      }
      for (const sec of group.sections) {
        const existingIdx = mergedMap[normKey].sections.findIndex(s => s.docName === sec.docName);
        if (existingIdx === -1) {
          mergedMap[normKey].sections.push(sec);
        } else {
          if ((sec.content || '').length > (mergedMap[normKey].sections[existingIdx].content || '').length) {
            mergedMap[normKey].sections[existingIdx] = sec;
          }
        }
      }
    }

    // Ensure all extracted sections in docsSecs are included
    for (const doc of docsSecs) {
      for (const sec of doc.sections) {
        const normKey = normHeader(sec.header);
        if (mergedMap[normKey]) {
          const exists = mergedMap[normKey].sections.some(s => s.docName === doc.name);
          if (!exists) {
            mergedMap[normKey].sections.push({
              docName: doc.name,
              originalHeader: sec.header,
              content: sec.content,
              comments: sec.comments || []
            });
          }
        }
      }
    }

    return Object.values(mergedMap).filter(g => g.sections.length > 0);
  }

  // Steps execution triggers
  /**
   * Parses files, extracts sections, maps them to a clause inventory,
   * clusters similar clauses, and triggers similarity scoring on the backend.
   * 
   * @param {function} onProcessingStateChange - Callback parameter to toggle modal loaders.
   * @param {function} onToast - Toast notification dispatch.
   */
  const startSectionDetection = async (onProcessingStateChange, onToast) => {
    setCurrentStep('inventory');
    onProcessingStateChange(true);
    setAnalysisProgress(0);

    try {
      const parsed = await Parser.parseAll(files);
      setParsedDocs(parsed);

      const tags = [];
      parsed.forEach(d => {
        if (d.isExcel && d.smartTags) {
          tags.push(...d.smartTags);
        }
      });
      setExcelSmartTags(tags);

      const failed = parsed.filter(d => d.status === 'error');
      if (failed.length > 0) {
        onToast(`${failed.length} document(s) failed to parse`, 'warning');
      }

      const docsSecs = SectionDetector.extractSectionsFromDocs(parsed);
      setDocsWithSections(docsSecs);

      const inventory = [];
      let clauseCounter = 1;
      docsSecs.forEach(doc => {
        doc.sections.forEach(sec => {
          const idStr = `CL${String(clauseCounter++).padStart(3, '0')}`;
          inventory.push({
            id: idStr,
            docName: doc.name,
            heading: sec.header,
            content: sec.content,
            comments: sec.comments || []
          });
          sec.clauseId = idStr;
        });
      });
      setClauseInventory(inventory);

      // Generate Embeddings, Extract Metadata, Run Rule Engine & Index in Database
      onToast('Analyzing clause compliance & generating local vector index…', 'info');
      setIsIndexing(true);
      VectorStore.clear();

      const processedClauses = [];

      for (let i = 0; i < inventory.length; i++) {
        const item = inventory[i];
        try {
          // 1. Chunk clause (Step 6)
          const chunks = Chunker.chunkText(item.content, 800, 150);
          item.chunks = chunks;

          // 2. Extract Metadata (Step 5)
          const meta = MetadataExtractor.extract(item.content);
          item.metadata = meta;

          // 3. Rule Engine Validation (Step 12)
          const rules = RuleEngine.validate(item.content, meta);
          item.ruleValidation = rules;

          // 4. Generate Embedding (Step 7)
          const embedding = await AIEngine.getEmbedding(item.content);
          item.embedding = embedding;

          // 5. Store in local Vector Database (Step 8)
          VectorStore.addClause({
            id: item.id,
            text: item.content,
            docName: item.docName,
            heading: item.heading,
            embedding,
            metadata: meta
          });

          processedClauses.push({
            id: item.id,
            docName: item.docName,
            heading: item.heading,
            content: item.content,
            embedding,
            metadata: meta
          });
        } catch (err) {
          console.error(`Failed to process clause ${item.id}:`, err);
        }
        
        // Indexing progress covers first 50%
        const percent = Math.round(((i + 1) / inventory.length) * 50);
        setAnalysisProgress(percent);
      }

      // Store in Supabase Vector Table if active (Step 8)
      if (!supabase.isMock && processedClauses.length > 0) {
        try {
          await supabase.storeVectorsInDB(processedClauses);
        } catch (dbErr) {
          if (dbErr?.code === 'PGRST205') {
            console.info('Supabase pgvector tables not found. Using local in-memory vector store only.');
          } else {
            console.warn('Failed to upload vectors to Supabase DB:', dbErr);
          }
        }
      }
      setIsIndexing(false);

      markStepComplete('upload');
      unlockStep('inventory');
      onProcessingStateChange(false);

      // Group sections using local vector similarity
      onToast('AI is grouping sections using local vector similarity…', 'info');
      
      const groups = groupSectionsByVector(docsSecs);
      setSectionGroups(groups);

      GovernanceLog.log('sections_extracted', {
        totalGroups: groups.length,
        clusteringMode: 'vector',
        docs: docsSecs.map(d => ({ name: d.name, sections: d.sections.length }))
      });

      // Similarity scoring
      onToast('AI is comparing sections across all documents…', 'info');
      const multiDocGroups = groups.filter(g => g.sections.length > 1);
      const totalGroups = multiDocGroups.length;
      const scoresObj = {};
      let processed = 0;

      const indexedClauses = VectorStore.getIndex();

      for (const group of multiDocGroups) {
        try {
          const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
          
          // Pure vector-based similarity scoring (no LLM)
          const scores = SemanticMatcher.scoreVariants(group.groupName, variants);
          scoresObj[group.groupName] = scores;
        } catch (err) {
          console.warn(`Similarity scoring failed for "${group.groupName}":`, err);
          scoresObj[group.groupName] = [];
        }
        processed += 1;
        // Remaining 50% covers grouping/verification scoring
        const percent = 50 + Math.round((processed / totalGroups) * 50);
        setAnalysisProgress(percent);
      }
      setSimilarityData(scoresObj);
      setAnalysisProgress(100);

      GovernanceLog.log('variance_analysis_complete', {
        groupsScored: Object.keys(scoresObj).length,
        clusteringMode
      });

    } catch (err) {
      onToast(`Extraction failed: ${err.message}`, 'error');
      console.error(err);
      onProcessingStateChange(false);
    }
  };

  // Update inline results for a specific section group
  /**
   * Updates or appends a single section's harmonization results inline.
   * 
   * @param {string} groupName - Section group key name.
   * @param {Object} result - Harmonization payload result.
   */
  const updateHarmonizedResultInline = (groupName, result) => {
    setHarmonizedResults(prev => {
      const idx = prev.findIndex(r => r.groupName === groupName);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = result;
        return copy;
      } else {
        return [...prev, result];
      }
    });
  };

  /**
   * Inline updates the annotation details for a single section group.
   * 
   * @param {string} groupName - Section group key name.
   * @param {Object} annotation - Annotation payload context.
   */
  const updateAnnotationInline = (groupName, annotation) => {
    setAnnotations(prev => ({
      ...prev,
      [groupName]: annotation
    }));
  };

  // Run bulk annotations
  /**
   * Triggers the bulk semantic annotation flow across all section groups.
   * 
   * @param {function} onProgress - Progress reporting callback.
   * @param {function} onToast - Toast notification callback.
   */
  const startBulkAnnotations = async (onProgress, onToast) => {
    setCurrentStep('annotate');
    try {
      // Use deterministic SmartTagDetector instead of LLM
      const result = SmartTagDetector.annotateAll(
        sectionGroups,
        annotations,
        excelSmartTags,
        (current, total, name) => {
          onProgress(current, total, name);
        }
      );
      setAnnotations(result);
      markStepComplete('extract');
      unlockStep('annotate');
    } catch (err) {
      onToast(`Annotation failed: ${err.message}`, 'error');
      console.error(err);
    }
  };

  // Run bulk consolidation dashboard metrics
  /**
   * Auto-harmonizes any remaining sections in the background and consolidates dashboard metrics.
   * 
   * @param {function} onToast - Toast notification callback.
   */
  const startConsolidation = async (onToast) => {
    setCurrentStep('dashboard');
    onToast('Consolidating templates & calculating metrics…', 'info');
    try {
      let currentResults = [...harmonizedResults];
      // Note: Removed auto-harmonization of remaining unharmonized sections.
      // Harmonization should only occur explicitly via user action to avoid LLM token waste.

      const errors = currentResults.filter(r => r.error);
      if (errors.length > 0) {
        onToast(`AI failed for ${errors.length} section(s). Fallback content applied.`, 'warning');
      }

      markStepComplete('annotate');
      unlockStep('dashboard');
    } catch (err) {
      onToast(`Metric calculation failed: ${err.message}`, 'error');
      console.error(err);
    }
  };

  /**
   * Routes the current workflow layout step to a specified unlocked panel key.
   * 
   * @param {string} step - Step key name.
   */
  const navigateToStep = (step) => {
    if (step === 'docs' || unlockedSteps[step]) {
      setCurrentStep(step);
    }
  };

  return (
    <HarmonizeContext.Provider value={{
      currentStep,
      unlockedSteps,
      completedSteps,
      files,
      parsedDocs,
      docsWithSections,
      clauseInventory,
      sectionGroups,
      similarityData,
      annotations,
      harmonizedResults,
      excelSmartTags,
      activeModel,
      apiKeyInput,
      connectionStatus,
      connectionLabel,
      connectionResult,
      lightTheme,
      sidebarCollapsed,
      analysisProgress,
      clusteringMode,
      setClusteringMode,
      embeddingMode,
      setEmbeddingMode,
      isIndexing,

      toggleTheme,
      toggleSidebar,
      setCurrentStep: navigateToStep,
      unlockStep,
      markStepComplete,
      changeModel,
      saveAndTestKey,
      clearSavedKey,
      enableDemoMode,
      resetSession,
      addFiles,
      removeFile,
      startSectionDetection,
      setAnalysisProgress,
      updateHarmonizedResultInline,
      updateAnnotationInline,
      startBulkAnnotations,
      startConsolidation
    }}>
      {children}
    </HarmonizeContext.Provider>
  );
};

/**
 * Custom React Hook to consume the Harmonize Context values.
 * 
 * @returns {Object} Complete Context API helper methods and variables.
 */
export const useHarmonize = () => useContext(HarmonizeContext);

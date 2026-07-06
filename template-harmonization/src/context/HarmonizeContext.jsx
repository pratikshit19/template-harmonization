import React, { createContext, useContext, useState, useEffect } from 'react';
import { AIEngine } from '../services/aiEngine';
import { Parser } from '../services/parser';
import { SectionDetector } from '../services/sectionDetector';
import { Harmonizer } from '../services/harmonizer';
import { GovernanceLog } from '../services/governance';

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
  }
};

function getProviderFromModel(modelValue) {
  if (!modelValue) return 'gemini';
  if (modelValue.startsWith('openai')) return 'openai';
  if (modelValue.startsWith('anthropic')) return 'anthropic';
  return 'gemini';
}

export const HarmonizeProvider = ({ children }) => {
  const [currentStep, setCurrentStep] = useState('setup');
  const [unlockedSteps, setUnlockedSteps] = useState({
    setup: true,
    upload: false,
    inventory: false,
    extract: false,
    annotate: false,
    dashboard: false,
    export: false
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
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  // Load key on init or when activeModel changes
  useEffect(() => {
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    if (cfg) {
      setApiKeyInput(cfg.getKey() || '');
      if (cfg.getKey()) {
        setConnectionStatus('connected');
        setConnectionLabel(`${cfg.provider} key saved`);
        unlockAllSteps();
      } else {
        setConnectionStatus('disconnected');
        setConnectionLabel('AI not connected');
      }
    }
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

  const toggleTheme = () => setLightTheme(!lightTheme);

  const unlockStep = (step) => {
    setUnlockedSteps(prev => ({ ...prev, [step]: true }));
  };

  const markStepComplete = (step) => {
    setCompletedSteps(prev => ({ ...prev, [step]: true }));
  };

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

  const changeModel = (model) => {
    AIEngine.setModel(model);
    setActiveModel(model);
  };

  const saveAndTestKey = async (key) => {
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    if (!key) throw new Error(`Please enter your ${cfg.provider} API key`);

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
      setConnectionResult({ text: `✕ Connection failed: ${err.message}`, type: 'error' });
      throw err;
    }
  };

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
    const provider = getProviderFromModel(activeModel);
    const cfg = MODEL_CONFIG[provider];
    cfg.setKey('mock-key');
    setApiKeyInput('mock-key');
    setConnectionStatus('connected');
    setConnectionLabel(`${cfg.provider} (Offline Demo)`);
    setConnectionResult({ text: '✓ Demo / Offline Mode activated — Steps unlocked', type: 'success' });
    unlockAllSteps();
    markStepComplete('setup');
    GovernanceLog.log('api_key_set_offline', { provider: cfg.provider, timestamp: new Date().toISOString() });
  };


  // State Reset for starting over
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

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Steps execution triggers
  const startSectionDetection = async (onProcessingStateChange, onToast) => {
    setCurrentStep('inventory');
    onProcessingStateChange(true);
    
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

      markStepComplete('upload');
      unlockStep('inventory');
      onProcessingStateChange(false);

      // Now run semantic section grouping background process
      onToast('AI is grouping similar sections across documents…', 'info');
      const groups = await SectionDetector.groupSections(docsSecs);
      setSectionGroups(groups);

      GovernanceLog.log('sections_extracted', {
        totalGroups: groups.length,
        docs: docsSecs.map(d => ({ name: d.name, sections: d.sections.length }))
      });

      // Similarity scoring
      onToast('AI is comparing sections across all documents…', 'info');
      const multiDocGroups = groups.filter(g => g.sections.length > 1);
      const scoresObj = {};
      for (const group of multiDocGroups) {
        try {
          const variants = group.sections.map(s => ({ docName: s.docName, content: s.content, comments: s.comments }));
          const scores = await AIEngine.scoreSimilarity(group.groupName, variants);
          scoresObj[group.groupName] = scores;
        } catch (err) {
          console.warn(`Similarity scoring failed for "${group.groupName}":`, err);
          scoresObj[group.groupName] = [];
        }
      }
      setSimilarityData(scoresObj);

      GovernanceLog.log('variance_analysis_complete', {
        groupsScored: Object.keys(scoresObj).length
      });

    } catch (err) {
      onToast(`Extraction failed: ${err.message}`, 'error');
      console.error(err);
      onProcessingStateChange(false);
    }
  };

  // Update inline results for a specific section group
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

  const updateAnnotationInline = (groupName, annotation) => {
    setAnnotations(prev => ({
      ...prev,
      [groupName]: annotation
    }));
  };

  // Run bulk annotations
  const startBulkAnnotations = async (onProgress, onToast) => {
    setCurrentStep('annotate');
    try {
      const result = await Harmonizer.annotateAll(
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
  const startConsolidation = async (onToast) => {
    setCurrentStep('dashboard');
    onToast('Consolidating templates & calculating metrics…', 'info');
    try {
      const unharmonized = sectionGroups.filter(g => !harmonizedResults.some(r => r.groupName === g.groupName && !r.error));
      let currentResults = [...harmonizedResults];
      if (unharmonized.length > 0) {
        onToast(`AI is auto-harmonizing remaining ${unharmonized.length} sections…`, 'info');
        currentResults = await Harmonizer.harmonizeAll(
          sectionGroups,
          annotations,
          harmonizedResults,
          (current, total, name) => {}
        );
        setHarmonizedResults(currentResults);
      }

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

  const navigateToStep = (step) => {
    if (unlockedSteps[step]) {
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
      updateHarmonizedResultInline,
      updateAnnotationInline,
      startBulkAnnotations,
      startConsolidation
    }}>
      {children}
    </HarmonizeContext.Provider>
  );
};

export const useHarmonize = () => useContext(HarmonizeContext);

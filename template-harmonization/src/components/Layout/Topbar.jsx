import React from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

/**
 * Topbar component that renders the page title, active step description,
 * model selector drop-down, theme toggle switch, and responsive sidebar toggles.
 * 
 * @returns {React.ReactElement} The rendered Topbar component.
 */
export default function Topbar() {
  const {
    currentStep,
    files,
    activeModel,
    changeModel,
    lightTheme,
    toggleTheme,
  } = useHarmonize();

  const providerMap = {
    'gemini-3.5-flash': 'Gemini',
    'openai-gpt-4o': 'OpenAI',
    'anthropic-claude-3-5-sonnet-20241022': 'Anthropic',
    'openrouter-google/gemini-2.5-flash': 'OpenRouter',
    'openrouter-anthropic/claude-sonnet-4': 'OpenRouter',
    'openrouter-openai/gpt-4o': 'OpenRouter',
    'openrouter-meta-llama/llama-4-maverick': 'OpenRouter'
  };
  const providerName = providerMap[activeModel] || 'Gemini';

  const meta = {
    setup: ['Configuration', `Set up your ${providerName} API key to begin`],
    upload: ['Upload Documents', 'Import client contract templates'],
    inventory: ['Clause Inventory', 'Decomposed template clauses with unique tracking IDs'],
    extract: ['Section Harmonisation', 'Compare original document sections side-by-side'],
    annotate: ['Annotation & Assembly', 'Smart tags, CLIs, and assembly logic'],
    dashboard: ['Consolidation Dashboard', 'Harmonization metrics and recommended modular contract structure'],
    export: ['Export Deliverables', 'Download your harmonized template and CLM configuration'],
  };

  const [title, subtitle] = meta[currentStep] || ['Harmonize', 'Sirion Contract Template Harmonizer'];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title" id="page-title">{title}</h1>
        <p className="page-subtitle" id="page-subtitle">{subtitle}</p>
      </div>
      <div className="topbar-right">
        {files.length > 0 && (
          <div className="doc-count-badge" id="doc-count-badge">
            <span id="doc-count">{files.length}</span> documents loaded
          </div>
        )}
        <select
          id="model-select"
          title="Select AI model"
          className="model-select"
          value={activeModel}
          onChange={(e) => changeModel(e.target.value)}
        >
          <option value="gemini-3.5-flash">Gemini 3.5 Flash (default)</option>
          <option value="openai-gpt-4o">OpenAI GPT‑4o</option>
          <option value="anthropic-claude-3-5-sonnet-20241022">Anthropic Claude‑3.5 Sonnet</option>
          <optgroup label="OpenRouter">
            <option value="openrouter-google/gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="openrouter-anthropic/claude-sonnet-4">Claude Sonnet 4</option>
            <option value="openrouter-openai/gpt-4o">GPT‑4o</option>
            <option value="openrouter-meta-llama/llama-4-maverick">Llama 4 Maverick</option>
          </optgroup>
        </select>
        <button
          className="btn-icon"
          id="theme-toggle"
          title="Toggle Light/Dark Mode"
          onClick={toggleTheme}
        >
          {lightTheme ? '🌙' : '☀️'}
        </button>

      </div>
    </header>
  );
}

import React, { useState, useEffect } from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

export default function SetupPanel() {
  const {
    activeModel,
    apiKeyInput,
    connectionStatus,
    connectionLabel,
    connectionResult,
    saveAndTestKey,
    clearSavedKey
  } = useHarmonize();

  const [inputVal, setInputVal] = useState(apiKeyInput);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    setInputVal(apiKeyInput);
  }, [apiKeyInput]);

  const providerMap = {
    'gemini-2.5-flash': 'gemini',
    'openai-gpt-4o': 'openai',
    'anthropic-claude-3-opus-20240229': 'anthropic'
  };

  const provider = providerMap[activeModel] || 'gemini';

  const providerConfigs = {
    gemini: {
      title: 'Google Gemini API Key',
      desc: <>Enter your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>. Stored locally in your browser only.</>,
      placeholder: 'AIza...'
    },
    openai: {
      title: 'OpenAI API Key',
      desc: <>Enter your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>. Stored locally in your browser only.</>,
      placeholder: 'sk-...'
    },
    anthropic: {
      title: 'Anthropic Claude API Key',
      desc: <>Enter your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Anthropic Console</a>. Stored locally in your browser only.</>,
      placeholder: 'sk-ant-...'
    }
  };

  const config = providerConfigs[provider];

  const handleSaveAndTest = async () => {
    if (!inputVal.trim()) {
      alert(`Please enter your ${provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`);
      return;
    }
    setIsTesting(true);
    setTestError('');
    try {
      await saveAndTestKey(inputVal.trim());
    } catch (err) {
      setTestError(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="step-panel active" id="panel-setup">
      <div className="setup-hero">
        <div className="setup-icon-ring">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="url(#sg)" strokeWidth="2" />
            <path d="M16 24l6 6 10-12" stroke="#00B4D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stopColor="#0066CC" />
                <stop offset="100%" stopColor="#00B4D8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2>Welcome to Harmonize</h2>
        <p>
          Upload multiple client contract templates. AI will detect sections, annotate smart tags &amp; CLIs, and produce harmonized standard + variation clauses — automating the EY configuration workflow.
        </p>
      </div>

      <div className="setup-card" id="api-key-card">
        <div className="card-header">
          <div className="card-icon">🔑</div>
          <div>
            <h3 id="key-card-title">{config.title}</h3>
            <p id="key-card-desc">{config.desc}</p>
          </div>
        </div>
        <div className="api-key-input-wrap">
          <input
            type={showKey ? 'text' : 'password'}
            id="api-key-input"
            className="api-key-input"
            placeholder={config.placeholder}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            className="btn-show-key"
            id="btn-show-key"
            title="Show/hide key"
            onClick={() => setShowKey(!showKey)}
          >
            👁
          </button>
        </div>
        <div className="api-key-actions">
          <button
            className="btn-primary"
            id="btn-save-key"
            onClick={handleSaveAndTest}
            disabled={isTesting}
          >
            {isTesting ? 'Testing…' : 'Save & Test Connection'}
          </button>
          <button
            className="btn-ghost"
            id="btn-clear-key"
            onClick={() => {
              clearSavedKey();
              setInputVal('');
            }}
          >
            Clear Saved Key
          </button>
        </div>
        {connectionResult.text && (
          <div className={`connection-result ${connectionResult.type}`}>
            {connectionResult.text}
          </div>
        )}
      </div>

      <div className="setup-card info-card">
        <div className="card-header">
          <div className="card-icon">📋</div>
          <div>
            <h3>How It Works — SOP Automation</h3>
          </div>
        </div>
        <div className="how-it-works">
          <div className="how-step">
            <div className="how-num">1</div>
            <div><strong>Upload</strong> — Drop contract template DOCX files (SOW, MSA, etc.)</div>
          </div>
          <div className="how-step">
            <div className="how-num">2</div>
            <div><strong>Detect</strong> — AI identifies main numbered sections (Overview, Charges, Term, etc.)</div>
          </div>
          <div className="how-step">
            <div className="how-num">3</div>
            <div><strong>Compare</strong> — Harmonisation analysis side-by-side</div>
          </div>
          <div className="how-step">
            <div className="how-num">4</div>
            <div><strong>Annotate</strong> — AI identifies smart tags {"{}"}, CLIs, and assembly logic</div>
          </div>
          <div className="how-step">
            <div className="how-num">5</div>
            <div><strong>Harmonize</strong> — AI produces standard clause + variation clauses</div>
          </div>
          <div className="how-step">
            <div className="how-num">6</div>
            <div><strong>Export</strong> — Download CLM configuration Excel, harmonized template, variance report</div>
          </div>
        </div>
      </div>
    </section>
  );
}

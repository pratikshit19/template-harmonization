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

      <div className="setup-card info-card" style={{ maxWidth: '780px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <div className="card-icon">📋</div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Harmonization Approach</h3>
          </div>
        </div>
        
        <div className="how-it-works" style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', lineHeight: 1.6 }}>
          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>1. Inventory Create Karein</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Sabhi templates ki list banayein.</li>
              <li>Template name, purpose, owner, aur usage frequency note karein.</li>
            </ul>
          </div>
          
          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>2. Compare Content</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Common sections/clauses identify karein.</li>
              <li>Unique sections ko alag mark karein.</li>
              <li>Duplicate content ko highlight karein.</li>
            </ul>
          </div>

          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>3. Categorize Differences</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Mandatory content</li>
              <li>Optional content</li>
              <li>Country/region-specific content</li>
              <li>Business-unit-specific content</li>
            </ul>
          </div>

          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>4. Create a Master Template</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Common content ko base template me rakhein.</li>
              <li>Variations ke liye placeholders, conditional clauses, ya content controls use karein.</li>
            </ul>
          </div>

          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>5. Standardize Language</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Similar clauses me consistent wording use karein.</li>
              <li>Duplicate clauses me best/latest approved version select karein.</li>
            </ul>
          </div>

          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>6. Stakeholder Review</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Legal, business, compliance, aur template owners se review karwayein.</li>
              <li>Confirm karein ki koi critical variation miss na ho.</li>
            </ul>
          </div>

          <div className="how-step-hinglish">
            <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>7. Retire Redundant Templates</div>
            <ul style={{ paddingLeft: '20px', margin: '4px 0 8px 0', listStyleType: 'disc' }}>
              <li>Harmonized template approve hone ke baad duplicate templates remove ya archive kar dein.</li>
            </ul>
          </div>

          <div className="practical-example-box" style={{ background: 'rgba(0, 102, 204, 0.08)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 102, 204, 0.2)', marginTop: '8px' }}>
            <div style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: '8px' }}>Practical Example</div>
            <div style={{ marginBottom: '8px' }}>Agar 20 templates me:</div>
            <ul style={{ paddingLeft: '20px', listStyleType: 'circle' }}>
              <li>80% content same hai</li>
              <li>20% content alag hai</li>
            </ul>
            <div style={{ margin: '8px 0' }}>To:</div>
            <ul style={{ paddingLeft: '20px', listStyleType: 'circle' }}>
              <li>80% ko master template me rakhein.</li>
              <li>20% differences ko conditions/placeholders ke through manage karein.</li>
            </ul>
            <div style={{ marginTop: '8px', fontWeight: 600 }}>Result: 20 templates &rarr; 1 master template + conditional sections.</div>
          </div>

          <div className="excel-example-box" style={{ marginTop: '12px' }}>
            <div style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: '8px' }}>Excel Tracking Sheet Example</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Template</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Common Content %</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Unique Clauses</th>
                  <th style={{ padding: '10px', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px' }}>Template A</td>
                  <td style={{ padding: '10px' }}>90%</td>
                  <td style={{ padding: '10px' }}>2</td>
                  <td style={{ padding: '10px', color: 'var(--green)' }}>Merge</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px' }}>Template B</td>
                  <td style={{ padding: '10px' }}>85%</td>
                  <td style={{ padding: '10px' }}>3</td>
                  <td style={{ padding: '10px', color: 'var(--green)' }}>Merge</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px' }}>Template C</td>
                  <td style={{ padding: '10px' }}>40%</td>
                  <td style={{ padding: '10px' }}>15</td>
                  <td style={{ padding: '10px', color: 'var(--amber)' }}>Separate Review</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

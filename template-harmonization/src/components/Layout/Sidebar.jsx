import React from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';

export default function Sidebar() {
  const {
    currentStep,
    unlockedSteps,
    completedSteps,
    setCurrentStep,
    connectionStatus,
    connectionLabel
  } = useHarmonize();

  const stepsList = [
    { id: 'setup', num: '⚙', title: 'Setup', desc: 'API key & config' },
    { id: 'upload', num: '1', title: 'Upload Documents', desc: 'Import client DOCX/XLSX files' },
    { id: 'inventory', num: '2', title: 'Clause Inventory', desc: 'Decomposed clauses & traceability' },
    { id: 'extract', num: '3', title: 'Section Harmonisation', desc: 'Side-by-side comparison & grouping' },
    { id: 'annotate', num: '4', title: 'Annotation & Assembly', desc: 'Smart tags, CLIs & logic' },
    { id: 'dashboard', num: '5', title: 'Consolidation Dashboard', desc: 'KPIs & recommended architecture' },
    { id: 'export', num: '6', title: 'Export Deliverables', desc: 'Download configurations & reports' },
  ];

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="2" fill="url(#g1)" />
            <rect x="16" y="2" width="10" height="10" rx="2" fill="url(#g2)" opacity="0.7" />
            <rect x="2" y="16" width="10" height="10" rx="2" fill="url(#g2)" opacity="0.7" />
            <rect x="16" y="16" width="10" height="10" rx="2" fill="url(#g1)" />
            <path d="M12 7h4M7 12v4M21 12v4M12 21h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0066CC" />
                <stop offset="100%" stopColor="#00B4D8" />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00B4D8" />
                <stop offset="100%" stopColor="#00CFB4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <span className="brand-name">Harmonize</span>
          <span className="brand-tagline">by Sirion</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Workflow</div>
        <ul className="nav-steps">
          {stepsList.map(step => {
            const isActive = currentStep === step.id;
            const isLocked = !unlockedSteps[step.id];
            const isCompleted = completedSteps[step.id];

            let classNames = 'nav-step';
            if (isActive) classNames += ' active';
            if (isLocked) classNames += ' locked';
            if (isCompleted) classNames += ' completed';

            return (
              <li
                key={step.id}
                className={classNames}
                onClick={() => !isLocked && setCurrentStep(step.id)}
                id={`nav-${step.id}`}
              >
                <div className="step-indicator">
                  <span className="step-number">
                    {isCompleted ? '✓' : step.num}
                  </span>
                </div>
                <div className="step-info">
                  <span className="step-title">{step.title}</span>
                  <span className="step-desc">{step.desc}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="ai-status" id="ai-status">
          <div className={`status-dot ${connectionStatus}`} id="status-dot"></div>
          <span id="status-label">{connectionLabel}</span>
        </div>
      </div>
    </aside>
  );
}

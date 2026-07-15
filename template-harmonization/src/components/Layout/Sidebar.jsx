import React from 'react';
import { useHarmonize } from '../../context/HarmonizeContext';
import sirionLogo from '../../assets/sirionlogoo.png';
import supabase from '../../services/supabaseClient';

/**
 * Sidebar component that displays the application brand logo, 
 * workflow steps (Setup through Export), and the connection status of the AI models.
 * Includes a Sign Out button linked to Supabase.
 * 
 * @returns {React.ReactElement} The rendered Sidebar component.
 */
export default function Sidebar() {
  const {
    currentStep,
    unlockedSteps,
    completedSteps,
    setCurrentStep,
    connectionStatus,
    connectionLabel,
    sidebarCollapsed,
    toggleSidebar
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
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`} id="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon" onClick={toggleSidebar} style={{ cursor: 'pointer' }} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <img src={sirionLogo} alt="Sirion Logo" style={{ width: '28px', height: '28px' }} />
        </div>
        {!sidebarCollapsed && (
          <div className="sidebar-brand-text">
            <span className="brand-name">Harmonize</span>
            <span className="brand-tagline">by Sirion</span>
          </div>
        )}
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
                {!sidebarCollapsed && (
                  <div className="step-info">
                    <span className="step-title">{step.title}</span>
                    <span className="step-desc">{step.desc}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="ai-status" id="ai-status" style={{ width: '100%' }}>
          <div className={`status-dot ${connectionStatus}`} id="status-dot"></div>
          {!sidebarCollapsed && <span id="status-label">{connectionLabel}</span>}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="btn-secondary"
          style={{
            width: '100%',
            padding: sidebarCollapsed ? '8px 0' : '8px 12px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: '8px',
            background: 'rgba(255, 92, 122, 0.05)',
            border: '1px solid rgba(255, 92, 122, 0.15)',
            color: 'var(--red)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
          }}
          title="Sign Out"
        >
          <span>🚪</span>
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

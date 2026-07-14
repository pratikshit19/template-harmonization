import React, { useState } from 'react';
import { HarmonizeProvider, useHarmonize } from './context/HarmonizeContext';
import Sidebar from './components/Layout/Sidebar';
import Topbar from './components/Layout/Topbar';
import SetupPanel from './components/Panels/SetupPanel';
import UploadPanel from './components/Panels/UploadPanel';
import InventoryPanel from './components/Panels/InventoryPanel';
import ExtractPanel from './components/Panels/ExtractPanel';
import AnnotatePanel from './components/Panels/AnnotatePanel';
import DashboardPanel from './components/Panels/DashboardPanel';
import ExportPanel from './components/Panels/ExportPanel';

/**
 * AppContent Component.
 * The core wrapper rendering layout views (Sidebar, Topbar) and determining which step panel to mount.
 * Also renders connection loaders and global visual toast alerts.
 * 
 * @param {Object} props - Properties.
 * @param {Array<Object>} props.toasts - Active global notifications.
 * @param {function} props.addToast - Method to append a toast message.
 * @returns {React.ReactElement} The rendered core workspace.
 */
function AppContent({ toasts, addToast }) {
  const { currentStep, sidebarCollapsed, setCurrentStep, markStepComplete, unlockStep, analysisProgress } = useHarmonize();
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Evaluates the currentStep state value and returns the appropriate panel element.
   * 
   * @returns {React.ReactElement} React component matching current workflow step.
   */
  const renderActivePanel = () => {
    switch (currentStep) {
      case 'setup':
        return <SetupPanel />;
      case 'upload':
        return <UploadPanel setProcessing={setIsProcessing} toast={addToast} />;
      case 'inventory':
        return <InventoryPanel />;
      case 'extract':
        return <ExtractPanel toast={addToast} />;
      case 'annotate':
        return <AnnotatePanel toast={addToast} />;
      case 'dashboard':
        return <DashboardPanel setCurrentStep={setCurrentStep} markStepComplete={markStepComplete} unlockStep={unlockStep} />;
      case 'export':
        return <ExportPanel toast={addToast} />;
      default:
        return <SetupPanel />;
    }
  };

  return (
    <>
      <Sidebar />
      <main
        className="main-content"
        style={{
          marginLeft: sidebarCollapsed ? '0' : 'var(--sidebar-width)',
          transition: 'margin-left var(--transition)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <Topbar />
        
        {isProcessing && (
          <div className="progress-banner" style={{ margin: '32px 32px 0 32px', display: 'flex', alignItems: 'center' }}>
            <div className="progress-bar" style={{ flex: 1, height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden', marginRight: '8px' }}>
              <div className="progress-bar-inner" style={{ width: `${analysisProgress}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.3s ease' }}></div>
            </div>
            <span>Processing ({analysisProgress}%)</span>
          </div>
        )}

        {renderActivePanel()}
      </main>

      {/* React Toasts Container matching styles.css */}
      <div className="toast-container" id="toast-container">
        {toasts.map(t => (
          <div className={`toast ${t.type}`} key={t.id} style={{ opacity: 1, transform: 'none' }}>
            <span>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * App Component.
 * The main container component initializing toast states and wrapping the application in the Harmonize Provider context.
 * 
 * @returns {React.ReactElement} Renders the root application layout.
 */
export default function App() {
  const [toasts, setToasts] = useState([]);

  /**
   * Appends a transient toast message notification payload to the current toast state.
   * 
   * @param {string} message - Text string of toast alert.
   * @param {string} [type='info'] - Status category type ('success'|'error'|'warning'|'info').
   * @param {number} [duration=4000] - Lifespan in milliseconds.
   */
  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  return (
    <HarmonizeProvider>
      <AppContent toasts={toasts} addToast={addToast} />
    </HarmonizeProvider>
  );
}

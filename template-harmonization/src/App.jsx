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

function AppContent({ toasts, addToast }) {
  const { currentStep, sidebarCollapsed, setCurrentStep, markStepComplete, unlockStep } = useHarmonize();
  const [isProcessing, setIsProcessing] = useState(false);

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
          <div className="ai-processing-banner" style={{ margin: '32px 32px 0 32px', display: 'flex' }}>
            <div className="processing-pulse"></div>
            <span>AI is parsing documents and extracting clauses… Please wait.</span>
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

export default function App() {
  const [toasts, setToasts] = useState([]);

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

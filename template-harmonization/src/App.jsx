import React, { useState, useEffect } from 'react';
import { HarmonizeProvider, useHarmonize } from './context/HarmonizeContext';
import Sidebar from './components/Layout/Sidebar';
import Topbar from './components/Layout/Topbar';
import SetupPanel from './components/Panels/SetupPanel';
import Loader from './components/Loader';
import UploadPanel from './components/Panels/UploadPanel';
import InventoryPanel from './components/Panels/InventoryPanel';
import ExtractPanel from './components/Panels/ExtractPanel';
import AnnotatePanel from './components/Panels/AnnotatePanel';
import DashboardPanel from './components/Panels/DashboardPanel';
import ExportPanel from './components/Panels/ExportPanel';
import LoginPanel from './components/Panels/LoginPanel';
import supabase from './services/supabaseClient';

/**
 * AppContent Component.
 * The core wrapper rendering layout views (Sidebar, Topbar) and determining which step panel to mount.
 * Also renders connection loaders.
 * 
 * @param {Object} props - Properties.
 * @param {function} props.addToast - Method to append a toast message.
 * @returns {React.ReactElement} The rendered core workspace.
 */
function AppContent({ addToast }) {
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
          marginLeft: sidebarCollapsed ? '64px' : 'var(--sidebar-width)',
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
    </>
  );
}

/**
 * App Component.
 * The main container component initializing toast states, listening to Supabase Auth sessions,
 * and wrapping the authenticated application in the Harmonize Provider context.
 * 
 * @returns {React.ReactElement} Renders the root application layout.
 */
export default function App() {
  const [toasts, setToasts] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-background)' }}>
        <div className="processing-pulse" style={{ width: '48px', height: '48px' }}></div>
      </div>
    );
  }

  return (
    <>
      {!session ? (
        <LoginPanel onAuthSuccess={setSession} toast={addToast} />
      ) : (
        <HarmonizeProvider>
          <AppContent addToast={addToast} />
        </HarmonizeProvider>
      )}

      {/* Global React Toasts Container */}
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

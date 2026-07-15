import React, { useState } from 'react';
import supabase from '../../services/supabaseClient';
import logoImg from '../../assets/sirionlogoo.png';

/**
 * LoginPanel Component.
 * Implements a premium, animated sign-in and sign-up card.
 *
 * @param {Object} props
 * @param {function} props.onAuthSuccess - Callback when session is successfully established.
 * @param {function} props.toast - Callback to notify users of success/error statuses.
 */
export default function LoginPanel({ onAuthSuccess, toast }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast('Please enter both email and password.', 'warning');
      return;
    }

    // Enforce email format: firstname.lastname@sirionlabs.com
    const emailRegex = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+@sirionlabs\.com$/;
    if (!emailRegex.test(email.trim())) {
      toast('Access restricted. Please use your corporate email in format: firstname.lastname@sirionlabs.com', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast('Account created successfully!', 'success');
        if (data?.session) {
          onAuthSuccess(data.session);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast('Welcome back!', 'success');
        if (data?.session) {
          onAuthSuccess(data.session);
        }
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card-container">
        {/* Brand Banner */}
        <div className="login-brand">
          <img src={logoImg} alt="Sirion Logo" className="login-logo" />
          <h2>Harmonize</h2>
          <p>by Sirion</p>
        </div>

        {/* Database Status Alert */}
        {supabase.isMock && (
          <div className="mock-alert-banner">
            <span className="mock-badge">DEMO MODE</span>
            <p>
              Supabase keys not detected in <code>.env</code>. Running on local mock database. Any credentials will work.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <h3>{isSignUp ? 'Create an Account' : 'Sign In to Your Workspace'}</h3>
          <p className="login-subtitle">
            {isSignUp
              ? 'Get started with contract template harmonization'
              : 'Enter your credentials to access the harmonization pipeline'}
          </p>

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="e.g. name@sirion.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-login" disabled={loading}>
            {loading ? (
              <div className="login-spinner"></div>
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>

          <div className="login-toggle">
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button type="button" onClick={() => setIsSignUp(false)} disabled={loading}>
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                New to Harmonize?{' '}
                <button type="button" onClick={() => setIsSignUp(true)} disabled={loading}>
                  Create an Account
                </button>
              </span>
            )}
          </div>
        </form>

        {supabase.isMock && (
          <div className="setup-instructions-card">
            <h4>💡 How to connect your real database:</h4>
            <p>Add these lines to your <code>.env</code> file:</p>
            <pre>
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let isMock = false;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    isMock = true;
  }
} else {
  isMock = true;
}

// In mock mode, emulate Supabase authentication using localStorage
const mockAuth = {
  listeners: [],
  session: JSON.parse(localStorage.getItem('mock_supabase_session')) || null,

  async signUp({ email, password }) {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 800));
    const users = JSON.parse(localStorage.getItem('mock_supabase_users') || '[]');
    if (users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }
    users.push({ email, password });
    localStorage.setItem('mock_supabase_users', JSON.stringify(users));

    const session = {
      user: { id: 'mock-' + Date.now(), email },
      access_token: 'mock-token-' + Date.now()
    };
    this.session = session;
    localStorage.setItem('mock_supabase_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },

  async signInWithPassword({ email, password }) {
    await new Promise(r => setTimeout(r, 800));
    // Check local storage users
    const users = JSON.parse(localStorage.getItem('mock_supabase_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    // Auto-create a mock user if they sign in with standard credentials in developer mode
    if (!user) {
      if (email && password) {
        // Create user automatically for convenience in local dev
        users.push({ email, password });
        localStorage.setItem('mock_supabase_users', JSON.stringify(users));
      } else {
        throw new Error('Invalid login credentials');
      }
    }

    const session = {
      user: { id: 'mock-' + Date.now(), email },
      access_token: 'mock-token-' + Date.now()
    };
    this.session = session;
    localStorage.setItem('mock_supabase_session', JSON.stringify(session));
    this.notify('SIGNED_IN', session);
    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    this.session = null;
    localStorage.removeItem('mock_supabase_session');
    this.notify('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    return { data: { session: this.session }, error: null };
  },

  onAuthStateChange(callback) {
    this.listeners.push(callback);
    // Trigger initial status check
    callback(this.session ? 'SIGNED_IN' : 'SIGNED_OUT', this.session);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  },

  notify(event, session) {
    this.listeners.forEach(l => l(event, session));
  }
};

const supabaseExport = isMock ? {
  auth: mockAuth,
  isMock: true
} : {
  ...supabase,
  isMock: false
};

export default supabaseExport;

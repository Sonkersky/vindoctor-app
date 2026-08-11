'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

export default function AuthWidget() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setLoadingUser(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setModalOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
  }

  if (!mounted || loadingUser) {
    // Zarezerwowane miejsce o tej samej wysokości, żeby nic nie "skakało" po
    // stronie, jak dociągnie się stan zalogowania.
    return <div className="auth-widget" style={{ minHeight: 40 }} />;
  }

  if (user) {
    const initial = (user.email || '?')[0].toUpperCase();
    return (
      <div className="auth-widget">
        <div className="user-menu">
          <button className="user-menu-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <span className="user-menu-avatar">{initial}</span>
            <span className="user-menu-email">{user.email}</span>
          </button>
          {menuOpen && (
            <>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setMenuOpen(false)}
              />
              <div className="user-menu-dropdown">
                <button className="user-menu-item" onClick={() => setMenuOpen(false)}>
                  ⭐ Obserwowane
                </button>
                <button className="user-menu-item" onClick={() => setMenuOpen(false)}>
                  ⚙️ My Settings
                </button>
                <div className="user-menu-divider" />
                <button className="user-menu-item danger" onClick={handleLogout}>
                  🚪 Wyloguj
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-widget">
      <button className="auth-tile" onClick={() => setModalOpen(true)}>
        <svg className="auth-tile-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Zaloguj się</span>
      </button>
      {modalOpen && <AuthModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function AuthModal({ onClose }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function switchTab(next) {
    setTab(next);
    setError('');
    setSuccessMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setBusy(true);

    const supabase = createClient();

    if (tab === 'login') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      onClose();
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setSuccessMsg('Konto utworzone! Sprawdź swoją skrzynkę e-mail i potwierdź adres, żeby się zalogować.');
    }
  }

  const modal = (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Zaloguj się
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Zarejestruj się
          </button>
        </div>

        {successMsg ? (
          <div className="auth-success">{successMsg}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label htmlFor="auth-email">E-mail</label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Hasło</label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
                Anuluj
              </button>
              <button type="submit" className="modal-btn modal-btn-primary" disabled={busy}>
                {busy ? 'Chwileczkę...' : tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';

// Zalogowani widzą swoje opcje (Favorites/My Settings/Search History/Log
// out) w AccountBar (app/AccountBar.js), nie tutaj. AuthWidget renderuje się
// więc tylko dla gościa (Log in/Sign up) — dla zalogowanego zwraca null.
// Renderowany raz, globalnie, w .top-right-bar obok AccountBar i przełącznika
// PL/EN (patrz app/layout.js) — stąd kompaktowe rozmiary przycisków, żeby
// pasowały do reszty pigułek w tym pasku.
export default function AuthWidget() {
  const [mounted, setMounted] = useState(false);
  const { user, loadingUser } = useFavorites();
  const { t } = useLocale();
  const [modalTab, setModalTab] = useState(null); // null = closed, 'login' | 'register' = open on that tab

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setModalTab(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    // Serduszko na kafelku (FavoriteButton) wysyła to zdarzenie, gdy
    // niezalogowany użytkownik próbuje dodać coś do ulubionych.
    function onOpenAuthModal(e) {
      setModalTab(e.detail?.tab || 'login');
    }
    window.addEventListener('open-auth-modal', onOpenAuthModal);
    return () => window.removeEventListener('open-auth-modal', onOpenAuthModal);
  }, []);

  if (!mounted || loadingUser || user) return null;

  return (
    <div className="auth-widget">
      <button className="auth-btn" onClick={() => setModalTab('login')}>
        {t('logIn')}
      </button>
      <button className="auth-btn primary" onClick={() => setModalTab('register')}>
        {t('signUp')}
      </button>
      {modalTab && <AuthModal initialTab={modalTab} onClose={() => setModalTab(null)} />}
    </div>
  );
}

function AuthModal({ initialTab, onClose }) {
  const { t } = useLocale();
  const [tab, setTab] = useState(initialTab);
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
      setSuccessMsg(t('accountCreated'));
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
            {t('logIn')}
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            {t('signUp')}
          </button>
        </div>

        {successMsg ? (
          <div className="auth-success">{successMsg}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label htmlFor="auth-email">{t('email')}</label>
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
              <label htmlFor="auth-password">{t('password')}</label>
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
                {t('cancel')}
              </button>
              <button type="submit" className="modal-btn modal-btn-primary" disabled={busy}>
                {busy ? t('pleaseWait') : tab === 'login' ? t('logIn') : t('createAccount')}
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

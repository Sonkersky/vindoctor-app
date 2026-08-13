'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/app/i18n/LocaleContext';

export default function BuyLeadModal({ car }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const carLabel = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();

  function openModal() {
    setError('');
    setSent(false);
    setOpen(true);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setError(t('leadConsentRequired'));
      return;
    }
    setError('');
    setBusy(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: car.vin, name, phone, email, message, consent }),
      });
      if (!res.ok) throw new Error('request failed');
      setSent(true);
    } catch {
      setError(t('leadError'));
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={handleOverlayClick}>
      <div className="modal-content" style={{ maxWidth: 460 }}>
        <div className="favorites-panel-header">
          <h3>{t('interestedInCar')}</h3>
          <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setOpen(false)}>
            {t('close')}
          </button>
        </div>

        {sent ? (
          <div className="auth-success">
            {t('leadThanks')} <strong>{carLabel}</strong> {t('leadThanks2')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="modal-text">
              {t('leadIntro')} <strong>{carLabel}</strong>.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-field">
              <label htmlFor="lead-name">{t('fullName')}</label>
              <input
                id="lead-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('leadNamePlaceholder')}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="lead-phone">{t('phone')}</label>
              <input
                id="lead-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="lead-email">{t('emailOptional')}</label>
              <input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="lead-message">{t('messageOptional')}</label>
              <textarea
                id="lead-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('leadMessagePlaceholder')}
              />
            </div>

            <label className="lead-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                {t('leadConsent')}{' '}
                <a href="#" onClick={(e) => e.stopPropagation()}>
                  {t('privacyPolicy')}
                </a>
                .
              </span>
            </label>

            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-secondary" onClick={() => setOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="submit"
                className={`modal-btn modal-btn-primary ${!consent ? 'disabled' : ''}`}
                disabled={busy || !consent}
              >
                {busy ? t('sending') : t('sendRequest')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className="buy-car-btn" onClick={openModal}>
        {t('buyThisCar')}
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

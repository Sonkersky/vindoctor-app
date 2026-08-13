'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/app/i18n/LocaleContext';

export default function ClaimModal() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  function openModal() {
    setAccepted(false);
    setOpen(true);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  function handleNextStep() {
    alert(t('claimNextStepAlert'));
    setOpen(false);
  }

  const modal = (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={handleOverlayClick}>
        <div className="modal-content">
          <div className="modal-text">{t('claimPrivacyText')}</div>

          <div className="modal-warning-title">{t('claimWarningTitle')}</div>

          <ul className="modal-list">
            <li>{t('claimListItem1')}</li>
            <li>{t('claimListItem2')}</li>
            <li>{t('claimListItem3')}</li>
          </ul>

          <div className="modal-checkbox-group">
            <input
              type="checkbox"
              id="acceptCheckbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <label htmlFor="acceptCheckbox">{t('claimCheckboxLabel')}</label>
          </div>

          <div className="modal-actions">
            <button className="modal-btn modal-btn-secondary" onClick={() => setOpen(false)}>
              {t('cancel')}
            </button>
            <button
              className={`modal-btn modal-btn-primary ${accepted ? '' : 'disabled'}`}
              onClick={handleNextStep}
              disabled={!accepted}
            >
              {t('nextStep')}
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <>
      <button className="claim-btn" onClick={openModal}>
        {t('claimThisLot')}
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

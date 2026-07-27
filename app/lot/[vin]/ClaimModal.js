'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ClaimModal() {
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
    alert('Proceeding to the next step of claiming the lot.');
    setOpen(false);
  }

  const modal = (
    <div className={`modal-overlay ${open ? 'active' : ''}`} onClick={handleOverlayClick}>
        <div className="modal-content">
          <div className="modal-text">
            We do respect privacy rights of every person. Therefore if you do not want to show the lot you have
            purchased on our website, you can hide it.
          </div>

          <div className="modal-warning-title">PLEASE BE AWARE THAT IT IS PROHIBITED TO:</div>

          <ul className="modal-list">
            <li>Hide lot if you want to avoid the right tax calculation;</li>
            <li>Hide lot for hiding damage and odometer information from the future buyers;</li>
            <li>Hide lot for misinformation, misrepresentation, fraud or other illegal activity;</li>
          </ul>

          <div className="modal-checkbox-group">
            <input
              type="checkbox"
              id="acceptCheckbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <label htmlFor="acceptCheckbox">I have read and accept the limitations stated above</label>
          </div>

          <div className="modal-actions">
            <button className="modal-btn modal-btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className={`modal-btn modal-btn-primary ${accepted ? '' : 'disabled'}`}
              onClick={handleNextStep}
              disabled={!accepted}
            >
              Next step
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <>
      <button className="claim-btn" onClick={openModal}>
        Claim This Lot
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

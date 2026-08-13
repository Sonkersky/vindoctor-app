'use client';

import { createPortal } from 'react-dom';
import { useFavorites } from './FavoritesContext';
import { useLocale } from './i18n/LocaleContext';

export default function MySettingsPanel({ onClose }) {
  const { mileageUnit, updateMileageUnit } = useFavorites();
  const { t } = useLocale();

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const panel = (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="favorites-panel-header">
          <h3>⚙️ {t('mySettings')}</h3>
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        <div className="settings-field">
          <label>{t('distanceUnit')}</label>
          <div className="settings-unit-toggle">
            <button
              type="button"
              className={`settings-unit-btn ${mileageUnit === 'mi' ? 'active' : ''}`}
              onClick={() => updateMileageUnit('mi')}
            >
              {t('miles')}
            </button>
            <button
              type="button"
              className={`settings-unit-btn ${mileageUnit === 'km' ? 'active' : ''}`}
              onClick={() => updateMileageUnit('km')}
            >
              {t('kilometers')}
            </button>
          </div>
          <p className="settings-hint">{t('distanceUnitHint')}</p>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}

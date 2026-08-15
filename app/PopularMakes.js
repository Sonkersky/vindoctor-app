'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from './i18n/LocaleContext';

// Zakładki tylko dla typów, które faktycznie mają jakieś marki w danych —
// apicar.store zwraca surowe angielskie wartości vehicle_type, nie
// tłumaczymy ich (tak samo jak w filtrze bocznym "Vehicle Type").
const TABS = ['Automobile', 'Motorcycle', 'ATV'];

function makeHref(make, vehicleType) {
  const params = new URLSearchParams({ make });
  if (vehicleType !== 'Automobile') params.set('vehicleType', vehicleType);
  return `/?${params.toString()}`;
}

export default function PopularMakes({ makes }) {
  const { t } = useLocale();
  const availableTabs = TABS.filter((tab) => (makes[tab] || []).length > 0);
  const [activeTab, setActiveTab] = useState(availableTabs[0]);

  if (availableTabs.length === 0) return null;

  const activeMakes = makes[activeTab] || [];

  return (
    <section className="popular-makes-section">
      <div className="popular-makes-header">
        <h2 className="highlight-section-title">{t('popularMakes')}</h2>
        <div className="popular-makes-tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              className={`popular-makes-tab ${tab === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="popular-makes-grid">
        {activeMakes.map((make) => (
          <Link key={make} href={makeHref(make, activeTab)} className="make-card">
            <span className="make-card-icon">{make.charAt(0).toUpperCase()}</span>
            <span className="make-card-name">{make}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

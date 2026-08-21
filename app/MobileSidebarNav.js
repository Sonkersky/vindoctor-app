'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from './i18n/LocaleContext';

const MOBILE_QUERY = '(max-width: 900px)';

function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

// Na desktopie Menu (AccountBar variant="sidebar") i Filtry (FilterSidebar)
// renderują się DOKŁADNIE jak wcześniej — wprost w .sidebar-column, bez
// żadnego wrappera. Dopiero poniżej MOBILE_QUERY (ten sam próg co zwinięcie
// .main-layout do jednej kolumny) zamieniamy je w panele wysuwane z lewej,
// otwierane dwiema małymi zakładkami.
//
// Panel MUSI iść przez createPortal do document.body (ten sam wzorzec co
// FavoritesPanel.js/SearchHistoryPanel.js) — .container ma
// position:relative + z-index:1, co tworzy WŁASNY kontekst warstwowania;
// każdy potomek .container (czyli też ten panel, gdyby został tu w
// miejscu) jest przez to zawsze POD .top-right-bar (z-index:1100,
// bezpośrednie dziecko <body>) niezależnie od tego, jak wysoki z-index by
// mu nadać — potwierdzone na żywo (Log in/Sign up renderowały się NAD
// panelem mimo z-index:2001 na panelu). Portal do document.body wychodzi z
// tego kontekstu i porównanie z .top-right-bar znów działa normalnie.
export default function MobileSidebarNav({ menu, viewToggle, filters }) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openDrawer, setOpenDrawer] = useState(null); // 'menu' | 'filters' | null

  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    function onChange(e) {
      setIsMobile(e.matches);
      if (!e.matches) setOpenDrawer(null);
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!openDrawer) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpenDrawer(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openDrawer]);

  function close() {
    setOpenDrawer(null);
  }

  // SSR i pierwszy render przed hydracją (mounted=false) muszą wyglądać
  // identycznie jak dotychczasowy desktop-owy układ, żeby uniknąć
  // hydration mismatch — stąd ten sam early-return dla "!mounted".
  if (!mounted || !isMobile) {
    return (
      <>
        {menu}
        {viewToggle}
        {filters}
      </>
    );
  }

  const drawer = (
    <>
      {openDrawer && <div className="mobile-drawer-backdrop" onClick={close} />}

      <div className={`mobile-drawer-panel ${openDrawer === 'menu' ? 'mobile-drawer-open' : ''}`}>
        <div className="mobile-drawer-header">
          <span>{t('accountMenuTitle')}</span>
          <button type="button" className="mobile-drawer-close" onClick={close} aria-label={t('close')}>
            ✕
          </button>
        </div>
        {menu}
      </div>

      <div className={`mobile-drawer-panel ${openDrawer === 'filters' ? 'mobile-drawer-open' : ''}`}>
        <div className="mobile-drawer-header">
          <span>{t('filters')}</span>
          <button type="button" className="mobile-drawer-close" onClick={close} aria-label={t('close')}>
            ✕
          </button>
        </div>
        {filters}
      </div>
    </>
  );

  return (
    <>
      <div className="mobile-sidebar-tabs">
        <button type="button" className="mobile-sidebar-tab" onClick={() => setOpenDrawer('menu')}>
          <IconMenu />
          {t('accountMenuTitle')}
        </button>
        <button type="button" className="mobile-sidebar-tab" onClick={() => setOpenDrawer('filters')}>
          <IconFilter />
          {t('filters')}
        </button>
      </div>

      {viewToggle}

      {createPortal(drawer, document.body)}
    </>
  );
}

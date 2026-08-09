import Link from 'next/link';
import './lot.css';

// Plik-konwencja Next.js (not-found.js) — w połączeniu z notFound() wywołanym
// w page.js daje PRAWDZIWE HTTP 404 (+ automatyczny <meta name="robots"
// content="noindex">) zamiast wcześniejszego "miękkiego 404" (strona z
// tekstem "Vehicle not found" zwracana ze statusem 200, co Google i tak
// prędzej czy później oznaczał jako błąd jakości strony).
export default function LotNotFound() {
  return (
    <div className="lot-page-container">
      <div className="header-logo">
        <Link href="/" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="DOCTOR.VIN" className="logo-img" />
        </Link>
      </div>
      <div className="top-bar">
        <Link href="/" className="back-link">
          ← Back to listings
        </Link>
      </div>
      <h1 className="car-title-main">Vehicle not found for this VIN.</h1>
    </div>
  );
}

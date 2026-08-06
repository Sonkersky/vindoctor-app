'use client';

import { useEffect, useMemo, useState } from 'react';

const ROTATE_MS = 5000;
const MAX_PHOTOS = 3;

export default function TileImageCarousel({ images, alt }) {
  const rotationImages = useMemo(() => (images || []).slice(0, MAX_PHOTOS), [images]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (rotationImages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % rotationImages.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [rotationImages]);

  const src = rotationImages[index] || 'https://placehold.co/600x400/1e293b/94a3b8?text=No+Image';

  // Kafelek to <Link> (nawigacja do podstrony lotu) — strzałki muszą
  // zatrzymać propagację kliknięcia, inaczej zamiast zmienić zdjęcie
  // przeniosą od razu na podstronę.
  function goTo(e, delta) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + delta + rotationImages.length) % rotationImages.length);
  }

  return (
    <>
      {/* key={index} wymusza remount przy każdej zmianie zdjęcia, dzięki
          czemu animacja CSS (fade-in) odpala się od nowa za każdym razem. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={index} src={src} alt={alt} className="card-image tile-carousel-fade" loading="lazy" />
      {rotationImages.length > 1 && (
        <>
          <button type="button" className="tile-nav-arrow prev" onClick={(e) => goTo(e, -1)} aria-label="Previous photo">
            ❮
          </button>
          <button type="button" className="tile-nav-arrow next" onClick={(e) => goTo(e, 1)} aria-label="Next photo">
            ❯
          </button>
        </>
      )}
    </>
  );
}

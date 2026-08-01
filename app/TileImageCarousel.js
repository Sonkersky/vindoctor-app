'use client';

import { useEffect, useState } from 'react';

const ROTATE_MS = 4000;

export default function TileImageCarousel({ images, alt }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [images]);

  const src = (images && images[index]) || 'https://placehold.co/600x400/1e293b/94a3b8?text=No+Image';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="card-image" loading="lazy" />
  );
}

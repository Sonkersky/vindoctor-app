'use client';

import { useState } from 'react';

export default function LotGallery({ galleryItems, photoUrls, vin, title }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zipLabel, setZipLabel] = useState('Download All Photos');
  const [zipBusy, setZipBusy] = useState(false);

  const item = galleryItems[currentIndex] || galleryItems[0];
  const hasSpin = galleryItems.some((it) => it.type === '360');
  const hasVideo = galleryItems.some((it) => it.type === 'video');

  function jumpToGalleryType(type) {
    const idx = galleryItems.findIndex((it) => it.type === type);
    if (idx === -1) return;
    setCurrentIndex(idx);
  }

  function nextImage() {
    setCurrentIndex((i) => (i + 1) % galleryItems.length);
  }

  function prevImage() {
    setCurrentIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length);
  }

  async function downloadAllPhotos() {
    if (!photoUrls || photoUrls.length === 0) return;
    if (typeof window === 'undefined' || typeof window.JSZip === 'undefined') {
      alert('ZIP library failed to load. Please check your internet connection and try again.');
      return;
    }

    setZipBusy(true);
    const zip = new window.JSZip();
    let successCount = 0;

    for (let i = 0; i < photoUrls.length; i++) {
      setZipLabel(`Downloading ${i + 1}/${photoUrls.length}...`);
      const url = photoUrls[i];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        const ext = (url.split('.').pop() || 'jpg').split('?')[0].slice(0, 4) || 'jpg';
        zip.file(`photo_${String(i + 1).padStart(2, '0')}.${ext}`, blob);
        successCount++;
      } catch (err) {
        console.warn(`Could not fetch image ${i + 1} for ZIP (likely CORS-blocked):`, err);
      }
    }

    if (successCount === 0) {
      alert(
        'Sorry, none of the photos could be packaged into a ZIP (the image server may be blocking direct downloads). Try saving images individually instead.'
      );
      setZipBusy(false);
      setZipLabel('Download All Photos');
      return;
    }

    try {
      setZipLabel('Packaging ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${vin || 'vehicle'}_photos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      if (successCount < photoUrls.length) {
        alert(`${successCount} of ${photoUrls.length} photos were packaged. Some images could not be downloaded due to server restrictions.`);
      }
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
      alert('Failed to generate the ZIP file. Please try again.');
    } finally {
      setZipBusy(false);
      setZipLabel('Download All Photos');
    }
  }

  return (
    <div className="gallery-section">
      <div className="main-image-container">
        <button className="nav-arrow prev" onClick={prevImage}>
          ❮
        </button>

        {item.type === '360' && (
          <iframe className="main-360-frame" src={item.url} allowFullScreen title="360 view" />
        )}
        {item.type === 'video' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="main-video" src={item.url} controls playsInline />
        )}
        {item.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img id="mainImage" src={item.url} alt={title ? `${title} - photo ${currentIndex + 1}` : 'Vehicle photo'} />
        )}

        {item.type === '360' && (
          <a className="open-360-link" href={item.url} target="_blank" rel="noopener noreferrer">
            Open Interactive 360° View ↗
          </a>
        )}

        {item.type !== '360' && item.type !== 'video' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo_2.png" alt="" className="img-watermark" />
        )}

        <button className="nav-arrow next" onClick={nextImage}>
          ❯
        </button>
      </div>

      <div className="gallery-toolbar">
        <button className="gallery-toolbar-btn" onClick={downloadAllPhotos} disabled={zipBusy}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13" />
            <path d="M6 11l6 6 6-6" />
            <path d="M5 21h14" />
          </svg>
          <span>{zipLabel}</span>
        </button>
        {hasSpin && (
          <button className="gallery-toolbar-btn" onClick={() => jumpToGalleryType('360')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 11-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>360° View</span>
          </button>
        )}
        {hasVideo && (
          <button className="gallery-toolbar-btn" onClick={() => jumpToGalleryType('video')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span>Engine Video</span>
          </button>
        )}
      </div>

      <div className="thumbnails-grid">
        {galleryItems.map((it, idx) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
          <div key={idx} className={`thumb ${idx === currentIndex ? 'active' : ''}`} onClick={() => setCurrentIndex(idx)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.thumb} alt={title ? `${title} - thumbnail ${idx + 1}` : `Thumbnail ${idx + 1}`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_2.png" alt="" className="img-watermark" />
          </div>
        ))}
      </div>
    </div>
  );
}

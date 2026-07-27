function normalizeToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

// Buduje pełną galerię: zdjęcia + 360° + wideo, w tej samej kolejności co oryginał.
export function buildGalleryItems(car) {
  const items = [];
  const hdImages = (car.link_img_hd && car.link_img_hd.length ? car.link_img_hd : car.link_img_small) || [];
  const thumbImages = (car.link_img_small && car.link_img_small.length ? car.link_img_small : hdImages) || [];

  hdImages.forEach((url, idx) => {
    items.push({ type: 'image', url, thumb: thumbImages[idx] || url });
  });

  const fallbackThumb = thumbImages[0] || hdImages[0] || 'https://placehold.co/300x200/1e293b/94a3b8?text=360';

  const spinUrls = [...normalizeToArray(car.iaai_360), ...normalizeToArray(car.copart_exterior_360)];
  spinUrls.forEach((url) => {
    items.push({ type: '360', url, thumb: fallbackThumb });
  });

  const videoUrls = normalizeToArray(car.video);
  videoUrls.forEach((url) => {
    items.push({ type: 'video', url, thumb: fallbackThumb });
  });

  if (items.length === 0) {
    items.push({
      type: 'image',
      url: 'https://placehold.co/1000x700/1e293b/94a3b8?text=No+Image',
      thumb: 'https://placehold.co/1000x700/1e293b/94a3b8?text=No+Image',
    });
  }

  return items;
}

export function getPhotoUrls(car) {
  const images = (car.link_img_hd && car.link_img_hd.length ? car.link_img_hd : car.link_img_small) || [];
  return images.length ? images : ['https://placehold.co/1000x700/1e293b/94a3b8?text=No+Image'];
}

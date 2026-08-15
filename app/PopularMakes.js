import Link from 'next/link';

// Logotypy z Simple Icons (simpleicons.org) — CC0, zbiór SVG-ów marek
// stworzony właśnie do identyfikacji marki na stronach trzecich (nie
// scrapowane z przypadkowego źródła). GMC/Dodge/Lexus nie mają tam
// swojego logo (biblioteka nie pokrywa wszystkich marek) — celowo pominięte
// zamiast pokazywać placeholder.
// makeParam — dokładna wartość kolumny "make" w naszej bazie (patrz
// active_lot_makes) — bywa inna niż etykieta widoczna na karcie (np. "Range
// Rover" pokazujemy, ale w danych to "Land Rover"; "Mercedes" -> "Mercedes-Benz").
const BRANDS = [
  { name: 'Alfa Romeo', slug: 'alfaromeo', makeParam: 'Alfa Romeo' },
  { name: 'Aston Martin', slug: 'astonmartin', makeParam: 'Aston Martin' },
  { name: 'Audi', slug: 'audi', makeParam: 'Audi' },
  { name: 'Bentley', slug: 'bentley', makeParam: 'Bentley' },
  { name: 'BMW', slug: 'bmw', makeParam: 'BMW' },
  { name: 'Ferrari', slug: 'ferrari', makeParam: 'Ferrari' },
  { name: 'Ford', slug: 'ford', makeParam: 'Ford' },
  { name: 'Chevrolet', slug: 'chevrolet', makeParam: 'Chevrolet' },
  { name: 'Jaguar', slug: 'jaguar', makeParam: 'Jaguar' },
  { name: 'Lamborghini', slug: 'lamborghini', makeParam: 'Lamborghini' },
  { name: 'Range Rover', slug: 'landrover', makeParam: 'Land Rover' },
  { name: 'Lexus', slug: null, makeParam: 'Lexus' },
  { name: 'Maserati', slug: 'maserati', makeParam: 'Maserati' },
  { name: 'Mercedes-Benz', slug: 'mercedes', makeParam: 'Mercedes-Benz' },
  { name: 'Porsche', slug: 'porsche', makeParam: 'Porsche' },
  { name: 'Ram', slug: 'ram', makeParam: 'Ram' },
  { name: 'Rolls-Royce', slug: 'rollsroyce', makeParam: 'Rolls-Royce' },
  { name: 'Tesla', slug: 'tesla', makeParam: 'Tesla' },
  { name: 'Volvo', slug: 'volvo', makeParam: 'Volvo' },
].filter((b) => b.slug);

function splitIntoRows(items) {
  const rowA = [];
  const rowB = [];
  items.forEach((item, i) => (i % 2 === 0 ? rowA : rowB).push(item));
  return [rowA, rowB];
}

function BrandCard({ brand }) {
  return (
    <Link href={`/?make=${encodeURIComponent(brand.makeParam)}`} className="brand-marquee-card" title={brand.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/logos/${brand.slug}.svg`} alt={brand.name} className="brand-marquee-logo" loading="lazy" />
    </Link>
  );
}

function MarqueeRow({ items }) {
  // Treść zduplikowana 2x + animacja translateX(0 -> -50%) w pętli — to
  // standardowa sztuczka na niekończący się, płynny scroll bez JS: w
  // momencie gdy pierwsza kopia w całości "wyjedzie" w lewo, druga kopia
  // jest dokładnie w tym samym miejscu startowym, więc pętla jest niewidoczna.
  return (
    <div className="brand-marquee-row">
      <div className="brand-marquee-track">
        {items.map((brand, i) => (
          <BrandCard key={`a-${i}`} brand={brand} />
        ))}
        {items.map((brand, i) => (
          <BrandCard key={`b-${i}`} brand={brand} />
        ))}
      </div>
    </div>
  );
}

export default function PopularMakes() {
  const [rowA, rowB] = splitIntoRows(BRANDS);

  return (
    <section className="popular-makes-section brand-marquee-section">
      <MarqueeRow items={rowA} />
      <MarqueeRow items={rowB} />
    </section>
  );
}

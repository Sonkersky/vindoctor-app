import { NextResponse } from 'next/server';

// Oficjalne, darmowe kursy NBP (bank centralny) — dokładnie ten sam typ
// źródła co GOOGLEFINANCE w oryginalnym arkuszu Excel, tylko stabilniejszy
// (NBP nie wymaga klucza API i ma jasną politykę dostępności).
const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/A';

async function fetchRate(code) {
  const res = await fetch(`${NBP_BASE}/${code}/last/1/?format=json`, {
    next: { revalidate: 3600 }, // kursy NBP publikowane raz dziennie — godzina cache w zupełności wystarczy
  });
  if (!res.ok) throw new Error(`NBP ${code} responded with status ${res.status}`);
  const data = await res.json();
  return data.rates[0].mid;
}

export async function GET() {
  try {
    const [usdPln, eurPln] = await Promise.all([fetchRate('USD'), fetchRate('EUR')]);
    return NextResponse.json({ usdPln, eurPln });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

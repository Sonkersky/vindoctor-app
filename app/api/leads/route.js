import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';
import { getCarByVin } from '@/lib/queries';
import { sendLeadNotificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const vin = (body.vin || '').trim();
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();
  const message = (body.message || '').trim();
  const consent = Boolean(body.consent);

  if (!vin || !name || !phone || !consent) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // getCarByVin() sprawdza OBIE tabele (cars + active_lots) — samo "cars"
  // (jak było tu wcześniej) zwracało 404 dla 98,6% lotów na stronie, bo
  // niemal wszystkie aktywne aukcje istnieją TYLKO w active_lots (patrz
  // komentarz przy getCarByVin w lib/queries.js) — realnie odrzucało to
  // prawie każdy formularz "Buy This Car" po dodaniu zakładki Actual.
  const supabase = getSupabaseClient();
  const car = await getCarByVin(vin).catch(() => null);

  if (!car) {
    return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
  }

  const { error: insertError } = await supabase.from('leads').insert({
    car_vin: vin,
    name,
    phone,
    email: email || null,
    message: message || null,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Could not save your request.' }, { status: 500 });
  }

  // Best-effort — brak/awaria maila nie ma unieważniać już zapisanego leada,
  // widoczny będzie i tak w panelu admina.
  try {
    await sendLeadNotificationEmail({ car, name, phone, email, message });
  } catch (err) {
    console.error('sendLeadNotificationEmail failed:', err.message);
  }

  return NextResponse.json({ ok: true });
}

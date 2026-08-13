import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';
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

  const supabase = getSupabaseClient();

  const { data: car, error: carError } = await supabase
    .from('cars')
    .select('vin, title, year, make, model')
    .eq('vin', vin)
    .maybeSingle();

  if (carError || !car) {
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

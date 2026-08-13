import nodemailer from 'nodemailer';

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu';
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error('Brak ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD w zmiennych środowiskowych.');
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransporter;
}

// Wysyła powiadomienie o nowym leadzie ("Buy This Car") na adres administratora.
// Celowo nie blokuje/nie psuje zapisu leada w bazie jeśli się nie uda — patrz
// wywołanie w app/api/leads/route.js (błąd tylko logowany, nie rzucany dalej).
export async function sendLeadNotificationEmail({ car, name, phone, email, message }) {
  const transporter = getTransporter();
  const from = process.env.ZOHO_SMTP_USER;
  const to = process.env.LEAD_NOTIFICATION_EMAIL || from;

  const carLabel = car.title || `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim();
  const lotUrl = `https://doctor.vin/lot/${encodeURIComponent(car.vin)}`;

  await transporter.sendMail({
    from: `VINDOCTOR Leads <${from}>`,
    to,
    replyTo: email || undefined,
    subject: `Nowy lead: ${carLabel}`,
    text: [
      `Nowe zgłoszenie zainteresowania autem.`,
      ``,
      `Auto: ${carLabel}`,
      `VIN: ${car.vin}`,
      `Link: ${lotUrl}`,
      ``,
      `Imię i nazwisko: ${name}`,
      `Telefon: ${phone}`,
      `E-mail: ${email || '(nie podano)'}`,
      `Wiadomość: ${message || '(brak)'}`,
    ].join('\n'),
  });
}

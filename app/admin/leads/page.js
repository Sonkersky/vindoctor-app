import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) redirect('/');

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, car_vin, name, phone, email, message, created_at, cars(title, year, make, model)')
    .order('created_at', { ascending: false });

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Leads</h1>
        </div>
        <Link href="/" className="admin-back-link">
          ← Back to site
        </Link>
      </div>

      {error && <div className="admin-error">Could not load leads: {error.message}</div>}

      {!error && (!leads || leads.length === 0) && (
        <div className="admin-empty">No leads yet — they&apos;ll show up here as soon as someone submits the form.</div>
      )}

      {leads && leads.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const carLabel =
                  lead.cars?.title ||
                  `${lead.cars?.year || ''} ${lead.cars?.make || ''} ${lead.cars?.model || ''}`.trim() ||
                  lead.car_vin;
                return (
                  <tr key={lead.id}>
                    <td className="admin-nowrap">{formatDate(lead.created_at)}</td>
                    <td>
                      <Link href={`/lot/${encodeURIComponent(lead.car_vin)}`} className="admin-vehicle-link">
                        {carLabel}
                      </Link>
                    </td>
                    <td>{lead.name}</td>
                    <td className="admin-nowrap">{lead.phone}</td>
                    <td>{lead.email || '—'}</td>
                    <td className="admin-message">{lead.message || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

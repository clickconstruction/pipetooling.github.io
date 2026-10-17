/**
 * The reads behind the one lookup for doubles (v2.5579): every lane's prospects, paged past
 * PostgREST's thousand rows, as `companyDouble` wants them. The customers come from
 * `loadCustomerDoubles` (gcLeadLaneIo.ts) and the bench from the GC board, as before.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import type { ProspectKind } from './prospectKinds'
import type { ProspectDoubleRow } from './companyDouble'

type Row = { id: string; company_name: string | null; phone_number: string | null; kind: ProspectKind; prospect_fit_status: string | null; last_contact: string | null; created_at: string | null; updated_at: string | null; maps_url: string | null }

export async function loadProspectDoubles(): Promise<ProspectDoubleRow[]> {
  const rows = await fetchAllRows<Row>(
    (from, to) =>
      supabase
        .from('prospects')
        .select('id, company_name, phone_number, kind, prospect_fit_status, last_contact, created_at, updated_at, maps_url')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
    'prospect doubles',
  )
  return rows
    .filter((r) => (r.company_name ?? '').trim() || (r.phone_number ?? '').replace(/\D/g, '').length >= 7 || (r.maps_url ?? '').trim())
    .map((r) => ({ id: r.id, name: (r.company_name ?? '').trim(), phone: r.phone_number, kind: r.kind, status: r.prospect_fit_status, last_contact: r.last_contact, created_at: r.created_at, updated_at: r.updated_at, maps_url: r.maps_url }))
}

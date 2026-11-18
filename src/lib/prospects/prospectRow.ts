import type { ProspectKind } from './prospectKinds'

/**
 * The prospect row and its comment, as `src/pages/Prospects.tsx` reads them. They were page-local types; they live
 * here so the page's kernels and the components cut out of it share one shape. `prospectRow.test.ts` holds the
 * column list to the type: a column added to one and not the other fails.
 */

/** A row of `prospects` as the Prospects page reads it: the company, the person we call, and the kind's own facts. */
export type Prospect = {
  id: string
  master_user_id: string
  created_by: string
  warmth_count: number
  prospect_fit_status: string | null
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  links_to_website: string | null
  notes: string | null
  last_contact: string | null
  created_at: string | null
  updated_at: string | null
  /** v2.5559: customer · gc_lead · sub, and each kind's facts. */
  kind: ProspectKind
  source: string | null
  trades: string[] | null
  max_miles: number | null
  lang: string | null
  company_role: string | null
  customer_id: string | null
  converted_customer_id: string | null
  converted_gc_company_id: string | null
  /** v2.5601: the person we call, and whether we may text them. */
  is_person: boolean
  contact_title: string | null
  contact_phone: string | null
  ok_to_text: string | null
  maps_url: string | null
  license: string | null
  also_reach: string | null
  /** v2.5809: the office's priority on the Subs board, 1 Call first, null Normal, 3 Later. */
  priority: number | null
}

/** Every column the deck reads (v2.5559 added the kind and its facts, v2.5809 the priority). */
export const PROSPECT_COLUMNS =
  'id, master_user_id, created_by, warmth_count, prospect_fit_status, company_name, contact_name, phone_number, email, address, links_to_website, notes, last_contact, created_at, updated_at, kind, source, trades, max_miles, lang, company_role, customer_id, converted_customer_id, converted_gc_company_id, is_person, contact_title, contact_phone, ok_to_text, maps_url, license, also_reach, priority'

/** A line of a prospect's history: a call's outcome or a plain note, with who wrote it. */
export type ProspectComment = {
  id: string
  prospect_id: string
  created_by: string
  created_at: string
  comment_text: string
  interaction_type: string
  created_by_user?: { name: string | null; email: string | null } | null
}

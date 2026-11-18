import { describe, expect, it } from 'vitest'
import { PROSPECT_COLUMNS, type Prospect } from './prospectRow'

/** Every key of the type, once. `satisfies` fails the typecheck when the type gains or loses a key this misses. */
const EVERY_KEY = {
  id: true,
  master_user_id: true,
  created_by: true,
  warmth_count: true,
  prospect_fit_status: true,
  company_name: true,
  contact_name: true,
  phone_number: true,
  email: true,
  address: true,
  links_to_website: true,
  notes: true,
  last_contact: true,
  created_at: true,
  updated_at: true,
  kind: true,
  source: true,
  trades: true,
  max_miles: true,
  lang: true,
  company_role: true,
  customer_id: true,
  converted_customer_id: true,
  converted_gc_company_id: true,
  is_person: true,
  contact_title: true,
  contact_phone: true,
  ok_to_text: true,
  maps_url: true,
  license: true,
  also_reach: true,
  priority: true,
} satisfies Record<keyof Prospect, true>

describe('PROSPECT_COLUMNS', () => {
  const columns = PROSPECT_COLUMNS.split(',').map((c) => c.trim())

  it('reads every key the type holds, and nothing the type does not', () => {
    expect([...columns].sort()).toEqual(Object.keys(EVERY_KEY).sort())
  })

  it('names no column twice', () => {
    expect(new Set(columns).size).toBe(columns.length)
  })

  it('is one comma list with no embed, so PostgREST reads plain columns', () => {
    expect(PROSPECT_COLUMNS).not.toMatch(/[()*:!]/)
  })
})

/**
 * Bid Room payload — server twin of src/lib/bids/bidRoomPayload.ts (parse side only; payloads
 * are written exclusively by the staff app's publish kernel). Dependency-free; a parity test in
 * src/lib keeps the two aligned (the estimateOptions pattern).
 */

export type SharedRoomFixtureRow = { fixture: string; count: number | string }

export type SharedRoomOption = {
  key: string
  name: string
  is_base: boolean
  total_cents: number
  fixture_rows: SharedRoomFixtureRow[]
}

export type SharedBidRoomPayload = {
  v: 1
  project_name: string
  project_address: string
  gc_name: string
  service_type_name: string
  options: SharedRoomOption[]
  inclusions: string
  exclusions: string
  terms: string
  header_brand: string | null
}

export function parseSharedBidRoomPayload(raw: unknown): SharedBidRoomPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1 || !Array.isArray(o.options)) return null
  const options: SharedRoomOption[] = []
  for (const x of o.options) {
    if (!x || typeof x !== 'object') continue
    const opt = x as Record<string, unknown>
    const key = typeof opt.key === 'string' ? opt.key.trim() : ''
    if (!key || options.some((p) => p.key === key)) continue
    const total = Number(opt.total_cents)
    options.push({
      key,
      name: typeof opt.name === 'string' ? opt.name : '',
      is_base: opt.is_base === true,
      total_cents: Number.isFinite(total) ? Math.round(total) : 0,
      fixture_rows: Array.isArray(opt.fixture_rows)
        ? opt.fixture_rows
            .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
            .map((r) => ({
              fixture: typeof r.fixture === 'string' ? r.fixture : '',
              count: typeof r.count === 'number' || typeof r.count === 'string' ? r.count : '',
            }))
        : [],
    })
  }
  if (options.length === 0 || !options.some((opt) => opt.is_base)) return null
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    v: 1,
    project_name: str('project_name'),
    project_address: str('project_address'),
    gc_name: str('gc_name'),
    service_type_name: str('service_type_name'),
    options,
    inclusions: str('inclusions'),
    exclusions: str('exclusions'),
    terms: str('terms'),
    header_brand: o.header_brand === 'plum' || o.header_brand === 'elec' ? (o.header_brand as string) : null,
  }
}

/**
 * Sample data for "What customers see" (Settings → dev-only, v2.2758+): the one fixture every
 * public edge function serves when a signed-in staff user asks for the sample token, and the
 * one the app's email builders render in the browser. Dependency-free so `src/lib/customerSample.ts`
 * can re-export it into the app — one fixture, no mirror.
 *
 * Nothing here exists in the database. Names are plainly invented (Sam Sample, Sample
 * Contracting, Sam's Plumbing LLC) so a screenshot can never be mistaken for a real customer.
 * The parts a customer surface takes from Settings (copy defaults, terms, footer, brand) are
 * NOT in this file on purpose — each edge function reads those live and lays them over the
 * fixture, which is the whole point: change a setting, see every surface follow.
 */

/** `?t=sample` — the live, unanswered state. */
export const SAMPLE_TOKEN = 'sample'
/** `?t=sample-done` — after the customer signed / accepted (the thank-you, the signed banner). */
export const SAMPLE_TOKEN_DONE = 'sample-done'
/** `?t=sample-gc` — the portal as a general contractor sees it (properties they GC, tagged). */
export const SAMPLE_TOKEN_GC = 'sample-gc'

export type SampleState = 'live' | 'done' | 'gc'

export function sampleStateFromToken(token: string | null | undefined): SampleState | null {
  const t = (token ?? '').trim()
  if (t === SAMPLE_TOKEN) return 'live'
  if (t === SAMPLE_TOKEN_DONE) return 'done'
  if (t === SAMPLE_TOKEN_GC) return 'gc'
  return null
}

/** Roles that may view sample surfaces — the office side of the app (never customers/subs). */
export const SAMPLE_VIEWER_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

export const SAMPLE_HOMEOWNER = {
  name: 'Sam Sample',
  email: 'sam.sample@example.com',
  phone: '(512) 555-0100',
  address: '100 Sample St, Kyle, TX 78640',
  portalSlug: 'sam-sample',
} as const

export const SAMPLE_GC = {
  company: 'Sample Contracting',
  contact: 'Pat Sample',
  email: 'pat@samplecontracting.example.com',
  portalSlug: 'sample-contracting',
} as const

export const SAMPLE_SUB = {
  company: "Sam's Plumbing LLC",
  contact: 'Sam Plumber',
  email: 'sam@samsplumbing.example.com',
  portalSlug: 'sams-plumbing',
} as const

/** The paper a sub signs on hire — a short, plainly-sample agreement body. */
export const SAMPLE_CONTRACT = {
  id: 'sample-contract',
  documentName: 'Subcontractor agreement (sample)',
  bodyHtml:
    '<h2>Subcontractor agreement</h2>' +
    '<p>This sample agreement is between <strong>Click Plumbing and Electrical</strong> (the Company) and <strong>Sam\'s Plumbing LLC</strong> (the Subcontractor).</p>' +
    '<h3>1. Scope</h3><p>The Subcontractor performs plumbing rough-in, top-out and trim on jobs the Company assigns, to the plans, the code and the Company\'s standards.</p>' +
    '<h3>2. Pay</h3><p>Work is paid per the agreed sheet for each job. Payments run weekly once the work passes inspection; final payments on builder jobs release when the builder accepts the work.</p>' +
    '<h3>3. Paperwork</h3><p>The Subcontractor keeps a current W-9 and certificate of insurance on file with the Company and uploads renewals before they expire.</p>' +
    '<h3>4. Safety and conduct</h3><p>The Subcontractor follows site safety rules, leaves work areas clean, and reports damage or problems the same day.</p>' +
    '<p><em>This is sample text shown in Settings → What customers see. It is not a real agreement.</em></p>',
} as const

export type SampleLineItem = { line_item: string; description: string; quantity: number; unit_price_cents: number; amount_cents: number }

const line = (line_item: string, description: string, quantity: number, unit_price_cents: number): SampleLineItem => ({
  line_item,
  description,
  quantity,
  unit_price_cents,
  amount_cents: quantity * unit_price_cents,
})

/** A homeowner's water heater replacement — four lines, $4,380. */
export const SAMPLE_ESTIMATE = {
  id: 'sample-estimate',
  number: 0,
  title: 'Water heater replacement',
  lines: [
    line('Remove existing water heater', 'Drain, disconnect and haul off the existing 50-gal gas heater', 1, 25_000),
    line('50-gal gas water heater, installed', 'Bradford White 50-gal atmospheric-vent gas heater, new flex connectors and gas shutoff', 1, 345_000),
    line('Expansion tank, pan and drain', 'Thermal expansion tank, drain pan and drain line to code', 1, 48_000),
    line('Permit and inspection', 'City of Kyle mechanical permit and inspection visit', 1, 20_000),
  ] as readonly SampleLineItem[],
  totalCents: 438_000,
  /** Days after "today" the sample estimate stays open. */
  validDays: 14,
  termsFallback:
    'This estimate is good for fourteen (14) days. Work is scheduled once the estimate is accepted; the full amount is due on completion. Manufacturer warranty on the heater; one-year workmanship warranty on our installation.',
} as const

export const SAMPLE_CHANGE_ORDER = {
  id: 'sample-change-order',
  number: 1,
  title: 'Add roof drain tie-in at grid C',
  description: 'Tie the new roof drain leader into the storm line at grid C per RFI 4; includes core drilling and a 4" cleanout.',
  reason: 'Roof drain location moved on the revised structural set (Δ2).',
  lines: [line('Roof drain tie-in at grid C', 'Core drill, 4" PVC leader, cleanout, tie-in to storm line', 1, 214_000)] as readonly SampleLineItem[],
  netChangeCents: 214_000,
} as const

export type SampleFixtureRow = { fixture: string; count: number }

/** A GC's plumbing bid — two options, the recommended one first. */
export const SAMPLE_BID = {
  number: 'B0000',
  projectName: 'Cedar Bend Apartments',
  projectAddress: '2530 Hunter Rd, San Marcos, TX 78666',
  serviceTypeName: 'Plumbing',
  headerBrand: 'plum' as 'plum' | 'elec',
  options: [
    {
      key: 'base',
      name: 'To Plans',
      is_base: true,
      total_cents: 5_634_300,
      fixture_rows: [
        { fixture: 'Water closet', count: 24 },
        { fixture: 'Lavatory', count: 24 },
        { fixture: 'Tub/shower', count: 12 },
        { fixture: 'Kitchen sink', count: 12 },
        { fixture: 'Water heater', count: 12 },
        { fixture: 'Hose bibb', count: 4 },
        { fixture: 'Roof drain', count: 6 },
      ] as readonly SampleFixtureRow[],
    },
    {
      key: 'alt-1',
      name: 'PEX in lieu of copper',
      is_base: false,
      total_cents: 5_210_000,
      fixture_rows: [
        { fixture: 'Water closet', count: 24 },
        { fixture: 'Lavatory', count: 24 },
        { fixture: 'Tub/shower', count: 12 },
        { fixture: 'Kitchen sink', count: 12 },
        { fixture: 'Water heater', count: 12 },
        { fixture: 'Hose bibb', count: 4 },
        { fixture: 'Roof drain', count: 6 },
      ] as readonly SampleFixtureRow[],
    },
  ],
  inclusions:
    'Complete rough-in, top-out and trim for 12 units and the common laundry per the plumbing sheets P-1 through P-6. Water heaters, fixtures and trim as scheduled. Gas piping to the water heaters. Roof drains and overflow per P-4. Testing, inspections and as-builts.',
  exclusionsFallback:
    'Concrete cutting, removal, and/or pour back is excluded from this proposal.\nThis proposal excludes all impact fees.\nThis proposal excludes any work not specifically described within.',
  termsFallback:
    'All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications. This estimate is subject to acceptance within thirty (30) days and is void thereafter.',
  revisionNote: 'Per addendum 2 — roof drains added at grid C.',
} as const

/** `YYYY-MM-DD` + n days, civil arithmetic (no zone). */
export function ymdPlusDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days))
  return d.toISOString().slice(0, 10)
}

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Approval PDF is a sequence of draw calls over data it fetches itself, so the
 * test pins WHAT is drawn on WHICH page (and the filters it fetched with), through a
 * recording jsPDF stand-in and a recording Supabase stand-in routed by table.
 */
type TextCall = { page: number; text: string; x: number; y: number; font: string; size: number }
type LinkCall = { page: number; text: string; url: string }

class FakeJsPDF {
  static last: FakeJsPDF | null = null
  calls: TextCall[] = []
  links: LinkCall[] = []
  pageOrientations: string[] = ['portrait']
  saved: string | null = null
  page = 1
  fontSize = 16
  fontStyle = 'normal'
  private w = 210
  private h = 297
  internal = { pageSize: { getWidth: () => this.w, getHeight: () => this.h } }
  constructor() {
    FakeJsPDF.last = this
  }
  setFontSize(n: number) { this.fontSize = n }
  setFont(_name: string, style?: string) { this.fontStyle = style ?? 'normal' }
  setTextColor() {}
  setDrawColor() {}
  setLineWidth() {}
  addPage(_format?: string, orientation: 'portrait' | 'landscape' = 'portrait') {
    this.pageOrientations.push(orientation)
    this.page = this.pageOrientations.length
    if (orientation === 'landscape') { this.w = 297; this.h = 210 } else { this.w = 210; this.h = 297 }
  }
  getTextWidth(s: string) { return s.length * this.fontSize * 0.19 }
  splitTextToSize(text: string, width: number): string[] {
    const perLine = Math.max(1, Math.floor(width / (this.fontSize * 0.19)))
    const out: string[] = []
    for (const para of String(text).split('\n')) {
      if (para.length <= perLine) { out.push(para); continue }
      let cur = ''
      for (const w of para.split(' ')) {
        const next = cur ? `${cur} ${w}` : w
        if (next.length > perLine && cur) { out.push(cur); cur = w } else cur = next
      }
      if (cur) out.push(cur)
    }
    return out
  }
  text(t: string, x: number, y: number) {
    this.calls.push({ page: this.page, text: t, x, y, font: this.fontStyle, size: this.fontSize })
  }
  textWithLink(t: string, _x: number, _y: number, opts: { url: string }) {
    this.links.push({ page: this.page, text: t, url: opts.url })
  }
  line() {}
  save(name: string) { this.saved = name }
}
vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

/** Recording Supabase: every builder call is logged; the thenable resolves through `route(table, steps)`. */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void) => {
                let data = route(table, steps)
                if (steps.some((s) => s.method === 'maybeSingle')) data = Array.isArray(data) ? (data[0] ?? null) : data
                resolve({ data, error: null })
              }
            }
            return (...args: unknown[]) => {
              steps.push({ method: String(prop), args })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

import { downloadApprovalPdf, type ApprovalPdfContext } from './approvalPdf'

const eqArg = (steps: Step[], col: string) => steps.find((s) => s.method === 'eq' && s.args[0] === col)?.args[1]

const bidBase = {
  id: 'bid1',
  project_name: 'Oak Ridge',
  bid_value: 125000,
  address: '9 Elm St, Kyle TX',
  gc_contact_name: 'Pat Foreman',
  gc_contact_phone: '512-555-0100',
  gc_contact_email: 'pat@acme.test',
  drive_link: ' https://drive.test/oak ',
  plans_link: null,
  count_tooling_plans_link: '   ',
  bid_submission_link: 'https://portal.acme.test/submissions/oak-ridge-phase-2/plumbing/2026/09/07/final-revision-3',
  selected_bid_version_id: 'v1',
  selected_price_book_version_id: 'pb1',
  distance_from_office: '10',
  service_type_id: 'st1',
  design_drawing_plan_date: '2026-08-15',
  customer_id: 'c1',
  customers: { id: 'c1', name: 'Acme Builders', address: '1 Acme Way, Austin TX', contact_info: { phone: '512-555-0000', email: 'office@acme.test' } },
  bids_gc_builders: null,
}

const ctxBase = (bid: Record<string, unknown>): ApprovalPdfContext => ({
  bid: bid as unknown as ApprovalPdfContext['bid'],
  priceBookVersions: [{ id: 'pb1', name: 'Standard 2026' }] as unknown as ApprovalPdfContext['priceBookVersions'],
  serviceTypes: [{ id: 'st1', name: 'Plumbing' }],
  coverLetter: {
    useCustomAmount: false,
    customAmount: '',
    inclusions: 'Water heater',
    exclusions: 'Concrete cutting',
    terms: 'Net 30',
    includeDesignDrawingPlanDate: true,
    includeFixturesPerPlan: true,
    includeSignature: true,
  },
})

/** Scenario A: split bid on version v1 with a GC override, priced, costed, schedule of values on. */
const fullData: Record<string, unknown> = {
  bid_versions: [{ id: 'v1', sort_order: 1, customer_id: 'c2', customers: { id: 'c2', name: 'Override GC', address: '2 Over St, Buda TX' } }],
  bids_count_rows: [
    { id: 'r1', fixture: 'Lavatory', count: 4, sequence_order: 1 },
    { id: 'r2', fixture: 'Water Closet', count: 2, sequence_order: 2 },
    { id: 'r3', fixture: 'Hidden Row', count: 1, sequence_order: 3 },
  ],
  price_book_entries: [{ id: 'e1', total_price: 500, fixture_types: { name: 'Lavatory' } }],
  bid_pricing_assignments: [{ count_row_id: 'r1', price_book_entry_id: 'e1', is_fixed_price: false, unit_price_override: null }],
  bid_count_row_custom_prices: [
    { count_row_id: 'r2', price_book_version_id: 'pb1', unit_price: 900 },
    { count_row_id: 'r3', price_book_version_id: 'pb1', unit_price: 0 },
  ],
  bid_count_row_submission_hides: [{ count_row_id: 'r3', price_book_version_id: 'pb1' }],
  cost_estimates: [{ id: 'ce1', labor_rate: 50, purchase_order_id_rough_in: 'po1', purchase_order_id_top_out: null, purchase_order_id_trim_set: null, driving_cost_rate: 1, hours_per_trip: 4, estimator_cost_flat_amount: 100 }],
  cost_estimate_labor_rows: [
    { fixture: 'Lavatory', count: 4, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 0.5, is_fixed: false }, // 4 × 2.5 = 10 h
    { fixture: 'Water Closet', count: 2, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1, is_fixed: true }, // fixed: 4 h
  ],
  purchase_order_items: [{ price_at_time: 100, quantity: 3 }, { price_at_time: 50.5, quantity: 2 }], // 401
  bids: [{ include_payment_schedule: true }],
  bid_payment_schedule_rows: [{ timing: 'Rough-in complete', percent: 50 }, { timing: 'Final', percent: 50 }],
}

beforeEach(() => {
  queries.length = 0
  FakeJsPDF.last = null
})

const textsOn = (page: number) => FakeJsPDF.last!.calls.filter((c) => c.page === page).map((c) => c.text)
const call = (text: string) => FakeJsPDF.last!.calls.find((c) => c.text === text)

describe('downloadApprovalPdf — a priced, costed, split bid', () => {
  beforeEach(async () => {
    route = (table) => (fullData[table] as unknown[]) ?? []
    await downloadApprovalPdf(ctxBase(bidBase))
  })

  it('draws four sections in order — Submission (portrait), Pricing (landscape), Labor (portrait), Cover Letter — and saves under the project name', () => {
    const pdf = FakeJsPDF.last!
    expect(pdf.pageOrientations.slice(0, 4)).toEqual(['portrait', 'landscape', 'portrait', 'portrait'])
    expect(call('Oak Ridge — Submission and Followup')).toMatchObject({ page: 1, font: 'bold', size: 16 })
    expect(call('Oak Ridge — Pricing')).toMatchObject({ page: 2, font: 'bold' })
    expect(call('Oak Ridge — Labor')).toMatchObject({ page: 3, font: 'bold' })
    expect(call('Oak Ridge — Cover Letter')).toMatchObject({ page: 4, font: 'bold' })
    expect(pdf.saved).toBe('Approval_Oak_Ridge.pdf')
  })

  it('fetches the count rows of the active version and the pricing of the selected price book', () => {
    const countQueries = queries.filter((q) => q.table === 'bids_count_rows')
    expect(countQueries.length).toBeGreaterThan(0)
    for (const q of countQueries) {
      expect(eqArg(q.steps, 'bid_id')).toBe('bid1')
      expect(eqArg(q.steps, 'bid_version_id')).toBe('v1')
    }
    const entryQueries = queries.filter((q) => q.table === 'price_book_entries')
    expect(entryQueries.every((q) => eqArg(q.steps, 'version_id') === 'pb1')).toBe(true)
    expect(queries.filter((q) => q.table === 'purchase_order_items').every((q) => eqArg(q.steps, 'purchase_order_id') === 'po1')).toBe(true)
  })

  it('page 1 lists the builder, project, contact, links (long URLs shortened, blanks as —) and the margins', () => {
    const p1 = textsOn(1)
    expect(p1).toEqual(expect.arrayContaining([
      'Bid Size: $125k',
      'Builder Name: Acme Builders',
      'Builder Address: 1 Acme Way, Austin TX',
      'Builder Phone Number: 512-555-0000',
      'Builder Email: office@acme.test',
      'Project Name: Oak Ridge',
      'Project Address: 9 Elm St, Kyle TX',
      'Project Contact Name: Pat Foreman',
      'Project Contact Phone: 512-555-0100',
      'Project Contact Email: pat@acme.test',
      'Project Folder: ',
      'Job Plans: ',
      'Margins',
      'Cost estimate: $1,236.00', // 401 materials + 14 h × $50 + 3.5 trips × $1 × 10 mi + $100 estimator
      'Price Book: Standard 2026 | Revenue: $3,800.00 | Margin: 67.5%',
    ]))
    expect(FakeJsPDF.last!.links).toEqual([
      { page: 1, text: 'https://drive.test/oak', url: 'https://drive.test/oak' },
      { page: 1, text: `${bidBase.bid_submission_link.slice(0, 67)}...`, url: bidBase.bid_submission_link }, // 70+ chars: first 67 + …
    ])
    // Plans and CountTooling links are blank → an em dash after the label, no link.
    expect(FakeJsPDF.last!.calls.filter((c) => c.page === 1 && c.text === '—')).toHaveLength(2)
  })

  it('page 2 prices each visible count row (assigned entry or custom price), skips hidden rows, and totals', () => {
    const p2 = textsOn(2)
    expect(p2).toEqual(expect.arrayContaining(['Price book: Standard 2026', 'Fixture', 'Count', 'Entry', 'Per Unit', 'Revenue']))
    expect(p2).toEqual(expect.arrayContaining(['Lavatory', '4', '$500', '$2,000']))
    expect(p2).toEqual(expect.arrayContaining(['Water Closet', '2', '—', '$900', '$1,800']))
    expect(p2).not.toContain('Hidden Row')
    expect(call('Total Revenue: $3,800.00')).toMatchObject({ page: 2, font: 'bold' })
  })

  it('page 3 shows materials by PO, the labor rows and rate, driving and estimator lines, and the summary', () => {
    const p3 = textsOn(3)
    expect(p3).toEqual(expect.arrayContaining([
      'Materials', 'PO (Rough In)', '$401.00', 'PO (Top Out)', 'PO (Trim Set)', '$0.00', 'Materials Total',
      'Labor — Rate: $50.00/hr',
      'Lavatory', '4', '1.00', '0.50', '10.00',
      'Water Closet', '2', '2.00', '4.00',
      'Labor total: $700.00',
      '(14.00 hrs × $50.00/hr)',
      'Driving cost: 3.5 trips × $1.00/mi × 10mi = $35.00',
      'Estimator cost: $100.00',
      'Summary', 'Labor', '$700.00', 'Driving', '$35.00', 'Estimator', '$100.00', 'Labor total', '$835.00', 'Grand total', '$1,236.00',
    ]))
    expect(p3.some((t) => t.startsWith('Travel cost'))).toBe(false)
    expect(p3).not.toContain('Travel')
  })

  it('page 4 addresses the letter to the active version’s GC override, states the priced amount, and bolds the section headings', () => {
    const p4 = textsOn(4)
    expect(p4[1]).toBe('Override GC')
    expect(p4.slice(2, 4)).toEqual(['2 Over St', 'Buda TX']) // address splits at its first comma
    expect(p4).not.toContain('Acme Builders')
    expect(p4.some((t) => t.includes('THREE THOUSAND EIGHT HUNDRED 00/100 DOLLARS ($3,800.00)'))).toBe(true)
    expect(p4).toContain('Design Drawings Plan Date: 8-15-26')
    expect(p4.some((t) => t.includes('• [4] Lavatory'))).toBe(true)
    expect(p4.some((t) => t.includes('Hidden Row'))).toBe(false)
    for (const heading of ['Inclusions:', 'Exclusions and Scope:', 'Schedule of Values:']) {
      expect(call(heading), heading).toMatchObject({ font: 'bold' })
    }
    expect(FakeJsPDF.last!.calls.some((c) => c.page >= 4 && c.text === 'Acceptance of estimate')).toBe(true)
  })
})

describe('downloadApprovalPdf — an unpriced, uncosted, unsplit bid with a GC from the builder table', () => {
  it('says so on each page, uses the typed custom amount, and falls back to "Bid" in the title and filename', async () => {
    route = (table) => (table === 'bids' ? [{ include_payment_schedule: false }] : [])
    const bid = {
      ...bidBase,
      project_name: null,
      bid_value: null,
      selected_bid_version_id: null,
      selected_price_book_version_id: null,
      drive_link: null,
      bid_submission_link: null,
      design_drawing_plan_date: null,
      customer_id: null,
      customers: null,
      bids_gc_builders: { name: 'Legacy Builder', address: '5 Old Rd', contact_number: '210-555-0199', email: 'legacy@x.test' },
    }
    const ctx = ctxBase(bid)
    ctx.priceBookVersions = []
    ctx.coverLetter = { ...ctx.coverLetter, useCustomAmount: true, customAmount: '12,500', includeSignature: false }
    await downloadApprovalPdf(ctx)

    const pdf = FakeJsPDF.last!
    expect(call('Bid — Submission and Followup')).toMatchObject({ page: 1 })
    expect(textsOn(1)).toEqual(expect.arrayContaining([
      'Bid Size: —',
      'Builder Name: Legacy Builder',
      'Builder Address: 5 Old Rd',
      'Builder Phone Number: 210-555-0199',
      'Builder Email: legacy@x.test',
      'Cost estimate: Not yet created',
    ]))
    expect(textsOn(1).some((t) => t.startsWith('Price Book:'))).toBe(false)
    expect(pdf.links).toEqual([])
    expect(textsOn(2)).toContain('No price book selected or no count rows.')
    expect(textsOn(3)).toContain('No labor costs created.')
    const p4 = textsOn(4)
    expect(p4[1]).toBe('Legacy Builder')
    expect(p4.some((t) => t.includes('TWELVE THOUSAND FIVE HUNDRED 00/100 DOLLARS ($12,500.00)'))).toBe(true)
    expect(p4.some((t) => t.includes('• Water heater'))).toBe(true) // typed inclusion survives without fixture rows
    expect(p4.some((t) => t.includes('Fixtures provided and installed'))).toBe(false)
    expect(pdf.calls.some((c) => c.text === 'Acceptance of estimate')).toBe(false)
    expect(pdf.calls.some((c) => c.text === 'Schedule of Values:')).toBe(false)
    expect(pdf.saved).toBe('Approval_Bid.pdf')

    // Unsplit: count rows are the bid's null-version rows.
    const countQueries = queries.filter((q) => q.table === 'bids_count_rows')
    expect(countQueries.length).toBeGreaterThan(0)
    for (const q of countQueries) {
      expect(q.steps.some((s) => s.method === 'is' && s.args[0] === 'bid_version_id' && s.args[1] === null)).toBe(true)
    }
  })
})

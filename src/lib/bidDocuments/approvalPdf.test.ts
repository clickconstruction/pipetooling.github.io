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
/** `sent`: the query was awaited — a builder made and never awaited sends nothing. */
const queries: Array<{ table: string; steps: Step[]; sent: boolean }> = []
let route: (table: string, steps: Step[]) => unknown = () => []
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      const query = { table, steps, sent: false }
      queries.push(query)
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: null }) => void) => {
                query.sent = true
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

/** The rows a query's eq / is / in filters keep; a column a row does not carry never filters it. */
const filtered = (rows: Array<Record<string, unknown>>, steps: Step[]) =>
  rows.filter((r) =>
    steps.every((s) => {
      const [col, val] = s.args as [string, unknown]
      if (!['eq', 'is', 'in'].includes(s.method) || !(col in r)) return true
      if (s.method === 'eq') return r[col] === val
      if (s.method === 'is') return r[col] == null && val == null
      return (val as unknown[]).includes(r[col])
    }),
  )

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
    altsLayout: 'same-page',
  },
})

/**
 * Scenario A: split bid on version v1 with a GC override, priced, costed, schedule of values on.
 * Its estimate links a By Stage purchase order and it has no part lines: By Stage is retired
 * (v2.4389), so the PO is never read and the materials are $0.
 */
const fullData: Record<string, unknown> = {
  bid_versions: [{ id: 'v1', name: 'Base', sort_order: 1, include_in_submission: false, is_alternate: false, starred_price_book_version_id: 'pb1', customer_id: 'c2', customers: { id: 'c2', name: 'Override GC', address: '2 Over St, Buda TX' } }],
  price_book_versions: [{ id: 'pb1', name: 'Standard 2026', bid_version_id: 'v1', sort_order: 0, created_at: '2026-09-01T00:00:00Z', include_in_submission: false }],
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
  bids: [{ include_payment_schedule: true, bid_to_marked_plans: true }],
  bid_plan_basis_exports: [{ id: 'bb1', exported_at: '2026-09-09T19:32:00Z', filename: 'bid-basis_b409_x.pdf', save_method: 'reported', sheet_labels: ['Acme Tower — p3', 'P-201'], sheet_count: 2, ct_updated_at: null, ct_project_name: 'Acme Tower', superseded_at: null }],
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
    const countQueries = queries.filter((q) => q.table === 'bids_count_rows' && q.sent)
    expect(countQueries.length).toBeGreaterThan(0)
    for (const q of countQueries) {
      expect(eqArg(q.steps, 'bid_id')).toBe('bid1')
      expect(eqArg(q.steps, 'bid_version_id')).toBe('v1')
    }
    const entryQueries = queries.filter((q) => q.table === 'price_book_entries')
    expect(entryQueries.every((q) => eqArg(q.steps, 'version_id') === 'pb1')).toBe(true)
    expect(queries.some((q) => q.table === 'purchase_order_items')).toBe(false)
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
      'Cost estimate: $735.00', // no part lines, so $0 materials + 14 h × $50 + 3.5 trips × $1 × 10 mi; the $100 estimator time is not cost (v2.3293)
      'Price Book: Standard 2026 | Revenue: $3,800.00 | Margin: 80.7%' // (3,800 − 735) ÷ 3,800 — estimator time left the cost (v2.3293),
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

  it('page 3 shows one Materials line and no stage PO, the labor rows and rate, driving and estimator lines, and the summary', () => {
    const p3 = textsOn(3)
    expect(p3).toEqual(expect.arrayContaining([
      'Materials', '$0.00', 'Materials Total',
      'Labor — Rate: $50.00/hr',
      'Lavatory', '4', '1.00', '0.50', '10.00',
      'Water Closet', '2', '2.00', '4.00',
      'Labor total: $700.00',
      '(14.00 hrs × $50.00/hr)',
      'Driving cost: 3.5 trips × $1.00/mi × 10mi = $35.00',
      'Summary', 'Labor', '$700.00', 'Driving', '$35.00', 'Labor total', '$735.00', 'Grand total', '$735.00',
    ]))
    expect(p3.filter((t) => t.startsWith('PO ('))).toEqual([])
    // Estimator time is a fact, not cost (v2.3293): the $100 flat amount is not printed and not in the totals.
    expect(p3.some((t) => t.startsWith('Estimator'))).toBe(false)
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
    for (const heading of ['Inclusions:', 'Exclusions and Scope:', 'Payment schedule:']) {
      expect(call(heading), heading).toMatchObject({ font: 'bold' })
    }
    expect(FakeJsPDF.last!.calls.some((c) => c.page >= 4 && c.text === 'Acceptance of estimate')).toBe(true)
  })
})

describe('downloadApprovalPdf — a Combined bid (materials from the takeoff’s part lines, v2.4368)', () => {
  /**
   * Scenario A with part lines. The estimate still links the By Stage PO, which must not count. 4 lavs × 5 ft + 2 WCs × 2.5 ft of copper = 25 ft → 40 ft of 20 ft
   * sticks, $30 extra; plus a $150 valve per WC: $350 + $30 = $380 of materials.
   */
  const combinedData: Record<string, unknown> = {
    ...fullData,
    bids: [{ materials_model: 'rough', include_payment_schedule: true, bid_to_marked_plans: true }],
    bids_takeoff_rough_part_lines: [
      { count_row_id: 'r1', part_id: 'copper', quantity: 5, unit_price: 2, order_increment: 20, order_increment_unit: 'ft_stick' },
      { count_row_id: 'r2', part_id: 'copper', quantity: 2.5, unit_price: 2, order_increment: 20, order_increment_unit: 'ft_stick' },
      { count_row_id: 'r2', part_id: 'valve', quantity: 1, unit_price: 150, order_increment: null, order_increment_unit: null },
    ],
  }
  beforeEach(async () => {
    route = (table) => (combinedData[table] as unknown[]) ?? []
    await downloadApprovalPdf(ctxBase({ ...bidBase, materials_model: 'rough' }))
  })

  it('costs page 1 with the takeoff’s materials, so the margin matches Pricing', () => {
    expect(textsOn(1)).toEqual(expect.arrayContaining([
      'Cost estimate: $1,115.00', // $380 materials + 14 h × $50 + $35 driving
      'Price Book: Standard 2026 | Revenue: $3,800.00 | Margin: 70.7%', // (3,800 − 1,115) ÷ 3,800
    ]))
  })

  it('reads the active version’s part lines once and never the stage PO the estimate still links', () => {
    const lineQueries = queries.filter((q) => q.table === 'bids_takeoff_rough_part_lines')
    expect(lineQueries).toHaveLength(1)
    expect(eqArg(lineQueries[0]!.steps, 'bid_id')).toBe('bid1')
    expect(eqArg(lineQueries[0]!.steps, 'bid_version_id')).toBe('v1')
    expect(queries.some((q) => q.table === 'purchase_order_items')).toBe(false)
  })

  it('prints one Materials line on the Labor page instead of three PO lines', () => {
    const p3 = textsOn(3)
    expect(p3).toEqual(expect.arrayContaining(['Materials', '$380.00', 'Materials Total', 'Labor total', '$735.00', 'Grand total', '$1,115.00']))
    expect(p3.filter((t) => t.startsWith('PO ('))).toEqual([])
    expect(p3.filter((t) => t === 'Materials')).toHaveLength(2) // the heading and the table's one line
  })

  it('leaves the revenue and the letter as they were', () => {
    expect(call('Total Revenue: $3,800.00')).toMatchObject({ page: 2, font: 'bold' })
    expect(textsOn(4).some((t) => t.includes('THREE THOUSAND EIGHT HUNDRED 00/100 DOLLARS ($3,800.00)'))).toBe(true)
  })
})

describe('downloadApprovalPdf — a split bid whose saved price belongs to its other version (BP385, v2.4373)', () => {
  /**
   * Two versions, each with its own count rows and price: Written to Plan (active, the base) and
   * Value Engineered (an alternate), both in the letter. The bid's saved price is Value Engineered's,
   * and so is Written to Plan's ★ (not its own), so the Pricing tab shows Written to Plan's first
   * price. The PDF used the bid's saved price on Written to Plan's rows: "Price book: —", $0.00.
   * Base: 10 lavs × $1,000 + 8 WCs × $1,500 = $22,000. Value Engineered: 10 × $900 + 8 × $1,250 = $19,000.
   */
  const splitData: Record<string, unknown> = {
    ...fullData,
    bid_versions: [
      { id: 'v-ve', name: 'Value Engineered', sort_order: 0, include_in_submission: true, is_alternate: true, starred_price_book_version_id: 'pb-ve', customer_id: null, customers: null },
      { id: 'v-base', name: 'Written to Plan', sort_order: 1, include_in_submission: true, is_alternate: false, starred_price_book_version_id: 'pb-ve', customer_id: null, customers: null },
    ],
    price_book_versions: [
      { id: 'pb-ve', name: 'Value Engineered', bid_version_id: 'v-ve', sort_order: 0, created_at: '2026-09-02T00:00:00Z', include_in_submission: true },
      { id: 'pb-base', name: 'Written to Plan', bid_version_id: 'v-base', sort_order: 0, created_at: '2026-09-01T00:00:00Z', include_in_submission: true },
    ],
    bids_count_rows: [
      { id: 'b1', bid_version_id: 'v-base', fixture: 'Lavatory', count: 10, sequence_order: 1, group_tag: null },
      { id: 'b2', bid_version_id: 'v-base', fixture: 'Water Closet', count: 8, sequence_order: 2, group_tag: null },
      { id: 'e1', bid_version_id: 'v-ve', fixture: 'Lavatory', count: 10, sequence_order: 1, group_tag: null },
      { id: 'e2', bid_version_id: 'v-ve', fixture: 'Water Closet', count: 8, sequence_order: 2, group_tag: null },
    ],
    price_book_entries: [],
    bid_pricing_assignments: [],
    bid_count_row_custom_prices: [
      { count_row_id: 'b1', price_book_version_id: 'pb-base', unit_price: 1000 },
      { count_row_id: 'b2', price_book_version_id: 'pb-base', unit_price: 1500 },
      { count_row_id: 'e1', price_book_version_id: 'pb-ve', unit_price: 900 },
      { count_row_id: 'e2', price_book_version_id: 'pb-ve', unit_price: 1250 },
    ],
    bid_count_row_submission_hides: [],
  }
  const splitBid = { ...bidBase, selected_bid_version_id: 'v-base', selected_price_book_version_id: 'pb-ve' }
  const download = async (altsLayout: 'same-page' | 'separate' = 'same-page') => {
    route = (table, steps) => filtered((splitData[table] as Array<Record<string, unknown>>) ?? [], steps)
    const ctx = ctxBase(splitBid)
    ctx.coverLetter = { ...ctx.coverLetter, altsLayout }
    await downloadApprovalPdf(ctx)
  }

  it('prices page 2 with the active version’s own price, on its own rows', async () => {
    await download()
    const p2 = textsOn(2)
    expect(p2).toContain('Price book: Written to Plan')
    expect(p2).toEqual(expect.arrayContaining(['Lavatory', '10', '$1,000', '$10,000', 'Water Closet', '8', '$1,500', '$12,000']))
    expect(call('Total Revenue: $22,000.00')).toMatchObject({ page: 2, font: 'bold' })
  })

  it('lists the margins of the active version’s prices only', async () => {
    await download()
    const p1 = textsOn(1)
    expect(p1).toContain('Price Book: Written to Plan | Revenue: $22,000.00 | Margin: 96.7%') // (22,000 − 735) ÷ 22,000
    expect(p1.some((t) => t.startsWith('Price Book: Value Engineered'))).toBe(false)
  })

  it('says what the letter says: the base bid’s amount, with the alternate on its own rows under it', async () => {
    await download()
    const p4 = textsOn(4)
    expect(p4[1]).toBe('Acme Builders')
    expect(p4.some((t) => t.includes('TWENTY TWO THOUSAND 00/100 DOLLARS ($22,000.00)'))).toBe(true)
    expect(call('Alternates:')).toMatchObject({ page: 4, font: 'bold' })
    expect(p4).toContain('     • Alternate 1 — Value Engineered: Deduct $3,000 ($19,000.00)')
    expect(p4.some((t) => t.includes('• [10] Lavatory'))).toBe(true)
    expect(p4.some((t) => t.includes('NINETEEN THOUSAND'))).toBe(false)
  })

  it('prints a letter per section, each on its own page, when this device keeps alternates on separate pages', async () => {
    await download('separate')
    const base = call('Bid: Written to Plan')
    const alternate = call('Alternate: Value Engineered — in lieu of Written to Plan')
    expect(base).toMatchObject({ page: 4, font: 'bold' })
    expect(alternate).toMatchObject({ font: 'bold' })
    expect(alternate!.page).toBeGreaterThan(base!.page)
    expect(alternate!.y).toBe(20) // the top of a fresh page
    const texts = FakeJsPDF.last!.calls.map((c) => c.text)
    expect(texts.some((t) => t.includes('TWENTY TWO THOUSAND 00/100 DOLLARS ($22,000.00)'))).toBe(true)
    expect(texts.some((t) => t.includes('NINETEEN THOUSAND 00/100 DOLLARS ($19,000.00)'))).toBe(true)
    expect(texts).not.toContain('Alternates:')
  })
})

describe('downloadApprovalPdf — an unsplit bid priced on a shared template (no price of its own)', () => {
  it('prices with the saved template and names it on pages 1 and 2', async () => {
    const data: Record<string, unknown> = {
      bids: [{ include_payment_schedule: false }],
      price_book_versions: [{ id: 'tpl1', name: 'Default 2026', bid_id: null, bid_version_id: null, sort_order: 0 }],
      bids_count_rows: [{ id: 'r1', bid_version_id: null, fixture: 'Lavatory', count: 4, sequence_order: 1, group_tag: null }],
      price_book_entries: [{ id: 'te1', version_id: 'tpl1', total_price: 300, fixture_types: { name: 'Lavatory' } }],
    }
    route = (table, steps) => filtered((data[table] as Array<Record<string, unknown>>) ?? [], steps)
    await downloadApprovalPdf(ctxBase({ ...bidBase, selected_bid_version_id: null, selected_price_book_version_id: 'tpl1' }))
    expect(textsOn(1)).toContain('Price Book: Default 2026 | Revenue: $1,200.00 | Margin: Incomplete') // no cost estimate
    expect(textsOn(2)).toContain('Price book: Default 2026')
    expect(call('Total Revenue: $1,200.00')).toMatchObject({ page: 2 })
    expect(textsOn(4).some((t) => t.includes('ONE THOUSAND TWO HUNDRED 00/100 DOLLARS ($1,200.00)'))).toBe(true)
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
    ctx.coverLetter ={ ...ctx.coverLetter, useCustomAmount: true, customAmount: '12,500', includeSignature: false }
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
    expect(pdf.calls.some((c) => c.text === 'Payment schedule:')).toBe(false)
    expect(pdf.saved).toBe('Approval_Bid.pdf')

    // Unsplit: count rows are the bid's null-version rows.
    const countQueries = queries.filter((q) => q.table === 'bids_count_rows' && q.sent)
    expect(countQueries.length).toBeGreaterThan(0)
    for (const q of countQueries) {
      expect(q.steps.some((s) => s.method === 'is' && s.args[0] === 'bid_version_id' && s.args[1] === null)).toBe(true)
    }
  })
})

describe('downloadApprovalPdf — bid basis (v2.3226)', () => {
  it('carries the Bid basis clause on the Cover Letter page when the flag is on and an export exists', async () => {
    route = (table) => (fullData[table] as unknown[]) ?? []
    await downloadApprovalPdf(ctxBase(bidBase))
    // jsPDF wraps long lines — check the joined text of the page.
    const all = FakeJsPDF.last!.calls.map((c) => (typeof c.text === 'string' ? c.text : '')).join(' ')
    expect(all).toContain('Bid basis: This proposal is based on our marked-up copy')
    expect(all).toContain('(2 sheets: p3, P-201)')
    expect(FakeJsPDF.last!.calls.some((c) => typeof c.text === 'string' && c.text.includes('per our marked-up plans'))).toBe(true)
  })
  it('says nothing about a bid basis when the flag is off', async () => {
    route = (table) => (table === 'bids' ? [{ include_payment_schedule: false, bid_to_marked_plans: false }] : (fullData[table] as unknown[]) ?? [])
    await downloadApprovalPdf(ctxBase(bidBase))
    expect(FakeJsPDF.last!.calls.some((c) => typeof c.text === 'string' && c.text.startsWith('Bid basis:'))).toBe(false)
  })
})

describe('downloadApprovalPdf — the org’s cover-letter wording (v2.4375)', () => {
  const orgWording = [
    { key: 'bid_cover_letter_exclusions_default_v1', value_text: 'Concrete cutting is excluded.\nThis proposal excludes water service and sewer line to street.' },
    { key: 'bid_cover_letter_closing_v1', value_text: 'Work starts once the permit is issued.' },
  ]
  const download = async (typed: { exclusions?: string; terms?: string }) => {
    route = (table, steps) => filtered(((table === 'app_settings' ? orgWording : fullData[table]) as Array<Record<string, unknown>>) ?? [], steps)
    const ctx = ctxBase(bidBase)
    ctx.coverLetter = { ...ctx.coverLetter, exclusions: typed.exclusions, terms: typed.terms }
    await downloadApprovalPdf(ctx)
  }
  /** The letter from its first line on, its wrapped lines joined back together. */
  const letter = () => {
    const calls = FakeJsPDF.last!.calls
    const start = calls.findIndex((c) => c.text.endsWith('— Cover Letter'))
    return calls.slice(start + 1).map((c) => c.text).join(' ').replace(/\s+/g, ' ')
  }

  it('prints the org’s exclusions and closing, and the built-in terms as one paragraph, when nobody typed for the bid', async () => {
    await download({})
    const text = letter()
    expect(text).toContain('• This proposal excludes water service and sewer line to street.')
    expect(text).not.toContain('This proposal excludes all impact fees.') // the built-in exclusions
    expect(text).toContain('Work starts once the permit is issued.')
    expect(text).not.toContain('No work shall commence until') // the built-in closing
    expect(text).toContain('All work to be completed in a workmanlike manner')
    expect(text).not.toContain('• All work to be completed')
    const read = queries.find((q) => q.table === 'app_settings')
    expect(read?.steps.find((s) => s.method === 'in')?.args[1]).toEqual(['bid_cover_letter_terms_default_v1', 'bid_cover_letter_exclusions_default_v1', 'bid_cover_letter_closing_v1'])
  })

  it('prints what was typed for the bid over the org’s wording', async () => {
    await download({ exclusions: 'Typed exclusion.', terms: 'Net 30' })
    const text = letter()
    expect(text).toContain('• Typed exclusion.')
    expect(text).not.toContain('water service and sewer line')
    expect(text).toContain('• Net 30')
    expect(text).toContain('Work starts once the permit is issued.') // the closing has no per-bid box
  })
})

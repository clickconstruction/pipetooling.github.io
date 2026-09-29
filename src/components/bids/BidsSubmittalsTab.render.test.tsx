// @vitest-environment jsdom
/**
 * Render smokes for BidsSubmittalsTab (Submittals stage 2b): the empty state
 * builds Rev 1 from the schedule and the picks; a revision draws the tiles,
 * the rows with their status chips, "say why" and "sheet needed"; New revision
 * carries the rows into Rev 2 and supersedes an unshared draft; Edit writes
 * the item row.
 */
import { SUBMITTAL_STAGE_ABOUT } from '../../lib/submittals/submittalTour'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidsSubmittalsTab } from './BidsSubmittalsTab'

type Rec = { table: string; op: string; payload: unknown; filters: Array<[string, unknown]> }
const state: { revisions: Record<string, unknown>[]; items: Record<string, unknown>[]; tasks: Record<string, unknown>[]; writes: Rec[]; storage: string[]; packageCalls: Array<{ files: number; sheets: string[] }>; noSources: boolean; takeoff: boolean; seat: { unrevoked_seats: number; last_used_at: string | null } | null } = { revisions: [], items: [], tasks: [], writes: [], storage: [], packageCalls: [], noSources: false, takeoff: false, seat: { unrevoked_seats: 1, last_used_at: new Date().toISOString() } }

vi.mock('../../lib/jobs/testReportSettings', () => {
  const settings = { companyName: 'Click Plumbing', companyTagline: 'Plumbing', officePhone: '(512) 555-0100', mailingAddress: '' }
  return { fetchTestReportSettings: () => Promise.resolve(settings), cachedTestReportSettings: () => settings }
})

// The package kernels run jsPDF and pdf-lib; the smoke checks the orchestration, not the ink.
vi.mock('../../lib/submittals/submittalPackage', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/submittals/submittalPackage')>()
  return {
    ...real,
    renderCoverPdf: () => Promise.resolve({ blob: new Blob(['cover'], { type: 'application/pdf' }), pages: 1 }),
    buildSubmittalPackage: (_cover: Blob, files: unknown[], sheets: Array<{ tag: string }>) => {
      state.packageCalls.push({ files: files.length, sheets: sheets.map((s) => s.tag) })
      return Promise.resolve({ blob: new Blob(['pkg'], { type: 'application/pdf' }), coverPages: 1, sheetPages: 2, totalPages: 3, manifest: sheets.map((s) => ({ tag: s.tag, status: 'as_specified', pages: [2] })), skipped: [] })
    },
  }
})

vi.mock('../../lib/submittals/pdfThumbnails', () => ({
  renderPdfThumbnails: (bytes: ArrayBuffer) => Promise.resolve(Array.from({ length: Math.max(1, bytes.byteLength / 2) }, (_, i) => `data:page${i + 1}`)),
}))

vi.mock('../../lib/submittals/trimPdf', () => ({
  pageCount: () => Promise.resolve(3),
  trimPdf: (_bytes: ArrayBuffer, keep: number[]) => {
    const sorted = [...new Set(keep)].sort((a, b) => a - b)
    return Promise.resolve({ bytes: new Uint8Array([1]), map: Object.fromEntries(sorted.map((p, i) => [p, i + 1])), kept: sorted.length, dropped: 4 - sorted.length })
  },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

const SPEC = [
  { tag: 'WC-1', fixture: 'Water closet', manufacturer: 'TOTO', model: 'CT708UVG', description: 'Wall-hung, 1.28 gpf' },
  { tag: 'DWH-1', fixture: 'Water heater', manufacturer: 'Rheem', model: 'RH375', description: '40 gal' },
  { tag: 'PRV-1', fixture: 'PRV', manufacturer: 'Watts', model: 'LF223', description: '¾"' },
]
const QUOTES = [
  {
    id: 'q-nws',
    supply_house_id: 'h-nws',
    received_at: '2026-09-10T20:00:00Z',
    supply_house: { name: 'NWS' },
    bid_quote_lines: [
      { id: 'l-wc', fixture: 'Water closet', label: 'TOTO CT708UVG#01 WALL HUNG', picked: true, cant_supply: false, component_role: null, alternate_reason_kind: null, alternate_reason_note: null, lead_time_days: 0, product_status_override: null },
      { id: 'l-dwh', fixture: 'Water heater', label: 'BRADFORD WHITE RE2HP50 50 GAL', picked: true, cant_supply: false, component_role: null, alternate_reason_kind: 'lead_time', alternate_reason_note: 'spec 3–4 wk out', lead_time_days: 7, product_status_override: null },
      { id: 'l-car', fixture: 'Carrier', label: 'JOSAM 12704 CARRIER', picked: true, cant_supply: false, component_role: null, alternate_reason_kind: null, alternate_reason_note: null, lead_time_days: null, product_status_override: null },
      { id: 'l-no', fixture: 'Hose bibb', label: 'WOODFORD B74', picked: false, cant_supply: false, component_role: null, alternate_reason_kind: null, alternate_reason_note: null, lead_time_days: null, product_status_override: null },
    ],
  },
]

// v2.4107 · a takeoff: two fixtures with a priced part (one from Reece), one with no part yet, one pipe line.
const COUNT_ROWS = [
  { id: 'c-wc', fixture: 'WC 1&2', count: 10, bid_version_id: null, sequence_order: 1 },
  { id: 'c-wh', fixture: 'DWH1 & ET', count: 1, bid_version_id: null, sequence_order: 2 },
  { id: 'c-us', fixture: 'UTILITY SINK', count: 2, bid_version_id: null, sequence_order: 3 },
  { id: 'c-pipe', fixture: 'ft of 3/4IN WATER', count: 140, bid_version_id: null, sequence_order: 4 },
]
const PART_LINES = [
  { count_row_id: 'c-wc', part_id: 'p-wc', source_template_id: null, quantity: 1, unit_price: 300, source_material_part_price_id: 'pr-1', bid_version_id: null },
  { count_row_id: 'c-wh', part_id: 'p-wh', source_template_id: null, quantity: 1, unit_price: 2400, source_material_part_price_id: null, bid_version_id: null },
  { count_row_id: 'c-pipe', part_id: 'p-pipe', source_template_id: null, quantity: 140, unit_price: 6.5, source_material_part_price_id: null, bid_version_id: null },
]
const PARTS = [
  { id: 'p-wc', name: 'TOTO CT708UVG#01 WALL HUNG BOWL', manufacturer: null, part_types: { name: 'Fixtures' } },
  { id: 'p-wh', name: 'BTH-199 WATER HEATER', manufacturer: 'A.O. Smith', part_types: { name: 'Equipment' } },
  { id: 'p-pipe', name: '3/4IN TYPE L COPPER', manufacturer: null, part_types: { name: 'Pipe' } },
]
const PRICES = [{ id: 'pr-1', supply_house_id: 'h-reece', supply_houses: { name: 'Reece' } }]

function builder(table: string) {
  const rec: Rec = { table, op: 'select', payload: null, filters: [] }
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.order = chain
  b.or = chain
  b.in = chain
  b.is = chain
  b.limit = chain
  b.eq = (col: string, val: unknown) => {
    rec.filters.push([col, val])
    return b
  }
  b.insert = (payload: unknown) => {
    rec.op = 'insert'
    rec.payload = payload
    return b
  }
  b.update = (payload: unknown) => {
    rec.op = 'update'
    rec.payload = payload
    return b
  }
  b.delete = () => {
    rec.op = 'delete'
    return b
  }
  b.upsert = (payload: unknown) => {
    rec.op = 'upsert'
    rec.payload = payload
    return b
  }
  const run = () => {
    if (rec.op !== 'select') {
      state.writes.push(rec)
      if (rec.op === 'insert' && table === 'bid_submittals') {
        const row = { id: `rev-${state.revisions.length + 1}`, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null, note: null, ...(rec.payload as Record<string, unknown>) }
        state.revisions = [row, ...state.revisions]
        return { data: row, error: null }
      }
      if (rec.op === 'insert' && table === 'bid_submittal_items') {
        // One row (v2.4090's row by hand) or many (Rev 1 from the picks).
        const rows = (Array.isArray(rec.payload) ? (rec.payload as Record<string, unknown>[]) : [rec.payload as Record<string, unknown>]).map((r, i) => ({ id: `it-${state.items.length + i + 1}`, ...r }))
        state.items = [...state.items, ...rows]
        return { data: rows, error: null }
      }
      if (rec.op === 'update' && table === 'bid_submittals') {
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.revisions = state.revisions.map((r) => (r.id === id ? { ...r, ...(rec.payload as Record<string, unknown>) } : r))
      }
      if (rec.op === 'update' && table === 'bid_submittal_items') {
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.items = state.items.map((r) => (r.id === id ? { ...r, ...(rec.payload as Record<string, unknown>) } : r))
      }
      if (rec.op === 'delete' && table === 'bid_submittal_items') {
        const sid = rec.filters.find((f) => f[0] === 'submittal_id')?.[1]
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.items = state.items.filter((r) => (sid ? r.submittal_id !== sid : r.id !== id))
      }
      return { data: null, error: null }
    }
    if (table === 'bid_specified_products') return { data: state.noSources ? [] : SPEC, error: null }
    if (table === 'bid_submittal_tasks') return { data: state.tasks, error: null }
    if (table === 'bid_quotes') return { data: state.noSources ? [] : QUOTES, error: null }
    if (table === 'bids_count_rows') return { data: state.takeoff ? COUNT_ROWS : [], error: null }
    if (table === 'bids_takeoff_rough_part_lines') return { data: state.takeoff ? PART_LINES : [], error: null }
    if (table === 'material_parts') return { data: PARTS, error: null }
    if (table === 'material_part_prices') return { data: PRICES, error: null }
    if (table === 'bid_submittals') return { data: [...state.revisions].sort((a, b) => (b.rev_number as number) - (a.rev_number as number)), error: null }
    if (table === 'bid_submittal_items') {
      const sid = rec.filters.find((f) => f[0] === 'submittal_id')?.[1]
      return { data: state.items.filter((r) => r.submittal_id === sid), error: null }
    }
    return { data: [], error: null }
  }
  b.single = () => Promise.resolve((() => { const r = run(); return Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r })())
  b.maybeSingle = () => Promise.resolve(run())
  b.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(run()).then(resolve, reject)
  return b
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve({ data: state.seat, error: null }),
    storage: {
      from: () => ({
        upload: (path: string) => {
          state.storage.push(`upload ${path}`)
          return Promise.resolve({ data: null, error: null })
        },
        download: (path: string) => {
          state.storage.push(`download ${path}`)
          return Promise.resolve({ data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }, error: null })
        },
        remove: (paths: string[]) => {
          state.storage.push(`remove ${paths.join(',')}`)
          return Promise.resolve({ data: null, error: null })
        },
        createSignedUrl: (path: string) => {
          state.storage.push(`sign ${path}`)
          return Promise.resolve({ data: { signedUrl: `https://signed.test/${path}` }, error: null })
        },
      }),
    },
  },
}))

const bid = { id: 'b398', bid_number: '398', project_name: 'ZZ Test', address: '1 Test Ln', customers: null, bids_gc_builders: null, service_type_id: null } as unknown as BidWithBuilder

function mount() {
  return renderWithProviders(
    <BidsSubmittalsTab bids={[bid]} selectedBid={bid} narrowViewport640={false} bidPreview={null} onSelectBid={() => {}} onClose={() => {}} onOpenPricing={() => {}} onlyMyBids={false} setOnlyMyBids={() => {}} isMyBid={() => true} />,
  )
}

const item = (o: Record<string, unknown>) => ({
  submittal_id: 'rev-1', tag: '', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  supply_house_id: 'h-nws', source_quote_line_id: null, status: 'alternate', reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_at: null, created_at: '2026-09-15T00:00:00Z', updated_at: '2026-09-15T00:00:00Z', ...o,
})

describe('BidsSubmittalsTab', () => {
  it('with no revision, names the schedule and the picks and builds Rev 1 from them', async () => {
    state.revisions = []
    state.items = []
    state.writes = []
    mount()
    expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
    expect(screen.getByText(/3 tags on the schedule · 3 picked lines/)).toBeTruthy()
    // v2.4067: the journey strip offers the same door above the card; either one builds.
    expect(screen.getByTestId('journey-next').textContent).toBe('Next: 3 tags on the schedule and 3 lines picked. Ready to build Rev 1, the first version.Build Rev 1 from the picks')
    fireEvent.click(screen.getAllByRole('button', { name: 'Build Rev 1 from the picks' })[1] as HTMLElement)
    await waitFor(() => expect(state.writes.filter((w) => w.op === 'insert')).toHaveLength(2))
    const rev = state.writes.find((w) => w.table === 'bid_submittals')!
    expect(rev.payload).toMatchObject({ bid_id: 'b398', rev_number: 1, status: 'draft', created_by: 'wendi' })
    const rows = state.writes.find((w) => w.table === 'bid_submittal_items')!.payload as Record<string, unknown>[]
    // DWH-1 · PRV-1 · WC-1 in tag order, then the carrier as an accessory.
    expect(rows.map((r) => [r.tag, r.status])).toEqual([
      ['DWH-1', 'alternate'],
      ['PRV-1', 'missing'],
      ['WC-1', 'as_specified'],
      ['', 'accessory'],
    ])
    expect(rows[0]).toMatchObject({ reason_kind: 'lead_time', reason_note: 'spec 3–4 wk out', lead_time_days: 7, source_quote_line_id: 'l-dwh', submittal_id: 'rev-1' })
    expect(rows[2]).toMatchObject({ submitted_model: 'CT708UVG', lead_time_days: 0 })
    // The tab then shows the built revision.
    expect(await screen.findByTestId('revision-line')).toBeTruthy()
    expect(screen.getAllByTestId('submittal-row')).toHaveLength(4)
  })

  it('v2.4090 · by hand: the schedule door on a bid with none, and a row added by hand on a draft opens the editor with its tag and product', async () => {
    state.revisions = []
    state.items = []
    state.writes = []
    mount()
    expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
    // Stage 1 is done here (3 tags, 3 picks) so it is folded; its title opens it, and the door reads "Add to the schedule".
    expect(screen.queryByTestId('plug-in-schedule')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /1 · Where the rows come from/ }))
    expect(screen.getByTestId('plug-in-schedule').textContent).toBe('Add to the schedule')

    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', status: 'as_specified' })]
    state.writes = []
    mount()
    await screen.findAllByTestId('submittal-row')
    // The editor opens first; nothing is written until Save (v2.4105), so Cancel leaves no stray row.
    fireEvent.click(screen.getByTestId('add-row-by-hand'))
    const dialog = await screen.findByRole('dialog')
    expect(state.writes.some((w) => w.table === 'bid_submittal_items')).toBe(false)
    fireEvent.change(within(dialog).getByLabelText('Tag'), { target: { value: 'gi-1' } })
    fireEvent.change(within(dialog).getByLabelText('Submitted product'), { target: { value: 'Schier GB-250 grease interceptor' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '4+ wk' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'insert' && w.table === 'bid_submittal_items')).toBe(true))
    expect(state.writes.find((w) => w.op === 'insert' && w.table === 'bid_submittal_items')!.payload).toMatchObject({ submittal_id: 'rev-1', sequence_order: 2, status: 'missing', tag: 'GI-1', submitted_label: 'Schier GB-250 grease interceptor', lead_time_days: 28 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('v2.4067 · the journey strip says where the submittal is, the first open offers the walkthrough, and the tour keeps a stop for every stage — centered when its controls are not on the page', async () => {
    state.revisions = []
    state.items = []
    state.writes = []
    window.localStorage.removeItem('pt.submittals.walkthrough.seen')
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    mount()
    expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
    const pills = screen.getAllByTestId('journey-stage')
    expect(pills.map((p) => p.getAttribute('data-status'))).toEqual(['done', 'current', 'later', 'later', 'later', 'later', 'later', 'later'])
    expect(screen.getByTestId('journey-offer')).toBeTruthy()

    // A pill click rings the stage's controls (the empty card is stage 2's anchor on a fresh bid).
    fireEvent.click(screen.getByRole('button', { name: '2 Build Rev 1 · you are here' }))
    expect(document.querySelector('[data-tour="submittals-build"]')?.classList.contains('submittal-journey-flash')).toBe(true)

    fireEvent.click(screen.getAllByRole('button', { name: 'Walk me through it ▶' })[0] as HTMLElement)
    expect(screen.queryByTestId('journey-offer')).toBeNull()
    expect(window.localStorage.getItem('pt.submittals.walkthrough.seen')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Where you are' })).toBeTruthy()
    const titles: string[] = []
    const missing: string[] = []
    for (let i = 0; i < 12; i++) {
      const dialog = screen.getByRole('dialog')
      titles.push(dialog.getAttribute('aria-label') ?? '')
      if (within(dialog).queryByTestId('tour-missing')) missing.push(dialog.getAttribute('aria-label') ?? '')
      const next = within(dialog).queryByRole('button', { name: 'Next →' })
      if (next) fireEvent.click(next)
    }
    expect(titles).toEqual([
      'Where you are',
      'Step 1. Where the rows come from',
      'From the takeoff',
      'No schedule yet? Type or paste it',
      'Step 2. Build Rev 1',
      'Step 3. Fix the rows',
      'Step 3. Add the cut sheets',
      'Step 4. Build the package',
      'Step 5. Share it',
      'Step 6. Their answer',
      'Step 7. Resubmit',
      'Step 8. Procure',
    ])
    // On a fresh bid with a schedule, only the strip, the source line and the Build Rev 1 card are on the page; the robot's offer is not, so its stop is not walked (v2.4134).
    expect(missing).toEqual(titles.filter((t) => !['Where you are', 'Step 1. Where the rows come from', 'From the takeoff', 'No schedule yet? Type or paste it', 'Step 2. Build Rev 1'].includes(t)))
    expect(screen.getByRole('link', { name: 'Read the full guide: build a submittal package →' }).getAttribute('href')).toBe('/help?g=build-a-submittal-package')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('v2.4125 · every stage carries its plain sentence, and its ? opens the walkthrough on that stage’s stop', async () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    mount()
    expect(await screen.findByTestId('road-1-about')).toBeTruthy()
    // A fresh bid draws stages 1 and 2; the rest come with Rev 1.
    for (const n of [1, 2]) expect(screen.getByTestId(`road-${n}-about`).textContent).toContain(SUBMITTAL_STAGE_ABOUT[n])
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 2' }))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toMatch(/Build Rev 1/)
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 1' }))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toMatch(/Where the rows come from/)
  })

  it('v2.4136 · no robot offer anywhere while no seat is live; a live seat on a bid with no plans keeps the offer but holds the button', async () => {
    state.revisions = []
    state.items = []
    state.noSources = true
    state.takeoff = true
    state.seat = { unrevoked_seats: 0, last_used_at: null }
    const { unmount } = mount()
    expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
    expect(screen.queryByTestId('ask-robot-schedule')).toBeNull()
    expect(screen.queryByTestId('robot-offer-read_schedule')).toBeNull()
    unmount()
    state.seat = { unrevoked_seats: 1, last_used_at: new Date().toISOString() }
    mount()
    expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
    const ask = await screen.findByTestId('ask-robot-schedule')
    expect((ask as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toMatch(/✗ Add the plans link on the bid first\. · A robot was working/)
    state.noSources = false
    state.takeoff = false
  })

  it('v2.4140 · the Status, Reason and Sheet headers explain themselves, and the legend opens under the table', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', status: 'as_specified' })]
    mount()
    expect(await screen.findByTestId('status-legend-toggle')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /^Status/ }).getAttribute('title')).toBe('How your product compares to what the plans asked for.')
    expect(screen.getByRole('columnheader', { name: /^Sheet/ }).getAttribute('title')).toMatch(/maker’s page/)
    expect(screen.queryByTestId('status-legend')).toBeNull()
    fireEvent.click(screen.getByTestId('status-legend-toggle'))
    const legend = screen.getByTestId('status-legend')
    expect(legend.textContent).toContain('As specified — the exact product the plans named')
    expect(legend.textContent).toContain('Alternate — a stand-in for what the plans named, say why')
    expect(legend.textContent).toContain('Cut sheet — the maker’s page for the product')
    expect(screen.getByTestId('road-3-about').textContent).toContain('Check each row. Is it the product the plans asked for?')
  })

  it('v2.4169 · a stage you have not reached folds to its sentence; opened early, its button is held with the reason; an empty stage draws no box', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate' })]
    mount()
    await screen.findAllByTestId('submittal-row')
    expect(screen.getByTestId('road-3').getAttribute('data-open')).toBe('true')
    for (const n of [4, 5, 7]) expect(screen.getByTestId(`road-${n}`).getAttribute('data-open')).toBe('false')
    expect(screen.queryByTestId('build-package')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^4 · Package/ }))
    expect((screen.getByTestId('build-package') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('package-caption').textContent).toBe('Build package turns on when every row has its reason and its cut sheet.')
    fireEvent.click(screen.getByRole('button', { name: /^7 · Resubmit/ }))
    expect((screen.getByTestId('new-revision') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('resubmit-caption').textContent).toBe('New revision turns on once the package is built.')
    fireEvent.click(screen.getByRole('button', { name: /^6 · Their call/ }))
    expect(screen.getByTestId('road-6').getAttribute('data-open')).toBe('true')
    // Opened early, Their call has only its reviewer-file door — no empty box, no decisions band.
    expect(screen.queryByTestId('their-call-band')).toBeNull()
  })

  it('draws the tiles and rows of a revision — say why, sheet needed, the status chips — and Edit saves the row', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 12, house_id: null, house_name: null, trimmed_at: null }], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', status: 'alternate' }),
      item({ id: 'it-2', tag: 'PRV-1', sequence_order: 2, specified_manufacturer: 'Watts', specified_model: 'LF223', status: 'missing' }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 3, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2], lead_time_days: 0 }),
    ]
    state.writes = []
    mount()
    const rows = await screen.findAllByTestId('submittal-row')
    expect(rows).toHaveLength(3)
    expect(screen.getByTestId('revision-line').textContent).toMatch(/Rev 1 · draft · Sep 1[45] · 3 rows · 1 as specified · 1 alternate · 1 without a reason · 1 missing · 1 of 2 sheets in/)
    const tiles = screen.getByTestId('submittal-tiles').textContent ?? ''
    expect(tiles).toBe('3 rows. 1 still needs a reason. 1 still needs a product. 1 still needs a cut sheet.')
    expect(screen.getByTestId('submittal-tiles').getAttribute('title')).toMatch(/1 alternate · 1 without a reason · 1 missing · 1 of 2 sheets in/)
    expect(within(rows[0]!).getByText('say why')).toBeTruthy()
    expect(within(rows[0]!).getByText('sheet needed')).toBeTruthy()
    expect(within(rows[2]!).getByText(/✓ p\.1–2/)).toBeTruthy()
    expect(screen.getAllByTestId('product-status').map((c) => c.textContent)).toEqual(['Alternate', 'Missing', 'As specified'])
    expect(screen.getByTestId('sheet-strip').textContent).toMatch(/NWS\.pdf · 12 pages/)

    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Edit DWH-1' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit DWH-1' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Long lead time' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '1 wk' }))
    fireEvent.change(within(dialog).getByLabelText('Vendor file'), { target: { value: '0' } })
    fireEvent.change(within(dialog).getByLabelText('Pages'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toBe(true))
    const upd = state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')!
    expect(upd.filters).toEqual([['id', 'it-1']])
    // A draft's editor also carries the tag and the product (v2.4090), unchanged here.
    expect(upd.payload).toEqual({ status: 'alternate', reason_kind: 'lead_time', reason_note: null, lead_time_days: 7, sheet_file: 0, sheet_pages: [5], sheet_source: 'estimator', tag: 'DWH-1', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(screen.getAllByTestId('submittal-row')[0]!).getByText('Lead time')).toBeTruthy()
  })

  it('New revision carries the rows into Rev 2, marks the diff, and supersedes the unshared draft', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: 'b398/rev-1/package-rev1.pdf', source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_model: 'AO SMITH BTH-120', submitted_label: 'AO SMITH BTH-120', status: 'alternate', reason_kind: 'cost' }),
      item({ id: 'it-2', tag: 'PRV-1', sequence_order: 2, specified_manufacturer: 'Watts', specified_model: 'LF223', status: 'missing' }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 3, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2] }),
    ]
    state.writes = []
    mount()
    await screen.findAllByTestId('submittal-row')
    // Stage 7 folds until it is reached (v2.4169); the package is built, so its door is on once opened.
    fireEvent.click(screen.getByRole('button', { name: /^7 · Resubmit/ }))
    fireEvent.click(screen.getByTestId('new-revision'))
    // The confirm dialog names the diff, then builds.
    const confirmDialog = await screen.findByRole('alertdialog')
    expect(confirmDialog.textContent).toMatch(/Rev 2 from today's picks/)
    expect(confirmDialog.textContent).toMatch(/2 rows changed · 2 carried against Rev 1/)
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Build Rev 2' }))
    await waitFor(() => expect(state.writes.filter((w) => w.op === 'insert')).toHaveLength(2))
    expect(state.writes.find((w) => w.table === 'bid_submittals' && w.op === 'insert')!.payload).toMatchObject({ rev_number: 2, status: 'draft' })
    const rows = state.writes.find((w) => w.table === 'bid_submittal_items')!.payload as Record<string, unknown>[]
    expect(rows.map((r) => [r.tag, r.carried_from_item_id, r.sheet_pages])).toEqual([
      ['DWH-1', 'it-1', []],
      ['PRV-1', 'it-2', []],
      ['WC-1', 'it-3', [1, 2]],
      ['', null, []],
    ])
    const sup = state.writes.find((w) => w.table === 'bid_submittals' && w.op === 'update')!
    expect(sup.payload).toEqual({ status: 'superseded' })
    expect(sup.filters).toEqual([['id', 'rev-1']])
    // Rev 2 is selected and the diff column reads against Rev 1.
    await waitFor(() => expect(screen.getAllByTestId('revision-chip')).toHaveLength(2))
    expect(screen.getByText('Since Rev 1')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('submittal-rows').textContent).toMatch(/product changed/))
    expect(screen.getByTestId('submittal-rows').textContent).toMatch(/new row/)
  })

  it('Build package downloads only the files the rows use, stores package-rev<N>.pdf, stamps the revision, and opens the signed link', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 12, house_id: null, house_name: null, trimmed_at: null }, { path: 'b398/rev-1/1.pdf', name: 'Moore.pdf', pages: 4, house_id: null, house_name: null, trimmed_at: null }], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', status: 'alternate', reason_kind: 'lead_time', sheet_file: 0, sheet_pages: [3] }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 2, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2] }),
    ]
    state.writes = []
    state.storage = []
    state.packageCalls = []
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mount()
    await screen.findAllByTestId('submittal-row')
    fireEvent.click(screen.getByTestId('build-package'))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittals')).toBe(true))
    expect(state.packageCalls).toEqual([{ files: 1, sheets: ['DWH-1', 'WC-1'] }])
    expect(state.storage).toEqual(['download b398/rev-1/0.pdf', 'upload b398/rev-1/package-rev1.pdf', 'sign b398/rev-1/package-rev1.pdf'])
    const upd = state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittals')!
    expect(upd.payload).toEqual({ package_path: 'b398/rev-1/package-rev1.pdf' })
    expect(open).toHaveBeenCalledWith('https://signed.test/b398/rev-1/package-rev1.pdf', '_blank', 'noopener')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open package' })).toBeTruthy())
    expect(screen.getByTestId('revision-line').textContent).toMatch(/package built/)
    open.mockRestore()
  })

  it('the sheet strip: Show the pages draws them, a tap on a page then a row writes the pages, Done trims the file and rewrites the rows', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 4, house_id: null, house_name: null, trimmed_at: null }], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate', reason_kind: 'lead_time' }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 2, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [4] }),
    ]
    state.writes = []
    state.storage = []
    mount()
    await screen.findAllByTestId('submittal-row')
    fireEvent.click(screen.getByRole('button', { name: 'Show the pages' }))
    expect(await screen.findByRole('button', { name: 'Page 1' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Page \d$/ })).toHaveLength(4)
    expect(screen.getByTestId('strip-footer').textContent).toBe('1 of 4 pages on rows · 3 not used · tap a page, then the row it belongs to')
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    fireEvent.click(within(screen.getByTestId('row-chooser')).getByRole('button', { name: 'DWH-1 · sheet needed' }))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toBe(true))
    expect(state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')!.payload).toEqual({ sheet_file: 0, sheet_pages: [2], sheet_source: 'estimator' })
    await waitFor(() => expect(screen.getByTestId('strip-footer').textContent).toBe('2 of 4 pages on rows · 2 not used · tap a page, then the row it belongs to'))
    state.writes = []
    fireEvent.click(screen.getByRole('button', { name: 'Done with this file' }))
    await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittals' && w.op === 'update')).toBe(true))
    // Pages 2 and 4 kept → renumbered 1 and 2; the file record reads 2 pages, 2 let go.
    const pageWrites = state.writes.filter((w) => w.table === 'bid_submittal_items').map((w) => [w.filters[0]?.[1], (w.payload as { sheet_pages: number[] }).sheet_pages])
    expect(pageWrites).toEqual([
      ['it-1', [1]],
      ['it-3', [2]],
    ])
    const files = (state.writes.find((w) => w.table === 'bid_submittals')!.payload as { source_files: Array<Record<string, unknown>> }).source_files
    expect(files[0]).toMatchObject({ path: 'b398/rev-1/0.pdf', pages: 2, dropped_pages: 2 })
    expect(typeof files[0]!.trimmed_at).toBe('string')
    expect(state.storage).toContain('upload b398/rev-1/0.pdf')
  })

  it("5b · a shared revision offers Drop a reviewer's file, lists the file, and a call entered on the reviewer's behalf reads entered by Wendi", async () => {
    state.revisions = [{ id: 'rev-2', bid_id: 'b398', rev_number: 2, status: 'shared', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], reviewer_files: [{ path: 'b398/rev-2/reviewer/0-redlines.pdf', name: 'SUBMITTALS-REVISED.pdf', kind: 'redline', dropped_at: '2026-09-17T15:00:00Z', dropped_by: 'wendi', dropped_by_name: 'Wendi', person_id: 'p1', person_name: 'Dana Whitfield' }], shared_at: '2026-09-16T00:00:00Z', created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      { id: 'i-wc', submittal_id: 'rev-2', tag: 'WC-1', sequence_order: 1, status: 'alternate', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG#01', specified_description: 'WATER CLOSET', submitted_manufacturer: 'TOTO', submitted_model: 'CT728', submitted_label: 'TOTO CT728 kit', supply_house_id: 'h-nws', source_quote_line_id: 'l-wc', reason_kind: 'lead_time', reason_note: null, lead_time_days: 14, sheet_file: null, sheet_pages: [], sheet_source: null, review_decision: 'revise', review_note: 'elongated bowl', reviewed_at: '2026-09-17T15:00:00Z', reviewed_by_name: 'Dana Whitfield', reviewed_by_email: 'dana@arch.test', reviewed_by_person_id: 'p1', carried_from_item_id: null, decision_source: 'entered', decision_entered_by: 'wendi', decision_entered_by_name: 'Wendi', created_at: '', updated_at: '' },
    ]
    mount()
    expect(await screen.findByRole('button', { name: "Drop a reviewer's file" })).toBeTruthy()
    expect(screen.getByLabelText("Reviewer's file")).toBeTruthy()
    const card = await screen.findByTestId('reviewer-files')
    expect(card.textContent).toContain("SUBMITTALS-REVISED.pdf")
    expect(card.textContent).toContain("Dana Whitfield's redlined PDF · dropped Sep 17 by Wendi")
    expect(card.textContent).toContain('1 row entered by hand on this revision')
    expect((await screen.findByTestId('decisions-line')).textContent).toContain('1 revise · by Dana Whitfield · 1 entered by Wendi')
    const rows = await screen.findAllByTestId('submittal-row')
    expect(rows[0]!.textContent).toContain('Dana Whitfield · entered by Wendi')
  })

  it('6b · a ready schedule read lists the sure and want-a-look tags; Confirm keeps the chosen tags and drops the rest', async () => {
    state.revisions = []
    state.items = []
    state.tasks = [{ id: 'task-1', bid_id: 'b398', submittal_id: null, kind: 'read_schedule', input: {}, result: { rows: [{ tag: 'WC-1', fixture: 'water closet', manufacturer: 'TOTO', model: 'CT708UVG#01', confidence: 0.95 }, { tag: 'HB-3', model: 'B74-CH', confidence: 0.4 }] }, status: 'ready', requested_at: '2026-09-17T10:00:00Z', claimed_at: null, finished_at: '2026-09-17T10:05:00Z', reviewed_at: null, summary: 'Read P002.' }]
    mount()
    // v2.4109 · the state sits in the schedule card; the tags to confirm sit under the cards.
    const card = await screen.findByTestId('robot-schedule')
    expect(card.textContent).toContain('The robot read the schedule. Confirm the tags below.')
    expect(card.textContent).toContain('robot · read the schedule · ready · 2 tags · 1 sure · 1 want a look')
    const panel = screen.getByTestId('robot-schedule-confirm')
    expect(panel.textContent).toContain('The robot read 2 tags off the plans')
    expect(panel.textContent).toContain('WC-1 ✓')
    expect(screen.getByTestId('confirm-schedule').textContent).toBe('Confirm 1 · leave 1')
    fireEvent.click(screen.getByLabelText('Keep HB-3'))
    expect(screen.getByTestId('confirm-schedule').textContent).toBe('Confirm 2')
    fireEvent.click(screen.getByTestId('confirm-schedule'))
    await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittal_tasks' && w.op === 'update')).toBe(true))
    const confirm = state.writes.find((w) => w.table === 'bid_specified_products' && w.op === 'update')!
    expect(confirm.payload).toMatchObject({ confirmed_by: 'wendi' })
    expect(state.writes.some((w) => w.table === 'bid_specified_products' && w.op === 'delete')).toBe(true)
    expect(state.writes.find((w) => w.table === 'bid_submittal_tasks' && w.op === 'update')!.payload).toMatchObject({ status: 'done' })
  })

  it('v2.4107 · from the takeoff: a bid with no schedule and no picks offers the takeoff first; the picker ticks fixtures and equipment, Rev 1 lands as Proposed rows with the house, the ticks are remembered, and × on a draft row unticks it', async () => {
    state.revisions = []
    state.items = []
    state.writes = []
    state.tasks = []
    state.noSources = true
    state.takeoff = true
    try {
      mount()
      expect(await screen.findByText('No submittal on this bid yet')).toBeTruthy()
      expect(document.querySelector('[data-tour="submittals-source"]')?.textContent).toContain('4 fixtures on the takeoff · no schedule yet · choose from the takeoff')
      expect(screen.getByTestId('journey-next').textContent).toBe('Next: The takeoff has 4 fixtures. 3 of them have a part. Tick the ones to submit, then build Rev 1 from them. You can type the plans’ schedule later. Then each row is checked against it.Choose from the takeoff')
      expect(screen.getByTestId('source-takeoff').textContent).toContain('The takeoff · 4 fixtures, 3 with a part')
      expect(screen.getByTestId('choose-from-takeoff').textContent).toBe('Choose from the takeoff')
      // v2.4109 · no picks → no picks card; the robot's offer is a line in the schedule card.
      expect(screen.queryByTestId('source-picks')).toBeNull()
      expect(screen.getByTestId('ask-robot-schedule').textContent).toBe('Ask the robot to read the schedule')
      expect(screen.queryByRole('button', { name: /Build Rev 1 from/ })).toBeNull()
      fireEvent.click(screen.getByTestId('build-from-takeoff'))
      const picker = await screen.findByRole('dialog', { name: 'Choose from the takeoff' })
      // Fixtures and equipment ticked; the unpriced sink and the pipe not.
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('2 rows will go on Rev 1 · 2 with a product · 2 left out')
      expect(within(picker).getByTestId('takeoff-group-fixtures').textContent).toContain('Reece')
      fireEvent.click(within(picker).getByLabelText('UTILITY SINK'))
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('3 rows will go on Rev 1 · 2 with a product, 1 to type · 1 left out')
      fireEvent.click(within(picker).getByTestId('takeoff-confirm'))
      await waitFor(() => expect(state.writes.some((w) => w.op === 'upsert' && w.table === 'bid_submittal_takeoff_choices')).toBe(true))
      expect(state.writes.find((w) => w.table === 'bid_submittals')!.payload).toMatchObject({ bid_id: 'b398', rev_number: 1, status: 'draft' })
      const rows = state.writes.find((w) => w.op === 'insert' && w.table === 'bid_submittal_items')!.payload as Record<string, unknown>[]
      expect(rows.map((r) => [r.tag, r.status, r.submitted_label, r.supply_house_id, r.source_count_row_id])).toEqual([
        ['DWH-1', 'proposed', 'A.O. Smith BTH-199 WATER HEATER', null, 'c-wh'],
        ['WC-1, WC-2', 'proposed', 'TOTO CT708UVG#01 WALL HUNG BOWL', 'h-reece', 'c-wc'],
        ['UTILITY SINK', 'missing', null, null, 'c-us'],
      ])
      expect(rows[1]).toMatchObject({ specified_description: 'WC 1&2', sequence_order: 2, submittal_id: 'rev-1' })
      const ticks = state.writes.find((w) => w.op === 'upsert')!.payload as Array<{ count_row_id: string; ticked: boolean }>
      expect(ticks.map((t) => [t.count_row_id, t.ticked])).toEqual([['c-wh', true], ['c-wc', true], ['c-us', true], ['c-pipe', false]])
      // The built revision: three rows, the picker gone, the source line now reads the takeoff as done.
      expect(await screen.findByTestId('revision-line')).toBeTruthy()
      expect(screen.getAllByTestId('submittal-row')).toHaveLength(3)
      expect(screen.queryByRole('dialog', { name: 'Choose from the takeoff' })).toBeNull()
      expect(screen.getByTestId('add-from-takeoff').textContent).toBe('+ Add from the takeoff…')
      // × on the sink: off the draft, and unticked on the takeoff list.
      state.writes = []
      fireEvent.click(screen.getByRole('button', { name: 'Remove UTILITY SINK' }))
      const confirmDialog = await screen.findByRole('alertdialog')
      expect(confirmDialog.textContent).toMatch(/unticked on the takeoff list/)
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Remove' }))
      await waitFor(() => expect(state.writes.some((w) => w.op === 'upsert')).toBe(true))
      expect(state.writes.find((w) => w.op === 'delete')!.filters).toEqual([['id', 'it-3']])
      expect(state.writes.find((w) => w.op === 'upsert')!.payload).toEqual([{ bid_id: 'b398', count_row_id: 'c-us', ticked: false }])
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(2))
    } finally {
      state.noSources = false
      state.takeoff = false
    }
  })

  it('v2.4118 · Split on a draft row whose tag lists two: the rows after it shift down, the row becomes one per tag with its product and sheets, and a takeoff row’s split is remembered', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199', status: 'proposed', source_count_row_id: 'c-wh' }),
      item({ id: 'it-2', tag: 'WC-1, WC-2', sequence_order: 2, submitted_label: 'TOTO TET2UB31#SS', status: 'proposed', lead_time_days: 14, sheet_file: 0, sheet_pages: [3, 4], sheet_source: 'estimator', source_count_row_id: 'c-wc' }),
      item({ id: 'it-3', tag: 'WHA-200', sequence_order: 3, submitted_label: 'ZURN Z1700-200-OV', status: 'proposed' }),
    ]
    state.writes = []
    state.tasks = []
    state.takeoff = true
    try {
      mount()
      await screen.findAllByTestId('submittal-row')
      expect(screen.getAllByTestId('split-row')).toHaveLength(1)
      expect(screen.getByTestId('split-rule-link-rows').textContent).toBe('when can a row split?')
      fireEvent.click(screen.getByRole('button', { name: 'Split WC-1, WC-2' }))
      const confirmDialog = await screen.findByRole('alertdialog')
      expect(confirmDialog.textContent).toMatch(/WC-1, WC-2 each get their own row/)
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Split into 2 rows' }))
      await waitFor(() => expect(state.writes.some((w) => w.op === 'upsert')).toBe(true))
      // WHA-200 moves from 3 to 4; the combined row goes; WC-1 at 2 and WC-2 at 3 carry the product, lead time and pages.
      expect(state.writes.find((w) => w.op === 'update')!).toMatchObject({ payload: { sequence_order: 4 }, filters: [['id', 'it-3']] })
      expect(state.writes.find((w) => w.op === 'delete')!.filters).toEqual([['id', 'it-2']])
      const rows = state.writes.find((w) => w.op === 'insert')!.payload as Record<string, unknown>[]
      expect(rows.map((r) => [r.tag, r.sequence_order, r.submitted_label, r.lead_time_days, r.sheet_pages, r.source_count_row_id, r.status])).toEqual([
        ['WC-1', 2, 'TOTO TET2UB31#SS', 14, [3, 4], 'c-wc', 'proposed'],
        ['WC-2', 3, 'TOTO TET2UB31#SS', 14, [3, 4], 'c-wc', 'proposed'],
      ])
      expect(state.writes.find((w) => w.op === 'upsert')!.payload).toEqual([{ bid_id: 'b398', count_row_id: 'c-wc', ticked: true, split: true }])
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(4))
      expect(screen.queryByTestId('split-row')).toBeNull()
      // The modal reads this bid's own names.
      fireEvent.click(screen.getByTestId('split-rule-link-rows'))
      const modal = await screen.findByRole('dialog', { name: 'When a row can split' })
      expect(within(modal).getByTestId('split-rule-table').textContent).toContain('WC 1&2WC-1, WC-2can split')
      expect(within(modal).getByTestId('split-rule-table').textContent).toContain('DWH1 & ETDWH-1“ET” has no number, so it is not a second tagone row')
    } finally {
      state.takeoff = false
    }
  })
})

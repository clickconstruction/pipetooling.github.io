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
const state: { /** 2026-10-02 · what the procurement log holds, for the left-out guard */ procRecords?: Record<string, unknown>[]; revisions: Record<string, unknown>[]; items: Record<string, unknown>[]; /** 2026-10-01 · the rows' parts */ parts: Record<string, unknown>[]; tasks: Record<string, unknown>[]; writes: Rec[]; storage: string[]; packageCalls: Array<{ files: number; sheets: string[] }>; noSources: boolean; takeoff: boolean; /** the bid has no review room yet: the room and people reads answer null, as PostgREST does */ noRoom: boolean; seat: { unrevoked_seats: number; last_used_at: string | null } | null } = { revisions: [], items: [], parts: [], tasks: [], writes: [], storage: [], packageCalls: [], noSources: false, takeoff: false, noRoom: false, seat: { unrevoked_seats: 1, last_used_at: new Date().toISOString() } }

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

// One row's cut sheet as its own PDF: the plan and the file name are the real ones; the cutting (pdf-lib) is stood in for.
vi.mock('../../lib/submittals/rowCutSheet', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/submittals/rowCutSheet')>()
  return {
    ...real,
    buildRowCutSheet: async (plan: Array<{ fileIndex: number; pages: number[] }>, readFile: (i: number) => Promise<unknown>) => {
      for (const i of new Set(plan.map((s) => s.fileIndex))) await readFile(i)
      return { bytes: new Uint8Array([1, 2, 3]), pages: plan.reduce((n, s) => n + s.pages.length, 0) }
    },
  }
})

vi.mock('../../lib/submittals/pdfThumbnails', () => ({
  renderPdfThumbnails: (bytes: ArrayBuffer) => Promise.resolve(Array.from({ length: Math.max(1, bytes.byteLength / 2) }, (_, i) => `data:page${i + 1}`)),
  // 2026-10-01 · Read its parts: the file reads as BP375's National Wholesale submittal.
  openPdf: async () => {
    const { BP375_NWS_PAGES } = await import('../../lib/submittals/houseFileParts.bp375.fixture')
    return { numPages: BP375_NWS_PAGES.length, pageText: (p: number) => Promise.resolve(BP375_NWS_PAGES[p - 1] ?? ''), renderPage: () => Promise.resolve(''), destroy: () => {} }
  },
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
  // An `in` on a write names the rows it takes (the whole-submittal approval); reads ignore it.
  b.in = (col: string, vals: unknown) => {
    rec.filters.push([`${col}:in`, vals])
    return b
  }
  b.is = chain
  b.ilike = chain
  b.limit = chain
  b.range = chain
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
      if (rec.op === 'insert' && table === 'bid_submittal_item_parts') {
        const rows = (Array.isArray(rec.payload) ? (rec.payload as Record<string, unknown>[]) : [rec.payload as Record<string, unknown>]).map((r, i) => ({ id: `pt-${state.parts.length + i + 1}`, procure_key: `pk-${state.parts.length + i + 1}`, sheet_pages: [], quantity: 1, on_submittal: true, ...r }))
        state.parts = [...state.parts, ...rows]
        return { data: rows, error: null }
      }
      if (rec.op === 'delete' && table === 'bid_submittal_item_parts') {
        const ids = rec.filters.find((f) => f[0] === 'id:in')?.[1] as string[] | undefined
        state.parts = state.parts.filter((r) => !(ids ?? []).includes(r.id as string))
      }
      if (rec.op === 'update' && table === 'bid_submittal_item_parts') {
        const ids = rec.filters.find((f) => f[0] === 'id:in')?.[1] as string[] | undefined
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.parts = state.parts.map((r) => ((ids ? ids.includes(r.id as string) : r.id === id) ? { ...r, ...(rec.payload as Record<string, unknown>) } : r))
      }
      if (rec.op === 'update' && table === 'bid_submittals') {
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.revisions = state.revisions.map((r) => (r.id === id ? { ...r, ...(rec.payload as Record<string, unknown>) } : r))
      }
      if (rec.op === 'update' && table === 'bid_submittal_items') {
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        const ids = rec.filters.find((f) => f[0] === 'id:in')?.[1] as string[] | undefined
        const hit = (r: Record<string, unknown>) => (ids ? ids.includes(r.id as string) && r.review_decision == null : r.id === id)
        const taken = state.items.filter(hit).map((r) => ({ id: r.id }))
        state.items = state.items.map((r) => (hit(r) ? { ...r, ...(rec.payload as Record<string, unknown>) } : r))
        if (ids) return { data: taken, error: null }
      }
      if (rec.op === 'insert' && table === 'bid_submittal_rooms') return { data: { id: 'room-1', token: 'tok', status: 'open', closed_at: null, ...(rec.payload as Record<string, unknown>) }, error: null }
      if (rec.op === 'insert' && table === 'bid_submittal_people') return { data: { id: 'person-new', ...(rec.payload as Record<string, unknown>) }, error: null }
      if (rec.op === 'delete' && table === 'bid_submittal_items') {
        const sid = rec.filters.find((f) => f[0] === 'submittal_id')?.[1]
        const id = rec.filters.find((f) => f[0] === 'id')?.[1]
        state.items = state.items.filter((r) => (sid ? r.submittal_id !== sid : r.id !== id))
      }
      return { data: null, error: null }
    }
    if (state.noRoom && (table === 'bid_submittal_rooms' || table === 'bid_submittal_people')) return { data: null, error: null }
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
    if (table === 'bid_submittal_item_parts') {
      const ids = (rec.filters.find((f) => f[0] === 'item_id:in')?.[1] as string[] | undefined) ?? []
      return { data: state.parts.filter((r) => ids.includes(r.item_id as string)), error: null }
    }
    if (table === 'bid_procurement_items') return { data: state.procRecords ?? [], error: null }
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

/** v2.4610 · a saved file is a hidden link clicked from a blob: jsdom has no object URLs, so these stand in. */
function stubSave() {
  const saved: string[] = []
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this.download) })
  const urlApi = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
  const before = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL }
  urlApi.createObjectURL = () => 'blob:saved'
  urlApi.revokeObjectURL = () => {}
  return { saved, restore: () => { click.mockRestore(); urlApi.createObjectURL = before.create; urlApi.revokeObjectURL = before.revoke } }
}

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
    // One header line: the counts live on step 1 and in the Next line below.
    expect(screen.getByTestId('revision-line').textContent).toBe('Submittals · plumbing fixtures & equipment · no submittal on this bid yet')
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
    // 2026-10-03 · two quick presses on Save add the row once: the first holds the window.
    const saveButton = within(dialog).getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)
    await waitFor(() => expect(state.writes.some((w) => w.op === 'insert' && w.table === 'bid_submittal_items')).toBe(true))
    expect(state.writes.find((w) => w.op === 'insert' && w.table === 'bid_submittal_items')!.payload).toMatchObject({ submittal_id: 'rev-1', sequence_order: 2, status: 'missing', tag: 'GI-1', submitted_label: 'Schier GB-250 grease interceptor', lead_time_days: 28 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state.writes.filter((w) => w.op === 'insert' && w.table === 'bid_submittal_items')).toHaveLength(1)
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
    const titles: string[] = []
    const missing: string[] = []
    // 2026-10-04 · the walkthrough opens on the words this page uses: a centred card listing each term, with nothing "missing".
    const words = screen.getByRole('dialog', { name: 'The words on this page' })
    expect(within(words).getByTestId('tour-terms').textContent).toContain('Cut sheetThe maker’s page for one product. It shows the model and its details.')
    expect(within(words).queryByTestId('tour-missing')).toBeNull()
    fireEvent.click(within(words).getByRole('button', { name: 'Next →' }))
    expect(screen.getByRole('dialog', { name: 'Where you are' })).toBeTruthy()
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
    // On a fresh bid with a schedule, only the strip, the source line, the Build Rev 1 card and Procure (always on the page, v2.4201) are there; the robot's offer is not, so its stop is not walked (v2.4134).
    expect(missing).toEqual(titles.filter((t) => !['Where you are', 'Step 1. Where the rows come from', 'From the takeoff', 'No schedule yet? Type or paste it', 'Step 2. Build Rev 1', 'Step 8. Procure'].includes(t)))
    // v2.4201 · Procure is drawn and open before a revision exists: long-lead items can go in now.
    expect(screen.getByTestId('road-8').getAttribute('data-open')).toBe('true')
    expect(within(screen.getByTestId('road-8-body')).getByText(/No rows yet/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Read the full guide: build a submittal package →' }).getAttribute('href')).toBe('/help?g=build-a-submittal-package')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('2026-10-05 · the page’s one help door is the ? beside the ×: it starts the walkthrough on the words page, and there is no separate words link', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', status: 'as_specified' })]
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    mount()
    const help = await screen.findByRole('button', { name: 'How this page works' })
    expect(help.textContent).toBe('?')
    // It sits with the close ×, at the far end of the title row, not beside the bid's name.
    const close = screen.getByRole('button', { name: 'Close' })
    expect(help.parentElement).toBe(close.parentElement)
    expect(help.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Words on this page')).toBeNull()
    expect(screen.queryByTestId('submittal-words')).toBeNull()
    fireEvent.click(help)
    // The walkthrough opens on the words the page uses, then goes on to the steps.
    const card = screen.getByRole('dialog', { name: 'The words on this page' })
    expect(within(card).getByTestId('tour-terms').textContent).toContain('TagThe plan’s name for a fixture, like WC-1.')
    expect(within(card).getByRole('button', { name: 'Next →' })).toBeTruthy()
  })

  it('v2.4125 · every stage carries its plain sentence, and its ? opens the walkthrough on that stage’s stop', async () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    Element.prototype.scrollIntoView = () => {}
    mount()
    await screen.findByTestId('road-1')
    // A fresh bid draws stages 1 and 2; the rest come with Rev 1. A folded stage is one line: its sentence and its ? show once it is open.
    for (const n of [1, 2]) {
      if (screen.getByTestId(`road-${n}`).getAttribute('data-open') !== 'true') {
        expect(screen.queryByTestId(`road-${n}-about`)).toBeNull()
        fireEvent.click(screen.getByTestId(`road-${n}-caret`))
      }
      expect(screen.getByTestId(`road-${n}-about`).textContent).toContain(SUBMITTAL_STAGE_ABOUT[n])
    }
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 2' }))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toMatch(/Build Rev 1/)
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through step 1' }))
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toMatch(/Where the rows come from/)
  })

  it('2026-10-03 · a queued ask nobody is coming for says the day it was asked and that no robot is on shift; a fresh one with a robot awake reads as before', async () => {
    state.revisions = []
    state.items = []
    const task = { id: 'task-q', bid_id: 'b398', submittal_id: null, kind: 'read_schedule', input: {}, result: null, status: 'queued', claimed_at: null, finished_at: null, reviewed_at: null, summary: null }
    // BP375: asked on Sep 29, and no seat has been used since.
    state.tasks = [{ ...task, requested_at: '2026-09-29T15:00:00Z' }]
    state.seat = { unrevoked_seats: 1, last_used_at: '2026-09-21T15:00:00Z' }
    const { unmount } = mount()
    // 2026-10-05 · a finished step 1 folds even while an ask waits: its one line carries the robot's state, in amber, and the caret opens it again.
    const folded = await screen.findByTestId('road-1-robot')
    expect(screen.getByTestId('road-1').getAttribute('data-open')).toBe('false')
    expect(folded.textContent).toMatch(/^ · 🤖 Asked Sep 29 · no robot has run in \d+ days$/)
    expect(screen.queryByTestId('robot-schedule')).toBeNull()
    fireEvent.click(screen.getByTestId('road-1-caret'))
    const card = await screen.findByTestId('robot-schedule')
    await waitFor(() => expect(card.getAttribute('data-stale')).toBe('true'))
    // One line: the chip says it is stuck and since when; the sentences open in its card.
    expect(within(card).getByTestId('robot-schedule-chip').textContent).toMatch(/^🤖 Asked Sep 29 · no robot has run in \d+ days$/)
    fireEvent.mouseEnter(card)
    expect(within(card).getByRole('note').textContent).toMatch(/^You asked the robot on Sep 29\. No robot has run in \d+ days\./)
    expect(within(card).getByTestId('robot-line').textContent).toBe('Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.')
    expect(within(card).getByRole('button', { name: 'Take the ask back' })).toBeTruthy()
    unmount()
    state.tasks = [{ ...task, requested_at: new Date().toISOString() }]
    state.seat = { unrevoked_seats: 1, last_used_at: new Date().toISOString() }
    mount()
    expect((await screen.findByTestId('road-1-robot')).textContent).toBe(' · 🤖 Queued to read the plans')
    fireEvent.click(screen.getByTestId('road-1-caret'))
    const fresh = await screen.findByTestId('robot-schedule')
    expect(fresh.getAttribute('data-stale')).toBeNull()
    expect(within(fresh).getByTestId('robot-schedule-chip').textContent).toBe('🤖 Queued to read the plans')
    fireEvent.mouseEnter(fresh)
    expect(fresh.textContent).toContain('The robot is queued to read the fixture schedule off the plans.')
    expect(within(fresh).getByRole('button', { name: 'Cancel' })).toBeTruthy()
    state.tasks = []
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
    expect(screen.getByTestId('robot-offer-read_schedule-held').textContent).toBe('needs the plans link on the bid')
    fireEvent.mouseEnter(screen.getByTestId('robot-offer-read_schedule'))
    expect(screen.getByTestId('robot-needs-read_schedule').textContent).toMatch(/✗ Add the plans link on the bid first\. · A robot was working/)
    state.noSources = false
    state.takeoff = false
  })

  it('v2.4140 · the Status, Reason and Sheet headers explain themselves, and the legend opens under the table', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', status: 'as_specified' })]
    mount()
    expect(await screen.findByTestId('status-legend-toggle')).toBeTruthy()
    // The rows table's headers (the procurement log has a Status column of its own since 2026-10-02).
    const rowsTable = screen.getAllByTestId('submittal-row')[0]!.closest('table')!
    expect(within(rowsTable).getByRole('columnheader', { name: /^Status/ }).getAttribute('title')).toBe('How your product compares to what the plans asked for.')
    expect(within(rowsTable).getByRole('columnheader', { name: /^Cut sheet/ }).getAttribute('title')).toMatch(/maker’s page/)
    expect(screen.queryByTestId('status-legend')).toBeNull()
    fireEvent.click(screen.getByTestId('status-legend-toggle'))
    const legend = screen.getByTestId('status-legend')
    expect(legend.textContent).toContain('As specified — the exact product the plans named')
    expect(legend.textContent).toContain('Alternate — a stand-in for what the plans named, say why')
    expect(legend.textContent).toContain('Cut sheet — the maker’s page for the product')
    expect(screen.getByTestId('road-3-about').textContent).toContain('Check each row and its parts. Is it the product the plans asked for?')
  })

  it('v2.4169 · a stage you have not reached folds to its sentence; opened early, its button is held with the reason; an empty stage draws no box', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate' })]
    mount()
    await screen.findAllByTestId('submittal-row')
    expect(screen.getByTestId('road-3').getAttribute('data-open')).toBe('true')
    for (const n of [4, 5, 7]) expect(screen.getByTestId(`road-${n}`).getAttribute('data-open')).toBe('false')
    expect(screen.queryByTestId('build-package')).toBeNull()
    // v2.4201 · Procure never folds on its own, and a pill jumps into its stage: Share opens, scrolls and rings.
    expect(screen.getByTestId('road-8').getAttribute('data-open')).toBe('true')
    const scrolls = vi.fn()
    Element.prototype.scrollIntoView = scrolls
    fireEvent.click(screen.getByRole('button', { name: '5 Share · later' }))
    expect(screen.getByTestId('road-5').getAttribute('data-open')).toBe('true')
    expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
    // The Share button was folded away when the pill was tapped, so the ring lands on it a frame later; the pill always centres.
    await waitFor(() => expect(document.querySelector('[data-tour="submittals-share"]')?.classList.contains('submittal-journey-flash')).toBe(true))
    expect(scrolls).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    // v2.4207 · a step's title jumps the same way but scrolls only when the controls would be off screen (jsdom's rects sit at 0, on screen): step 7's button rings, the page stays put, and the caret is what folds.
    scrolls.mockClear()
    fireEvent.click(screen.getByTestId('road-7-title'))
    expect(screen.getByTestId('road-7').getAttribute('data-open')).toBe('true')
    await waitFor(() => expect(document.querySelector('[data-tour="submittals-resubmit"]')?.classList.contains('submittal-journey-flash')).toBe(true))
    expect(scrolls).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('road-7-title'))
    expect(screen.getByTestId('road-7').getAttribute('data-open')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Fold step 7' }))
    expect(screen.getByTestId('road-7').getAttribute('data-open')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Unfold step 7' }))
    expect(screen.getByTestId('road-7').getAttribute('data-open')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^4 · Package/ }))
    expect((screen.getByTestId('build-package') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('package-caption').textContent).toBe('Build package turns on when every row that owes a reason has one.')
    fireEvent.click(screen.getByRole('button', { name: /^7 · Resubmit/ }))
    expect((screen.getByTestId('new-revision') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('resubmit-caption').textContent).toBe('You can start the next draft once the package is built.')
    fireEvent.click(screen.getByRole('button', { name: /^6 · Their call/ }))
    expect(screen.getByTestId('road-6').getAttribute('data-open')).toBe('true')
    // Opened early, Their call has only its reviewer-file door — no empty box, no decisions band.
    expect(screen.queryByTestId('their-call-band')).toBeNull()
  })

  it('v2.4189 · See what the GC sees opens the reviewer’s page in a window over the road, from the rows as they stand (#62 Layer 2; a window since 2026-10-02)', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [
      item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', submitted_model: 'CT708UVG', status: 'as_specified' }),
      item({ id: 'it-2', tag: 'DWH-1', sequence_order: 2, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate', reason_kind: 'lead_time' }),
    ]
    mount()
    await screen.findAllByTestId('submittal-row')
    expect(screen.queryByTestId('see-gc-pane')).toBeNull()
    fireEvent.click(screen.getByTestId('see-gc'))
    const dialog = screen.getByRole('dialog', { name: 'What the GC sees' })
    const pane = within(dialog).getByTestId('see-gc-pane')
    expect(pane.textContent).toContain('Product review')
    expect(screen.getByTestId('room-headline').textContent).toContain('1 product needs your answer')
    expect(screen.getAllByTestId('room-row')).toHaveLength(1)
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('see-gc-pane')).toBeNull()
    expect(screen.getByTestId('see-gc').textContent).toBe('See what the GC sees')
  })

  it('v2.4174 · under the rows, the reviewer’s own headline for the draft as it stands (#62 Layer 1)', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: 'b398/rev-1/package-rev1.pdf', source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [
      item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01', submitted_model: 'CT708UVG', status: 'as_specified' }),
      item({ id: 'it-2', tag: 'DWH-1', sequence_order: 2, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate', reason_kind: 'lead_time' }),
    ]
    mount()
    await screen.findAllByTestId('submittal-row')
    const line = screen.getByTestId('reviewer-line').textContent ?? ''
    expect(line).toContain('The GC’s page will read: “1 product needs your answer” — 1 product matches the plans and is marked approved. 1 differs — each says why.')
    expect(line).toContain('The GC sees nothing until you share.')
  })

  it('v2.4593 · a draft over a shared revision says what the link shows now, skipping a revision answered by email and never shared (BP398 today)', async () => {
    state.revisions = [
      { id: 'rev-3', bid_id: 'b398', rev_number: 3, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-10-02T00:00:00Z', shared_at: null },
      { id: 'rev-2', bid_id: 'b398', rev_number: 2, status: 'superseded', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], created_at: '2026-09-20T00:00:00Z', shared_at: null },
      { id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'shared', title: 'Plumbing fixtures & equipment', note: null, package_path: 'b398/rev-1/package-rev1.pdf', source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: '2026-09-16T03:03:49Z' },
    ]
    state.items = [item({ id: 'it-9', submittal_id: 'rev-3', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', status: 'alternate', reason_kind: 'lead_time' })]
    mount()
    await screen.findAllByTestId('submittal-row')
    const line = screen.getByTestId('reviewer-line').textContent ?? ''
    expect(line).toContain('The GC’s page will read: “1 product needs your answer”')
    expect(line).toContain('Until you share Rev 3, the link shows Rev 1.')
    expect(line).not.toContain('The GC sees nothing')
    fireEvent.click(screen.getByTestId('see-gc'))
    expect(screen.getByTestId('see-gc-why').textContent).toContain('Until you share Rev 3, the link shows Rev 1.')
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
    await screen.findAllByTestId('submittal-row')
    // One header line: the revision and what the submittal is. The counts are step 3's.
    expect(screen.getByTestId('revision-line').textContent).toMatch(/^Rev 1 · draft · Sep 1[45] · Plumbing fixtures & equipment$/)
    // Open, step 3 says what is left as its filter chips; folded, as its one-line summary.
    expect(screen.queryByTestId('submittal-tiles')).toBeNull()
    expect(within(screen.getByTestId('row-filters')).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 3', 'Need a reason 1', 'Need a cut sheet 1', 'No product 1'])
    fireEvent.click(screen.getByTestId('road-3-caret'))
    expect(screen.getByTestId('submittal-tiles').textContent).toBe('3 rows. 1 still needs a reason. 1 still needs a product. 1 still needs a cut sheet.')
    expect(screen.getByTestId('submittal-tiles').getAttribute('title')).toMatch(/1 alternate · 1 without a reason · 1 missing · 1 of 2 sheets in/)
    fireEvent.click(screen.getByTestId('road-3-caret'))
    const rows = screen.getAllByTestId('submittal-row')
    expect(rows).toHaveLength(3)
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
    // A draft's editor also carries the product (v2.4090), unchanged here; the tag only when it was changed (2026-10-02).
    expect(upd.payload).toEqual({ status: 'alternate', reason_kind: 'lead_time', reason_note: null, lead_time_days: 7, sheet_file: 0, sheet_pages: [5], sheet_source: 'estimator', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(screen.getAllByTestId('submittal-row')[0]!).getByText('Lead time')).toBeTruthy()
  })

  it('with nothing sent back, Start a Rev 2 draft carries every row into Rev 2, marks the diff, and supersedes the unshared draft', async () => {
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
    // 2026-10-05 · one button. Nothing was sent back, so there is one kind of draft: no chooser, one question.
    expect(screen.getByTestId('new-revision').textContent).toBe('Start a Rev 2 draft…')
    expect(screen.getByTestId('resubmit-caption').textContent).toBe('The draft starts with every row. Nothing is sent. The GC sees Rev 2 only after you press Share.')
    // Nothing was sent back, so step 7 is not the live step and there is no Next revision loop.
    expect(screen.queryByTestId('next-revision-loop')).toBeNull()
    fireEvent.click(screen.getByTestId('new-revision'))
    // The confirm dialog names the diff, then builds.
    const confirmDialog = await screen.findByRole('alertdialog')
    expect(screen.queryByTestId('resubmit-chooser')).toBeNull()
    expect(confirmDialog.textContent).toMatch(/Start a Rev 2 draft/)
    expect(confirmDialog.textContent).toMatch(/Every row goes on Rev 2, built from today's picks\. 2 rows changed · 2 carried against Rev 1/)
    expect(confirmDialog.textContent).toMatch(/Rev 2 starts as a draft\. Nothing is sent\./)
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Start the draft with 4 rows' }))
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

  it('2026-10-05 · Save PDF on a row cuts that row’s pages out of the vendor file and saves them under the row’s tag; nothing is written', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 12, house_id: null, house_name: null, trimmed_at: null }], created_at: '2026-09-15T00:00:00Z', shared_at: null }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'RHEEM PROPH40', status: 'proposed', sheet_file: 0, sheet_pages: [6, 7, 8] }),
      item({ id: 'it-2', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed' }),
    ]
    state.writes = []
    state.storage = []
    const saved: Array<{ name: string; href: string }> = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push({ name: this.download, href: this.href }) })
    const createUrl = vi.fn(() => 'blob:cut-sheet')
    const urlApi = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
    const before = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL }
    urlApi.createObjectURL = createUrl
    urlApi.revokeObjectURL = () => {}
    try {
      mount()
      const rows = await screen.findAllByTestId('submittal-row')
      // Only a row that has a cut sheet offers the door.
      expect(within(rows[1]!).queryByTestId('save-sheet')).toBeNull()
      fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Save the cut sheet for DWH-1 as a PDF' }))
      await waitFor(() => expect(saved).toEqual([{ name: 'DWH-1 cut sheet.pdf', href: 'blob:cut-sheet' }]))
      expect(state.storage).toEqual(['download b398/rev-1/0.pdf'])
      expect(await screen.findByText('Saved DWH-1 cut sheet.pdf · 3 pages. Attach it to your email or text.')).toBeTruthy()
      expect(state.writes).toEqual([])
    } finally {
      click.mockRestore()
      urlApi.createObjectURL = before.create
      urlApi.revokeObjectURL = before.revoke
    }
  })

  it('Build package downloads only the files the rows use, stores package-rev<N>.pdf, stamps the revision, and saves the fresh package under its name', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 12, house_id: null, house_name: null, trimmed_at: null }, { path: 'b398/rev-1/1.pdf', name: 'Moore.pdf', pages: 4, house_id: null, house_name: null, trimmed_at: null }], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', status: 'alternate', reason_kind: 'lead_time', sheet_file: 0, sheet_pages: [3] }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 2, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2] }),
    ]
    state.writes = []
    state.storage = []
    state.packageCalls = []
    const save = stubSave()
    mount()
    await screen.findAllByTestId('submittal-row')
    fireEvent.click(screen.getByTestId('build-package'))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittals')).toBe(true))
    expect(state.packageCalls).toEqual([{ files: 1, sheets: ['DWH-1', 'WC-1'] }])
    // v2.4610 · no signed link: the package just built is saved from the app's own address, under its name.
    expect(state.storage).toEqual(['download b398/rev-1/0.pdf', 'upload b398/rev-1/package-rev1.pdf'])
    const upd = state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittals')!
    expect(upd.payload).toEqual({ package_path: 'b398/rev-1/package-rev1.pdf' })
    await waitFor(() => expect(save.saved).toEqual([expect.stringMatching(/^Submittal Rev 1 - .+\.pdf$/)]))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open package' })).toBeTruthy())
    expect(screen.getByTestId('revision-line').textContent).toMatch(/package built/)
    // Open package reads the stored file and saves it the same way.
    fireEvent.click(screen.getByRole('button', { name: 'Open package' }))
    await waitFor(() => expect(save.saved).toHaveLength(2))
    expect(state.storage).toEqual(['download b398/rev-1/0.pdf', 'upload b398/rev-1/package-rev1.pdf', 'download b398/rev-1/package-rev1.pdf'])
    save.restore()
  })

  it('2026-10-04 · a row with no cut sheet no longer holds the package: the button counts it, a question names it, and the built package can be shared', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS.pdf', pages: 12, house_id: null, house_name: null, trimmed_at: null }], shared_at: null, created_at: '2026-09-29T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'RHEEM PROPH40-T2-RH400-SO', status: 'proposed', sheet_file: 0, sheet_pages: [6, 7] }),
      item({ id: 'it-2', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed' }),
      item({ id: 'it-3', tag: 'UTILITY SINK', sequence_order: 3, submitted_label: null, status: 'missing' }),
    ]
    state.writes = []
    state.storage = []
    state.packageCalls = []
    state.parts = []
    state.tasks = []
    state.noSources = true
    const save = stubSave()
    try {
      mount()
      const button = await screen.findByTestId('build-package')
      expect(button.textContent).toBe('Build package · 1 cut sheet to follow')
      expect((button as HTMLButtonElement).disabled).toBe(false)
      expect(screen.getByTestId('package-caption').textContent).toBe('One PDF on our letterhead. 1 row has no cut sheet yet. The cover lists it as cut sheets to follow.')
      expect(screen.getByTestId('submittal-journey').textContent).toContain('You can build the package now too. Those rows will read cut sheet to follow.')
      // Share waits for the package, as before.
      fireEvent.click(screen.getByRole('button', { name: /^5 · Share/ }))
      expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
      // The question names the row; Cancel builds nothing.
      fireEvent.click(button)
      const ask = await screen.findByRole('alertdialog')
      expect(ask.textContent).toContain('This row has no cut sheet yet: FCO. The cover will read cut sheet to follow for it.')
      fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
      expect(state.packageCalls).toEqual([])
      fireEvent.click(screen.getByTestId('build-package'))
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Build package' }))
      await waitFor(() => expect(state.packageCalls).toEqual([{ files: 1, sheets: ['DWH-1'] }]))
      // Built: Share is the next step, and its button is live.
      await waitFor(() => expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(false))
      expect(screen.getByTestId('submittal-journey').textContent).toContain('The package is built. 1 row in it reads cut sheet to follow. Tap Share to get a link for the GC.')
      expect(screen.getByTestId('build-package').textContent).toBe('Rebuild package · 1 cut sheet to follow')
    } finally {
      save.restore()
      state.noSources = false
    }
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
    // Step 6 says where it stands and who answered, in plain words.
    expect((await screen.findByTestId('decisions-line')).textContent).toContain('1sent back')
    expect(screen.getByTestId('their-call-who').textContent).toBe('Dana Whitfield answered. Wendi typed the answers in on Sep 17.')
    const rows = await screen.findAllByTestId('submittal-row')
    expect(rows[0]!.textContent).toContain('Dana Whitfield · entered by Wendi')
  })

  it('a submittal approved whole takes one entry: every row with no call and a product reads Approved on the day given, a row with a call keeps it, a Missing row is left out', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'a-wc', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT708UVG#01', status: 'as_specified' }),
      item({ id: 'a-dwh', tag: 'DWH-1', sequence_order: 2, submitted_label: 'BRADFORD WHITE RE2HP50', status: 'proposed' }),
      item({ id: 'a-lav', tag: 'LAV-1', sequence_order: 3, submitted_label: 'KOHLER K-2035', status: 'alternate', review_decision: 'revise', review_note: 'wall hung', reviewed_by_name: 'Dana Whitfield', reviewed_at: '2026-09-17T15:00:00Z' }),
      item({ id: 'a-prv', tag: 'PRV-1', sequence_order: 4, status: 'missing' }),
    ]
    state.writes = []
    state.noRoom = true
    mount()
    await screen.findAllByTestId('submittal-row')
    // v2.4581 · the door sits on the procurement log's Next line.
    const door = await screen.findByTestId('procurement-enter-approval')
    expect(screen.getByTestId('procurement-next').textContent).toContain('Approved outside the app? Enter their approval…')
    // The same door sits under Their call, a step a draft has not reached: its title opens it.
    fireEvent.click(screen.getByRole('button', { name: /6 · Their call/ }))
    // 2026-10-03 · one row already has an answer, so the entry is for the others.
    expect(screen.getByTestId('approve-all-open').textContent).toBe('Mark all 2 approved…')
    // The two waiting fixtures are named, each a door to Their answer; the one with no product is set apart.
    expect(screen.getAllByTestId('waiting-fixture').map((b) => b.textContent)).toEqual(['WC-1', 'DWH-1'])
    expect(screen.getByTestId('their-call-no-product').textContent).toContain('PRV-1 has no product yet')
    fireEvent.click(door)
    const dialog = await screen.findByRole('dialog', { name: 'They approved Rev 1' })
    expect(within(dialog).getByTestId('approve-all-scope').textContent).toBe('This marks 2 rows Approved in one entry. 1 row already has a call and keeps it. 1 row has no product and is left out.')
    // Nobody is on the room yet, so the reviewer is typed; the button waits for a name and an email.
    expect((within(dialog).getByTestId('approve-all-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Reviewer name'), { target: { value: 'Dana Whitfield' } })
    fireEvent.change(within(dialog).getByLabelText('Reviewer email'), { target: { value: 'Dana@Arch.test' } })
    fireEvent.change(within(dialog).getByLabelText('Approved on'), { target: { value: '2026-09-12' } })
    fireEvent.change(within(dialog).getByLabelText('Their note'), { target: { value: 'approved as submitted' } })
    expect(within(dialog).getByTestId('approve-all-save').textContent).toBe('Approve 2 rows')
    fireEvent.click(within(dialog).getByTestId('approve-all-save'))
    await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittal_events')).toBe(true))
    // The room is minted (nothing is shared by that) and the reviewer joins it by name.
    expect(state.writes.find((w) => w.table === 'bid_submittal_rooms')!.payload).toMatchObject({ bid_id: 'b398', status: 'open' })
    expect(state.writes.find((w) => w.table === 'bid_submittal_people')!.payload).toMatchObject({ room_id: 'room-1', name: 'Dana Whitfield', email: 'dana@arch.test', how: 'named', may_decide: true })
    const upd = state.writes.find((w) => w.table === 'bid_submittal_items' && w.op === 'update')!
    expect(upd.filters).toContainEqual(['id:in', ['a-wc', 'a-dwh']])
    expect(upd.payload).toMatchObject({ review_decision: 'approved', review_note: 'approved as submitted', reviewed_by_name: 'Dana Whitfield', reviewed_by_person_id: 'person-new', reviewed_at: '2026-09-12T12:00:00.000Z', decision_source: 'entered', decision_entered_by: 'wendi', decision_entered_by_name: 'Wendi' })
    expect(state.writes.find((w) => w.table === 'bid_submittal_messages')!.payload).toMatchObject({ body: "from Dana Whitfield's file, entered by the office · 2 rows · 2 approve · dated Sep 12, 2026", tags: ['WC-1', 'DWH-1'], metadata: { whole: true, decided_on: '2026-09-12' } })
    expect(state.writes.find((w) => w.table === 'bid_submittal_events')!.payload).toMatchObject({ event_type: 'decided', metadata: { approved: 2, entered: true, whole: true, decided_on: '2026-09-12' } })
    // The rows read it, the one call that was there stays, and the door is gone.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state.items.find((r) => r.id === 'a-lav')).toMatchObject({ review_decision: 'revise', reviewed_by_name: 'Dana Whitfield' })
    expect(state.items.find((r) => r.id === 'a-prv')!.review_decision).toBeNull()
    await waitFor(() => expect(screen.queryByTestId('procurement-enter-approval')).toBeNull())
    const rows = screen.getAllByTestId('submittal-row')
    expect(rows.find((r) => r.textContent?.includes('WC-1'))!.textContent).toContain('Dana Whitfield · entered by Wendi · Sep 12')
    state.noRoom = false
  })

  it('2026-10-02 · Their answer on a row: one window, an answer per part, one Save; the reviewer is a name with no email and nothing is sent', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'p-wc', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT728CUVG#01 + TOTO TET2UB31#SS', status: 'proposed' }),
      item({ id: 'a-dwh', tag: 'DWH-1', sequence_order: 2, submitted_label: 'BRADFORD WHITE RE2HP50', status: 'proposed' }),
    ]
    state.parts = [
      { id: 'pt-bowl', item_id: 'p-wc', bid_id: 'b398', sequence_order: 1, label: 'TOTO CT728CUVG#01 TOILET', quantity: 1, on_submittal: true, sheet_pages: [], review_decision: null, decision_source: 'room' },
      { id: 'pt-valve', item_id: 'p-wc', bid_id: 'b398', sequence_order: 2, label: 'TOTO TET2UB31#SS', quantity: 1, on_submittal: true, sheet_pages: [], review_decision: null, decision_source: 'room' },
      { id: 'pt-stop', item_id: 'p-wc', bid_id: 'b398', sequence_order: 3, label: 'BRASSCRA PLB113XP ANG', quantity: 1, on_submittal: false, sheet_pages: [], review_decision: null, decision_source: 'room' },
    ]
    state.writes = []
    state.noRoom = true
    try {
      mount()
      await screen.findAllByTestId('submittal-row')
      // Every row has the door behind its ⋯ (v2.4687), on a draft too; the row editor no longer asks who or what.
      fireEvent.click(await screen.findByRole('button', { name: 'More for WC-1' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Their answer on WC-1' }))
      const dialog = await screen.findByRole('dialog', { name: 'Their answer on WC-1' })
      await waitFor(() => expect(within(dialog).getAllByTestId('answer-line')).toHaveLength(2))
      fireEvent.click(within(within(dialog).getByRole('group', { name: 'Their answer on TOTO TET2UB31#SS' })).getByRole('button', { name: 'Rejected' }))
      fireEvent.change(within(dialog).getByLabelText('Their note on TOTO TET2UB31#SS'), { target: { value: 'They want TET2UA31#SS' } })
      fireEvent.click(within(dialog).getByTestId('answer-all-approved'))
      fireEvent.change(within(dialog).getByLabelText('Who answered'), { target: { value: 'new' } })
      fireEvent.change(within(dialog).getByLabelText('Reviewer name'), { target: { value: 'Structura' } })
      expect(within(dialog).getByTestId('answer-save').textContent).toBe('Record 2 answers')
      fireEvent.click(within(dialog).getByTestId('answer-save'))
      await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittal_events')).toBe(true))
      // The reviewer joins the room by name alone.
      expect(state.writes.find((w) => w.table === 'bid_submittal_people')!.payload).toMatchObject({ room_id: 'room-1', name: 'Structura', email: null, how: 'named' })
      // Each answer is its own write on the parts it covers, in one save.
      const partWrites = state.writes.filter((w) => w.table === 'bid_submittal_item_parts' && w.op === 'update')
      expect(partWrites.map((w) => [w.filters.find((f) => f[0] === 'id:in')?.[1], (w.payload as Record<string, unknown>).review_decision, (w.payload as Record<string, unknown>).review_note])).toEqual([
        [['pt-bowl'], 'approved', null],
        [['pt-valve'], 'rejected', 'They want TET2UA31#SS'],
      ])
      expect(partWrites[1]!.payload).toMatchObject({ reviewed_by_name: 'Structura', reviewed_by_email: null, reviewed_by_person_id: 'person-new', decision_source: 'entered', decision_entered_by_name: 'Wendi' })
      // One line on the thread and one event for the whole save.
      expect(state.writes.filter((w) => w.table === 'bid_submittal_messages')).toHaveLength(1)
      expect(state.writes.find((w) => w.table === 'bid_submittal_messages')!.payload).toMatchObject({ tags: ['WC-1'], metadata: { counts: { approved: 1, revise: 0, rejected: 1 } } })
      expect(state.writes.filter((w) => w.table === 'bid_submittal_events')).toHaveLength(1)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(state.parts.find((p) => p.id === 'pt-valve')).toMatchObject({ review_decision: 'rejected' })
      expect(state.parts.find((p) => p.id === 'pt-stop')!.review_decision).toBeNull()
      // The row editor reads the answer in one line and holds the door to the same window.
      fireEvent.click(screen.getByRole('button', { name: 'Edit WC-1' }))
      const edit = await screen.findByRole('dialog', { name: 'Edit WC-1' })
      expect(within(edit).getByTestId('their-answer-line').textContent).toContain('1 approved · 1 rejected')
      fireEvent.click(within(edit).getByTestId('their-answer-open'))
      expect(await screen.findByRole('dialog', { name: 'Their answer on WC-1' })).toBeTruthy()
      expect(screen.queryByRole('dialog', { name: 'Edit WC-1' })).toBeNull()
    } finally {
      state.parts = []
      state.noRoom = false
    }
  })

  it('2026-10-01 · approved whole: a row with parts takes the approval on every part the GC sees with no call, and reads the roll-up; a row without parts as before', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'shared', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: '2026-09-20T00:00:00Z', created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'p-wc', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT728CUVG#01 + TOTO TET2LBI31#SS', status: 'proposed' }),
      item({ id: 'a-dwh', tag: 'DWH-1', sequence_order: 2, submitted_label: 'BRADFORD WHITE RE2HP50', status: 'proposed' }),
    ]
    state.parts = [
      { id: 'pt-bowl', item_id: 'p-wc', bid_id: 'b398', sequence_order: 1, label: 'TOTO CT728CUVG#01 TOILET', quantity: 1, on_submittal: true, sheet_pages: [], review_decision: 'approved', reviewed_by_name: 'Dana Whitfield', reviewed_at: '2026-09-21T15:00:00Z', decision_source: 'room' },
      { id: 'pt-valve', item_id: 'p-wc', bid_id: 'b398', sequence_order: 2, label: 'TOTO TET2LBI31#SS', quantity: 1, on_submittal: true, sheet_pages: [], review_decision: null, decision_source: 'room' },
      { id: 'pt-stop', item_id: 'p-wc', bid_id: 'b398', sequence_order: 3, label: 'BRASSCRA PLB113XP ANG', quantity: 1, on_submittal: false, sheet_pages: [], review_decision: null, decision_source: 'room' },
    ]
    state.writes = []
    state.noRoom = true
    try {
      mount()
      await screen.findAllByTestId('submittal-row')
      // The row with parts shows each part's call, and the count of calls over its parts.
      await waitFor(() => expect(screen.getAllByTestId('row-part-call').map((e) => e.textContent)).toEqual(['Approved']))
      // 2026-10-03 · the cell counts in the office's words: one of two approved, one with no answer yet.
      expect(screen.getAllByTestId('their-call-head')[0]!.textContent).toBe('1 of 2 approved')
      expect(screen.getAllByTestId('their-call-parts')[0]!.textContent).toBe('1 with no answer yet')
      fireEvent.click(screen.getByTestId('approve-all-open'))
      const dialog = await screen.findByRole('dialog', { name: 'They approved Rev 1' })
      fireEvent.change(within(dialog).getByLabelText('Reviewer name'), { target: { value: 'Dana Whitfield' } })
      fireEvent.change(within(dialog).getByLabelText('Reviewer email'), { target: { value: 'dana@arch.test' } })
      fireEvent.click(within(dialog).getByTestId('approve-all-save'))
      await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittal_events')).toBe(true))
      const partUpd = state.writes.find((w) => w.table === 'bid_submittal_item_parts' && w.op === 'update')!
      expect(partUpd.filters).toContainEqual(['id:in', ['pt-valve']])
      expect(partUpd.payload).toMatchObject({ review_decision: 'approved', decision_source: 'entered' })
      expect(state.parts.find((p) => p.id === 'pt-stop')!.review_decision).toBeNull()
      // The row reads the roll-up: every part the GC sees is approved now.
      expect(state.items.find((r) => r.id === 'p-wc')).toMatchObject({ review_decision: 'approved' })
      const rowUpd = state.writes.filter((w) => w.table === 'bid_submittal_items' && w.op === 'update').find((w) => w.filters.some((f) => f[0] === 'id:in'))!
      expect(rowUpd.filters).toContainEqual(['id:in', ['a-dwh']])
    } finally {
      state.parts = []
      state.noRoom = false
    }
  })

  it('2026-10-01 · Read its parts: the house’s file sits beside the rows; Use the file’s parts rewrites the parts it pairs, adds the rest, takes off what the estimator says, and gives the row the file’s pages', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [{ path: 'b398/rev-1/0.pdf', house_id: null, house_name: null, name: 'SPACEX BA-2 CORE & SHELL.pdf', pages: 75, trimmed_at: null, dropped_pages: null, names_rows: 12, sectioned: true }] }]
    state.items = [item({ id: 'lav2', tag: 'LAV-2', sequence_order: 1, submitted_label: 'KOHLER 2215-0 LADENA WHITE + TOTO T25S51E#CP + BOBRICK B-8236', status: 'proposed', supply_house_id: null })]
    state.parts = [
      { id: 'pt-kohler', item_id: 'lav2', bid_id: 'b398', sequence_order: 1, label: 'KOHLER 2215-0 LADENA WHITE', quantity: 1, on_submittal: true, sheet_pages: [], procure_key: 'k1', decision_source: 'room' },
      { id: 'pt-t25', item_id: 'lav2', bid_id: 'b398', sequence_order: 2, label: 'TOTO T25S51E#CP', quantity: 1, on_submittal: true, sheet_pages: [], procure_key: 'k2', decision_source: 'room' },
      { id: 'pt-soap', item_id: 'lav2', bid_id: 'b398', sequence_order: 3, label: 'BOBRICK B-8236', quantity: 1, on_submittal: true, sheet_pages: [], procure_key: 'k3', decision_source: 'room' },
      { id: 'pt-flange', item_id: 'lav2', bid_id: 'b398', sequence_order: 4, label: 'MAINLINE ML90105 POLISHED CHROME FLANGE', quantity: 2, on_submittal: false, sheet_pages: [], procure_key: 'k4', decision_source: 'room' },
    ]
    state.writes = []
    try {
      mount()
      await screen.findAllByTestId('submittal-row')
      fireEvent.click(await screen.findByTestId('read-parts-open'))
      const dialog = await screen.findByRole('dialog', { name: 'What SPACEX BA-2 CORE & SHELL.pdf says' })
      // Only the LAV-2 card is used here; every other tag is switched off.
      for (const card of within(dialog).getAllByTestId('house-file-tag')) if (!card.textContent?.startsWith('LAV-2')) fireEvent.click(within(card).getAllByRole('checkbox')[0]!)
      const lav = within(dialog).getAllByTestId('house-file-tag').find((c) => c.textContent?.startsWith('LAV-2'))!
      fireEvent.change(within(within(lav).getAllByTestId('house-file-part')[0]!).getByRole('combobox'), { target: { value: 'pt-kohler' } })
      expect(within(dialog).getByTestId('house-file-apply').textContent).toBe('Use the file’s parts on 1 row')
      fireEvent.click(within(dialog).getByTestId('house-file-apply'))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /says/ })).toBeNull())
      // The Kohler is rewritten as the Sloan, the takeoff's name kept as what was priced; the soap dispenser is the same part, now with its pages.
      expect(state.parts.find((p) => p.id === 'pt-kohler')).toMatchObject({ label: 'SLOAN 3873021 VITREOUS CHINA UNDERMOUNT LAVATORY', priced_label: 'KOHLER 2215-0 LADENA WHITE', source: 'file', sheet_file: 0, sheet_pages: [49, 50], on_submittal: true })
      expect(state.parts.find((p) => p.id === 'pt-soap')).toMatchObject({ model: 'B-8236', sheet_pages: [53] })
      // The T25S51E the file does not carry is taken off; the flange is kept, order only, after the file's parts.
      expect(state.writes.find((w) => w.table === 'bid_submittal_item_parts' && w.op === 'delete')!.filters).toContainEqual(['id:in', ['pt-t25']])
      expect(state.parts.find((p) => p.id === 'pt-flange')).toMatchObject({ on_submittal: false, sequence_order: 8 })
      const inserted = state.writes.find((w) => w.table === 'bid_submittal_item_parts' && w.op === 'insert')!.payload as Array<Record<string, unknown>>
      expect(inserted.map((p) => p.model)).toEqual(['TLE25006U1#CP', 'Z8743-PC', 'Z8802XL-LR-PC', 'Z8700-8B-PC', '170D-LF'])
      // The row's sheet is every page the file's parts use.
      const rowUpd = state.writes.filter((w) => w.table === 'bid_submittal_items' && w.op === 'update').pop()!
      expect(rowUpd.payload).toMatchObject({ sheet_file: 0, sheet_pages: [49, 50, 51, 52, 53, 54, 55, 56, 57, 58], sheet_source: 'house' })
    } finally {
      state.parts = []
    }
  })

  it('v2.4366 · on a draft the takeoff has moved past, the walkthrough stops on the blue box between Fix the rows and Add the cut sheets', async () => {
    if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [item({ id: 'wh', tag: 'DWH-1, ET', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199 WATER HEATER', status: 'proposed', source_count_row_id: 'c-wh' })]
    state.parts = []
    state.takeoff = true
    try {
      mount()
      await screen.findByTestId('draft-catch-up')
      fireEvent.click(screen.getByRole('button', { name: 'How this page works' }))
      const titles: string[] = []
      for (let i = 0; i < 14; i++) {
        const dialog = screen.queryByRole('dialog')
        if (!dialog) break
        const title = dialog.getAttribute('aria-label') ?? ''
        if (titles.includes(title)) break
        titles.push(title)
        if (title === 'Step 3. Catch a draft up') {
          // Its anchor is on the page, so it is a real stop, not a centred card.
          expect(within(dialog).queryByTestId('tour-missing')).toBeNull()
          expect(dialog.textContent).toContain('Tap Refresh from the takeoff to bring in the new parts.')
        }
        const next = within(dialog).queryByRole('button', { name: 'Next →' })
        if (!next) break
        fireEvent.click(next)
      }
      const at = titles.indexOf('Step 3. Catch a draft up')
      expect(at).toBeGreaterThan(0)
      expect(titles[at - 1]).toBe('Step 3. Fix the rows')
      expect(titles[at + 1]).toBe('Step 3. Add the cut sheets')
    } finally {
      state.takeoff = false
    }
  })

  it('2026-10-01 · a draft catching up: a takeoff row built before parts reads differently; Refresh from the takeoff writes its parts and leaves a row that reads the same', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [
      item({ id: 'wh', tag: 'DWH-1, ET', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199 WATER HEATER', status: 'proposed', source_count_row_id: 'c-wh' }),
      item({ id: 'wc', tag: 'WC-1, WC-2', sequence_order: 2, submitted_label: 'TOTO CT708UVG#01 WALL HUNG BOWL', status: 'proposed', source_count_row_id: 'c-wc' }),
    ]
    state.parts = [{ id: 'pt-wc', item_id: 'wc', bid_id: 'b398', sequence_order: 1, label: 'TOTO CT708UVG#01 WALL HUNG BOWL', quantity: 1, on_submittal: true, source: 'takeoff', source_line_id: null, source_template_item_id: null, sheet_pages: [], procure_key: 'k-wc', decision_source: 'room' }]
    state.takeoff = true
    state.writes = []
    try {
      mount()
      const strip = await screen.findByTestId('draft-catch-up')
      await waitFor(() => expect(strip.textContent).toContain('The takeoff reads differently for DWH-1, ET.'))
      fireEvent.click(within(strip).getByTestId('refresh-from-takeoff'))
      const dialog = await screen.findByRole('dialog', { name: 'Refresh from the takeoff' })
      expect(within(dialog).getAllByTestId('refresh-row')).toHaveLength(1)
      expect(within(dialog).getByTestId('refresh-skipped').textContent).toBe('WC-1, WC-2 reads the same as the takeoff.')
      fireEvent.click(within(dialog).getByTestId('refresh-confirm'))
      await waitFor(() => expect(state.parts.filter((p) => p.item_id === 'wh')).toHaveLength(1))
      expect(state.parts.find((p) => p.item_id === 'wh')).toMatchObject({ source: 'takeoff', on_submittal: true })
      expect(String(state.parts.find((p) => p.item_id === 'wh')!.label)).toContain('BTH-199')
      // The row that read the same is not touched.
      expect(state.writes.some((w) => w.table === 'bid_submittal_item_parts' && w.op !== 'insert')).toBe(false)
    } finally {
      state.parts = []
      state.takeoff = false
    }
  })

  it('2026-10-02 · a Procure line opens its row’s Edit window over the log, on the part tapped; what is changed there is saved on that part', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [item({ id: 'dwh', tag: 'DWH-1', sequence_order: 1, submitted_label: 'RHEEM PROPH40 + WATTS LFN36M1', status: 'proposed', supply_house_id: null })]
    state.parts = [
      { id: 'pt-rheem', item_id: 'dwh', bid_id: 'b398', sequence_order: 1, label: 'RHEEM PROPH40-T2-RH400-SO', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-rheem', decision_source: 'room', supply_house_id: null },
      { id: 'pt-watts', item_id: 'dwh', bid_id: 'b398', sequence_order: 2, label: 'WATTS LFN36M1 0556031 VACUUM RELIEF VALVE', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-watts', decision_source: 'room', supply_house_id: null },
    ]
    state.writes = []
    // By tag lists every line (To order folds the waiting ones by house since 2026-10-02).
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    try {
      mount()
      const door = await waitFor(() => {
        // The part's own line, once the parts are read (before that the row reads as one line).
        const d = screen.getAllByTestId('procurement-open-row').find((b) => b.textContent?.includes('WATTS LFN36M1') && b.getAttribute('title')?.includes('this part'))
        if (!d) throw new Error('no line yet')
        return d
      })
      fireEvent.click(door)
      const dialog = await screen.findByRole('dialog', { name: 'Edit DWH-1' })
      const ringed = within(dialog).getAllByTestId('part-editor-row').filter((r) => r.getAttribute('data-focused') === 'true')
      expect(ringed).toHaveLength(1)
      expect((ringed[0]!.querySelector('input[aria-label="Part 2"]') as HTMLInputElement).value).toBe('WATTS LFN36M1 0556031 VACUUM RELIEF VALVE')
      // No houses on this bid's list here, so the part's lead time box is the one made ready.
      expect(document.activeElement).toBe(within(dialog).getByLabelText('Lead time for part 2'))
      fireEvent.change(within(dialog).getByLabelText('Lead time for part 2'), { target: { value: '2 wk' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit DWH-1' })).toBeNull())
      expect(state.parts.find((p) => p.id === 'pt-watts')).toMatchObject({ lead_time_days: 14 })
      // The tag was not touched, so it is not rewritten.
      expect(state.writes.filter((w) => w.table === 'bid_submittal_items' && w.op === 'update').some((w) => 'tag' in (w.payload as Record<string, unknown>))).toBe(false)
      // Opened from the rows table, the same window has no part ringed.
      fireEvent.click(screen.getByRole('button', { name: 'Edit DWH-1' }))
      const again = await screen.findByRole('dialog', { name: 'Edit DWH-1' })
      expect(within(again).getAllByTestId('part-editor-row').some((r) => r.getAttribute('data-focused') === 'true')).toBe(false)
    } finally {
      state.parts = []
      localStorage.removeItem('submittals_procure_lens')
    }
  })

  it('2026-10-02 · a Procure line still held by the GC opens the row’s Their answer window on that part; once answered, the line has no door', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [item({ id: 'dwh', tag: 'DWH-1', sequence_order: 1, submitted_label: 'RHEEM PROPH40 + WATTS LFN36M1', status: 'proposed', supply_house_id: null })]
    state.parts = [
      { id: 'pt-rheem', item_id: 'dwh', bid_id: 'b398', sequence_order: 1, label: 'RHEEM PROPH40-T2-RH400-SO', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-rheem', decision_source: 'room', review_decision: null, supply_house_id: null },
      { id: 'pt-watts', item_id: 'dwh', bid_id: 'b398', sequence_order: 2, label: 'WATTS LFN36M1 0556031 VACUUM RELIEF VALVE', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-watts', decision_source: 'room', review_decision: null, supply_house_id: null },
    ]
    state.writes = []
    state.noRoom = true
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    try {
      mount()
      const door = await waitFor(() => {
        // The part's own door, once the parts are read (before that the row reads as one line).
        const d = screen.queryByRole('button', { name: 'Enter their answer on DWH-1 WATTS LFN36M1' })
        if (!d) throw new Error('no door yet')
        return d
      })
      expect(door.textContent).toBe('Enter their answer…')
      fireEvent.click(door)
      const dialog = await screen.findByRole('dialog', { name: 'Their answer on DWH-1' })
      // The part tapped is ringed, and its first answer has the keyboard.
      const ringed = within(dialog).getAllByTestId('answer-line').filter((l) => l.getAttribute('data-focused') === 'true')
      expect(ringed).toHaveLength(1)
      expect(ringed[0]!.textContent).toContain('WATTS LFN36M1')
      const approve = within(within(dialog).getByRole('group', { name: 'Their answer on WATTS LFN36M1' })).getByRole('button', { name: 'Approved' })
      expect(document.activeElement).toBe(approve)
      fireEvent.click(approve)
      fireEvent.change(within(dialog).getByLabelText('Reviewer name'), { target: { value: 'Structura' } })
      fireEvent.click(within(dialog).getByTestId('answer-save'))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Their answer on DWH-1' })).toBeNull())
      expect(state.parts.find((p) => p.id === 'pt-watts')).toMatchObject({ review_decision: 'approved', reviewed_by_name: 'Structura', decision_source: 'entered' })
      expect(state.parts.find((p) => p.id === 'pt-rheem')!.review_decision).toBeNull()
      // The answered part is released, so its line loses the door; the other part still waits and keeps it.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Enter their answer on DWH-1 WATTS LFN36M1' })).toBeNull())
      expect(screen.getByRole('button', { name: 'Enter their answer on DWH-1 RHEEM PROPH40-T2-RH400-SO' })).toBeTruthy()
      // From the row's own door, behind its ⋯ (v2.4687), the same window opens with no part ringed.
      fireEvent.click(screen.getByRole('button', { name: 'More for DWH-1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Their answer on DWH-1' }))
      const again = await screen.findByRole('dialog', { name: 'Their answer on DWH-1' })
      expect(within(again).getAllByTestId('answer-line').some((l) => l.getAttribute('data-focused') === 'true')).toBe(false)
    } finally {
      state.parts = []
      state.noRoom = false
      localStorage.removeItem('submittals_procure_lens')
    }
  })

  it('2026-10-02 · a fixture listing two carriers says so; Make it a part takes the place of the takeoff’s carrier, at Rough In', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [
      item({ id: 'wc', tag: 'WC-1, WC-2', sequence_order: 1, submitted_label: 'TOTO CT728CUVG#01 + ZURN Z1201', status: 'proposed', source_count_row_id: 'c-wc' }),
      item({ id: 'car', tag: 'WC CARRIER', sequence_order: 2, submitted_label: 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', status: 'accessory', reason_note: 'Carrier for WC-1 and WC-2.', supply_house_id: 'h-nws' }),
      item({ id: 'ur', tag: 'UR-1', sequence_order: 3, submitted_label: 'TOTO UT105UVG#01', status: 'proposed' }),
    ]
    state.parts = [
      { id: 'pt-bowl', item_id: 'wc', bid_id: 'b398', sequence_order: 1, label: 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-bowl', decision_source: 'room' },
      { id: 'pt-zurn', item_id: 'wc', bid_id: 'b398', sequence_order: 2, label: 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', quantity: 1, on_submittal: true, source: 'takeoff', sheet_pages: [], procure_key: 'k-zurn', decision_source: 'room' },
      { id: 'pt-u1', item_id: 'ur', bid_id: 'b398', sequence_order: 1, label: 'TOTO UT105UVG#01', quantity: 1, on_submittal: true, source: 'hand', sheet_pages: [], procure_key: 'k-u1', decision_source: 'room' },
      { id: 'pt-u2', item_id: 'ur', bid_id: 'b398', sequence_order: 2, label: 'ZURN Z1222 URINAL CARRIER', quantity: 1, on_submittal: true, source: 'hand', sheet_pages: [], procure_key: 'k-u2', decision_source: 'room' },
      { id: 'pt-u3', item_id: 'ur', bid_id: 'b398', sequence_order: 3, label: 'JOSAM 17560-UR floor mount urinal carrier', quantity: 1, on_submittal: true, source: 'hand', sheet_pages: [], procure_key: 'k-u3', decision_source: 'room' },
    ]
    state.writes = []
    try {
      mount()
      // UR-1 already lists two carriers: the row says so.
      await waitFor(() => expect(screen.getAllByTestId('row-two-carriers')).toHaveLength(1))
      const hint = await screen.findByTestId('fold-hint')
      fireEvent.click(within(hint).getByTestId('fold-hint-open'))
      const dialog = await screen.findByRole('dialog', { name: 'Make WC CARRIER a part of another row' })
      expect((within(dialog).getByTestId('fold-replace') as HTMLSelectElement).value).toBe('pt-zurn')
      fireEvent.click(within(dialog).getByTestId('fold-confirm'))
      await waitFor(() => expect(state.items.some((r) => r.id === 'car')).toBe(false))
      const wcParts = state.parts.filter((p) => p.item_id === 'wc').sort((a, b) => (a.sequence_order as number) - (b.sequence_order as number))
      expect(wcParts.map((p) => [p.label, p.sequence_order])).toEqual([['TOTO CT728CUVG#01 TORNADO FLUSH TOILET', 1], ['JOSAM 12694 4" NH double adjustable horizontal closet carrier', 2]])
      expect(wcParts[1]).toMatchObject({ priced_label: 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', stage: 'rough_in', supply_house_id: 'h-nws' })
      expect(state.writes.find((w) => w.table === 'bid_submittal_item_parts' && w.op === 'delete')!.filters).toContainEqual(['id:in', ['pt-zurn']])
    } finally {
      state.parts = []
    }
  })

  it('2026-10-01 · a draft catching up: a hand row whose note names another row reads like its part; Make it a part folds it in as a part and the row leaves', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, shared_at: null, created_at: '2026-09-15T00:00:00Z', source_files: [] }]
    state.items = [
      item({ id: 'wc', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT708UVG', status: 'proposed', lead_time_days: 14 }),
      item({ id: 'car', tag: 'CAR-1', sequence_order: 2, submitted_label: 'JOSAM 12674 CARRIER', status: 'accessory', reason_note: 'Carrier for WC-1.', lead_time_days: 21, sheet_pages: [40] }),
    ]
    state.parts = []
    state.writes = []
    try {
      mount()
      const hint = await screen.findByTestId('fold-hint')
      expect(hint.textContent).toBe('CAR-1 reads like a part of WC-1.Make it a part…')
      // The hand row carries its own door too; the fixture with a product does not.
      // Part of… sits behind each draft row's ⋯.
      for (const more of screen.getAllByTestId('row-more')) fireEvent.click(more)
      expect(screen.getAllByTestId('fold-row')).toHaveLength(2)
      fireEvent.click(within(hint).getByTestId('fold-hint-open'))
      const dialog = await screen.findByRole('dialog', { name: 'Make CAR-1 a part of another row' })
      expect(within(dialog).getByTestId('fold-preview').textContent).toContain('WC-1 will list for the GC: TOTO CT708UVG + JOSAM 12674.')
      fireEvent.click(within(dialog).getByTestId('fold-confirm'))
      await waitFor(() => expect(state.items.some((r) => r.id === 'car')).toBe(false))
      // WC-1 lists its own product first, then the carrier with its house, lead time and pages.
      const wcParts = state.parts.filter((p) => p.item_id === 'wc').sort((a, b) => (a.sequence_order as number) - (b.sequence_order as number))
      expect(wcParts.map((p) => [p.label, p.source, p.on_submittal])).toEqual([['TOTO CT708UVG', 'hand', true], ['JOSAM 12674 CARRIER', 'hand', true]])
      expect(wcParts[1]).toMatchObject({ lead_time_days: 21, sheet_pages: [40], supply_house_id: 'h-nws' })
      // The row reads its parts: the longest lead time.
      const rollUp = state.writes.find((w) => w.table === 'bid_submittal_items' && w.op === 'update' && (w.payload as Record<string, unknown>).lead_time_days === 21)
      expect(rollUp?.filters).toContainEqual(['id', 'wc'])
      await waitFor(() => expect(screen.queryByTestId('fold-hint')).toBeNull())
    } finally {
      state.parts = []
    }
  })

  it('6b · a ready schedule read lists the sure and want-a-look tags; Confirm keeps the chosen tags and drops the rest', async () => {
    state.revisions = []
    state.items = []
    state.tasks = [{ id: 'task-1', bid_id: 'b398', submittal_id: null, kind: 'read_schedule', input: {}, result: { rows: [{ tag: 'WC-1', fixture: 'water closet', manufacturer: 'TOTO', model: 'CT708UVG#01', confidence: 0.95 }, { tag: 'HB-3', model: 'B74-CH', confidence: 0.4 }] }, status: 'ready', requested_at: '2026-09-17T10:00:00Z', claimed_at: null, finished_at: '2026-09-17T10:05:00Z', reviewed_at: null, summary: 'Read P002.' }]
    mount()
    // v2.4109 · the state sits in the schedule card; the tags to confirm sit under the cards.
    const card = await screen.findByTestId('robot-schedule')
    expect(within(card).getByTestId('robot-schedule-chip').textContent).toBe('🤖 Read 2 tags · confirm below')
    fireEvent.mouseEnter(card)
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
      // The header no longer repeats step 1: the takeoff's count and its door are on the takeoff card below.
      expect(document.querySelector('[data-tour="submittals-source"]')?.textContent).toBe('Submittals · plumbing fixtures & equipment · no submittal on this bid yet')
      expect(screen.getByTestId('journey-next').textContent).toBe('Next: The takeoff has 4 fixtures. 3 of them have a part. Pick what the GC sees, then build Rev 1 from them. You can type the plans’ schedule later. Then each row is checked against it.Choose from the takeoff')
      expect(screen.getByTestId('source-takeoff').textContent).toContain('The takeoff · 4 fixtures, 3 with a part')
      expect(screen.getByTestId('choose-from-takeoff').textContent).toBe('Choose from the takeoff')
      // v2.4109 · no picks → no picks card; the robot's offer is a line in the schedule card.
      expect(screen.queryByTestId('source-picks')).toBeNull()
      expect(screen.getByTestId('ask-robot-schedule').textContent).toBe('Ask the robot to read the schedule')
      expect(screen.queryByRole('button', { name: /Build Rev 1 from/ })).toBeNull()
      fireEvent.click(screen.getByTestId('build-from-takeoff'))
      const picker = await screen.findByRole('dialog', { name: 'Choose from the takeoff' })
      // Fixtures and equipment ticked; the unpriced sink and the pipe not.
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('2 rows go on Rev 1')
      expect(within(picker).getByTestId('takeoff-group-fixtures').textContent).toContain('Reece')
      fireEvent.click(within(within(picker).getByRole('group', { name: 'UTILITY SINK' })).getByRole('button', { name: 'GC sees it' }))
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('3 rows go on Rev 1 (1 to type with Edit)')
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
      // Parts, not assemblies (2026-10-01): each row carries its fixture's parts; the sink has none yet.
      const partWrites = state.writes.find((w) => w.op === 'insert' && w.table === 'bid_submittal_item_parts')!.payload as Record<string, unknown>[]
      expect(partWrites.map((r) => [r.item_id, r.label, r.on_submittal, r.supply_house_id, r.bid_id])).toEqual([
        ['it-1', 'A.O. Smith BTH-199 WATER HEATER', true, null, 'b398'],
        ['it-2', 'TOTO CT708UVG#01 WALL HUNG BOWL', true, 'h-reece', 'b398'],
      ])
      const ticks = state.writes.find((w) => w.op === 'upsert')!.payload as Array<{ count_row_id: string; ticked: boolean }>
      expect(ticks.map((t) => [t.count_row_id, t.ticked])).toEqual([['c-wh', true], ['c-wc', true], ['c-us', true], ['c-pipe', false]])
      // The built revision: three rows, the picker gone, the source line now reads the takeoff as done.
      expect(await screen.findByTestId('revision-line')).toBeTruthy()
      expect(screen.getAllByTestId('submittal-row')).toHaveLength(3)
      await waitFor(() => expect(screen.getAllByTestId('row-part').map((p) => p.textContent)).toEqual(['A.O. Smith BTH-199WATER HEATER', 'TOTO CT708UVG#01WALL HUNG BOWL']))
      expect(screen.queryByRole('dialog', { name: 'Choose from the takeoff' })).toBeNull()
      expect(screen.getByTestId('add-from-takeoff').textContent).toBe('Choose what the GC sees…')
      // × on the sink: off the draft, and unticked on the takeoff list.
      state.writes = []
      fireEvent.click(screen.getByRole('button', { name: 'More for UTILITY SINK' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove UTILITY SINK' }))
      // 2026-10-02 · the × asks whether the fixture is still bought; Left out is what it did before.
      const takeOff = await screen.findByRole('dialog', { name: 'Take UTILITY SINK off the submittal' })
      expect(takeOff.textContent).toContain('The GC will not see it. Do you still buy it?')
      fireEvent.click(within(takeOff).getByTestId('take-off-leave-out'))
      await waitFor(() => expect(state.writes.some((w) => w.op === 'upsert')).toBe(true))
      expect(state.writes.find((w) => w.op === 'delete')!.filters).toEqual([['id', 'it-3']])
      expect(state.writes.find((w) => w.op === 'upsert')!.payload).toEqual([{ bid_id: 'b398', count_row_id: 'c-us', ticked: false }])
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(2))
    } finally {
      state.noSources = false
      state.takeoff = false
    }
  })

  it('2026-10-02 · Order only: the × asks, the row leaves the GC’s rows for its own group and the counts, the bid remembers it, and Put on the submittal brings it back', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199', status: 'proposed', source_count_row_id: 'c-wh' }),
      item({ id: 'it-2', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed', source_count_row_id: 'c-wc' }),
      item({ id: 'it-3', tag: 'WHA-200', sequence_order: 3, submitted_label: 'ZURN Z1700-200-OV', status: 'proposed' }),
    ]
    state.writes = []
    state.tasks = []
    state.parts = []
    state.procRecords = []
    try {
      mount()
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(3))
      expect(screen.queryByTestId('order-only-heading')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'More for FCO' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove FCO' }))
      const takeOff = await screen.findByRole('dialog', { name: 'Take FCO off the submittal' })
      // Nothing is bought yet, so both answers are open.
      expect((within(takeOff).getByTestId('take-off-leave-out') as HTMLButtonElement).disabled).toBe(false)
      fireEvent.click(within(takeOff).getByTestId('take-off-order-only'))
      await waitFor(() => expect(screen.getAllByTestId('order-only-row')).toHaveLength(1))
      // The row is kept, flagged; the bid remembers the fixture as ticked and order only.
      expect(state.writes.some((w) => w.op === 'delete')).toBe(false)
      expect(state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toMatchObject({ payload: { order_only: true }, filters: [['id', 'it-2']] })
      expect(state.writes.find((w) => w.op === 'upsert')!.payload).toEqual([{ bid_id: 'b398', count_row_id: 'c-wc', ticked: true, order_only: true }])
      // Two rows for the GC; FCO sits under its own heading with its product and no status to ask.
      expect(screen.getAllByTestId('submittal-row').map((r) => r.textContent)).toHaveLength(2)
      expect(screen.getByTestId('order-only-heading').textContent).toContain('Order only · 1 fixture · you buy it, the GC does not see it')
      expect(screen.getByTestId('order-only-row').textContent).toContain('FCO')
      expect(screen.getByTestId('order-only-row').textContent).toContain('ZURN ZN1400-2NL')
      expect(screen.queryByRole('dialog', { name: 'Take FCO off the submittal' })).toBeNull()
      // Its Edit window asks nothing the GC would read.
      fireEvent.click(screen.getByRole('button', { name: 'Edit FCO' }))
      const edit = await screen.findByRole('dialog', { name: 'Edit FCO' })
      expect(within(edit).getByTestId('edit-order-only').textContent).toBe('Order only · the GC does not see it')
      expect(within(edit).queryByLabelText('Note')).toBeNull()
      expect(within(edit).queryByRole('button', { name: 'As specified' })).toBeNull()
      fireEvent.click(within(edit).getByRole('button', { name: 'Cancel' }))
      // Back onto the submittal.
      state.writes = []
      fireEvent.click(screen.getByRole('button', { name: 'Put FCO on the submittal' }))
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(3))
      expect(state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toMatchObject({ payload: { order_only: false }, filters: [['id', 'it-2']] })
      expect(state.writes.find((w) => w.op === 'upsert')!.payload).toEqual([{ bid_id: 'b398', count_row_id: 'c-wc', ticked: true, order_only: false }])
      expect(screen.queryByTestId('order-only-heading')).toBeNull()
    } finally {
      state.procRecords = []
    }
  })

  it('2026-10-02 · a fixture the log holds an order for cannot be left out: the window says why, and Order only is still open', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'EWC-1', sequence_order: 1, submitted_label: 'ELKAY LZSTL8WSLK', status: 'proposed' }),
      item({ id: 'it-2', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed', order_only: true }),
    ]
    state.writes = []
    state.tasks = []
    state.parts = []
    state.procRecords = [{ id: 'pr-1', bid_id: 'b398', tag: 'EWC-1', ordered_on: '2026-09-23', delivered_on: '2026-09-29', po_ref: 'space x carriers', sort_order: 1, label: '' }]
    try {
      mount()
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(1))
      // A row stored order only reads in its group from the first load.
      expect(screen.getAllByTestId('order-only-row')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'More for EWC-1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove EWC-1' }))
      const takeOff = await screen.findByRole('dialog', { name: 'Take EWC-1 off the submittal' })
      const out = within(takeOff).getByTestId('take-off-leave-out') as HTMLButtonElement
      expect(out.disabled).toBe(true)
      expect(out.textContent).toContain('Ordered 09/23, on site 09/29. It cannot be left out.')
      expect((within(takeOff).getByTestId('take-off-order-only') as HTMLButtonElement).disabled).toBe(false)
      fireEvent.click(within(takeOff).getByRole('button', { name: 'Cancel' }))
      expect(state.writes).toEqual([])
    } finally {
      state.procRecords = []
    }
  })

  it('2026-10-02 · Choose what the GC sees… on a draft: the rows already on it are not locked, one moves to order only, one comes off, and the bid remembers every pick', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199', status: 'proposed', source_count_row_id: 'c-wh' }),
      item({ id: 'it-2', tag: 'WC-1', sequence_order: 2, submitted_label: 'TOTO CT708UVG#01', status: 'proposed', source_count_row_id: 'c-wc' }),
    ]
    state.writes = []
    state.tasks = []
    state.parts = []
    state.procRecords = []
    state.takeoff = true
    try {
      mount()
      await waitFor(() => expect(screen.getAllByTestId('submittal-row')).toHaveLength(2))
      // What is not on the draft is named under the rows, with a door to bring it back.
      await waitFor(() => expect(screen.getByTestId('left-out-line').textContent).toContain('Left out · 2 from the takeoff · not submitted, not ordered'))
      fireEvent.click(screen.getByTestId('add-from-takeoff'))
      const picker = await screen.findByRole('dialog', { name: 'Choose from the takeoff' })
      const group = (name: string) => within(within(picker).getByRole('group', { name }))
      expect(group('DWH-1').getByRole('button', { name: 'GC sees it' }).getAttribute('aria-pressed')).toBe('true')
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('Nothing changes yet.')
      fireEvent.click(group('DWH-1').getByRole('button', { name: 'Order only' }))
      fireEvent.click(group('WC-1, WC-2').getByRole('button', { name: 'Left out' }))
      expect(within(picker).getByTestId('takeoff-bar').textContent).toBe('1 fixture moves to order only · 1 comes off Rev 1')
      fireEvent.click(within(picker).getByTestId('takeoff-confirm'))
      await waitFor(() => expect(state.writes.some((w) => w.op === 'upsert' && w.table === 'bid_submittal_takeoff_choices')).toBe(true))
      expect(state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toMatchObject({ payload: { order_only: true }, filters: [['id', 'it-1']] })
      expect(state.writes.find((w) => w.op === 'delete' && w.table === 'bid_submittal_items')!.filters).toEqual([['id', 'it-2']])
      const remembered = (state.writes.find((w) => w.op === 'upsert')!.payload as Array<Record<string, unknown>>).map((r) => [r.count_row_id, r.ticked, r.order_only])
      expect(remembered).toEqual(expect.arrayContaining([['c-wh', true, true], ['c-wc', false, false], ['c-us', false, false], ['c-pipe', false, false]]))
      // The draft now: no row for the GC, DWH-1 in the Order only group, three fixtures left out.
      await waitFor(() => expect(screen.getAllByTestId('order-only-row')).toHaveLength(1))
      expect(screen.queryAllByTestId('submittal-row')).toHaveLength(0)
      expect(screen.queryByRole('dialog', { name: 'Choose from the takeoff' })).toBeNull()
    } finally {
      state.takeoff = false
      state.procRecords = []
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

  it('2026-10-02 · after Rev 2 from the rows sent back, the log keeps the row approved on Rev 1: its order stays in sight, and it says which revision it stands on', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'shared', title: 'Plumbing fixtures & equipment', note: null, package_path: 'b398/rev-1/package-rev1.pdf', source_files: [], shared_at: '2026-09-16T00:00:00Z', created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'proposed', review_decision: 'approved', reviewed_at: '2026-09-20T15:00:00Z', reviewed_by_name: 'Dana Whitfield' }),
      item({ id: 'it-2', tag: 'DWH-1', sequence_order: 2, submitted_label: 'AO SMITH BTH-120', status: 'proposed', review_decision: 'rejected', review_note: 'hold the 199', reviewed_at: '2026-09-20T15:00:00Z', reviewed_by_name: 'Dana Whitfield' }),
    ]
    // The office ordered the water closet the day it was released.
    state.procRecords = [{ id: 'pr-1', bid_id: 'b398', tag: 'WC-1', ordered_on: '2026-09-23', po_ref: 'PO 118', sort_order: 1, label: '' }]
    state.writes = []
    state.parts = []
    state.tasks = []
    state.noSources = true
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    try {
      mount()
      // Rev 1 is the newest, so the log reads its two rows: one released and ordered, one sent back.
      await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
      fireEvent.click(screen.getAllByRole('button', { name: 'Start a Rev 2 draft…' })[0]!)
      const chooser = await screen.findByRole('dialog', { name: 'Start a Rev 2 draft' })
      expect(within(chooser).getByTestId('resubmit-rows-need').textContent).toContain('The 1 row approved stays on Rev 1 and on the procurement log.')
      fireEvent.click(within(chooser).getByRole('button', { name: 'Start the draft with 1 row' }))
      await waitFor(() => expect(screen.getAllByTestId('revision-chip')).toHaveLength(2))
      // Rev 2 holds the one row sent back …
      expect(state.items.filter((r) => r.submittal_id === 'rev-2').map((r) => r.tag)).toEqual(['DWH-1'])
      // … and the log still lists the water closet: approved on Rev 1, ordered, with the PO typed on its line.
      await waitFor(() => {
        const tags = screen.getAllByTestId('procurement-row').map((r) => r.textContent ?? '')
        expect(tags.some((t) => t.includes('DWH-1'))).toBe(true)
        expect(tags.some((t) => t.includes('WC-1'))).toBe(true)
      })
      const wc = screen.getAllByTestId('procurement-row').find((r) => r.textContent?.includes('WC-1'))!
      expect(within(wc).getByTestId('procurement-status').textContent).toMatch(/Ordered/)
      expect(within(wc).getByTestId('procurement-stands-on').textContent).toBe('approved on Rev 1')
      const dwh = screen.getAllByTestId('procurement-row').find((r) => r.textContent?.includes('DWH-1'))!
      expect(within(dwh).queryByTestId('procurement-stands-on')).toBeNull()
    } finally {
      state.procRecords = []
      state.noSources = false
      localStorage.removeItem('submittals_procure_lens')
    }
  })
  it('2026-10-03 · a resubmit carries the rows nobody answered beside the row sent back; only the approved row stays on Rev 1', async () => {
    // BP375's shape: answers typed on a draft, one row sent back, one approved, two with no answer (one of them with no product).
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-29T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT728CUVG#01', status: 'proposed', review_decision: 'approved', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura' }),
      item({ id: 'it-2', tag: 'LAV-1', sequence_order: 2, submitted_label: 'TOTO T25S51E#CP', status: 'proposed', review_decision: 'rejected', review_note: 'TEL145', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura' }),
      item({ id: 'it-3', tag: 'FCO', sequence_order: 3, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed' }),
      item({ id: 'it-4', tag: 'UTILITY SINK', sequence_order: 4, submitted_label: null, status: 'missing' }),
    ]
    state.writes = []
    state.parts = []
    state.tasks = []
    state.noSources = true
    try {
      mount()
      // 2026-10-03 · the answers were typed on a draft: the strip lights Their call and Resubmit, names the rows sent back, and step 7 is open with its button.
      const button = await screen.findByTestId('new-revision')
      expect(screen.getByRole('button', { name: '6 Their call · waiting on the reviewer' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '7 Resubmit · you are here' })).toBeTruthy()
      expect(screen.getByTestId('submittal-journey').textContent).toContain('structura approved 1 and sent 1 back. 1 row still has no answer. 1 row has no product yet. Start a Rev 2 draft to fix what was sent back. The rows with no answer go on it too. Nothing is sent until you share.')
      // 2026-10-05 · one button where there were two. It says what it does; the line beside it says the rows are chosen next, and that nothing is sent.
      expect(screen.queryByTestId('resubmit-sent-back')).toBeNull()
      // Punch list #84 · while step 7 is the live step a dashed loop marked Next revision runs back to step 2. It is decoration: hidden from readers.
      const loop = screen.getByTestId('next-revision-loop')
      expect(loop.textContent).toBe('Next revision')
      expect(loop.getAttribute('aria-hidden')).toBe('true')
      expect(loop.parentElement).toBe(screen.getByTestId('submittal-road'))
      // Each step is its own grid row, so the loop can lie over rows 2 to 7 however the steps fold.
      expect([2, 7].map((n) => screen.getByTestId(`road-${n}`).style.gridRow)).toEqual(['2', '7'])
      expect((button as HTMLButtonElement).disabled).toBe(false)
      expect(button.textContent).toBe('Start a Rev 2 draft…')
      expect(screen.getByTestId('resubmit-caption').textContent).toBe('You choose the rows next. Nothing is sent. The GC sees Rev 2 only after you press Share.')
      fireEvent.click(button)
      // The question holds the choice. The rows that need it are ticked; each choice says what happens to the approved row.
      const chooser = await screen.findByRole('dialog', { name: 'Start a Rev 2 draft' })
      expect((within(within(chooser).getByTestId('resubmit-rows-need')).getByRole('radio') as HTMLInputElement).checked).toBe(true)
      expect(within(chooser).getByTestId('resubmit-rows-need').textContent).toBe('Only the rows that need it1 sent back and 2 with no answer. The 1 row approved stays on Rev 1 and on the procurement log.')
      expect(within(chooser).getByTestId('resubmit-rows-every').textContent).toBe('Every rowThe 1 row approved goes on Rev 2 too. The GC answers every row and every part again. Use it when a product changed.')
      expect(within(chooser).getByTestId('resubmit-chooser-foot').textContent).toBe('Rev 2 starts as a draft. Nothing is sent. The GC sees Rev 2 only after you press Share.')
      // Ticking Every row changes the button; ticking back restores it. Nothing is written until the button is pressed.
      fireEvent.click(within(within(chooser).getByTestId('resubmit-rows-every')).getByRole('radio'))
      expect(within(chooser).getByRole('button', { name: 'Start the draft with all 4 rows' })).toBeTruthy()
      fireEvent.click(within(within(chooser).getByTestId('resubmit-rows-need')).getByRole('radio'))
      expect(state.writes).toEqual([])
      fireEvent.click(within(chooser).getByRole('button', { name: 'Start the draft with 3 rows' }))
      await waitFor(() => expect(screen.getAllByTestId('revision-chip')).toHaveLength(2))
      expect(state.items.filter((r) => r.submittal_id === 'rev-2').map((r) => r.tag)).toEqual(['LAV-1', 'FCO', 'UTILITY SINK'])
      // 2026-10-03 · the words follow the revision: pill 2 and steps 2 and 7 say Rev 2 and Rev 3, and the replaced draft reads answered, not superseded.
      await waitFor(() => expect(screen.getByRole('button', { name: /^2 Rev 2 · / })).toBeTruthy())
      // The draft is started: step 7 is no longer the live step, so the loop is gone.
      expect(screen.queryByTestId('next-revision-loop')).toBeNull()
      for (const n of [2, 7]) if (screen.getByTestId(`road-${n}`).getAttribute('data-open') !== 'true') fireEvent.click(screen.getByTestId(`road-${n}-caret`))
      expect(screen.getByTestId('road-2-about').textContent).toContain('Rev 2 is the version you are working on.')
      expect(screen.getByTestId('road-7-about').textContent).toContain('Start a Rev 3 draft with them and the rows with no answer yet.')
      await waitFor(() => expect(screen.getAllByTestId('revision-chip').map((c) => c.textContent)).toEqual([expect.stringMatching(/^Rev 2 · draft · /), 'Rev 1 · answered Oct 2']))
    } finally {
      state.noSources = false
    }
  })
  it('2026-10-05 · Every row in the question carries the approved row too, and Cancel or Esc writes nothing', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-29T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT728CUVG#01', status: 'proposed', review_decision: 'approved', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura' }),
      item({ id: 'it-2', tag: 'LAV-1', sequence_order: 2, submitted_label: 'TOTO T25S51E#CP', status: 'proposed', review_decision: 'rejected', review_note: 'TEL145', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura' }),
      item({ id: 'it-3', tag: 'FCO', sequence_order: 3, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed' }),
    ]
    state.writes = []
    state.parts = []
    state.tasks = []
    state.noSources = true
    try {
      mount()
      const button = await screen.findByTestId('new-revision')
      // Cancel, then Esc: the window goes and nothing is written.
      fireEvent.click(button)
      fireEvent.click(within(await screen.findByTestId('resubmit-chooser')).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByTestId('resubmit-chooser')).toBeNull()
      fireEvent.click(button)
      await screen.findByTestId('resubmit-chooser')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByTestId('resubmit-chooser')).toBeNull()
      expect(state.writes).toEqual([])
      // Every row: the approved row goes on Rev 2 beside the other two. The window opens on the first choice each time.
      fireEvent.click(button)
      const chooser = await screen.findByTestId('resubmit-chooser')
      expect(within(chooser).getByRole('button', { name: 'Start the draft with 2 rows' })).toBeTruthy()
      fireEvent.click(within(within(chooser).getByTestId('resubmit-rows-every')).getByRole('radio'))
      fireEvent.click(within(chooser).getByRole('button', { name: 'Start the draft with all 3 rows' }))
      await waitFor(() => expect(screen.getAllByTestId('revision-chip')).toHaveLength(2))
      expect(screen.queryByTestId('resubmit-chooser')).toBeNull()
      expect(state.items.filter((r) => r.submittal_id === 'rev-2').map((r) => r.tag)).toEqual(['WC-1', 'LAV-1', 'FCO'])
    } finally {
      state.noSources = false
    }
  })
  it('2026-10-05 · rows sent back but nothing approved: both drafts are the same one, so the button asks once and offers no choice', async () => {
    // BP375 on 2026-10-05: rows sent back, rows with no answer, no row and no part approved.
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-29T00:00:00Z' }]
    state.items = [
      item({ id: 'it-2', tag: 'LAV-1', sequence_order: 1, submitted_label: 'TOTO T25S51E#CP', status: 'proposed', review_decision: 'rejected', review_note: 'TEL145', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura' }),
      item({ id: 'it-3', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL', status: 'proposed' }),
    ]
    state.writes = []
    state.parts = []
    state.tasks = []
    state.noSources = true
    try {
      mount()
      const button = await screen.findByTestId('new-revision')
      expect(button.textContent).toBe('Start a Rev 2 draft…')
      expect(screen.getByTestId('resubmit-caption').textContent).toBe('The draft starts with every row. Nothing is sent. The GC sees Rev 2 only after you press Share.')
      fireEvent.click(button)
      const confirmDialog = await screen.findByRole('alertdialog')
      expect(screen.queryByTestId('resubmit-chooser')).toBeNull()
      expect(confirmDialog.textContent).toContain('Every row goes on Rev 2. 1 sent back and 1 with no answer. No row was approved on Rev 1. Rev 2 starts as a draft. Nothing is sent. The GC sees Rev 2 only after you press Share.')
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Start the draft with 2 rows' }))
      await waitFor(() => expect(screen.getAllByTestId('revision-chip')).toHaveLength(2))
      expect(state.items.filter((r) => r.submittal_id === 'rev-2').map((r) => r.tag)).toEqual(['LAV-1', 'FCO'])
    } finally {
      state.noSources = false
    }
  })
  it('2026-10-03 · on a resubmit draft a fixture approved on the revision before is not counted as left out, and the takeoff window opens it locked', async () => {
    // Rev 1 was answered: the water closets approved, the heater sent back. Rev 2 is the draft that carries the heater alone.
    state.revisions = [
      { id: 'rev-2', bid_id: 'b398', rev_number: 2, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-10-02T00:00:00Z' },
      { id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'shared', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: '2026-09-16T00:00:00Z', created_at: '2026-09-15T00:00:00Z' },
    ]
    state.items = [
      item({ id: 'r1-wc', submittal_id: 'rev-1', tag: 'WC-1, WC-2', sequence_order: 1, submitted_label: 'TOTO CT708UVG#01 WALL HUNG BOWL', status: 'proposed', source_count_row_id: 'c-wc', review_decision: 'approved', reviewed_at: '2026-09-20T15:00:00Z', reviewed_by_name: 'Dana Whitfield' }),
      item({ id: 'r1-wh', submittal_id: 'rev-1', tag: 'DWH-1, ET', sequence_order: 2, submitted_label: 'A.O. Smith BTH-199 WATER HEATER', status: 'proposed', source_count_row_id: 'c-wh', review_decision: 'rejected', reviewed_at: '2026-09-20T15:00:00Z', reviewed_by_name: 'Dana Whitfield' }),
      item({ id: 'r2-wh', submittal_id: 'rev-2', tag: 'DWH-1, ET', sequence_order: 1, submitted_label: 'A.O. Smith BTH-199 WATER HEATER', status: 'proposed', source_count_row_id: 'c-wh', carried_from_item_id: 'r1-wh' }),
    ]
    state.parts = []
    state.tasks = []
    state.writes = []
    state.takeoff = true
    try {
      mount()
      // Four fixtures on the takeoff: the heater is on the draft, the closets stand approved, two are left out.
      await waitFor(() => expect(screen.getByTestId('left-out-line').textContent).toContain('Left out · 2 from the takeoff'))
      expect(screen.getByTestId('stands-line').textContent).toBe('1 approved on Rev 1')
      fireEvent.click(screen.getByTestId('add-from-takeoff'))
      const dialog = await screen.findByRole('dialog', { name: 'Choose from the takeoff' })
      const wc = within(dialog).getAllByTestId('takeoff-candidate').find((r) => r.textContent?.includes('WC-1, WC-2'))!
      expect(wc.getAttribute('data-pick')).toBe('stands')
      expect(within(wc).getByTestId('takeoff-stands').textContent).toContain('Approved on Rev 1')
      expect(within(dialog).getByTestId('takeoff-bar').textContent).toBe('Nothing changes yet.')
      expect((within(dialog).getByTestId('takeoff-confirm') as HTMLButtonElement).disabled).toBe(true)
    } finally {
      state.takeoff = false
    }
  })
  it('2026-10-03 · a row sent back for one part of three says so: the cell counts the parts, and the step counts it apart from a row rejected whole', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-29T00:00:00Z' }]
    state.items = [
      item({ id: 'lav', tag: 'LAV-1', sequence_order: 1, submitted_label: 'TSL.MON.B.38.2.PS1.BK + TOTO T25S51E#CP + BOBRICK B-8236', status: 'proposed', review_decision: 'rejected', review_note: 'TOTO T25S51E#CP: TEL145', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura', decision_source: 'entered', decision_entered_by_name: 'Wendi' }),
      item({ id: 'fd', tag: 'FD', sequence_order: 2, submitted_label: 'JRSMITH 2005LXH03', status: 'proposed', review_decision: 'rejected', reviewed_at: '2026-10-02T15:00:00Z', reviewed_by_name: 'structura', decision_source: 'entered', decision_entered_by_name: 'Wendi' }),
    ]
    const p = (id: string, seq: number, label: string, review_decision: string | null) => ({ id, item_id: 'lav', bid_id: 'b398', sequence_order: seq, label, quantity: 1, on_submittal: true, source: 'takeoff', source_line_id: null, source_template_item_id: null, sheet_pages: [], procure_key: `k-${id}`, decision_source: 'entered', review_decision })
    state.parts = [p('sink', 1, 'TSL.MON.B.38.2.PS1.BK', null), p('faucet', 2, 'TOTO T25S51E#CP', 'rejected'), p('drain', 3, 'BOBRICK B-8236', null)]
    state.tasks = []
    state.noSources = true
    try {
      mount()
      await waitFor(() => expect(screen.getAllByTestId('their-call-head').map((e) => e.textContent)).toEqual(['1 of 3 rejected', 'Rejected']))
      expect(screen.getAllByTestId('their-call-parts').map((e) => e.textContent)).toEqual(['2 with no answer yet'])
      // Step 6 is open: the answers are what the next step reads.
      expect((await screen.findByTestId('decisions-line')).textContent).toContain('2sent back')
      expect(screen.getByTestId('their-call-who').textContent).toContain('structura answered. Wendi typed the answers in')
      // What came back is named in the step: the part, and the reviewer's words when they gave any.
      expect(screen.getAllByTestId('sent-back-row')).toHaveLength(2)
    } finally {
      state.parts = []
      state.noSources = false
    }
  })

  it('v2.4609 · the schedule typed after the takeoff built the rows grades them: the door counts the Proposed rows it names, the window shows each, and Grade writes the plans’ product and the status onto the row and nothing else', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    // Three rows from the takeoff: WC-1 reads the plans' model, DWH-1 another maker's, HB-3 is not on the schedule.
    state.items = [
      item({ id: 'g-wc', tag: 'WC-1', sequence_order: 1, submitted_label: 'TOTO CT708UVG#01 TORNADO FLUSH', status: 'proposed', source_count_row_id: 'cr-1', lead_time_days: 21, reason_note: 'keep me' }),
      item({ id: 'g-dwh', tag: 'DWH-1', sequence_order: 2, submitted_label: 'BRADFORD WHITE RE2HP50', status: 'proposed', source_count_row_id: 'cr-2' }),
      item({ id: 'g-hb', tag: 'HB-3', sequence_order: 3, submitted_label: 'WOODFORD B74C', status: 'proposed', source_count_row_id: 'cr-3' }),
    ]
    state.writes = []
    mount()
    await screen.findAllByTestId('submittal-row')
    // Step 2 is folded once a revision exists: its title opens it.
    fireEvent.click(screen.getByRole('button', { name: /2 · Rev 1/ }))
    const door = await screen.findByTestId('grade-against-schedule')
    expect(door.textContent).toBe('Grade 2 rows against the schedule…')
    fireEvent.click(door)
    const dialog = await screen.findByRole('dialog', { name: 'Grade the rows against the schedule' })
    expect(within(dialog).getAllByTestId('grade-to').map((x) => x.textContent)).toEqual(['As specified', 'Alternate'])
    expect(within(dialog).getByTestId('grade-skipped').textContent).toBe('HB-3 is not on the schedule, so it stays Proposed.')
    fireEvent.click(within(dialog).getByTestId('grade-confirm'))
    await waitFor(() => expect(state.writes.filter((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toHaveLength(2))
    const writes = state.writes.filter((w) => w.op === 'update' && w.table === 'bid_submittal_items')
    expect(writes[0]!.filters).toContainEqual(['id', 'g-wc'])
    expect(writes[0]!.payload).toEqual({ specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', specified_description: 'Wall-hung, 1.28 gpf', status: 'as_specified' })
    expect(writes[1]!.payload).toEqual({ specified_manufacturer: 'Rheem', specified_model: 'RH375', specified_description: '40 gal', status: 'alternate' })
    // The rows read graded, the lead time and the note stayed, HB-3 is still Proposed, and the door is gone.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Grade the rows against the schedule' })).toBeNull())
    expect(state.items.find((r) => r.id === 'g-wc')).toMatchObject({ status: 'as_specified', lead_time_days: 21, reason_note: 'keep me' })
    expect(state.items.find((r) => r.id === 'g-hb')!.status).toBe('proposed')
    await waitFor(() => expect(screen.queryByTestId('grade-against-schedule')).toBeNull())
  })

  it('v2.4610 · Save PDF on a vendor file reads the stored file and saves it under its own name, from the app’s own address: no signed link, no new tab', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [{ path: 'b398/rev-1/0.pdf', name: 'NWS SUBMITTAL', pages: 4, house_id: null, house_name: 'NWS' }], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, submitted_label: 'RHEEM PROPH40', status: 'proposed', sheet_file: 0, sheet_pages: [1] })]
    state.storage = []
    const save = stubSave()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      mount()
      await screen.findAllByTestId('submittal-row')
      fireEvent.click(await screen.findByRole('button', { name: 'Save NWS SUBMITTAL as a PDF' }))
      await waitFor(() => expect(save.saved).toEqual(['NWS SUBMITTAL.pdf']))
      expect(state.storage).toEqual(['download b398/rev-1/0.pdf'])
      expect(open).not.toHaveBeenCalled()
    } finally {
      save.restore()
      open.mockRestore()
    }
  })
})

// @vitest-environment jsdom
/**
 * Render smokes for BidsSubmittalsTab (Submittals stage 2b): the empty state
 * builds Rev 1 from the schedule and the picks; a revision draws the tiles,
 * the rows with their status chips, "say why" and "sheet needed"; New revision
 * carries the rows into Rev 2 and supersedes an unshared draft; Edit writes
 * the item row.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidsSubmittalsTab } from './BidsSubmittalsTab'

type Rec = { table: string; op: string; payload: unknown; filters: Array<[string, unknown]> }
const state: { revisions: Record<string, unknown>[]; items: Record<string, unknown>[]; writes: Rec[]; storage: string[]; packageCalls: Array<{ files: number; sheets: string[] }> } = { revisions: [], items: [], writes: [], storage: [], packageCalls: [] }

vi.mock('../../lib/jobs/testReportSettings', () => ({
  fetchTestReportSettings: () => Promise.resolve({ companyName: 'Click Plumbing', companyTagline: 'Plumbing', officePhone: '(512) 555-0100' }),
}))

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

function builder(table: string) {
  const rec: Rec = { table, op: 'select', payload: null, filters: [] }
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.order = chain
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
  const run = () => {
    if (rec.op !== 'select') {
      state.writes.push(rec)
      if (rec.op === 'insert' && table === 'bid_submittals') {
        const row = { id: `rev-${state.revisions.length + 1}`, source_files: [], created_at: '2026-09-15T00:00:00Z', shared_at: null, note: null, ...(rec.payload as Record<string, unknown>) }
        state.revisions = [row, ...state.revisions]
        return { data: row, error: null }
      }
      if (rec.op === 'insert' && table === 'bid_submittal_items') {
        const rows = (rec.payload as Record<string, unknown>[]).map((r, i) => ({ id: `it-${state.items.length + i + 1}`, ...r }))
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
        state.items = state.items.filter((r) => r.submittal_id !== sid)
      }
      return { data: null, error: null }
    }
    if (table === 'bid_specified_products') return { data: SPEC, error: null }
    if (table === 'bid_quotes') return { data: QUOTES, error: null }
    if (table === 'bid_submittals') return { data: [...state.revisions].sort((a, b) => (b.rev_number as number) - (a.rev_number as number)), error: null }
    if (table === 'bid_submittal_items') {
      const sid = rec.filters.find((f) => f[0] === 'submittal_id')?.[1]
      return { data: state.items.filter((r) => r.submittal_id === sid), error: null }
    }
    return { data: [], error: null }
  }
  b.single = () => Promise.resolve(run())
  b.maybeSingle = () => Promise.resolve(run())
  b.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(run()).then(resolve, reject)
  return b
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
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
    fireEvent.click(screen.getByRole('button', { name: 'Build Rev 1 from the picks' }))
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
    expect(tiles).toMatch(/Alternates1.*1 still need a reason/)
    expect(tiles).toMatch(/Cut sheets in1 of 2/)
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
    expect(upd.payload).toEqual({ status: 'alternate', reason_kind: 'lead_time', reason_note: null, lead_time_days: 7, sheet_file: 0, sheet_pages: [5], sheet_source: 'estimator' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(screen.getAllByTestId('submittal-row')[0]!).getByText('Lead time')).toBeTruthy()
  })

  it('New revision carries the rows into Rev 2, marks the diff, and supersedes the unshared draft', async () => {
    state.revisions = [{ id: 'rev-1', bid_id: 'b398', rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', note: null, package_path: null, source_files: [], shared_at: null, created_at: '2026-09-15T00:00:00Z' }]
    state.items = [
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_model: 'AO SMITH BTH-120', submitted_label: 'AO SMITH BTH-120', status: 'alternate', reason_kind: 'cost' }),
      item({ id: 'it-2', tag: 'PRV-1', sequence_order: 2, specified_manufacturer: 'Watts', specified_model: 'LF223', status: 'missing' }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 3, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2] }),
    ]
    state.writes = []
    mount()
    await screen.findAllByTestId('submittal-row')
    fireEvent.click(screen.getByRole('button', { name: 'New revision' }))
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
      item({ id: 'it-1', tag: 'DWH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', status: 'alternate', reason_kind: 'lead_time' }),
      item({ id: 'it-3', tag: 'WC-1', sequence_order: 2, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01 WALL HUNG', submitted_model: 'CT708UVG', status: 'as_specified', sheet_file: 0, sheet_pages: [1, 2] }),
    ]
    state.writes = []
    state.storage = []
    state.packageCalls = []
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mount()
    await screen.findAllByTestId('submittal-row')
    fireEvent.click(screen.getByRole('button', { name: 'Build package' }))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittals')).toBe(true))
    expect(state.packageCalls).toEqual([{ files: 1, sheets: ['WC-1'] }])
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
    expect(screen.getByTestId('strip-footer').textContent).toBe('1 of 4 pages on rows · 3 not used')
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    fireEvent.click(within(screen.getByTestId('row-chooser')).getByRole('button', { name: 'DWH-1 · sheet needed' }))
    await waitFor(() => expect(state.writes.some((w) => w.op === 'update' && w.table === 'bid_submittal_items')).toBe(true))
    expect(state.writes.find((w) => w.op === 'update' && w.table === 'bid_submittal_items')!.payload).toEqual({ sheet_file: 0, sheet_pages: [2], sheet_source: 'estimator' })
    await waitFor(() => expect(screen.getByTestId('strip-footer').textContent).toBe('2 of 4 pages on rows · 2 not used'))
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
})

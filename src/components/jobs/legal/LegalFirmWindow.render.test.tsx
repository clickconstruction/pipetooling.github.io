// @vitest-environment jsdom
/**
 * The firm's window on the Legal desk (v2.4711): a dev edits the Settings block itself and a
 * save reloads the desk; everyone else reads the firm; what hangs on the firm is said first;
 * Esc and a click outside close the window alone.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import LegalFirmWindow, { LEGAL_FIRM_SETTINGS_HREF } from './LegalFirmWindow'
import type { LegalFirmRow, LegalMatterRow, LegalRecipientRow } from '../../../lib/legal/legalMatters'

const db = vi.hoisted(() => ({ writes: [] as Array<{ table: string; op: string; payload: unknown }>, rpcs: [] as Array<{ name: string; args: unknown }> }))

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../../lib/supabase', () => {
  const answer = (table: string, op: string, single: boolean) => {
    if (table === 'legal_firms' && op === 'select') return { data: [{ id: 'firm-1', name: 'ZZ Test Firm', handling_name: '', email: 'zz@test.example', phone: '', contingency_pct: 33, filing_cost: 350, active: true }], error: null }
    if (table === 'legal_firms') return { data: { id: 'firm-1' }, error: null }
    if (table === 'app_settings' && op === 'select') return { data: single ? { value_text: JSON.stringify({ entity: 'Click Plumbing and Electrical, LLC', license: 'M-41207' }) } : [], error: null }
    if (table === 'legal_portal_links') return { data: [{ id: 'link-1' }], error: null }
    return { data: single ? null : [], error: null }
  }
  const builder = (table: string) => {
    let op = 'select'
    let single = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'in']) b[m] = () => b
    for (const m of ['update', 'insert', 'upsert']) {
      b[m] = (payload: unknown) => {
        op = m
        db.writes.push({ table, op: m, payload })
        return b
      }
    }
    b.single = () => {
      single = true
      return b
    }
    b.maybeSingle = b.single
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer(table, op, single)).then(ok, bad)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: (name: string, args: unknown) => { db.rpcs.push({ name, args }); return Promise.resolve({ data: null, error: null }) } } }
})

const firm: LegalFirmRow = { id: 'firm-1', name: 'ZZ Test Firm', handling_name: 'Dana Holt', email: 'zz@test.example', phone: '(512) 555-0100', contingency_pct: 33, filing_cost: 350, active: true } as LegalFirmRow
const matters = [{ id: 'm1', firm_id: 'firm-1', stage: 'referred', closed_at: null, payer_name: 'Brazos Ridge Contracting', payer_key: 'c:brazos' }] as unknown as LegalMatterRow[]
const recipients = [{ id: 'r1', firm_id: 'firm-1', removed_at: null }, { id: 'r2', firm_id: 'firm-1', removed_at: null }] as unknown as LegalRecipientRow[]

type CoverageProps = Pick<ComponentProps<typeof LegalFirmWindow>, 'firms' | 'coverage' | 'cases' | 'onShowOnMap'>

function renderWindow(extra: { canEdit: boolean; firm?: LegalFirmRow | null } & CoverageProps) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const { canEdit, firm: given, ...coverage } = extra
  renderWithProviders(<LegalFirmWindow firm={given === undefined ? firm : given} matters={matters} recipients={recipients} canEdit={canEdit} onClose={onClose} onSaved={onSaved} zIndex={800} {...coverage} />)
  return { onClose, onSaved }
}

/** Punch list #222, PR 1: the desk's coverage data, as `LegalDesk` passes it. Travis holds two cases, Williamson one; one case with the firm sits in Bastrop, which it no longer covers; Gonzales has a case and no firm. */
const COVERED = new Map([['Travis', { first: 'firm-1', also: [] }], ['Williamson', { first: 'firm-1', also: [] }]])
const CASES = [
  { id: 'a', key: 'c:a', name: 'Brazos Ridge Contracting', balance: 15781.82, jobLabels: '701', jobCount: 1, viaGc: false, stand: 'firm', firmId: 'firm-1', note: 'with ZZ Test Firm', lat: null, lng: null, county: 'Travis', countyFrom: 'record' },
  { id: 'b', key: 'c:b', name: 'Bryan Herber', balance: 1238.65, jobLabels: '702', jobCount: 1, viaGc: false, stand: 'gave', firmId: null, note: 'given up on', lat: null, lng: null, county: 'Travis', countyFrom: 'record' },
  { id: 'c', key: 'c:c', name: 'Burd & Assoc.', balance: 2976.34, jobLabels: '891', jobCount: 1, viaGc: true, stand: 'eyes', firmId: null, note: 'needs a dev’s eyes', lat: null, lng: null, county: 'Williamson', countyFrom: 'record' },
  { id: 'd', key: 'c:d', name: 'Lost Pines Builders', balance: 500, jobLabels: '703', jobCount: 1, viaGc: false, stand: 'firm', firmId: 'firm-1', note: 'with ZZ Test Firm', lat: null, lng: null, county: 'Bastrop', countyFrom: 'record' },
  { id: 'e', key: 'c:e', name: 'Kettle Creek Farms', balance: 3310, jobLabels: '704', jobCount: 1, viaGc: false, stand: 'eyes', firmId: null, note: 'needs a dev’s eyes', lat: null, lng: null, county: 'Gonzales', countyFrom: 'record' },
] as unknown as NonNullable<CoverageProps['cases']>
const FIRMS = [firm]

describe('LegalFirmWindow', () => {
  it('a dev edits the firm in the Settings block itself, and a save reloads the desk', async () => {
    db.writes.length = 0
    const { onSaved } = renderWindow({ canEdit: true })
    await settle()
    expect(screen.getByRole('dialog', { name: 'The collections law firm' })).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-block="window"]')).toBeTruthy()
    expect(document.getElementById('settings-legal-firm')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Who we release accounts to' })).toBeTruthy()
    // v2.6195: the details fold to one line; Edit details opens the form in place.
    expect((await screen.findByText('ZZ Test Firm · no handling person yet · no phone · 33% · $350 filing')).hasAttribute('data-legal-firm-details-line')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save firm' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const name = await screen.findByDisplayValue('ZZ Test Firm')
    expect(await screen.findByText('portal link on')).toBeTruthy()
    expect(screen.getByText('1 account with the firm')).toBeTruthy()
    expect(screen.getByText('2 people on its email list')).toBeTruthy()
    expect(await screen.findByText('2 of 8 filled')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open in Settings ↗' }).getAttribute('href')).toBe(LEGAL_FIRM_SETTINGS_HREF)
    expect(screen.getByRole('button', { name: 'Replace with a new firm…' })).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Example Law Firm, PLLC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save firm' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(db.writes).toContainEqual(expect.objectContaining({ table: 'legal_firms', op: 'update', payload: expect.objectContaining({ name: 'Example Law Firm, PLLC' }) }))
  })

  it('opens on where the firm covers: the title, the chips, a row per county with its cases and dollars, the sum, the flag and Show on the desk map (v2.6195)', async () => {
    const onShowOnMap = vi.fn()
    renderWindow({ canEdit: true, firms: FIRMS, coverage: COVERED, cases: CASES, onShowOnMap })
    await settle()
    expect(document.querySelector('[data-legal-firm-title]')!.textContent).toContain('ZZ Test Firm')
    expect(document.querySelector('[data-legal-firm-coverage]')!.getAttribute('data-legal-firm-coverage')).toBe('covers')
    expect(document.querySelector('[data-legal-firm-coverage-counties]')!.textContent).toBe('2 counties')
    // Two in Travis, one in Williamson, one with the firm in Bastrop; Gonzales is nobody's.
    expect(document.querySelector('[data-legal-firm-coverage-cases]')!.textContent).toBe('4 cases · $20,496.81')
    const rows = [...document.querySelectorAll('[data-legal-firm-coverage-row]')].map((r) => r.textContent)
    expect(rows).toEqual(['Travis County2$17,020.47', 'Williamson County1$2,976.34'])
    expect(document.querySelector('[data-legal-firm-coverage-sum]')!.textContent).toBe('2 counties · 1 case with the firm elsewhere4$20,496.81')
    expect(document.querySelector('[data-legal-firm-coverage-flag]')!.textContent).toMatch(/1 case in a county no firm covers · Kettle Creek Farms \(Gonzales\)/)
    expect(document.querySelector('[data-legal-firm-nudge]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Travis County' }))
    expect(document.querySelector('[data-legal-firm-coverage-row="Travis"]')!.getAttribute('data-held')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Show on the desk map ›' }))
    expect(onShowOnMap).toHaveBeenCalledWith('firm-1')
    // The replace panel says what a replace would do to the counties.
    expect(document.querySelector('[data-legal-firm-replace-leaves]')!.textContent).toBe('Replacing retires ZZ Test Firm everywhere. Its 2 counties, Travis County and Williamson County, would have no firm until you color them for the new firm under Firms….')
    // v2.6221: Extend coverage… turns the map into the picker in place; Cancel with nothing changed leaves at once.
    fireEvent.click(screen.getByRole('button', { name: 'Extend coverage…' }))
    expect(document.querySelector('[data-legal-firm-coverage]')!.getAttribute('data-legal-firm-coverage')).toBe('extending')
    expect((screen.getByRole('button', { name: 'Save counties' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(document.querySelector('[data-legal-firm-coverage]')!.getAttribute('data-legal-firm-coverage')).toBe('covers')
  })

  it('while no county is colored for any firm, the nudge names the bridge, and its press opens the picker in place where an area colors a metro and Save writes it (v2.6195, v2.6221)', async () => {
    db.writes.length = 0
    const { onSaved } = renderWindow({ canEdit: true, firms: FIRMS, coverage: new Map(), cases: CASES })
    await settle()
    const nudge = document.querySelector('[data-legal-firm-nudge]')!
    expect(nudge.getAttribute('data-legal-firm-nudge')).toBe('nothing_colored')
    expect(nudge.textContent).toContain('ZZ Test Firm takes every account today, by default.')
    expect(nudge.textContent).toContain('The first county colored for any firm ends that')
    expect(document.querySelector('[data-legal-firm-coverage-counties]')!.textContent).toBe('no counties colored')
    expect(document.querySelector('[data-legal-firm-coverage-rows]')).toBeNull()
    expect(document.querySelector('[data-legal-firm-replace-leaves]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Color ZZ Test Firm’s counties…' }))
    expect(document.querySelector('[data-legal-firm-coverage]')!.getAttribute('data-legal-firm-coverage')).toBe('extending')
    expect(document.querySelector('[data-legal-firm-nudge]')).toBeNull()
    // Travis, Williamson and Gonzales hold a case with no firm; the cases already with the firm do not count.
    expect(document.querySelector('[data-legal-firm-area="gaps"]')!.textContent).toBe('Counties with a case and no firm · 3')
    fireEvent.click(screen.getByRole('button', { name: 'Austin area · 5' }))
    expect(await screen.findByText('Austin area: 5 counties added for ZZ Test Firm once you save.')).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-coverage-counties]')!.textContent).toBe('5 counties')
    expect(document.querySelector('[data-legal-firm-coverage-row="Bastrop"]')!.getAttribute('data-new')).toBe('1')
    expect(document.querySelector('[data-legal-firm-area="gaps"]')!.textContent).toBe('Counties with a case and no firm · 1')
    expect(document.querySelector('[data-legal-firm-extend-changes]')!.textContent).toBe('Adds Bastrop County, Caldwell County, Hays County, Travis County and Williamson County.')
    // The first save ends the default: the words name the case it leaves with no firm.
    expect(document.querySelector('[data-legal-firm-bridge-ends]')!.textContent).toBe('Saving ends the default. 1 case sits where no firm covers: Kettle Creek Farms in Gonzales County. Add its county too, or the desk cannot release it.')
    fireEvent.click(screen.getByRole('button', { name: 'Save 5 counties' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    // v2.6227: one database call, every county with its firms, its first call and what the picker read.
    const save = db.rpcs.find((r) => r.name === 'legal_save_county_coverage')!
    expect((save.args as { p_counties: Array<{ county: string; firms: string[]; first_call: string; was: string[] }> }).p_counties.map((c) => `${c.county}:${c.firms.join('+')}:${c.first_call}:${c.was.length}`)).toEqual(['Bastrop:firm-1:firm-1:0', 'Caldwell:firm-1:firm-1:0', 'Hays:firm-1:firm-1:0', 'Travis:firm-1:firm-1:0', 'Williamson:firm-1:firm-1:0'])
    expect(await screen.findByText('5 counties saved. The Legal desk reads them now.')).toBeTruthy()
  })

  it('the office reads the coverage too, without the dev’s presses (v2.6195)', async () => {
    renderWindow({ canEdit: false, firms: FIRMS, coverage: new Map(), cases: CASES })
    await settle()
    expect(document.querySelector('[data-legal-firm-nudge]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Color ZZ Test Firm’s counties…' })).toBeNull()
    expect(document.querySelector('[data-legal-firm-readonly]')).toBeTruthy()
  })

  it('the office sees no Extend coverage… on a firm that covers counties (v2.6221)', async () => {
    renderWindow({ canEdit: false, firms: FIRMS, coverage: COVERED, cases: CASES, onShowOnMap: vi.fn() })
    await settle()
    expect(document.querySelector('[data-legal-firm-coverage-rows]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Extend coverage…' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show on the desk map ›' })).toBeTruthy()
  })

  it('a county the firm shares reads also with the first call named; while editing, Make first call changes it (v2.6227)', async () => {
    db.rpcs.length = 0
    const ALAMO = { ...firm, id: 'firm-2', name: 'ZZ Alamo' } as LegalFirmRow
    const shared = new Map([['Travis', { first: 'firm-1', also: [] }], ['Comal', { first: 'firm-2', also: ['firm-1'] }]])
    const { onSaved } = renderWindow({ canEdit: true, firms: [firm, ALAMO], coverage: shared, cases: CASES })
    await settle()
    expect(document.querySelector('[data-legal-firm-coverage-counties]')!.textContent).toBe('2 counties')
    expect(document.querySelector('[data-legal-firm-coverage-row="Comal"] [data-legal-firm-coverage-also]')!.textContent).toBe('also covers · ZZ Alamo first call')
    expect(document.querySelector('[data-legal-firm-coverage-sum]')!.textContent).toContain('2 counties · 1 shared')
    expect(screen.queryByRole('button', { name: 'Make first call' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Extend coverage…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Make first call' }))
    expect(await screen.findByText('ZZ Test Firm is first call in Comal once you save. ZZ Alamo still covers it.')).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-extend-changes]')!.textContent).toBe('Takes first call in Comal County from ZZ Alamo.')
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 county' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const save = db.rpcs.find((r) => r.name === 'legal_save_county_coverage')!
    expect((save.args as { p_counties: unknown }).p_counties).toEqual([{ county: 'Comal', firms: ['firm-1', 'firm-2'], first_call: 'firm-1', was: ['firm-1', 'firm-2'] }])
  })

  it('Click’s particulars fold behind Edit particulars in the window (v2.6195)', async () => {
    renderWindow({ canEdit: true })
    await settle()
    expect(await screen.findByText('2 of 8 filled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save particulars' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit particulars' }))
    expect(screen.getByRole('button', { name: 'Save particulars' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide particulars' })).toBeTruthy()
  })

  it('everyone else reads the firm and is told who can change it', async () => {
    renderWindow({ canEdit: false })
    await settle()
    expect(document.querySelector('[data-legal-firm-readonly]')).toBeTruthy()
    // The firm's name is the window's title now (v2.6195) and the read-only row under it.
    expect(document.querySelector('[data-legal-firm-title]')!.textContent).toContain('ZZ Test Firm')
    expect(screen.getAllByText('ZZ Test Firm').length).toBe(2)
    expect(screen.getByText('Dana Holt')).toBeTruthy()
    expect(screen.getByText('1 account with the firm')).toBeTruthy()
    expect(screen.getByText('Only a dev can change the firm. Ask a dev to update it.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Open in Settings ↗' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save firm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Replace with a new firm…' })).toBeNull()
  })

  it('shows the firm’s answers to Start here with when and who, and stamps new ones read, which reloads the desk (v2.4821)', async () => {
    db.rpcs.length = 0
    const answered = { ...firm, intake: { needs: 'The W-9.', fileWhere: 'Hays County', efile: 'yes', constable: 'depends', rules: 'changes', rulesNote: 'Holidays.' }, intake_sent_at: '2026-10-07T15:00:00Z', intake_sent_by: 'Ann Sample', intake_seen_at: null } as LegalFirmRow
    const { onSaved } = renderWindow({ canEdit: false, firm: answered })
    await settle()
    const box = document.querySelector('[data-legal-firm-intake]') as HTMLElement
    expect(box.getAttribute('data-legal-firm-intake')).toBe('new')
    expect(box.textContent).toContain('Sent Oct 7 by Ann Sample.')
    expect(box.textContent).toContain('Hays County')
    expect(box.textContent).toContain('It depends')
    expect(box.textContent).toContain('Holidays.')
    await waitFor(() => expect(db.rpcs).toEqual([{ name: 'legal_firm_intake_seen', args: { p_firm_id: 'firm-1' } }]))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('a firm that has not answered says so, and nothing is stamped', async () => {
    db.rpcs.length = 0
    renderWindow({ canEdit: false })
    await settle()
    expect(document.querySelector('[data-legal-firm-intake]')!.textContent).toContain('Not answered yet.')
    expect(db.rpcs).toEqual([])
  })

  it('says so when no firm is set up', async () => {
    renderWindow({ canEdit: false, firm: null })
    await settle()
    expect(screen.getByText('No collections law firm is set up yet.')).toBeTruthy()
    expect(document.querySelector('[data-legal-firm-facts]')).toBeNull()
  })

  it('Esc and a click outside close the window and nothing else', async () => {
    const { onClose } = renderWindow({ canEdit: false })
    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog', { name: 'The collections law firm' }).parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('dialog', { name: 'The collections law firm' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

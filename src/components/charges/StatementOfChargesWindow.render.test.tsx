// @vitest-environment jsdom
/**
 * Render smokes for the Statement of charges window (punch list #254, PR 2): the read sets the span to what the job
 * holds and draws the paper with its counts and the charged total; the office-copy and imported-days switches change
 * the paper; Save files a draft and shows the record id; a read that fails names its reason with Try again; a saved
 * statement opens frozen on its own snapshot.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { read: unknown; fail: string | null; saved: unknown[] } = { read: null, fail: null, saved: [] }

vi.mock('../../lib/charges/jobChargesRead', () => ({
  loadJobCharges: async () => {
    if (state.fail) throw new Error(state.fail)
    return state.read
  },
}))
vi.mock('../../lib/charges/chargeStatementsIo', () => ({
  saveChargeStatement: async (args: { id: string | null; state: string; snapshot: unknown; figures: unknown }) => {
    state.saved.push(args)
    return { id: 'row-1', record_id: 'SC-629-0001', job_ledger_id: 'j1', period_start: '2026-04-24', period_end: '2026-04-25', snapshot: args.snapshot, labor_usd: 4970, materials_usd: 1778.85, charges_usd: 6748.85, premium_usd: 3251.15, state: args.state, prepared_by: 'u-me', prepared_at: '2026-11-03T10:00:00Z', created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z', prepared_by_user: { name: 'Dana Office' } }
  },
}))
const printSpy = vi.fn((build: () => Promise<string>) => build().then(() => true))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({ openHtmlWindowWhenReady: (build: () => Promise<string>) => printSpy(build) }))

import StatementOfChargesWindow from './StatementOfChargesWindow'
import { renderWithProviders } from '../../test/renderSmokeMocks'

// Every name, job and number here is made up.
const CARD = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const INPUT = {
  sessions: [
    { userId: 't', name: 'Tomas', standing: 'master', workDate: '2026-04-24', hours: 8, imported: true },
    { userId: 'z', name: 'Zed', standing: 'tech', workDate: '2026-04-24', hours: 7.66, imported: false },
    { userId: 'z', name: 'Zed', standing: 'tech', workDate: '2026-04-25', hours: 9.44, imported: false },
  ],
  lines: [{ id: 'inv:1', kind: 'supply_invoice', label: 'A supply house · invoice 1001', dateKey: '2026-04-01', cost: 1423.08 }],
  card: CARD,
  rule: { kind: 'shape', shape: 'master_helper' },
  markupPct: null,
  adjustments: [],
  revenue: 10000,
}
const READ = { input: INPUT, job: { id: 'j1', number: '629', name: 'ROUGH IN', customerName: 'A customer', revenue: 10000 }, rule: INPUT.rule, jobMarkupPct: null, adjustments: [], adjustmentsError: null }
const job = { id: 'j1', number: '629', name: 'ROUGH IN', customer: 'A customer', site: '1 Field Rd' }
const preparedBy = { userId: 'u-me', name: 'Dana Office' }

describe('StatementOfChargesWindow', () => {
  it('reads the job, sets the span to what it holds, draws the paper with its counts, and Save files a draft', async () => {
    state.read = READ
    state.fail = null
    state.saved = []
    renderWithProviders(<StatementOfChargesWindow job={job} existing={null} preparedBy={preparedBy} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('soc-span')).toBeTruthy())
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-04-01')
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-04-25')
    expect(screen.getByTestId('soc-span').textContent).toContain('2 crew-days in this span')
    expect(screen.getByTestId('soc-span').textContent).toContain('1 material line')
    expect(screen.getByTestId('soc-charged').getAttribute('aria-label')).toBe('$6,749.25')
    const paper = screen.getByTestId('soc-paper') as HTMLIFrameElement
    expect(paper.getAttribute('srcdoc')).toContain('<h1>Statement of charges</h1>')
    expect(paper.getAttribute('srcdoc')).toContain('Office only')
    expect(paper.getAttribute('srcdoc')).toContain('imported from the pay records')
    fireEvent.click(screen.getByTestId('soc-save'))
    await waitFor(() => expect(screen.getByTestId('soc-saved').textContent).toContain('Saved as SC-629-0001 · Draft'))
    expect(state.saved).toHaveLength(1)
    expect((state.saved[0] as { state: string }).state).toBe('draft')
    expect((state.saved[0] as { figures: { chargesUsd: number } }).figures.chargesUsd).toBe(6749.25)
  })

  it('the customer copy drops the office box, the imported-days switch drops the line, and Print saves it as printed', async () => {
    state.read = READ
    state.saved = []
    renderWithProviders(<StatementOfChargesWindow job={job} existing={null} preparedBy={preparedBy} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('soc-span')).toBeTruthy())
    fireEvent.click(screen.getByTestId('soc-office-copy'))
    fireEvent.click(screen.getByTestId('soc-name-imported'))
    const paper = screen.getByTestId('soc-paper') as HTMLIFrameElement
    expect(paper.getAttribute('srcdoc')).not.toContain('Office only')
    expect(paper.getAttribute('srcdoc')).not.toContain('imported from the pay records')
    fireEvent.click(screen.getByTestId('soc-print'))
    await waitFor(() => expect(printSpy).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('soc-saved').textContent).toContain('Printed'))
    expect((state.saved[0] as { state: string }).state).toBe('printed')
  })

  it('a read that fails names its reason with Try again', async () => {
    state.fail = 'the network dropped'
    renderWithProviders(<StatementOfChargesWindow job={job} existing={null} preparedBy={preparedBy} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('soc-error')).toBeTruthy())
    expect(screen.getByTestId('soc-error').textContent).toContain('the network dropped')
    expect(screen.getByText('Try again')).toBeTruthy()
    state.fail = null
  })

  it('a saved statement opens frozen on its snapshot: the span and Save are off, Print still prints it', async () => {
    const snapshot = { input: INPUT, period: { start: '2026-04-24', end: '2026-04-25' }, job: { number: '629', name: 'ROUGH IN', customer: 'A customer', site: '1 Field Rd' }, preparedBy: 'Dana Office', preparedOn: 'November 3, 2026', asOf: 'Nov 3, 10:00 AM', nameImportedDays: true }
    const existing = { id: 'row-1', record_id: 'SC-629-0001', job_ledger_id: 'j1', period_start: '2026-04-24', period_end: '2026-04-25', snapshot, labor_usd: 4970, materials_usd: 1778.85, charges_usd: 6748.85, premium_usd: 3251.15, state: 'printed' as const, prepared_by: 'u-me', prepared_at: '2026-11-03T10:00:00Z', created_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z', prepared_by_user: { name: 'Dana Office' } }
    renderWithProviders(<StatementOfChargesWindow job={job} existing={existing} preparedBy={preparedBy} onClose={() => {}} />)
    expect((screen.getByLabelText('From') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByTestId('soc-save') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('soc-print') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('soc-saved').textContent).toContain('SC-629-0001 · Printed')
    expect(screen.getByText('A saved statement prints as it read; make a new one for today’s rows.')).toBeTruthy()
    expect((screen.getByTestId('soc-paper') as HTMLIFrameElement).getAttribute('srcdoc')).toContain('Statement SC-629-0001')
  })
})

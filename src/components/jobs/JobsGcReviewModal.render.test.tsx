// @vitest-environment jsdom
/**
 * Render smoke for GC Review as a whole: the stage track sits over one row per
 * GC, a row opens onto its bills, a stage narrows the list and closing the
 * window clears it, the board and the scheduled sends are tabs, and the total
 * stays on screen. The week's data is mocked at the IO modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import { gcReviewWeekStartYmd, type GcReviewCertRow } from '../../lib/jobs/gcReviewCertification'
import type { RoundMarkRow } from '../../lib/jobs/gcStatementRounds'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { JobsGcReviewModal } from './JobsGcReviewModal'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useGcPortalLinks', () => ({ useGcPortalLinks: () => ({ links: new Map(), loaded: true, refresh: () => {} }) }))
vi.mock('../customers/CustomerPortalGlobeButton', () => ({ default: () => null }))
// jsdom has no window.scrollTo for the lock's release.
vi.mock('../../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: () => {} }))
vi.mock('../../lib/fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: vi.fn(async () => ({ data: [], error: null })) }))

const certs = vi.hoisted(() => ({ rows: [] as unknown[] }))
const marks = vi.hoisted(() => ({ rows: [] as unknown[] }))
vi.mock('../../lib/gcReviewCertifications', async (original) => ({
  ...(await original<typeof import('../../lib/gcReviewCertifications')>()),
  listGcReviewCertifications: vi.fn(async () => certs.rows),
}))
vi.mock('../../lib/gcStatementRoundIo', async (original) => ({
  ...(await original<typeof import('../../lib/gcStatementRoundIo')>()),
  listGcStatementRoundMarks: vi.fn(async () => marks.rows),
  listGcStatementRoundMarksSince: vi.fn(async () => marks.rows),
  listGcStatementSenders: vi.fn(async () => new Map()),
}))

const WEEK = gcReviewWeekStartYmd()
const KNIGHT = { id: 'gc-knight', name: 'Knight Contracting' }
const LOBERG = { id: 'gc-loberg', name: 'Loberg Contracting' }
const HARPER = { id: 'gc-harper', name: 'TF Harper' }
const OLDCO = { id: 'gc-oldco', name: 'Oldco Builders' }

function job(over: Partial<JobWithDetails> & Pick<JobWithDetails, 'id'>): JobWithDetails {
  return {
    status: 'billed',
    ...(over.gcCustomer ? { gc_customer_id: over.gcCustomer.id, bill_to_party: 'gc' } : {}),
    hcp_number: '100',
    click_number: '',
    job_name: 'Job',
    customer_name: 'Cust',
    revenue: 1000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...over,
  } as JobWithDetails
}

function invRow(id: string, j: JobWithDetails, amount: number): StageRow {
  return { kind: 'invoice', job: j, inv: { id, job_id: j.id, amount, status: 'billed', sequence_order: 0, billed_at: '2026-07-01T00:00:00Z', estimated_bill_date: null } as never }
}

/** Knight $26,000 (checked), Loberg $22,000 (checked and sent), TF Harper $30,000 (nothing yet); Oldco owes only in Collections. */
const billedActiveRows: StageRow[] = [
  invRow('i-knight', job({ id: 'j-knight', gcCustomer: KNIGHT, hcp_number: '651', job_name: 'Palomino Trail' }), 26000),
  invRow('i-loberg', job({ id: 'j-loberg', gcCustomer: LOBERG, hcp_number: '186', job_name: 'Quarry Bend' }), 22000),
  invRow('i-harper', job({ id: 'j-harper', gcCustomer: HARPER, hcp_number: '790', job_name: 'Terrell Rd' }), 30000),
]
const collectionsRows: StageRow[] = [invRow('i-oldco', job({ id: 'j-oldco', gcCustomer: OLDCO, hcp_number: '412', job_name: 'Heron Ct' }), 5000)]

const cert = (gcId: string, total: number): GcReviewCertRow => ({ week_start: WEEK, gc_customer_id: gcId, certified_by_name: 'Taunya', certified_at: `${WEEK}T15:00:00Z`, job_count: 1, total, snapshot: null, note: '' })
const sentMark = (gcId: string): RoundMarkRow => ({ gc_customer_id: gcId, week_start: WEEK, action: 'sent', acted_by: 'u-taunya', acted_by_name: 'Taunya', acted_at: `${WEEK}T16:00:00Z`, channel: 'email', note: null, temperature: null, expected_pay_by: null })

const props = (over: Partial<ComponentProps<typeof JobsGcReviewModal>> = {}): ComponentProps<typeof JobsGcReviewModal> => ({
  open: true,
  onClose: vi.fn(),
  billedActiveRows,
  collectionsRows,
  onPrint: vi.fn(),
  onCopyForEmail: vi.fn(),
  onSendStatement: vi.fn(async () => ({ ok: true })),
  emailForGc: () => '',
  lastSentByGcId: {},
  users: [{ id: 'u-taunya', name: 'Taunya', email: 'taunya@example.com', role: 'assistant' }],
  isDev: false,
  canCertify: true,
  ...over,
})

/** Past the week's load: Knight's row reads Checked once the certifications are in. */
const open = (over: Partial<ComponentProps<typeof JobsGcReviewModal>> = {}) =>
  renderSettled(<JobsGcReviewModal {...props(over)} />, { loaded: () => screen.findByRole('button', { name: 'Check: 1 to check, 2 of 3 done — you are here' }) })

const rows = () => screen.getAllByTestId('gc-worklist-row')
const rowFor = (name: string) => rows().find((el) => within(el).queryByText(name))!

beforeEach(() => {
  certs.rows = [cert(KNIGHT.id, 26000), cert(LOBERG.id, 22000)]
  marks.rows = [sentMark(LOBERG.id)]
})

describe('JobsGcReviewModal', () => {
  it('shows where the week stands over one row per GC, the total under it', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Send: 1 to send, 1 of 3 done' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Word: 1 word due, 0 of 3 done' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done: 0 of 3' })).toBeTruthy()
    expect(rows()).toHaveLength(3)
    // Each GC once; its bills stay folded until asked for.
    expect(screen.getAllByText('Knight Contracting')).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Total outstanding').textContent).toContain('$83,000.00')
  })

  it('a row opens onto its statement: the chips, Share and the bills', async () => {
    await open()
    fireEvent.click(within(rowFor('Knight Contracting')).getByRole('button', { name: 'Show Knight Contracting’s bills' }))
    const knight = within(rowFor('Knight Contracting'))
    expect(knight.getByRole('table')).toBeTruthy()
    expect(knight.getByText(/651 · Palomino Trail/)).toBeTruthy()
    expect(knight.getByText(/✓ Certified · Taunya/)).toBeTruthy()
    expect(knight.getByRole('button', { name: 'Share statement for Knight Contracting' })).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(1)
    fireEvent.click(knight.getByRole('button', { name: 'Hide Knight Contracting’s bills' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a stage narrows the list to the GCs waiting there, and closing the window clears it', async () => {
    const view = await open()
    fireEvent.click(screen.getByRole('button', { name: /^Send:/ }))
    expect(rows()).toHaveLength(1)
    expect(rowFor('Knight Contracting')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 3 GCs — checked and waiting to go out · $26,000.00')
    // The GC the week asks nothing of is not "waiting to go out" either.
    expect(screen.queryByText('Oldco Builders')).toBeNull()
    view.rerender(<JobsGcReviewModal {...props({ open: false })} />)
    await settle()
    view.rerender(<JobsGcReviewModal {...props()} />)
    await screen.findByRole('button', { name: /^Check: 1 to check/ })
    expect(rows()).toHaveLength(3)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('the next step opens the window that does it', async () => {
    await open()
    fireEvent.click(within(rowFor('TF Harper')).getByRole('button', { name: 'Check bills' }))
    expect(await screen.findByRole('dialog', { name: /TF Harper/ })).toBeTruthy()
  })

  it('a GC that owes only in Collections has a statement and no steps', async () => {
    await open()
    expect(screen.getByText('Nothing to check this week')).toBeTruthy()
    const oldco = screen.getByTestId('gc-review-other-row')
    expect(within(oldco).getByText('Oldco Builders')).toBeTruthy()
    expect(within(oldco).queryByRole('button', { name: /step/ })).toBeNull()
    fireEvent.click(within(oldco).getByRole('button', { name: 'Show Oldco Builders’s bills' }))
    expect(within(oldco).getByText(/412 · Heron Ct/)).toBeTruthy()
    // Unticking Include Collections takes it, and its money, off the screen.
    fireEvent.click(screen.getByRole('checkbox', { name: /Include Collections/ }))
    expect(screen.queryByText('Oldco Builders')).toBeNull()
    expect(screen.getByText('Total outstanding').textContent).toContain('$78,000.00')
  })

  it('the temperature board and the scheduled sends are tabs; the track belongs to the week', async () => {
    await open()
    expect(screen.getByRole('tab', { name: /This week/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Temperature' }))
    expect(screen.getByText('Temperature board')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Where this week stands' })).toBeNull()
    expect(screen.queryAllByTestId('gc-worklist-row')).toHaveLength(0)
    expect(screen.getByText('Total outstanding')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Scheduled/ }))
    expect(screen.getByText('No statement sends are scheduled.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Email me the week’s list…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /This week/ }))
    expect(screen.getByRole('group', { name: 'Where this week stands' })).toBeTruthy()
  })

  it('someone who cannot act reads the track and the rows, and gets no step buttons', async () => {
    await open({ canCertify: false })
    expect(rows()).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Check bills' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
  })

  it('the call sheet carries each GC’s bills, and a bill opens its job over the sheet', async () => {
    const onOpenJobDetail = vi.fn()
    await open({ onOpenJobDetail })
    fireEvent.click(screen.getByRole('button', { name: /Call sheet/ }))
    const sheet = within(await screen.findByRole('dialog', { name: /^Call sheet/ }))
    const knight = within(sheet.getAllByTestId('gc-call-sheet-row').find((el) => within(el).queryByText('Knight Contracting'))!)
    fireEvent.click(knight.getByRole('button', { name: 'Show Knight Contracting’s bills' }))
    expect(knight.getByText('1 bill — what Knight Contracting owes').nextElementSibling?.textContent).toBe('$26,000.00')
    fireEvent.click(knight.getByRole('button', { name: '651 · Palomino Trail' }))
    expect(onOpenJobDetail).toHaveBeenCalledWith('j-knight')
    expect(sheet.getAllByTestId('gc-call-sheet-row')).toHaveLength(3)
  })

  it('a GC’s Collections bills are on its call sheet, outside its total', async () => {
    const knightInCollections = invRow('i-knight-old', job({ id: 'j-knight-old', gcCustomer: KNIGHT, hcp_number: '412', job_name: 'Heron Ct' }), 1500)
    await open({ collectionsRows: [...collectionsRows, knightInCollections] })
    fireEvent.click(screen.getByRole('button', { name: /Call sheet/ }))
    const sheet = within(await screen.findByRole('dialog', { name: /^Call sheet/ }))
    const knight = within(sheet.getAllByTestId('gc-call-sheet-row').find((el) => within(el).queryByText('Knight Contracting'))!)
    fireEvent.click(knight.getByRole('button', { name: 'Show Knight Contracting’s bills' }))
    expect(knight.getAllByTestId('gc-bill-line')).toHaveLength(2)
    expect(knight.getByText(/not in the \$26,000\.00 above: \$1,500\.00/)).toBeTruthy()
  })

  it('By Development lists each development once, with its bills inside and no track', async () => {
    const SAGE = { id: 'dev-sage', name: 'Sage Meadows' }
    const rowsWithDevelopment = [
      invRow('i-knight', job({ id: 'j-knight', gcCustomer: KNIGHT, development: SAGE, hcp_number: '651', job_name: 'Palomino Trail' }), 26000),
      invRow('i-loberg', job({ id: 'j-loberg', gcCustomer: LOBERG, hcp_number: '186', job_name: 'Quarry Bend' }), 22000),
    ]
    await renderSettled(<JobsGcReviewModal {...props({ billedActiveRows: rowsWithDevelopment, collectionsRows: [] })} />, { loaded: () => screen.findByRole('button', { name: /^Send: 1 to send/ }) })
    fireEvent.click(screen.getByRole('button', { name: 'By Development' }))
    expect(screen.queryByRole('group', { name: 'Where this week stands' })).toBeNull()
    expect(screen.queryAllByTestId('gc-worklist-row')).toHaveLength(0)
    expect(screen.getByRole('tab', { name: /Developments/ })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Temperature' })).toBeNull()
    const groups = screen.getAllByTestId('gc-review-other-row')
    expect(groups.map((g) => within(g).getAllByText(/Sage Meadows|No development set/)[0]?.textContent)).toEqual(['Sage Meadows', 'No development set'])
    fireEvent.click(within(groups[0]!).getByRole('button', { name: 'Show Sage Meadows’s bills' }))
    expect(within(screen.getAllByTestId('gc-review-other-row')[0]!).getByText(/651 · Palomino Trail/)).toBeTruthy()
    expect(screen.getByText('Total outstanding').textContent).toContain('$48,000.00')
    // Back under By GC the track is there again.
    fireEvent.click(screen.getByRole('button', { name: 'By GC' }))
    expect(screen.getByRole('group', { name: 'Where this week stands' })).toBeTruthy()
  })
})

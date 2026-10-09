// @vitest-environment jsdom
/**
 * Render smoke for GC Review as a whole: the stage track sits over one row per
 * GC, a row opens onto its bills, a stage narrows the list and closing the
 * window clears it, the board and the scheduled sends are tabs, and the total
 * stays on screen. The week's data is mocked at the IO modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import { gcReviewWeekStartYmd, type GcReviewCertRow } from '../../lib/jobs/gcReviewCertification'
import { listGcReviewCertifications } from '../../lib/gcReviewCertifications'
import { GC_STATEMENT_UNCHECKED_WORDS } from '../../../supabase/functions/_shared/gcStatementGate'
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
    // The bill's two lien waivers (v2.4280): nothing started on an open bill. Calm since v2.4317, like the Bill tab:
    // grey until a waiver is under way, so amber means a step is owed on one you started.
    expect(knight.getByText('Lien waivers')).toBeTruthy()
    const waivers = knight.getByTestId('gc-review-waivers')
    expect(waivers.textContent).toContain('Conditional · not added')
    expect(waivers.textContent).toContain('Unconditional · when paid')
    expect(waivers.textContent).not.toContain('send it')
    expect(knight.getByText(/✓ Certified · Taunya/)).toBeTruthy()
    expect(knight.getByRole('button', { name: 'Share statement for Knight Contracting' })).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(1)
    fireEvent.click(knight.getByRole('button', { name: 'Hide Knight Contracting’s bills' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('on a phone an opened GC lists its bills as cards, not the wide table: the job and what is open, when, the waivers', async () => {
    const wide = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 640px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
    try {
      const onOpenJob = vi.fn()
      await open({ onOpenJob })
      fireEvent.click(within(rowFor('Knight Contracting')).getByRole('button', { name: 'Show Knight Contracting’s bills' }))
      const knight = within(rowFor('Knight Contracting'))
      expect(knight.queryByRole('table')).toBeNull()
      const card = knight.getByTestId('gc-review-bills')
      fireEvent.click(within(card).getByRole('button', { name: '651 · Palomino Trail' }))
      expect(onOpenJob).toHaveBeenCalledWith('j-knight')
      expect(card.textContent).toContain('$26,000.00 open')
      // "Cust" is not in the job's name, so the line under the address leads with it.
      expect(card.querySelector('.when')?.textContent).toMatch(/^Cust · billed \w{3} \d{1,2}, 2026 · \d+ d$/)
      const waivers = within(card).getByTestId('gc-review-waivers')
      expect(waivers.textContent).toContain('Conditional · not added')
      expect(waivers.textContent).toContain('Unconditional · when paid')
    } finally {
      window.matchMedia = wide
    }
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

  it('Preview shows the statement over the dialog, and Back returns to what was typed', async () => {
    const windowOpen = vi.spyOn(window, 'open')
    await open()
    fireEvent.click(within(rowFor('Knight Contracting')).getByRole('button', { name: 'Send' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Email statement to Knight Contracting' }))
    // The header (v2.4262): no GC address on file, so To starts empty and a typed address is picked from the menu.
    fireEvent.click(dialog.getByRole('button', { name: '+ Pick who gets it' }))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Search a name or type an address' }), { target: { value: 'ap@knight.example' } })
    fireEvent.click(dialog.getByRole('option', { name: /^Use ap@knight\.example/ }))
    expect(dialog.getByTestId('rcp-readback').textContent).toBe('Goes to ap@knight.example. Their reply comes to you.')
    fireEvent.click(dialog.getByRole('button', { name: 'Preview' }))
    const preview = await screen.findByRole('dialog', { name: 'Preview: Statement to Knight Contracting' })
    expect(within(preview).getByText('Preview. Nothing has been sent.')).toBeTruthy()
    const frame = within(preview).getByTitle('Preview: Statement to Knight Contracting') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('Palomino Trail')
    expect(frame.getAttribute('srcdoc')).toContain('<base target="_blank">')
    expect(windowOpen).not.toHaveBeenCalled()
    // Escape closes the preview alone; the dialog and its address are still there.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Preview: Statement to Knight Contracting' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove ap@knight.example from To' })).toBeTruthy()
    windowOpen.mockRestore()
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
    // Find a check follows the switch (v2.4912): offered on a development, and it opens on the development.
    fireEvent.click(within(screen.getAllByTestId('gc-review-other-row')[0]!).getByRole('button', { name: 'Share statement for Sage Meadows' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find a check…' }))
    expect(await screen.findByRole('dialog', { name: 'Find a check — Sage Meadows' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close Find a check' }))
    // Back under By GC the track is there again.
    fireEvent.click(screen.getByRole('button', { name: 'By GC' }))
    expect(screen.getByRole('group', { name: 'Where this week stands' })).toBeTruthy()
  })
})

/** Opens a GC's statement and its Share menu (v2.5022): the menu holds the three doors a statement leaves by. */
function openShare(name: string, row: () => HTMLElement) {
  fireEvent.click(within(row()).getByRole('button', { name: `Show ${name}’s bills` }))
  fireEvent.click(within(row()).getByRole('button', { name: `Share statement for ${name}` }))
  return within(within(row()).getByRole('menu'))
}
const door = (menu: ReturnType<typeof openShare>, name: string) => menu.getByRole('button', { name }) as HTMLButtonElement

describe('JobsGcReviewModal — a statement never goes out unchecked (v2.5022)', () => {
  it('a GC not checked this week: Draft Message, Copy and Print say why, in the words of the row’s Send, and do nothing', async () => {
    const onCopyForEmail = vi.fn()
    const onPrint = vi.fn()
    await open({ onCopyForEmail, onPrint })
    expect(within(rowFor('TF Harper')).getByTitle(GC_STATEMENT_UNCHECKED_WORDS).getAttribute('data-state')).toBe('locked')
    const menu = openShare('TF Harper', () => rowFor('TF Harper'))
    expect(menu.getByTestId('gc-statement-held').textContent).toBe(GC_STATEMENT_UNCHECKED_WORDS)
    for (const name of ['Draft Message', 'Copy', 'Print']) {
      expect(door(menu, name).disabled).toBe(true)
      fireEvent.click(door(menu, name))
    }
    expect(onCopyForEmail).not.toHaveBeenCalled()
    expect(onPrint).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Email statement to TF Harper' })).toBeNull()
    // Only the statement waits: finding a check is not sending one.
    expect(door(menu, 'Find a check…').disabled).toBe(false)
  })

  it('a checked GC’s statement goes out by every door', async () => {
    const onCopyForEmail = vi.fn()
    const onPrint = vi.fn()
    await open({ onCopyForEmail, onPrint })
    const knight = () => rowFor('Knight Contracting')
    let menu = openShare('Knight Contracting', knight)
    expect(menu.queryByTestId('gc-statement-held')).toBeNull()
    fireEvent.click(door(menu, 'Copy'))
    expect(onCopyForEmail).toHaveBeenCalledTimes(1)
    expect(onCopyForEmail.mock.calls[0]![0]).toMatchObject({ gcId: KNIGHT.id })
    fireEvent.click(within(knight()).getByRole('button', { name: 'Share statement for Knight Contracting' }))
    menu = within(within(knight()).getByRole('menu'))
    fireEvent.click(door(menu, 'Print'))
    expect(onPrint).toHaveBeenCalledTimes(1)
    fireEvent.click(within(knight()).getByRole('button', { name: 'Share statement for Knight Contracting' }))
    menu = within(within(knight()).getByRole('menu'))
    fireEvent.click(door(menu, 'Draft Message'))
    expect(await screen.findByRole('dialog', { name: 'Email statement to Knight Contracting' })).toBeTruthy()
  })

  it('checked, then a bill landed: the doors wait for the re-check', async () => {
    certs.rows = [cert(KNIGHT.id, 25000), cert(LOBERG.id, 22000)]
    await renderSettled(<JobsGcReviewModal {...props()} />, { loaded: () => screen.findByRole('button', { name: /^Check: 2 to check/ }) })
    const menu = openShare('Knight Contracting', () => rowFor('Knight Contracting'))
    expect(menu.getByTestId('gc-statement-held').textContent).toBe(GC_STATEMENT_UNCHECKED_WORDS)
    expect(door(menu, 'Copy').disabled).toBe(true)
  })

  it('a GC that owes only in Collections has nothing to check, and its doors stay open', async () => {
    const onCopyForEmail = vi.fn()
    await open({ onCopyForEmail })
    const menu = openShare('Oldco Builders', () => screen.getByTestId('gc-review-other-row'))
    expect(menu.queryByTestId('gc-statement-held')).toBeNull()
    fireEvent.click(door(menu, 'Copy'))
    expect(onCopyForEmail).toHaveBeenCalledTimes(1)
  })

  it('when the week’s checks cannot be read, the doors say that rather than calling a checked GC unchecked', async () => {
    vi.mocked(listGcReviewCertifications).mockRejectedValueOnce(new Error('offline'))
    await renderSettled(<JobsGcReviewModal {...props()} />, { loaded: () => screen.findByRole('button', { name: /^Check: 2 to check/ }) })
    await settle()
    const menu = openShare('Knight Contracting', () => rowFor('Knight Contracting'))
    expect(menu.getByTestId('gc-statement-held').textContent).toBe('This week’s checks could not be read. Close GC Review and open it again.')
    expect(door(menu, 'Draft Message').disabled).toBe(true)
  })

  it('Print all leaves out a GC not checked this week and says so; the checked ones still print', async () => {
    const onPrint = vi.fn()
    await open({ onPrint })
    fireEvent.click(screen.getByRole('button', { name: 'Print all' }))
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect((onPrint.mock.calls[0]![0] as Array<{ gcName: string }>).map((g) => g.gcName)).toEqual(['Knight Contracting', 'Loberg Contracting', 'Oldco Builders'])
    expect(await screen.findByText('3 printed · 1 held: not checked this week')).toBeTruthy()
  })

  it('Share all names the held GC, and its email carries the checked GCs with the held line on top', async () => {
    const onSendStatement = vi.fn(async (_p: { groupBy: string; emailHtml: string; total: number }) => ({ ok: true }))
    await open({ onSendStatement })
    fireEvent.click(screen.getByRole('button', { name: 'Share the whole GC Review report' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Share the whole GC Review report' }))
    expect(dialog.getByTestId('gc-report-held').textContent).toContain('Held, not checked this week: TF Harper')
    expect(dialog.getByText(/^3 GC sections/)).toBeTruthy()
    fireEvent.change(dialog.getByPlaceholderText('name@example.com'), { target: { value: 'office@example.com' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(onSendStatement).toHaveBeenCalledTimes(1))
    const sent = onSendStatement.mock.calls[0]![0]
    expect(sent.groupBy).toBe('all')
    expect(sent.emailHtml).toContain('Held, not checked this week: TF Harper')
    expect(sent.emailHtml).toContain('Palomino Trail')
    expect(sent.emailHtml).not.toContain('Terrell Rd')
    expect(sent.total).toBe(26000 + 22000 + 5000)
    expect(await screen.findByText('3 sent · 1 held: not checked this week')).toBeTruthy()
  })

  it('By Development, Print all prints every section: development statements are not held', async () => {
    const onPrint = vi.fn()
    const SAGE = { id: 'dev-sage', name: 'Sage Meadows' }
    const withDevelopment = [invRow('i-knight', job({ id: 'j-knight', gcCustomer: KNIGHT, development: SAGE, hcp_number: '651', job_name: 'Palomino Trail' }), 26000), ...billedActiveRows.slice(1)]
    await open({ billedActiveRows: withDevelopment, onPrint })
    fireEvent.click(screen.getByRole('button', { name: 'By Development' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print all' }))
    const printed = onPrint.mock.calls[0]![0] as Array<{ gcName: string; subtotal: number }>
    expect(printed.reduce((t, g) => t + g.subtotal, 0)).toBe(30000 + 26000 + 22000 + 5000)
    expect(screen.queryByText(/held: not checked this week/)).toBeNull()
  })

  it('a send the server holds shows its words in the dialog', async () => {
    const onSendStatement = vi.fn(async () => ({ ok: false, error: GC_STATEMENT_UNCHECKED_WORDS }))
    await open({ onSendStatement })
    fireEvent.click(within(rowFor('Knight Contracting')).getByRole('button', { name: 'Send' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Email statement to Knight Contracting' }))
    fireEvent.click(dialog.getByRole('button', { name: '+ Pick who gets it' }))
    fireEvent.change(dialog.getByRole('textbox', { name: 'Search a name or type an address' }), { target: { value: 'ap@knight.example' } })
    fireEvent.click(dialog.getByRole('option', { name: /^Use ap@knight\.example/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Send statement' }))
    expect(await dialog.findByText(GC_STATEMENT_UNCHECKED_WORDS)).toBeTruthy()
    expect(onSendStatement).toHaveBeenCalledTimes(1)
  })
})

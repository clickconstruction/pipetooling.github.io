// @vitest-environment jsdom
/**
 * The papers' presses on the Pay view (punch list #350): Statement of account… on a person's group, Work statement…
 * in Print's place on the ⋯ menu of a sheet that is one person's, and Payment record… beside a payment in the opened
 * row. A sheet two subs share keeps Print and offers no paper. The presses are the office's: a superintendent who
 * reaches the Pay view gets none, and keeps Print.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobsSubLaborTab from './JobsSubLaborTab'

vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// Who is signed in: the office, unless a test signs a superintendent in.
const who = vi.hoisted(() => ({ superintendent: false }))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const office = useAuthModuleMock({ role: 'assistant' })
  const superintendent = useAuthModuleMock({ role: 'superintendent' })
  const signedIn = () => (who.superintendent ? superintendent : office)
  return { ...office, useAuth: () => signedIn().useAuth(), useOptionalAuth: () => signedIn().useOptionalAuth() }
})
vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))
// Made-up people: two roster subs.
vi.mock('../../hooks/useRosterSubKinds', () => ({
  useRosterSubKinds: () => ({
    loaded: true,
    roster: [
      { id: 'sam', name: 'Sam Sub', kind: 'sub', accountRole: 'subcontractor' },
      { id: 'ora', name: 'Ora Sub', kind: 'sub', accountRole: null },
    ],
  }),
}))
// The window is drawn by its own smoke. Here it only says what it was opened on.
vi.mock('./SubPapersWindowConnected', () => ({
  SubPapersWindow: (p: { open: { kind: string; sheetId?: string; sendingKey?: string }; subKey: string; name: string; onClose: () => void }) => (
    <div role="dialog" aria-label={`Papers for ${p.name}`} data-open={p.open.kind} data-sheet={p.open.sheetId ?? ''} data-sending={p.open.sendingKey ?? ''} data-key={p.subKey}>
      <button type="button" onClick={p.onClose}>
        Close the papers
      </button>
    </div>
  ),
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  who.superintendent = false
})

const mine = makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Sam Sub', job_number: 'S-212' })
const shared = makeLaborJob({ id: 'sheet-2', assigned_to_name: 'Sam Sub | Ora Sub', job_number: 'S-213' })
const ASSIGNEES = new Map([
  ['sheet-1', [{ personId: 'sam', personName: 'Sam Sub' }]],
  ['sheet-2', [{ personId: 'sam', personName: 'Sam Sub' }, { personId: 'ora', personName: 'Ora Sub' }]],
])

function mount(laborJobs = [mine]) {
  const onPrintJobSubSheet = vi.fn()
  const p = {
    error: null,
    subLaborSearch: '',
    onSubLaborSearchChange: () => {},
    laborJobs,
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    jobs: [],
    authUserId: 'u-1',
    laborJobAssigneesByJobId: ASSIGNEES,
    subLaborDueTotal: 0,
    onNewLaborJob: () => {},
    onEditLaborJob: vi.fn(),
    onPrintJobSubSheet,
    onUpdateLaborJobDate: () => {},
    onSetLaborJobStage: () => {},
    onOpenMakePayment: vi.fn(),
    onOpenBackcharge: vi.fn(),
    hideToolbar: true,
  } as unknown as Parameters<typeof JobsSubLaborTab>[0]
  renderWithProviders(<JobsSubLaborTab {...p} />)
  return { onPrintJobSubSheet }
}

describe('JobsSubLaborTab · the papers (#350)', () => {
  it("Statement of account… on a person's group opens the window on that person", async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByTestId('sublabor-statement-sam'))
    const dialog = screen.getByRole('dialog', { name: 'Papers for Sam Sub' })
    expect(dialog.getAttribute('data-open')).toBe('statement')
    expect(dialog.getAttribute('data-key')).toBe('id:sam')
    fireEvent.click(screen.getByRole('button', { name: 'Close the papers' }))
    expect(screen.queryByRole('dialog', { name: 'Papers for Sam Sub' })).toBeNull()
  })

  it("Work statement… takes Print's place on a sheet that is one person's, and opens the window on that sheet", async () => {
    const { onPrintJobSubSheet } = mount()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const items = screen.getAllByRole('menuitem').map((x) => x.textContent)
    expect(items).toContain('Work statement…')
    expect(items).not.toContain('Print')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Work statement…' }))
    const dialog = screen.getByRole('dialog', { name: 'Papers for Sam Sub' })
    expect(dialog.getAttribute('data-open')).toBe('work')
    expect(dialog.getAttribute('data-sheet')).toBe('sheet-1')
    expect(onPrintJobSubSheet).not.toHaveBeenCalled()
  })

  it('a sheet two subs share keeps Print, and its group offers no statement of account', async () => {
    const { onPrintJobSubSheet } = mount([shared])
    await settle()
    expect(screen.queryByTestId('sublabor-statement-sam')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const items = screen.getAllByRole('menuitem').map((x) => x.textContent)
    expect(items).toContain('Print')
    expect(items).not.toContain('Work statement…')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print' }))
    expect(onPrintJobSubSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'sheet-2' }))
  })

  it('Payment record… sits beside a payment: one per sending, a row with no sending its own, and none for money from a credit or a back-charge', async () => {
    const paid = makeLaborJob({
      id: 'sheet-1',
      assigned_to_name: 'Sam Sub',
      job_number: 'S-212',
      payments: [
        { id: 'pay-a', amount: 20, memo: null, created_at: '2026-11-02T10:00:00Z', method: 'check', sending_id: 'snd-7', sending_no: 7 },
        { id: 'pay-b', amount: 10, memo: null, created_at: '2026-10-02T10:00:00Z' },
        { id: 'pay-c', amount: 5, memo: null, created_at: '2026-11-03T10:00:00Z', method: 'credit' },
        { id: 'back', amount: -5, memo: 'cleanup', created_at: '2026-11-04T10:00:00Z' },
      ],
    })
    mount([paid])
    await settle()
    fireEvent.click([...document.querySelectorAll('tr')].find((tr) => tr.firstElementChild?.textContent === '▶') as HTMLElement)
    const presses = screen.getAllByRole('button', { name: 'Payment record…' })
    expect(presses).toHaveLength(2)
    fireEvent.click(presses[0]!)
    const first = screen.getByRole('dialog', { name: 'Papers for Sam Sub' })
    expect(first.getAttribute('data-open')).toBe('payment')
    const keys = [first.getAttribute('data-sending')]
    fireEvent.click(screen.getByRole('button', { name: 'Close the papers' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Payment record…' })[1]!)
    keys.push(screen.getByRole('dialog', { name: 'Papers for Sam Sub' }).getAttribute('data-sending'))
    expect(keys.sort()).toEqual(['row:pay-b', 'snd-7'])
  })

  it('a superintendent who reaches the Pay view gets no paper press, and a sheet keeps Print', async () => {
    who.superintendent = true
    // Their read hides the payments, but the press must not hang on that: a row with a payment offers none either.
    const paid = makeLaborJob({ id: 'sheet-1', assigned_to_name: 'Sam Sub', job_number: 'S-212', payments: [{ id: 'pay-a', amount: 20, memo: null, created_at: '2026-11-02T10:00:00Z', method: 'check', sending_id: 'snd-7', sending_no: 7 }] })
    const { onPrintJobSubSheet } = mount([paid])
    await settle()
    expect(screen.queryByTestId('sublabor-statement-sam')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Statement of account…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const items = screen.getAllByRole('menuitem').map((x) => x.textContent)
    expect(items).not.toContain('Work statement…')
    expect(items).toContain('Print')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print' }))
    expect(onPrintJobSubSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'sheet-1' }))
    fireEvent.click([...document.querySelectorAll('tr')].find((tr) => tr.firstElementChild?.textContent === '▶') as HTMLElement)
    expect(screen.queryByRole('button', { name: 'Payment record…' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Papers for Sam Sub' })).toBeNull()
  })
})

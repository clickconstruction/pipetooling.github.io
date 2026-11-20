// @vitest-environment jsdom
/**
 * The Record payment window as a sending (v2.7235; the owner: "overpayment -> credit"). An amount past the sheet
 * fills the sub's other open sheets oldest first, and the rest is kept as their credit. A credit they hold is
 * offered first. Until the migration is pushed a payment that stays on its sheet is recorded as it always was.
 */
import { act, createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const roster = { rows: [{ id: 'p-sam', name: 'Sub Sam', kind: 'sub', accountRole: null }] }
vi.mock('../../hooks/useRosterSubKinds', () => ({ useRosterSubKinds: () => ({ roster: roster.rows, loaded: true }) }))
// The papers window is drawn by its own smoke. Here it only says what it was opened on.
vi.mock('./SubPapersWindowConnected', () => ({
  SubPapersWindow: (p: { open: { kind: string; sendingKey?: string }; subKey: string; name: string; startOnSend?: boolean; onClose: () => void }) => (
    <div role="dialog" aria-label={`Papers for ${p.name}`} data-open={p.open.kind} data-send={String(!!p.startOnSend)} data-sending={p.open.sendingKey ?? ''} data-key={p.subKey}>
      <button type="button" onClick={p.onClose}>
        Close the papers
      </button>
    </div>
  ),
}))

import SubLaborPaymentModals, { type SubLaborPaymentModalsHandle, type SubLaborPaymentModalsProps } from './SubLaborPaymentModals'
import { makeLaborJob, renderWithProviders } from '../../test/renderSmokeMocks'
import type { SubLaborPaymentTarget, SubSendingResult } from '../../types/laborJob'

afterEach(cleanup)

// Three sheets of Sub Sam's, each agreed at $60.00 (2 fixtures × 1.5 h × $20). The window opens on `here`.
const here = makeLaborJob({ id: 'here', job_number: 'S-300', job_date: '2026-11-01' })
const older = makeLaborJob({ id: 'older', job_number: 'S-100', job_date: '2026-09-10' })
const newer = makeLaborJob({ id: 'newer', job_number: 'S-200', job_date: '2026-11-08' })
const assignees = new Map(['here', 'older', 'newer'].map((id) => [id, [{ personId: 'p-sam', personName: 'Sub Sam' }]]))
const target: SubLaborPaymentTarget = { id: 'here', contractor: 'Sub Sam', hcp: 'S-300', totalCost: 60, paid: 0, outstanding: 60 }

function mount(over: Partial<SubLaborPaymentModalsProps> = {}) {
  const props: SubLaborPaymentModalsProps = {
    recordLaborJobPayment: vi.fn(async () => {}),
    recordLaborJobBackcharge: vi.fn(async () => {}),
    deleteLaborJobPayment: vi.fn(async () => {}),
    updateLaborJobPayment: vi.fn(async () => {}),
    recordSubSending: vi.fn(async (): Promise<SubSendingResult> => ({ ok: true })),
    applySubCredit: vi.fn(async (): Promise<SubSendingResult> => ({ ok: true })),
    laborJobs: [here, newer, older],
    laborJobAssigneesByJobId: assignees,
    laborJobNamesByJobId: {},
    subCreditByPersonId: new Map(),
    ...over,
  }
  const ref = createRef<SubLaborPaymentModalsHandle>()
  renderWithProviders(<SubLaborPaymentModals ref={ref} {...props} />)
  act(() => ref.current!.openMakePayment(target, '60'))
  return props
}
const type = (text: string) => fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: text } })
const press = () => fireEvent.click(screen.getByRole('button', { name: /^Record (payment$|\$)/ }))

describe('Record payment as a sending', () => {
  it('an amount on the sheet is one line with no credit, sent through the sending so it gets its number', async () => {
    const props = mount()
    expect(document.querySelector('[data-sub-payment-after]')!.textContent).toBe('This pays the sheet in full.')
    expect(document.querySelector('[data-sub-sending-plan]')).toBeNull()
    press()
    await waitFor(() => expect(props.recordSubSending).toHaveBeenCalledTimes(1))
    expect(props.recordSubSending).toHaveBeenCalledWith(expect.objectContaining({ personId: 'p-sam', lines: [{ jobId: 'here', amount: 60 }], credit: 0 }))
    expect(props.recordLaborJobPayment).not.toHaveBeenCalled()
    // The window closes and the next one says what was recorded (punch list #350). Done leaves the screen clear.
    const after = await screen.findByRole('dialog', { name: 'Payment recorded' })
    expect(screen.queryByTestId('sub-record-payment')).toBeNull()
    expect(after.textContent).toContain('$60.00 to Sub Sam, on 1 sheet.')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('past the sheet it fills their other open sheets oldest first and keeps the rest as their credit', async () => {
    const props = mount()
    type('200')
    const plan = document.querySelector('[data-sub-sending-plan]')!
    expect(plan.textContent).toContain('$200.00 is more than this sheet needs. It is recorded as one sending:')
    expect([...plan.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['$60.00 on this sheet, paid in full', '$60.00 on S-100 500 Oak Ln, Austin, TX, paid in full', '$60.00 on S-200 500 Oak Ln, Austin, TX, paid in full', '$20.00 kept as their credit'])
    expect(document.querySelector('[data-sub-payment-refusal]')).toBeNull()
    // The press says what it will do: the amount, how many sheets, and that some is kept as credit.
    expect(screen.getByRole('button', { name: 'Record $200.00 on 3 sheets and their credit' })).toBeTruthy()
    press()
    await waitFor(() => expect(props.recordSubSending).toHaveBeenCalledTimes(1))
    expect(props.recordSubSending).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'p-sam', lines: [{ jobId: 'here', amount: 60 }, { jobId: 'older', amount: 60 }, { jobId: 'newer', amount: 60 }], credit: 20 }),
    )
  })

  it('By hand places the payment on the sheets the office picks, and holds the press until every dollar is placed', async () => {
    const props = mount()
    type('200')
    fireEvent.click(screen.getByRole('button', { name: 'By hand' }))
    // Oldest first fills the boxes as a start: 60 here, 60 and 60 on the two others, 20 kept as credit.
    const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement
    expect(box('Keep as their credit').value).toBe('20.00')
    // Move the credit's 20 nowhere: 180 placed of 200 holds the press, with the reason on the screen.
    fireEvent.change(box('Keep as their credit'), { target: { value: '0' } })
    expect((screen.getByRole('button', { name: /^Record (payment$|\$)/ }) as HTMLButtonElement).disabled).toBe(true)
    // Put it back and the press names the act again.
    fireEvent.change(box('Keep as their credit'), { target: { value: '20' } })
    press()
    await waitFor(() => expect(props.recordSubSending).toHaveBeenCalledTimes(1))
    expect(props.recordSubSending).toHaveBeenCalledWith(expect.objectContaining({ personId: 'p-sam', credit: 20 }))
  })

  it('with the fill switched off, all of the extra is their credit', async () => {
    const props = mount()
    type('100')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Put the extra on their other open sheets, oldest first' }))
    expect([...document.querySelectorAll('[data-sub-sending-plan] li')].map((li) => li.textContent)).toEqual(['$60.00 on this sheet, paid in full', '$40.00 kept as their credit'])
    expect(screen.getByRole('button', { name: 'Record $100.00 on 1 sheet and their credit' })).toBeTruthy()
    press()
    await waitFor(() => expect(props.recordSubSending).toHaveBeenCalledWith(expect.objectContaining({ lines: [{ jobId: 'here', amount: 60 }], credit: 40 })))
  })

  it('a credit they hold is offered first, for what the sheet can take', async () => {
    const props = mount({ subCreditByPersonId: new Map([['p-sam', 25]]) })
    const offer = document.querySelector('[data-sub-credit-offer]')!
    expect(offer.textContent).toContain('Sub Sam has a credit of $25.00.')
    fireEvent.click(screen.getByRole('button', { name: 'Use $25.00 on this sheet' }))
    await waitFor(() => expect(props.applySubCredit).toHaveBeenCalledWith('p-sam', 'here', 25, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)))
    expect(props.recordSubSending).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a credit larger than the sheet offers only what the sheet still owes', () => {
    mount({ subCreditByPersonId: new Map([['p-sam', 500]]) })
    expect(screen.getByRole('button', { name: 'Use $60.00 on this sheet' })).toBeTruthy()
  })

  it('before the migration is pushed, a payment that stays on its sheet is recorded as it always was', async () => {
    const props = mount({ recordSubSending: vi.fn(async (): Promise<SubSendingResult> => ({ ok: false, missing: true, message: 'not found' })) })
    type('45')
    press()
    await waitFor(() => expect(props.recordLaborJobPayment).toHaveBeenCalledWith('here', 45, null, expect.any(String), expect.objectContaining({ hidden_from_sub: false })))
    // A payment recorded the old way is offered its record too: a row with no sending is a record of its own.
    expect((await screen.findByRole('dialog', { name: 'Payment recorded' })).textContent).toContain('$45.00 to Sub Sam, on 1 sheet.')
  })

  it('before the migration is pushed, an amount past the sheet says it is not switched on and records nothing', async () => {
    const props = mount({ recordSubSending: vi.fn(async (): Promise<SubSendingResult> => ({ ok: false, missing: true, message: 'not found' })) })
    type('200')
    press()
    await waitFor(() => expect(document.querySelector('[data-sub-payment-error]')!.textContent).toBe('Paying past one sheet is not switched on yet. Record up to $60.00 on this sheet for now.'))
    expect(props.recordLaborJobPayment).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Record payment' })).toBeTruthy()
  })

  it('a refusal from the database is shown with its reason and the window stays open', async () => {
    mount({ recordSubSending: vi.fn(async (): Promise<SubSendingResult> => ({ ok: false, missing: false, message: 'each sheet\'s amount must be above zero' })) })
    press()
    await waitFor(() => expect(document.querySelector('[data-sub-payment-error]')!.textContent).toBe("each sheet's amount must be above zero"))
  })

  it('a sub who is not one roster person is refused past what their sheets need', () => {
    roster.rows = []
    mount()
    type('200')
    // With no roster the sheet's sub is not known, so nothing is planned past the sheet.
    expect(document.querySelector('[data-sub-payment-refusal="over"]')!.textContent).toContain('a credit needs the sub on the roster as one person')
    expect((screen.getByRole('button', { name: 'Record payment' }) as HTMLButtonElement).disabled).toBe(true)
    roster.rows = [{ id: 'p-sam', name: 'Sub Sam', kind: 'sub', accountRole: null }]
  })

  it('Edit on a payment made from a credit keeps its amount and shows no method chips', () => {
    const ref = createRef<SubLaborPaymentModalsHandle>()
    renderWithProviders(<SubLaborPaymentModals ref={ref} recordLaborJobPayment={vi.fn()} recordLaborJobBackcharge={vi.fn()} deleteLaborJobPayment={vi.fn()} updateLaborJobPayment={vi.fn()} />)
    act(() => ref.current!.openEditPayment({ id: 'pay-1', jobId: 'here', amount: 25, memo: null, isBackcharge: false, paymentDate: '2026-11-10', createdAt: null, method: 'credit' }, '25', ''))
    expect(document.querySelector('[data-sub-payment-from-credit]')!.textContent).toContain('made from their credit')
    expect(screen.queryByRole('group', { name: 'How it was sent' })).toBeNull()
    expect((document.querySelector('input[type="number"]') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('after Record payment, the payment record is one press away (punch list #350)', () => {
  it('says the sub has been given nothing, and the press opens the papers on the payment just recorded', async () => {
    // The reload brings the sheet back with its new row, on a sending.
    const paid = makeLaborJob({ id: 'here', job_number: 'S-300', job_date: '2026-11-01', payments: [{ id: 'old', amount: 5, memo: null, created_at: '2026-11-02T10:00:00Z' }, { id: 'new', amount: 55, memo: null, created_at: '2026-11-16T10:00:00Z', method: 'check', method_ref: '1182', sending_id: 'snd-9', sending_no: 9 }] })
    const props = mount({ laborJobs: [paid, newer, older] })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    press()
    await waitFor(() => expect(props.recordSubSending).toHaveBeenCalledTimes(1))
    const after = await screen.findByRole('dialog', { name: 'Payment recorded' })
    expect(after.textContent).toContain('by Check to Sub Sam, on 1 sheet.')
    expect(after.textContent).toContain('Sub Sam has not been sent a payment record. A sub with a portal sees the payment there now.')
    fireEvent.click(screen.getByRole('button', { name: 'Send the payment record…' }))
    const papers = screen.getByRole('dialog', { name: 'Papers for Sub Sam' })
    expect(papers.getAttribute('data-open')).toBe('payment')
    expect(papers.getAttribute('data-sending')).toBe('snd-9')
    // The window opens on the send step: the press said Send.
    expect(papers.getAttribute('data-send')).toBe('true')
    expect(papers.getAttribute('data-key')).toBe('id:p-sam')
    expect(screen.queryByRole('dialog', { name: 'Payment recorded' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close the papers' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a row with no sending is a record of its own, and a sheet with no row yet opens the statement of account', async () => {
    const lone = makeLaborJob({ id: 'here', job_number: 'S-300', job_date: '2026-11-01', payments: [{ id: 'lone', amount: 60, memo: null, created_at: '2026-11-16T10:00:00Z' }] })
    mount({ laborJobs: [lone, newer, older] })
    press()
    fireEvent.click(await screen.findByRole('button', { name: 'Send the payment record…' }))
    expect(screen.getByRole('dialog', { name: 'Papers for Sub Sam' }).getAttribute('data-sending')).toBe('row:lone')
    cleanup()
    mount()
    press()
    fireEvent.click(await screen.findByRole('button', { name: 'Send the payment record…' }))
    expect(screen.getByRole('dialog', { name: 'Papers for Sub Sam' }).getAttribute('data-open')).toBe('statement')
  })

  it('money from a credit is no sending, so no record is offered', async () => {
    const props = mount({ subCreditByPersonId: new Map([['p-sam', 500]]) })
    fireEvent.click(screen.getByRole('button', { name: 'Use $60.00 on this sheet' }))
    await waitFor(() => expect(props.applySubCredit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId('sub-record-payment')).toBeNull())
    expect(screen.queryByRole('dialog', { name: 'Payment recorded' })).toBeNull()
  })
})

describe('the windows and the check mark (v2.7237)', () => {
  it('a back-charge takes its day, today unless changed', async () => {
    const recordLaborJobBackcharge = vi.fn(async () => {})
    const ref = createRef<SubLaborPaymentModalsHandle>()
    renderWithProviders(<SubLaborPaymentModals ref={ref} recordLaborJobPayment={vi.fn()} recordLaborJobBackcharge={recordLaborJobBackcharge} deleteLaborJobPayment={vi.fn()} updateLaborJobPayment={vi.fn()} />)
    act(() => ref.current!.openBackcharge({ id: 'here', contractor: 'Sub Sam', hcp: 'S-300', totalCost: 60, paid: 0 }))
    const date = screen.getByLabelText('Date') as HTMLInputElement
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.change(date, { target: { value: '2026-11-03' } })
    fireEvent.change(document.querySelector('input[type="number"]') as HTMLInputElement, { target: { value: '25' } })
    fireEvent.change(screen.getByPlaceholderText('Required for backcharges'), { target: { value: 'Broken vanity top' } })
    fireEvent.click(screen.getByRole('button', { name: /Backcharge|Record/ }))
    await waitFor(() => expect(recordLaborJobBackcharge).toHaveBeenCalledWith('here', 25, 'Broken vanity top', '2026-11-03'))
  })

  it('Edit on a ticked payment says a change to its amount or date clears the tick', () => {
    const ref = createRef<SubLaborPaymentModalsHandle>()
    renderWithProviders(<SubLaborPaymentModals ref={ref} recordLaborJobPayment={vi.fn()} recordLaborJobBackcharge={vi.fn()} deleteLaborJobPayment={vi.fn()} updateLaborJobPayment={vi.fn()} />)
    act(() => ref.current!.openEditPayment({ id: 'pay-2', jobId: 'here', amount: 40, memo: null, isBackcharge: false, paymentDate: '2026-11-10', createdAt: null, method: 'check', checkedAt: '2026-11-12T18:00:00Z' }, '40', ''))
    expect(document.querySelector('[data-sub-payment-checked-hint]')!.textContent).toBe('This payment is ticked against the bank. Changing its amount or its date clears the tick.')
  })
})

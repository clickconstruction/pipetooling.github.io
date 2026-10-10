// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBillCustomerWindow } from './GcBillCustomer'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject, OwnerPayAppSent } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** Fair Oaks D with its made-up bills, the last one still waiting on the architect unless `lastApp` says otherwise. */
function setup(
  over: Partial<GcProject> = {},
  waived: number[] = [],
  lastApp: Partial<OwnerPayAppSent> = {},
  extra: { unconditional?: Record<number, number>; unbilled?: { on: string | null; amount: number }[]; emailed?: Record<number, { what: 'payApp' | 'certified'; to: string; on: string }[]>; interestEmailed?: Record<number, { to: string; on: string }[]>; scheduleRead?: boolean; cardOfferOn?: boolean } = {},
) {
  const state = initialGcState()
  const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
  const billing = fairOaks.ownerBilling!
  const apps = billing.payApps!
  const last = apps[apps.length - 1]!
  const project: GcProject = {
    ...fairOaks,
    ownerBilling: { ...billing, payApps: [...apps.slice(0, -1), { ...last, certified: null, certifiedOn: null, ...lastApp }] },
    ...over,
  }
  const laid = { ...state, projects: state.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = { onSend: vi.fn(), onCertify: vi.fn(), onSetRetainage: vi.fn(), onDownload: vi.fn(), onWaiver: vi.fn(), onPaid: vi.fn(), onPayPart: vi.fn(), onPromise: vi.fn(), onUnconditional: vi.fn(), onRemind: vi.fn(), onSetPayDays: vi.fn(), onSetInterest: vi.fn(), onBillInterest: vi.fn(), onSetLateFee: vi.fn(), onAccept: vi.fn(), onSendFinal: vi.fn(), onCardUndo: vi.fn() }
  render(<GcBillCustomerWindow state={laid} project={project} today="2026-10-26" writes={writes} waived={waived} unconditional={extra.unconditional} unbilled={extra.unbilled} emailed={extra.emailed} interestEmailed={extra.interestEmailed} scheduleRead={extra.scheduleRead} cardOfferOn={extra.cardOfferOn} onClose={() => undefined} />)
  return { writes, last }
}

describe('GcBillCustomerWindow', () => {
  it('sends this month\'s bill and opens its form', () => {
    const { writes, last } = setup()
    const next = last.number + 1
    fireEvent.click(screen.getByRole('button', { name: `Send pay application ${next}` }))
    // The email starts off: an untouched Send emails no one.
    expect(writes.onSend).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: 'See the form in Excel' }))
    expect(writes.onDownload).toHaveBeenCalledWith('draft', 'xlsx')
    fireEvent.click(screen.getByRole('button', { name: 'See the form as a PDF' }))
    expect(writes.onDownload).toHaveBeenCalledWith('draft', 'pdf')
    expect(screen.getByText('This bill asks')).toBeTruthy()
  })

  it('offers no next bill once our final went (O7a)', () => {
    const { last } = setup({}, [], { final: true })
    expect(screen.getByText('Our final pay application went, so there is nothing more to bill.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: `Send pay application ${last.number + 1}` })).toBeNull()
    expect(screen.getByText(`Pay application ${last.number}, final`)).toBeTruthy()
  })

  it('records the architect\'s certificate, and asks why when it is less', () => {
    const { writes, last } = setup()
    expect(screen.getByText('waiting on the architect')).toBeTruthy()
    const record = screen.getByRole('button', { name: 'Record the certificate' }) as HTMLButtonElement
    expect(record.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText(`What the architect certified on pay application ${last.number}`), { target: { value: '1000' } })
    expect(record.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(`Why the certificate on pay application ${last.number} is less`), { target: { value: 'Held the framing' } })
    fireEvent.click(record)
    // The email starts off: recording the certificate emails no one until it is ticked.
    expect(writes.onCertify).toHaveBeenCalledWith(last.number, 1000, '2026-10-26', 'Held the framing', false)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email the customer the bill now' }))
    fireEvent.click(record)
    expect(writes.onCertify).toHaveBeenLastCalledWith(last.number, 1000, '2026-10-26', 'Held the framing', true)
  })

  it('emails no bill when the architect certified nothing, since nothing certified makes no bill', () => {
    const { writes, last } = setup()
    const tick = screen.getByRole('checkbox', { name: 'Email the customer the bill now' }) as HTMLInputElement
    fireEvent.click(tick)
    fireEvent.change(screen.getByLabelText(`What the architect certified on pay application ${last.number}`), { target: { value: '0' } })
    expect([tick.disabled, tick.checked]).toEqual([true, false])
    fireEvent.change(screen.getByLabelText(`Why the certificate on pay application ${last.number} is less`), { target: { value: 'Nothing done yet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record the certificate' }))
    expect(writes.onCertify).toHaveBeenCalledWith(last.number, 0, '2026-10-26', 'Nothing done yet', false)
  })

  it('changes the retainage to one that goes down partway', () => {
    const { writes } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Change the retainage' }))
    fireEvent.change(screen.getByLabelText('Percent they hold'), { target: { value: '5' } })
    fireEvent.click(screen.getByLabelText('It goes down partway'))
    fireEvent.change(screen.getByLabelText('They hold'), { target: { value: '2.5' } })
    expect(screen.getByText('They will hold 5% until the work is half done, then 2.5% on the rest.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save the retainage' }))
    expect(writes.onSetRetainage).toHaveBeenCalledWith(5, { atPct: 50, toPct: 2.5, way: 'after' })
  })

  it('types the contract\'s days to pay in the terms, or clears them, in whole days', () => {
    const { writes } = setup()
    expect(document.body.textContent).toContain('Type the contract\'s days to pay so a first bill can go late.')
    fireEvent.click(screen.getByRole('button', { name: 'Change the days to pay' }))
    const field = screen.getByLabelText('Days they have to pay after the certificate')
    fireEvent.change(field, { target: { value: '2.5' } })
    expect((screen.getByRole('button', { name: 'Save the days to pay' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the days to pay' }))
    expect(writes.onSetPayDays).toHaveBeenCalledWith(30)
    cleanup()
    const again = setup({ ownerPayDays: 30 })
    expect(document.body.textContent).toContain('They pay within 30 days of the certificate, by the contract.')
    fireEvent.click(screen.getByRole('button', { name: 'Change the days to pay' }))
    fireEvent.change(screen.getByLabelText('Days they have to pay after the certificate'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the days to pay' }))
    expect(again.writes.onSetPayDays).toHaveBeenCalledWith(null)
  })

  it('types the interest in the terms: 1.5 to start, nothing saved until Save, blank for none (O6b-1)', () => {
    const { writes } = setup()
    expect(document.body.textContent).toContain('No interest on late bills.')
    fireEvent.click(screen.getByRole('button', { name: 'Change the interest' }))
    const field = screen.getByLabelText('Interest on a late bill, a percent a month') as HTMLInputElement
    expect(field.value).toBe('1.5')
    expect(writes.onSetInterest).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: '0' } })
    expect((screen.getByRole('button', { name: 'Save the interest' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the interest' }))
    expect(writes.onSetInterest).toHaveBeenCalledWith(1.5)
    cleanup()
    const again = setup({ ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 30 })
    expect(document.body.textContent).toContain('1.5% a month on a late bill, from the day after it falls due by the contract.')
    fireEvent.click(screen.getByRole('button', { name: 'Change the interest' }))
    fireEvent.change(screen.getByLabelText('Interest on a late bill, a percent a month'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the interest' }))
    expect(again.writes.onSetInterest).toHaveBeenCalledWith(null)
  })

  it('bills the interest that built up, the email off to start, and lists each interest bill (O6b-2)', () => {
    const last = lastSent()
    // Certified Sep 20 with 5 days to pay: due Sep 25, a week late by the state's Oct 2, at 1.5% a month.
    const { writes } = setup({ ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 5 }, [], { ...partPaid(last), certifiedOn: '2026-09-20', promises: [] })
    const bill = screen.getByRole('button', { name: /^Bill the interest / })
    fireEvent.click(bill)
    const amount = writes.onBillInterest.mock.calls[0]![0] as number
    expect([amount > 1, writes.onBillInterest.mock.calls[0]![1]]).toEqual([true, false])
    expect(document.body.textContent).toContain(`${money(amount)} of interest has built up and is not billed yet.`)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email the customer the bill now' }))
    fireEvent.click(bill)
    expect(writes.onBillInterest).toHaveBeenLastCalledWith(amount, true)
    cleanup()
    const fair = initialGcState().projects.find((p) => p.id === 'fairoaksd')!
    setup(
      { ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 5, ownerBilling: { ...fair.ownerBilling!, interestBills: [{ number: 1, sentOn: '2026-10-01', amount: 120, paidOn: null }, { number: 2, sentOn: '2026-10-02', amount: 80, paidOn: '2026-10-02' }] } },
      [],
      {},
      { interestEmailed: { 1: [{ to: 'Cibolo Creek Partners', on: '2026-10-01' }] } },
    )
    expect(document.body.textContent).toContain('Interest bill 1 · Oct 1')
    expect(document.body.textContent).toContain('Emailed to Cibolo Creek Partners on Oct 1.')
    expect(screen.getByText('paid Oct 2')).toBeTruthy()
  })

  it('types the late fee, and says the finish that counts once the schedule is read (O6b-3)', () => {
    const { writes } = setup({}, [], {}, { scheduleRead: false })
    expect(document.body.textContent).toContain('No late fee is entered from the contract.')
    expect(document.body.textContent).toContain('Reading the schedule…')
    fireEvent.click(screen.getByRole('button', { name: 'Change the late fee' }))
    const field = screen.getByLabelText('The contract’s late fee a day, in dollars')
    fireEvent.change(field, { target: { value: '0' } })
    expect((screen.getByRole('button', { name: 'Save the late fee' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the late fee' }))
    expect(writes.onSetLateFee).toHaveBeenCalledWith(500)
    cleanup()
    // Fair Oaks D's projected finish is its contract's Fri Dec 11: on the day, so nothing costs yet.
    setup({ ownerLateFinish: { perDay: 500 } })
    expect(document.body.textContent).toContain(`${money(500)} a day past the contract's substantial completion.`)
    expect(document.body.textContent).toContain('The schedule finishes Fri Dec 11, on the contract\'s Fri Dec 11.')
  })

  it('makes our conditional waiver for a sent one, and says when it went', () => {
    const { writes, last } = setup({}, [1, 2])
    expect(screen.getAllByText('our waiver went with it')).toHaveLength(2)
    const make = screen.getAllByRole('button', { name: 'Make our conditional waiver' })
    expect(make).toHaveLength(last.number - 2)
    fireEvent.click(make[0]!)
    expect(writes.onWaiver).toHaveBeenCalledWith(last.number)
  })

  it('asks for the contract to be marked signed before the first bill', () => {
    setup({ ownerContractSignedOn: null })
    expect(screen.queryByRole('button', { name: /Send pay application/ })).toBeNull()
    expect(document.body.textContent).toContain('is not marked signed yet')
  })
  /** Fair Oaks D's last made-up bill, pay application 3. */
  const lastSent = (): OwnerPayAppSent => {
    const apps = initialGcState().projects.find((p) => p.id === 'fairoaksd')!.ownerBilling!.payApps!
    return apps[apps.length - 1]!
  }

  // Pay application 3 certified as asked on Sep 28, part paid, and late on their Sep 29 word (the state's today is Oct 2).
  const partPaid = (last: OwnerPayAppSent): Partial<OwnerPayAppSent> => ({
    certified: last.due,
    certifiedOn: '2026-09-28',
    paidOn: null,
    payments: [{ on: '2026-09-30', amount: 100000 }],
    promises: [{ by: '2026-09-29', madeOn: '2026-09-28', note: 'Check is cut', who: 'office' }],
  })

  it('shows money in on a certified bill: what came, when it is due and late, and their word', () => {
    const last = lastSent()
    const { writes } = setup({}, [], partPaid(last))
    const left = last.due - 100000
    expect(screen.getByText(`paid ${money(100000)} of ${money(last.due)}`)).toBeTruthy()
    expect(screen.getByText('late · promised Sep 29, 3 days ago')).toBeTruthy()
    expect(document.body.textContent).toContain(`Pay application ${last.number} is 3 days late: ${money(left)} open.`)
    expect(document.body.textContent).toContain('On Sep 28, they said Tue Sep 29: Check is cut.')
    fireEvent.click(screen.getByRole('button', { name: `Mark paid ${money(left)}` }))
    expect(writes.onPaid).toHaveBeenCalledWith(last.number)
  })

  it('records part of it, and when they said they will pay and how they told us', () => {
    const last = lastSent()
    const { writes } = setup({}, [], partPaid(last))
    fireEvent.click(screen.getByRole('button', { name: 'They paid part…' }))
    fireEvent.change(screen.getByLabelText(`What they paid on pay application ${last.number}`), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record it' }))
    expect(writes.onPayPart).toHaveBeenCalledWith(last.number, 5000)
    fireEvent.click(screen.getByRole('button', { name: 'They said when…' }))
    fireEvent.change(screen.getByLabelText(`The day they will pay pay application ${last.number}`), { target: { value: '2026-10-09' } })
    fireEvent.change(screen.getByLabelText(`How they told us about pay application ${last.number}`), { target: { value: 'phone' } })
    fireEvent.change(screen.getByLabelText(`What they said about pay application ${last.number}`), { target: { value: 'Elena, the controller' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record it' }))
    expect(writes.onPromise).toHaveBeenCalledWith(last.number, '2026-10-09', 'Elena, the controller', 'phone')
  })

  it('reminds them to pay a late bill: the pay-by day five days out, a line of our own, the email as they read it', () => {
    const last = lastSent()
    const { writes } = setup({}, [], partPaid(last))
    fireEvent.click(screen.getByRole('button', { name: 'Remind them to pay' }))
    expect(document.body.textContent).toContain('This is our ask, not their promise.')
    const day = screen.getByLabelText(`The day to pay pay application ${last.number} by`) as HTMLInputElement
    expect(day.value).toBe('2026-10-07')
    fireEvent.change(day, { target: { value: '2026-10-09' } })
    fireEvent.change(screen.getByLabelText(`Your line in the reminder on pay application ${last.number}`), { target: { value: ' Our lien deadline is close. ' } })
    // The email as it will read: no Pay, and the waiver follows the payment (O5b's calls A and B).
    expect(document.body.textContent).toContain(`Reminder: pay application ${last.number} for Fair Oaks Shops, Building D`)
    expect(document.body.textContent).toContain('Please pay it by Fri Oct 9.')
    expect(document.body.textContent).toContain('Our lien deadline is close.')
    expect(document.body.textContent).toContain('Reply with the day you will pay.')
    expect(document.body.textContent).toContain('Our unconditional lien waiver for it follows once it is paid.')
    fireEvent.click(screen.getByRole('button', { name: 'Send the reminder' }))
    expect(writes.onRemind).toHaveBeenCalledWith(last.number, '2026-10-09', 'Our lien deadline is close.')
  })

  it('says when a reminder went, and when its email did not', () => {
    const last = lastSent()
    setup({}, [], { ...partPaid(last), reminders: [{ on: '2026-10-01', by: '2026-10-06', note: '', emailed: false }] })
    expect(document.body.textContent).toContain('Reminded yesterday · pay by Tue Oct 6. The email did not go.')
    cleanup()
    setup({}, [], { ...partPaid(last), reminders: [{ on: '2026-10-01', by: '2026-10-06', note: '', emailed: true }] })
    expect(document.body.textContent).toContain('Reminded yesterday · pay by Tue Oct 6.')
    expect(document.body.textContent).not.toContain('The email did not go.')
  })

  it('makes our unconditional waiver for a payment, and says when it went', () => {
    const last = lastSent()
    const first = setup({}, [], partPaid(last))
    fireEvent.click(screen.getByRole('button', { name: 'Make our unconditional waiver' }))
    expect(first.writes.onUnconditional).toHaveBeenCalledWith(last.number)
    cleanup()
    setup({}, [], partPaid(last), { unconditional: { [last.number]: 1 } })
    expect(screen.getByText('our unconditional waiver went')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Make our unconditional waiver' })).toBeNull()
  })

  it('names a payment on the billing job that names no bill, and lays it on none', () => {
    setup({}, [], {}, { unbilled: [{ on: '2026-10-03', amount: 250 }] })
    expect(document.body.textContent).toContain(`A payment of ${money(250)} on Oct 3 on the billing job names no bill.`)
  })
  it('emails it to the customer and the architect only once the tick is on', () => {
    const { writes, last } = setup()
    expect(document.body.textContent).toContain('Send files the pay application without an email. Tick Email it to the customer and the architect now to email it too.')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email it to the customer and the architect now' }))
    expect(document.body.textContent).toContain('by email now, with the form. Make our conditional waiver under Sent after. It goes in its own email.')
    fireEvent.click(screen.getByRole('button', { name: `Send pay application ${last.number + 1}` }))
    expect(writes.onSend).toHaveBeenCalledWith(true)
  })

  it('says who a sent one was emailed to, then who got the certified bill, from its sent copies', () => {
    setup({}, [], {}, {
      emailed: {
        1: [
          { what: 'payApp', to: 'Cibolo Creek Partners', on: '2026-07-25' },
          { what: 'payApp', to: 'Garza Architects', on: '2026-07-25' },
          { what: 'certified', to: 'Cibolo Creek Partners', on: '2026-08-02' },
        ],
      },
    })
    expect(document.body.textContent).toContain('Emailed to Cibolo Creek Partners and Garza Architects on Jul 25.')
    expect(document.body.textContent).toContain('The certified bill was emailed to Cibolo Creek Partners on Aug 2.')
  })

  it('Pay by card (O8c): the same certified bill off card still takes a part payment here', () => {
    setup({}, [], { certified: 900, certifiedOn: '2026-10-20', paidOn: null })
    expect(screen.getByRole('button', { name: 'They paid part…' })).toBeTruthy()
  })

  it('Pay by card (O8c): Record the certificate says they can pay by card only when the switch is on', () => {
    setup({}, [], {}, { cardOfferOn: true })
    expect(screen.getByText('Recording it makes their bill. They pay it by check, or by card in their portal with a 3% fee.')).toBeTruthy()
    cleanup()
    setup()
    expect(screen.queryByText(/by card in their portal/)).toBeNull()
  })

  it('Pay by card (O8c): a bill on card says what Stripe asks, offers its card page and Back to a check bill, and takes no part payment here', () => {
    const { writes, last } = setup({}, [], { certified: 900, certifiedOn: '2026-10-20', paidOn: null, card: { invoiceId: 'inv-9', state: 'onCard', base: 900, fee: 27, total: 927, chosenOn: '2026-10-21', payUrl: 'https://invoice.stripe.com/i/test9', undoneOn: null } })
    expect(screen.getByText('They chose card in their portal on Oct 21. Stripe asks $927.00 with the $27.00 card fee.')).toBeTruthy()
    expect((screen.getByRole('link', { name: 'Their card page' }) as HTMLAnchorElement).href).toBe('https://invoice.stripe.com/i/test9')
    expect(screen.getByTestId(`gc-bill-card-${last.number}`).textContent).toContain('on card')
    // Stripe records a card payment: no part payment is typed for it here.
    expect(screen.queryByRole('button', { name: 'They paid part…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to a check bill' }))
    expect(screen.getByText('This takes the card page down and the $27.00 fee off. The bill goes back to $900.00.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it on card' }))
    expect(writes.onCardUndo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to a check bill' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Back to a check bill' })).getByRole('button', { name: 'Back to a check bill' }))
    expect(writes.onCardUndo).toHaveBeenCalledWith(last.number)
  })
})

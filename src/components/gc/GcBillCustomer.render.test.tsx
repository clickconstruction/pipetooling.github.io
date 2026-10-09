// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  extra: { unconditional?: Record<number, number>; unbilled?: { on: string | null; amount: number }[]; emailed?: Record<number, { what: 'payApp' | 'certified'; to: string; on: string }[]> } = {},
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
  const writes = { onSend: vi.fn(), onCertify: vi.fn(), onSetRetainage: vi.fn(), onDownload: vi.fn(), onWaiver: vi.fn(), onPaid: vi.fn(), onPayPart: vi.fn(), onPromise: vi.fn(), onUnconditional: vi.fn() }
  render(<GcBillCustomerWindow state={laid} project={project} today="2026-10-26" writes={writes} waived={waived} unconditional={extra.unconditional} unbilled={extra.unbilled} emailed={extra.emailed} onClose={() => undefined} />)
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
})

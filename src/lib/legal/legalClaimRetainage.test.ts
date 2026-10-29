import { describe, expect, it } from 'vitest'
import { claimRetainage, claimRetainageForAccount, type ClaimRetainageBill, type LegalPayApplicationLike } from './legalClaimRetainage'

const bill = (id: string, amount: number | string, status = 'billed', extra: Partial<ClaimRetainageBill> = {}): ClaimRetainageBill => ({ id, amount, status, ...extra })
const app = (applicationNumber: number, retainageHeld: number, currentPaymentDue: number, invoiceId: string | null): Omit<LegalPayApplicationLike, 'jobId'> => ({ applicationNumber, retainageHeld, currentPaymentDue, invoiceId })

describe('claimRetainage — what a sent bill already carries (punch list #213, v2.6103)', () => {
  it('nothing held adds nothing', () => {
    expect(claimRetainage({ id: 'j', lien_retainage_held: null, invoices: [bill('b1', 5_000)] }, [])).toEqual({ held: 0, onBills: 0, added: 0 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 0 }, [])).toEqual({ held: 0, onBills: 0, added: 0 })
  })

  it('a typed figure with no pay application and no release bill is added whole', () => {
    expect(claimRetainage({ id: 'j', lien_retainage_held: 2_400, invoices: [bill('b1', 21_600)] }, [])).toEqual({ held: 2_400, onBills: 0, added: 2_400 })
  })

  it('the release bill carries the figure once it is sent, paid or not; a draft carries nothing', () => {
    const job = (status: string, amount = 2_400) => ({ id: 'j', lien_retainage_held: 2_400, invoices: [bill('b1', 21_600), bill('rel', amount, status, { retainage_release: true })] })
    expect(claimRetainage(job('billed'), [])).toEqual({ held: 2_400, onBills: 2_400, added: 0 })
    expect(claimRetainage(job('paid'), [])).toEqual({ held: 2_400, onBills: 2_400, added: 0 })
    expect(claimRetainage(job('ready_to_bill'), [])).toEqual({ held: 2_400, onBills: 0, added: 2_400 })
    // A release bill for less than the figure leaves the rest; one for more carries only what is held.
    expect(claimRetainage(job('billed', 1_000), [])).toEqual({ held: 2_400, onBills: 1_000, added: 1_400 })
    expect(claimRetainage(job('billed', 3_000), [])).toEqual({ held: 2_400, onBills: 2_400, added: 0 })
  })

  it('an application tied to a bill sent net of retainage adds the whole figure', () => {
    const r = claimRetainage({ id: 'j', lien_retainage_held: 1_509.8, invoices: [bill('b1', 13_588.2)] }, [app(1, 1_509.8, 13_588.2, 'b1')])
    expect(r).toEqual({ held: 1_509.8, onBills: 0, added: 1_509.8 })
  })

  it('an application tied to a bill sent for the whole amount, paid short by the retainage, adds nothing — the open bill already holds it', () => {
    const r = claimRetainage({ id: 'j', lien_retainage_held: 1_509.8, invoices: [bill('b1', 15_098)] }, [app(1, 1_509.8, 13_588.2, 'b1')])
    expect(r).toEqual({ held: 1_509.8, onBills: 1_509.8, added: 0 })
  })

  it('a bill between net and whole carries the difference; one above the whole carries only the period’s retainage', () => {
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('b1', 14_000)] }, [app(1, 1_500, 13_500, 'b1')])).toEqual({ held: 1_500, onBills: 500, added: 1_000 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('b1', 16_000)] }, [app(1, 1_500, 13_500, 'b1')])).toEqual({ held: 1_500, onBills: 1_500, added: 0 })
  })

  it('two applications read by their periods: both bills whole carry it all, a net second bill leaves its period', () => {
    const apps = [app(2, 2_500, 9_000, 'b2'), app(1, 1_500, 13_500, 'b1')]
    expect(claimRetainage({ id: 'j', lien_retainage_held: 2_500, invoices: [bill('b1', 15_000), bill('b2', 10_000)] }, apps)).toEqual({ held: 2_500, onBills: 2_500, added: 0 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 2_500, invoices: [bill('b1', 15_000), bill('b2', 9_000)] }, apps)).toEqual({ held: 2_500, onBills: 1_500, added: 1_000 })
  })

  it('the final application at zero releases through its sent bill; a draft bill is not out yet', () => {
    const apps = [app(1, 1_500, 13_500, 'b1'), app(2, 0, 1_500, 'rel')]
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('b1', 13_500), bill('rel', 1_500)] }, apps)).toEqual({ held: 1_500, onBills: 1_500, added: 0 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('b1', 13_500), bill('rel', 1_500, 'ready_to_bill')] }, apps)).toEqual({ held: 1_500, onBills: 0, added: 1_500 })
  })

  it('an application with no bill, a bill the job no longer lists, or a draft bill carries nothing', () => {
    const job = { id: 'j', lien_retainage_held: 1_500, invoices: [bill('draft', 15_000, 'ready_to_bill')] }
    expect(claimRetainage(job, [app(1, 1_500, 13_500, null)])).toEqual({ held: 1_500, onBills: 0, added: 1_500 })
    expect(claimRetainage(job, [app(1, 1_500, 13_500, 'gone')])).toEqual({ held: 1_500, onBills: 0, added: 1_500 })
    expect(claimRetainage(job, [app(1, 1_500, 13_500, 'draft')])).toEqual({ held: 1_500, onBills: 0, added: 1_500 })
  })

  it('what the bills carry never exceeds the figure held, and a bill marked as the release is not read twice', () => {
    const apps = [app(1, 1_000, 9_000, 'b1')]
    expect(claimRetainage({ id: 'j', lien_retainage_held: 600, invoices: [bill('b1', 10_000)] }, apps)).toEqual({ held: 600, onBills: 600, added: 0 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_000, invoices: [bill('b1', 10_000, 'billed', { retainage_release: true })] }, apps)).toEqual({ held: 1_000, onBills: 1_000, added: 0 })
  })

  it('reads strings and cents the way the rows arrive', () => {
    const r = claimRetainage({ id: 'j', lien_retainage_held: '1678.04', invoices: [bill('b1', '16780.44')] }, [app(1, 1_678.04, 15_102.4, 'b1')])
    expect(r).toEqual({ held: 1_678.04, onBills: 1_678.04, added: 0 })
  })
})

describe('claimRetainage — a bill the GC paid short by exactly the retainage held (the live account of 2026-10-29)', () => {
  it('a hand-made bill for the whole draw, paid 90%, with the typed figure its remainder: the open bill already holds it', () => {
    const job = { id: 'j', lien_retainage_held: 1_678.04, invoices: [bill('draw', 16_780.4, 'billed', { open: 1_678.04 }), bill('trip', 350, 'billed', { open: 350 }), bill('final', 948.3, 'billed', { open: 948.3 })] }
    expect(claimRetainage(job, [])).toEqual({ held: 1_678.04, onBills: 1_678.04, added: 0 })
  })
  it('a bill paid short by some other figure, a bill nobody paid on, or a bill whose money was not read, carries nothing', () => {
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_678.04, invoices: [bill('draw', 16_780.4, 'billed', { open: 2_000 })] }, [])).toEqual({ held: 1_678.04, onBills: 0, added: 1_678.04 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_678.04, invoices: [bill('rel', 1_678.04, 'billed', { open: 1_678.04 })] }, [])).toEqual({ held: 1_678.04, onBills: 0, added: 1_678.04 })
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_678.04, invoices: [bill('draw', 16_780.4)] }, [])).toEqual({ held: 1_678.04, onBills: 0, added: 1_678.04 })
  })
  it('two draws each paid short, their remainders adding up to the figure, carry it between them; a draft is not read', () => {
    const job = { id: 'j', lien_retainage_held: 2_500, invoices: [bill('d1', 15_000, 'billed', { open: 1_500 }), bill('d2', 10_000, 'billed', { open: 1_000 }), bill('d3', 5_000, 'ready_to_bill', { open: 5_000 })] }
    expect(claimRetainage(job, [])).toEqual({ held: 2_500, onBills: 2_500, added: 0 })
  })
  it('a bill tied to an application or marked as the release is read by its own rule, never by the short-paid one', () => {
    // A net bill the GC happened to pay short by the figure: the application says it carries nothing.
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('b1', 13_500, 'billed', { open: 1_500 })] }, [app(1, 1_500, 13_500, 'b1')])).toEqual({ held: 1_500, onBills: 0, added: 1_500 })
    // The release bill carries its amount once; the remainder rule does not add it again.
    expect(claimRetainage({ id: 'j', lien_retainage_held: 1_500, invoices: [bill('rel', 1_000, 'billed', { retainage_release: true, open: 500 })] }, [])).toEqual({ held: 1_500, onBills: 1_000, added: 500 })
  })
  it('the short-paid rule reads what the other rules left: an application’s net bill plus a hand-made draw paid short by the rest', () => {
    const job = { id: 'j', lien_retainage_held: 2_500, invoices: [bill('b1', 13_500, 'billed', { open: 13_500 }), bill('draw', 10_000, 'billed', { open: 2_500 })] }
    expect(claimRetainage(job, [app(1, 1_500, 13_500, 'b1')])).toEqual({ held: 2_500, onBills: 2_500, added: 0 })
  })
})

describe('claimRetainageForAccount', () => {
  it('sums the jobs, each read with its own applications', () => {
    const jobs = [
      { id: 'a', lien_retainage_held: 1_509.8, invoices: [bill('a1', 15_098)] },
      { id: 'b', lien_retainage_held: 2_400, invoices: [bill('b1', 21_600)] },
      { id: 'c', lien_retainage_held: null, invoices: [] },
    ]
    const apps: LegalPayApplicationLike[] = [{ jobId: 'a', ...app(1, 1_509.8, 13_588.2, 'a1') }]
    expect(claimRetainageForAccount(jobs, apps)).toEqual({ held: 3_909.8, onBills: 1_509.8, added: 2_400 })
    expect(claimRetainageForAccount([], [])).toEqual({ held: 0, onBills: 0, added: 0 })
  })
})

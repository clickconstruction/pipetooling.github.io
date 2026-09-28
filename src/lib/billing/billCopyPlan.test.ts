import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure plan, tested here.
import { BILL_COPY_MAX, copyEmailsFromRow, planBillCopies } from '../../../supabase/functions/_shared/billCopyPlan'

const list = ['pm@hartwell.example', 'ap@drf.example', 'tenant@one-off.example']
const live = { stripeMode: 'live' as const, invoiceLivemode: true, copyEmails: list, callerEmail: 'office@click.example' }

describe('copyEmailsFromRow', () => {
  it('lowercases, trims, dedupes and drops what is not an address', () => {
    expect(copyEmailsFromRow([' PM@Hartwell.example ', 'pm@hartwell.example', 'not an address', '', 7, null, 'ap@drf.example'])).toEqual(['pm@hartwell.example', 'ap@drf.example'])
  })
  it('is empty for anything but a list', () => {
    expect(copyEmailsFromRow(null)).toEqual([])
    expect(copyEmailsFromRow('pm@hartwell.example')).toEqual([])
    expect(copyEmailsFromRow({ 0: 'pm@hartwell.example' })).toEqual([])
  })
  it('keeps the first ten', () => {
    const many = Array.from({ length: 14 }, (_, i) => `p${i}@hartwell.example`)
    expect(copyEmailsFromRow(many)).toEqual(many.slice(0, BILL_COPY_MAX))
  })
})

describe('planBillCopies (who a bill’s copies go to)', () => {
  it('nobody on the copy list → nothing to send, in either mode', () => {
    expect(planBillCopies({ ...live, copyEmails: [] })).toEqual({ kind: 'none' })
    expect(planBillCopies({ ...live, copyEmails: [], stripeMode: 'test' })).toEqual({ kind: 'none' })
  })

  it('a live bill copies every address on the list', () => {
    expect(planBillCopies(live)).toEqual({ kind: 'live', to: list })
    expect(planBillCopies({ ...live, invoiceLivemode: undefined })).toEqual({ kind: 'live', to: list })
    expect(planBillCopies({ ...live, invoiceLivemode: null, callerEmail: null })).toEqual({ kind: 'live', to: list })
  })

  it('a test bill sends one copy to whoever pressed Send and holds the whole list back', () => {
    expect(planBillCopies({ ...live, stripeMode: 'test', invoiceLivemode: false, callerEmail: ' office@click.example ' })).toEqual({
      kind: 'test',
      to: 'office@click.example',
      heldBack: list,
    })
  })

  it('a test bill never plans an email to a copy-list address', () => {
    for (const callerEmail of ['office@click.example', '', ' ', null, undefined]) {
      for (const invoiceLivemode of [false, true, null, undefined]) {
        const plan = planBillCopies({ stripeMode: 'test', invoiceLivemode, copyEmails: list, callerEmail })
        const recipients = plan.kind === 'live' ? plan.to : plan.kind === 'test' ? [plan.to] : []
        expect(plan.kind).not.toBe('live')
        for (const held of list) expect(recipients).not.toContain(held)
      }
    }
  })

  it('Stripe calling the invoice a test makes it one, whatever mode the row names', () => {
    expect(planBillCopies({ ...live, stripeMode: 'live', invoiceLivemode: false })).toEqual({ kind: 'test', to: 'office@click.example', heldBack: list })
  })

  it('a test bill with no sender address copies nobody', () => {
    for (const callerEmail of ['', '  ', null, undefined]) {
      expect(planBillCopies({ ...live, stripeMode: 'test', callerEmail })).toEqual({ kind: 'skip', reason: 'test_without_sender', heldBack: list })
    }
  })

  it('the sender’s own address on the list is not held back — the test copy reaches it', () => {
    expect(planBillCopies({ ...live, stripeMode: 'test', copyEmails: ['office@click.example', 'pm@hartwell.example'], callerEmail: 'Office@Click.example' })).toEqual({
      kind: 'test',
      to: 'Office@Click.example',
      heldBack: ['pm@hartwell.example'],
    })
    expect(planBillCopies({ ...live, stripeMode: 'test', copyEmails: ['office@click.example'] })).toEqual({ kind: 'test', to: 'office@click.example', heldBack: [] })
  })

  it('does not hand back the caller’s list to be changed', () => {
    const copyEmails = [...list]
    const plan = planBillCopies({ ...live, copyEmails })
    if (plan.kind === 'live') plan.to.push('x@y.example')
    expect(copyEmails).toEqual(list)
  })
})

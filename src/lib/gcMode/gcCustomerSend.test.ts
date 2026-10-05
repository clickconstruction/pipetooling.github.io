import { describe, expect, it } from 'vitest'
import {
  contractEmail,
  customerDocuments,
  customerReminderEmail,
  customerStep,
  gcReducer,
  initialGcState,
  projectFollowPeople,
  projectPeople,
  type GcState,
} from './gcModel'

function withSentChangeOrder(): GcState {
  let state = initialGcState()
  state = gcReducer(state, { type: 'draftChangeOrder', projectId: 'helotes', description: 'Add sound batts to the walls of operatory 3', reason: 'owner', schedule: '+1 working day', packageId: 'dry', cost: 4_800, price: 5_280 })
  return gcReducer(state, { type: 'sendChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
}

const raman = (state: GcState) => {
  const c = state.customers.find((x) => x.id === 'raman')
  if (!c) throw new Error('no raman')
  return c
}
const helotes = (state: GcState) => {
  const p = state.projects.find((x) => x.id === 'helotes')
  if (!p) throw new Error('no helotes')
  return p
}

describe('remind a customer to sign a change order (the owner, 2026-10-04)', () => {
  it('the waiting change order is a row to get, with Remind them', () => {
    const state = withSentChangeOrder()
    const row = customerDocuments(state, raman(state)).groups.flatMap((g) => g.docs).find((d) => d.key === 'co-co-1')
    expect(row).toMatchObject({ status: 'missing', statusWords: 'waiting on their signature' })
    expect(customerStep(state, raman(state), 'co-co-1')).toMatchObject({ title: 'Remind them to sign change order 1', history: 'Sent Oct 2, today. This is the first reminder.' })
    // Signed, nothing to send.
    const signed = gcReducer(state, { type: 'ownerSignChangeOrder', projectId: 'helotes', changeOrderId: 'co-1' })
    expect(customerStep(signed, raman(signed), 'co-co-1')).toBeNull()
  })

  it('the email names the change, the price and the day, with your line', () => {
    const state = withSentChangeOrder()
    const co = helotes(state).changeOrders?.[0]
    if (!co) throw new Error('no co')
    expect(customerReminderEmail(raman(state), helotes(state), co, '2026-10-09', 'The drywall crew is there Monday.').lines).toEqual([
      'Hello Dr. Raman,',
      'Change order 1 for Helotes Dental Office is waiting on your signature: Add sound batts to the walls of operatory 3, $5,280.',
      'Please sign it by Fri Oct 9.',
      'The drywall crew is there Monday.',
      'Reply to this email with any questions, and we will walk you through it.',
    ])
  })

  it('sending keeps it on their record, on the row, and in the job’s Who to call; a passed day reads late', () => {
    let state = withSentChangeOrder()
    state = gcReducer(state, { type: 'remindCustomer', customerId: 'raman', projectId: 'helotes', changeOrderId: 'co-1', by: '2026-10-09', note: '' })
    expect(raman(state).contacts[0]?.note).toBe('Reminded them to sign change order 1, by Fri Oct 9.')
    expect(customerDocuments(state, raman(state)).groups.flatMap((g) => g.docs).find((d) => d.key === 'co-co-1')?.meta.startsWith('Reminded today · sign by Fri Oct 9.')).toBe(true)
    const person = projectPeople(state, helotes(state)).people.find((p) => p.kind === 'customer')
    expect(person).toMatchObject({ tone: 'amber' })
    expect(projectFollowPeople(state, helotes(state)).find((p) => p.partner.id === 'customer:raman')?.items.map((i) => i.kind)).toEqual(['signature'])
    // A reminder whose day already passed.
    state = gcReducer(state, { type: 'remindCustomer', customerId: 'raman', projectId: 'helotes', changeOrderId: 'co-1', by: '2026-10-01', note: '' })
    expect(projectPeople(state, helotes(state)).people.find((p) => p.kind === 'customer')?.tone).toBe('red')
  })
})

describe('our contract, signed in their portal (the owner, 2026-10-04)', () => {
  const won = () => gcReducer(gcReducer(initialGcState(), { type: 'markWon', projectId: 'boerne' }), { type: 'setCustomerPortal', customerId: 'cibolo', on: false })
  const cibolo = (state: GcState) => {
    const c = state.customers.find((x) => x.id === 'cibolo')
    if (!c) throw new Error('no cibolo')
    return c
  }
  const boerne = (state: GcState) => {
    const p = state.projects.find((x) => x.id === 'boerne')
    if (!p) throw new Error('no boerne')
    return p
  }

  it('a won job sends it to sign, which turns their portal on', () => {
    let state = won()
    expect(customerStep(state, cibolo(state), 'contract-boerne')).toMatchObject({ mode: 'first', verb: 'Send to sign', history: 'Not sent yet. Sending it turns their portal on: they sign it there.' })
    expect(customerDocuments(state, cibolo(state)).groups.flatMap((g) => g.docs).find((d) => d.key === 'contract-boerne')?.statusWords).toBe('not sent yet')
    state = gcReducer(state, { type: 'sendOwnerContract', projectId: 'boerne', by: '2026-10-09', note: '' })
    expect(boerne(state).ownerContractSentOn).toBe(state.today)
    expect(cibolo(state).portalOn).toBe(true)
    expect(cibolo(state).contacts[0]?.note).toBe('Sent our contract for Boerne Retail Shell to sign, by Fri Oct 9.')
    expect(customerDocuments(state, cibolo(state)).groups.flatMap((g) => g.docs).find((d) => d.key === 'contract-boerne')).toMatchObject({ statusWords: 'waiting on their signature' })
    expect(customerStep(state, cibolo(state), 'contract-boerne')).toMatchObject({ mode: 'reminder', verb: 'Remind them' })
    expect(projectPeople(state, boerne(state)).people.find((p) => p.kind === 'customer')?.reasons.map((r) => r.code)).toEqual(['contract'])
  })

  it('they sign in their portal: Get started checks it off and their price stays what they signed', () => {
    let state = gcReducer(won(), { type: 'sendOwnerContract', projectId: 'boerne', by: '2026-10-09', note: '' })
    state = gcReducer(state, { type: 'ownerSignContract', projectId: 'boerne' })
    expect(boerne(state).ownerContractSignedOn).toBe(state.today)
    expect(boerne(state).ownerContractWorth).toBeDefined()
    expect(customerStep(state, cibolo(state), 'contract-boerne')).toBeNull()
    expect(state.log[0]?.text).toBe('Cibolo Creek Partners signed our contract for Boerne Retail Shell in their portal.')
    // Signing twice changes nothing; signing one never sent does nothing.
    expect(gcReducer(state, { type: 'ownerSignContract', projectId: 'boerne' })).toBe(state)
  })

  it('the email thanks them, names the price and the day, and sends them to their portal', () => {
    const state = won()
    const email = contractEmail(cibolo(state), boerne(state), true, '2026-10-09', 'Elena, call me with any questions.')
    expect(email.subject).toBe('Your contract for Boerne Retail Shell')
    expect(email.lines[1]?.startsWith('Thank you for choosing us for Boerne Retail Shell. Here is our contract for it: $')).toBe(true)
    expect(email.lines.slice(2)).toEqual([
      'Please sign it by Fri Oct 9.',
      'Elena, call me with any questions.',
      'Open your portal to read it and sign it. Your bills, change orders and papers for the job will be there too.',
    ])
  })
})

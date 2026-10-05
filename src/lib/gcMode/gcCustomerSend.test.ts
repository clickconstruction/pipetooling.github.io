import { describe, expect, it } from 'vitest'
import {
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

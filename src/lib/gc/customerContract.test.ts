/**
 * Our contract in the customer's Documents (the Board's B6-d-ii): each won job's row and its next step on the board's
 * own rows, B6-d-i's sends mapped as the kernels read them.
 */
import { describe, expect, it } from 'vitest'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { CLINIC_WORTH_NOW, awardedClinicBoardRows, contractSendRow } from './boardTestRows'
import { contractJobs, contractPriceChanged, contractStep, customerDocuments, newestContractSend } from './customerContract'

const owner = (rows: BoardRows) => {
  const state = boardStateFromRows(rows)
  return { state, customer: state.customers.find((c) => c.id === 'c1')!, project: state.projects[0]! }
}
const sentRows = (sends: Parameters<typeof contractSendRow>[0][], dates: Partial<BoardRows['boardDates'][string]> = { owner_contract_sent_on: '2026-10-05' }) => {
  const base = awardedClinicBoardRows()
  return { ...base, boardDates: { p1: { ...base.boardDates.p1!, ...dates } }, ownerContractSends: sends.map((s) => contractSendRow(s)) }
}

describe('the sends, mapped', () => {
  it('are the customer’s, oldest first, with the price, the file and a signature once signed', () => {
    const { state, project } = owner(sentRows([{ id: 'cs2', first: false, sent_on: '2026-10-07', created_at: '2026-10-07T15:00:00Z', signed_on: '2026-10-08', signer_printed_name: 'Pat Oak' }, {}]))
    expect(state.customerSends?.map((s) => s.id)).toEqual(['cs1', 'cs2'])
    expect(newestContractSend(state, project)).toMatchObject({ id: 'cs2', customerId: 'c1', paper: 'contract', first: false, by: '2026-10-12', worth: CLINIC_WORTH_NOW, file: { name: 'Clinic contract.pdf' }, signedOn: '2026-10-08', signer: 'Pat Oak' })
  })

  it('go to the job’s customer when the send names none', () => {
    const { state } = owner(sentRows([{ customer_id: null }]))
    expect(state.customerSends?.[0]?.customerId).toBe('c1')
  })
})

describe('our contract’s row and next step', () => {
  it('not sent: Send to sign, counted to get', () => {
    const { state, customer } = owner(awardedClinicBoardRows())
    const docs = customerDocuments(state, customer)
    expect(docs.toGet).toBe(1)
    expect(docs.groups[0]).toMatchObject({ title: 'Hill Country Clinic', docs: [{ key: 'contract-p1', status: 'missing', statusWords: 'not sent yet', meta: 'Send it to sign in their portal. Signed on paper? Mark it on Get started.' }] })
    expect(contractStep(state, customer, 'p1')).toMatchObject({ mode: 'first', verb: 'Send to sign', sendLabel: 'Send to sign', dayWord: 'Sign by' })
  })

  it('sent: waiting on their signature, then Remind them with the reminders counted', () => {
    const first = owner(sentRows([{}]))
    expect(customerDocuments(first.state, first.customer).groups[0]?.docs[0]).toMatchObject({ statusWords: 'waiting on their signature', meta: 'Sent 3 days ago · sign by Mon Oct 12. They sign it in their portal.' })
    expect(contractStep(first.state, first.customer, 'p1')).toMatchObject({ mode: 'reminder', verb: 'Remind them', history: 'Sent Oct 5, 3 days ago. This is the first reminder.' })
    const again = owner(sentRows([{}, { id: 'cs2', first: false, sent_on: '2026-10-07', created_at: '2026-10-07T15:00:00Z' }]))
    expect(contractStep(again.state, again.customer, 'p1')?.history).toBe('Sent Oct 5, 3 days ago. Reminded once, last Oct 7.')
  })

  it('late once the sign-by day passed', () => {
    const { state, customer } = owner(sentRows([{ sign_by: '2026-10-07' }]))
    expect(customerDocuments(state, customer).groups[0]?.docs[0]?.statusWords).toBe('late, asked to sign by Wed Oct 7')
  })

  it('our price moved after the send: Send the new price, and the row says so', () => {
    const { state, customer, project } = owner(sentRows([{ worth: { ...CLINIC_WORTH_NOW, fee: 6000 } }]))
    expect(contractPriceChanged(state, project)).toBe(true)
    expect(contractStep(state, customer, 'p1')).toMatchObject({ mode: 'newPrice', verb: 'Send the new price', sendLabel: 'Send the new price' })
    expect(customerDocuments(state, customer).groups[0]?.docs[0]?.meta).toBe('Our price changed after we sent it.')
  })

  it('signed in their portal: who signed, nothing to send, nothing to get', () => {
    const { state, customer } = owner(sentRows([{ signed_on: '2026-10-08', signer_printed_name: 'Pat Oak' }], { owner_contract_sent_on: '2026-10-05', owner_contract_signed_on: '2026-10-08' }))
    const docs = customerDocuments(state, customer)
    expect(docs.toGet).toBe(0)
    expect(docs.groups[0]?.docs[0]).toMatchObject({ status: 'ok', statusWords: 'signed Oct 8', meta: 'Pat Oak signed it in their portal. Their price stays what they signed.' })
    expect(contractStep(state, customer, 'p1')).toBeNull()
  })

  it('signed on paper: their price stays, with no portal words', () => {
    const { state, customer } = owner(sentRows([], { owner_contract_signed_on: '2026-10-06' }))
    expect(customerDocuments(state, customer).groups[0]?.docs[0]).toMatchObject({ statusWords: 'signed Oct 6', meta: 'Their price stays what they signed.' })
  })

  it('a job still bidding or lost has no contract row, and another customer’s job is not theirs', () => {
    const base = awardedClinicBoardRows()
    const bidding = owner({ ...base, projects: base.projects.map((p) => ({ ...p, stage: 'bidding' })) })
    expect(contractJobs(bidding.state, 'c1')).toEqual([])
    expect(contractStep(bidding.state, bidding.customer, 'p1')).toBeNull()
    const lost = owner({ ...base, projects: base.projects.map((p) => ({ ...p, lostOn: '2026-10-07' })) })
    expect(contractJobs(lost.state, 'c1')).toEqual([])
    const other = boardStateFromRows(base)
    expect(contractStep(other, other.customers.find((c) => c.id === 'c2')!, 'p1')).toBeNull()
  })
})

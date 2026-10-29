import { describe, expect, it } from 'vitest'
import { billCandidates, billCountsByHouse, billsForHouse, type BillCandidateRow } from './billsToRecord'

const row = (over: Partial<BillCandidateRow>): BillCandidateRow => ({
  id: 'att-1',
  message_id: 'm-1',
  name: 'S1183420.pdf',
  mime: 'application/pdf',
  bucket_path: 'inbox/S1183420.pdf',
  kind: 'file',
  paper_answer: null,
  created_at: '2026-10-22T20:12:00.000Z',
  messages: { contact_id: 'c-ridgeway', at: '2026-10-22T20:12:00.000Z' },
  ...over,
})
const HOUSES = new Map([
  ['c-ridgeway', 'sh-ridgeway'],
  ['c-ray', 'sh-ridgeway'],
  ['c-cedar', 'sh-cedar'],
])

describe('billCandidates', () => {
  it('a PDF or a picture with our copy, unanswered, on a house’s line, newest first', () => {
    const out = billCandidates(
      [
        row({}),
        row({ id: 'att-2', name: 'CM-20991.pdf', created_at: '2026-10-23T13:40:00.000Z', messages: { contact_id: 'c-ray', at: '2026-10-23T13:40:00.000Z' } }),
        row({ id: 'att-3', name: 'ticket.jpg', mime: 'image/jpeg', messages: [{ contact_id: 'c-cedar', at: '2026-10-21T15:00:00.000Z' }] }),
      ],
      HOUSES,
      new Set(),
    )
    expect(out.map((c) => [c.attachmentId, c.houseId, c.chip])).toEqual([
      ['att-2', 'sh-ridgeway', 'CM-20991.pdf · Oct 23, on the thread'],
      ['att-1', 'sh-ridgeway', 'S1183420.pdf · Oct 22, on the thread'],
      ['att-3', 'sh-cedar', 'ticket.jpg · Oct 21, on the thread'],
    ])
    expect(billCountsByHouse(out)).toEqual(new Map([['sh-ridgeway', 2], ['sh-cedar', 1]]))
    expect(billsForHouse(out, 'sh-cedar').map((c) => c.name)).toEqual(['ticket.jpg'])
  })
  it('leaves out a link, a file left in Gmail, an answered one, one on a row, a Word file, and a line on no house', () => {
    const out = billCandidates(
      [
        row({ id: 'link', kind: 'link', bucket_path: null }),
        row({ id: 'gmail', bucket_path: null }),
        row({ id: 'not-it', paper_answer: 'not_it' }),
        row({ id: 'recorded', paper_answer: 'filed' }),
        row({ id: 'on-row' }),
        row({ id: 'doc', name: 'terms.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        row({ id: 'customer', messages: { contact_id: 'c-customer', at: null } }),
        row({ id: 'no-line', messages: null }),
        row({ id: 'kept' }),
      ],
      HOUSES,
      new Set(['on-row']),
    )
    expect(out.map((c) => c.attachmentId)).toEqual(['kept'])
  })
  it('reads the day in the company’s calendar, from the line, else from the file', () => {
    const late = billCandidates([row({ id: 'x', messages: { contact_id: 'c-ridgeway', at: '2026-10-23T03:30:00.000Z' } })], HOUSES, new Set())
    expect(late[0]!.dateYmd).toBe('2026-10-22')
    const noAt = billCandidates([row({ id: 'y', created_at: '2026-10-24T12:00:00.000Z', messages: { contact_id: 'c-ridgeway', at: null } })], HOUSES, new Set())
    expect(noAt[0]!.dateYmd).toBe('2026-10-24')
  })
})

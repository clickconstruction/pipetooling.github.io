/**
 * The receipt kind's rows (punch list #299, the step after PR 2): each reason a charge waits on a receipt the text
 * cannot get, in the sentence the office reads, with what the app knows and the door that mends it. Then Text again
 * (v2.8697): when the press shows, what it and its window say, and what the row says after it. Every name and number
 * is made up.
 */
import { describe, expect, it } from 'vitest'
import {
  RECEIPT_CHASE_TEAM_HREF,
  receiptAgainPress,
  receiptAgainTrailWords,
  receiptChaseCounts,
  receiptChaseDetail,
  receiptChaseTitle,
  receiptFillInRows,
  receiptTrailWords,
  type ReceiptChaseSource,
} from './fillInReceipts'

const source = (id: string, why: string, over: Partial<ReceiptChaseSource> = {}): ReceiptChaseSource => ({
  request_id: id,
  mercury_transaction_id: `charge-${id}`,
  why,
  holder_user_id: 'u-jordan',
  holder_name: 'Jordan Vance',
  store: 'Ridgeway Supply',
  amount: 228.58,
  // Tue Nov 3, 5:00 PM on the company's clock.
  posted_at: '2026-11-03T23:00:00.000Z',
  texted_at: null,
  reminded_at: null,
  closes_at: '2026-11-18T00:14:00.000Z',
  ...over,
})

describe('a row for each reason', () => {
  it('no cell on file: the sentence, what mends it, and the door to People by name', () => {
    const [row] = receiptFillInRows([source('r1', 'no_cell')])
    expect(row).toMatchObject({
      key: 'receipt:r1',
      kind: 'receipt',
      severity: 'amber',
      title: 'Jordan has no cell on file, and $228.58 at Ridgeway Supply posted to their card.',
      doorHref: '/people?tab=users',
      doorLabel: "Add Jordan's cell",
      requestId: 'r1',
      chargeId: 'charge-r1',
      why: 'no_cell',
      chargeWords: '$228.58 at Ridgeway Supply',
    })
    expect(row!.knows).toEqual(['The charge posted Tue 5:00 PM.', 'No text could go.', 'Add the cell on People, and the next charge texts them.', 'For this charge, ask for the receipt or send the link yourself.'])
  })

  it('a card tied to no one names no person, and its door is the cards on Banking', () => {
    const [row] = receiptFillInRows([source('r2', 'no_person', { holder_user_id: null, holder_name: '', store: 'Lowe’s', amount: '84.21' })])
    expect(row).toMatchObject({ title: '$84.21 at Lowe’s posted to a card tied to no one.', severity: 'amber', doorHref: '/banking?tab=sorting&cards=1', doorLabel: 'Tie the card' })
    expect(row!.knows).toContain('Tie the card to its holder on Banking, and its next charge texts them.')
  })

  it('a card whose holder has left says so, and has the same door', () => {
    const [row] = receiptFillInRows([source('r3', 'archived', { holder_name: 'Pat Left' })])
    expect(row).toMatchObject({ title: "$228.58 at Ridgeway Supply posted to Pat's card, and Pat has left.", doorLabel: 'Tie the card' })
    expect(receiptChaseTitle('archived', '', '$5.00')).toBe('$5.00 posted to a card, and its holder has left.')
  })

  it('a STOP: ask another way, and the door is the Team queue', () => {
    const [row] = receiptFillInRows([source('r4', 'opted_out', { holder_name: 'Sam Okoro', store: 'The Home Depot', amount: 163.96 })])
    expect(row).toMatchObject({ title: 'Sam asked for no texts, and $163.96 at The Home Depot posted to their card.', severity: 'gray', doorHref: RECEIPT_CHASE_TEAM_HREF, doorLabel: 'Open the Team queue' })
    expect(row!.knows).toEqual(['The charge posted Tue 5:00 PM.', 'The carriers refuse a text after a STOP, so ask for the receipt another way.', 'A START from their phone brings the texts back.'])
  })

  it('texted and reminded with no receipt: when each went, and until when the link opens', () => {
    const [row] = receiptFillInRows([source('r5', 'no_answer', { texted_at: '2026-11-04T00:14:00.000Z', reminded_at: '2026-11-05T00:00:00.000Z' })])
    expect(row).toMatchObject({ title: 'Jordan was texted twice about $228.58 at Ridgeway Supply and sent no receipt.', severity: 'gray', doorLabel: 'Open the Team queue' })
    expect(row!.knows).toEqual(['The charge posted Tue 5:00 PM.', 'Texted Tue 6:14 PM, reminded Wed 6:00 PM.', 'The link is open until Nov 17.'])
  })

  it('a text turned away three times: send the link yourself', () => {
    const [row] = receiptFillInRows([source('r6', 'failed')])
    expect(row).toMatchObject({ title: 'The text to Jordan about $228.58 at Ridgeway Supply did not go.', severity: 'amber' })
    expect(row!.knows).toContain('Copy the receipt link and send it yourself.')
  })

  it('a holder with no name is The holder, and a charge with no store is its amount', () => {
    const [row] = receiptFillInRows([source('r7', 'no_cell', { holder_name: null, store: ' ', amount: 1234.5 })])
    expect(row).toMatchObject({ title: 'The holder has no cell on file, and $1,234.50 posted to their card.', doorLabel: 'Add the cell' })
  })
})

describe('the list', () => {
  it('is the newest charge first, and leaves out a reason this build does not know', () => {
    const rows = receiptFillInRows([
      source('old', 'no_cell', { posted_at: '2026-11-01T23:00:00.000Z' }),
      source('new', 'opted_out', { posted_at: '2026-11-04T23:00:00.000Z' }),
      source('odd', 'something_new'),
      source('', 'no_cell'),
      source('undated', 'failed', { posted_at: null }),
    ])
    expect(rows.map((r) => r.requestId)).toEqual(['new', 'old', 'undated'])
  })

  it('counts by reason, and says them in the order the office mends them', () => {
    const counts = receiptChaseCounts([source('a', 'no_cell'), source('b', 'no_cell'), source('c', 'no_person'), source('d', 'archived'), source('e', 'opted_out'), source('f', 'failed'), source('g', 'no_answer'), source('h', 'no_answer'), source('i', 'no_answer'), source('j', 'something_new')])
    expect(counts).toEqual({ count: 9, byWhy: { no_cell: 2, no_person: 1, archived: 1, opted_out: 1, failed: 1, no_answer: 3 } })
    expect(receiptChaseDetail(counts)).toBe('2 with no cell on file, 2 on a card tied to no one, 1 after a STOP, 1 whose text did not go, 3 texted twice with no answer. Each row names its next press.')
    expect(receiptChaseDetail(receiptChaseCounts([source('a', 'no_answer')]))).toBe('1 texted twice with no answer. Each row names its next press.')
    expect(receiptChaseCounts([])).toMatchObject({ count: 0 })
  })

  it('the trail names the charge', () => {
    expect(receiptTrailWords({ chargeWords: '$228.58 at Ridgeway Supply' })).toBe('Got it: $228.58 at Ridgeway Supply.')
  })
})

describe('Text again', () => {
  // Texted Tue 6:14 PM, reminded Wed 6:00 PM.
  const twice = (over: Partial<ReceiptChaseSource> = {}) => source('r6', 'no_answer', { texted_at: '2026-11-04T00:14:00.000Z', reminded_at: '2026-11-05T00:00:00.000Z', again_at: null, again_count: 0, ...over })

  it('shows on a charge texted twice with no receipt, and its label and its window name the act', () => {
    const [row] = receiptFillInRows([twice()])
    expect(row!.again).toEqual({
      label: 'Text Jordan again',
      confirm: {
        title: 'Text Jordan again?',
        message: "A third text goes to Jordan's phone about $228.58 at Ridgeway Supply, with a new link. It is a real text.",
        confirmLabel: 'Text Jordan again',
      },
      sentWords: 'A third text went to Jordan about $228.58 at Ridgeway Supply.',
    })
    expect(row!.title).toBe('Jordan was texted twice about $228.58 at Ridgeway Supply and sent no receipt.')
  })

  it('shows on no other kind of row', () => {
    for (const why of ['no_cell', 'no_person', 'archived', 'opted_out', 'failed']) {
      const [row] = receiptFillInRows([source('r1', why, { again_count: 0 })])
      expect(row!.again, why).toBeNull()
    }
  })

  it('shows nothing until the database hands back the count: the function would have nowhere to write', () => {
    expect(receiptFillInRows([twice({ again_count: undefined })])[0]!.again).toBeNull()
    expect(receiptFillInRows([twice({ again_count: null })])[0]!.again).toBeNull()
    expect(receiptAgainPress({ why: 'no_answer', again_count: Number.NaN }, 'Jordan', '$1.00')).toBeNull()
    expect(receiptAgainPress({ why: 'no_answer', again_count: -1 }, 'Jordan', '$1.00')).toBeNull()
  })

  it('after one press the row says three times and when, and the window says this text is the last', () => {
    // Thu Nov 5, 9:02 AM on the company's clock.
    const [row] = receiptFillInRows([twice({ again_at: '2026-11-05T15:02:00.000Z', again_count: 1 })])
    expect(row!.title).toBe('Jordan was texted three times about $228.58 at Ridgeway Supply and sent no receipt.')
    expect(row!.knows).toEqual(['The charge posted Tue 5:00 PM.', 'Texted Tue 6:14 PM, reminded Wed 6:00 PM.', 'The office texted again Thu 9:02 AM.', 'The link is open until Nov 17.'])
    expect(row!.again?.confirm.message).toBe("A fourth text goes to Jordan's phone about $228.58 at Ridgeway Supply, with a new link. It is a real text. It is the last one the office can send for this charge.")
    expect(row!.again?.sentWords).toBe('A fourth text went to Jordan about $228.58 at Ridgeway Supply.')
  })

  it('at two presses the press is gone and the row says what is left', () => {
    const [row] = receiptFillInRows([twice({ again_at: '2026-11-06T03:00:00.000Z', again_count: 2 })])
    expect(row!.again).toBeNull()
    expect(row!.title).toBe('Jordan was texted four times about $228.58 at Ridgeway Supply and sent no receipt.')
    expect(row!.knows).toContain('The office texted again twice, last Thu 9:00 PM.')
    expect(row!.knows).toContain('That is the most for one charge. Ask for the receipt another way, or send the link yourself.')
  })

  it('a holder with no name on the request is the holder', () => {
    const [row] = receiptFillInRows([twice({ holder_name: '' })])
    expect(row!.again).toMatchObject({ label: 'Text the holder again', confirm: { title: 'Text the holder again?', confirmLabel: 'Text the holder again' } })
    expect(row!.again?.confirm.message).toContain("goes to the holder's phone")
  })

  it('the trail names the charge and offers no Undo: a text cannot be taken back', () => {
    expect(receiptAgainTrailWords({ chargeWords: '$228.58 at Ridgeway Supply' })).toBe('Texted again: $228.58 at Ridgeway Supply.')
  })
})

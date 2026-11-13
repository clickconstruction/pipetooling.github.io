import { describe, expect, it } from 'vitest'
import { checkPaper, type PaperLine } from './paperChecks'
import { HOLD_WHYS } from './billSweep'
import { groupToggleLabel, HELD_GROUPS, heldBills, noteIsRowAmount, showHeldLabel, standingWords, toReadWords, type HeldHold, type HeldInvoice, type HeldPaper } from './heldBills'

// Made-up bills: invented houses, numbers and amounts.
const DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'
const inv = (over: Partial<HeldInvoice> & { id: string }): HeldInvoice => ({ supplyHouseId: 'h1', number: `S-${over.id}`, dateYmd: '2026-10-01', amountCents: 11260, link: DRIVE, ...over })
const paper = (invoiceId: string, checkState: HeldPaper['checkState'], checkNote = ''): HeldPaper => ({ id: `p-${invoiceId}`, invoiceId, checkState, checkNote })
const hold = (invoiceId: string, why: HeldHold['why'], note = ''): HeldHold => ({ invoiceId, why, note })
const houseNames = new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']])

describe('heldBills', () => {
  const invoices = [
    inv({ id: 'a' }),
    inv({ id: 'b' }),
    inv({ id: 'c', dateYmd: '2026-10-05' }),
    inv({ id: 'd', dateYmd: '2026-10-09', supplyHouseId: 'h2' }),
    inv({ id: 'e' }),
    inv({ id: 'f', link: null }),
    inv({ id: 'g', link: 'https://example.com/bill.pdf' }),
    inv({ id: 'h' }),
    inv({ id: 'i' }),
    inv({ id: 'j' }),
    inv({ id: 'k', supplyHouseId: null }),
  ]
  const papers = [
    paper('a', 'adds_up'),
    paper('b', 'accepted', 'The lines are $12.40 short of the subtotal'),
    paper('c', 'off', "The printed total is $30.00 over the amount on the bill's row"),
    paper('d', 'off', 'The lines are $12.40 short of the subtotal'),
    // A paper wins over a hold an older run left on the same bill.
    paper('k', 'off', 'Line 2: the quantity times the price is $9.00, the paper prints $0.00'),
  ]
  const holds = [hold('e', 'number_not_in_file', 'The file holds S-900.'), hold('h', 'statement'), hold('i', 'reading'), hold('k', 'failed')]
  const { standing, groups } = heldBills({ invoices, papers, holds, houseNames })

  it('counts where every bill stands', () => {
    expect(standing).toEqual({ bills: 11, read: 5, addUp: 2, off: 3, held: 3, noPdf: 1, toRead: 2, needPerson: 5 })
  })

  it('lists what waits by reason, what a person can fix first', () => {
    expect(groups.map((g) => [g.reason, g.bills.map((b) => b.invoiceId)])).toEqual([
      ['row_amount', ['c']],
      ['sums', ['d', 'k']],
      ['number_not_in_file', ['e']],
      ['link', ['g']],
      ['statement', ['h']],
      ['no_pdf', ['f']],
    ])
  })

  it('gives an off paper Look, with its gap and its paper, and the house by name', () => {
    const amount = groups.find((g) => g.reason === 'row_amount')!
    expect(amount.presses).toEqual(['look', 'bill'])
    expect(amount.bills[0]).toMatchObject({ houseName: 'Ridgeway Supply', number: 'S-c', paperId: 'p-c', note: "The printed total is $30.00 over the amount on the bill's row" })
    const sums = groups.find((g) => g.reason === 'sums')!
    expect(sums.presses).toEqual(['look'])
    // Newest first, and a bill with no house still has a name to read.
    expect(sums.bills.map((b) => b.houseName)).toEqual(['Pecan Supply Co', 'No house'])
  })

  it('gives a held bill its own door, and a statement none', () => {
    const number = groups.find((g) => g.reason === 'number_not_in_file')!
    expect(number.presses).toEqual(['bill'])
    expect(number.bills[0]!.note).toBe('The file holds S-900.')
    expect(number.bills[0]!.paperId).toBeNull()
    expect(groups.find((g) => g.reason === 'statement')!.presses).toEqual([])
  })

  it('holds a link that is no Drive file before the sweep says so, and leaves a bill being read to the sweep', () => {
    expect(groups.find((g) => g.reason === 'link')!.bills.map((b) => b.invoiceId)).toEqual(['g'])
    // i is being read and j has no hold yet: both are the sweep's.
    expect(standing.toRead).toBe(2)
  })

  it('does not count a statement or a bill with no PDF as needing a person', () => {
    // c, d, k are off; e and g have a door. h is a statement, f has no PDF.
    expect(standing.needPerson).toBe(5)
  })

  it('answers no group when every bill adds up', () => {
    const all = heldBills({ invoices: [inv({ id: 'a' })], papers: [paper('a', 'adds_up')], holds: [], houseNames })
    expect(all.groups).toEqual([])
    expect(all.standing).toMatchObject({ read: 1, addUp: 1, needPerson: 0 })
  })
})

describe('the words', () => {
  it('names a reason and a door for every hold the sweep can make', () => {
    const reasons = new Set(HELD_GROUPS.map((g) => g.reason))
    for (const why of HOLD_WHYS) if (why !== 'reading') expect(reasons.has(why), why).toBe(true)
    for (const g of HELD_GROUPS) {
      expect(g.words.trim().endsWith('.'), g.reason).toBe(true)
      expect(g.door.trim().endsWith('.'), g.reason).toBe(true)
    }
  })

  it('tells a total that is not the bill\'s amount by the check\'s own words', () => {
    const line: PaperLine = { lineNo: 1, lineKind: 'part', houseCode: '', mfrNumber: '', description: 'PVC 2 DWV 90', unit: 'EA', qtyOrdered: null, qtyShipped: 2, qtyBackordered: null, unitPrice: 14.5, pricingUnit: 'each', extendedCents: 2900 }
    const off = checkPaper({ kind: 'invoice', lines: [line], subtotalCents: 2900, taxCents: 0, freightCents: null, totalCents: 2900 }, { rowAmountCents: 5900 })
    expect(off.paperProblems.map((p) => p.kind)).toEqual(['total_vs_row'])
    expect(noteIsRowAmount(off.paperProblems[0]!.words)).toBe(true)
    expect(noteIsRowAmount('The lines are $12.40 short of the subtotal')).toBe(false)
    expect(noteIsRowAmount('The subtotal with tax and freight is $36.00 short of the total')).toBe(false)
  })

  it('says the standing in one line', () => {
    expect(standingWords({ bills: 543, read: 496, addUp: 475, off: 21, held: 28, noPdf: 19, toRead: 0, needPerson: 47 })).toBe('Lines read on 496 of 543 bills · 475 add up · 47 need a person · 19 with no PDF')
    expect(standingWords({ bills: 1, read: 1, addUp: 1, off: 0, held: 0, noPdf: 0, toRead: 0, needPerson: 0 })).toBe('Lines read on 1 of 1 bill · 1 adds up')
    expect(standingWords({ bills: 3, read: 0, addUp: 0, off: 0, held: 1, noPdf: 0, toRead: 2, needPerson: 1 })).toBe('Lines read on 0 of 3 bills · 1 needs a person · 2 to read')
  })

  it('names its presses by their count', () => {
    expect(showHeldLabel({ bills: 543, read: 496, addUp: 475, off: 21, held: 28, noPdf: 19, toRead: 0, needPerson: 47 })).toBe('Show the 47')
    expect(showHeldLabel({ bills: 20, read: 1, addUp: 1, off: 0, held: 0, noPdf: 19, toRead: 0, needPerson: 0 })).toBe('Show the bills')
    expect(groupToggleLabel(false, 12)).toBe('Show the 12')
    expect(groupToggleLabel(true, 12)).toBe('Hide the 12')
  })

  it('says what the sweep still has to read, and nothing when it has none', () => {
    expect(toReadWords(3)).toBe('3 bills are waiting to be read. The app reads them by itself within a few minutes.')
    expect(toReadWords(1)).toBe('1 bill is waiting to be read. The app reads it by itself within a few minutes.')
    expect(toReadWords(0)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import {
  addAllocation,
  creditPairingLine,
  creditableInvoices,
  creditsInvoicePatch,
  allocationTotal,
  blankInvoiceForm,
  dueDateHint,
  groupAllocationsByInvoice,
  invoiceFormFromRow,
  invoiceSaveLabel,
  ordinalDay,
  paidAtIsoFromYmd,
  paidAtPayload,
  paidOnYmdFromIso,
  poCodeHint,
  poCodeHintText,
  poLedgerCodes,
  poLedgerEntriesFromRows,
  poLedgerEntryCard,
  poLedgerEntryJobMismatch,
  poLedgerJobMatches,
  daysApartLabel,
  type PoLedgerEntry,
  removeAllocation,
  setAllocationPct,
  amountProblem,
  creditEffectSentence,
  documentKindFromRow,
  documentWords,
  signedAmountForSave,
  typedAmountCents,
  typedAmountFromStored,
} from './supplyHouseInvoiceForm'

describe('poCodeHint', () => {
  const ledger = new Set([41207, 55000])
  it('says nothing for an empty field', () => {
    expect(poCodeHint('', ledger)).toEqual({ kind: 'empty' })
    expect(poCodeHint('   ', ledger)).toEqual({ kind: 'empty' })
  })
  it('a hand PO has no five-digit code', () => {
    expect(poCodeHint('SkyLab', ledger)).toEqual({ kind: 'hand' })
    expect(poCodeHint('PO-1234', ledger)).toEqual({ kind: 'hand' })
  })
  it('a code on the ledger for this house', () => {
    expect(poCodeHint('41207', ledger)).toEqual({ kind: 'on_ledger', code: 41207 })
    expect(poCodeHint('PO 55000 rough-in', ledger)).toEqual({ kind: 'on_ledger', code: 55000 })
  })
  it('a code the house ledger does not carry', () => {
    expect(poCodeHint('41208', ledger)).toEqual({ kind: 'not_on_ledger', code: 41208 })
  })
  it('stays quiet while the ledger has not loaded', () => {
    expect(poCodeHint('41207', null)).toEqual({ kind: 'unknown', code: 41207 })
    expect(poCodeHintText({ kind: 'unknown', code: 41207 }, 'Ferguson')).toBeNull()
  })
  it('hint copy names the house', () => {
    expect(poCodeHintText({ kind: 'on_ledger', code: 41207 }, 'Ferguson')).toBe('PO 41207 is on the PO Generator ledger for Ferguson.')
    expect(poCodeHintText({ kind: 'not_on_ledger', code: 41208 }, 'Ferguson')).toMatch(/not on the PO Generator ledger for Ferguson/)
    expect(poCodeHintText({ kind: 'hand' }, 'Ferguson')).toMatch(/^Hand PO/)
    expect(poCodeHintText({ kind: 'empty' }, 'Ferguson')).toBeNull()
  })
})

describe('poLedgerEntryCard (v2.3599)', () => {
  const entry: PoLedgerEntry = {
    code: 41207,
    jobLabel: 'J964 · Oak Ridge townhomes',
    jobLedgerId: 'job-964',
    personName: 'Marcus Delgado',
    createdAt: '2026-09-16T19:41:00.000Z',
    createdBy: 'Dana',
    statedNeed: '40 ft of ¾" PEX and two stop valves',
  }
  const entries = new Map<number, PoLedgerEntry>([[41207, entry], [55000, { ...entry, code: 55000, statedNeed: '  ' }]])

  it('a matched code shows the job, the person, the day, who minted it, and the claim', () => {
    const card = poLedgerEntryCard(poCodeHint('41207', poLedgerCodes(entries)), entries)
    expect(card).toEqual({
      head: 'J964 · Oak Ridge townhomes',
      meta: 'for Marcus Delgado · Sep 16 · by Dana',
      statedNeed: '40 ft of ¾" PEX and two stop valves',
    })
  })
  it('a matched code with nothing written down still shows the row, claim null', () => {
    const card = poLedgerEntryCard({ kind: 'on_ledger', code: 55000 }, entries)
    expect(card?.head).toBe('J964 · Oak Ridge townhomes')
    expect(card?.statedNeed).toBeNull()
  })
  it('no card for a hand PO, a code off the ledger, or before the ledger loads', () => {
    expect(poLedgerEntryCard({ kind: 'hand' }, entries)).toBeNull()
    expect(poLedgerEntryCard({ kind: 'not_on_ledger', code: 41208 }, entries)).toBeNull()
    expect(poLedgerEntryCard({ kind: 'unknown', code: 41207 }, null)).toBeNull()
    expect(poLedgerEntryCard({ kind: 'on_ledger', code: 41207 }, null)).toBeNull()
  })
  it('meta skips the pieces the row does not carry', () => {
    const bare = new Map<number, PoLedgerEntry>([[1, { ...entry, code: 1, createdAt: null, createdBy: null }]])
    expect(poLedgerEntryCard({ kind: 'on_ledger', code: 1 }, bare)?.meta).toBe('for Marcus Delgado')
  })
  it('poLedgerCodes is the code set the existing checks read', () => {
    expect(poLedgerCodes(entries)).toEqual(new Set([41207, 55000]))
    expect(poLedgerCodes(null)).toBeNull()
  })
})

describe('ordinalDay / dueDateHint', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay)).toEqual([
      '1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ])
  })
  it('names the house and its day', () => {
    expect(dueDateHint('National Wholesale', 10)).toBe("National Wholesale's payment day is the 10th.")
  })
  it('nothing when the house has no payment day', () => {
    expect(dueDateHint('Ferguson', null)).toBeNull()
    expect(dueDateHint('Ferguson', undefined)).toBeNull()
    expect(dueDateHint('Ferguson', 0)).toBeNull()
    expect(dueDateHint('Ferguson', 32)).toBeNull()
  })
})

describe('paid on ↔ paid_at', () => {
  it('a day round-trips through company noon', () => {
    const iso = paidAtIsoFromYmd('2026-09-14')
    expect(iso).not.toBeNull()
    // Noon Central in September is 17:00Z.
    expect(iso).toBe('2026-09-14T17:00:00.000Z')
    expect(paidOnYmdFromIso(iso)).toBe('2026-09-14')
  })
  it('a stored instant late in the evening still reads as its Central day', () => {
    // 11:30 PM Central on the 14th is 04:30Z on the 15th.
    expect(paidOnYmdFromIso('2026-09-15T04:30:00.000Z')).toBe('2026-09-14')
  })
  it('blank or malformed → null / empty', () => {
    expect(paidAtIsoFromYmd('')).toBeNull()
    expect(paidAtIsoFromYmd('nope')).toBeNull()
    expect(paidOnYmdFromIso(null)).toBe('')
    expect(paidOnYmdFromIso(undefined)).toBe('')
  })
  it('payload: unpaid says nothing (the trigger nulls paid_at)', () => {
    expect(paidAtPayload(false, '2026-09-14', null)).toEqual({})
  })
  it('payload: paid with no day says nothing (the trigger stamps now)', () => {
    expect(paidAtPayload(true, '', null)).toEqual({})
  })
  it('payload: paid with a day sends company noon', () => {
    expect(paidAtPayload(true, '2026-09-14', null)).toEqual({ paid_at: '2026-09-14T17:00:00.000Z' })
  })
  it('payload: the same day as stored is left alone (no drift to noon)', () => {
    expect(paidAtPayload(true, '2026-09-14', '2026-09-14T20:11:00.000Z')).toEqual({})
  })
  it('payload: a different day than stored is sent', () => {
    expect(paidAtPayload(true, '2026-09-12', '2026-09-14T20:11:00.000Z')).toEqual({ paid_at: '2026-09-12T17:00:00.000Z' })
  })
})

describe('allocations', () => {
  it('first job takes 100', () => {
    expect(addAllocation([], 'a')).toEqual([{ job_id: 'a', pct: 100 }])
  })
  it('adding re-splits evenly; the last absorbs rounding', () => {
    const two = addAllocation([{ job_id: 'a', pct: 100 }], 'b')
    expect(two).toEqual([{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }])
    const three = addAllocation(two, 'c')
    expect(three.map((a) => a.pct)).toEqual([33.3, 33.3, 33.4])
    expect(allocationTotal(three)).toBe(100)
  })
  it('a job already on the invoice is a no-op (same reference)', () => {
    const list = [{ job_id: 'a', pct: 100 }]
    expect(addAllocation(list, 'a')).toBe(list)
  })
  it('removing re-splits the rest; removing the last empties', () => {
    const three = [{ job_id: 'a', pct: 33.3 }, { job_id: 'b', pct: 33.3 }, { job_id: 'c', pct: 33.4 }]
    expect(removeAllocation(three, 1)).toEqual([{ job_id: 'a', pct: 50 }, { job_id: 'c', pct: 50 }])
    expect(removeAllocation([{ job_id: 'a', pct: 100 }], 0)).toEqual([])
  })
  it('setting one percent scales the others to keep 100', () => {
    const two = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }]
    expect(setAllocationPct(two, 0, 70)).toEqual([{ job_id: 'a', pct: 70 }, { job_id: 'b', pct: 30 }])
    const three = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 25 }, { job_id: 'c', pct: 25 }]
    const next = setAllocationPct(three, 0, 80)
    expect(next[0]?.pct).toBe(80)
    expect(allocationTotal(next)).toBe(100)
  })
  it('clamps to 0–100 and treats NaN as 0', () => {
    const two = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }]
    expect(setAllocationPct(two, 0, 150)).toEqual([{ job_id: 'a', pct: 100 }, { job_id: 'b', pct: 0 }])
    expect(setAllocationPct(two, 0, Number.NaN)).toEqual([{ job_id: 'a', pct: 0 }, { job_id: 'b', pct: 100 }])
  })
  it('when every other job is at 0, the remainder is handed out evenly', () => {
    const three = [{ job_id: 'a', pct: 100 }, { job_id: 'b', pct: 0 }, { job_id: 'c', pct: 0 }]
    expect(setAllocationPct(three, 0, 40)).toEqual([{ job_id: 'a', pct: 40 }, { job_id: 'b', pct: 30 }, { job_id: 'c', pct: 30 }])
  })
  it('editing the last job pushes rounding onto its neighbour, not itself', () => {
    const three = [{ job_id: 'a', pct: 33.3 }, { job_id: 'b', pct: 33.3 }, { job_id: 'c', pct: 33.4 }]
    const next = setAllocationPct(three, 2, 50)
    expect(next[2]?.pct).toBe(50)
    expect(allocationTotal(next)).toBe(100)
  })
})

describe('invoiceSaveLabel', () => {
  it('names the action', () => {
    expect(invoiceSaveLabel(false, false)).toBe('Save invoice')
    expect(invoiceSaveLabel(true, false)).toBe('Save changes')
    expect(invoiceSaveLabel(true, true)).toBe('Saving…')
  })
})

describe('what the paper is (v2.3503)', () => {
  describe('signedAmountForSave', () => {
    it('stores an invoice as typed and a credit as its negative', () => {
      expect(signedAmountForSave('invoice', '888.10')).toBeCloseTo(888.1, 2)
      expect(signedAmountForSave('credit', '888.10')).toBeCloseTo(-888.1, 2)
    })

    it('never lets a typed minus decide the sign', () => {
      // A slipped minus key on an invoice must not become a credit.
      expect(signedAmountForSave('invoice', '-888.10')).toBeCloseTo(888.1, 2)
      // And a missing minus on a credit must not become a charge.
      expect(signedAmountForSave('credit', '888.10')).toBeCloseTo(-888.1, 2)
    })

    it('refuses a zero credit and anything unparseable', () => {
      expect(signedAmountForSave('credit', '0')).toBeNull()
      expect(signedAmountForSave('credit', '')).toBeNull()
      expect(signedAmountForSave('invoice', 'abc')).toBeNull()
      expect(signedAmountForSave('invoice', '0')).toBe(0)
    })
  })

  describe('typedAmountFromStored', () => {
    it('shows a positive magnitude whichever kind the row is', () => {
      expect(typedAmountFromStored(888.1)).toBe('888.1')
      expect(typedAmountFromStored(-888.1)).toBe('888.1')
      expect(typedAmountFromStored(0)).toBe('0')
      expect(typedAmountFromStored(null)).toBe('0')
    })
  })

  describe('amountProblem', () => {
    it('passes a good amount and explains a bad one', () => {
      expect(amountProblem('invoice', '250')).toBeNull()
      expect(amountProblem('credit', '250')).toBeNull()
      expect(amountProblem('invoice', 'abc')).toContain('number')
      expect(amountProblem('credit', '0')).toContain('zero credit')
      expect(amountProblem('invoice', '-5')).toContain('positive number')
    })
  })

  describe('documentKindFromRow', () => {
    it('reads the column when it is there', () => {
      expect(documentKindFromRow({ document_kind: 'credit', amount: -5 })).toBe('credit')
      expect(documentKindFromRow({ document_kind: 'invoice', amount: 5 })).toBe('invoice')
    })

    it('falls back to the sign for a row written before the column existed', () => {
      expect(documentKindFromRow({ amount: -5 })).toBe('credit')
      expect(documentKindFromRow({ amount: 5 })).toBe('invoice')
      expect(documentKindFromRow({ document_kind: null, amount: -5 })).toBe('credit')
    })
  })

  describe('documentWords', () => {
    it('relabels every field that names the document', () => {
      const credit = documentWords('credit')
      expect(credit.title(false)).toBe('Add credit')
      expect(credit.numberLabel).toBe('Credit #')
      expect(credit.statusCaption).toBe('Applying it')
      expect(credit.saveLabel(false, false)).toBe('Save credit')
      expect(credit.amountAdornment).toBe('− $')
      expect(credit.noJobLine).toContain('credit')
      expect(credit.documentPdfLabel).toBe('Credit PDF')

      const invoice = documentWords('invoice')
      expect(invoice.title(false)).toBe('Add invoice')
      expect(invoice.numberLabel).toBe('Invoice #')
      expect(invoice.statusCaption).toBe('Paying it')
      expect(invoice.documentPdfLabel).toBe('Invoice PDF')
      // Nothing on screen may call a credit memo an invoice.
      expect(documentWords('credit').noJobLine).not.toContain('invoice')
      // The invoice path keeps the existing label helper exactly.
      expect(invoice.saveLabel(true, false)).toBe(invoiceSaveLabel(true, false))
      expect(invoice.saveLabel(false, true)).toBe(invoiceSaveLabel(false, true))
    })
  })

  describe('creditEffectSentence', () => {
    it('names both consequences when a job is on the credit', () => {
      const s = creditEffectSentence({ amountTyped: '888.10', houseName: 'Reece', jobLabel: 'J878' })
      expect(s).toContain('$888.10')
      expect(s).toContain('Reece')
      expect(s).toContain('J878')
    })

    it('says plainly that no job gets money back when none is named', () => {
      const s = creditEffectSentence({ amountTyped: '888.10', houseName: 'Reece', jobLabel: null })
      expect(s).toContain('No job gets money back')
    })

    it('says nothing until there is an amount to say it about', () => {
      expect(creditEffectSentence({ amountTyped: '', houseName: 'Reece', jobLabel: 'J878' })).toBeNull()
      expect(creditEffectSentence({ amountTyped: '0', houseName: 'Reece', jobLabel: 'J878' })).toBeNull()
    })
  })
})

describe('poLedgerJobMatches (v2.3724)', () => {
  const base: PoLedgerEntry = {
    code: 0,
    jobLabel: 'J473 · Mike Holmby',
    jobLedgerId: 'job-473',
    personName: 'Abraham',
    createdAt: '2026-08-19T17:12:28.000Z',
    createdBy: 'Taunya',
    statedNeed: null,
  }
  const entries = new Map<number, PoLedgerEntry>([
    [46632, { ...base, code: 46632 }], // Aug 19, same day
    [95545, { ...base, code: 95545, createdAt: '2026-08-25T17:00:19.000Z', personName: 'Paige' }], // 6 days after
    [51468, { ...base, code: 51468, jobLabel: 'J883 · Mission Flats Drains', jobLedgerId: 'job-883', createdAt: '2026-08-21T14:42:56.000Z', personName: 'Malachi', statedNeed: 'trim' }],
    [10892, { ...base, code: 10892, createdAt: '2026-08-01T19:06:56.000Z' }], // 18 days before — out
    [99999, { ...base, code: 99999, jobLedgerId: null }],
  ])
  const hand = { kind: 'hand' as const }

  it('once the invoice is on a job, the codes for that job at this house near the date — nearest first', () => {
    const m = poLedgerJobMatches({ hint: hand, entries, jobIds: ['job-473'], invoiceDateYmd: '2026-08-19', houseName: 'Reece' })
    expect(m?.line).toBe('PO codes minted for this job at Reece within a week of Aug 19:')
    expect(m?.showJob).toBe(false)
    expect(m?.rows.map((r) => [r.code, r.personName, r.when, r.apart, r.statedNeed])).toEqual([
      [46632, 'Abraham', 'Aug 19', 'same day', null],
      [95545, 'Paige', 'Aug 25', '6 days after', null],
    ])
  })
  it('a split invoice reads both jobs and names the job on each row', () => {
    const m = poLedgerJobMatches({ hint: hand, entries, jobIds: ['job-473', 'job-883'], invoiceDateYmd: '2026-08-20', houseName: 'Reece' })
    expect(m?.line).toBe('PO codes minted for these jobs at Reece within a week of Aug 20:')
    expect(m?.showJob).toBe(true)
    expect(m?.rows.map((r) => [r.code, r.apart, r.statedNeed])).toEqual([
      [46632, '1 day before', null],
      [51468, '1 day after', 'trim'],
      [95545, '5 days after', null],
    ])
  })
  it('no code in the window → the one sentence, and a not-on-ledger code still gets the job read', () => {
    const none = poLedgerJobMatches({ hint: { kind: 'not_on_ledger', code: 12345 }, entries, jobIds: ['job-473'], invoiceDateYmd: '2026-07-01', houseName: 'Reece' })
    expect(none?.rows).toEqual([])
    expect(none?.line).toBe('No PO code on the ledger for this job at Reece within a week of Jul 1 — the trip was made without one, or its code sits on another job.')
  })
  it('null when the exact card is showing, the ledger has not loaded, no job is picked, or there is no date', () => {
    const args = { hint: hand, entries, jobIds: ['job-473'], invoiceDateYmd: '2026-08-19', houseName: 'Reece' }
    expect(poLedgerJobMatches({ ...args, hint: { kind: 'on_ledger', code: 46632 } })).toBeNull()
    expect(poLedgerJobMatches({ ...args, entries: null })).toBeNull()
    expect(poLedgerJobMatches({ ...args, jobIds: [] })).toBeNull()
    expect(poLedgerJobMatches({ ...args, invoiceDateYmd: '' })).toBeNull()
  })
  it('the window is a parameter; the wording follows it', () => {
    const m = poLedgerJobMatches({ hint: hand, entries, jobIds: ['job-473'], invoiceDateYmd: '2026-08-19', houseName: 'Reece', windowDays: 30 })
    expect(m?.rows.map((r) => r.code)).toEqual([46632, 95545, 10892])
    expect(m?.line).toBe('PO codes minted for this job at Reece within 30 days of Aug 19:')
  })
  it('daysApartLabel', () => {
    expect(daysApartLabel(0)).toBe('same day')
    expect(daysApartLabel(-1)).toBe('1 day before')
    expect(daysApartLabel(-3)).toBe('3 days before')
    expect(daysApartLabel(2)).toBe('2 days after')
  })
})

describe('poLedgerEntryJobMismatch (v2.3724)', () => {
  const entry: PoLedgerEntry = { code: 46632, jobLabel: 'J473 · Mike Holmby', jobLedgerId: 'job-473', personName: 'Abraham', createdAt: null, createdBy: null, statedNeed: null }
  const entries = new Map<number, PoLedgerEntry>([[46632, entry], [1, { ...entry, code: 1, jobLedgerId: null }]])
  const on = { kind: 'on_ledger' as const, code: 46632 }
  it('the code on the paper was minted for a job the invoice is not on', () => {
    expect(poLedgerEntryJobMismatch(on, entries, ['job-804'])).toBe('PO 46632 was minted for J473 · Mike Holmby — this invoice is on a different job. One of the two is wrong.')
  })
  it('quiet when the jobs agree, when no job is picked yet, when the row has no job, and when there is no exact card', () => {
    expect(poLedgerEntryJobMismatch(on, entries, ['job-473'])).toBeNull()
    expect(poLedgerEntryJobMismatch(on, entries, ['job-804', 'job-473'])).toBeNull()
    expect(poLedgerEntryJobMismatch(on, entries, [])).toBeNull()
    expect(poLedgerEntryJobMismatch({ kind: 'on_ledger', code: 1 }, entries, ['job-804'])).toBeNull()
    expect(poLedgerEntryJobMismatch({ kind: 'not_on_ledger', code: 46632 }, entries, ['job-804'])).toBeNull()
    expect(poLedgerEntryJobMismatch(on, null, ['job-804'])).toBeNull()
  })
})

describe('a credit pairs to the invoice it credits (v2.5035)', () => {
  const rows = [
    { id: 'i1', invoice_number: 'S123148787.003', amount: 2496.94, document_kind: 'invoice', invoice_date: '2026-04-06' },
    { id: 'i2', invoice_number: 'S124000001.001', amount: 1204, document_kind: 'invoice', invoice_date: '2026-09-12' },
    { id: 'c1', invoice_number: 'S123396858.002', amount: -120, document_kind: 'credit', invoice_date: '2026-04-09', credits_invoice_id: 'i1' },
    { id: 'c2', invoice_number: 'CM-4471', amount: -150, document_kind: 'credit', invoice_date: '2026-09-20', credits_invoice_id: 'i1' },
    { id: 'c3', invoice_number: 'CM-9', amount: -40, document_kind: 'credit', invoice_date: '2026-09-21', credits_invoice_id: null },
  ]
  it('offers this house’s invoices, newest first, never a credit or the credit itself', () => {
    expect(creditableInvoices(rows, 'c3').map((o) => o.label)).toEqual(['S124000001.001 · $1,204.00 · Sep 12, 2026', 'S123148787.003 · $2,496.94 · Apr 6, 2026'])
    expect(creditableInvoices(rows, 'i2').map((o) => o.id)).toEqual(['i1'])
  })
  it('a credit names its invoice, and the invoice names each credit against it', () => {
    expect(creditPairingLine(rows[2]!, rows)).toBe('Credits S123148787.003')
    expect(creditPairingLine(rows[0]!, rows)).toBe('Credited by S123396858.002 (−$120.00), CM-4471 (−$150.00)')
    expect(creditPairingLine(rows[1]!, rows)).toBeNull()
    expect(creditPairingLine(rows[4]!, rows)).toBeNull()
    expect(creditPairingLine({ ...rows[4]!, credits_invoice_id: 'gone' }, rows)).toBe('Credits an invoice not on this list')
  })
  it('a save names the column only when the pair changes, and an invoice never carries one', () => {
    expect(creditsInvoicePatch('credit', 'i1', null)).toEqual({ credits_invoice_id: 'i1' })
    expect(creditsInvoicePatch('credit', '', null)).toEqual({})
    expect(creditsInvoicePatch('credit', 'i1', { credits_invoice_id: 'i1' })).toEqual({})
    expect(creditsInvoicePatch('credit', '', { credits_invoice_id: 'i1' })).toEqual({ credits_invoice_id: null })
    expect(creditsInvoicePatch('invoice', 'i1', { credits_invoice_id: 'i1' })).toEqual({ credits_invoice_id: null })
    expect(creditsInvoicePatch('invoice', 'i1', {})).toEqual({})
  })
})

describe('groupAllocationsByInvoice', () => {
  it('groups the rows by invoice, in the order they came, each share a number', () => {
    const grouped = groupAllocationsByInvoice([
      { invoice_id: 'a', job_id: 'j1', pct: 60 },
      { invoice_id: 'b', job_id: 'j2', pct: '100' },
      { invoice_id: 'a', job_id: 'j3', pct: '40' },
    ])
    expect(grouped).toEqual({ a: [{ job_id: 'j1', pct: 60 }, { job_id: 'j3', pct: 40 }], b: [{ job_id: 'j2', pct: 100 }] })
  })

  it('an invoice with no rows has no entry', () => {
    expect(groupAllocationsByInvoice([])).toEqual({})
    expect(groupAllocationsByInvoice([{ invoice_id: 'a', job_id: 'j1', pct: 100 }]).b).toBeUndefined()
  })
})

describe('poLedgerEntriesFromRows', () => {
  // Made-up ledger rows.
  const row = (po_code: number | string, over: Partial<Parameters<typeof poLedgerEntriesFromRows>[0][number]> = {}) => ({
    po_code,
    notes: 'two water heaters',
    created_at: '2026-03-02T15:00:00Z',
    job_ledger_id: 'job-1',
    jobs_ledger: { hcp_number: '964', click_number: null, job_name: ' Oak Ridge townhomes ' },
    for_user: { name: ' Dana ', email: 'dana@example.test' },
    created_by_user: { name: null, email: 'office@example.test' },
    ...over,
  })

  it('reads a row into its entry: the job with its prefix, who it was for, who made it, the stated need', () => {
    expect(poLedgerEntriesFromRows([row(10410)]).get(10410)).toEqual({
      code: 10410,
      jobLabel: 'J964 · Oak Ridge townhomes',
      jobLedgerId: 'job-1',
      personName: 'Dana',
      createdAt: '2026-03-02T15:00:00Z',
      createdBy: 'office@example.test',
      statedNeed: 'two water heaters',
    })
  })

  it('a row with no job, no person and no maker reads as dashes and nulls', () => {
    const entry = poLedgerEntriesFromRows([row('10420', { job_ledger_id: null, jobs_ledger: null, for_user: null, created_by_user: null, notes: null })]).get(10420)
    expect(entry).toMatchObject({ code: 10420, jobLabel: 'J— · —', jobLedgerId: null, personName: '—', createdBy: null, statedNeed: null })
  })

  it('falls back to the Click number, and to the email when the name is blank', () => {
    const entry = poLedgerEntriesFromRows([row(10430, { jobs_ledger: { hcp_number: ' ', click_number: '77', job_name: 'Elm' }, for_user: { name: ' ', email: 'sam@example.test' } })]).get(10430)
    expect(entry).toMatchObject({ jobLabel: 'J77 · Elm', personName: 'sam@example.test' })
  })

  it('keeps one entry a code, the later row winning, and the codes check reads them', () => {
    const entries = poLedgerEntriesFromRows([row(10410), row(10410, { notes: 'the later one' }), row(10440)])
    expect(entries.size).toBe(2)
    expect(entries.get(10410)?.statedNeed).toBe('the later one')
    expect([...(poLedgerCodes(entries) ?? [])].sort()).toEqual([10410, 10440])
  })
})

describe('the form\'s fields', () => {
  it('a new bill is dated today, due on the house\'s next pay day, and blank everywhere else', () => {
    expect(blankInvoiceForm(10, '2026-10-29')).toEqual({
      number: '', dateYmd: '2026-10-29', dueDateYmd: '2026-11-10', amountTyped: '', kind: 'invoice', isInterest: false, lateInvoiceId: '', creditsInvoiceId: '',
      link: '', isPaid: false, paidOnYmd: '', onJobAccount: false, purchaseOrderNumber: '', allocations: [],
    })
  })

  it('a house with no pay day leaves the due day blank', () => {
    expect(blankInvoiceForm(null, '2026-10-29').dueDateYmd).toBe('')
    expect(blankInvoiceForm(undefined, '2026-10-29').dueDateYmd).toBe('')
  })

  // A made-up stored row.
  const row = { invoice_number: 'S-1', invoice_date: '2026-10-22', due_date: null, amount: -138.99, document_kind: 'credit', credits_invoice_id: 'inv-1', link: null, is_paid: true, is_interest: false, late_invoice_id: null, paid_at: '2026-10-25T18:00:00Z', on_job_account: true, purchase_order_number: null, job_allocations: [{ job_id: 'j1', pct: 100 }] }

  it('reads a stored row: the amount unsigned, the kind from the row, the paid day in company time', () => {
    expect(invoiceFormFromRow(row)).toEqual({
      number: 'S-1', dateYmd: '2026-10-22', dueDateYmd: '', amountTyped: '138.99', kind: 'credit', isInterest: false, lateInvoiceId: '', creditsInvoiceId: 'inv-1',
      link: '', isPaid: true, paidOnYmd: '2026-10-25', onJobAccount: true, purchaseOrderNumber: '', allocations: [{ job_id: 'j1', pct: 100 }],
    })
  })

  it('an unpaid row has no paid day, and a row read before a column existed reads it as off', () => {
    const old = invoiceFormFromRow({ invoice_number: 'S-2', invoice_date: '2026-10-22', due_date: '2026-11-21', amount: 40, link: 'https://example.test/scan', is_paid: false, paid_at: '2026-10-25T18:00:00Z', purchase_order_number: '10410' })
    expect(old).toMatchObject({ kind: 'invoice', amountTyped: '40', paidOnYmd: '', onJobAccount: false, isInterest: false, lateInvoiceId: '', creditsInvoiceId: '', allocations: [], dueDateYmd: '2026-11-21', link: 'https://example.test/scan', purchaseOrderNumber: '10410' })
  })

  it('reads the amount box as cents, digits and the point only', () => {
    expect(typedAmountCents('952.28')).toBe(95228)
    expect(typedAmountCents('$1,952.28')).toBe(195228)
    expect(typedAmountCents('19.999')).toBe(2000)
    expect(typedAmountCents('')).toBe(0)
    expect(typedAmountCents('1.2.3')).toBe(0)
  })
})

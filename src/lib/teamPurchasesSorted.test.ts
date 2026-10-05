import { describe, expect, it } from 'vitest'
import {
  invoiceTotalForCharge,
  parseSortedInvoiceLinks,
  parseSortedJobSplits,
  sortedRowIsShort,
  sortedWentToLines,
  sortedWhenWords,
} from './teamPurchasesSorted'

const PREFIXES = { plumbing: { job: 'JP', bid: 'BP' } }

describe('invoiceTotalForCharge', () => {
  it('says nothing while no invoice is ticked', () => {
    expect(invoiceTotalForCharge(-595.54, [])).toEqual({ tone: 'none', shortBy: 0, words: '' })
  })

  it('matches a charge two invoices add up to, to the cent', () => {
    const t = invoiceTotalForCharge(-595.54, [412.1, 183.44])
    expect(t.tone).toBe('match')
    expect(t.words).toBe('The invoices add up to the charge')
  })

  it('names what one invoice leaves uncovered', () => {
    const t = invoiceTotalForCharge(-595.54, [412.1])
    expect(t.tone).toBe('short')
    expect(t.shortBy).toBe(183.44)
    expect(t.words).toBe('$183.44 of the charge has no invoice yet')
  })

  it('names the overage when the invoices come to more', () => {
    const t = invoiceTotalForCharge(-100, [60, 60])
    expect(t.tone).toBe('over')
    expect(t.words).toBe('The invoices come to $20.00 more than the charge')
  })

  it('does not trip on float sums', () => {
    expect(invoiceTotalForCharge(-0.3, [0.1, 0.2]).tone).toBe('match')
  })
})

describe('parsing', () => {
  it('reads job splits and skips rows with no job', () => {
    expect(
      parseSortedJobSplits([
        { job_id: 'j1', amount: '-40', hcp_number: '1048', job_name: 'Loberg remodel', service_type_id: 'plumbing' },
        { amount: 5 },
        null,
      ]),
    ).toEqual([
      { jobId: 'j1', amount: -40, hcpNumber: '1048', clickNumber: null, jobName: 'Loberg remodel', serviceTypeId: 'plumbing' },
    ])
    expect(parseSortedJobSplits(null)).toEqual([])
  })

  it('reads invoice links with fallbacks', () => {
    expect(parseSortedInvoiceLinks([{ invoice_id: 'i1', amount: 12.5 }])).toEqual([
      { invoiceId: 'i1', invoiceNumber: '—', supplyHouseName: 'Supply house', amount: 12.5 },
    ])
  })
})

describe('sortedWentToLines', () => {
  it('names one job', () => {
    expect(
      sortedWentToLines(
        { job_splits: [{ job_id: 'j1', amount: -100.02, hcp_number: '1048', job_name: 'Loberg remodel', service_type_id: 'plumbing' }], invoice_links: [] },
        PREFIXES,
      ),
    ).toEqual(['JP1048 · Loberg remodel'])
  })

  it('names each job of a split with its share', () => {
    const lines = sortedWentToLines(
      {
        job_splits: [
          { job_id: 'j1', amount: -40, hcp_number: '1048', job_name: 'A', service_type_id: 'plumbing' },
          { job_id: 'j2', amount: -20, hcp_number: '1051', job_name: 'B', service_type_id: 'plumbing' },
        ],
        invoice_links: [],
      },
      PREFIXES,
    )
    expect(lines).toEqual(['2 jobs · JP1048 · A $40.00, JP1051 · B $20.00'])
  })

  it('names the invoices', () => {
    expect(
      sortedWentToLines(
        { job_splits: [], invoice_links: [{ invoice_id: 'i1', invoice_number: '88231', supply_house_name: 'Home Depot', amount: 412.1 }] },
        PREFIXES,
      ),
    ).toEqual(['1 invoice · Home Depot #88231 ($412.10)'])
  })
})

describe('sortedRowIsShort', () => {
  it('is true only for an invoice-matched charge with money left over', () => {
    const inv = (amount: number) => ({ invoice_id: 'i', invoice_number: '1', supply_house_name: 'H', amount })
    expect(sortedRowIsShort({ amount: -595.54, invoice_links: [inv(412.1)] })).toBe(true)
    expect(sortedRowIsShort({ amount: -595.54, invoice_links: [inv(412.1), inv(183.44)] })).toBe(false)
    expect(sortedRowIsShort({ amount: -595.54, invoice_links: [] })).toBe(false)
  })
})

describe('sortedWhenWords', () => {
  const now = Date.parse('2026-10-05T18:00:00Z')
  it('says today on the office calendar, with the first name', () => {
    expect(sortedWhenWords('2026-10-05T14:00:00Z', 'Taunya Smith', now)).toBe('sorted today by Taunya')
  })
  it('says the day otherwise', () => {
    expect(sortedWhenWords('2026-10-02T20:00:00Z', 'Taunya', now)).toBe('sorted Oct 2 by Taunya')
  })
  it('holds up with nothing known', () => {
    expect(sortedWhenWords(null, null, now)).toBe('sorted')
  })
})

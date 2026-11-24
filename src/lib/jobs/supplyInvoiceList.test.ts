import { describe, expect, it } from 'vitest'
import {
  canShareSupplyInvoice,
  invoiceDayWords,
  lineHoldsWord,
  markWords,
  searchSupplyInvoices,
  supplierSiteHref,
  supplyHouseChips,
  supplyInvoiceCountWords,
  supplyInvoicePdfHref,
  supplyInvoiceSearchTerms,
  supplyInvoiceSearchWords,
  supplyInvoiceShareUrl,
  type InvoiceLinesById,
  type SupplyInvoiceRow,
} from './supplyInvoiceList'

/** Made-up rows: no house, number, date or amount here is a real one. */
function row(over: Partial<SupplyInvoiceRow> & { invoice_id: string }): SupplyInvoiceRow {
  return {
    job_id: 'job-1',
    allocated_amount: 100,
    invoice_number: 'X-1',
    invoice_date: '2026-11-16',
    invoice_total_amount: 100,
    supply_house_name: 'Brightwater Pipe & Valve',
    website_url: null,
    invoice_link: 'https://drive.example/file/d/abc/view',
    pct: 100,
    ...over,
  }
}

const ROWS: SupplyInvoiceRow[] = [
  row({ invoice_id: 'a', invoice_number: 'HS-204418', invoice_date: '2026-11-16', allocated_amount: 560, invoice_total_amount: 560, supply_house_name: 'Harlow Supply' }),
  row({ invoice_id: 'b', invoice_number: 'BW 7731-02', invoice_date: '2026-11-01', allocated_amount: 40.48, invoice_total_amount: 40.48 }),
  row({ invoice_id: 'c', invoice_number: 'BW 7602-01', invoice_date: '2026-10-15', allocated_amount: 1085.58, invoice_total_amount: 2171.16, pct: 50 }),
  row({ invoice_id: 'd', invoice_number: 'CF117406', invoice_date: '2025-12-18', allocated_amount: 1160, invoice_total_amount: 1160, supply_house_name: 'Mayfield Wholesale' }),
]

const ids = (query: string, house: string | null = null) => searchSupplyInvoices(ROWS, query, house).rows.map((r) => r.invoice_id)

describe('invoiceDayWords', () => {
  it('drops the year this year and keeps it for another', () => {
    expect(invoiceDayWords('2026-11-16', '2026-11-23')).toBe('Nov 16')
    expect(invoiceDayWords('2025-12-18', '2026-11-23')).toBe('Dec 18, 2025')
    expect(invoiceDayWords('2027-01-05', '2026-11-23')).toBe('Jan 5, 2027')
  })
  it('reads a timestamp by its day and hands back what it cannot read', () => {
    expect(invoiceDayWords('2026-03-09T00:00:00Z', '2026-11-23')).toBe('Mar 9')
    expect(invoiceDayWords('soon', '2026-11-23')).toBe('soon')
    expect(invoiceDayWords('2026-13-40', '2026-11-23')).toBe('2026-13-40')
    expect(invoiceDayWords(null, '2026-11-23')).toBe('—')
  })
})

describe('searchSupplyInvoices', () => {
  it('an empty search is every row, with what they add up to', () => {
    const all = searchSupplyInvoices(ROWS, '  ')
    expect(all.rows).toHaveLength(4)
    expect(all.total).toBe(2846.06)
  })
  it('finds by the house, whatever the case', () => {
    expect(ids('harlow')).toEqual(['a'])
    expect(ids('BRIGHT')).toEqual(['b', 'c'])
  })
  it('finds by the invoice number, with or without its spaces and marks', () => {
    expect(ids('7731')).toEqual(['b'])
    expect(ids('bw7731')).toEqual(['b'])
    expect(ids('bw-7602')).toEqual(['c'])
    expect(ids('hs-204418')).toEqual(['a'])
  })
  it('finds by the amount on this job or on the whole bill, typed either way', () => {
    expect(ids('1085.58')).toEqual(['c'])
    expect(ids('1,085.58')).toEqual(['c'])
    expect(ids('$1,085.58')).toEqual(['c'])
    expect(ids('2171.16')).toEqual(['c'])
    expect(ids('40.48')).toEqual(['b'])
  })
  it('a typed day is that day and never loose digits', () => {
    // Nov 1 is not Nov 16, and the 16 of Nov 16 is not the 16 inside $1,160.00.
    expect(ids('nov 1')).toEqual(['b'])
    expect(ids('nov 16')).toEqual(['a'])
    expect(ids('November 16, 2026')).toEqual(['a'])
    expect(ids('11/16')).toEqual(['a'])
    expect(ids('11/16/26')).toEqual(['a'])
    expect(ids('11/16/2025')).toEqual([])
    expect(ids('2026-10-15')).toEqual(['c'])
    expect(ids('12/18')).toEqual(['d'])
  })
  it('a month is every day of it, in any year unless one is typed', () => {
    expect(ids('nov')).toEqual(['a', 'b'])
    expect(ids('oct 2026')).toEqual(['c'])
    expect(ids('dec')).toEqual(['d'])
    expect(ids('dec 2026')).toEqual([])
    expect(ids('2026-11')).toEqual(['a', 'b'])
    expect(ids('2025')).toEqual(['d'])
  })
  it('a month typed alone still finds a house whose name starts with it', () => {
    expect(ids('may')).toEqual(['d'])
  })
  it('every word must be met', () => {
    expect(ids('bright oct')).toEqual(['c'])
    expect(ids('harlow oct')).toEqual([])
  })
  it('the house chip narrows with the search', () => {
    expect(ids('', 'Brightwater Pipe & Valve')).toEqual(['b', 'c'])
    expect(ids('7602', 'Brightwater Pipe & Valve')).toEqual(['c'])
    expect(ids('7602', 'Harlow Supply')).toEqual([])
    expect(searchSupplyInvoices(ROWS, '', 'Brightwater Pipe & Valve').total).toBe(1126.06)
  })
})

describe('supplyInvoiceSearchTerms', () => {
  it('reads a day, a month and a word', () => {
    expect(supplyInvoiceSearchTerms('Nov 16, 2026 harlow')).toEqual([
      { kind: 'day', month: 11, day: 16, year: 2026 },
      { kind: 'text', text: 'harlow' },
    ])
    expect(supplyInvoiceSearchTerms('sept')).toEqual([{ kind: 'month', month: 9, year: null, word: 'sept' }])
    expect(supplyInvoiceSearchTerms('13/45')).toEqual([{ kind: 'text', text: '13/45' }])
    expect(supplyInvoiceSearchTerms('$')).toEqual([])
  })
})

describe('supplyHouseChips', () => {
  it('a chip per house, the busiest first, and none for one house', () => {
    expect(supplyHouseChips(ROWS)).toEqual([
      { name: 'Brightwater Pipe & Valve', count: 2 },
      { name: 'Harlow Supply', count: 1 },
      { name: 'Mayfield Wholesale', count: 1 },
    ])
    expect(supplyHouseChips(ROWS.slice(1, 3))).toEqual([])
  })
})

describe('the words and the links', () => {
  it('counts in words', () => {
    expect(supplyInvoiceCountWords(18, 18)).toBe('invoices')
    expect(supplyInvoiceCountWords(4, 18)).toBe('of 18 invoices')
    expect(supplyInvoiceCountWords(1, 1)).toBe('invoice')
  })
  it('the share link is the bill’s lasting link with its job', () => {
    expect(supplyInvoiceShareUrl('inv-1', 'job-9')).toMatch(/\/files\/bills\/inv-1\?job=job-9$/)
    expect(supplyInvoiceShareUrl('inv-1', null)).toMatch(/\/files\/bills\/inv-1$/)
  })
  it('the office shares, nobody else', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(canShareSupplyInvoice(role)).toBe(true)
    for (const role of ['estimator', 'primary', 'helper', 'subcontractor', '', null, undefined]) expect(canShareSupplyInvoice(role)).toBe(false)
  })
  it('a bill’s PDF is its own link, and the house’s site is never the bill', () => {
    expect(supplyInvoicePdfHref({ invoice_link: 'drive.example/file/d/abc' })).toBe('https://drive.example/file/d/abc')
    expect(supplyInvoicePdfHref({ invoice_link: null })).toBeNull()
    expect(supplyInvoicePdfHref({ invoice_link: 'https://maps.google.com/?q=x' })).toBeNull()
    expect(supplierSiteHref({ website_url: 'house.example' })).toBe('https://house.example')
    expect(supplierSiteHref({ website_url: '  ' })).toBeNull()
  })
})

/** Made-up lines, as the reader keeps them for each bill. */
const LINES: InvoiceLinesById = new Map([
  ['a', [{ description: '50 gal gas water heater', code: 'WH-50-GAS', mfr: 'XG50T06' }]],
  [
    'b',
    [
      { description: '3/4 in. ball valve, full port, brass', code: 'BV-FP-075', mfr: '' },
      { description: 'Purple primer, pint', code: 'PRIMER-PT', mfr: '' },
    ],
  ],
  ['c', [{ description: '2 in. ball valve, full port, brass', code: 'BV-FP-200', mfr: 'T-900-2' }]],
])
const found = (query: string, house: string | null = null) => searchSupplyInvoices(ROWS, query, house, LINES)

describe('the search reaches the lines on the paper (PR 3)', () => {
  it('a part finds the bills whose paper lists it, and says which line', () => {
    const valves = found('ball valve')
    expect(valves.rows.map((r) => r.invoice_id)).toEqual(['b', 'c'])
    expect(valves.onPaper.get('b')?.code).toBe('BV-FP-075')
    expect(valves.onPaper.get('c')?.code).toBe('BV-FP-200')
    expect(found('water heater').rows.map((r) => r.invoice_id)).toEqual(['a'])
  })
  it('finds by the house’s code and the maker’s number, with or without their marks', () => {
    expect(found('bv-fp-200').rows.map((r) => r.invoice_id)).toEqual(['c'])
    expect(found('bvfp').rows.map((r) => r.invoice_id)).toEqual(['b', 'c'])
    expect(found('xg50t06').rows.map((r) => r.invoice_id)).toEqual(['a'])
    expect(found('t9002').rows.map((r) => r.invoice_id)).toEqual(['c'])
  })
  it('a word the row’s own facts hold names no line', () => {
    const harlow = found('harlow')
    expect(harlow.rows.map((r) => r.invoice_id)).toEqual(['a'])
    expect(harlow.onPaper.size).toBe(0)
  })
  it('a part and a fact together: every word is still met', () => {
    expect(found('valve oct').rows.map((r) => r.invoice_id)).toEqual(['c'])
    expect(found('valve harlow').rows).toEqual([])
    expect(found('valve', 'Harlow Supply').rows).toEqual([])
  })
  it('a typed day is never a part', () => {
    // 11/16 is a day, so the 2 of a 2 in. valve is not asked.
    expect(found('11/16').rows.map((r) => r.invoice_id)).toEqual(['a'])
  })
  it('a month typed alone is also read as a word on a line', () => {
    const lines: InvoiceLinesById = new Map([['c', [{ description: 'Mayline pipe hanger', code: '', mfr: '' }]]])
    const may = searchSupplyInvoices(ROWS, 'may', null, lines)
    expect(may.rows.map((r) => r.invoice_id)).toEqual(['c', 'd'])
    expect(may.onPaper.get('c')?.description).toBe('Mayline pipe hanger')
  })
  it('with no lines handed in, the search is the four facts alone', () => {
    expect(searchSupplyInvoices(ROWS, 'ball valve').rows).toEqual([])
    expect(searchSupplyInvoices(ROWS, 'ball valve', null, new Map()).rows).toEqual([])
  })
  it('a line holds a word in its description or its codes', () => {
    const line = { description: '2 in. ball valve', code: 'BV-FP-200', mfr: '' }
    expect(lineHoldsWord(line, 'valve')).toBe(true)
    expect(lineHoldsWord(line, 'bvfp200')).toBe(true)
    expect(lineHoldsWord(line, 'copper')).toBe(false)
    // An empty maker's number is not found by anything.
    expect(lineHoldsWord({ description: '', code: '', mfr: '' }, 'a')).toBe(false)
  })
})

describe('marking the words of a search', () => {
  it('the plain words of a search, without its days', () => {
    expect(supplyInvoiceSearchWords('ball valve nov 16')).toEqual(['ball', 'valve'])
    expect(supplyInvoiceSearchWords('may 2026 copper')).toEqual(['copper'])
    expect(supplyInvoiceSearchWords('may')).toEqual(['may'])
    expect(supplyInvoiceSearchWords('')).toEqual([])
  })
  it('cuts a text where the words sit, in order', () => {
    expect(markWords('2 in. ball valve, full port', ['valve', 'ball'])).toEqual([
      { text: '2 in. ', hit: false },
      { text: 'ball', hit: true },
      { text: ' ', hit: false },
      { text: 'valve', hit: true },
      { text: ', full port', hit: false },
    ])
  })
  it('keeps the text’s own letters, and a text with no word is one piece', () => {
    expect(markWords('Ball Valve', ['ball'])).toEqual([{ text: 'Ball', hit: true }, { text: ' Valve', hit: false }])
    expect(markWords('copper tee', ['valve'])).toEqual([{ text: 'copper tee', hit: false }])
    expect(markWords('copper tee', [])).toEqual([{ text: 'copper tee', hit: false }])
    // A one-letter word marks nothing, and two words on the same letters mark them once.
    expect(markWords('a tee', ['a'])).toEqual([{ text: 'a tee', hit: false }])
    expect(markWords('valve', ['valve', 'alv'])).toEqual([{ text: 'valve', hit: true }])
  })
})

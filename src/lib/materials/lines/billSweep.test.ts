import { describe, expect, it } from 'vitest'
import {
  BILL_SWEEP_DAILY_CAP,
  EMPTY_SWEEP_RUN,
  HOLD_WHYS,
  HOLD_WORDS,
  MATCH_RULES,
  PAPERS_SCHEMA,
  READING_STALE_MS,
  billSweepIsOn,
  fileIdOfLink,
  foldNumber,
  holdDue,
  joinPapers,
  lineOfStoredRow,
  matchRows,
  numberWithSuffix,
  pageRanges,
  paperRowOf,
  papersFromContent,
  papersUserMessage,
  probePick,
  probeWords,
  readPapersAnswer,
  recheckStored,
  recheckWords,
  seenKey,
  statusWords,
  sweepPlan,
  sweepWords,
  type FilePaper,
  type StoredLineRow,
  type SweepHold,
  type SweepInvoice,
} from './billSweep'

// Made-up bills: invented houses, numbers, codes and prices.
const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const FILE_B = '1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654'
const linkOf = (id: string) => `https://drive.google.com/file/d/${id}/view?usp=drive_link`

const inv = (over: Partial<SweepInvoice> & { id: string }): SweepInvoice => ({ supplyHouseId: 'house-1', number: 'S100200', dateYmd: '2026-10-01', amountCents: 11260, kind: 'invoice', link: linkOf(FILE_A), ...over })

const rawLine = (over: Record<string, string> = {}) => ({
  line_kind: 'part',
  house_code: '48370',
  mfr_number: '',
  description: 'PVC PIPE 2X20',
  unit: 'FT',
  quantity: '120',
  qty_ordered: '120',
  qty_shipped: '120',
  qty_backordered: '',
  unit_price: '0.507',
  pricing_unit: 'each',
  extended: '60.84',
  ...over,
})

const rawPaper = (over: Record<string, unknown> = {}) => ({
  house_name: 'Made Up Supply',
  document_kind: 'invoice',
  number: 'S100200',
  date: '2026-10-01',
  order_number: '',
  po_text: 'J123',
  account_ref: '',
  ship_to: '',
  job_text: '',
  terms: 'Net 30',
  references_number: '',
  lines: [rawLine(), rawLine({ house_code: '30614', description: '2 DWV 90', unit: 'EA', quantity: '20', qty_ordered: '20', qty_shipped: '20', unit_price: '2.159', extended: '43.18' })],
  subtotal: '104.02',
  tax: '8.58',
  freight: '',
  total: '112.60',
  statement_numbers: [],
  notes: '',
  page_from: 1,
  page_to: 1,
  ...over,
})

const papersOf = (raws: unknown[], offset = 0): FilePaper[] => readPapersAnswer({ papers: raws, page_count: raws.length }, offset)!.papers

describe('the link and the number', () => {
  it('reads a Drive file id from the three link shapes, and nothing from a folder or another site', () => {
    expect(fileIdOfLink(linkOf(FILE_A))).toBe(FILE_A)
    expect(fileIdOfLink(`https://drive.google.com/open?id=${FILE_A}`)).toBe(FILE_A)
    expect(fileIdOfLink(`https://drive.google.com/uc?export=download&id=${FILE_A}`)).toBe(FILE_A)
    expect(fileIdOfLink(`https://drive.google.com/file/u/1/d/${FILE_A}/view`)).toBe(FILE_A)
    expect(fileIdOfLink(`https://drive.google.com/drive/folders/${FILE_A}`)).toBeNull()
    expect(fileIdOfLink('https://example.com/bill.pdf')).toBeNull()
    expect(fileIdOfLink(null)).toBeNull()
  })

  it('folds a number to letters and digits with no leading zeros', () => {
    expect(foldNumber(' s100-200.001 ')).toBe('S100200001')
    expect(foldNumber('#00417')).toBe('417')
    expect(foldNumber('0')).toBe('0')
    expect(foldNumber('')).toBe('')
  })

  it('keys a hold on the file and the number', () => {
    expect(seenKey(inv({ id: 'a' }))).toBe(`${FILE_A}|S100200|r${MATCH_RULES}`)
    expect(seenKey(inv({ id: 'a', link: 'https://example.com/x' }))).toBe(`|S100200|r${MATCH_RULES}`)
  })
})

describe('holdDue', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const hold = (why: SweepHold['why'], agoMs: number, tries = 1, over: Partial<SweepHold> = {}): SweepHold => ({ invoiceId: 'a', why, seenKey: seenKey(inv({ id: 'a' })), triedAt: new Date(now - agoMs).toISOString(), tries, ...over })
  const HOUR = 3_600_000

  it('waits for a person on a reason another try cannot help', () => {
    for (const why of ['link', 'not_readable', 'too_big', 'number_not_in_file', 'not_a_bill', 'statement'] as const) {
      expect(holdDue(hold(why, 90 * 24 * HOUR), inv({ id: 'a' }), now)).toBe(false)
    }
  })

  it('is due one more read when the hold was made under older rules of the match', () => {
    expect(holdDue(hold('number_not_in_file', HOUR, 1, { seenKey: `${FILE_A}|S100200` }), inv({ id: 'a' }), now)).toBe(true)
    expect(holdDue(hold('number_not_in_file', HOUR), inv({ id: 'a' }), now)).toBe(false)
  })

  it('is due again once a person changes the link or the number', () => {
    expect(holdDue(hold('number_not_in_file', HOUR), inv({ id: 'a', number: 'S100201' }), now)).toBe(true)
    expect(holdDue(hold('cannot_open', HOUR), inv({ id: 'a', link: linkOf(FILE_B) }), now)).toBe(true)
  })

  it('takes a row a dead run left reading after a quarter hour', () => {
    expect(holdDue(hold('reading', READING_STALE_MS - 1000), inv({ id: 'a' }), now)).toBe(false)
    expect(holdDue(hold('reading', READING_STALE_MS), inv({ id: 'a' }), now)).toBe(true)
  })

  it('tries a failed read again an hour on, six times', () => {
    expect(holdDue(hold('failed', HOUR - 1000), inv({ id: 'a' }), now)).toBe(false)
    expect(holdDue(hold('failed', HOUR, 5), inv({ id: 'a' }), now)).toBe(true)
    expect(holdDue(hold('failed', 9 * HOUR, 6), inv({ id: 'a' }), now)).toBe(false)
  })

  it('tries a file it could not open, a refusal and a cut a day on, four times', () => {
    for (const why of ['cannot_open', 'refused', 'cut'] as const) {
      expect(holdDue(hold(why, 23 * HOUR), inv({ id: 'a' }), now)).toBe(false)
      expect(holdDue(hold(why, 24 * HOUR, 3), inv({ id: 'a' }), now)).toBe(true)
      expect(holdDue(hold(why, 48 * HOUR, 4), inv({ id: 'a' }), now)).toBe(false)
    }
  })
})

describe('sweepPlan', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')

  it('reads one file once for every row that links it, newest bill first', () => {
    const invoices = [
      inv({ id: 'a', number: 'S1', dateYmd: '2026-09-01' }),
      inv({ id: 'b', number: 'S2', dateYmd: '2026-09-03' }),
      inv({ id: 'c', number: 'S3', dateYmd: '2026-10-20', link: linkOf(FILE_B) }),
    ]
    const plan = sweepPlan({ invoices, paperInvoiceIds: new Set(), holds: new Map(), nowMs: now })
    expect(plan.files.map((f) => [f.fileId, f.rows.map((r) => r.id), f.newestYmd])).toEqual([
      [FILE_B, ['c'], '2026-10-20'],
      [FILE_A, ['a', 'b'], '2026-09-03'],
    ])
    expect(plan.status).toMatchObject({ bills: 3, read: 0, ready: 3, readyFiles: 2, heldTotal: 0, noPdf: 0 })
  })

  it('leaves a bill with a paper alone, counts one with no link, and holds a link that is no Drive file', () => {
    const invoices = [inv({ id: 'a' }), inv({ id: 'b', link: null }), inv({ id: 'c', link: '   ' }), inv({ id: 'd', link: 'https://example.com/bill.pdf' })]
    const plan = sweepPlan({ invoices, paperInvoiceIds: new Set(['a']), holds: new Map(), nowMs: now })
    expect(plan.files).toEqual([])
    expect(plan.linkHolds.map((r) => r.id)).toEqual(['d'])
    expect(plan.status).toMatchObject({ bills: 4, read: 1, noPdf: 2, held: { link: 1 }, heldTotal: 1, ready: 0 })
  })

  it('does not write the link hold twice, and writes it again when the link changed', () => {
    const row = inv({ id: 'd', link: 'https://example.com/bill.pdf' })
    const held: SweepHold = { invoiceId: 'd', why: 'link', seenKey: seenKey(row), triedAt: new Date(now).toISOString(), tries: 1 }
    expect(sweepPlan({ invoices: [row], paperInvoiceIds: new Set(), holds: new Map([['d', held]]), nowMs: now }).linkHolds).toEqual([])
    const moved = { ...row, link: 'https://example.com/other.pdf', number: 'S9' }
    expect(sweepPlan({ invoices: [moved], paperInvoiceIds: new Set(), holds: new Map([['d', held]]), nowMs: now }).linkHolds).toEqual([moved])
  })

  it('counts a held row as held, a row being read as neither, and reads the whole file when one of its rows is due', () => {
    const a = inv({ id: 'a', number: 'S1' })
    const b = inv({ id: 'b', number: 'S2' })
    const c = inv({ id: 'c', number: 'S3', link: linkOf(FILE_B) })
    const at = new Date(now - 60_000).toISOString()
    const holds = new Map<string, SweepHold>([
      ['a', { invoiceId: 'a', why: 'number_not_in_file', seenKey: seenKey(a), triedAt: at, tries: 1 }],
      ['c', { invoiceId: 'c', why: 'reading', seenKey: seenKey(c), triedAt: at, tries: 1 }],
    ])
    const plan = sweepPlan({ invoices: [a, b, c], paperInvoiceIds: new Set(), holds, nowMs: now })
    // b is due, so the file is read and a comes along to be matched again; c is another run's.
    expect(plan.files.map((f) => [f.fileId, f.rows.map((r) => r.id)])).toEqual([[FILE_A, ['a', 'b']]])
    expect(plan.status).toMatchObject({ held: { number_not_in_file: 1 }, heldTotal: 1, ready: 1, readyFiles: 1 })
  })

  it('says where the set stands in one line', () => {
    expect(statusWords({ bills: 539, noPdf: 19, read: 212, held: { statement: 14 }, heldTotal: 14, ready: 294, readyFiles: 250 })).toBe('Lines read on 212 of 539 bills · 14 held · 294 to read · 19 with no PDF')
    expect(statusWords({ bills: 1, noPdf: 0, read: 1, held: {}, heldTotal: 0, ready: 0, readyFiles: 0 })).toBe('Lines read on 1 of 1 bill')
  })
})

describe('the probe', () => {
  it('picks files spread from the newest bill to the oldest, each file once', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `1${String(i).repeat(24)}`)
    const invoices = ids.flatMap((id, i) => [inv({ id: `r${i}`, dateYmd: `2026-0${i + 1}-01`, link: linkOf(id) }), inv({ id: `r${i}b`, dateYmd: `2026-0${i + 1}-01`, link: linkOf(id) })])
    const picks = probePick(invoices, 3)
    expect(picks.map((p) => p.fileId)).toEqual([ids[8], ids[4], ids[0]])
    expect(probePick(invoices, 40)).toHaveLength(9)
    expect(probePick([inv({ id: 'x', link: null })], 5)).toEqual([])
  })

  it('says how many opened, with the door when some did not', () => {
    expect(probeWords(20, 20)).toBe('The app opened 20 of 20 linked files.')
    expect(probeWords(20, 17)).toBe('The app opened 17 of 20 linked files. Share the bills’ folder with the app so it can read the rest.')
    expect(probeWords(0, 0)).toBe('No bill links a file in Drive yet.')
  })
})

describe('what the model is asked for', () => {
  it('asks for every paper with its pages, each held to the bill reader’s own fields', () => {
    const item = PAPERS_SCHEMA.properties.papers.items
    expect(Object.keys(item.properties)).toEqual(expect.arrayContaining(['document_kind', 'number', 'lines', 'total', 'page_from', 'page_to']))
    expect(Object.keys(item.properties)).not.toContain('page_count')
    expect(item.required).toEqual(expect.arrayContaining(['lines', 'page_from', 'page_to']))
    expect(item.required).not.toContain('page_count')
    // Structured output needs every property required and no extras.
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort())
    expect(item.additionalProperties).toBe(false)
    expect(PAPERS_SCHEMA.required).toEqual(['papers', 'page_count'])
  })

  it('tells the model which pages of a longer file it holds', () => {
    expect(papersUserMessage('Made Up Supply')).not.toMatch(/pages \d/)
    expect(papersUserMessage('Made Up Supply', { from: 4, to: 6, of: 19 })).toContain('pages 4 to 6 of a file of 19 pages')
    expect(papersUserMessage('')).toContain('(unnamed)')
  })

  it('reads the answer into papers, with a range’s pages moved to the file’s', () => {
    const read = readPapersAnswer({ papers: [rawPaper({ page_from: 1, page_to: 2 }), rawPaper({ number: 'S100201', page_from: 3, page_to: 3 })], page_count: 3 }, 3)!
    expect(read.pageCount).toBe(3)
    expect(read.papers.map((p) => [p.read.number, p.pageFrom, p.pageTo])).toEqual([
      ['S100200', 4, 5],
      ['S100201', 6, 6],
    ])
    expect(read.papers[0]!.read.lines[0]).toMatchObject({ houseCode: '48370', unitPrice: 0.507, extendedCents: 6084, qtyShipped: 120 })
    expect(read.papers[0]!.read.totalCents).toBe(11260)
  })

  it('leaves out a paper it cannot place and refuses an answer that is not papers', () => {
    expect(readPapersAnswer({ papers: [rawPaper({ document_kind: 'receipt' }), rawPaper()], page_count: 2 })!.papers).toHaveLength(1)
    expect(readPapersAnswer({ lines: [] })).toBeNull()
    expect(readPapersAnswer(null)).toBeNull()
    expect(papersFromContent([{ type: 'text', text: 'not json' }])).toBeNull()
    expect(papersFromContent([{ type: 'thinking' }])).toBeNull()
    expect(papersFromContent([{ type: 'text', text: JSON.stringify({ papers: [rawPaper()], page_count: 1 }) }])!.papers).toHaveLength(1)
  })

  it('puts a page range’s end at its start when the model answers them backwards', () => {
    expect(readPapersAnswer({ papers: [rawPaper({ page_from: 2, page_to: 1 })], page_count: 2 })!.papers[0]).toMatchObject({ pageFrom: 2, pageTo: 2 })
  })
})

describe('pageRanges and joinPapers', () => {
  it('cuts a file into ranges of three pages', () => {
    expect(pageRanges(7)).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 6 },
      { from: 7, to: 7 },
    ])
    expect(pageRanges(3)).toEqual([{ from: 1, to: 3 }])
    expect(pageRanges(2, 1)).toEqual([
      { from: 1, to: 1 },
      { from: 2, to: 2 },
    ])
  })

  it('joins a paper that runs across two ranges: the lines follow on and the total is the later one’s', () => {
    const first = papersOf([rawPaper({ subtotal: '', tax: '', total: '', page_from: 1, page_to: 3 })])
    const second = papersOf([rawPaper({ lines: [rawLine({ house_code: '77001', extended: '10.00', quantity: '1', qty_shipped: '1', qty_ordered: '1', unit_price: '10.00' })], subtotal: '114.02', tax: '9.41', total: '123.43', po_text: '', page_from: 1, page_to: 1 })], 3)
    const joined = joinPapers([first, second])
    expect(joined).toHaveLength(1)
    expect(joined[0]!.read.lines.map((l) => l.houseCode)).toEqual(['48370', '30614', '77001'])
    expect(joined[0]!.read).toMatchObject({ number: 'S100200', totalCents: 12343, subtotalCents: 11402, poText: 'J123' })
    expect([joined[0]!.pageFrom, joined[0]!.pageTo]).toEqual([1, 4])
  })

  it('joins a continued page that prints no number only when the paper before printed no total', () => {
    const open = papersOf([rawPaper({ subtotal: '', tax: '', total: '' })])
    const closed = papersOf([rawPaper()])
    const noNumber = papersOf([rawPaper({ number: '', document_kind: 'other', lines: [rawLine()], page_from: 1, page_to: 1 })], 3)
    expect(joinPapers([open, noNumber])).toHaveLength(1)
    expect(joinPapers([open, noNumber])[0]!.read.kind).toBe('invoice')
    expect(joinPapers([closed, noNumber])).toHaveLength(2)
  })

  it('keeps a stack of one-page bills apart, and a ship ticket apart from the invoice with its number', () => {
    const a = papersOf([rawPaper({ number: 'S1' }), rawPaper({ number: 'S2' }), rawPaper({ number: 'S3' })])
    const b = papersOf([rawPaper({ number: 'S4' }), rawPaper({ number: 'S5' })], 3)
    expect(joinPapers([a, b]).map((p) => p.read.number)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    const ticket = papersOf([rawPaper({ document_kind: 'ship_ticket' })], 3)
    expect(joinPapers([papersOf([rawPaper()]), ticket])).toHaveLength(2)
  })
})

describe('matchRows', () => {
  it('gives each row its paper by the number, folded, and leaves the rest with no bill', () => {
    const papers = papersOf([rawPaper({ number: 'S-100200' }), rawPaper({ number: 'S100201' }), rawPaper({ number: 'S100202', document_kind: 'ship_ticket' })])
    const rows = [inv({ id: 'b', number: 's100201' }), inv({ id: 'a', number: 'S100200' })]
    const m = matchRows(papers, rows)
    expect(m.outcomes).toEqual([
      { invoice: rows[0], paperIndex: 1 },
      { invoice: rows[1], paperIndex: 0 },
    ])
    expect(m.unowned).toEqual([2])
  })

  it('picks the copy whose total is the row’s amount when a number is in the file twice', () => {
    const papers = papersOf([rawPaper({ total: '100.00' }), rawPaper()])
    expect(matchRows(papers, [inv({ id: 'a' })]).outcomes[0]).toMatchObject({ paperIndex: 1 })
    expect(matchRows(papers, [inv({ id: 'a', amountCents: -11260, kind: 'credit' })]).outcomes[0]).toMatchObject({ paperIndex: 1 })
  })

  it('holds a row whose number is not in its file, naming the numbers the file holds', () => {
    const m = matchRows(papersOf([rawPaper({ number: 'S777' })]), [inv({ id: 'a' })])
    expect(m.outcomes[0]).toEqual({ invoice: inv({ id: 'a' }), hold: 'number_not_in_file', note: 'The file holds S777.' })
    expect(m.unowned).toEqual([0])
    expect(matchRows([], [inv({ id: 'a' })]).outcomes[0]).toMatchObject({ hold: 'number_not_in_file', note: 'No paper was read in the file.' })
    expect(matchRows(papersOf([rawPaper({ number: 'Q1', document_kind: 'quote' })]), [inv({ id: 'a' })]).outcomes[0]).toMatchObject({ hold: 'number_not_in_file', note: 'The file holds a quote and no invoice.' })
  })

  it('gives a row the paper that prints its number with a short suffix, when the total is the row’s amount', () => {
    const papers = papersOf([rawPaper({ number: 'S100200.001' }), rawPaper({ number: '387374 01', total: '48.10' })])
    const rows = [inv({ id: 'a' }), inv({ id: 'b', number: '387374', amountCents: 4810 })]
    expect(matchRows(papers, rows)).toEqual({ outcomes: [{ invoice: rows[0], paperIndex: 0 }, { invoice: rows[1], paperIndex: 1 }], unowned: [] })
  })

  it('leaves the suffixed paper alone when its total is not the row’s amount', () => {
    const m = matchRows(papersOf([rawPaper({ number: 'S100200.001', total: '90.00' })]), [inv({ id: 'a' })])
    expect(m.outcomes[0]).toMatchObject({ hold: 'number_not_in_file', note: 'The file holds S100200.001.' })
    expect(m.unowned).toEqual([0])
  })

  it('lets the row that names a paper outright take it before a shorter number does', () => {
    const papers = papersOf([rawPaper({ number: 'S100200.001' })])
    const rows = [inv({ id: 'short', number: 'S100200' }), inv({ id: 'exact', number: 'S100200.001' })]
    expect(matchRows(papers, rows).outcomes.map((o) => ('hold' in o ? o.hold : 'paper'))).toEqual(['number_not_in_file', 'paper'])
  })

  it('takes a suffix of one to three digits and nothing else', () => {
    expect(numberWithSuffix('387374', '387374 01')).toBe(true)
    expect(numberWithSuffix('s100200', 'S100200.001')).toBe(true)
    expect(numberWithSuffix('S100200', 'S100200-7')).toBe(true)
    expect(numberWithSuffix('S100200', 'S100200.0001')).toBe(false)
    expect(numberWithSuffix('S100200', 'S100200A')).toBe(false)
    expect(numberWithSuffix('S100200', 'S100200')).toBe(false)
    expect(numberWithSuffix('S100200.001', 'S100200.002')).toBe(false)
    expect(numberWithSuffix('100200', 'S100200.001')).toBe(false)
    expect(numberWithSuffix('', '001')).toBe(false)
  })

  it('never matches a row with no number', () => {
    expect(matchRows(papersOf([rawPaper({ number: '' })]), [inv({ id: 'a', number: '' })]).outcomes[0]).toMatchObject({ hold: 'number_not_in_file' })
  })

  it('holds a row a statement lists as a statement, and one on a ship ticket as not a bill', () => {
    const statement = papersOf([rawPaper({ document_kind: 'statement', number: 'ST-9', lines: [], statement_numbers: ['S100200', 'S100201'] })])
    expect(matchRows(statement, [inv({ id: 'a' }), inv({ id: 'b', number: 'S100201' })]).outcomes.map((o) => ('hold' in o ? o.hold : 'paper'))).toEqual(['statement', 'statement'])
    const ticket = papersOf([rawPaper({ document_kind: 'ship_ticket' })])
    expect(matchRows(ticket, [inv({ id: 'a' })]).outcomes[0]).toMatchObject({ hold: 'not_a_bill', note: 'The paper with this number is a ship ticket, not an invoice.' })
  })

  it('gives the second of two rows with one number nothing to take', () => {
    const m = matchRows(papersOf([rawPaper()]), [inv({ id: 'a' }), inv({ id: 'b' })])
    expect(m.outcomes.map((o) => ('hold' in o ? o.hold : 'paper'))).toEqual(['paper', 'number_not_in_file'])
  })
})

describe('paperRowOf', () => {
  const base = { houseId: 'house-1', fileId: FILE_A, model: 'claude-sonnet-5-5', readId: 'read-1', readAt: '2026-11-10T12:00:00.000Z' }
  const text = { text: 'PRODUCT 48370 PVC PIPE 2X20 30614 2 DWV 90', layer: true }

  it('writes a bill’s paper that adds up against the row and the PDF’s text', () => {
    const row = paperRowOf({ ...base, paper: papersOf([rawPaper()])[0]!, invoice: inv({ id: 'a' }), text })
    expect(row.check.state).toBe('adds_up')
    expect(row.paper).toMatchObject({
      supply_house_id: 'house-1',
      invoice_id: 'a',
      kind: 'invoice',
      number: 'S100200',
      dated_on: '2026-10-01',
      drive_file_id: FILE_A,
      page_from: 1,
      page_to: 1,
      subtotal_cents: 10402,
      total_cents: 11260,
      read_by: 'sweep:claude-sonnet-5-5',
      read_id: 'read-1',
      check_state: 'adds_up',
      check_note: '',
      text_layer: true,
    })
    expect(row.lines).toHaveLength(2)
    expect(row.lines[0]).toMatchObject({ line_no: 1, line_kind: 'part', house_code: '48370', qty_shipped: 120, unit_price: 0.507, pricing_unit: 'each', extended_cents: 6084 })
  })

  it('turns the paper off with the gap in words when the total is not the row’s amount', () => {
    const row = paperRowOf({ ...base, paper: papersOf([rawPaper()])[0]!, invoice: inv({ id: 'a', amountCents: 12000 }), text })
    expect(row.paper).toMatchObject({ check_state: 'off', check_note: "The printed total is $7.40 short of the amount on the bill's row" })
  })

  it('turns the paper off when a part code is not in the PDF’s text, and lets a scan through unchecked', () => {
    const paper = papersOf([rawPaper()])[0]!
    const misread = paperRowOf({ ...base, paper, invoice: inv({ id: 'a' }), text: { text: 'PRODUCT 48870 PVC PIPE 30614', layer: true } })
    expect(misread.paper.check_state).toBe('off')
    expect(String(misread.paper.check_note)).toContain('48370')
    const scan = paperRowOf({ ...base, paper, invoice: inv({ id: 'a' }), text: { text: null, layer: false } })
    expect(scan.paper).toMatchObject({ check_state: 'adds_up', text_layer: false })
  })

  it('takes the row’s kind for a bill, so a credit the reader called an invoice still counts negative', () => {
    const row = paperRowOf({ ...base, paper: papersOf([rawPaper()])[0]!, invoice: inv({ id: 'a', kind: 'credit', amountCents: -11260 }), text })
    expect(row.paper).toMatchObject({ kind: 'credit', check_state: 'adds_up' })
  })

  it('keeps a paper with no bill under the kind the reader gave it, the house of the file’s rows and no row to hold it to', () => {
    const row = paperRowOf({ ...base, paper: papersOf([rawPaper({ document_kind: 'ship_ticket', number: 'T55' })])[0]!, invoice: null, text })
    expect(row.paper).toMatchObject({ invoice_id: null, kind: 'ship_ticket', number: 'T55', supply_house_id: 'house-1', check_state: 'adds_up' })
  })

  it('falls back to the row’s number and date when the paper prints neither', () => {
    const row = paperRowOf({ ...base, paper: papersOf([rawPaper({ number: '', date: '' })])[0]!, invoice: inv({ id: 'a' }), text })
    expect(row.paper).toMatchObject({ number: 'S100200', dated_on: '2026-10-01' })
  })
})

describe('the words', () => {
  it('has words and a door for every reason', () => {
    for (const why of HOLD_WHYS) {
      expect(HOLD_WORDS[why].words).toMatch(/\.$/)
      expect(HOLD_WORDS[why].door).toMatch(/\.$/)
    }
  })

  it('reads the switch as on only at true', () => {
    expect(billSweepIsOn('true')).toBe(true)
    expect(billSweepIsOn('false')).toBe(false)
    expect(billSweepIsOn(null)).toBe(false)
  })

  it('says what a run did and where the set stands', () => {
    const status = { bills: 539, noPdf: 19, read: 216, held: { statement: 1 }, heldTotal: 1, ready: 303, readyFiles: 280 }
    expect(sweepWords({ ...EMPTY_SWEEP_RUN, files: 3, kept: 4, addUp: 3, held: 1, unowned: 2, reads: 3, cents: 4.2 }, status)).toBe(
      'Read 3 files: 4 bills’ lines kept (3 add up), 1 held, 2 papers with no bill, $0.04. Lines read on 216 of 539 bills · 1 held · 303 to read · 19 with no PDF',
    )
    expect(sweepWords(EMPTY_SWEEP_RUN, status)).toMatch(/^Nothing to read\. /)
    expect(sweepWords({ ...EMPTY_SWEEP_RUN, capped: true }, status)).toContain(`its ${BILL_SWEEP_DAILY_CAP} reads for the day`)
  })
})

// PR 1c (v2.7103): a paper held off under older rules is checked again from the lines on file.
describe('one more check under new rules', () => {
  const stored = (over: Partial<StoredLineRow> & { line_no: number }): StoredLineRow => ({ line_kind: 'part', house_code: '', mfr_number: '', description: '', unit: 'EA', qty_ordered: null, qty_shipped: null, qty_backordered: null, unit_price: null, pricing_unit: 'each', extended_cents: null, ...over })

  it('reads a row back as a line, a numeric as a string or a number', () => {
    expect(lineOfStoredRow(stored({ line_no: 3, line_kind: 'charge', house_code: null, description: 'SHIPPING', qty_shipped: '2.000', unit_price: '3.1270', extended_cents: 625 }))).toEqual({
      lineNo: 3,
      lineKind: 'charge',
      houseCode: '',
      mfrNumber: '',
      description: 'SHIPPING',
      unit: 'EA',
      qtyOrdered: null,
      qtyShipped: 2,
      qtyBackordered: null,
      unitPrice: 3.127,
      pricingUnit: 'each',
      extendedCents: 625,
    })
  })

  it('stamps the paper a first read writes with the rules it was checked under', () => {
    const row = paperRowOf({ houseId: 'house-1', fileId: FILE_A, model: 'claude-sonnet-5-5', readId: null, readAt: '2026-11-13T12:00:00.000Z', paper: papersOf([rawPaper()])[0]!, invoice: inv({ id: 'a' }), text: { text: null, layer: null } })
    expect(row.paper.check_rules).toBe(2)
  })

  it('turns a paper green that only a rounded price held off, and writes no line', () => {
    const lines = [stored({ line_no: 1, house_code: '48370', unit: 'FT', qty_shipped: 200, unit_price: 3.127, extended_cents: 62547 })].map(lineOfStoredRow)
    const again = recheckStored({ paper: { kind: 'invoice', lines, subtotalCents: 62547, taxCents: 5160, freightCents: null, totalCents: 67707 }, rowAmountCents: 67707 })
    expect(again.paper).toEqual({ check_state: 'adds_up', check_note: '', check_rules: 2 })
    expect(again.lineFixes).toEqual([])
  })

  it('writes the line the subtotal turned, by its number, before the paper counts', () => {
    const lines = [stored({ line_no: 1, description: '20V DRILL KIT', qty_shipped: 1, unit_price: 219, extended_cents: 21900 }), stored({ line_no: 2, description: 'TOOL INSTANT REBATE $30', qty_shipped: 1, unit_price: 30, extended_cents: 3000 })].map(lineOfStoredRow)
    const again = recheckStored({ paper: { kind: 'invoice', lines, subtotalCents: 18900, taxCents: 0, freightCents: null, totalCents: 18900 }, rowAmountCents: 18900 })
    expect(again.paper.check_state).toBe('adds_up')
    expect(again.lineFixes).toEqual([{ line_no: 2, qty_shipped: 1, unit_price: 30, extended_cents: -3000 }])
  })

  it('writes a line ordered and not shipped as 0 shipped, and a price that was not read as empty', () => {
    const lines = [
      stored({ line_no: 1, qty_ordered: 2, qty_shipped: 2, unit_price: 14.5, extended_cents: 2900 }),
      stored({ line_no: 2, qty_ordered: 3, unit_price: 88.4012, extended_cents: 0 }),
      stored({ line_no: 3, qty_shipped: 4, unit_price: 0, extended_cents: 24400 }),
    ].map(lineOfStoredRow)
    const again = recheckStored({ paper: { kind: 'invoice', lines, subtotalCents: 27300, taxCents: 0, freightCents: null, totalCents: 27300 }, rowAmountCents: 27300 })
    expect(again.paper.check_state).toBe('adds_up')
    expect(again.lineFixes).toEqual([
      { line_no: 2, qty_shipped: 0, unit_price: 88.4012, extended_cents: 0 },
      { line_no: 3, qty_shipped: 4, unit_price: null, extended_cents: 24400 },
    ])
  })

  it('leaves a paper off that the new rules do not explain, with its note, and stamps it all the same', () => {
    const lines = [stored({ line_no: 1, qty_shipped: 2, unit_price: 14.5, extended_cents: 2900 })].map(lineOfStoredRow)
    const again = recheckStored({ paper: { kind: 'invoice', lines, subtotalCents: 2900, taxCents: 0, freightCents: null, totalCents: 2900 }, rowAmountCents: 5900 })
    expect(again.paper).toEqual({ check_state: 'off', check_note: "The printed total is $30.00 short of the amount on the bill's row", check_rules: 2 })
  })

  it('holds the part codes to the PDF\'s text when the caller has it', () => {
    const lines = [stored({ line_no: 1, house_code: '48370', unit: 'FT', qty_shipped: 200, unit_price: 3.127, extended_cents: 62547 })].map(lineOfStoredRow)
    const paper = { kind: 'invoice' as const, lines, subtotalCents: 62547, taxCents: 0, freightCents: null, totalCents: 62547 }
    expect(recheckStored({ paper, rowAmountCents: 62547, text: 'PRODUCT 48370 PEX 1X100 COIL' }).paper.check_state).toBe('adds_up')
    expect(recheckStored({ paper, rowAmountCents: 62547, text: 'PRODUCT 48870 PEX 1X100 COIL' }).paper.check_state).toBe('off')
  })

  it('says the recheck in one line, and nothing when none was due', () => {
    expect(recheckWords(6, 4)).toBe('Checked 6 bills again under the new rules: 4 now add up.')
    expect(recheckWords(1, 1)).toBe('Checked 1 bill again under the new rules: 1 now adds up.')
    expect(recheckWords(0, 0)).toBe('')
  })
})

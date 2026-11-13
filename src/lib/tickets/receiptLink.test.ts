import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { orderSortModeDayJobIds } from '../tally/sortModeDayJobsOrder'
import {
  RECEIPT_DAY_JOBS_MAX,
  RECEIPT_LINK_ALPHABET,
  RECEIPT_LINK_CAPS,
  RECEIPT_LINK_WORDS,
  RECEIPT_PAGE_WORDS,
  buildReceiptCharge,
  mintReceiptLinkCode,
  receiptCardWords,
  receiptChargeDead,
  receiptChargeWords,
  receiptClosesWords,
  receiptCopiedWords,
  receiptJobLine,
  receiptLinkCode,
  receiptLinkExpired,
  receiptLinkExpiry,
  receiptLinkUrl,
  receiptNextPageNo,
  receiptOnChargeWords,
  receiptSniff,
  receiptTicketJob,
  receiptWhenWords,
  type ReceiptChargeFacts,
} from './receiptLink'

// Every name and number here is made up.
const labels = new Map([
  ['job-a', 'JP1042 · Oak Hollow Bldg C'],
  ['job-b', 'JP1038 · Cedar Bend water heater'],
])

const facts = (more: Partial<ReceiptChargeFacts> = {}): ReceiptChargeFacts => ({
  requestId: 'req-1',
  amount: -228.58,
  counterpartyName: 'Ridgeway Supply',
  swipeAt: '2026-11-04T16:02:00Z',
  postedAt: '2026-11-05T08:10:00Z',
  status: 'sent',
  holderName: 'Jordan Vance',
  requestClosedAt: null,
  sortedJobIds: [],
  ticket: null,
  dayJobIds: ['job-a', 'job-b'],
  jobLabels: labels,
  ...more,
})

const ticket = (more: Partial<NonNullable<ReceiptChargeFacts['ticket']>> = {}): NonNullable<ReceiptChargeFacts['ticket']> => ({
  id: 't1',
  source: 'link',
  taken_at: '2026-11-05T00:14:00Z',
  job_id: null,
  no_one_job: false,
  used_at: null,
  pages: [{ id: 'p1', page_no: 1, mime: 'image/jpeg' }],
  ...more,
})

describe('the link’s code', () => {
  it('reads ten letters of the alphabet, lower-cased, and nothing else', () => {
    expect(receiptLinkCode('  K7M2P9XQ4D ')).toBe('k7m2p9xq4d')
    expect(receiptLinkCode('k7m2p9xq4')).toBeNull()
    expect(receiptLinkCode('k7m2p9xq4do')).toBeNull()
    // No 0, 1, l, o or i: a code read over the phone has no look-alikes.
    expect(receiptLinkCode('k7m2p9xq40')).toBeNull()
    expect(receiptLinkCode('k7m2p9xq4l')).toBeNull()
    expect(receiptLinkCode(null)).toBeNull()
  })

  it('mints ten letters and throws a byte at or past 248 away, so no letter is likelier', () => {
    let call = 0
    const code = mintReceiptLinkCode((n) => {
      call += 1
      // The first batch is all 255: nothing usable. The second counts up from 0.
      return call === 1 ? new Uint8Array(n).fill(255) : Uint8Array.from({ length: n }, (_, i) => i)
    })
    expect(code).toBe(RECEIPT_LINK_ALPHABET.slice(0, 10))
    expect(receiptLinkCode(code)).toBe(code)
    expect(() => mintReceiptLinkCode((n) => new Uint8Array(n).fill(250))).toThrow(/no usable bytes/)
  })

  it('opens for fourteen days, and reads closed on the day it ends', () => {
    const made = '2026-11-04T18:00:00.000Z'
    const ends = receiptLinkExpiry(made)
    expect(ends).toBe('2026-11-18T18:00:00.000Z')
    expect(RECEIPT_LINK_CAPS.days).toBe(14)
    expect(receiptLinkExpired({ expires_at: ends }, '2026-11-18T17:59:59Z')).toBe(false)
    expect(receiptLinkExpired({ expires_at: ends }, ends)).toBe(true)
    // A day that does not read is closed, never open.
    expect(receiptLinkExpired({ expires_at: 'soon' }, made)).toBe(true)
  })

  it('is the app’s own address until the short host forwards /r/', () => {
    expect(receiptLinkUrl('K7M2P9XQ4D')).toBe('https://clicktooling.com/r/k7m2p9xq4d')
    expect(receiptLinkUrl('k7m2p9xq4d', 'http://127.0.0.1:5199/')).toBe('http://127.0.0.1:5199/r/k7m2p9xq4d')
  })
})

describe('what a link may take', () => {
  const head = (...bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)])
  const text = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(new Array(16).fill(0)))

  it('names a page by its first bytes, whatever the phone called it', () => {
    expect(receiptSniff(head(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(receiptSniff(head(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
    expect(receiptSniff(text('RIFF\u0000\u0000\u0000\u0000WEBP'))).toBe('image/webp')
    expect(receiptSniff(text('%PDF-1.7'))).toBe('application/pdf')
  })

  it('refuses anything else: a page of markup, a script, a video, a file too short to read', () => {
    expect(receiptSniff(text('<html><script>'))).toBeNull()
    expect(receiptSniff(text('\u0000\u0000\u0000\u0018ftypmp42'))).toBeNull()
    expect(receiptSniff(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull()
  })

  it('reads a failed, cancelled or reversed charge as nothing to photograph', () => {
    for (const s of ['failed', 'Cancelled', 'canceled', 'reversed']) expect(receiptChargeDead(s), s).toBe(true)
    for (const s of ['sent', 'pending', null, undefined]) expect(receiptChargeDead(s), String(s)).toBe(false)
  })

  it('numbers a new page one past the highest', () => {
    expect(receiptNextPageNo([])).toBe(1)
    expect(receiptNextPageNo([{ page_no: 1 }, { page_no: 3 }])).toBe(4)
  })
})

describe('what the page is told about a charge', () => {
  it('a first visit: the store, the amount, the swipe, whose card by first name, and the day’s jobs', () => {
    const c = buildReceiptCharge(facts())
    expect(c).toMatchObject({ id: 'req-1', store: 'Ridgeway Supply', amount: 228.58, moneyBack: false, when: '2026-11-04T16:02:00Z', cardOf: 'Jordan', dead: false, sortedJob: null, ticket: null })
    expect(c.dayJobs).toEqual([
      { id: 'job-a', label: 'JP1042 · Oak Hollow Bldg C' },
      { id: 'job-b', label: 'JP1038 · Cedar Bend water heater' },
    ])
    // The last name never leaves the server, and neither does the bank's id.
    expect(JSON.stringify(c)).not.toContain('Vance')
  })

  it('a charge the office sorted already asks no job', () => {
    const c = buildReceiptCharge(facts({ sortedJobIds: ['job-b'] }))
    expect(c.sortedJob).toBe('JP1038 · Cedar Bend water heater')
    expect(c.dayJobs).toEqual([])
    expect(receiptJobLine(c)).toEqual({ words: 'JP1038 · Cedar Bend water heater', quiet: false })
  })

  it('a ticket made through the link keeps the chips until the office uses it', () => {
    const open = buildReceiptCharge(facts({ ticket: ticket({ job_id: 'job-a' }) }))
    expect(open.ticket).toMatchObject({ door: 'link', job: 'JP1042 · Oak Hollow Bldg C', canChangeJob: true, canAddPage: true, pages: [{ id: 'p1', pdf: false }] })
    expect(open.dayJobs).toHaveLength(2)
    const used = buildReceiptCharge(facts({ ticket: ticket({ job_id: 'job-a', used_at: '2026-11-05T15:00:00Z' }) }))
    expect(used.ticket?.canChangeJob).toBe(false)
    expect(used.dayJobs).toEqual([])
  })

  it('a ticket taken in Tally takes a page and offers no job change', () => {
    const c = buildReceiptCharge(facts({ ticket: ticket({ source: 'camera', job_id: 'job-a' }) }))
    expect(c.ticket).toMatchObject({ door: 'tally', canChangeJob: false, canAddPage: true })
    expect(c.dayJobs).toEqual([])
    expect(buildReceiptCharge(facts({ ticket: ticket({ source: 'office' }) })).ticket?.door).toBe('office')
  })

  it('a full ticket takes no more pages, and its pages come in order', () => {
    const pages = Array.from({ length: RECEIPT_LINK_CAPS.pages }, (_, i) => ({ id: `p${i}`, page_no: RECEIPT_LINK_CAPS.pages - i, mime: i === 0 ? 'application/pdf' : 'image/jpeg' }))
    const c = buildReceiptCharge(facts({ ticket: ticket({ pages }) }))
    expect(c.ticket?.canAddPage).toBe(false)
    expect(c.ticket?.pages[0]).toEqual({ id: `p${RECEIPT_LINK_CAPS.pages - 1}`, pdf: false })
    expect(c.ticket?.pages[RECEIPT_LINK_CAPS.pages - 1]).toEqual({ id: 'p0', pdf: true })
  })

  it('a charge the bank took back is dead, with no chips and no page', () => {
    const failed = buildReceiptCharge(facts({ status: 'failed', ticket: ticket() }))
    expect(failed).toMatchObject({ dead: true, dayJobs: [] })
    expect(failed.ticket).toMatchObject({ canAddPage: false, canChangeJob: false })
    expect(buildReceiptCharge(facts({ requestClosedAt: '2026-11-06T00:00:00Z' })).dead).toBe(true)
  })

  it('money back, a card tied to no one, a store with no name, and a long day', () => {
    const back = buildReceiptCharge(facts({ amount: 41.17, counterpartyName: 'Cedar Bend Hardware' }))
    expect(back).toMatchObject({ amount: 41.17, moneyBack: true })
    expect(receiptChargeWords(back)).toBe('$41.17 back from Cedar Bend Hardware')
    const loose = buildReceiptCharge(facts({ holderName: '', counterpartyName: '  ', swipeAt: null }))
    expect(loose).toMatchObject({ cardOf: '', store: 'A store', when: '2026-11-05T08:10:00Z' })
    const many = Array.from({ length: 9 }, (_, i) => `j${i}`)
    const long = buildReceiptCharge(facts({ dayJobIds: many, jobLabels: new Map(many.map((id) => [id, `JP${id}`])) }))
    expect(long.dayJobs).toHaveLength(RECEIPT_DAY_JOBS_MAX)
    // A job with no label (deleted since) is never offered.
    expect(buildReceiptCharge(facts({ dayJobIds: ['gone', 'job-a'] })).dayJobs.map((j) => j.id)).toEqual(['job-a'])
  })
})

describe('the job a ticket made through a link carries', () => {
  const day = ['job-a', 'job-b']
  it('the office’s sort wins, and the page’s pick is ignored', () => {
    expect(receiptTicketJob({ sortedJobIds: ['job-b', 'job-a'], dayJobIds: day, pick: { jobId: 'job-a' } })).toEqual({ job_id: 'job-b', no_one_job: false })
  })
  it('a chip tapped is taken when it is one of the day’s jobs', () => {
    expect(receiptTicketJob({ sortedJobIds: [], dayJobIds: day, pick: { jobId: 'job-a' } })).toEqual({ job_id: 'job-a', no_one_job: false })
    expect(receiptTicketJob({ sortedJobIds: [], dayJobIds: day, pick: { noOneJob: true } })).toEqual({ job_id: null, no_one_job: true })
  })
  it('a job id from anywhere else is dropped: the link is no door to another job', () => {
    expect(receiptTicketJob({ sortedJobIds: [], dayJobIds: day, pick: { jobId: 'job-z' } })).toEqual({ job_id: null, no_one_job: false })
    expect(receiptTicketJob({ sortedJobIds: [], dayJobIds: day, pick: null })).toEqual({ job_id: null, no_one_job: false })
  })
})

describe('the words', () => {
  it('say the charge, the time on the company’s clock, and whose card', () => {
    const c = buildReceiptCharge(facts())
    expect(receiptChargeWords(c)).toBe('$228.58 at Ridgeway Supply')
    expect(receiptWhenWords('2026-11-04T16:02:00Z')).toBe('Wed, Nov 4, 10:02 AM')
    expect(receiptWhenWords('never')).toBe('')
    expect(receiptCardWords('Jordan')).toBe('Jordan’s card')
    expect(receiptCardWords('Chris')).toBe('Chris’ card')
    expect(receiptCardWords('')).toBe('A company card')
    expect(receiptJobLine(c)).toEqual({ words: 'not sorted yet', quiet: true })
    expect(receiptJobLine(buildReceiptCharge(facts({ ticket: ticket({ no_one_job: true }) })))).toEqual({ words: 'Not for one job', quiet: false })
  })

  it('say Got it for a photo through the link, and where a ticket came from otherwise', () => {
    expect(receiptOnChargeWords(buildReceiptCharge(facts({ ticket: ticket() })))).toEqual({ headline: 'Got it. The receipt is on $228.58 at Ridgeway Supply.', line: null })
    const tally = receiptOnChargeWords(buildReceiptCharge(facts({ ticket: ticket({ source: 'camera', taken_at: '2026-11-04T16:02:00Z', job_id: 'job-a' }) })))
    expect(tally).toEqual({ headline: 'This charge has its ticket already.', line: 'It was taken in Tally at 10:02 AM, for JP1042 · Oak Hollow Bldg C.' })
    expect(receiptOnChargeWords(buildReceiptCharge(facts({ ticket: ticket({ source: 'office', taken_at: '2026-11-04T16:02:00Z' }) }))).line).toBe('The office scanned it at 10:02 AM.')
    expect(receiptOnChargeWords(buildReceiptCharge(facts()))).toEqual({ headline: '', line: null })
  })

  it('say when the link closes, and what the office’s copy did', () => {
    expect(receiptClosesWords('2026-11-18')).toBe('This link opens until Nov 18.')
    expect(receiptClosesWords(null)).toBe('')
    expect(receiptCopiedWords('$228.58 at Ridgeway Supply', '2026-11-18')).toBe('Receipt link copied for $228.58 at Ridgeway Supply. It opens until Nov 18.')
    expect(receiptCopiedWords('$228.58 at Ridgeway Supply', null)).toBe('Receipt link copied for $228.58 at Ridgeway Supply. It opens for 14 days.')
  })

  it('follow the plain-words rules, every line a first-timer reads', () => {
    const lines = [
      ...Object.values(RECEIPT_PAGE_WORDS).filter((w) => w !== RECEIPT_PAGE_WORDS.eyebrow && w !== RECEIPT_PAGE_WORDS.addPage),
      ...Object.values(RECEIPT_LINK_WORDS),
      receiptOnChargeWords(buildReceiptCharge(facts({ ticket: ticket() }))).headline,
      receiptClosesWords('2026-11-18'),
      receiptCopiedWords('$228.58 at Ridgeway Supply', '2026-11-18'),
    ]
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })
})

describe('the day’s jobs, one rule for Sort mode and the link', () => {
  it('the swipe day’s clocked jobs lead, then its schedule, then the shoulders', () => {
    expect(
      orderSortModeDayJobIds({
        anchorYmd: '2026-11-04',
        beforeYmd: '2026-11-03',
        afterYmd: '2026-11-05',
        sessions: [
          { work_date: '2026-11-03', job_ledger_id: 'before' },
          { work_date: '2026-11-04', job_ledger_id: 'clocked' },
        ],
        scheduledByDay: new Map([['2026-11-04', ['clocked', 'scheduled']]]),
      }),
    ).toEqual(['clocked', 'scheduled', 'before'])
  })
})

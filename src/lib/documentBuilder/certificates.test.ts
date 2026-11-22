import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { certificateBackEmail, certificateCheck, certificateChip, certificateCounts, certificatePress, certificateStanding, type CertRow } from './certificates'
import { sheetAsks, type ResolvedSheet } from './sheet'

const CO = 'co-1'
const JOB = 'job-1'
const TODAY = '2026-11-21'

/** A made-up published sheet. Every name and amount is invented. */
const sheet = (over: Partial<ResolvedSheet> = {}): ResolvedSheet =>
  ({ insured: ['Pecan Ridge Holdings'], place: '410 Sample Street', hName: 'Acme Plumbing', cover: [{ label: 'General liability', limit: 'a made-up amount' }], foot: 'A made-up foot line.', ...over }) as ResolvedSheet
const ASKS = sheetAsks(sheet())

const row = (over: Partial<CertRow> = {}): CertRow => ({
  id: 'c1',
  companyId: CO,
  status: 'received',
  expiresOn: '2027-03-03',
  sentAt: '2026-11-18T15:00:00Z',
  sentOn: '2026-11-18',
  createdAt: '2026-11-18T15:00:00Z',
  url: 'https://example.test/c1.pdf',
  sheetProjectId: null,
  sheetRevision: null,
  sheetAsks: null,
  checkedAt: null,
  sentBackAt: null,
  sentBackOn: null,
  missing: null,
  ...over,
})
const good = (over: Partial<CertRow> = {}): CertRow => row({ status: 'signed', sheetProjectId: JOB, sheetRevision: 1, sheetAsks: ASKS, checkedAt: '2026-11-19T15:00:00Z', ...over })
const stand = (rows: CertRow[], asks = ASKS, today = TODAY) => certificateStanding(rows, CO, JOB, asks, today)

describe('where a trade\'s certificate stands for a job', () => {
  it('has none when the company sent nothing', () => {
    expect(stand([])).toEqual({ kind: 'none' })
    expect(certificateChip(stand([])).words).toBe('No certificate yet')
  })

  it('came in, when one waits for a look with no job on it', () => {
    const s = stand([row()])
    expect(s.kind).toBe('came')
    expect(certificateChip(s)).toEqual({ tone: 'warn', words: 'Certificate came in Nov 18' })
    expect(certificatePress(s)?.label).toBe('Check it against the sheet')
  })

  it('is good until its day once marked good for this job', () => {
    const s = stand([good()])
    expect(s).toMatchObject({ kind: 'good', goodUntil: '2027-03-03' })
    expect(certificateChip(s)).toEqual({ tone: 'ok', words: 'Certificate good to Mar 3' })
    expect(certificatePress(s)).toBeNull()
  })

  it('stays good after a change to the foot line, and is outdated after a change to an amount', () => {
    // The card's own line to verify.
    expect(stand([good()], sheetAsks(sheet({ foot: 'Another made-up foot line.' }))).kind).toBe('good')
    const s = stand([good()], sheetAsks(sheet({ cover: [{ label: 'General liability', limit: 'a larger made-up amount' }] })))
    expect(s.kind).toBe('outdated')
    expect(certificateChip(s).words).toBe('The sheet changed since their certificate')
    expect(certificatePress(s)?.label).toBe('Check it again')
  })

  it('is outdated after a changed name or place, and after a line is added', () => {
    expect(stand([good()], sheetAsks(sheet({ insured: ['Pecan Ridge Holdings LLC'] }))).kind).toBe('outdated')
    expect(stand([good()], sheetAsks(sheet({ place: '88 Mesa Road' }))).kind).toBe('outdated')
    expect(stand([good()], sheetAsks(sheet({ cover: [...sheet().cover, { label: 'Umbrella', limit: 'a made-up amount' }] }))).kind).toBe('outdated')
  })

  it('ran out once its last day has come', () => {
    const s = stand([good({ expiresOn: '2026-11-21' })])
    expect(s).toMatchObject({ kind: 'ranOut', on: '2026-11-21' })
    expect(certificateChip(s).words).toBe('Their certificate ran out Nov 21')
    expect(stand([good({ expiresOn: '2026-11-22' })]).kind).toBe('good')
  })

  it('was sent back, naming what was missing, until they send a new file', () => {
    const back = row({ sheetProjectId: JOB, sentBackAt: '2026-11-20T15:00:00Z', sentBackOn: '2026-11-20', missing: ['A line.', 'Another line.'] })
    const s = stand([back])
    expect(s).toMatchObject({ kind: 'sentBack', missing: 2 })
    expect(certificateChip(s)).toEqual({ tone: 'wait', words: 'Sent back Nov 20, 2 things missing' })
    expect(certificatePress(s)).toBeNull()
    expect(certificateChip(stand([{ ...back, missing: ['A line.'] }])).words).toBe('Sent back Nov 20, 1 thing missing')
    // The company sends a new file over it: it came in again.
    const again = stand([{ ...back, sentAt: '2026-11-21T09:00:00Z', sentOn: '2026-11-21' }])
    expect(again.kind).toBe('came')
    expect(certificateChip(again).words).toBe('Certificate came in Nov 21')
  })

  it('reads a good one sent back later as sent back, and one marked good later as good', () => {
    const sentBackLater = good({ sentBackAt: '2026-11-20T15:00:00Z', sentBackOn: '2026-11-20', missing: ['A line.'] })
    expect(stand([sentBackLater]).kind).toBe('sentBack')
    // Mark it good clears the send-back on the row, so a row with none is good.
    expect(stand([good({ checkedAt: '2026-11-21T10:00:00Z' })]).kind).toBe('good')
  })

  it('puts a new upload ahead of an older good one', () => {
    expect(stand([good(), row({ id: 'c2', sentAt: '2026-11-21T09:00:00Z', sentOn: '2026-11-21', createdAt: '2026-11-21T09:00:00Z' })])).toMatchObject({ kind: 'came', row: { id: 'c2' } })
  })

  it('never counts another company\'s certificate, or one checked for another job', () => {
    expect(stand([row({ companyId: 'co-2' })]).kind).toBe('none')
    expect(stand([good({ sheetProjectId: 'job-2' })]).kind).toBe('none')
    // The company's own filed certificate, with no job on it, is not this job's.
    expect(stand([row({ status: 'signed' })]).kind).toBe('none')
  })
})

describe('the check list', () => {
  const asks = ['It names Pecan Ridge Holdings as additional insured.', 'It is for work at 410 Sample Street.', 'General liability: a made-up amount.']

  it('counts the ticks until every line is ticked, then names the act', () => {
    expect(certificateCheck(asks, [true, false, false], '2027-03-03', TODAY)).toMatchObject({ goodLabel: '1 of 3 checked', canMarkGood: false, backLabel: 'Send it back, naming 2 things missing', canSendBack: true })
    expect(certificateCheck(asks, [true, true, true], '2027-03-03', TODAY)).toMatchObject({ goodLabel: 'Mark it good', canMarkGood: true, goodWhy: '', missing: [], canSendBack: false })
    expect(certificateCheck(asks, [true, true, false], '2027-03-03', TODAY)).toMatchObject({ backLabel: 'Send it back, naming 1 thing missing', missing: ['General liability: a made-up amount.'] })
  })

  it('needs the day it is good until, and a day that has not passed', () => {
    expect(certificateCheck(asks, [true, true, true], '', TODAY)).toMatchObject({ canMarkGood: false, goodWhy: 'Say the day it is good until.' })
    expect(certificateCheck(asks, [true, true, true], TODAY, TODAY)).toMatchObject({ canMarkGood: false, goodWhy: 'That day has passed. Ask them for the current certificate.' })
  })

  it('never sends one back unread: at least one line ticked, and at least one left', () => {
    expect(certificateCheck(asks, [false, false, false], '2027-03-03', TODAY).canSendBack).toBe(false)
    expect(certificateCheck([], [], '2027-03-03', TODAY)).toMatchObject({ canMarkGood: false, canSendBack: false, goodLabel: '0 of 0 checked' })
  })
})

describe('the words', () => {
  it('count what waits and who has none', () => {
    expect(certificateCounts([])).toBe('')
    expect(certificateCounts([stand([good()])])).toBe('Every trade has a certificate.')
    expect(certificateCounts([stand([row()]), stand([]), stand([])])).toBe('1 certificate to check. 2 trades have no good certificate.')
    expect(certificateCounts([stand([row()]), stand([row()]), stand([])])).toBe('2 certificates to check. 1 trade has no good certificate.')
  })

  it('send back the missing lines in the sheet\'s own words', () => {
    const email = certificateBackEmail('Cedar Park Medical Office', ['It is for work at 410 Sample Street.'])
    expect(email.subject).toBe('Your certificate of insurance for Cedar Park Medical Office needs a change')
    expect(email.lines[1]).toEqual({ title: 'It did not show:', items: ['It is for work at 410 Sample Street.'] })
  })

  it('are plain', () => {
    const said = [
      ...['none', 'came', 'good', 'outdated', 'ranOut', 'sentBack'].map((k) =>
        certificateChip(
          k === 'none'
            ? { kind: 'none' }
            : k === 'came'
              ? { kind: 'came', row: row(), cameOn: '2026-11-18' }
              : k === 'good'
                ? { kind: 'good', row: good(), goodUntil: '2027-03-03' }
                : k === 'outdated'
                  ? { kind: 'outdated', row: good() }
                  : k === 'ranOut'
                    ? { kind: 'ranOut', row: good(), on: '2026-11-21' }
                    : { kind: 'sentBack', row: row(), on: '2026-11-20', missing: 2 },
        ).words,
      ),
      'Say the day it is good until.',
      'That day has passed. Ask them for the current certificate.',
      certificateCounts([stand([row()]), stand([])]),
      ...certificateBackEmail('a job', ['A line.']).lines.filter((l): l is string => typeof l === 'string'),
    ]
    for (const words of said) expect(plainWordsFailures(words)).toEqual([])
  })
})

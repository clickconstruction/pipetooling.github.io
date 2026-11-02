import { describe, expect, it } from 'vitest'
// @ts-expect-error — the runner runs on bare Node, so its kernel is plain JS with no types
import * as kernel from '../../../scripts/lib/fileIndexBackfill.mjs'

/**
 * scripts/lib/fileIndexBackfill.mjs holds the rules of the one-time file index backfill (punch list #240,
 * v2.6343): which homes a scope walks and in what order, how a home's rounds add up, what the log line and the
 * summary say, and how a stopped run resumes. These pin them as the runner reads them.
 */
type Home = { kind: 'job' | 'bid'; id: string; number: string; zz: boolean; status: string | null; link: string | null }
type Held = { id: string; name: string; why: 'scan' | 'kind' | 'big' | 'slow' | 'error' }
type Tally = { indexed: number; held: Held[]; remaining: number; total: number; rounds: number }
type Outcome = ReturnType<typeof k.homeOutcome>
const k = kernel as {
  SCOPES: string[]
  MAX_ROUNDS: number
  isZzName: (s: unknown) => boolean
  hasFolderLink: (s: unknown) => boolean
  homesFor: (jobs: Record<string, unknown>[], bids: Record<string, unknown>[], scope: string) => Home[]
  homeRef: (h: Home) => Record<string, string>
  homeLabel: (h: Home) => string
  answerOf: (d: unknown) => { indexed: number; held: Held[]; remaining: number; total: number }
  emptyTally: () => Tally
  addRound: (t: Tally, a: { indexed: number; held: Held[]; remaining: number; total: number }) => Tally
  wantsAnotherRound: (t: Tally) => boolean
  heldCounts: (held: Held[]) => Record<string, number>
  homeOutcome: (h: Home, t: Tally, ms: number, error: string | null) => { kind: string; id: string; number: string; files: number; indexed: number; withText: number; held: Record<string, number>; heldFiles: Held[]; rounds: number; remaining: number; ms: number; error: string | null }
  totalsOf: (o: Outcome[]) => { homes: number; jobs: number; bids: number; files: number; indexed: number; withText: number; held: Record<string, number>; unopened: number; unfinished: number; rounds: number; ms: number }
  summaryWords: (t: ReturnType<typeof k.totalsOf>) => string
  roundWords: (h: Home, t: Tally) => string
  homesLeft: (homes: Home[], doneIds: string[], again: boolean) => Home[]
  refusalWords: (status: number, body: unknown) => string
  retryable: (status: number) => boolean
  parseArgs: (argv: string[]) => { scope: string; workers: number; pauseMs: number; dryRun: boolean; again: boolean; retry: boolean; limit: number | null; home: string | null; state: string | null; log: string | null; help: boolean }
}

const FOLDER = 'https://drive.google.com/drive/folders/1abcdefghijklmnopqrstuvwxyz0123456789'
const jobs = [
  { id: 'j10', hcp_number: '10', job_name: 'Oak', customer_name: 'Acme', status: 'working', google_drive_link: FOLDER },
  { id: 'j2', hcp_number: '2', job_name: 'Pine', customer_name: 'Acme', status: 'billed', google_drive_link: FOLDER },
  { id: 'jblank', hcp_number: '', job_name: 'ZZ Test', customer_name: null, status: 'working', google_drive_link: FOLDER },
  { id: 'j30', hcp_number: '30', job_name: 'Elm', customer_name: 'ZZ Split Test', status: 'paid', google_drive_link: FOLDER },
  { id: 'j40', hcp_number: '40', job_name: 'Ash', customer_name: 'Beta', status: 'paid', google_drive_link: FOLDER },
  { id: 'jnolink', hcp_number: '50', job_name: 'Fir', customer_name: 'Beta', status: 'working', google_drive_link: 'https://example.com/not-a-folder' },
]
const bids = [
  { id: 'b5', bid_number: '5', project_name: 'Depot', drive_link: FOLDER },
  { id: 'b480', bid_number: '480', project_name: 'ZZ Shadow', drive_link: FOLDER },
  { id: 'bnolink', bid_number: '481', project_name: 'Mall', drive_link: '' },
]

describe('names and links', () => {
  it('a ZZ name is a test record, any case, after trimming', () => {
    expect(k.isZzName('ZZ Test')).toBe(true)
    expect(k.isZzName('  zz split')).toBe(true)
    expect(k.isZzName('Zach')).toBe(false)
    expect(k.isZzName(null)).toBe(false)
  })
  it('a folder link is a Drive folder url or a bare id', () => {
    expect(k.hasFolderLink(FOLDER)).toBe(true)
    expect(k.hasFolderLink('https://drive.google.com/drive/u/0/folders/1abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(k.hasFolderLink('1abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(k.hasFolderLink('https://example.com/x')).toBe(false)
    expect(k.hasFolderLink('')).toBe(false)
    expect(k.hasFolderLink(null)).toBe(false)
  })
})

describe('homesFor', () => {
  it('live is every job with a folder not paid, oldest number first, a blank number last', () => {
    expect(k.homesFor(jobs, bids, 'live').map((h) => h.id)).toEqual(['j2', 'j10', 'jblank'])
  })
  it('paid is the paid jobs newest first; bids newest first; a row with no folder link is never a home', () => {
    expect(k.homesFor(jobs, bids, 'paid').map((h) => h.id)).toEqual(['j40', 'j30'])
    expect(k.homesFor(jobs, bids, 'bids').map((h) => h.id)).toEqual(['b480', 'b5'])
    expect(k.homesFor(jobs, bids, 'all').map((h) => h.id)).not.toContain('jnolink')
    expect(k.homesFor(jobs, bids, 'all').map((h) => h.id)).not.toContain('bnolink')
  })
  it('all is live, then bids, then paid', () => {
    expect(k.homesFor(jobs, bids, 'all').map((h) => h.id)).toEqual(['j2', 'j10', 'jblank', 'b480', 'b5', 'j40', 'j30'])
  })
  it('zz is every ZZ home by its own name or its customer, jobs then bids', () => {
    expect(k.homesFor(jobs, bids, 'zz').map((h) => h.id)).toEqual(['jblank', 'j30', 'b480'])
  })
  it('an unknown scope is refused', () => {
    expect(() => k.homesFor(jobs, bids, 'everything')).toThrow(/scope must be one of/)
  })
  it('a home names the job the function takes, and a label with its number and never its name', () => {
    const job = k.homesFor(jobs, bids, 'live')[0]!
    const bid = k.homesFor(jobs, bids, 'bids')[0]!
    expect(k.homeRef(job)).toEqual({ jobs_ledger_id: 'j2' })
    expect(k.homeRef(bid)).toEqual({ bid_id: 'b480' })
    expect(k.homeLabel(job)).toBe('job 2')
    expect(k.homeLabel(bid)).toBe('bid 480')
    expect(k.homeLabel(k.homesFor(jobs, bids, 'live')[2]!)).toBe('job jblank')
  })
})

describe('rounds', () => {
  const held = (why: Held['why'], id = `f-${why}`): Held => ({ id, name: `${why}.pdf`, why })
  it('an answer reads defensively: an unknown shape is nothing done and nothing left', () => {
    expect(k.answerOf(null)).toEqual({ indexed: 0, held: [], remaining: 0, total: 0 })
    expect(k.answerOf({ indexed: 3, held: [{ id: 'a', name: 'a.pdf', why: 'scan' }, { id: 'b', why: 'odd' }, { why: 'big' }], remaining: 2, total: 9 })).toEqual({
      indexed: 3,
      held: [{ id: 'a', name: 'a.pdf', why: 'scan' }],
      remaining: 2,
      total: 9,
    })
  })
  it('the tally adds up, and the held list is the final answer’s once the home is done', () => {
    let t = k.emptyTally()
    t = k.addRound(t, { indexed: 40, held: [held('slow', 'x')], remaining: 10, total: 50 })
    expect(t).toEqual({ indexed: 40, held: [held('slow', 'x')], remaining: 10, total: 50, rounds: 1 })
    expect(k.wantsAnotherRound(t)).toBe(true)
    t = k.addRound(t, { indexed: 10, held: [held('scan'), held('kind')], remaining: 0, total: 50 })
    expect(t.indexed).toBe(50)
    expect(t.held.map((h) => h.why)).toEqual(['scan', 'kind'])
    expect(k.wantsAnotherRound(t)).toBe(false)
  })
  it('a home stops after the round cap even with files to go', () => {
    const t = { ...k.emptyTally(), remaining: 5, rounds: k.MAX_ROUNDS }
    expect(k.wantsAnotherRound(t)).toBe(false)
  })
  it('the round line counts, never names', () => {
    const job = k.homesFor(jobs, bids, 'live')[0]!
    expect(k.roundWords(job, { indexed: 40, held: [held('scan')], remaining: 1200, total: 1240, rounds: 1 })).toBe('job 2: 40 indexed, 1 held, 1,200 to go (round 1)')
    expect(k.roundWords(job, { indexed: 3, held: [], remaining: 0, total: 3, rounds: 2 })).toBe('job 2: 3 indexed, 0 held (round 2)')
  })
  it('the outcome line counts the held files by reason and the files with text', () => {
    const job = k.homesFor(jobs, bids, 'live')[0]!
    const t: Tally = { indexed: 12, held: [held('scan', 'a'), held('scan', 'b'), held('big')], remaining: 0, total: 12, rounds: 1 }
    const o = k.homeOutcome(job, t, 1234, null)
    expect(o.files).toBe(12)
    expect(o.withText).toBe(9)
    expect(o.held).toEqual({ scan: 2, kind: 0, big: 1, slow: 0, error: 0 })
    expect(o.heldFiles).toHaveLength(3)
    expect(o.error).toBeNull()
    const refused = k.homeOutcome(job, k.emptyTally(), 20, 'That job has no Drive folder yet.')
    expect(refused.withText).toBe(0)
    expect(refused.error).toBe('That job has no Drive folder yet.')
  })
})

describe('totals and the summary', () => {
  const o = (over: Partial<Outcome>): Outcome => ({ kind: 'job', id: 'x', number: '1', files: 0, indexed: 0, withText: 0, held: { scan: 0, kind: 0, big: 0, slow: 0, error: 0 }, heldFiles: [], rounds: 1, remaining: 0, ms: 100, error: null, ...over })
  it('adds every home, counts a refused home as unopened and a home with files to go as unfinished', () => {
    const t = k.totalsOf([
      o({ files: 10, indexed: 10, withText: 7, held: { scan: 2, kind: 1, big: 0, slow: 0, error: 0 } }),
      o({ kind: 'bid', files: 5, indexed: 5, withText: 5 }),
      o({ error: 'HTTP 500' }),
      o({ files: 50, indexed: 40, withText: 40, remaining: 10 }),
    ])
    expect(t).toMatchObject({ homes: 4, jobs: 3, bids: 1, files: 65, indexed: 55, withText: 52, unopened: 1, unfinished: 1 })
    expect(t.held).toEqual({ scan: 2, kind: 1, big: 0, slow: 0, error: 0 })
  })
  it('the summary is counts only, with every reason named and the singular right', () => {
    const t = k.totalsOf([
      o({ files: 1200, indexed: 1200, withText: 900, held: { scan: 250, kind: 30, big: 5, slow: 10, error: 5 } }),
      o({ kind: 'bid', error: 'The app cannot open this folder.' }),
    ])
    expect(k.summaryWords(t)).toBe('Walked 2 homes (1 job, 1 bid): 1,200 files, 900 with text, 300 with none (250 scans, 30 of a kind the index does not read, 5 too big, 10 slow, 5 failed). 1 home the app could not open.')
  })
  it('a clean run says so without a held clause', () => {
    const t = k.totalsOf([o({ files: 3, indexed: 3, withText: 3 })])
    expect(k.summaryWords(t)).toBe('Walked 1 home (1 job, 0 bids): 3 files, 3 with text, 0 with none.')
  })
  it('a run cut short names the homes with files to go', () => {
    const t = k.totalsOf([o({ files: 50, indexed: 40, withText: 40, remaining: 10 }), o({ files: 50, indexed: 40, withText: 40, remaining: 10 })])
    expect(k.summaryWords(t)).toMatch(/2 homes still have files to go\.$/)
  })
})

describe('resume and refusals', () => {
  it('a second run skips the homes the state marks done, unless told again', () => {
    const homes = k.homesFor(jobs, bids, 'live')
    expect(k.homesLeft(homes, ['j2'], false).map((h) => h.id)).toEqual(['j10', 'jblank'])
    expect(k.homesLeft(homes, ['j2'], true).map((h) => h.id)).toEqual(['j2', 'j10', 'jblank'])
  })
  it('a refusal reads the function’s own words, else the status; only the platform’s refusals are tried again', () => {
    expect(k.refusalWords(409, { error: 'That job has no Drive folder yet.' })).toBe('That job has no Drive folder yet.')
    expect(k.refusalWords(502, 'bad gateway')).toBe('HTTP 502')
    expect(k.retryable(409)).toBe(false)
    expect(k.retryable(429)).toBe(true)
    expect(k.retryable(503)).toBe(true)
  })
})

describe('arguments', () => {
  it('defaults to the ZZ dry run, one home at a time, two seconds between calls', () => {
    expect(k.parseArgs([])).toEqual({ scope: 'zz', workers: 1, pauseMs: 2000, dryRun: false, again: false, retry: false, limit: null, home: null, state: null, log: null, help: false })
  })
  it('reads every flag, and caps the workers and the pause', () => {
    expect(k.parseArgs(['--scope', 'all', '--workers', '20', '--pause', '90000', '--dry-run', '--again', '--retry', '--limit', '5', '--home', 'abc', '--state', 's.json', '--log', 'l.jsonl'])).toEqual({
      scope: 'all',
      workers: 8,
      pauseMs: 60000,
      dryRun: true,
      again: true,
      retry: true,
      limit: 5,
      home: 'abc',
      state: 's.json',
      log: 'l.jsonl',
      help: false,
    })
    expect(k.parseArgs(['--help']).help).toBe(true)
  })
  it('refuses a scope it does not know and an argument it does not take', () => {
    expect(() => k.parseArgs(['--scope', 'some'])).toThrow(/--scope must be one of/)
    expect(() => k.parseArgs(['--fast'])).toThrow(/unknown argument --fast/)
    expect(k.SCOPES).toEqual(['zz', 'live', 'bids', 'paid', 'all'])
  })
})

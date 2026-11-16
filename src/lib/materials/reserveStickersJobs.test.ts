import { describe, expect, it } from 'vitest'
import type { Container } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import type { StickerRunWithStickers } from './stickerRunsIo'
import { boxCountAside, findStickerJobs, nextNameWords, runsSoFar, runsSoFarWords, stickerJobFacts, stickerJobsInOrder, type StickerJobsInput } from './reserveStickersJobs'

const box = (id: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind: 'box', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over })
const sticker = (number: number, boxName: string | null, containerId: string | null = null, lostAt: string | null = null) => ({ id: `s${number}`, number, code: `0000${number}`.slice(-8).padStart(8, 'A'), boxName, containerId, lostAt })
const run = (id: string, names: string[] | null, stickers: ReturnType<typeof sticker>[], printedByName = 'Dana', printedAt = '2026-11-16T15:00:00Z'): StickerRunWithStickers => ({ run: { id, jobId: 'j1', count: stickers.length, firstNumber: stickers[0]?.number ?? 0, lastNumber: stickers[stickers.length - 1]?.number ?? 0, copies: 1, printedByName, printedAt, names }, stickers } as StickerRunWithStickers)
const input = (over: Partial<StickerJobsInput> = {}): StickerJobsInput => ({ runsOf: null, sitesOf: null, dayWords: () => 'Nov 16', ...over })
const job: OnSiteFindJob = { jobId: 'j1', label: '1042 · Oak Hollow, Building C', number: '1042', name: 'Oak Hollow, Building C', address: '410 Mill Road', containers: [box('g1', 'G1'), box('g2', 'G2', { kind: 'cage' }), box('un', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [] }

describe('the runs printed for a job so far', () => {
  it('adds up the runs, their stickers and how those stand', () => {
    const runs = [run('r1', null, [sticker(1, null, 'g1'), sticker(2, null), sticker(3, null, null, '2026-11-01T00:00:00Z')]), run('r2', ['G3'], [sticker(4, 'G3')])]
    expect(runsSoFar(runs)).toEqual({ runs: 2, stickers: 4, onBoxes: 1, lost: 1 })
    expect(runsSoFarWords(runsSoFar(runs))).toBe('2 runs so far · 4 stickers · 1 on boxes · 1 lost')
    expect(runsSoFarWords(runsSoFar([run('r1', null, [sticker(1, null, 'g1')])]))).toBe('1 run so far · 1 sticker · 1 on boxes')
  })

  it('says a run would be the job’s first when it has none', () => {
    expect(runsSoFarWords(runsSoFar([]))).toBe('A run here would be this job’s first.')
  })
})

describe('a job’s card', () => {
  it('stands on what the desk holds while the runs and the site are unread', () => {
    const f = stickerJobFacts(job, input())
    expect([f.number, f.name, f.where]).toEqual(['1042', 'Oak Hollow, Building C', '410 Mill Road'])
    expect(f.boxes).toBe(2)
    expect(f.kinds).toBe('1 box · 1 cage')
    expect(f.names).toEqual({ listed: ['G1', 'G2'] })
    expect(f.soFar).toBeNull()
    expect(f.reserved.count).toBe(0)
    expect(f.reservedWords).toBe('')
    expect(f.nextName).toBeUndefined()
  })

  it('says the stickers reserved and not on a box yet, which, and who printed them', () => {
    const runsOf = new Map([['j1', [run('r1', ['G3', 'G4', 'G5'], [sticker(1, 'G3', 'g1'), sticker(2, 'G4'), sticker(3, 'G5')])]]])
    const f = stickerJobFacts(job, input({ runsOf }))
    expect(f.reserved.count).toBe(2)
    expect(f.reservedWords).toBe('2 stickers reserved and not on a box yet, G4 to G5. Printed Nov 16 by Dana.')
    expect(f.soFar).toEqual({ runs: 1, stickers: 3, onBoxes: 1, lost: 0 })
  })

  it('a job the read answered with no run has none so far, which is not the same as unread', () => {
    const f = stickerJobFacts(job, input({ runsOf: new Map() }))
    expect(f.soFar).toEqual({ runs: 0, stickers: 0, onBoxes: 0, lost: 0 })
    expect(f.reservedWords).toBe('')
  })

  it('names the site, and the name a new run opens on: one past the site’s boxes and every reserved name', () => {
    const names = { boxes: [{ label: 'G1', kind: 'box', retiredAt: null }, { label: 'G2', kind: 'cage', retiredAt: null }, { label: 'G7', kind: 'box', retiredAt: '2026-11-01T00:00:00Z' }], blankNames: ['G8', 'G9'] }
    const f = stickerJobFacts(job, input({ sitesOf: new Map([['j1', { site: 'Oak Hollow', names }]]) }))
    expect(f.where).toBe('Oak Hollow · 410 Mill Road')
    expect(f.nextName).toBe('G10')
    expect(nextNameWords(f.nextName)).toBe('A new run opens on G10.')
    // The site read, its names did not: the name is left out, never guessed.
    expect(stickerJobFacts(job, input({ sitesOf: new Map([['j1', { site: 'Oak Hollow', names: null }]]) })).nextName).toBeNull()
    expect(nextNameWords(null)).toBe('')
    expect(nextNameWords(undefined)).toBe('')
  })

  it('a job with no box is a card too, and a read that failed is carried', () => {
    const bare = stickerJobFacts({ jobId: 'j3', label: '1071 · Larkspur Dental', containers: [box('un', 'Unsorted', { kind: 'unsorted' })], lines: [], places: [], failed: 'The connection dropped.' }, input())
    expect([bare.boxes, bare.kinds, bare.names, bare.failed]).toEqual([0, '', null, 'The connection dropped.'])
    expect(boxCountAside(0)).toBe('no box yet')
    expect(boxCountAside(3)).toBe('')
    // A job the caller cannot split keeps its whole label as its name.
    expect([bare.number, bare.name]).toEqual(['', '1071 · Larkspur Dental'])
  })
})

describe('the list of jobs', () => {
  const j = (jobId: string, label: string): OnSiteFindJob => ({ jobId, label, containers: [], lines: [], places: [] })
  const jobs = [j('a', '1113 · ZZ Test Walk'), j('b', '224 · Phase 2'), j('c', '1077 · Ridgeway Medical')]

  it('puts stickers waiting for their boxes first, then the job’s number', () => {
    const runsOf = new Map([['c', [{ ...run('r1', null, [sticker(1, null)]), run: { ...run('r1', null, []).run, jobId: 'c' } }]]])
    expect(stickerJobsInOrder(jobs, input({ runsOf })).map((f) => f.jobId)).toEqual(['c', 'b', 'a'])
    expect(stickerJobsInOrder(jobs, input()).map((f) => f.jobId)).toEqual(['b', 'c', 'a'])
  })

  it('a search takes every typed word, from the number, the name, the site or the street', () => {
    const facts = stickerJobsInOrder(jobs, input({ sitesOf: new Map([['a', { site: 'Cedar Ridge', names: null }]]) }))
    expect(findStickerJobs(facts, 'ridge').map((f) => f.jobId)).toEqual(['c', 'a'])
    expect(findStickerJobs(facts, 'ridge 1077').map((f) => f.jobId)).toEqual(['c'])
    expect(findStickerJobs(facts, ' ').length).toBe(3)
  })
})

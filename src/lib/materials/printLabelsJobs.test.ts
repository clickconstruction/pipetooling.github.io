import { describe, expect, it } from 'vitest'
import type { Container, ContainerLine } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import { NO_PLACE_WORDS, allDoorLabel, cassetteShareWords, emptyBoxCount, findLabelJobs, kindCountsWords, labelJobChips, labelJobFacts, labelJobsCountWords, labelJobsInOrder, nameSpan, placeCounts, printNeedWords, resumeWords, tapeLengthWords, type LabelJobsInput } from './printLabelsJobs'

const box = (id: string, label: string, over: Partial<Container> = {}): Container => ({ id, jobId: 'j1', label, kind: 'box', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-01T00:00:00Z', ...over })
const line = (containerId: string, onHand: number): ContainerLine => ({ containerId, partName: '2 in 90', onHand } as ContainerLine)
const input = (over: Partial<LabelJobsInput> = {}): LabelJobsInput => ({ today: '2026-11-16', kept: null, format: 'tape', widthMm: 24, copies: 1, stickeredIds: null, ...over })
const names = (n: number) => Array.from({ length: n }, (_, i) => `G${i + 1}`)

describe('what a card says the labels are', () => {
  it('counts boxes, cages and loose piles apart and leaves out a kind with none', () => {
    expect(kindCountsWords([{ kind: 'box' }, { kind: 'box' }, { kind: 'cage' }])).toBe('2 boxes · 1 cage')
    expect(kindCountsWords([{ kind: 'cage' }, { kind: 'cage' }])).toBe('2 cages')
    expect(kindCountsWords([{ kind: 'loose' }, { kind: 'box' }])).toBe('1 box · 1 loose pile')
    expect(kindCountsWords([{ kind: 'loose' }, { kind: 'loose' }])).toBe('2 loose piles')
  })

  it('names each box up to six, and past six the first and the last in the order a person counts', () => {
    expect(nameSpan(['A2', 'A1'])).toEqual({ listed: ['A1', 'A2'] })
    expect(nameSpan(['G10', 'G2', 'G1', 'G3', 'G4', 'G5', 'G6'])).toEqual({ first: 'G1', last: 'G10' })
    expect(nameSpan([])).toBeNull()
  })

  it('counts each place by name and puts the boxes with no place last', () => {
    const places = [{ id: 'p2', name: 'Level 2' }, { id: 'p1', name: 'Level 1' }, { id: 'p10', name: 'Level 10' }]
    const boxes = [{ locationId: 'p2' }, { locationId: 'p10' }, { locationId: 'p1' }, { locationId: 'p2' }, { locationId: null }, { locationId: 'gone' }]
    expect(placeCounts(boxes, places)).toEqual([{ name: 'Level 1', n: 1 }, { name: 'Level 2', n: 2 }, { name: 'Level 10', n: 1 }, { name: NO_PLACE_WORDS, n: 2 }])
    expect(placeCounts([{ locationId: 'p1' }], places)).toEqual([{ name: 'Level 1', n: 1 }])
  })
})

describe('what changed', () => {
  it('a box is empty when no line has a part on hand', () => {
    expect(emptyBoxCount([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [line('a', 4), line('b', 0)])).toBe(2)
  })

  it('the chips read in order and leave out what is nothing', () => {
    expect(labelJobChips({ notPrintedIds: ['a', 'b'], allLabelled: false, stickered: 1, empty: 3 })).toEqual([{ tone: 'amber', words: '2 not printed yet' }, { tone: 'blue', words: '1 already wears a sticker' }, { tone: 'gray', words: '3 empty' }])
    expect(labelJobChips({ notPrintedIds: [], allLabelled: false, stickered: 23, empty: 0 })).toEqual([{ tone: 'blue', words: '23 already wear a sticker' }])
    // Every box is known to carry a code: the card says so.
    expect(labelJobChips({ notPrintedIds: [], allLabelled: true, stickered: 0, empty: 0 })).toEqual([{ tone: 'green', words: 'Every box is labelled' }])
    // The stickers were not read: both chips are left out, never a zero and never a guess.
    expect(labelJobChips({ notPrintedIds: null, allLabelled: false, stickered: null, empty: 0 })).toEqual([])
  })
})

describe('what the job takes to print', () => {
  it('says a length under a metre in centimetres and past it in metres', () => {
    expect(tapeLengthWords(94)).toBe('9 cm')
    expect(tapeLengthWords(4277)).toBe('4.3 m')
  })

  it('names the share of an 8 m cassette only once it is a real share', () => {
    expect(cassetteShareWords(900)).toBe('')
    expect(cassetteShareWords(2000)).toBe('about a quarter of a cassette')
    expect(cassetteShareWords(4277)).toBe('about half a cassette')
    expect(cassetteShareWords(8000)).toBe('about a whole cassette')
    expect(cassetteShareWords(12000)).toBe('about 1.5 cassettes')
  })

  it('on tape counts the strips and their length from each name, times the copies', () => {
    // A two-letter name is 41 mm of 24 mm tape and a three-letter one 47 (tapeLayout).
    expect(printNeedWords('tape', ['A1', 'A2'], 24, 1)).toBe('2 strips · about 8 cm of 24 mm tape')
    expect(printNeedWords('tape', names(91), 24, 1)).toBe('91 strips · about 4.2 m of 24 mm tape · about half a cassette')
    expect(printNeedWords('tape', ['A1', 'A2'], 24, 2)).toBe('4 strips, 2 of each · about 16 cm of 24 mm tape')
    expect(printNeedWords('tape', ['A1'], 18, 1)).toBe('1 strip · about 3 cm of 18 mm tape')
  })

  it('on paper counts pages', () => {
    expect(printNeedWords('sheet', names(91), 24, 3)).toBe('91 pages')
    expect(printNeedWords('sheet', ['A1'], 24, 1)).toBe('1 page')
  })
})

describe('a job’s card', () => {
  const boxes = [box('g1', 'G1'), box('g2', 'G2 COPPER 90'), box('g3', 'G3', { kind: 'cage', createdAt: '2026-11-18T15:00:00Z' }), box('old', 'G0', { retiredAt: '2026-11-01T00:00:00Z' }), box('un', 'Unsorted', { kind: 'unsorted' })]
  const job: OnSiteFindJob = { jobId: 'j1', label: '1042 · Oak Hollow, Building C', number: '1042', name: 'Oak Hollow, Building C', address: '410 Mill Road', containers: boxes, lines: [line('g1', 3)], places: [] }

  it('reads the live boxes alone, by name, with the short name a label prints', () => {
    const f = labelJobFacts(job, input({ siteOf: () => 'Oak Hollow' }))!
    expect(f.labels).toBe(3)
    expect(f.kinds).toBe('2 boxes · 1 cage')
    expect(f.names).toEqual({ listed: ['G1', 'G2', 'G3'] })
    expect(f.where).toBe('Oak Hollow · 410 Mill Road')
    expect(f.number).toBe('1042')
    expect(f.name).toBe('Oak Hollow, Building C')
    expect(f.places).toEqual([{ name: NO_PLACE_WORDS, n: 3 }])
    expect(f.empty).toBe(2)
    // The stickers are unread: what waits for a label is not said yet.
    expect(f.notPrintedIds).toBeNull()
    expect(f.allLabelled).toBe(false)
    expect(f.stickered).toBeNull()
    expect(f.sample).toEqual({ id: 'g1', name: 'G1' })
    expect(f.need).toBe('3 strips · about 12 cm of 24 mm tape')
  })

  it('offers the boxes not printed yet and every box, and one door when every box waits', () => {
    const read = input({ stickeredIds: new Set<string>() })
    const f = labelJobFacts(job, read)!
    // G1 and G2 were made before the app kept the mark: nothing is said of them.
    expect(f.notPrintedIds).toEqual(['g3'])
    expect(f.doors).toEqual([{ kind: 'unprinted', label: 'The 1 not printed yet', ids: ['g3'] }, { kind: 'all', label: 'All 3', ids: ['g1', 'g2', 'g3'] }])
    // Until the stickers are read there is one door: a box with a sticker waits for nothing.
    expect(labelJobFacts(job, input())!.doors).toEqual([{ kind: 'all', label: 'All 3', ids: ['g1', 'g2', 'g3'] }])
    const fresh = { ...job, containers: [box('n1', 'T1', { createdAt: '2026-11-18T00:00:00Z' }), box('n2', 'T2', { createdAt: '2026-11-18T00:00:00Z' })] }
    expect(labelJobFacts(fresh, read)!.doors).toEqual([{ kind: 'all', label: 'Both labels', ids: ['n1', 'n2'] }])
    expect(allDoorLabel(1)).toBe('The one label')
  })

  it('a printed label or a sticker takes a box off the waiting count, and a job with neither left says so', () => {
    const printed = { ...job, containers: [box('g1', 'G1', { labelPrintedAt: '2026-11-18T16:00:00Z' }), box('g2', 'G2', { createdAt: '2026-11-18T15:00:00Z' }), box('g3', 'G3', { createdAt: '2026-11-18T15:00:00Z' })] }
    const one = labelJobFacts(printed, input({ stickeredIds: new Set(['g3']) }))!
    expect(one.notPrintedIds).toEqual(['g2'])
    expect(one.allLabelled).toBe(false)
    const done = { ...printed, containers: printed.containers.map((c) => (c.id === 'g2' ? { ...c, labelPrintedAt: '2026-11-18T17:00:00Z' } : c)) }
    const all = labelJobFacts(done, input({ stickeredIds: new Set(['g3']) }))!
    expect(all.notPrintedIds).toEqual([])
    expect(all.allLabelled).toBe(true)
    expect(all.doors).toEqual([{ kind: 'all', label: 'All 3', ids: ['g1', 'g2', 'g3'] }])
  })

  it('a run this computer stopped today is the first door, with what is left and where it picks up', () => {
    const kept = { jobId: 'j1', day: '2026-11-16', copies: 2, left: ['g1'], partial: null }
    const f = labelJobFacts(job, input({ kept }))!
    expect(f.resume).toEqual({ boxes: 2, from: 'G2' })
    expect(resumeWords(f.resume!)).toBe('A run stopped here today. 2 boxes are left, from G2.')
    expect(f.doors[0]).toEqual({ kind: 'rest', label: 'The rest, 2 boxes', ids: ['g2', 'g3'] })
    // The tape is counted at the copies the run was printing.
    expect(f.need).toBe('6 strips, 2 of each · about 25 cm of 24 mm tape')
    expect(resumeWords({ boxes: 1, from: 'G3' })).toBe('A run stopped here today. 1 box is left, G3.')
    // Yesterday's run, or another job's, is no run to pick up.
    expect(labelJobFacts(job, input({ kept: { ...kept, day: '2026-11-15' } }))!.resume).toBeNull()
    expect(labelJobFacts(job, input({ kept: { ...kept, jobId: 'j2' } }))!.resume).toBeNull()
  })

  it('counts the boxes that wear a sticker once they are read', () => {
    expect(labelJobFacts(job, input({ stickeredIds: new Set(['g2', 'old', 'elsewhere']) }))!.stickered).toBe(1)
  })

  it('is nothing for a job with no box to label, and takes the whole label for a job it cannot split', () => {
    expect(labelJobFacts({ ...job, containers: [box('un', 'Unsorted', { kind: 'unsorted' })] }, input())).toBeNull()
    const bare = labelJobFacts({ jobId: 'j9', label: 'job 7d759246', containers: [box('x', 'A1')], lines: [], places: [] }, input())!
    expect([bare.number, bare.name, bare.where]).toEqual(['', 'job 7d759246', ''])
  })
})

describe('the list of jobs', () => {
  const j = (jobId: string, label: string, containers: Container[]): OnSiteFindJob => ({ jobId, label, containers, lines: [], places: [] })
  const jobs = [
    j('a', '1113 · ZZ Test Walk', [box('a1', 'T1', { jobId: 'a' })]),
    j('b', '224 · Phase 2', [box('b1', 'G1', { jobId: 'b' }), box('b2', 'G2', { jobId: 'b' })]),
    j('c', '1077 · Ridgeway Medical', [box('c1', 'A1', { jobId: 'c' }), box('c2', 'A2', { jobId: 'c', createdAt: '2026-11-18T00:00:00Z' })]),
    j('d', '1200 · No boxes', [box('un', 'Unsorted', { kind: 'unsorted', jobId: 'd' })]),
  ]

  it('puts a run to finish first, then boxes not printed yet, then the job’s number, and leaves out a job with no box', () => {
    const kept = { jobId: 'b', day: '2026-11-16', copies: 1, left: ['b1'], partial: null }
    const stickeredIds = new Set<string>()
    expect(labelJobsInOrder(jobs, input({ kept, stickeredIds })).map((f) => f.jobId)).toEqual(['b', 'c', 'a'])
    expect(labelJobsInOrder(jobs, input({ stickeredIds })).map((f) => f.jobId)).toEqual(['c', 'b', 'a'])
  })

  it('a search takes every typed word, from the number, the name, the site or the street', () => {
    const facts = labelJobsInOrder(jobs, input({ siteOf: (id) => (id === 'a' ? 'Cedar Ridge' : null) }))
    expect(findLabelJobs(facts, 'ridge').map((f) => f.jobId)).toEqual(['c', 'a'])
    expect(findLabelJobs(facts, 'ridge 1077').map((f) => f.jobId)).toEqual(['c'])
    expect(findLabelJobs(facts, '  ').length).toBe(3)
    expect(findLabelJobs(facts, 'nothing')).toEqual([])
  })

  it('says how many jobs hold a box', () => {
    expect(labelJobsCountWords(1)).toBe('1 job holds a cage or a box.')
    expect(labelJobsCountWords(3)).toBe('3 jobs hold a cage or a box.')
  })
})

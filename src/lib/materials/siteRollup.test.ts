import { describe, expect, it } from 'vitest'
import { containerLines, type Container, type Movement, type MovementReason, type Place } from './onSite'
import { filterPartRows, groupDeskBySite, lastRecordedWords, rollKey, sameWordsKey, searchPartRows, shownTotalWords, siteBoxesWords, siteGlance, sitePartRows, sitePlaceSections, siteWeekFlow, spellingsWords, type SiteRollupJob } from './siteRollup'

// A made-up site, Juniper Ridge: two jobs, a laydown yard both jobs use, a second level on one.
const NOW = new Date('2026-11-12T18:00:00Z')
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

let seq = 0
function row(jobId: string, reason: MovementReason, name: string, quantity: number, box: string, daysAgo: number, extra: Partial<Movement> = {}): Movement {
  seq += 1
  const into = reason === 'delivered'
  return { id: `m${String(seq).padStart(4, '0')}`, jobId, partId: null, partName: name, manufacturer: null, quantity, reason, fromContainerId: into ? null : box, toContainerId: into ? box : null, note: '', byUserId: null, byName: 'Priya', at: day(daysAgo), source: null, itemId: null, ...extra }
}
function box(id: string, jobId: string, label: string, locationId: string | null, extra: Partial<Container> = {}): Container {
  return { id, jobId, label, kind: 'cage', where: '', locationId, lat: null, lng: null, retiredAt: null, createdAt: day(30), ...extra }
}
const place = (id: string, jobId: string, name: string): Place => ({ id, jobId, name, createdAt: day(30) })

function site(): { jobs: SiteRollupJob[]; movements: Movement[] } {
  seq = 0
  const a: Movement[] = [
    row('ja', 'delivered', '2" 90 pvc', 94, 'r12', 10),
    row('ja', 'counted', '2" 90 pvc', 94, 'r12', 3),
    row('ja', 'delivered', '2 inch 90 PVC', 42, 'r31', 10),
    row('ja', 'counted', '2 inch 90 PVC', 42, 'r31', 3),
    row('ja', 'delivered', '2" 90', 42, 'r58', 20),
    row('ja', 'delivered', '3" 90 pvc', 30, 'r31', 10),
    row('ja', 'delivered', '1/2" PEX drop ear', 28, 'r22', 9),
    row('ja', 'counted', '1/2" PEX drop ear', 28, 'r22', 8),
    row('ja', 'cannot_find', '1/2" PEX drop ear', 3, 'r22', 2),
    row('ja', 'delivered', 'Wax ring', 12, 'gone', 9),
    row('ja', 'delivered', 'Copper tee', 300, 'r7', 9, { partId: 'book-1', partName: '3/4 COPPER TEE' }),
    row('ja', 'counted', 'Copper tee', 290, 'r7', 2, { partId: 'book-1', partName: '3/4 COPPER TEE' }),
  ]
  const b: Movement[] = [
    row('jb', 'delivered', '2inch 90s pvc', 28, 'p1', 6, { source: 'INV-1', byName: 'Marcus' }),
    row('jb', 'used', '2inch 90s pvc', 8, 'p1', 1, { byName: 'Marcus' }),
    row('jb', 'delivered', 'Toilet', 4, 'un', 5, { source: 'INV-2' }),
  ]
  const jobs: SiteRollupJob[] = [
    {
      jobId: 'ja',
      label: 'J1042 · Juniper Ridge, phase 2',
      containers: [box('r12', 'ja', 'R12', 'yard-a'), box('r31', 'ja', 'R31', 'yard-a'), box('r58', 'ja', 'R58', 'yard-a'), box('r22', 'ja', 'R22', 'lvl2'), box('r7', 'ja', 'R7', null), box('gone', 'ja', 'R99', 'yard-a', { retiredAt: day(1) })],
      places: [place('yard-a', 'ja', 'Laydown yard'), place('lvl2', 'ja', 'Level 2')],
      lines: containerLines(a),
    },
    {
      jobId: 'jb',
      label: 'J1057 · Juniper Ridge pump house',
      containers: [box('p1', 'jb', 'P1', 'yard-b'), box('un', 'jb', 'Unsorted', null, { kind: 'unsorted' })],
      places: [place('yard-b', 'jb', 'laydown yard')],
      lines: containerLines(b),
    },
  ]
  return { jobs, movements: [...a, ...b] }
}

describe('sameWordsKey: the same words are one key', () => {
  it('folds the inch mark, case, spaces, word order, punctuation and a plural', () => {
    const key = sameWordsKey('2" 90 pvc')
    for (const name of ['2 inch 90 PVC', '2inch 90s pvc', '2”90 pvc', 'PVC 2" 90', '2 in. 90 pvc', ' 2"  90, PVC ']) expect(sameWordsKey(name), name).toBe(key)
  })
  it('never folds a different size, a missing word or a bare number', () => {
    const key = sameWordsKey('2" 90 pvc')
    for (const name of ['3" 90 pvc', '2" 90', '2" 45 pvc', '2 90 pvc', '2" 90 copper']) expect(sameWordsKey(name), name).not.toBe(key)
  })
  it('keeps two sizes of one fitting in the order typed', () => {
    expect(sameWordsKey('3x4 reducer')).toBe(sameWordsKey('Reducer 3 X 4'))
    expect(sameWordsKey('3x4 reducer')).not.toBe(sameWordsKey('4x3 reducer'))
    expect(sameWordsKey('1/2 x 3/8 stop')).toBe(sameWordsKey('1/2x3/8 stops'))
  })
  it('never joins two fittings whose sizes swap ends across a word (v2.7249)', () => {
    // The × guard only held with the x right between two numbers: a word between them let the sort swap the sizes.
    expect(sameWordsKey('1/2 pex x 3/4 mip adapter')).not.toBe(sameWordsKey('3/4 pex x 1/2 mip adapter'))
    expect(sameWordsKey('3/4" MIP x 1/2" FIP')).not.toBe(sameWordsKey('1/2" MIP x 3/4" FIP'))
    expect(sameWordsKey('4" to 2" reducer')).not.toBe(sameWordsKey('2" to 4" reducer'))
    expect(sameWordsKey('4 by 2 bushing')).not.toBe(sameWordsKey('2 by 4 bushing'))
    // The same fitting typed the same way still folds case, the inch mark, spaces and a plural.
    expect(sameWordsKey('1/2 PEX x 3/4 MIP Adapters')).toBe(sameWordsKey('1/2  pex X 3/4 mip adapter'))
    expect(sameWordsKey('4 inch to 2 inch reducer')).toBe(sameWordsKey('4" to 2" Reducers'))
    // Typed in another word order it is two rows a person may join: the safe side of a guess.
    expect(sameWordsKey('adapter 1/2 pex x 3/4 mip')).not.toBe(sameWordsKey('1/2 pex x 3/4 mip adapter'))
    // A name with no such word still folds its word order, glued sizes and all.
    expect(sameWordsKey('wye 3x4 pvc')).toBe(sameWordsKey('PVC 3 x 4 wyes'))
  })
  it('keeps the point of a decimal size, and reads 0.5 as .5 (v2.7249)', () => {
    expect(sameWordsKey('.5" coupling')).not.toBe(sameWordsKey('5" coupling'))
    expect(sameWordsKey('1.5" trap')).not.toBe(sameWordsKey('15" trap'))
    expect(sameWordsKey('1.5" trap')).not.toBe(sameWordsKey('1 5" trap'))
    expect(sameWordsKey('0.5" coupling')).toBe(sameWordsKey('.5 inch couplings'))
    expect(sameWordsKey('10.5 gasket')).not.toBe(sameWordsKey('1.5 gasket'))
    // A point that ends a word or a sentence, or follows a letter, is still punctuation.
    expect(sameWordsKey('2 in. 90 pvc.')).toBe(sameWordsKey('2" 90 pvc'))
    expect(sameWordsKey('No.4 screw')).toBe(sameWordsKey('no 4 screws'))
    expect(sameWordsKey('trap, 2".')).toBe(sameWordsKey('2" trap'))
  })
  it('reads a mixed number and a size glued to its word', () => {
    expect(sameWordsKey('1-1/2 traps')).toBe(sameWordsKey('1 1/2 trap'))
    expect(sameWordsKey('3/4tees')).toBe(sameWordsKey('3/4 tee'))
    expect(sameWordsKey('Pump Barnes')).toBe(sameWordsKey('barnes pump'))
  })
  it('leaves a word that only looks plural alone', () => {
    expect(sameWordsKey('brass')).toBe('brass')
    expect(sameWordsKey('gas')).toBe('gas')
    expect(sameWordsKey('boxes')).toBe(sameWordsKey('box'))
  })
  it('a book part keys on its id, whatever its name', () => {
    expect(rollKey({ partId: 'book-1', partName: 'anything' })).toBe('id:book-1')
    expect(rollKey({ partId: null, partName: '2" 90 pvc' })).toBe(`words:${sameWordsKey('2 inch 90 PVC')}`)
  })
})

describe('sitePartRows: one row per part across the site', () => {
  it('adds the same words across boxes and jobs, and keeps a near twin apart', () => {
    const rows = sitePartRows(site().jobs, NOW)
    const pvc = rows.find((r) => r.key === rollKey({ partId: null, partName: '2" 90 pvc' }))!
    expect(pvc.total).toBe(94 + 42 + 20)
    expect(pvc.name).toBe('2" 90 pvc')
    expect(pvc.spellings.map((s) => s.name)).toEqual(['2" 90 pvc', '2 inch 90 PVC', '2inch 90s pvc'])
    expect(pvc.boxes.map((b) => `${b.label} ${b.onHand}`)).toEqual(['R12 94', 'R31 42', 'P1 20'])
    expect(pvc.boxes[2]!.jobLabel).toBe('J1057 · Juniper Ridge pump house')
    expect(spellingsWords(pvc)).toBe('3 spellings')
    const bare = rows.find((r) => r.name === '2" 90')!
    expect(bare.total).toBe(42)
    expect(spellingsWords(bare)).toBe('')
  })
  it('totals equal the sum of the lines on hand in live boxes', () => {
    const { jobs } = site()
    const rows = sitePartRows(jobs, NOW)
    const live = new Set(jobs.flatMap((j) => j.containers.filter((c) => !c.retiredAt).map((c) => c.id)))
    const onHand = jobs.flatMap((j) => j.lines).filter((l) => live.has(l.containerId) && l.onHand > 0).reduce((n, l) => n + l.onHand, 0)
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(onHand)
    expect(rows.some((r) => r.name === 'Wax ring')).toBe(false)
  })
  it('two spellings in one box each keep their own count, and the row adds them', () => {
    seq = 0
    const m = [
      row('ja', 'delivered', '2" 90 pvc', 10, 'r1', 9),
      row('ja', 'delivered', '2 inch 90 PVC', 5, 'r1', 8),
      row('ja', 'counted', '2" 90 pvc', 10, 'r1', 2),
      row('ja', 'counted', '2 inch 90 PVC', 5, 'r1', 1),
    ]
    const rows = sitePartRows([{ jobId: 'ja', label: 'J1', containers: [box('r1', 'ja', 'R1', null)], places: [], lines: containerLines(m) }], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.total).toBe(15)
    expect(rows[0]!.short).toBe(0)
    expect(rows[0]!.boxes.map((b) => `${b.spelling} ${b.onHand}`)).toEqual(['2" 90 pvc 10', '2 inch 90 PVC 5'])
  })
  it("carries a Can't find, a shortfall and a box due a count onto the row", () => {
    const rows = sitePartRows(site().jobs, NOW)
    const ear = rows.find((r) => r.name === '1/2" PEX drop ear')!
    expect(ear.cannotFind).toBe(3)
    expect(ear.total).toBe(25)
    const tee = rows.find((r) => r.partId === 'book-1')!
    expect(tee.short).toBe(10)
    expect(tee.total).toBe(290)
    expect(rows.find((r) => r.name === '2" 90')!.due).toBe(true)
    expect(filterPartRows(rows, 'cannot').map((r) => r.name)).toEqual(['1/2" PEX drop ear'])
    expect(filterPartRows(rows, 'short').map((r) => r.partId)).toEqual(['book-1'])
    expect(filterPartRows(rows, 'due').some((r) => r.name === '2" 90')).toBe(true)
    expect(filterPartRows(rows, 'all')).toHaveLength(rows.length)
  })
  it('sorts sizes as people read them', () => {
    const names = sitePartRows(site().jobs, NOW).map((r) => r.name)
    expect(names.indexOf('2" 90')).toBeLessThan(names.indexOf('3" 90 pvc'))
  })
})

describe('the search and its total', () => {
  it('finds by every word in a name, a spelling, a box or a place, and adds up what it shows', () => {
    const rows = sitePartRows(site().jobs, NOW)
    const found = searchPartRows(rows, '2 90')
    expect(found.map((r) => r.name)).toEqual(['2" 90', '2" 90 pvc'])
    expect(shownTotalWords(found)).toBe('198 pieces in the 2 rows shown')
    expect(searchPartRows(rows, 'inch').map((r) => r.name)).toEqual(['2" 90 pvc'])
    expect(searchPartRows(rows, 'r22').map((r) => r.name)).toEqual(['1/2" PEX drop ear'])
    expect(searchPartRows(rows, 'level').map((r) => r.name)).toEqual(['1/2" PEX drop ear'])
    expect(searchPartRows(rows, '  ')).toHaveLength(rows.length)
    expect(shownTotalWords([{ total: 1 }])).toBe('1 piece in the 1 row shown')
  })
})

describe('siteGlance: the figures over the list', () => {
  it('counts the boxes, the jobs, the places by name, the lines and the pieces', () => {
    const g = siteGlance(site().jobs, NOW)
    expect(g.boxes).toBe(6)
    expect(g.jobsWithBoxes).toBe(2)
    expect(g.places).toBe(2)
    expect(siteBoxesWords(g)).toBe('6 boxes on 2 jobs at 2 places')
    expect(g.lines).toBe(8)
    expect(g.pieces).toBe(94 + 42 + 42 + 30 + 25 + 290 + 20 + 4)
    expect(g.cannotFindLines).toBe(1)
    expect(g.shortLines).toBe(1)
  })
  it('says how fresh the record is, from the newest thing recorded', () => {
    const g = siteGlance(site().jobs, NOW)
    expect(g.quietDays).toBe(1)
    expect(lastRecordedWords(g)).toEqual({ big: 'Yesterday', small: 'by Marcus' })
    expect(lastRecordedWords({ lastRecorded: null, quietDays: null }).big).toBe('Nothing yet')
    expect(lastRecordedWords({ lastRecorded: { at: day(9), byName: null }, quietDays: 9 })).toEqual({ big: '9 days ago', small: '' })
  })
  it('splits the boxes due now from the ones that fall due this week', () => {
    const g = siteGlance(site().jobs, NOW)
    // Never counted: R58 and P1. Counted 8 days ago: R22 falls due inside the week. Counted 2 or 3 days ago: not yet.
    expect(g.dueNow).toBe(2)
    expect(g.dueSoon).toBe(1)
  })
})

describe('sitePlaceSections: the boxes by place', () => {
  it('folds a place name across jobs and names the jobs, then Unsorted, then no place', () => {
    const sections = sitePlaceSections(site().jobs, NOW)
    expect(sections.map((s) => s.name)).toEqual(['Laydown yard', 'Level 2', 'Unsorted', 'No place yet'])
    const yard = sections[0]!
    expect(yard.jobLabels).toEqual(['J1042 · Juniper Ridge, phase 2', 'J1057 · Juniper Ridge pump house'])
    expect(yard.boxes.map((b) => b.label)).toEqual(['P1', 'R12', 'R31', 'R58'])
    expect(yard.boxes.find((b) => b.label === 'R31')!.lines.map((l) => l.name)).toEqual(['2 inch 90 PVC', '3" 90 pvc'])
    expect(sections[2]!.boxes[0]!.lines).toEqual([{ partKey: 'text:toilet', name: 'Toilet', onHand: 4, cannotFind: 0, short: 0 }])
    expect(sections[3]!.boxes.map((b) => b.label)).toEqual(['R7'])
  })
  it('leaves out a retired box and an empty Unsorted', () => {
    const { jobs } = site()
    const labels = sitePlaceSections(jobs, NOW).flatMap((s) => s.boxes.map((b) => b.label))
    expect(labels).not.toContain('R99')
    const empty: SiteRollupJob = { jobId: 'jc', label: 'J3', containers: [box('u', 'jc', 'Unsorted', null, { kind: 'unsorted' })], places: [], lines: [] }
    expect(sitePlaceSections([empty], NOW)).toEqual([])
  })
})

describe('siteWeekFlow', () => {
  it('adds what came in and what was used in the last seven days, and counts the invoices', () => {
    expect(siteWeekFlow(site().movements, NOW)).toEqual({ cameIn: 28 + 4, used: 8, invoices: 2 })
  })
})

describe('groupDeskBySite', () => {
  it('puts a site first with its jobs under it, and a job on no site after', () => {
    const groups = groupDeskBySite(['j0', 'ja', 'jb', 'jx'], new Map([['j0', null], ['ja', 'dev1'], ['jb', 'dev1'], ['jx', 'dev9']]), new Map([['dev1', 'Juniper Ridge']]))
    expect(groups).toEqual([
      { kind: 'site', siteId: 'dev1', name: 'Juniper Ridge', jobIds: ['ja', 'jb'] },
      { kind: 'job', jobId: 'j0' },
      { kind: 'job', jobId: 'jx' },
    ])
  })
})

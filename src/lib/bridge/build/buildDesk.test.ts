import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { BuildJob, PctPoint } from '../buildPace'
import type { VectorSession } from '../vectors'
import { BUILD_DESK_CREW_DAYS, BUILD_DESK_DAYS, buildBuildDesk, countsForBuildDesk, type BuildDesk, type BuildDeskInput, type BuildDeskReads } from './buildDesk'

const TODAY = '2026-10-26'
const job = (id: string, name: string, revenueUsd: number | null, pctComplete: number | null, createdYmd = '2026-07-01'): BuildJob => ({ id, label: `J${id} · ${name}`, hcpNumber: `J${id}`, jobName: name, revenueUsd, pctComplete, status: 'working', createdYmd })
const pt = (jobId: string, atYmd: string, pct: number, source: PctPoint['source'] = 'hand'): PctPoint => ({ jobId, atYmd, pct, source })
const sess = (jobId: string, workDate: string, hours: number, userId = 'u1', over: Partial<VectorSession> = {}): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false, ...over })
const block = (jobId: string, workDate: string, assigneeUserId: string) => ({ jobId, workDate, assigneeUserId })

/** The mock-up's seven jobs on 2026-10-26: the window is Oct 13–26, the crew look-ahead Oct 26 – Nov 1. */
const openJobs: BuildJob[] = [
  job('977', 'Springtown', 71_000, 45),
  job('1017', 'Terrell', null, null),
  job('1086', 'Big Easy sink drain', null, null),
  job('878', 'Take 5- Seguin', 124_000, 62),
  job('912', 'Limitless Renovations', 44_000, 30),
  job('1007', 'SPACEX BA-02N Architectural', 170_000, 60),
  job('1081', 'Adams Pretest', 32_000, 100),
]
const points: PctPoint[] = [pt('977', '2026-09-28', 45), pt('878', '2026-09-01', 62), pt('912', '2026-08-20', 30), pt('1007', '2026-09-30', 48), pt('1007', '2026-10-20', 60, 'report'), pt('1081', '2026-10-01', 90), pt('1081', '2026-10-22', 100, 'report')]
const sessions: VectorSession[] = [
  sess('977', '2026-10-14', 14),
  sess('977', '2026-10-20', 8, 'u1', { approved: false, pending: true }),
  sess('1017', '2026-10-15', 31, 'u2'),
  sess('1086', '2026-10-19', 12, 'u2'),
  sess('878', '2026-10-07', 8),
  sess('912', '2026-10-02', 6),
  sess('1007', '2026-10-13', 20, 'u3'),
  sess('1007', '2026-10-14', 20, 'u3'),
  sess('1007', '2026-10-15', 22, 'u4'),
  sess('1007', '2026-10-16', 20, 'u5'),
  sess('1081', '2026-10-21', 14, 'u4'),
  // Not counted: a bid session, the office job, a rejected session, a future-dated one.
  sess(null as unknown as string, '2026-10-20', 9, 'u1', { jobId: null, onBid: true }),
  sess('977', '2026-10-21', 9, 'u1', { officeJob: true }),
  sess('878', '2026-10-22', 9, 'u1', { approved: false, pending: false }),
  sess('912', '2026-10-28', 9),
]
const reads: BuildDeskReads = {
  blocks: [block('977', '2026-10-27', 'u1'), block('977', '2026-10-28', 'u1'), block('977', '2026-10-29', 'u1'), block('1017', '2026-10-27', 'u2'), block('1017', '2026-10-28', 'u2'), ...['u3', 'u4', 'u5'].flatMap((u) => ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map((d) => block('1007', d, u))), block('1007', '2026-11-04', 'u3')],
  names: new Map([
    ['u1', 'Jorge'],
    ['u2', 'Luis'],
    ['u3', 'Malachi'],
    ['u4', 'Sam'],
    ['u5', 'Dee'],
  ]),
  lifetimeHours: new Map([
    ['1007', 465],
    ['977', 120],
    ['878', 300],
  ]),
}
const input: BuildDeskInput = { openJobs, points, sessions, todayYmd: TODAY, reads, paces: { byPercentUsd: 32_700, byHoursUsd: 52_900 }, outPerWeekUsd: 52_900, weeks: 7.3 }
const desk = buildBuildDesk(input)
const row = (d: BuildDesk, id: string) => d.rows.find((r) => r.id === id)!

/** Every sentence a first-timer reads on the desk. The chips and the row heads are labels, not sentences. */
const sentences = (d: BuildDesk): string[] => [d.headline, d.verdict, d.subLine, ...d.tiles.map((t) => t.words), ...d.rows.map((r) => r.why), d.noPctLine, d.footnote].filter(Boolean)

describe('buildBuildDesk (v2.5929)', () => {
  it('counts a session the way the field pace does', () => {
    expect(countsForBuildDesk(sess('j', '2026-10-20', 4))).toBe(true)
    expect(countsForBuildDesk(sess('j', '2026-10-20', 4, 'u', { approved: false, pending: true }))).toBe(true)
    expect(countsForBuildDesk(sess('j', '2026-10-20', 4, 'u', { approved: false, pending: false }))).toBe(false)
    expect(countsForBuildDesk(sess('j', '2026-10-20', 4, 'u', { onBid: true }))).toBe(false)
    expect(countsForBuildDesk(sess('j', '2026-10-20', 4, 'u', { officeJob: true }))).toBe(false)
    expect(countsForBuildDesk(sess('j', '2026-10-20', 0))).toBe(false)
  })

  it('reads the window from the owner’s defaults', () => {
    expect(BUILD_DESK_DAYS).toBe(14)
    expect(BUILD_DESK_CREW_DAYS).toBe(7)
    expect(desk.windowStart).toBe('2026-10-13')
    expect(desk.days).toBe(14)
  })

  it('groups the seven jobs and orders them worst divergence first', () => {
    expect(desk.rows.map((r) => [r.id, r.group])).toEqual([
      ['1017', 'ate'],
      ['977', 'ate'],
      ['1086', 'ate'],
      ['878', 'stalled'],
      ['912', 'stalled'],
      ['1007', 'moved'],
      ['1081', 'finished'],
    ])
  })

  it('sums the hours, the movement and the idle money into the totals, the headline, the verdict and the tiles', () => {
    expect(desk.totals).toEqual({ hours: 161, movedUsd: 23_600, movedJobs: 2, ateHours: 65, ateJobs: 3, stalledUsd: 77_920, stalledJobs: 2, finishedJobs: 1, noPctJobs: 0 })
    expect(desk.headline).toBe('161h went in. $23.6k of work came out.')
    expect(desk.verdict).toBe('3 jobs ate 65 hours and moved nothing. 2 jobs hold $77.9k and saw nobody. That is the week.')
    expect(desk.tiles.map((t) => [t.head, t.value, t.tone])).toEqual([
      ['Moved', '$23.6k on 2 jobs', 'green'],
      ['Ate hours, moved nothing', '65h on 3 jobs', 'amber'],
      ['Stalled', '$77.9k, nobody on it', 'red'],
    ])
    expect(desk.tiles[2].words).toBe('2 jobs with no field hours in 14 days.')
    expect(desk.subLine).toBe('by hours the field builds $52.9k a week. By the percents $32.7k. These rows are where the missing $20.2k a week hides. 7.3 weeks to build what is already sold at that pace.')
    expect(desk.movedFold).toBeNull()
    expect(desk.noPctLine).toBe('')
  })

  it('reads the stale % row: the hours, the % age, the amber chip and the crew on the Schedule', () => {
    const r = row(desk, '977')
    expect(r.hours).toBe(22)
    expect(r.pctAgeDays).toBe(28)
    expect(r.movedUsd).toBe(0)
    expect(r.leftUsd).toBeCloseTo(39_050)
    expect(r.sub).toBe('$39k left of $71k · 45%')
    expect(r.hoursWords).toBe('22h')
    expect(r.pctWords).toBe('45 → 45')
    expect(r.chip).toEqual({ tone: 'amber', words: 'hours in, nothing moved' })
    expect(r.crew).toEqual({ tone: 'amber', words: 'Jorge · 3 crew-days · Tue to Thu' })
    expect(r.why).toBe('The % is 4 weeks old. 22h went on in the last 14 days. Either the crew built and nobody wrote it, or the hours vanished. One look at the job says which.')
    expect(r.doors).toEqual([{ label: 'Open the job', href: '/jobs?tab=stages&edit=977' }])
    expect(r.canSetPct).toBe(true)
    expect(r.modalJob).toEqual({ id: '977', hcpNumber: 'J977', jobName: 'Springtown', label: 'J977 · Springtown' })
  })

  it('reads a job with no price: hours earning zero, the crew-days onto it, the Price the job door, no Set the %', () => {
    const r = row(desk, '1017')
    expect(r.noPrice).toBe(true)
    expect(r.sub).toBe('no contract price')
    expect(r.pctWords).toBe('—')
    expect(r.movedWords).toBe('reads $0')
    expect(r.chip).toEqual({ tone: 'red', words: '31h earning zero' })
    expect(r.crew).toEqual({ tone: 'red', words: 'Luis · 2 crew-days · Tue to Wed' })
    expect(r.why).toBe('No price on the job. The 31 hours earned $0 on paper. 2 more crew-days are on the Schedule for it.')
    expect(r.doors.map((d) => d.label)).toEqual(['Price the job', 'Open the job'])
    expect(r.canSetPct).toBe(false)
    const quiet = row(desk, '1086')
    expect(quiet.crew).toBeNull()
    expect(quiet.why).toBe('No price on the job. The 12 hours earned $0 on paper.')
  })

  it('reads the stalled rows: quiet days, the biggest idle chip on the largest, Nobody scheduled, the Schedule door', () => {
    const r = row(desk, '878')
    expect(r.quietDays).toBe(19)
    expect(r.hoursWords).toBe('0h · 19 d quiet')
    expect(r.biggestIdle).toBe(true)
    expect(r.chip).toEqual({ tone: 'red', words: 'stalled · biggest money idle' })
    expect(r.crew).toEqual({ tone: 'red', words: 'Nobody scheduled, all week' })
    expect(r.why).toBe('$47.1k of sold work has had nobody on it for 19 days. The Schedule shows nobody this week either. Crew it, or name why it waits.')
    expect(r.doors.map((d) => [d.label, d.href])).toEqual([
      ['Open the Schedule', '/schedule-dispatch'],
      ['Open the job', '/jobs?tab=stages&edit=878'],
    ])
    const s = row(desk, '912')
    expect(s.quietDays).toBe(24)
    expect(s.biggestIdle).toBe(false)
    expect(s.chip.words).toBe('stalled')
  })

  it('reads the moving row: the dollars an hour, the green crew chip over the look-ahead only, the hours it expects', () => {
    const r = row(desk, '1007')
    expect(r.movedUsd).toBeCloseTo(20_400)
    expect(r.pctFrom).toBe(48)
    expect(r.chip).toEqual({ tone: 'green', words: 'moving · $249/h' })
    // The Nov 4 block sits past the seven days and does not count.
    expect(r.crew).toEqual({ tone: 'green', words: 'Malachi + 2 · 12 crew-days · Mon to Thu' })
    expect(r.expectedMoreHours).toBeCloseTo(310)
    expect(r.why).toBe('Hours and % agree. The job expects about 310 hours more. Leave it alone.')
  })

  it('reads the finished row as Bill’s, with its door, and counts its movement in Moved', () => {
    const r = row(desk, '1081')
    expect(r.group).toBe('finished')
    expect(r.movedUsd).toBeCloseTo(3_200)
    expect(r.chip).toEqual({ tone: 'green', words: 'finished' })
    expect(r.why).toBe('Finished. Done work is Bill’s row now.')
    expect(r.doors.map((d) => [d.label, d.href])).toEqual([
      ['Bill it', '/jobs?tab=billing'],
      ['Open the job', '/jobs?tab=stages&edit=1081'],
    ])
  })

  it('draws no crew chip and no expected hours before the reads land, and keeps the header', () => {
    const d = buildBuildDesk({ ...input, reads: null })
    expect(d.headline).toBe(desk.headline)
    expect(d.rows.every((r) => r.crew === null && r.expectedMoreHours === null)).toBe(true)
    expect(row(d, '878').why).toBe('$47.1k of sold work has had nobody on it for 19 days. Crew it, or name why it waits.')
    expect(row(d, '1007').why).toBe('Hours and % agree. Leave it alone.')
  })

  it('says what the Schedule shows on a stalled job with crew coming, and never guesses a number for a job with no hours at all', () => {
    const d = buildBuildDesk({ ...input, sessions: sessions.filter((s) => s.jobId !== '912'), reads: { ...reads, blocks: [...reads.blocks, block('878', '2026-10-28', 'u1'), block('878', '2026-10-28', 'u2')] } })
    expect(row(d, '878').crew).toEqual({ tone: 'amber', words: 'Jorge + 1 · 2 crew-days · Wed' })
    expect(row(d, '878').why).toBe('$47.1k of sold work has had nobody on it for 19 days. The Schedule puts Jorge and 1 more on it Wed. Watch the hours land.')
    expect(row(d, '912').quietAll).toBe(true)
    expect(row(d, '912').hoursWords).toBe('0h · no hours in 13 weeks')
    expect(row(d, '912').why).toBe('$30.8k of sold work has had no hours in 13 weeks. The Schedule shows nobody this week either. Crew it, or name why it waits.')
  })

  it('drops a verdict sentence about nothing, and folds the moved rows past the first three', () => {
    const moving = ['a', 'b', 'c', 'd', 'e'].map((id, i) => job(id, `Job ${id}`, 100_000, 20 + i))
    const d = buildBuildDesk({
      ...input,
      openJobs: moving,
      points: moving.map((j) => pt(j.id, '2026-09-01', 10)),
      sessions: moving.map((j) => sess(j.id, '2026-10-20', 10)),
      reads: null,
    })
    expect(d.verdict).toBe('Every job with hours moved. That is the week.')
    expect(d.rows.map((r) => r.id)).toEqual(['e', 'd', 'c', 'b', 'a'])
    expect(d.movedFold).toEqual({ count: 2, usd: 21_000, words: '2 more jobs moving, $21k' })
    const stalledOnly = buildBuildDesk({ ...input, openJobs: [job('x', 'X', 50_000, 40)], points: [pt('x', '2026-09-01', 40)], sessions: [sess('x', '2026-10-01', 5)], reads: null })
    expect(stalledOnly.verdict).toBe('1 job holds $30k and saw nobody. That is the week.')
    expect(stalledOnly.tiles[1].value).toBe('0h on 0 jobs')
  })

  it('reads a priced job with no %: hours but no movement, the no-% line, and a first % set inside the window', () => {
    const d = buildBuildDesk({
      ...input,
      openJobs: [job('n', 'No pct', 60_000, null), job('f', 'First pct', 80_000, 30), job('c', 'Created here', 40_000, 25, '2026-10-20')],
      points: [pt('f', '2026-10-23', 30), pt('c', '2026-10-24', 25)],
      sessions: [sess('n', '2026-10-20', 16), sess('f', '2026-10-21', 10), sess('c', '2026-10-24', 8)],
      reads: null,
      paces: null,
      outPerWeekUsd: 41_000,
      weeks: null,
    })
    expect(d.noPctLine).toBe('1 job has a contract and no %. It shows hours here but no movement until a % exists. Set the % and it joins the ledger.')
    expect(d.subLine).toBe('the field builds $41k a week.')
    const n = row(d, 'n')
    expect(n.group).toBe('ate')
    expect(n.sub).toBe('$60k contract · no %')
    expect(n.why).toBe('No % on the job. 16h went on and the desk cannot say what they built. Set the % so it can.')
    const f = row(d, 'f')
    expect(f.group).toBe('ate')
    expect(f.pctFirstInWindow).toBe(true)
    expect(f.why).toBe('The first % on the job was set 3 days ago. The desk has no earlier % to measure from. 10h went on in the last 14 days.')
    const c = row(d, 'c')
    expect(c.group).toBe('moved')
    expect(c.pctFrom).toBe(0)
    expect(c.movedUsd).toBe(10_000)
  })

  it('holds every sentence to the plain-words rule', () => {
    const variants = [
      desk,
      buildBuildDesk({ ...input, reads: null }),
      buildBuildDesk({ ...input, sessions: [], reads: { ...reads, blocks: [block('878', '2026-10-28', 'u1')] } }),
      buildBuildDesk({ ...input, openJobs: [job('n', 'No pct', 60_000, null), job('m', 'No pct two', 10_000, null)], points: [], sessions: [sess('n', '2026-10-20', 16)], paces: null, outPerWeekUsd: null, weeks: 101 }),
      buildBuildDesk({ ...input, openJobs: [job('s', 'Set here', 50_000, 20)], points: [pt('s', '2026-10-26', 20)], sessions: [] }),
    ]
    for (const d of variants) for (const s of sentences(d)) expect(plainWordsFailures(s), s).toEqual([])
  })
})

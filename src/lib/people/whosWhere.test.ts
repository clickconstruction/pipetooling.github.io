import { describe, expect, it } from 'vitest'
import {
  busiestMinute,
  dayHeadCounts,
  dayLanes,
  defaultMinute,
  presentAt,
  formatMinuteLabel,
  formatMinuteWindow,
  islandsAt,
  pgTimeMinutes,
  roleRing,
  scrubberDomain,
  scrubberTicks,
  sessionMinutes,
  trackPercent,
  wallClockMinutes,
  type WhosWhereData,
  type WwBlock,
  type WwPerson,
  type WwSession,
} from './whosWhere'

const DAY = '2026-09-16'
const MIKE: WwPerson = { id: 'u-mike', name: 'Mike Ramos', role: 'master_technician', needsSupervision: false }
const BRYAN: WwPerson = { id: 'u-bryan', name: 'Bryan Ortiz', role: 'helpers', needsSupervision: true }
const DEVON: WwPerson = { id: 'u-devon', name: 'Devon Pruitt', role: 'helpers', needsSupervision: true }
const JAKE: WwPerson = { id: 'u-jake', name: 'Jake Cole', role: 'subcontractor', needsSupervision: true }
const AUSTIN: WwPerson = { id: 'u-austin', name: 'Austin McCarty', role: 'helpers', needsSupervision: true }
const GRACE: WwPerson = { id: 'u-grace', name: 'Grace Hall', role: 'assistant', needsSupervision: false }
const WILL: WwPerson = { id: 'u-will', name: 'Will Moss', role: 'helpers', needsSupervision: true }

const OAK = 'job:oak'
const LAMAR = 'job:lamar'
const ELM = 'job:elm'
const OFFICE = 'job:office'

function session(id: string, userId: string, targetKey: string, startMin: number, endMin: number | null, workDate = DAY): WwSession {
  return { id, userId, workDate, startMin, endMin, targetKey }
}
function block(id: string, userId: string, targetKey: string, startMin: number, endMin: number, groupId: string | null = null, workDate = DAY): WwBlock {
  return { id, userId, workDate, startMin, endMin, targetKey, groupId }
}

function data(over: Partial<WhosWhereData> = {}): WhosWhereData {
  return {
    roster: [MIKE, BRYAN, DEVON, JAKE, AUSTIN, GRACE, WILL],
    targets: {
      [OAK]: { key: OAK, label: 'J258 · Oak St', detail: 'Ramirez', address: '1408 Oak St', isOffice: false },
      [LAMAR]: { key: LAMAR, label: 'J273 · Lamar', detail: null, address: null, isOffice: false },
      [ELM]: { key: ELM, label: 'J291 · Elm Ct', detail: null, address: null, isOffice: false },
      [OFFICE]: { key: OFFICE, label: 'Office', detail: null, address: null, isOffice: true },
    },
    sessions: [
      session('s1', BRYAN.id, OAK, 7 * 60 + 2, 15 * 60 + 20),
      session('s2', JAKE.id, LAMAR, 7 * 60 + 20, 14 * 60 + 50),
      session('s3', AUSTIN.id, ELM, 8 * 60 + 10, null), // still open
      session('s4', GRACE.id, OFFICE, 8 * 60, 17 * 60),
      session('s5', WILL.id, 'none', 9 * 60 + 40, 11 * 60),
    ],
    blocks: [
      block('b1', MIKE.id, OAK, 7 * 60, 15 * 60 + 30, 'g1'), // a master: listed, never clocks
      block('b2', BRYAN.id, OAK, 7 * 60, 15 * 60 + 30, 'g1'),
      block('b3', DEVON.id, OAK, 7 * 60, 15 * 60 + 30, 'g1'), // listed, never clocked
      block('b4', AUSTIN.id, OAK, 7 * 60, 12 * 60), // listed at Oak, clocked at Elm
    ],
    ...over,
  }
}

describe('time helpers', () => {
  it('reads the company wall clock, not UTC', () => {
    // 2026-09-16T12:02:00Z is 07:02 in Chicago (CDT, UTC−5)
    expect(wallClockMinutes('2026-09-16T12:02:00Z')).toBe(7 * 60 + 2)
  })
  it('keeps an open session open and clamps cross-midnight work to the day', () => {
    expect(sessionMinutes('2026-09-16T12:02:00Z', null)).toEqual({ startMin: 422, endMin: null })
    expect(sessionMinutes('2026-09-16T23:30:00Z', '2026-09-17T06:00:00Z')).toEqual({ startMin: 18 * 60 + 30, endMin: 1440 })
    expect(sessionMinutes('2026-09-16T12:02:00Z', '2026-09-16T11:00:00Z')?.endMin).toBeNull()
    expect(sessionMinutes('not a date', null)).toBeNull()
  })
  it('parses postgres time strings loosely', () => {
    expect(pgTimeMinutes('07:00:00')).toBe(420)
    expect(pgTimeMinutes('7:30')).toBe(450)
    expect(pgTimeMinutes('15:30:00.5')).toBe(930)
    expect(pgTimeMinutes('')).toBe(0)
    expect(pgTimeMinutes(null)).toBe(0)
  })
  it('labels minutes the way the team board labels hours', () => {
    expect(formatMinuteLabel(10 * 60 + 40)).toBe('10:40a')
    expect(formatMinuteLabel(15 * 60)).toBe('3p')
    expect(formatMinuteWindow(422, 920)).toBe('7:02a–3:20p')
    expect(formatMinuteWindow(422, null)).toBe('7:02a–')
  })
  it('rings by role, office roles together', () => {
    expect(roleRing('master_technician').label).toBe('master')
    expect(roleRing('subcontractor').label).toBe('sub')
    expect(roleRing('helpers').label).toBe('helper')
    expect(roleRing('assistant').label).toBe('office')
    expect(roleRing('dev').label).toBe('office')
    expect(roleRing(null).label).toBe('other')
  })
})

describe('islandsAt — the moment', () => {
  it('draws solid heads for sessions spanning the minute and hollow heads for blocks nobody clocked', () => {
    const m = islandsAt(data(), DAY, 10 * 60 + 40)
    const oak = m.islands.find((i) => i.target.key === OAK)!
    expect(oak.heads.map((h) => `${h.person.name}:${h.state}`)).toEqual(['Bryan Ortiz:in', 'Devon Pruitt:listed', 'Mike Ramos:listed'])
    // Bryan's head carries his clock-in minute; Devon's the block's start.
    expect(oak.heads[0]?.startMin).toBe(7 * 60 + 2)
    expect(oak.heads[1]?.startMin).toBe(7 * 60)
  })
  it('never draws a hollow head for someone clocked in elsewhere — it marks the solid head instead', () => {
    const m = islandsAt(data(), DAY, 10 * 60 + 40)
    const oak = m.islands.find((i) => i.target.key === OAK)!
    expect(oak.heads.some((h) => h.person.id === AUSTIN.id)).toBe(false)
    const elm = m.islands.find((i) => i.target.key === ELM)!
    expect(elm.heads).toHaveLength(1)
    expect(elm.heads[0]?.state).toBe('in')
    expect(elm.heads[0]?.endMin).toBeNull()
    expect(elm.heads[0]?.listedAt).toBe('J258 · Oak St')
  })
  it('puts a session with no job in the rail, the office island last, and counts who was not in at all', () => {
    const m = islandsAt(data(), DAY, 10 * 60 + 40)
    expect(m.noJob.map((h) => h.person.name)).toEqual(['Will Moss'])
    expect(m.islands[m.islands.length - 1]?.target.isOffice).toBe(true)
    expect(m.notIn).toEqual([])
    expect(m.present).toBe(7) // Bryan, Devon, Mike (Oak) · Jake · Austin · Grace · Will in the rail
  })
  it('an island only exists while someone is on it; before the day starts the roster is "not in"', () => {
    const early = islandsAt(data(), DAY, 6 * 60)
    expect(early.islands).toEqual([])
    expect(early.present).toBe(0)
    // Everyone had a session or block that day, so nobody is "not in" even at 6 am.
    expect(early.notIn).toEqual([])
    const otherDay = islandsAt(data(), '2026-09-17', 10 * 60)
    expect(otherDay.notIn.map((p) => p.name)).toEqual(['Austin McCarty', 'Bryan Ortiz', 'Devon Pruitt', 'Grace Hall', 'Jake Cole', 'Mike Ramos', 'Will Moss'])
  })
  it('marks coverage for the day on each island: a master listed covers it, helpers alone do not', () => {
    const m = islandsAt(data(), DAY, 10 * 60 + 40)
    expect(m.islands.find((i) => i.target.key === OAK)?.coverage).toBe('covered') // Mike listed
    expect(m.islands.find((i) => i.target.key === LAMAR)?.coverage).toBe('unsupervised') // Jake, a sub who needs supervision
    expect(m.islands.find((i) => i.target.key === ELM)?.coverage).toBe('unsupervised') // Austin alone
    expect(m.islands.find((i) => i.target.key === OFFICE)?.coverage).toBe('covered') // the office never needs it
    const jakeOff = data({ roster: data().roster.map((p) => (p.id === JAKE.id ? { ...p, needsSupervision: false } : p)) })
    expect(islandsAt(jakeOff, DAY, 10 * 60 + 40).islands.find((i) => i.target.key === LAMAR)?.coverage).toBe('covered')
  })
  it('orders islands by heads then label and heads by in-first then clock-in', () => {
    const m = islandsAt(data(), DAY, 10 * 60 + 40)
    expect(m.islands.map((i) => i.target.label)).toEqual(['J258 · Oak St', 'J273 · Lamar', 'J291 · Elm Ct', 'Office'])
  })
  it('a re-clock on the same job draws one head', () => {
    const d = data({ sessions: [session('s1', BRYAN.id, OAK, 7 * 60, null), session('s1b', BRYAN.id, OAK, 7 * 60 + 30, null)], blocks: [] })
    const m = islandsAt(d, DAY, 9 * 60)
    expect(m.islands[0]?.heads).toHaveLength(1)
  })
  it('an unknown job id still gets an island so nobody vanishes', () => {
    const d = data({ sessions: [session('s9', BRYAN.id, 'job:gone', 8 * 60, null)], blocks: [] })
    const m = islandsAt(d, DAY, 9 * 60)
    expect(m.islands[0]?.target.label).toBe('Unknown job')
  })
})

describe('dayLanes — the day', () => {
  it('bars sessions, hollow-bars unclocked blocks, and says where the plan and the clock disagreed', () => {
    const lanes = dayLanes(data(), DAY)
    const oak = lanes.find((l) => l.target.key === OAK)!
    const byName = Object.fromEntries(oak.bars.map((b) => [b.person.name, b]))
    expect(byName['Bryan Ortiz']).toMatchObject({ kind: 'in', startMin: 422, endMin: 920, note: null })
    expect(byName['Mike Ramos']).toMatchObject({ kind: 'listed', note: 'never clocked' })
    expect(byName['Devon Pruitt']).toMatchObject({ kind: 'listed', note: 'never clocked' })
    expect(byName['Austin McCarty']).toMatchObject({ kind: 'listed', note: 'clocked at J291 · Elm Ct' })
    const elm = lanes.find((l) => l.target.key === ELM)!
    expect(elm.bars[0]).toMatchObject({ kind: 'in', endMin: null, note: 'listed at J258 · Oak St' })
  })
  it('a block the person did clock draws no hollow bar', () => {
    const lanes = dayLanes(data(), DAY)
    const oak = lanes.find((l) => l.target.key === OAK)!
    expect(oak.bars.filter((b) => b.person.id === BRYAN.id)).toHaveLength(1)
  })
  it('orders lanes by activity with the office last', () => {
    expect(dayLanes(data(), DAY).map((l) => l.target.label)).toEqual(['J258 · Oak St', 'J273 · Lamar', 'J291 · Elm Ct', 'No job', 'Office'])
  })
})

describe('the strip and the scrubber', () => {
  it('counts distinct people per day from sessions and blocks', () => {
    const d = data({ sessions: [...data().sessions, session('x', BRYAN.id, OAK, 7 * 60, 15 * 60, '2026-09-17')] })
    expect(dayHeadCounts(d, [DAY, '2026-09-17', '2026-09-18'])).toEqual({ [DAY]: 7, '2026-09-17': 1, '2026-09-18': 0 })
  })
  it('defaults to 5 am – 7 pm and widens to whole hours around the day, an open session to midnight', () => {
    expect(scrubberDomain(data({ sessions: [], blocks: [] }), DAY)).toEqual({ startMin: 300, endMin: 1140 })
    expect(scrubberDomain(data(), DAY)).toEqual({ startMin: 300, endMin: 1440 })
    const early = data({ sessions: [session('e', BRYAN.id, OAK, 4 * 60 + 30, 12 * 60)], blocks: [] })
    expect(scrubberDomain(early, DAY)).toEqual({ startMin: 240, endMin: 1140 })
  })
  it('lands on now while someone is on a job, else on the busiest minute', () => {
    const d = data()
    // 10:40 today with people out: stay on now.
    expect(defaultMinute(d, DAY, 10 * 60 + 40)).toBe(10 * 60 + 40)
    // 8 pm today, everyone gone but Austin's open session: still someone → stay.
    expect(defaultMinute(d, DAY, 20 * 60)).toBe(20 * 60)
    // A day with only closed sessions, visited at 8 pm: the busiest quarter-hour instead.
    const closed = data({ sessions: d.sessions.map((s) => (s.endMin == null ? { ...s, endMin: 16 * 60 } : s)) })
    const landed = defaultMinute(closed, DAY, 20 * 60)
    expect(landed).toBeLessThan(16 * 60)
    expect(presentAt(closed, DAY, landed)).toBe(7)
    // Another day (no "now"): the busiest minute; an empty day: the domain start.
    expect(defaultMinute(closed, DAY, null)).toBe(landed)
    expect(defaultMinute(data({ sessions: [], blocks: [] }), DAY, null)).toBe(300)
    expect(busiestMinute(data({ sessions: [], blocks: [] }), DAY)).toBe(300)
  })
  it('ticks every two hours and places a minute on the track', () => {
    expect(scrubberTicks({ startMin: 300, endMin: 1140 })).toEqual([300, 420, 540, 660, 780, 900, 1020, 1140])
    expect(trackPercent(720, { startMin: 300, endMin: 1140 })).toBeCloseTo(50)
    expect(trackPercent(0, { startMin: 300, endMin: 1140 })).toBe(0)
    expect(trackPercent(2000, { startMin: 300, endMin: 1140 })).toBe(100)
  })
})

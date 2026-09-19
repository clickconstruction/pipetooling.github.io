import { describe, expect, it } from 'vitest'
import { crewSupervisors, derivedLead, weekCrews, type WhosWhereData, type WwBlock, type WwPerson, type WwSession } from './whosWhere'

const WEEK = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19']
const [SUN, MON, TUE, WED, THU, FRI] = WEEK as [string, string, string, string, string, string, string]

const MIKE: WwPerson = { id: 'u-mike', name: 'Mike Ramos', role: 'master_technician', needsSupervision: false }
const BRYAN: WwPerson = { id: 'u-bryan', name: 'Bryan Ortiz', role: 'helpers', needsSupervision: true }
const SAM: WwPerson = { id: 'u-sam', name: 'Sam Reyes', role: 'helpers', needsSupervision: true }
const DEVON: WwPerson = { id: 'u-devon', name: 'Devon Pruitt', role: 'helpers', needsSupervision: true }
const JAKE: WwPerson = { id: 'u-jake', name: 'Jake Cole', role: 'subcontractor', needsSupervision: true }
const TRE: WwPerson = { id: 'u-tre', name: 'Tre Walker', role: 'helpers', needsSupervision: true }
const KEVIN: WwPerson = { id: 'u-kevin', name: 'Kevin N', role: 'helpers', needsSupervision: true }
const RAY: WwPerson = { id: 'u-ray', name: 'Ray J', role: 'helpers', needsSupervision: true }
const GRACE: WwPerson = { id: 'u-grace', name: 'Grace Hall', role: 'assistant', needsSupervision: false }
const WILL: WwPerson = { id: 'u-will', name: 'Will Moss', role: 'helpers', needsSupervision: true }
const HECTOR: WwPerson = { id: 'u-hector', name: 'Hector V', role: 'subcontractor', needsSupervision: true }

const OAK = 'job:oak'
const ELM = 'job:elm'
const LAMAR = 'job:lamar'
const CEDAR = 'job:cedar'
const OFFICE = 'job:office'

const targets: WhosWhereData['targets'] = {
  [OAK]: { key: OAK, label: 'J258 · Oak St', detail: null, address: null, isOffice: false },
  [ELM]: { key: ELM, label: 'J291 · Elm Ct', detail: null, address: null, isOffice: false },
  [LAMAR]: { key: LAMAR, label: 'J273 · Lamar', detail: null, address: null, isOffice: false },
  [CEDAR]: { key: CEDAR, label: 'J300 · Cedar Park', detail: null, address: null, isOffice: false },
  [OFFICE]: { key: OFFICE, label: 'Office', detail: null, address: null, isOffice: true },
}

let n = 0
const s = (userId: string, target: string, day: string): WwSession => ({ id: `s${++n}`, userId, workDate: day, startMin: 420, endMin: 900, targetKey: target })
const b = (userId: string, target: string, day: string, groupId = 'g'): WwBlock => ({ id: `b${++n}`, userId, workDate: day, startMin: 420, endMin: 930, targetKey: target, groupId })

function week(): WhosWhereData {
  return {
    roster: [MIKE, BRYAN, SAM, DEVON, JAKE, TRE, KEVIN, RAY, GRACE, WILL, HECTOR],
    targets,
    blocks: [
      // Mike's crew: Oak Mon–Wed, Elm Thu–Fri. Mike is listed every day, never clocks.
      ...[MON, TUE, WED].flatMap((d) => [b(MIKE.id, OAK, d), b(BRYAN.id, OAK, d), b(SAM.id, OAK, d), b(DEVON.id, OAK, d)]),
      ...[THU, FRI].flatMap((d) => [b(MIKE.id, ELM, d), b(BRYAN.id, ELM, d)]),
      // Jake (a sub who clocks) at Lamar all week with Tre; Bryan joins once on Saturday? no — Friday he is with Mike; give Jake Bryan on Sunday.
      ...[MON, TUE, WED, THU, FRI].flatMap((d) => [b(JAKE.id, LAMAR, d), b(TRE.id, LAMAR, d)]),
      b(BRYAN.id, LAMAR, SUN),
      b(JAKE.id, LAMAR, SUN),
    ],
    sessions: [
      // Bryan clocks all four days with Mike; Sam three; Devon only Monday.
      ...[MON, TUE, WED].map((d) => s(BRYAN.id, OAK, d)),
      ...[THU, FRI].map((d) => s(BRYAN.id, ELM, d)),
      ...[MON, TUE, WED].map((d) => s(SAM.id, OAK, d)),
      s(DEVON.id, OAK, MON),
      // Jake clocks (a sub), Tre clocks; Bryan clocked Sunday with Jake.
      ...[MON, TUE, WED, THU, FRI].flatMap((d) => [s(JAKE.id, LAMAR, d), s(TRE.id, LAMAR, d)]),
      s(BRYAN.id, LAMAR, SUN),
      s(JAKE.id, LAMAR, SUN),
      // Kevin and Ray at Cedar Park two days with no master or sub: a lead-less crew.
      ...[TUE, WED].flatMap((d) => [s(KEVIN.id, CEDAR, d), s(RAY.id, CEDAR, d)]),
      // Grace in the office; Will alone at Cedar Park on Friday.
      ...[MON, TUE, WED, THU, FRI].map((d) => s(GRACE.id, OFFICE, d)),
      s(WILL.id, CEDAR, FRI),
    ],
  }
}

describe('crewSupervisors / derivedLead', () => {
  it('lists everyone who can run a job, masters first; the lead is the first of them', () => {
    const jakeOff = { ...JAKE, needsSupervision: false }
    const tristenOff = { ...TRE, needsSupervision: false }
    expect(crewSupervisors([BRYAN, jakeOff, MIKE, tristenOff]).map((p) => p.id)).toEqual([MIKE.id, jakeOff.id, tristenOff.id])
    expect(derivedLead([BRYAN, jakeOff, MIKE])?.id).toBe(MIKE.id)
    expect(derivedLead([BRYAN, jakeOff])?.id).toBe(jakeOff.id)
    // A sub who needs supervision is not a supervisor.
    expect(derivedLead([BRYAN, JAKE])).toBeNull()
    expect(derivedLead([BRYAN, SAM])).toBeNull()
    expect(derivedLead([])).toBeNull()
  })
})

describe('weekCrews', () => {
  it("forms a crew around each master or sub, with days together read from the clock and the plan", () => {
    const w = weekCrews(week(), WEEK)
    const mike = w.crews.find((c) => c.lead?.id === MIKE.id)!
    expect(mike.days).toBe(5)
    expect(mike.leadDaysListed).toBe(5)
    expect(mike.leadDaysClocked).toBe(0)
    expect(mike.members.map((m) => `${m.person.name.split(' ')[0]}:${m.daysClocked}/${m.daysListed}`)).toEqual(['Bryan:5/5', 'Sam:3/3', 'Devon:1/3'])
    expect(mike.jobs.map((j) => `${j.target.label} ×${j.days}`)).toEqual(['J258 · Oak St ×3', 'J291 · Elm Ct ×2'])
  })
  it('names the disagreement on the member: listed three, clocked one', () => {
    const w = weekCrews(week(), WEEK)
    const mike = w.crews.find((c) => c.lead?.id === MIKE.id)!
    const devon = mike.members.find((m) => m.person.id === DEVON.id)!
    expect(devon.daysMissed).toBe(2)
    expect(devon.note).toBe('listed 3 · clocked 1')
    const bryan = mike.members.find((m) => m.person.id === BRYAN.id)!
    expect(bryan.note).toBeNull()
  })
  it("a person can sit on two crews — Bryan is Mike's helper all week and Jake's on Sunday", () => {
    const w = weekCrews(week(), WEEK)
    const jake = w.crews.find((c) => c.lead?.id === JAKE.id)!
    expect(jake.days).toBe(6)
    expect(jake.leadDaysClocked).toBe(6)
    expect(jake.members.map((m) => `${m.person.name.split(' ')[0]}:${m.daysClocked}`)).toEqual(['Tre:5', 'Bryan:1'])
  })
  it('people who worked together with no master or sub form a lead-less crew, after the led ones', () => {
    const w = weekCrews(week(), WEEK)
    const last = w.crews[w.crews.length - 1]!
    expect(last.lead).toBeNull()
    expect(last.members.map((m) => m.person.name.split(' ')[0]).sort()).toEqual(['Kevin', 'Ray'])
    expect(last.days).toBe(2)
    expect(last.jobs[0]?.target.label).toBe('J300 · Cedar Park')
    expect(w.crews.map((c) => c.lead?.name ?? '—')).toEqual(['Jake Cole', 'Mike Ramos', '—'])
  })
  it('sorts the office, the alone and the not-in into the rail', () => {
    const w = weekCrews(week(), WEEK)
    expect(w.office.map((o) => `${o.person.name}:${o.days}`)).toEqual(['Grace Hall:5'])
    expect(w.alone.map((a) => `${a.person.name}:${a.days}`)).toEqual(['Will Moss:1'])
    expect(w.notIn.map((p) => p.name)).toEqual(['Hector V'])
    // Monday: Mike, Bryan, Sam, Devon at Oak; Jake, Tre at Lamar; Grace in the office.
    expect(w.headCounts[MON]).toBe(7)
    expect(w.headCounts['2026-09-19']).toBe(0)
  })
  it('a member listed with the crew but clocked on another job that day is counted as elsewhere', () => {
    const d = week()
    d.sessions.push(s(DEVON.id, LAMAR, TUE))
    const w = weekCrews(d, WEEK)
    const devon = w.crews.find((c) => c.lead?.id === MIKE.id)!.members.find((m) => m.person.id === DEVON.id)!
    expect(devon.daysElsewhere).toBe(1)
    expect(devon.note).toBe('listed 3 · clocked 1 · 1 day on another job')
  })
  it('a sub alone on a field job who also clocked the office is alone, not office', () => {
    const d = week()
    d.sessions.push(s(HECTOR.id, CEDAR, MON), s(HECTOR.id, OFFICE, TUE))
    const w = weekCrews(d, WEEK)
    expect(w.alone.some((a) => a.person.id === HECTOR.id)).toBe(true)
    expect(w.office.some((o) => o.person.id === HECTOR.id)).toBe(false)
    expect(w.notIn.some((p) => p.id === HECTOR.id)).toBe(false)
  })
  it('counts unsupervised job-days per day and per crew, and lists each crew\'s supervisors', () => {
    const w = weekCrews(week(), WEEK)
    const mike = w.crews.find((c) => c.lead?.id === MIKE.id)!
    expect(mike.supervisors.map((p) => p.id)).toEqual([MIKE.id])
    expect(mike.unsupervisedDays).toBe(0)
    // Jake is a sub who needs supervision: his whole week at Lamar is unsupervised.
    const jake = w.crews.find((c) => c.lead?.id === JAKE.id)!
    expect(jake.supervisors).toEqual([])
    expect(jake.unsupervisedDays).toBe(6)
    // Kevin + Ray at Cedar Park: two more; Will alone at Cedar Park Friday: one more.
    expect(w.unsupervisedByDay).toEqual({ [SUN]: 1, [MON]: 1, [TUE]: 2, [WED]: 2, [THU]: 1, [FRI]: 2, '2026-09-19': 0 })
    // Flip Jake's switch: his crew is covered and the counts fall.
    const d = week()
    d.roster = d.roster.map((p) => (p.id === JAKE.id ? { ...p, needsSupervision: false } : p))
    const w2 = weekCrews(d, WEEK)
    expect(w2.crews.find((c) => c.lead?.id === JAKE.id)!.supervisors.map((p) => p.id)).toEqual([JAKE.id])
    expect(w2.unsupervisedByDay[MON]).toBe(0)
    expect(w2.unsupervisedByDay[TUE]).toBe(1)
  })
  it('an empty week is all not-in', () => {
    const w = weekCrews({ ...week(), sessions: [], blocks: [] }, WEEK)
    expect(w.crews).toEqual([])
    expect(w.notIn).toHaveLength(11)
  })
})

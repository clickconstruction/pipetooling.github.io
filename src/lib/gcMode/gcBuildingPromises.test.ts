/**
 * GC mode — design spike: Building's kinds on the Board's promise record (gcBuildingPromises.ts,
 * question 8). On Fair Oaks D: Cool Breeze's controls drawings, Summit's pay application sent back,
 * Guadalupe's punch item, Pecan Valley's unconditional waiver on draw 1, a delivery, and a start
 * kept on the day of a daily log caught up late.
 */
import { describe, expect, it } from 'vitest'
import {
  gcReducer,
  initialGcState,
  papersOwed,
  papersOwedWords,
  partnerById,
  resendPayAppDraft,
  sentBackOpen,
  startsToPromise,
  tradePromiseRecord,
  tradePromisesOf,
  tradePromiseState,
  tradePromiseWords,
  type BuildingPromiseKind,
  type GcAction,
  type GcState,
} from './gcModel'

const P = 'fairoaksd'
const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === P)
  if (!p) throw new Error('no Fair Oaks D')
  return p
}
const pkgOf = (s: GcState, id: string) => {
  const k = fairOaks(s).packages.find((x) => x.id === id)
  if (!k) throw new Error(`no ${id}`)
  return k
}
const play = (s: GcState, ...actions: GcAction[]) => actions.reduce(gcReducer, s)
const promise = (partnerId: string, kind: BuildingPromiseKind, packageId: string, by: string, what?: string): GcAction => ({
  type: 'recordPromise',
  partnerId,
  kind,
  projectId: P,
  packageId,
  by,
  from: 'office',
  ...(what ? { what } : {}),
})
const only = (s: GcState) => {
  const list = tradePromisesOf(s)
  expect(list).toHaveLength(1)
  return list[0]!
}

describe("Building's promises (question 8)", () => {
  it('keeps their submittals once none waits on the trade', () => {
    let s = play(
      initialGcState(),
      { type: 'addSubmittal', projectId: P, packageId: 'fhvac', title: 'Duct smoke detectors', kind: 'product data', lineIds: [], leadDays: 7 },
      promise('coolbreeze', 'submittals', 'fhvac', '2026-10-06'),
    )
    expect(tradePromiseWords(only(s), s.today)).toBe('Promised their submittals by Tue Oct 6, in 4 days.')
    s = play(s, { type: 'tradeSendSubmittal', projectId: P, submittalId: 'fairoaksd-sub-4', file: 'CBM-controls.pdf', note: '' })
    expect(only(s).keptOn).toBeUndefined()
    s = play(s, { type: 'tradeSendSubmittal', projectId: P, submittalId: 'fairoaksd-sub-7', file: 'CBM-smoke.pdf', note: '' })
    expect(only(s).keptOn).toBe('2026-10-02')
    expect(tradePromiseState(only(s), s.today).state).toBe('kept')
  })

  it('keeps the fixed pay application when it is sent again', () => {
    let s = play(initialGcState(), promise('summit', 'payApp', 'froof', '2026-10-05'))
    const pkg = pkgOf(s, 'froof')
    const back = pkg.sow && sentBackOpen(pkg.sow)
    const partner = partnerById(s, 'summit')
    if (!pkg.sow || !back || !partner) throw new Error('no sent-back pay application')
    const { waiverSigned: _w, ...draft } = resendPayAppDraft(pkg.sow, partner, back)
    s = play(s, { type: 'tradeSendPayApp', projectId: P, packageId: 'froof', ...draft, periodTo: draft.periodTo || '2026-10-02' })
    expect(only(s).keptOn).toBe('2026-10-02')
  })

  it('keeps the punch items fixed once none is left to fix, not before', () => {
    let s = play(
      initialGcState(),
      { type: 'addPunchItem', projectId: P, packageId: 'fconc', text: 'Grind the trip edge at the east door' },
      promise('guadalupe', 'punch', 'fconc', '2026-10-05'),
      { type: 'tradeFixPunchItem', projectId: P, itemId: 'fairoaksd-punch-1' },
    )
    expect(only(s).keptOn).toBeUndefined()
    s = play(s, { type: 'tradeFixPunchItem', projectId: P, itemId: 'fairoaksd-punch-4' })
    expect(only(s).keptOn).toBe('2026-10-02')
  })

  it('keeps a start on the day the daily log has their crew, even a log caught up late', () => {
    let s = initialGcState()
    s = play(s, promise('coolbreeze', 'start', 'fhvac', '2026-09-30'))
    s = play(s, {
      type: 'saveDailyLog',
      projectId: P,
      log: { date: '2026-09-30', sky: 'clear', high: 88, low: 66, weatherStop: false, crews: [{ packageId: 'fhvac', workers: 3 }], done: 'Set the curbs.', delays: [], visitors: '' },
    })
    expect(only(s).keptOn).toBe('2026-09-30')
    expect(tradePromiseState(only(s), s.today).state).toBe('kept')
    expect(tradePromiseWords(only(s), s.today)).toBe('Kept their word: their crew on site came by Wed Sep 30.')
  })

  it('asks for a start day from a trade due on the job and not on it yet', () => {
    const s = initialGcState()
    expect(startsToPromise(fairOaks(s), s.today)).toEqual([])
    // Cool Breeze, before its crew first showed: its start (Sep 14) has passed.
    const before: GcState = {
      ...s,
      projects: s.projects.map((p) =>
        p.id !== P
          ? p
          : {
              ...p,
              dailyLogs: (p.dailyLogs ?? []).map((l) => ({ ...l, crews: l.crews.filter((c) => c.packageId !== 'fhvac') })),
              packages: p.packages.map((k) => (k.id === 'fhvac' && k.sow ? { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => ({ ...l, pctReported: 0 })) } } : k)),
            },
      ),
    }
    expect(startsToPromise(fairOaks(before), before.today).map((x) => [x.pkg.id, x.start, x.promisedBy])).toEqual([['fhvac', '2026-09-14', null]])
    const said = play(before, promise('coolbreeze', 'start', 'fhvac', '2026-10-05'))
    expect(startsToPromise(fairOaks(said), said.today, tradePromisesOf(said))[0]?.promisedBy).toBe('2026-10-05')
  })

  it('keeps closeout papers once no waiver or final pay application is owed', () => {
    let s = initialGcState()
    const owed = papersOwed(fairOaks(s), pkgOf(s, 'felec'), s.today)
    expect(papersOwedWords(owed)).toBe('the unconditional waiver on draw 1')
    s = play(s, promise('pecanvalley', 'closeout', 'felec', '2026-10-07', papersOwedWords(owed) ?? undefined))
    expect(tradePromiseWords(only(s), s.today)).toBe('Promised the unconditional waiver on draw 1 by Wed Oct 7, in 5 days.')
    s = play(s, { type: 'tradeSignUnconditional', projectId: P, packageId: 'felec', drawId: 'felec-draw-1' })
    expect(only(s).keptOn).toBe('2026-10-02')
    expect(papersOwedWords(papersOwed(fairOaks(s), pkgOf(s, 'felec'), s.today))).toBeNull()
  })

  it("a promise for the waivers alone is kept once they are in, though the final pay application is still owed", () => {
    // Cool Breeze on Stone Oak: its work is accepted and its final pay application can go. Say draw 2's waiver is still owed.
    const base = initialGcState()
    const s0: GcState = {
      ...base,
      projects: base.projects.map((p) =>
        p.id !== 'stoneoak'
          ? p
          : {
              ...p,
              packages: p.packages.map((k) =>
                k.id === 'shvac' && k.sow ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.number === 2 ? { ...d, waiver: 'conditional' as const } : d)) } } : k,
              ),
            },
      ),
    }
    const ask = (what: string): GcAction => ({ type: 'recordPromise', partnerId: 'coolbreeze', kind: 'closeout', projectId: 'stoneoak', packageId: 'shvac', by: '2026-10-09', from: 'office', what })
    const sign: GcAction = { type: 'tradeSignUnconditional', projectId: 'stoneoak', packageId: 'shvac', drawId: 'shvac-draw-2' }
    // The Board's ask for the waiver: kept by the signature.
    expect(only(play(s0, ask('the unconditional lien waiver on draw 2'), sign)).keptOn).toBe('2026-10-02')
    // Our ask for every paper: the final pay application is still owed, so it waits.
    expect(only(play(s0, ask('the final pay application and the unconditional waiver on draw 2'), sign)).keptOn).toBeUndefined()
  })

  it('a delivery is marked by hand, and every kind counts on the word record', () => {
    let s = play(initialGcState(), promise('pecanvalley', 'delivery', 'felec', '2026-10-01', 'the light poles'))
    // Recorded on Oct 2 for Oct 1: the day has passed.
    expect(tradePromiseWords(only(s), s.today)).toBe('Promised the light poles by Thu Oct 1. That was 1 day ago.')
    s = play(s, { type: 'keepPromise', id: only(s).id })
    expect(tradePromiseState(only(s), s.today)).toEqual({ state: 'late', days: 1 })
    const partner = partnerById(s, 'pecanvalley')
    if (!partner) throw new Error('no Pecan Valley')
    expect(tradePromiseRecord(s, partner)).toEqual({ made: 1, kept: 0 })
  })
})

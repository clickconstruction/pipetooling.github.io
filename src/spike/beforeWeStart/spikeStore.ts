/**
 * Before we start, the spike's store (punch list #382). One made-up site kept in this browser's own storage, so the
 * three seats (the office, the GC's page, the crew's phone) read and write the same stages and a press in one seat
 * shows in the others. Nothing here reads or writes the database. Every name, date and figure is made up.
 */
import { useCallback, useEffect, useState } from 'react'
import { addDays, bulletIsYes, openBullets, openOnThem, type Bullet, type Know, type Site, type Stage, type ThemBullet, type UsBullet } from '../../lib/startChecks/startChecks'

export type SpikeState = { today: string; site: Site; stages: Stage[]; me: string; log: string[] }

const them = (id: string, words: string, o: Partial<ThemBullet> = {}): ThemBullet => ({ id, on: 'them', words, wantsPhoto: false, eye: true, yes: null, asks: [], byDay: null, ...o })
const us = (id: string, words: string, reads: UsBullet['reads'], ok: boolean, fact: string, door: string): UsBullet => ({ id, on: 'us', words, eye: false, reads, ok, fact, door })
const stage = (id: string, part: string, name: string, window: [string, string], o: Partial<Stage> = {}): Stage => ({ id, part, job: 'J2101', name, window, trip: null, finished: false, theirDays: [], bullets: [], decision: null, arrival: null, ...o })

export function sampleState(): SpikeState {
  return {
    today: '2026-11-17',
    me: 'Dana',
    log: [],
    site: { name: 'Heron Point', customer: 'Northgate Builders', where: 'Marsh Road, Tidewater, NC', noticeDays: 10, contact: 'Ray', contactRole: 'the site super' },
    stages: [
      stage('s1', 'Lodge', 'Rough In', ['2026-03-09', '2026-03-20'], { finished: true }),
      stage('s2', 'Lodge', 'Top Out', ['2026-12-01', '2026-12-12'], {
        trip: ['2026-11-30', '2026-12-13'],
        theirDays: [
          { day: '2026-11-24', said: '2026-11-03', who: 'Ray', how: 'email' },
          { day: '2026-11-28', said: '2026-11-12', who: 'Ray', how: 'email' },
        ],
        bullets: [
          them('s2a', 'Framing is done and the roof is dried in.', { wantsPhoto: true, yes: { know: 'photo', who: 'Ray', how: 'on his page', day: '2026-11-12' } }),
          them('s2b', 'The framing inspection has passed.', { byDay: '2026-11-26', asks: [{ day: '2026-11-14', how: 'text' }] }),
          them('s2c', 'The other trades are out of the walls we work in.', { yes: { know: 'word', who: 'Ray', how: 'by phone', day: '2026-11-14' } }),
          them('s2d', 'Power is on for our tools.', { yes: { know: 'saw', who: 'Luis', how: 'on site', day: '2026-11-03' } }),
          us('s2e', 'Our material lands before day one.', 'order_log', true, 'Two lines land Nov 25, six days ahead', 'Open the order log'),
          us('s2f', 'The crew and the trip are set.', 'trip', true, 'Trip planned Nov 30 to Dec 13, Dana and Luis', 'Open the trip'),
        ],
      }),
      stage('s3', 'Site', 'Gas line tie-in', ['2026-12-08', '2026-12-09'], {
        job: 'J2102',
        theirDays: [{ day: '2026-12-05', said: '2026-11-10', who: 'Northgate office', how: 'text' }],
        decision: { kind: 'go', by: 'Dana', day: '2026-11-12', openThen: [] },
        bullets: [
          them('s3a', 'The gas company has set the meter.', { yes: { know: 'saw', who: 'Luis', how: 'on site', day: '2026-11-03' } }),
          them('s3b', 'The trench to the building is open.', { wantsPhoto: true, yes: { know: 'photo', who: 'Ray', how: 'on his page', day: '2026-11-10' } }),
          us('s3c', 'The permit is in hand.', 'permit', true, 'Issued Oct 30', 'Open the permit'),
        ],
      }),
      stage('s4', 'Bunkhouse', 'Underground', ['2026-12-08', '2026-12-12'], {
        theirDays: [
          { day: '2026-12-01', said: '2026-10-28', who: 'Ray', how: 'phone' },
          { day: '2026-12-12', said: '2026-11-16', who: 'Ray', how: 'phone' },
        ],
        bullets: [
          them('s4a', 'The pad is graded and the corners are staked.', { wantsPhoto: true, yes: { know: 'word', who: 'Ray', how: 'by phone', day: '2026-11-16' } }),
          them('s4b', 'The foundation plan we build from is the final one.', { asks: [{ day: '2026-11-16', how: 'phone' }] }),
          them('s4c', 'Forms are set where our pipe passes.', { wantsPhoto: true, asks: [{ day: '2026-11-16', how: 'phone' }] }),
          them('s4d', 'Water is on site.', { asks: [{ day: '2026-11-16', how: 'phone' }] }),
          them('s4e', 'The inspector can come within two days of our call.'),
          us('s4f', 'Our material lands before day one.', 'order_log', false, 'Three lines are not ordered. Order by Nov 24', 'Open the order log'),
        ],
      }),
      stage('s5', 'Bunkhouse', 'Rough In', ['2027-01-12', '2027-01-23'], {
        bullets: [
          them('s5a', 'The slab is poured and cured enough to walk.'),
          them('s5b', 'Framing is done where we run pipe.'),
          them('s5c', 'Power is on for our tools.'),
          us('s5d', 'Our material lands before day one.', 'order_log', false, 'Nothing ordered yet. Order by Dec 18', 'Open the order log'),
        ],
      }),
      stage('s6', 'Lodge', 'Trim Set', ['2027-02-08', '2027-02-12']),
    ],
  }
}

/** The starter list a stage with no list is offered. Never added without a press. */
export const STARTER: Array<{ words: string; on: 'them' | 'us'; wantsPhoto?: boolean }> = [
  { words: 'The rooms we work in are finished and clear.', on: 'them', wantsPhoto: true },
  { words: 'The other trades are out of our way.', on: 'them' },
  { words: 'Power and water are on.', on: 'them' },
  { words: 'Our material lands before day one.', on: 'us' },
]

const KEY = 'spike-before-we-start-v2'

function load(): SpikeState {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SpikeState
  } catch {
    /* a private window: the sample still works for the visit */
  }
  return sampleState()
}

const mapStage = (state: SpikeState, id: string, f: (s: Stage) => Stage): SpikeState => ({ ...state, stages: state.stages.map((s) => (s.id === id ? f(s) : s)) })
const mapBullet = (s: Stage, id: string, f: (b: Bullet) => Bullet): Stage => ({ ...s, bullets: s.bullets.map((b) => (b.id === id ? f(b) : b)) })
const note = (state: SpikeState, line: string): SpikeState => ({ ...state, log: [`${state.today} · ${line}`, ...state.log].slice(0, 40) })

export function useSpikeStore() {
  const [state, setState] = useState<SpikeState>(load)

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* nothing to keep */
    }
  }, [state])

  // The seats can be open in two tabs: a press in one shows in the other.
  useEffect(() => {
    const onStore = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setState(JSON.parse(e.newValue) as SpikeState)
    }
    window.addEventListener('storage', onStore)
    return () => window.removeEventListener('storage', onStore)
  }, [])

  const reset = useCallback(() => setState(sampleState()), [])
  const shiftToday = useCallback((n: number) => setState((st) => ({ ...st, today: addDays(st.today, n) })), [])

  /** A yes on a bullet on them: who said it, how we know. */
  const sayYes = useCallback((stageId: string, bulletId: string, know: Know, who: string, how: string) => {
    setState((st) => note(mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'them' ? { ...b, yes: { know, who, how, day: st.today } } : b))), `${who} · yes (${know}) on a bullet`))
  }, [])
  const takeBack = useCallback((stageId: string, bulletId: string) => {
    setState((st) => note(mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'them' ? { ...b, yes: null } : b))), 'a yes was taken back'))
  }, [])
  const toggleEye = useCallback((stageId: string, bulletId: string) => {
    setState((st) => mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => ({ ...b, eye: !b.eye }))))
  }, [])
  const togglePhoto = useCallback((stageId: string, bulletId: string) => {
    setState((st) => mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'them' ? { ...b, wantsPhoto: !b.wantsPhoto } : b))))
  }, [])
  /** In the app a bullet on us is read. In the spike its door pretends the thing was done. */
  const pretendOurs = useCallback((stageId: string, bulletId: string) => {
    setState((st) => mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'us' ? { ...b, ok: !b.ok, fact: b.ok ? 'Not ready (the spike’s pretend switch)' : 'Ready (the spike’s pretend switch)' } : b))))
  }, [])
  const addBullet = useCallback((stageId: string, words: string, on: 'them' | 'us', wantsPhoto = false) => {
    setState((st) => mapStage(st, stageId, (s) => ({ ...s, bullets: [...s.bullets, on === 'them' ? them(`${stageId}-${Date.now()}-${s.bullets.length}`, words, { wantsPhoto }) : us(`${stageId}-${Date.now()}-${s.bullets.length}`, words, 'hand', false, 'Ticked by hand', 'Mark it done')] })))
  }, [])
  const removeBullet = useCallback((stageId: string, bulletId: string) => {
    setState((st) => mapStage(st, stageId, (s) => ({ ...s, bullets: s.bullets.filter((b) => b.id !== bulletId) })))
  }, [])
  /** One ask covers every open bullet on them, on the stages named. */
  const markAsked = useCallback((stageIds: string[], how: string) => {
    setState((st) => note({ ...st, stages: st.stages.map((s) => (stageIds.includes(s.id) ? { ...s, bullets: s.bullets.map((b) => (b.on === 'them' && !bulletIsYes(b) ? { ...b, asks: [...b.asks, { day: st.today, how }] } : b)) } : s)) }, `asked ${st.site.contact} by ${how}`))
  }, [])
  const theyGaveADay = useCallback((stageId: string, day: string, who: string, how: string) => {
    setState((st) => note(mapStage(st, stageId, (s) => ({ ...s, theirDays: [...s.theirDays, { day, said: st.today, who, how }] })), `${who} gave a new day`))
  }, [])
  const moveWindow = useCallback((stageId: string, start: string) => {
    setState((st) => note(mapStage(st, stageId, (s) => {
      const len = Math.max(0, Math.round((new Date(`${s.window[1]}T12:00:00Z`).getTime() - new Date(`${s.window[0]}T12:00:00Z`).getTime()) / 864e5))
      return { ...s, window: [start, addDays(start, len)] as [string, string], trip: s.trip ? ([addDays(start, -1), addDays(start, len + 1)] as [string, string]) : null }
    }), 'our window moved'))
  }, [])
  const decide = useCallback((stageId: string, kind: 'go' | 'hold', newStart?: string) => {
    setState((st) => {
      let next = mapStage(st, stageId, (s) => ({ ...s, decision: { kind, by: st.me, day: st.today, openThen: openBullets(s).map((b) => b.words) } }))
      if (kind === 'hold' && newStart) {
        next = mapStage(next, stageId, (s) => {
          const len = Math.round((new Date(`${s.window[1]}T12:00:00Z`).getTime() - new Date(`${s.window[0]}T12:00:00Z`).getTime()) / 864e5)
          return { ...s, window: [newStart, addDays(newStart, len)] as [string, string], trip: s.trip ? ([addDays(newStart, -1), addDays(newStart, len + 1)] as [string, string]) : null }
        })
      }
      return note(next, `${st.me} pressed ${kind === 'go' ? 'Go' : 'Hold'}`)
    })
  }, [])
  const undoDecision = useCallback((stageId: string) => setState((st) => mapStage(st, stageId, (s) => ({ ...s, decision: null, arrival: null }))), [])
  /** The GC's own press: every open shared bullet named becomes a yes on their word, or with their photo. */
  const gcAnswers = useCallback((stageId: string, bulletIds: string[], withPhoto: boolean) => {
    setState((st) => note(mapStage(st, stageId, (s) => ({ ...s, bullets: s.bullets.map((b) => (b.on === 'them' && bulletIds.includes(b.id) ? { ...b, yes: { know: withPhoto ? ('photo' as Know) : ('word' as Know), who: st.site.contact, how: 'on his page', day: st.today } } : b)) })), `${st.site.contact} answered on his page`))
  }, [])
  /** The crew on arrival: the bullets named were not as told; every other bullet on them is now seen. */
  const crewArrives = useCallback((stageId: string, by: string, notAsTold: string[]) => {
    setState((st) => note(mapStage(st, stageId, (s) => ({
      ...s,
      arrival: { day: st.today, by, notAsTold },
      bullets: s.bullets.map((b) => (b.on !== 'them' ? b : notAsTold.includes(b.id) ? { ...b, yes: null } : { ...b, yes: { know: 'saw' as Know, who: by, how: 'on site', day: st.today } })),
    })), notAsTold.length ? `${by}: not as told` : `${by}: all as told`))
  }, [])
  const setWindowEnd = useCallback((stageId: string, end: string) => {
    setState((st) => note(mapStage(st, stageId, (s) => (end >= s.window[0] ? { ...s, window: [s.window[0], end] as [string, string] } : s)), 'our last day changed'))
  }, [])
  const setNotice = useCallback((days: number) => setState((st) => note({ ...st, site: { ...st.site, noticeDays: Math.max(0, Math.min(60, Math.round(days))) } }, 'the notice we need changed')), [])
  const setContact = useCallback((name: string) => setState((st) => (name.trim() ? { ...st, site: { ...st.site, contact: name.trim() } } : st)), [])
  /** Who said it, how, or the day, on a yes that stands. */
  const editYes = useCallback((stageId: string, bulletId: string, patch: Partial<{ who: string; how: string; day: string }>) => {
    setState((st) => mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'them' && b.yes ? { ...b, yes: { ...b.yes, ...patch } } : b))))
  }, [])
  const setByDay = useCallback((stageId: string, bulletId: string, day: string | null) => {
    setState((st) => mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => (b.on === 'them' ? { ...b, byDay: day } : b))))
  }, [])
  const setWords = useCallback((stageId: string, bulletId: string, words: string) => {
    setState((st) => (words.trim() ? mapStage(st, stageId, (s) => mapBullet(s, bulletId, (b) => ({ ...b, words: words.trim() }))) : st))
  }, [])
  const useStarter = useCallback((stageId: string) => {
    setState((st) => mapStage(st, stageId, (s) => ({ ...s, bullets: STARTER.map((b, i) => (b.on === 'them' ? them(`${stageId}-st${i}`, b.words, { wantsPhoto: !!b.wantsPhoto }) : us(`${stageId}-st${i}`, b.words, 'order_log', false, 'Nothing ordered yet', 'Open the order log'))) })))
  }, [])

  return { state, reset, shiftToday, sayYes, takeBack, toggleEye, togglePhoto, pretendOurs, addBullet, removeBullet, markAsked, theyGaveADay, moveWindow, decide, undoDecision, gcAnswers, crewArrives, useStarter, setNotice, setContact, editYes, setByDay, setWords, setWindowEnd }
}

export type SpikeStore = ReturnType<typeof useSpikeStore>
export { openOnThem }

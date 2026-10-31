/**
 * The stage: where a bid stands with the robots, in seven stops (punch list #221, PR 2). One pure shape for
 * the Counts head's inline pill, the Robot status sheet's strip and anything else that draws it, fed from the
 * `robot_progress()` row (its fixture columns since v2.6180) and the bid's sent date. The ring on the icon
 * keeps its own seven segments (`robotProgress.ts`): those are the robot's run; these stops are the bid's
 * standing, her steps included.
 *
 * Fixtures open once the run is sealed (the owner's pick, 2026-10-30: that way the bid is complete and every
 * error has been checked), the same gate the Plans panel's *Ask the robot to look* uses.
 */
import { relativeTimeFrom } from '../twinConsoleDisplay'
import type { RobotProgressRow } from './robotProgress'

export const ROBOT_STAGE_STOPS = ['plans', 'read', 'fixtures', 'checked', 'sealed', 'sent', 'scored'] as const
export type RobotStageStopKey = (typeof ROBOT_STAGE_STOPS)[number]

export const ROBOT_STAGE_WORDS: Record<RobotStageStopKey, string> = {
  plans: 'Plans filed',
  read: 'Robot read the set',
  fixtures: 'Fixtures ready',
  checked: 'Checked',
  sealed: 'Sealed',
  sent: 'Sent',
  scored: 'Scored',
}

/** The `robot_progress()` row with the fixture columns of v2.6180; absent on a row read by an older client. */
export type RobotStageRow = RobotProgressRow & {
  fixtures_at?: string | null
  fixtures_found?: number | string | null
  fixtures_sure?: number | string | null
  fixtures_taken?: number | string | null
  fixtures_set_aside?: number | string | null
  assisted_at?: string | null
}

export type RobotStageStopState = 'done' | 'now' | 'todo'

export type RobotStageStop = {
  key: RobotStageStopKey
  label: string
  state: RobotStageStopState
  at: string | null
  /** The stop's small print: *23 found*, *21 sure*, *Thu 2:41 PM*. */
  detail: string | null
}

export type RobotStage = {
  stops: RobotStageStop[]
  /** The lit stop, or null when every stop is done. */
  lit: RobotStageStopKey | null
  done: number
  /** The lit stop's plain sentence or two. */
  sentence: string
  /** The inline pill's text: *Robot · fixtures ready · 23*. */
  inline: string
  fixturesOpen: boolean
  fixturesFound: number
  fixturesSure: number
  fixturesTaken: number
  fixturesSetAside: number
  assisted: boolean
  sealed: boolean
  sent: boolean
  scored: boolean
  void: boolean
}

function n(v: number | string | null | undefined): number {
  const x = v == null ? 0 : Number(v)
  return Number.isFinite(x) ? x : 0
}

function later(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

export type RobotStageOptions = {
  /** The need's words when the run cannot go on (`robotRowState`), shown on the lit stop. */
  blockedWords?: string | null
  /** A time in the company's words, *Thu 2:41 PM*; the stop's small print. Absent, the stop prints no time. */
  fmtWhen?: (iso: string) => string
}

export function buildRobotStage(row: RobotStageRow, bid: { bid_date_sent: string | null | undefined }, nowMs: number, opts: RobotStageOptions = {}): RobotStage {
  const isVoid = row.run_status === 'void'
  const sealed = !!row.locked_at
  const found = n(row.fixtures_found)
  const sure = n(row.fixtures_sure)
  const taken = n(row.fixtures_taken)
  const setAside = n(row.fixtures_set_aside)
  const hasPull = !!row.fixtures_at
  const fixturesOpen = hasPull && sealed
  const sent = !!bid.bid_date_sent
  const scored = !!row.scored_at
  const assisted = !!row.assisted_at
  const when = (iso: string | null | undefined): string | null => (iso && opts.fmtWhen ? opts.fmtWhen(iso) : null)

  const doneAt: Record<RobotStageStopKey, string | null> = {
    plans: row.plans_filed ? row.claimed_at : null,
    read: row.read_at ?? null,
    fixtures: fixturesOpen ? later(row.fixtures_at, row.locked_at) : null,
    checked: fixturesOpen ? later(row.fixtures_at, row.locked_at) : null,
    sealed: row.locked_at ?? null,
    sent: sent ? (bid.bid_date_sent as string) : null,
    scored: row.scored_at ?? null,
  }
  const details: Record<RobotStageStopKey, string | null> = {
    plans: when(row.claimed_at),
    read: when(row.read_at),
    fixtures: hasPull ? `${found} found` : null,
    checked: hasPull ? (found - sure > 0 ? `${found - sure} to look at` : `${sure} sure`) : null,
    sealed: when(row.locked_at),
    sent: when(bid.bid_date_sent),
    scored: when(row.scored_at),
  }
  let lit: RobotStageStopKey | null = null
  for (const key of ROBOT_STAGE_STOPS) {
    if (!doneAt[key]) { lit = key; break }
  }
  const stops: RobotStageStop[] = ROBOT_STAGE_STOPS.map((key) => ({
    key,
    label: ROBOT_STAGE_WORDS[key],
    state: doneAt[key] ? 'done' : key === lit ? 'now' : 'todo',
    at: doneAt[key],
    detail: details[key],
  }))
  const done = stops.filter((s) => s.state === 'done').length

  const lastWord = row.heartbeat_at ? `Last word ${relativeTimeFrom(row.heartbeat_at, nowMs)}.` : null
  let sentence: string
  let inlineWords: string
  if (isVoid) {
    sentence = 'Set aside. The robot leaves this bid to you.'
    inlineWords = 'set aside'
  } else if (lit === 'plans') {
    sentence = opts.blockedWords ?? 'The robot is waiting for the plans.'
    inlineWords = 'waiting for plans'
  } else if (lit === 'read') {
    sentence = opts.blockedWords ?? ['The robot is reading the set.', lastWord].filter(Boolean).join(' ')
    inlineWords = 'reading the set'
  } else if (lit === 'fixtures' || lit === 'checked') {
    if (sealed) {
      sentence = 'The robot sealed its number before it could write its fixtures down. The Plans panel still has its schedules.'
      inlineWords = 'sealed, no fixtures list'
    } else {
      sentence = ['The robot is counting. Its fixtures open when it seals its number, usually within the hour.', lastWord].filter(Boolean).join(' ')
      inlineWords = 'counting'
    }
  } else if (lit === 'sealed') {
    sentence = ['The robot is pricing its count. Its fixtures open when it seals its number.', lastWord].filter(Boolean).join(' ')
    inlineWords = 'pricing'
  } else if (lit === 'sent') {
    if (taken > 0) {
      const parts = [`You took ${taken} of the robot’s ${found} fixtures.`]
      if (setAside > 0) parts.push(setAside === 1 ? '1 is set aside.' : `${setAside} are set aside.`)
      parts.push('Its number shows when you send.')
      sentence = parts.join(' ')
      inlineWords = `${taken} of ${found} fixtures on your count`
    } else {
      sentence = `The robot’s fixtures are ready. ${found} found, ${sure} sure. You can add the ones you want to your count.`
      inlineWords = `fixtures ready · ${found}`
    }
  } else if (lit === 'scored') {
    sentence = 'Sent. The score lands the moment a bid value is on record.'
    inlineWords = 'sent, score pending'
  } else {
    sentence = assisted ? 'Scored. You took robot fixtures on this bid, so its run sits beside the practice runs.' : 'Scored.'
    inlineWords = assisted ? 'scored · assisted' : 'scored'
  }

  return {
    stops,
    lit: isVoid ? null : lit,
    done,
    sentence,
    inline: `Robot · ${inlineWords}`,
    fixturesOpen,
    fixturesFound: found,
    fixturesSure: sure,
    fixturesTaken: taken,
    fixturesSetAside: setAside,
    assisted,
    sealed,
    sent,
    scored,
    void: isVoid,
  }
}

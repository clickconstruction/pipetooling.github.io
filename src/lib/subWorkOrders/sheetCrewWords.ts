/**
 * Where a second sheet for the same work would start, and what to say there (punch list #346, PR 2).
 *
 * Three places a person decides who a sheet is for or what is on it: the sheet form's Crew step, the form's lines,
 * and the band on People → Subs. Each used to stay quiet or call the sheet broken. These are their words, and the
 * plan the band's window shows before anything is saved.
 *
 * Pure: no React, no Supabase.
 */
import type { LaborJob } from '../../types/laborJob'
import { lineLaborCost } from '../peopleLaborJobItemLineCost'
import { sheetParties, type SheetPartiesLookup } from './sheetParties'
import { sheetOwedTo, TEAM_SHEET_RULE, type TeamSheetRule } from './teamSheetRule'

const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const list = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

export type CrewStepLine = {
  tone: 'warn' | 'info'
  head: string
  body: string
  /** Subs past the first, each offered a sheet of their own. */
  extraSubs: string[]
  /** Teammates named on a sub's sheet and not paid from it: offered one press that takes them off. */
  rideAlongs: string[]
}

/**
 * Taunya, 2026-11-15: "people being on jobs flooding subs may be the root of the issue". Picking a job in
 * the sheet form used to tick every person on that job's team as crew, which is how a superintendent and a master
 * technician came to be named on a sub's sheet. False: the job's team is offered under the chips and nobody is
 * ticked. True is the old fill.
 */
export const SHEET_PRETICKS_JOB_TEAM = false

/**
 * Taunya, 2026-11-15: "No, one person", then "Only one name". The sheet form's people step is one pick:
 * ticking a name takes the place of the one ticked before, and the step is called *Paid to*. False is the old step:
 * any number of names, called *Crew*. A sheet saved earlier with several names keeps them until someone takes them
 * off: the form never drops a name by itself and never refuses a save for it.
 */
export const SHEET_ONE_NAME = true

/** What the people step is called: on the wizard's steps, its Next press and its label. */
export function crewStepTitle(oneName: boolean = SHEET_ONE_NAME): string {
  return oneName ? 'Paid to' : 'Crew'
}

/** The names after a chip is pressed. A ticked name comes off. An unticked one is added, or under one name takes the others' place. */
export function nextCrewPick(picked: readonly string[], name: string, oneName: boolean = SHEET_ONE_NAME): string[] {
  const n = name.trim()
  if (!n) return [...picked]
  if (picked.includes(n)) return picked.filter((x) => x !== n)
  return oneName ? [n] : [...picked, n]
}

/** The line that offers a picked job's team, for the names not ticked yet. '' when there is nobody to offer, and under one name once someone is ticked. */
export function jobTeamOfferWords(team: readonly string[], picked: readonly string[], oneName: boolean = SHEET_ONE_NAME): { words: string; offer: string[] } {
  const on = new Set(picked.map((n) => n.trim()).filter(Boolean))
  const offer = [...new Set(team.map((n) => n.trim()).filter(Boolean))].filter((n) => !on.has(n))
  if (offer.length === 0 || (oneName && on.size > 0)) return { words: '', offer: [] }
  return { words: on.size === 0 ? "On this job's team. Tick the one person this sheet pays." : "Also on this job's team, not on this sheet.", offer }
}

/** What the Crew step says about the names picked. Null when nobody is picked. */
export function crewStepLine(names: readonly string[], lookup: SheetPartiesLookup, rule: TeamSheetRule = TEAM_SHEET_RULE): CrewStepLine | null {
  const picked = names.map((n) => n.trim()).filter(Boolean)
  if (picked.length === 0) return null
  const parties = sheetParties({ assigned_to_name: picked.join(' | ') }, undefined, lookup)
  const to = sheetOwedTo(parties, rule)
  const subs = parties.crew ? [] : parties.contractors.map((p) => p.name)
  const mates = (parties.crew ? parties.contractors : parties.teammates).map((p) => p.name)
  if (subs.length >= 2) {
    return {
      tone: 'warn',
      head: `${subs.length === 2 ? 'Two' : subs.length} subs on one sheet.`,
      body: "A sheet is owed to one sub. With more than one, its money is on nobody's Balance due until someone says whose it is. Teammates can be named on either sheet.",
      extraSubs: subs.slice(1),
      rideAlongs: [],
    }
  }
  if (subs.length === 1) {
    return mates.length > 0
      ? // Taunya, 2026-11-15, asked whether a sheet should ever name more than the one person it pays: "No, one person".
        // So a teammate beside the sub is a warning with a press, as a second sub is. It still never blocks the save.
        { tone: 'warn', head: `This is ${subs[0]}'s sheet.`, body: `${list(mates)} ${mates.length === 1 ? 'is' : 'are'} named on it and not paid from it. A sheet names only the one person it pays. To pay a teammate, give them a sheet of their own.`, extraSubs: [], rideAlongs: mates }
      : { tone: 'info', head: `This is ${subs[0]}'s sheet.`, body: 'The whole sheet is owed to them, once.', extraSubs: [], rideAlongs: [] }
  }
  if (to.kind === 'team') return { tone: 'info', head: `No sub on this sheet. It is owed to ${mates[0]} as sub labor.`, body: 'Use it for pay on top of their wages, such as a bonus. It is paid from Jobs → Subs → Pay, like any sheet.', extraSubs: [], rideAlongs: [] }
  if (rule === 'owed') return { tone: 'warn', head: `${mates.length} teammates and no sub.`, body: "A sheet is owed to one person. With several, its money is on nobody's row. Make a sheet for each teammate.", extraSubs: [], rideAlongs: [] }
  return { tone: 'info', head: 'No sub on this sheet.', body: `It names ${list(mates)} and is owed to nobody. Its money is in no Balance due.`, extraSubs: [], rideAlongs: [] }
}

export type SameLineWarning = { label: string; amount: number; sheetIds: string[]; words: string }

/** A line being typed that another sheet on the same job already carries, words and amount alike. */
export function sameLinesOnOtherSheets(draft: ReadonlyArray<{ label: string; amount: number }>, others: ReadonlyArray<Pick<LaborJob, 'id' | 'items' | 'labor_rate'>>): SameLineWarning[] {
  const out: SameLineWarning[] = []
  const seen = new Set<string>()
  for (const d of draft) {
    const label = d.label.trim()
    const amount = Math.round(d.amount * 100) / 100
    if (!label || amount <= 0) continue
    const key = `${label.toLowerCase()}\u0000${amount.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    const hits = others.filter((o) => (o.items ?? []).some((it) => (it.fixture ?? '').trim().toLowerCase() === label.toLowerCase() && Math.abs(Math.round(lineLaborCost(it, o.labor_rate ?? 0) * 100) / 100 - amount) < 0.005)).map((o) => o.id)
    if (hits.length > 0) out.push({ label, amount, sheetIds: hits, words: `${label} · ${money(amount)} is already on ${hits.length === 1 ? 'another sheet' : `${hits.length} other sheets`} for this job. Check that one piece of work is not entered twice.` })
  }
  return out
}

// ── The band's window: Whose is it… ──────────────────────────────────────────────────────────────────────────

export type WhoseSheetChoice = { kind: 'one'; personId: string; name: string } | { kind: 'leave' } | { kind: 'split' }

export type WhoseSheetPlan = {
  /** What each person's Balance due gains, before anything is saved. */
  adds: Array<{ name: string; amount: number }>
  /** The parts are the sheets' open money: nothing is added twice and nothing goes missing. */
  sumsToOpen: boolean
  words: string
  /** The names that come off the sheet. */
  removes: string[]
  /** The press, with its count: dead for `leave`, and for `split` until the owner's call 1 is answered. */
  confirmLabel: string | null
}

/**
 * What a choice does to each person's balance. `names` are the people written on the sheet; `open` the sheets'
 * open money; `sheetCount` how many sheets the band's row holds.
 */
export function whoseSheetPlan(names: readonly string[], open: number, sheetCount: number, choice: WhoseSheetChoice): WhoseSheetPlan {
  const sheets = `${sheetCount} ${sheetCount === 1 ? 'sheet' : 'sheets'}`
  if (choice.kind === 'leave') {
    return { adds: [], sumsToOpen: true, words: `Nothing changes. ${money(open)} stays on nobody's row and keeps its line here.`, removes: [], confirmLabel: null }
  }
  if (choice.kind === 'split') {
    return { adds: [], sumsToOpen: true, words: 'Each line goes to the sub who did it, and the sheet becomes one per sub. Not built: it waits on how two subs split a sheet.', removes: [], confirmLabel: null }
  }
  const removes = names.filter((n) => n.trim() && n.trim().toLowerCase() !== choice.name.trim().toLowerCase())
  const adds = [{ name: choice.name, amount: Math.round(open * 100) / 100 }, ...removes.map((n) => ({ name: n, amount: 0 }))]
  return {
    adds,
    sumsToOpen: Math.abs(adds.reduce((n, a) => n + a.amount, 0) - open) < 0.005,
    words: `${choice.name}'s Balance due gains ${money(open)}.${removes.length > 0 ? ` ${list(removes)} ${removes.length === 1 ? 'comes' : 'come'} off the ${sheetCount === 1 ? 'sheet' : 'sheets'} and ${removes.length === 1 ? 'gains' : 'gain'} nothing.` : ''}`,
    removes,
    confirmLabel: `Make ${sheets} ${choice.name}'s`,
  }
}

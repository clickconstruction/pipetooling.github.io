import { NEEDS_YOU_RANK, type NeedsYouItem, type NeedsYouSeverity } from '../dashboardNeedsYou'
import { needsYouWalkOrder } from '../dashboard/phoneOffice'
import { needsYouActorOf, needsYouViewerActors } from '../needsYouActor'
import type { UserRole } from '../../hooks/useAuth'

/**
 * Fill them in (v2.5774, punch list #146, PR 2): the third view on Quickfill's Needs you
 * station. Where Cards lists the lines and Walk the list walks them, this view walks the ROWS
 * behind the lines an assistant clears with a few fields, one row at a time: the row's
 * sentence, what the app already knows, the fields its kind needs, Save and next, Skip, a
 * trail of what was saved with Undo, and a done count. One shell, a kernel per kind. This
 * file is the shell's kernel: the kinds, the order, the words. Pure.
 */
export type FillInKind = 'lost-bid' | 'vehicle' | 'job-account' | 'contract' | 'contract-missing'

/** The line each kind's rows sit behind: the deck orders kinds by that line's rank, and the line's button opens the deck on that kind. */
export const FILL_IN_KIND_ITEM: Record<FillInKind, NeedsYouItem['key']> = {
  'lost-bid': 'lost-bids',
  vehicle: 'vehicle-records-missing',
  'job-account': 'job-account-missing',
  contract: 'contract-stale',
  'contract-missing': 'contract-missing',
}

/** The kinds the deck handles today; a kind is added here the PR its fields ship. */
export const FILL_IN_KINDS_BUILT: readonly FillInKind[] = ['lost-bid', 'vehicle', 'job-account', 'contract', 'contract-missing']

export function fillInKindOfItem(key: NeedsYouItem['key']): FillInKind | null {
  for (const kind of FILL_IN_KINDS_BUILT) if (FILL_IN_KIND_ITEM[kind] === key) return kind
  return null
}

export const FILL_IN_KIND_WORDS: Record<FillInKind, { kicker: string; one: string; many: string; saved: (n: number) => string }> = {
  'lost-bid': { kicker: 'Win/loss hygiene · lost bid, no reason', one: 'lost bid', many: 'lost bids', saved: (n) => (n === 1 ? '1 lost bid has a reason.' : `${n} lost bids have a reason.`) },
  vehicle: { kicker: 'Vehicles · record missing', one: 'vehicle', many: 'vehicles', saved: (n) => (n === 1 ? '1 truck has a record.' : `${n} trucks have a record.`) },
  'job-account': { kicker: 'Job accounts · bought, no account', one: 'job account', many: 'job accounts', saved: (n) => (n === 1 ? '1 job account is settled.' : `${n} job accounts are settled.`) },
  contract: { kicker: 'Contracts · out for signature', one: 'contract', many: 'contracts', saved: (n) => (n === 1 ? '1 contract was chased or filed.' : `${n} contracts were chased or filed.`) },
  'contract-missing': { kicker: 'Contracts · live job, no contract on file', one: 'job', many: 'jobs', saved: (n) => (n === 1 ? '1 job has its contract answer.' : `${n} jobs have their contract answer.`) },
}

/** What every row carries, whatever its kind; the kind's own fields ride beside these. */
export type FillInRowBase = {
  /** Stable across reloads: `<kind>:<record id>`. */
  key: string
  kind: FillInKind
  severity: NeedsYouSeverity
  title: string
  /** What the app already knows about the row, one short sentence each. */
  knows: string[]
  /** The record's own page, for the cases the fields do not cover. */
  doorHref: string
  doorLabel: string
}

export function fillInRowKey(kind: FillInKind, id: string): string {
  return `${kind}:${id}`
}

/** Kinds worst first by their line's rank, then each kind's rows in the order its kernel gave. */
export function fillInRowsOrdered<T extends FillInRowBase>(rowsByKind: Partial<Record<FillInKind, readonly T[]>>): T[] {
  const kinds = (Object.keys(rowsByKind) as FillInKind[]).sort((a, b) => NEEDS_YOU_RANK[FILL_IN_KIND_ITEM[a]] - NEEDS_YOU_RANK[FILL_IN_KIND_ITEM[b]])
  return kinds.flatMap((k) => [...(rowsByKind[k] ?? [])])
}

/** The deck's order: the rows as given, the skipped ones at the back in the order they were skipped. */
export function fillInOrder<T extends { key: string }>(rows: readonly T[], skippedKeys: readonly string[]): T[] {
  return needsYouWalkOrder(rows, skippedKeys)
}

/** The row the deck opens on: the first of `startKind` when asked and present, else the first. */
export function fillInStartIndex<T extends { kind: FillInKind }>(rows: readonly T[], startKind: FillInKind | null | undefined): number {
  if (!startKind) return 0
  const i = rows.findIndex((r) => r.kind === startKind)
  return i < 0 ? 0 : i
}

/** "3 of 12 · 2 saved" — the position among every row this visit opened with, the saved count after the dot. */
export function fillInProgressWords(position: number, total: number, saved: number): string {
  return `${position} of ${total}${saved > 0 ? ` · ${saved} saved` : ''}`
}

/** "1 of 6 lost bids" — the row's place among its kind. */
export function fillInKindPositionWords(kind: FillInKind, position: number, ofKind: number): string {
  const w = FILL_IN_KIND_WORDS[kind]
  return `${position} of ${ofKind} ${ofKind === 1 ? w.one : w.many}`
}

export type FillInDoneWords = { title: string; lines: string[] }

/** The end of the deck: what was saved by kind, what was skipped, where the skipped rows wait. */
export function fillInDoneWords(savedByKind: Partial<Record<FillInKind, number>>, skipped: number): FillInDoneWords {
  const saved = Object.values(savedByKind).reduce((a, b) => a + (b ?? 0), 0)
  const title = saved === 0 && skipped === 0 ? 'Nothing left to fill in.' : `That is every row. ${saved} saved${skipped > 0 ? `, ${skipped} skipped` : ''}.`
  const lines: string[] = []
  const kinds = (Object.keys(savedByKind) as FillInKind[]).filter((k) => (savedByKind[k] ?? 0) > 0)
  if (kinds.length) lines.push(kinds.map((k) => FILL_IN_KIND_WORDS[k].saved(savedByKind[k]!)).join(' '))
  if (skipped > 0) lines.push(skipped === 1 ? 'The one you skipped is still on the Dashboard and here tomorrow.' : `The ${skipped} you skipped are still on the Dashboard and here tomorrow.`)
  return { title, lines }
}

export type FillInHandledHow = 'saved' | 'skipped'

export type FillInHandled<T extends FillInRowBase = FillInRowBase> = {
  row: T
  how: FillInHandledHow
  /** The saved line's words: where the answer landed. */
  words: string
}

/** Newest first, one entry per row; saving a row after skipping it reads as saved. */
export function pushFillInHandled<T extends FillInRowBase>(trail: readonly FillInHandled<T>[], entry: FillInHandled<T>): FillInHandled<T>[] {
  return [entry, ...trail.filter((t) => t.row.key !== entry.row.key)]
}

/** The chip under a line's button when the deck can fill its rows: what pressing it does. */
export const FILL_IN_ACTION_LABEL = 'Fill them in'

/**
 * Whether a kind's rows are the viewer's to fill: its line's actor is one the viewer presses for
 * (`needsYouActor.ts`, v2.5843). Every kind built so far is the office's chore, so this is the
 * assistant's; the owner and the controller read the same rows under the office fold.
 */
export function fillInKindIsViewers(kind: FillInKind, role: UserRole | null | undefined): boolean {
  return needsYouViewerActors(role).has(needsYouActorOf({ key: FILL_IN_KIND_ITEM[kind] }))
}

/**
 * Where Today's lines opens (v2.5907, punch list #178, D's PR 1). The live read of
 * 2026-10-26 found the stations that get marked every workday are the ones whose body is the
 * work, and Today's lines, a list of doors, had 7 marks in 35 days. So on Quickfill the deck is
 * the station's body, not a view behind a chip: the station opens on the deck whenever it holds
 * rows that are the viewer's own lines, and while it is still reading them for a viewer whose
 * lines they would be, so the assistant's first press of the morning is the first row's Save
 * and next. Anyone else opens on the card with their own lines first, as v2.5843 decided: the
 * owner's station leading with the office's 206 rows was the first live look's finding. With
 * nothing of the viewer's to fill it opens on the card, Cards or Walk as the viewer chose. The
 * stored Cards / Walk choice governs the card after the deck, never the opening: the deck is the
 * body, not a preference (v2.5774 decided the deck is a visit's state, never stored). The
 * Dashboard host has no deck and never asks.
 */
export type NeedsYouStationOpening = 'deck' | 'card'

export function needsYouStationOpening(input: { rows: ReadonlyArray<{ kind: FillInKind }>; loading: boolean; role: UserRole | null | undefined }): NeedsYouStationOpening {
  if (input.rows.some((r) => fillInKindIsViewers(r.kind, input.role))) return 'deck'
  if (input.loading && FILL_IN_KINDS_BUILT.some((k) => fillInKindIsViewers(k, input.role))) return 'deck'
  return 'card'
}

/** The heading over the viewer's lines the deck cannot fill, drawn under it on Quickfill. */
export function fillInOtherLinesHeading(n: number): string {
  return n === 1 ? 'Your other line' : `Your other lines · ${n}`
}

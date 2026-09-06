/**
 * The Won cascade, stated before the tap and undone by the undo (journey-map Tier-2 #21, C29).
 *
 * Marking one GC packet Won does three things at once: the packet reads won, every other sent,
 * unanswered packet is marked Lost ("GC lost the project"), and `bids.outcome` rolls to won —
 * even over a hand-set Lost. Until this kernel, that was explained only in the after-toast, and
 * "↩ waiting" put the packet back without touching the siblings or the bid (BP398's Won residue).
 *
 * Pure: `wonCascadePlan` says what a Won tap WILL do; `wonCascadeConfirmMessage` is the one
 * sentence every writer shows first; `wonCascadeUndo` turns a pre-write snapshot into the
 * patches that put everything back; `inferWonCascadeSnapshot` rebuilds a best-effort snapshot
 * when none was taken in this session (a reload, or a signature-set Won from the bid room).
 * The Supabase writes live in gcPacketOutcome.ts.
 */

export type CascadePacket = {
  key: string
  name: string
  outcome: string | null
  sentOn: string | null
  versionIds: string[]
  sharedLetter?: boolean
}

/** GcPacket → CascadePacket (structural — no import of gcPackets needed). */
export function cascadePackets(
  packets: ReadonlyArray<{ key: string; name: string; outcome: string | null; sentOn: string | null; versions: ReadonlyArray<{ id: string }>; sharedLetter?: boolean }>,
): CascadePacket[] {
  return packets.map((p) => ({ key: p.key, name: p.name, outcome: p.outcome, sentOn: p.sentOn, versionIds: p.versions.map((v) => v.id), sharedLetter: p.sharedLetter }))
}

export type WonCascadePlan = {
  target: { key: string; name: string; versionIds: string[] } | null
  /** Siblings the win marks Lost: sent, unanswered, real packets with versions. */
  willLose: Array<{ key: string; name: string; versionIds: string[] }>
  /** Packet keys of `willLose` ('' = the bid's own GC). */
  willLoseGcIds: string[]
  /** True when `bids.outcome` will be written to won (it isn't already won / started). */
  willRollBidOutcome: boolean
  /** The hand-set bid outcome the roll overrides — only ever 'lost' (won / started block the roll). */
  overridesHandSetOutcome: 'lost' | null
  bidOutcomeBefore: string | null
}

export function wonCascadePlan(bid: { outcome: string | null }, gcs: ReadonlyArray<CascadePacket>, targetKey: string): WonCascadePlan {
  const target = gcs.find((p) => p.key === targetKey) ?? null
  const targetIds = new Set(target?.versionIds ?? [])
  const willLose = gcs
    .filter((p) => p.key !== targetKey && !p.sharedLetter && p.outcome == null && !!p.sentOn && p.versionIds.length > 0 && !p.versionIds.some((id) => targetIds.has(id)))
    .map((p) => ({ key: p.key, name: p.name, versionIds: [...p.versionIds] }))
  const before = bid.outcome ?? null
  const willRoll = before !== 'won' && before !== 'started_or_complete'
  return {
    target: target ? { key: target.key, name: target.name, versionIds: [...target.versionIds] } : null,
    willLose,
    willLoseGcIds: willLose.map((p) => p.key),
    willRollBidOutcome: willRoll,
    overridesHandSetOutcome: willRoll && before === 'lost' ? 'lost' : null,
    bidOutcomeBefore: before,
  }
}

/** A Won tap needs the confirm whenever it changes anything beyond the tapped packet. */
export function wonCascadeNeedsConfirm(plan: WonCascadePlan): boolean {
  return plan.willLose.length > 0 || plan.willRollBidOutcome
}

function joinNames(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The one sentence, shared by every Won writer (the PickWinningGcModal copy is built from it too):
 * "This marks the other GCs Lost and the bid Won." — naming the GCs when it knows them, and saying
 * so out loud when it overrides a hand-set Lost.
 */
export function wonCascadeConfirmMessage(plan: WonCascadePlan, opts?: { gcName?: string }): string {
  const who = opts?.gcName ?? plan.target?.name ?? 'this GC'
  const parts: string[] = []
  if (plan.willLose.length > 0) parts.push(`the other GC${plan.willLose.length === 1 ? '' : 's'} (${joinNames(plan.willLose.map((p) => p.name))}) Lost — GC lost the project`)
  if (plan.willRollBidOutcome) parts.push('the bid Won')
  const head = `Mark ${who} Won?`
  if (parts.length === 0) return `${head} Only ${who}'s packet changes.`
  let s = `${head} This marks ${parts.join(' and ')}.`
  if (plan.overridesHandSetOutcome === 'lost') s += ' The bid is currently marked Lost by hand — it flips to Won.'
  s += ' ↩ waiting on the winner puts all of it back.'
  return s
}

export type WonCascadeVersionState = { id: string; outcome: string | null; outcome_at: string | null; loss_category: string | null }

export type WonCascadeSnapshot = {
  bidId: string
  /** Packet key of the GC that was marked Won. */
  targetKey: string
  targetVersionIds: string[]
  /** Prior state of every version the cascade touched (the winner's and the auto-lost siblings'). */
  versions: WonCascadeVersionState[]
  /** Names of the siblings the cascade marked Lost (for the undo toast / note). */
  autoLostNames: string[]
  bidOutcomeBefore: string | null
  /** True when the cascade wrote `bids.outcome` — undo restores `bidOutcomeBefore` only then. */
  bidOutcomeWritten: boolean
  takenAt: string
  /** 'session' = captured before the write; 'inferred' = rebuilt from the rows (reload / signature path). */
  source: 'session' | 'inferred'
}

export type WonCascadeUndoPlan = {
  versionPatches: WonCascadeVersionState[]
  /** Null when the cascade never wrote `bids.outcome` (already won / started) — leave it alone. */
  bidPatch: { outcome: string | null } | null
  restoredSiblingNames: string[]
}

/** Snapshot → the writes that put every touched row back where it was. */
export function wonCascadeUndo(snapshot: WonCascadeSnapshot): WonCascadeUndoPlan {
  const targetIds = new Set(snapshot.targetVersionIds)
  const versionPatches = snapshot.versions.map((v) => (targetIds.has(v.id) ? { id: v.id, outcome: null, outcome_at: null, loss_category: null } : { ...v }))
  return {
    versionPatches,
    bidPatch: snapshot.bidOutcomeWritten ? { outcome: snapshot.bidOutcomeBefore } : null,
    restoredSiblingNames: [...snapshot.autoLostNames],
  }
}

/**
 * No snapshot from this session (reload, or the GC signed in the bid room): rebuild one from the
 * rows. A sibling reads auto-lost when it is lost with NO reason recorded and (when the winner's
 * `outcome_at` is known) was marked the same day — a hand-set Lost with a reason stays lost. The
 * bid goes back to Not set when it reads won; a hand-set Lost from before the tap can't be known.
 */
export function inferWonCascadeSnapshot(args: {
  bidId: string
  bidOutcome: string | null
  gcs: ReadonlyArray<CascadePacket>
  targetKey: string
  rows: ReadonlyArray<WonCascadeVersionState>
  nowIso: string
}): WonCascadeSnapshot {
  const target = args.gcs.find((p) => p.key === args.targetKey)
  const targetIds = new Set(target?.versionIds ?? [])
  const byId = new Map(args.rows.map((r) => [r.id, r]))
  const wonAt = [...targetIds].map((id) => byId.get(id)?.outcome_at ?? null).find((d) => d != null) ?? null
  const versions: WonCascadeVersionState[] = []
  const autoLostNames: string[] = []
  for (const id of targetIds) {
    const r = byId.get(id)
    if (r) versions.push({ ...r })
  }
  for (const p of args.gcs) {
    if (p.key === args.targetKey || p.sharedLetter) continue
    const rows = p.versionIds.map((id) => byId.get(id)).filter((r): r is WonCascadeVersionState => !!r)
    const autoLost = rows.length > 0 && rows.every((r) => r.outcome === 'lost' && r.loss_category == null && (wonAt == null || r.outcome_at == null || r.outcome_at === wonAt))
    if (!autoLost) continue
    autoLostNames.push(p.name)
    for (const r of rows) versions.push({ id: r.id, outcome: null, outcome_at: null, loss_category: null })
  }
  return {
    bidId: args.bidId,
    targetKey: args.targetKey,
    targetVersionIds: [...targetIds],
    versions,
    autoLostNames,
    bidOutcomeBefore: null,
    bidOutcomeWritten: args.bidOutcome === 'won',
    takenAt: args.nowIso,
    source: 'inferred',
  }
}

/** Where the Won was recorded — the `path` dimension of `bid_outcome_set{path, undone}`. */
export type WonCascadePath = 'edit-bid' | 'board' | 'followup-details' | 'waiting-to-hear' | 'call-queue' | 'job-import'

export const BID_OUTCOME_SET_CONTROL = 'bid_outcome_set'

/** `ui_nav_clicks.target` for a packet outcome write: `#<path>:won|lost|waiting` or `#<path>:undone`. */
export function bidOutcomeSetTarget(path: WonCascadePath, outcome: 'won' | 'lost' | null, undone: boolean): string {
  return `#${path}:${undone ? 'undone' : (outcome ?? 'waiting')}`
}

/** The Win/Loss note the packet path writes (the Edit-Bid form's note never saw these flips). */
export function wonCascadeNoteBody(args: { gcName: string; autoLostNames: ReadonlyArray<string>; bidOutcomeSet: boolean; overrodeHandSet: 'lost' | null }): string {
  let s = `Marked Won via packet — ${args.gcName}`
  if (args.autoLostNames.length > 0) s += ` · siblings marked Lost: ${args.autoLostNames.join(', ')} (GC lost the project)`
  if (args.bidOutcomeSet) s += args.overrodeHandSet === 'lost' ? ' · bid Lost → Won' : ' · bid marked Won'
  return s + '.'
}

export function wonCascadeUndoNoteBody(args: { gcName: string; restoredSiblingNames: ReadonlyArray<string>; bidOutcomeRestoredTo: string | null | undefined }): string {
  let s = `Won undone via packet — ${args.gcName} back to waiting`
  if (args.restoredSiblingNames.length > 0) s += ` · ${args.restoredSiblingNames.join(', ')} back to waiting`
  if (args.bidOutcomeRestoredTo !== undefined) s += ` · bid back to ${args.bidOutcomeRestoredTo === 'lost' ? 'Lost' : args.bidOutcomeRestoredTo === 'won' ? 'Won' : args.bidOutcomeRestoredTo === 'started_or_complete' ? 'Started or Complete' : 'Not set'}`
  return s + '.'
}

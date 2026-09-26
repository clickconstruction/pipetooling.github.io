import type { LienDeskItemRow } from './lienDesk'
import { parseLienDeskDraftFields } from './lienNoticeDraft'
import { retainageDeadlineFor } from './lienDeadlines'
import type { LetterTwoStatus } from './lienLetterTwo'
import type { LienRetainageEntry } from './lienDeskRetainage'
import type { LienPaymentBond } from './lienDeskRetainage'

/**
 * The owner's call (pure kernel, v2.3767 — punch list #33 PR 3, counsel's
 * memo of 2026-09-22): the three questions every owner letter asks the owner
 * to answer by phone — do you still owe the GC anything, did you reserve the
 * statutory 10 percent and is it still in your hands, when was the original
 * contract completed — typed once on the sent notice's record, read by the
 * desk, the affidavit pane and the grid. From the answers, counsel's three
 * piles for the affidavit: A the owner still owes the GC (trap it), B paid
 * but never reserved the 10 percent (a reserved-funds lien, shared, § 53.105),
 * C paid in full and holds nothing (the property lien; file now, do not wait
 * for the 15th). The grid is the memo's spreadsheet — one row per job with
 * every date and every fact — printed for counsel from the GC run.
 */

export type OwnerOwesGc = 'yes' | 'no' | 'unknown'
export type OwnerReserved = 'held' | 'released' | 'never' | 'unknown'

export type OwnerCall = {
  /** ISO — when the call was recorded. */
  at: string
  /** Who took the call. */
  name: string
  owesGc: OwnerOwesGc
  /** What they say they still owe, when they gave a figure. */
  owesAmount: number | null
  reserved: OwnerReserved
  /** 'YYYY-MM-DD' — the owner's contract with the GC completed; null while open or unknown. */
  originalContractCompletedOn: string | null
  note: string
  /** The conversation's facts (v2.3852) — absent on calls recorded before it. */
  /** 'YYYY-MM-DD' — the day the 10% went to the GC, when `reserved` is 'released' and they gave one; decides § 53.105 against the hold. */
  releasedOn?: string | null
  /** They asked to pay us directly — counsel's sign-off on this job before a check is taken. */
  wantsToPayUs?: boolean
  /** The GC is not answering them either — letter two's ground. */
  gcSilentToThem?: boolean
  /** They asked for the signer to call them back. */
  callbackWanted?: boolean
  /** The script cards read to them, in order — what the office told them. */
  told?: string[]
}

export const OWNER_OWES_OPTIONS: ReadonlyArray<{ key: OwnerOwesGc; label: string }> = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
  { key: 'unknown', label: 'Unknown' },
]

export const OWNER_RESERVED_OPTIONS: ReadonlyArray<{ key: OwnerReserved; label: string; words: string }> = [
  { key: 'held', label: 'Reserved · still held', words: '10% held' },
  { key: 'released', label: 'Reserved · released to the GC', words: '10% released' },
  { key: 'never', label: 'Never reserved', words: 'never reserved the 10%' },
  { key: 'unknown', label: 'Unknown', words: '10% unknown' },
]

export function parseOwnerCall(raw: unknown): OwnerCall | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.at !== 'string' || !o.at) return null
  const owes = o.owesGc === 'yes' || o.owesGc === 'no' ? o.owesGc : 'unknown'
  const reserved = o.reserved === 'held' || o.reserved === 'released' || o.reserved === 'never' ? o.reserved : 'unknown'
  const amount = typeof o.owesAmount === 'number' && Number.isFinite(o.owesAmount) ? o.owesAmount : null
  const done = typeof o.originalContractCompletedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.originalContractCompletedOn) ? o.originalContractCompletedOn : null
  const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  return {
    at: o.at,
    name: typeof o.name === 'string' ? o.name : '',
    owesGc: owes,
    owesAmount: amount,
    reserved,
    originalContractCompletedOn: done,
    note: typeof o.note === 'string' ? o.note : '',
    releasedOn: reserved === 'released' ? ymd(o.releasedOn) : null,
    wantsToPayUs: o.wantsToPayUs === true,
    gcSilentToThem: o.gcSilentToThem === true,
    callbackWanted: o.callbackWanted === true,
    told: Array.isArray(o.told) ? o.told.filter((t): t is string => typeof t === 'string') : [],
  }
}

/**
 * The 10% against the § 53.101 hold (v2.3852): released before the hold ended is what § 53.105
 * reaches the property for. null until both days are known.
 */
export function releasedAgainstHold(releasedOn: string | null | undefined, originalContractCompletedOn: string | null | undefined): { inside: boolean; holdEndsOn: string; daysEarly: number } | null {
  const r = (releasedOn ?? '').trim()
  const holdEndsOn = reservationHoldEndsOn(originalContractCompletedOn)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r) || !holdEndsOn) return null
  const ms = new Date(holdEndsOn + 'T12:00:00').getTime() - new Date(r + 'T12:00:00').getTime()
  const daysEarly = Math.round(ms / 86_400_000)
  return { inside: daysEarly > 0, holdEndsOn, daysEarly: Math.max(0, daysEarly) }
}

/** Counsel's three piles, from the answers; null until the answers say. */
export type AffidavitPile = 'A' | 'B' | 'C'

export function affidavitPileFor(call: OwnerCall | null | undefined): AffidavitPile | null {
  if (!call) return null
  if (call.owesGc === 'yes' || call.reserved === 'held') return 'A'
  if (call.owesGc === 'no' && call.reserved === 'never') return 'B'
  if (call.owesGc === 'no' && call.reserved === 'released') return 'C'
  return null
}

export const AFFIDAVIT_PILE_WORDS: Record<AffidavitPile, { short: string; next: string }> = {
  A: { short: 'owner still owes the GC', next: 'trap it — the notice holds those dollars; file the affidavit the day the claim is still unpaid' },
  B: { short: 'paid, never reserved the 10%', next: 'a reserved-funds lien to the extent of what should have been held, shared with other unpaid claimants (§ 53.105)' },
  C: { short: 'paid in full, holds nothing', next: 'the property lien and the foreclosure calendar — file now, do not wait for the 15th' },
}

/** The § 53.101 hold: the owner must keep the 10 percent for 30 days after the original contract is completed. '' while open or unknown. */
export function reservationHoldEndsOn(originalContractCompletedOn: string | null | undefined): string {
  return retainageDeadlineFor(originalContractCompletedOn)
}

/** "owner called Sep 17 · still owes the GC ($14,000) · 10% held" — one wording. */
export function ownerCallWords(call: OwnerCall, formatDay: (ymd: string) => string, formatMoney: (n: number) => string): string {
  const owes = call.owesGc === 'yes' ? `still owes the GC${call.owesAmount != null ? ` (${formatMoney(call.owesAmount)})` : ''}` : call.owesGc === 'no' ? 'owes the GC nothing' : 'owes: unknown'
  const against = call.reserved === 'released' ? releasedAgainstHold(call.releasedOn, call.originalContractCompletedOn) : null
  const reserved = call.reserved === 'released' && call.releasedOn ? `10% released ${formatDay(call.releasedOn)}${against ? (against.inside ? ' · inside the hold' : ' · after the hold') : ''}` : (OWNER_RESERVED_OPTIONS.find((o) => o.key === call.reserved)?.words ?? '')
  const tails = [call.wantsToPayUs ? 'wants to pay us → counsel' : '', call.gcSilentToThem ? 'GC silent to them' : '', call.callbackWanted ? 'wants a call back' : ''].filter(Boolean)
  return [`owner called ${formatDay(call.at.slice(0, 10))}`, owes, reserved, ...tails].join(' · ')
}

/** The latest owner call on a job, from its notice items (the first packet carries it; a later call overwrites). */
export function ownerCallByJobFrom(items: ReadonlyArray<LienDeskItemRow>): Record<string, OwnerCall> {
  const out: Record<string, { at: string; call: OwnerCall }> = {}
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || it.voided_at) continue
    const call = parseLienDeskDraftFields(it.fields)?.ownerCall ?? null
    if (!call) continue
    const prev = out[it.job_id]
    if (!prev || call.at > prev.at) out[it.job_id] = { at: call.at, call }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.call]))
}

// ---------- the grid: counsel's spreadsheet, one row per job ----------

export type PlaybookGridRow = {
  jobId: string
  label: string
  owner: string
  /** "Res · Comal" */
  kindWords: string
  /** The last month worked, 'YYYY-MM' or ''. */
  lastMonth: string
  unpaid: number
  /** § 53.056: the months noticed and the ones still open, as words. */
  notice56: string
  /** § 53.057: the clock words, or '—' when no retainage is recorded. */
  notice57: string
  affidavitBy: string
  bond: LienPaymentBond
  paidOut: string
  reserved: string
  theirContractDone: string
  /** The § 53.101 hold's end, when the owner's completion date is known. */
  holdEndsOn: string
  letterTwo: string
  pile: AffidavitPile | null
  /** A homestead: counsel reads the original contract before the affidavit goes to the clerk. */
  homestead: boolean
}

export type PlaybookGridInput = {
  jobId: string
  label: string
  owner: string
  kindWords: string
  homestead: boolean
  lastMonth: string
  unpaid: number
  noticedMonths: ReadonlyArray<string>
  openMonths: ReadonlyArray<{ key: string; deadline: string }>
  affidavitBy: string
  bond: LienPaymentBond
  retainage: Pick<LienRetainageEntry, 'deadline' | 'daysLeft' | 'noticed' | 'contractEndedOn'> | null
  call: OwnerCall | null
  letterTwo: Pick<LetterTwoStatus, 'state' | 'words'> | null
}

export function buildPlaybookGridRow(i: PlaybookGridInput, fmt: { day: (ymd: string) => string; month: (key: string) => string; money: (n: number) => string }): PlaybookGridRow {
  const noticed = i.noticedMonths.map((m) => `${fmt.month(m)} ✓`)
  const open = i.openMonths.map((m) => `${fmt.month(m.key)} by ${fmt.day(m.deadline)}`)
  const notice56 = [...noticed, ...open].join(' · ') || '—'
  const notice57 = !i.retainage ? '—' : i.retainage.noticed ? 'sent' : !i.retainage.contractEndedOn || !i.retainage.deadline ? 'clock not started' : `by ${fmt.day(i.retainage.deadline)}`
  const c = i.call
  return {
    jobId: i.jobId,
    label: i.label,
    owner: i.owner || '—',
    kindWords: i.kindWords,
    lastMonth: i.lastMonth,
    unpaid: i.unpaid,
    notice56,
    notice57,
    affidavitBy: i.affidavitBy ? fmt.day(i.affidavitBy) : '—',
    bond: i.bond,
    paidOut: !c ? '?' : c.owesGc === 'no' ? 'yes' : c.owesGc === 'yes' ? `no${c.owesAmount != null ? ` · ${fmt.money(c.owesAmount)} owed` : ''}` : '?',
    reserved: !c ? '?' : c.reserved === 'held' ? 'yes · held' : c.reserved === 'released' ? `released${c.releasedOn ? ` ${fmt.day(c.releasedOn)}` : ''}${releasedAgainstHold(c.releasedOn, c.originalContractCompletedOn)?.inside ? ' · inside hold' : ''}` : c.reserved === 'never' ? 'never' : '?',
    theirContractDone: !c ? '?' : c.originalContractCompletedOn ? fmt.day(c.originalContractCompletedOn) : 'open',
    holdEndsOn: c?.originalContractCompletedOn ? fmt.day(reservationHoldEndsOn(c.originalContractCompletedOn)) : '',
    letterTwo: i.letterTwo && i.letterTwo.state !== 'none' ? i.letterTwo.words : '—',
    pile: affidavitPileFor(c),
    homestead: i.homestead,
  }
}

export const PLAYBOOK_GRID_COLUMNS: ReadonlyArray<{ key: keyof PlaybookGridRow | 'pileWords'; label: string }> = [
  { key: 'label', label: 'Job' },
  { key: 'owner', label: 'Owner' },
  { key: 'kindWords', label: 'Kind' },
  { key: 'lastMonth', label: 'Last work' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'notice56', label: '§ 53.056' },
  { key: 'notice57', label: '§ 53.057' },
  { key: 'affidavitBy', label: 'Affidavit by' },
  { key: 'bond', label: 'Bond' },
  { key: 'paidOut', label: 'Paid out' },
  { key: 'reserved', label: '10% held' },
  { key: 'theirContractDone', label: 'Their contract done' },
  { key: 'letterTwo', label: 'Letter two' },
  { key: 'pileWords', label: 'Pile' },
]

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The grid as one printable page — landscape, one row per job, the piles' meanings under it. */
export function playbookGridHtml(gcName: string, rows: ReadonlyArray<PlaybookGridRow>, todayWords: string, fmt: { month: (key: string) => string; money: (n: number) => string }): string {
  const cell = (r: PlaybookGridRow, key: (typeof PLAYBOOK_GRID_COLUMNS)[number]['key']): string => {
    if (key === 'pileWords') return r.pile ? `${r.pile} · ${AFFIDAVIT_PILE_WORDS[r.pile].short}` : r.paidOut === '?' ? 'no call yet' : '—'
    if (key === 'unpaid') return fmt.money(r.unpaid)
    if (key === 'lastMonth') return r.lastMonth ? fmt.month(r.lastMonth) : '—'
    if (key === 'bond') return r.bond === 'yes' ? 'yes' : r.bond === 'no' ? 'no' : '?'
    if (key === 'theirContractDone') return r.holdEndsOn ? `${r.theirContractDone} · 10% hold ends ${r.holdEndsOn}` : r.theirContractDone
    const v = r[key]
    return typeof v === 'string' ? v : v == null ? '' : String(v)
  }
  const head = PLAYBOOK_GRID_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join('')
  const body = rows
    .map((r) => `<tr${r.homestead ? ' class="homestead"' : ''}>${PLAYBOOK_GRID_COLUMNS.map((c) => `<td>${esc(cell(r, c.key))}${c.key === 'kindWords' && r.homestead ? ' <em>homestead — counsel reads the original contract before the affidavit goes to the clerk</em>' : ''}</td>`).join('')}</tr>`)
    .join('')
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Playbook grid — ${esc(gcName)} — ${esc(todayWords)}</title>
<style>
  @page { size: landscape; margin: 0.5in; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; background: #fff; margin: 1.5rem; font-size: 11px; }
  h1 { font-size: 15px; margin: 0 0 2px; } p { margin: 0 0 10px; color: #444; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: .04em; background: #f3f3f3; } em { color: #7a4a00; font-style: normal; font-size: 10px; }
  tr.homestead td { background: #fff8e6; } .legend { margin-top: 10px; font-size: 10px; color: #444; }
</style></head><body>
<h1>The playbook grid · ${esc(gcName)} · ${esc(todayWords)}</h1>
<p>One row per job, one envelope per property (counsel, 2026-09-22). A "?" is an answer the office still owes the grid — the owner's call fills Paid out, 10% held and Their contract done.</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="legend"><strong>Piles:</strong> A — ${esc(AFFIDAVIT_PILE_WORDS.A.short)}: ${esc(AFFIDAVIT_PILE_WORDS.A.next)}. B — ${esc(AFFIDAVIT_PILE_WORDS.B.short)}: ${esc(AFFIDAVIT_PILE_WORDS.B.next)}. C — ${esc(AFFIDAVIT_PILE_WORDS.C.short)}: ${esc(AFFIDAVIT_PILE_WORDS.C.next)}.</div>
</body></html>`
}

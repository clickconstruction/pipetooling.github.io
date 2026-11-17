import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'
import { lienNoticePartedWords, type LienNoticeParted } from './lienNoticeParted'

/**
 * Redrawing a notice from the bills (v2.7520). A desk item past a draft keeps its paper as it was sent for
 * approval, and since v2.7517 the run holds a notice whose stored paper and bills have parted. This kernel is
 * the way back: the stored paper replaced by the one the desk draws today, a line saying who redrew it and
 * what it claimed before, and the words the desk says about it. Pure; `redrawLienDeskItem` writes what it
 * returns and clears the signature, because the mark belongs to the paper as it was signed.
 *
 * The same rewrite stands behind the desk's signing press: `lienNoticeSignFields` is the paper the pane shows,
 * dated the day it is signed, so the hash the signature binds is of the pages the leader read.
 */
export type LienNoticeRedrawn = {
  /** When, ISO. */
  at: string
  by: string | null
  byName: string
  /** What the paper claimed before, as it stored it ("18400.00"). */
  wasClaim: string
  /** The date the paper carried before, 'YYYY-MM-DD'. */
  wasDate: string
}

function asObject(fields: unknown): Record<string, unknown> {
  return fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
}

/** The row's `fields` with the notice replaced and every other key kept; `redrawn`, when given, is the line the row keeps. */
export function fieldsRedrawn(fields: unknown, notice: LienNoticeFields, redrawn: LienNoticeRedrawn | null): Record<string, unknown> {
  return { ...asObject(fields), notice: { ...notice }, ...(redrawn ? { redrawn: { ...redrawn } } : {}) }
}

/** The line a redraw left on the row, or null. */
export function redrawnOf(fields: unknown): LienNoticeRedrawn | null {
  const r = asObject(fields).redrawn
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (typeof o.at !== 'string' || !o.at) return null
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return { at: o.at, by: typeof o.by === 'string' ? o.by : null, byName: str(o.byName), wasClaim: str(o.wasClaim), wasDate: str(o.wasDate) }
}

/** The line as the row keeps it, from the stored paper about to be replaced. */
export function redrawnLine(stored: Pick<LienNoticeFields, 'claimAmount' | 'noticeDate'> | null | undefined, who: { at: string; by: string | null; byName: string }): LienNoticeRedrawn {
  return { at: who.at, by: who.by, byName: who.byName.trim(), wasClaim: stored?.claimAmount ?? '', wasDate: stored?.noticeDate ?? '' }
}

/**
 * A row the redraw may rewrite: past a draft, live, and not printed. A draft follows the bills by itself; a
 * printed paper is out of the printer as it was and is taken back first; a sent one is the record of what went.
 */
export function canRedrawItem(item: { status?: string | null; printed_at?: string | null; voided_at?: string | null } | null | undefined): boolean {
  if (!item) return false
  return (item.status === 'awaiting_approval' || item.status === 'approved' || item.status === 'held') && !item.printed_at && !item.voided_at
}

/**
 * The paper a signing press signs: the notice as the pane shows it, with the line of a redraw when its money
 * had parted from the stored paper. A notice whose stored paper already is what the pane shows comes back with
 * the same hash, and the press then writes nothing before it signs.
 */
export function lienNoticeSignFields(fields: unknown, shown: LienNoticeFields, parted: LienNoticeParted | null, who: { at: string; by: string | null; byName: string }): Record<string, unknown> {
  const stored = asObject(fields).notice as Pick<LienNoticeFields, 'claimAmount' | 'noticeDate'> | undefined
  return fieldsRedrawn(fields, shown, parted ? redrawnLine(stored, who) : null)
}

/** How the pane's band reads, by where the notice stands. */
export type LienNoticePartedStanding = 'signed' | 'unsigned' | 'printed'

/**
 * The band over the paper when the stored paper and the bills have parted: what differs with both figures, then
 * what happens next. Signed, the run holds it and one press redraws it. Not yet signed, signing signs today's
 * figures. Printed, it is taken back first.
 */
export function lienNoticePartedBand(p: LienNoticeParted, standing: LienNoticePartedStanding, leaderName?: string | null): { head: string; words: string; next: string } {
  const leader = (leaderName ?? '').trim().split(/\s+/)[0] || 'The leader'
  const words = lienNoticePartedWords(p)
  if (standing === 'printed') return { head: 'This paper printed before the bills changed', words, next: 'Check it before it is mailed. To redraw it, take it back first.' }
  if (standing === 'unsigned') return { head: 'The bills changed since this notice was sent for approval', words, next: `This screen shows today’s figures. ${leader} signs those.` }
  return { head: 'The signed paper and the bills no longer agree', words, next: `The run holds it. Redraw it from the bills and ${leader} signs it again.` }
}

/** The confirm before a redraw. A signed notice says its signature comes off. */
export function lienNoticeRedrawConfirm(p: LienNoticeParted, opts: { signed: boolean; leaderName?: string | null }): { title: string; message: string; confirmLabel: string } {
  const leader = (opts.leaderName ?? '').trim().split(/\s+/)[0] || 'The leader'
  const after = opts.signed ? `The signature comes off, and ${leader} signs it again before it prints.` : `${leader} signs the new figures.`
  return {
    title: 'Redraw this notice from the bills?',
    message: `${lienNoticePartedWords(p)} The claim and the date on the form are redrawn. The wording typed on the notice stays. ${after}`,
    confirmLabel: 'Redraw the notice',
  }
}

/** What the desk says once it is done. */
export function lienNoticeRedrawnToast(signed: boolean, leaderName?: string | null): string {
  const leader = (leaderName ?? '').trim().split(/\s+/)[0] || 'The leader'
  return signed ? `Redrawn from the bills. ${leader} signs it again before it prints.` : 'Redrawn from the bills.'
}

/** The line under the paper after a redraw: *Redrawn from the bills by Dana on Nov 16. It claimed $18,400.00 before.* */
export function lienNoticeRedrawnWords(r: LienNoticeRedrawn, formatDay: (iso: string) => string): string {
  const n = Number(String(r.wasClaim).replace(/[$,\s]/g, ''))
  const was = r.wasClaim && Number.isFinite(n) ? ` It claimed ${n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} before.` : ''
  const by = r.byName ? ` by ${r.byName}` : ''
  const day = formatDay(r.at)
  return `Redrawn from the bills${by}${day ? ` on ${day}` : ''}.${was}`
}

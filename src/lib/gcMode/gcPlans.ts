/**
 * GC mode — design spike. Plans: sheets and disciplines, who hears about a new set, the email, who opened it.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, PlanSheet, TradePackage } from './gcTypes'
import { weekdayDate } from './gcWords'
import { currentRev, partnerById } from './gcLookups'

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

const DISCIPLINES: Record<string, string> = {
  G: 'General',
  C: 'Civil',
  A: 'Architectural',
  ID: 'Interiors',
  S: 'Structural',
  M: 'Mechanical',
  E: 'Electrical',
  P: 'Plumbing',
  FP: 'Fire protection',
  L: 'Landscape',
  T: 'Technology',
}

export function sheetDiscipline(sheetId: string): string {
  const letters = sheetId.match(/^[A-Za-z]+/)?.[0].toUpperCase() ?? ''
  return DISCIPLINES[letters] ?? 'Other'
}

export interface SheetInSet extends PlanSheet {
  /** The newest set, up to the one being read, that changed this sheet. Null: as first issued. */
  changedInRev: number | null
  /** The sheet did not exist before an addendum named it. */
  added: boolean
}

/** The drawings as they stand at one set: the bid set's index plus what each addendum touched. */
export function sheetsAtRev(project: GcProject, rev: number): SheetInSet[] {
  const out = new Map<string, SheetInSet>()
  for (const sheet of project.sheets) out.set(sheet.id, { ...sheet, changedInRev: null, added: false })
  const sets = project.planSets.filter((s) => s.rev <= rev).sort((a, b) => a.rev - b.rev)
  for (const set of sets) {
    for (const id of set.changedSheets) {
      const known = out.get(id)
      out.set(id, known ? { ...known, changedInRev: set.rev } : { id, title: `Added by ${set.label}`, changedInRev: set.rev, added: true })
    }
  }
  return [...out.values()]
}

/** Sheet numbers found in pasted notes: "E-201", "FP-101". Each once, in the order they appear. */
export function sheetsInText(text: string): string[] {
  const found = text.toUpperCase().match(/\b[A-Z]{1,2}-\d{2,3}\b/g) ?? []
  return [...new Set(found)]
}

/** Which trades a drawing's discipline usually belongs to. A guess to start from, never the last word. */
const DISCIPLINE_TRADES: Record<string, string[]> = {
  Civil: ['Sitework'],
  Structural: ['Structural steel', 'Concrete'],
  Mechanical: ['HVAC'],
  Electrical: ['Electrical'],
  Plumbing: ['Plumbing'],
  'Fire protection': ['Fire sprinkler'],
  Interiors: ['Millwork', 'Framing and drywall'],
}

/** The package ids a list of changed sheets most likely touches. */
export function packagesForSheets(project: GcProject, sheets: string[]): string[] {
  const trades = new Set(sheets.flatMap((id) => DISCIPLINE_TRADES[sheetDiscipline(id)] ?? []))
  return project.packages.filter((p) => trades.has(p.trade)).map((p) => p.id)
}

export interface PlanRecipient {
  partner: Partner
  pkg: TradePackage
  invite: Invite
  /** The new set changes this company's trade. */
  touched: boolean
  /** They have a number in that the change may move. */
  hasBid: boolean
}

/**
 * Who hears about a new set of plans. While we are bidding: every company bidding, on every
 * trade. Once the job is ours: only the company on each trade (the one awarded, or the one we
 * carry until we award). A company that passed is never on the list.
 */
export function planRecipients(state: GcState, project: GcProject, touches: string[]): PlanRecipient[] {
  const out: PlanRecipient[] = []
  for (const pkg of project.packages) {
    const picked = pkg.awardedInviteId ?? (pkg.carried && pkg.carried !== 'plug' && pkg.carried !== 'self' ? pkg.carried : null)
    for (const invite of pkg.invites) {
      if (invite.status === 'declined') continue
      if (project.stage !== 'pursuing' && invite.id !== picked) continue
      const partner = partnerById(state, invite.partnerId)
      if (!partner) continue
      out.push({ partner, pkg, invite, touched: touches.includes(pkg.id), hasBid: invite.bid !== null })
    }
  }
  return out.sort((a, b) => Number(b.touched) - Number(a.touched))
}

/** The words a company reads when a new set goes out. Two versions: their trade changed, or it did not. */
export function planEmail(project: GcProject, label: string, note: string, sheets: string[], r: PlanRecipient | null): { subject: string; body: string[] } {
  const body = [`${label} for ${project.name} is out. Your portal now shows it.`, `What changed: ${note || 'see the sheets below.'}`]
  if (sheets.length > 0) body.push(`Sheets: ${sheets.join(', ')}.`)
  if (!r) return { subject: `${project.name}: ${label} is out`, body }
  if (r.touched && project.stage === 'pursuing') {
    body.push(
      r.hasBid
        ? `This changes ${r.pkg.trade.toLowerCase()}. Please open the plans and confirm your number, or send a new one${project.bidDue ? `, by ${weekdayDate(project.bidDue)}` : ''}.`
        : `This changes ${r.pkg.trade.toLowerCase()}. Please price the new set${project.bidDue ? `. Your number is due ${weekdayDate(project.bidDue)}` : ''}.`,
    )
  } else if (r.touched) {
    body.push(`This changes ${r.pkg.trade.toLowerCase()}. Build from this set. If it changes your price, tell us before you do the work.`)
  } else {
    body.push(`It does not change ${r.pkg.trade.toLowerCase()}. No action needed. It is for your records.`)
  }
  return { subject: `${project.name}: ${label} is out${r.touched ? ' and it changes your trade' : ''}`, body }
}

/** How many invited trade partners have opened the newest set. */
export function plansReach(project: GcProject): { have: number; of: number } {
  const rev = currentRev(project)
  const invites = project.packages.flatMap((p) => p.invites).filter((i) => i.status !== 'declined')
  return { have: invites.filter((i) => i.seenRev === rev).length, of: invites.length }
}

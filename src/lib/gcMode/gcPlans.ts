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
      const title = set.addedSheets?.find((x) => x.id === id)?.title || `Added by ${set.label}`
      out.set(id, known ? { ...known, changedInRev: set.rev } : { id, title, changedInRev: set.rev, added: true })
    }
  }
  return [...out.values()]
}

/**
 * Sheet numbers found in pasted notes, each once, in the order they appear. With a dash: "E-201",
 * "FP-101", "A-1.01". Without one, only a full number reads as a sheet ("A101", "A1.01"), so a
 * word like R30 or T24 in the notes is not taken for a drawing.
 */
export function sheetsInText(text: string): string[] {
  const found = text.toUpperCase().match(/\b[A-Z]{1,2}(?:-\d{2,3}|-?\d\.\d{2}|\d{3})[A-Z]?\b/g) ?? []
  return [...new Set(found)]
}

/**
 * A sheet number as the project's index writes it: "A101" in the notes is "A-101" in a set that
 * uses dashes. A sheet the index does not have is written the way the index writes its others.
 */
export function sheetAsIndexed(project: GcProject, id: string): string {
  const bare = (x: string) => x.toUpperCase().replace(/[-.\s]/g, '')
  const known = [...project.sheets, ...project.planSets.flatMap((s) => s.addedSheets ?? [])].find((s) => bare(s.id) === bare(id))
  if (known) return known.id
  const upper = id.toUpperCase()
  const dashed = project.sheets.filter((s) => s.id.includes('-')).length > project.sheets.length / 2
  return dashed && !upper.includes('-') ? upper.replace(/^([A-Z]+)/, '$1-') : upper
}

/** What a later set can be called. An addendum comes while we bid; a bulletin once the job is ours. */
export const SET_KINDS: { kind: string; numbered: boolean }[] = [
  { kind: 'Addendum', numbered: true },
  { kind: 'Bulletin', numbered: true },
  { kind: 'Revised set', numbered: false },
  { kind: 'Permit set', numbered: false },
  { kind: 'Construction set', numbered: false },
]

/** The kind a new set starts as: an addendum while we bid, a bulletin once the job is ours. */
export function defaultSetKind(project: GcProject): string {
  return project.stage === 'pursuing' ? 'Addendum' : 'Bulletin'
}

/** The next set's name for a kind. Each numbered kind counts on its own: Addendum 2, then Bulletin 1. */
export function nextSetLabel(project: GcProject, kind: string): string {
  const numbered = SET_KINDS.find((k) => k.kind === kind)?.numbered ?? false
  const labels = project.planSets.map((s) => s.label)
  if (numbered) {
    const n = labels.filter((l) => new RegExp(`^${kind} \\d+$`).test(l)).length
    return `${kind} ${n + 1}`
  }
  if (!labels.includes(kind)) return kind
  let n = 2
  while (labels.includes(`${kind} ${n}`)) n += 1
  return `${kind} ${n}`
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

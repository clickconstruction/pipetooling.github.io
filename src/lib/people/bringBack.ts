/**
 * Bring back (punch list #256, PR 1): a teammate whose employment ended comes back on the same
 * account, so their hours log, logbook, HR file and job history stay with them.
 *
 * Pure. The Person Desk's Bring back window (PR 3) loads the facts and renders these rows through
 * the same checklist helpers End employment uses (`applyChecklistResolutions`, `checklistSummary`
 * in `lifecycleChecklist.ts`). The owner's calls of 2026-11-03 live here:
 *   1. tenure counts from the day back (the stints are PR 2's table; nothing here reads them),
 *   2. old roadmap tasks come back by default only within 90 days away,
 *   3. the wage row must be pressed, Keep or Change — it cannot be left open,
 *   4. training mode starts off for a returner.
 * Also: + Hire stops on an archived person with the same name or email (`findArchivedMatch`).
 *
 * PR 3 (v2.6523): the window is `PersonDeskBringBackModal`, its reads `bringBackFacts.ts`, and its writes
 * are the ordered plan `planBringBackWrites` returns. The mock-up's Leader row became the **Team** row: the
 * app records no leader for a person (hours are approved by any office role), but it does keep the Hours
 * tab's teams, and a returner's old team row is still there, so the row reads it.
 */

import type { LifecycleItem, LifecycleItemState } from './lifecycleChecklist'

/** Call 2: away this many days or fewer, the "give back old roadmap tasks" box starts ticked. */
export const ROADMAP_RETURN_DAYS = 90

/** Call 4: a returner knows the app, so training mode starts off (the office can tick it). */
export const RETURNER_TRAINING_MODE_DEFAULT = false

export type BringBackItemKind =
  | 'restore_halves'
  | 'sign_in'
  | 'wage'
  | 'team'
  | 'licenses'
  | 'paperwork'
  | 'hand_off_vehicle'
  | 'assign_housing'

export type BringBackAction =
  /** "Still theirs" for anyone who may bring back; Change… and Send sign-in email stay a dev's (as on the Access section). */
  | { kind: 'confirm_sign_in'; email: string }
  /** Keep or Change; Change is the main press (a raise is likely after time away). */
  | { kind: 'confirm_wage'; hourlyWage: number | null; isSalary: boolean }
  | { kind: 'link'; href: string; label: string }

export type BringBackItem = Omit<LifecycleItem, 'kind' | 'action' | 'blockedBy'> & {
  kind: BringBackItemKind
  action: BringBackAction | null
  /** The row reads red: something lapsed while they were away (an expired license). */
  lapsed?: boolean
}

export type BringBackFacts = {
  /** The day they are back, YYYY-MM-DD. */
  backYmd: string
  /** The end date their employment ended on, YYYY-MM-DD. */
  leftYmd: string
  hasLogin: boolean
  hasRosterRow: boolean
  /** The email they sign in with; null with no login. */
  signInEmail: string | null
  /** Last sign-in, YYYY-MM-DD; null when never or unknown. */
  lastSignInYmd: string | null
  /** The pay row: null when there is none. `setYmd` is when the wage was last changed, if known. */
  pay: { hourlyWage: number | null; isSalary: boolean; setYmd: string | null } | null
  /** Whether their kind works in a Hours-tab team (the field: helpers, leaders, subs). Office roles do not. */
  needsTeam: boolean
  /** The Hours-tab team they are on (the member row outlives an archive); null when none. */
  team: { id: string; name: string } | null
  licenses: Array<{ name: string; date_of_expiry: string | null }>
  /** Documents signed before they left. */
  paperworkSignedEarlier: { count: number; lastYmd: string | null }
  /** A packet or document assigned on or after the day back. */
  paperworkAssignedSinceBack: boolean
  vehiclesHeld: number
  housing: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseYmd(ymd: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function utcDay(ymd: string): number | null {
  const p = parseYmd(ymd)
  return p ? Date.UTC(p.y, p.m - 1, p.d) : null
}

/** Whole days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier); null on a bad date. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = utcDay(fromYmd)
  const b = utcDay(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / 86_400_000)
}

/** "Nov 3, 2026". */
export function longDate(ymd: string): string {
  const p = parseYmd(ymd)
  if (!p) return ymd
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`
}

/** "Jan 2026". */
export function monthYear(ymd: string): string {
  const p = parseYmd(ymd)
  if (!p) return ymd
  return `${MONTHS[p.m - 1]} ${p.y}`
}

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`
}

/**
 * How long they were away, in the largest whole unit: "3 years", "8 months", "2 weeks", "5 days".
 * Calendar years and months, so Nov 3, 2026 → Nov 5, 2029 is "3 years". Same day or earlier: "no time".
 */
export function awayWords(leftYmd: string, backYmd: string): string {
  const a = parseYmd(leftYmd)
  const b = parseYmd(backYmd)
  const days = daysBetweenYmd(leftYmd, backYmd)
  if (!a || !b || days == null || days <= 0) return 'no time'
  let months = (b.y - a.y) * 12 + (b.m - a.m)
  if (b.d < a.d) months -= 1
  if (months >= 12) return plural(Math.floor(months / 12), 'year')
  if (months >= 1) return plural(months, 'month')
  if (days >= 7) return plural(Math.floor(days / 7), 'week')
  return plural(days, 'day')
}

/** The line under the window's date: "Away 3 years · first stint Mar 4, 2024 to Nov 3, 2026". */
export function awayLine(args: { leftYmd: string; backYmd: string; firstStartYmd: string | null }): string {
  const away = `Away ${awayWords(args.leftYmd, args.backYmd)}`
  if (!args.firstStartYmd) return `${away} · left ${longDate(args.leftYmd)}`
  return `${away} · first stint ${longDate(args.firstStartYmd)} to ${longDate(args.leftYmd)}`
}

/** Call 2: the old-roadmap-tasks box starts ticked only when they were away 90 days or fewer. */
export function roadmapBoxDefault(leftYmd: string, backYmd: string): boolean {
  const days = daysBetweenYmd(leftYmd, backYmd)
  return days != null && days <= ROADMAP_RETURN_DAYS
}

/**
 * The box's words, or null when there is nothing parked to give back. `null` in is a count the viewer
 * cannot read (the parked table is a dev's), so the box shows without a number.
 */
export function roadmapBoxWords(parkedOpenTasks: number | null, leftYmd: string): string | null {
  if (parkedOpenTasks != null && parkedOpenTasks <= 0) return null
  const p = parseYmd(leftYmd)
  const when = p ? ` they had in ${p.y}` : ''
  if (parkedOpenTasks == null) return `Give back the open roadmap tasks${when}`
  return `Give back ${plural(parkedOpenTasks, 'open roadmap task')}${when}`
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The rows three years made stale, in the window's order. */
export function buildBringBackChecklist(f: BringBackFacts): BringBackItem[] {
  const items: BringBackItem[] = []

  items.push({
    id: 'restore_halves',
    kind: 'restore_halves',
    label: f.hasLogin ? 'Login and roster row' : 'Roster row',
    detail: f.hasLogin
      ? f.hasRosterRow
        ? 'Both come back together. CountTooling seat too.'
        : 'The login comes back. There is no roster row to restore.'
      : 'The roster row comes back. There is no login to restore.',
    state: 'done',
    action: null,
    canLeaveOpen: false,
  })

  if (f.hasLogin && f.signInEmail) {
    const last = f.lastSignInYmd ? `, last used ${monthYear(f.lastSignInYmd)}` : ''
    items.push({
      id: 'sign_in',
      kind: 'sign_in',
      label: 'Sign-in email',
      detail: `${f.signInEmail}${last}`,
      state: 'open',
      action: { kind: 'confirm_sign_in', email: f.signInEmail },
      canLeaveOpen: false,
    })
  } else {
    items.push({
      id: 'sign_in',
      kind: 'sign_in',
      label: 'Sign-in',
      detail: 'No login. A dev can invite them from their desk.',
      state: 'skipped',
      action: null,
      canLeaveOpen: false,
    })
  }

  // Call 3: the wage is always pressed — Keep or Change — and never left open.
  const wage = f.pay?.hourlyWage ?? null
  const set = f.pay?.setYmd ? `, set ${monthYear(f.pay.setYmd)}` : ''
  items.push({
    id: 'wage',
    kind: 'wage',
    label: 'Wage',
    detail:
      wage != null && wage > 0
        ? `${money(wage)} / h${f.pay?.isSalary ? ' salaried' : ''}${set}`
        : f.pay
          ? 'Pay row has no wage'
          : 'No pay setup',
    state: 'open',
    action: { kind: 'confirm_wage', hourlyWage: wage, isSalary: f.pay?.isSalary ?? false },
    canLeaveOpen: false,
  })

  if (!f.needsTeam) {
    items.push({ id: 'team', kind: 'team', label: 'Team', detail: 'Not needed for their kind', state: 'skipped', action: null, canLeaveOpen: true })
  } else if (f.team) {
    items.push({ id: 'team', kind: 'team', label: 'Team', detail: `On ${f.team.name}`, state: 'done', action: null, canLeaveOpen: true })
  } else {
    items.push({
      id: 'team',
      kind: 'team',
      label: 'Team',
      detail: 'On no team. The Hours tab groups the crew by team.',
      state: 'open',
      action: { kind: 'link', href: '/people?tab=hours&view=teams', label: 'Pick a team…' },
      canLeaveOpen: true,
    })
  }

  const lapsed = f.licenses
    .filter((l) => l.date_of_expiry && l.date_of_expiry < f.backYmd)
    .sort((a, b) => (a.date_of_expiry ?? '').localeCompare(b.date_of_expiry ?? ''))
  if (f.licenses.length === 0) {
    items.push({ id: 'licenses', kind: 'licenses', label: 'Licenses', detail: 'None on file', state: 'skipped', action: null, canLeaveOpen: true })
  } else if (lapsed.length > 0) {
    items.push({
      id: 'licenses',
      kind: 'licenses',
      label: 'Licenses',
      detail: lapsed.map((l) => `${l.name} expired ${monthYear(l.date_of_expiry as string)}`).join(' · '),
      state: 'open',
      action: { kind: 'link', href: '/people?tab=licenses', label: 'Update…' },
      canLeaveOpen: true,
      lapsed: true,
    })
  } else {
    items.push({
      id: 'licenses',
      kind: 'licenses',
      label: 'Licenses',
      detail: `${plural(f.licenses.length, 'license')} on file, none expired`,
      state: 'done',
      action: null,
      canLeaveOpen: true,
    })
  }

  if (f.paperworkAssignedSinceBack) {
    items.push({ id: 'paperwork', kind: 'paperwork', label: 'Paperwork', detail: 'Packet assigned for this stint', state: 'done', action: null, canLeaveOpen: true })
  } else {
    const earlier = f.paperworkSignedEarlier
    const year = parseYmd(earlier.lastYmd)?.y
    const before =
      earlier.count > 0 ? `${earlier.count} signed${year ? ` in ${year}` : ' before'}. None signed for this stint.` : 'Nothing assigned for this stint.'
    items.push({
      id: 'paperwork',
      kind: 'paperwork',
      label: 'Paperwork',
      detail: before,
      state: 'open',
      action: { kind: 'link', href: '/people?tab=contracts', label: 'Assign packet' },
      canLeaveOpen: true,
    })
  }

  items.push({
    id: 'hand_off_vehicle',
    kind: 'hand_off_vehicle',
    label: 'Vehicle',
    detail: f.vehiclesHeld > 0 ? `${f.vehiclesHeld} held` : 'None. Optional.',
    state: f.vehiclesHeld > 0 ? 'done' : 'skipped',
    action: f.vehiclesHeld > 0 ? null : { kind: 'link', href: '/people?tab=vehicles', label: 'Hand off…' },
    canLeaveOpen: false,
  })
  items.push({
    id: 'assign_housing',
    kind: 'assign_housing',
    label: 'Housing',
    detail: f.housing > 0 ? 'Assigned' : 'None. Optional.',
    state: f.housing > 0 ? 'done' : 'skipped',
    action: f.housing > 0 ? null : { kind: 'link', href: '/people?tab=housing', label: 'Assign…' },
    canLeaveOpen: false,
  })

  return items
}

/** The finish button's words: "Bring back" when nothing is open, else "Bring back · 4 open". */
export function bringBackButtonLabel(items: ReadonlyArray<{ state: LifecycleItemState }>): string {
  const open = items.filter((i) => i.state === 'open').length
  return open === 0 ? 'Bring back' : `Bring back · ${open} open`
}

/** The one dated, factual HR-file line Bring back appends (the mirror of `endEmploymentHrLine`). */
export function bringBackHrLine(args: { displayName: string; leftYmd: string; backYmd: string; items: BringBackItem[] }): string {
  const parts = [`Back on ${args.backYmd} for ${args.displayName}, after ${awayWords(args.leftYmd, args.backYmd)} away.`]
  const left = args.items
    .filter((i) => i.state === 'left_open')
    .map((i) => `${i.label.toLowerCase()}${i.leaveReason ? ` (${i.leaveReason})` : ''}`)
  if (left.length > 0) parts.push(`Left open on purpose: ${left.join(', ')}.`)
  return parts.join(' ')
}

/** "Ended by mistake? Undo the end instead": the HR line when the end is undone and the old stint reopens. */
export function undoEndHrLine(args: { displayName: string; leftYmd: string; todayYmd: string }): string {
  return `Employment end of ${args.leftYmd} undone for ${args.displayName} on ${args.todayYmd}: ended by mistake.`
}

export type ArchivedPerson = {
  id: string
  name: string
  email: string | null
  /** The day their employment ended, YYYY-MM-DD; null when archived with no end date. */
  leftYmd: string | null
  /** PR 4 (v2.6525): the halves behind the match, so Hire can open their desk's Bring back window. */
  userId?: string | null
  personId?: string | null
}

export type ArchivedUserRow = { id: string; name: string | null; email: string | null }
export type ArchivedPeopleRow = { id: string; name: string; email: string | null; end_date: string | null; account_user_id: string | null; archived_at: string | null }

/**
 * The archived people + Hire checks against, one entry a person: an archived account with its roster
 * row (the row's name, end date and email beside the account's email), an archived account with no
 * row, and an archived roster row with no account. A roster row still active beside an archived
 * account rides along for its end date, since End employment before v2.6523 could leave it so.
 */
export function mergeArchivedRows(users: readonly ArchivedUserRow[], people: readonly ArchivedPeopleRow[]): ArchivedPerson[] {
  const out: ArchivedPerson[] = []
  const rowsByAccount = new Map<string, ArchivedPeopleRow>()
  for (const p of people) if (p.account_user_id && !rowsByAccount.has(p.account_user_id)) rowsByAccount.set(p.account_user_id, p)
  const seenPeople = new Set<string>()
  for (const u of users) {
    const row = rowsByAccount.get(u.id) ?? null
    if (row) seenPeople.add(row.id)
    out.push({ id: u.id, name: (row?.name ?? u.name ?? '').trim(), email: u.email ?? row?.email ?? null, leftYmd: row?.end_date ?? null, userId: u.id, personId: row?.id ?? null })
  }
  for (const p of people) {
    if (seenPeople.has(p.id) || !p.archived_at) continue
    out.push({ id: p.id, name: p.name.trim(), email: p.email, leftYmd: p.end_date, userId: p.account_user_id, personId: p.id })
  }
  return out.filter((a) => a.name !== '' || a.email)
}

export type ArchivedMatch = { person: ArchivedPerson; by: 'name' | 'email' | 'both' }

function normName(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function normEmail(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * + Hire's check against archived people: the same name (spaces and case aside) or the same email.
 * A match on both beats one on either; among equals the most recent leaver wins, since a returner is
 * likelier the one who left last.
 */
export function findArchivedMatch(input: { name: string; email: string }, archived: readonly ArchivedPerson[]): ArchivedMatch | null {
  const n = normName(input.name)
  const e = normEmail(input.email)
  if (!n && !e) return null
  let best: ArchivedMatch | null = null
  const rank = (by: ArchivedMatch['by']) => (by === 'both' ? 2 : 1)
  for (const p of archived) {
    const byName = n !== '' && normName(p.name) === n
    const byEmail = e !== '' && normEmail(p.email) === e
    if (!byName && !byEmail) continue
    const by: ArchivedMatch['by'] = byName && byEmail ? 'both' : byName ? 'name' : 'email'
    if (
      !best ||
      rank(by) > rank(best.by) ||
      (rank(by) === rank(best.by) && (p.leftYmd ?? '') > (best.person.leftYmd ?? ''))
    ) {
      best = { person: p, by }
    }
  }
  return best
}

/** The amber line the Hire form shows on a match, and the press that opens Bring back. */
export function archivedMatchWords(m: ArchivedMatch): { headline: string; detail: string; bringBackLabel: string } {
  const first = m.person.name.trim().split(/\s+/)[0] || m.person.name
  const headline = m.person.leftYmd ? `${m.person.name} left on ${longDate(m.person.leftYmd)}.` : `${m.person.name} is archived.`
  return {
    headline,
    detail: 'Their hours, logbook and HR file are on that account.',
    bringBackLabel: `Bring back ${first}`,
  }
}

// ---------------------------------------------------------------------------
// The writes (PR 3, v2.6523): an ordered plan the window runs one step at a time.
// ---------------------------------------------------------------------------

export type BringBackWrite =
  /** `restore-user`: the login back, the ban lifted, the parked roadmap rows kept or dropped first. */
  | { kind: 'restore_login'; userId: string; restoreRoadmap: boolean }
  /** ONE update on the roster row: the trigger reads the pair together, so the end and the start change in one statement. */
  | { kind: 'roster'; personId: string; patch: { archived_at: null; start_date?: string; end_date: null } }
  /** Call 4: training mode as the box says, off by default for a returner. */
  | { kind: 'training_mode'; userId: string; on: boolean }
  /** The wage row's Change… press, keyed by the pay name as the desk's upsert is. */
  | { kind: 'wage'; payName: string; personId: string | null; hourlyWage: number }
  /** One dated line on the HR file (a dev's write; the table is append-only). */
  | { kind: 'hr_line'; personId: string; entryDate: string; content: string }

export type BringBackPlanInput = {
  userId: string | null
  /** The account half is archived (a login or a #260 row with none). */
  loginArchived: boolean
  personId: string | null
  payName: string | null
  displayName: string
  leftYmd: string
  backYmd: string
  restoreRoadmap: boolean
  trainingMode: boolean
  /** Training mode as the account has it now: the write runs only when the box differs from it. */
  trainingWas: boolean
  /** The new wage when Change… was pressed; null after Keep. */
  wageChange: number | null
  hrNote: boolean
  items: BringBackItem[]
}

/**
 * Bring back, in order: the login (so the roadmap flag runs before the roster row flips back), the roster
 * row in one statement (archived cleared, the end cleared, the start the day back: the trigger opens a new
 * stint beside the old one), training mode, the wage when it changed, the HR line.
 */
export function planBringBackWrites(a: BringBackPlanInput): BringBackWrite[] {
  const out: BringBackWrite[] = []
  if (a.userId && a.loginArchived) out.push({ kind: 'restore_login', userId: a.userId, restoreRoadmap: a.restoreRoadmap })
  if (a.personId) out.push({ kind: 'roster', personId: a.personId, patch: { archived_at: null, start_date: a.backYmd, end_date: null } })
  if (a.userId && a.trainingMode !== a.trainingWas) out.push({ kind: 'training_mode', userId: a.userId, on: a.trainingMode })
  if (a.wageChange != null && a.wageChange > 0 && a.payName) out.push({ kind: 'wage', payName: a.payName, personId: a.personId, hourlyWage: a.wageChange })
  if (a.hrNote && a.personId) {
    out.push({ kind: 'hr_line', personId: a.personId, entryDate: a.backYmd, content: bringBackHrLine({ displayName: a.displayName, leftYmd: a.leftYmd, backYmd: a.backYmd, items: a.items }) })
  }
  return out
}

/**
 * "Ended by mistake? Undo the end instead": the login back with its roadmap rows, the roster row back with
 * the end cleared and the start kept (the trigger reopens the old stint, no new one), one HR line.
 */
export function planUndoEndWrites(a: { userId: string | null; loginArchived: boolean; personId: string | null; displayName: string; leftYmd: string; todayYmd: string; hrNote: boolean }): BringBackWrite[] {
  const out: BringBackWrite[] = []
  if (a.userId && a.loginArchived) out.push({ kind: 'restore_login', userId: a.userId, restoreRoadmap: true })
  if (a.personId) out.push({ kind: 'roster', personId: a.personId, patch: { archived_at: null, end_date: null } })
  if (a.hrNote && a.personId) out.push({ kind: 'hr_line', personId: a.personId, entryDate: a.todayYmd, content: undoEndHrLine({ displayName: a.displayName, leftYmd: a.leftYmd, todayYmd: a.todayYmd }) })
  return out
}

/** The day back must be a day, on or after the day they left: before it the trigger would move the old stint instead of opening a new one. */
export function bringBackDateProblem(leftYmd: string, backYmd: string): string | null {
  if (!parseYmd(backYmd)) return 'Pick the day they are back.'
  const days = daysBetweenYmd(leftYmd, backYmd)
  if (days == null) return 'Pick the day they are back.'
  if (days < 0) return `The day back is before ${longDate(leftYmd)}, the day they left. Ended by mistake? Undo the end instead.`
  return null
}

/** The footer's one line: what the press will do. `accountArchived` with no login is a #260 row: the account comes back, nothing signs in. */
export function bringBackFooterWords(a: { hasLogin: boolean; accountArchived?: boolean; hasRosterRow: boolean; backYmd: string; hrNote: boolean }): string {
  const parts: string[] = []
  const half = a.hasLogin ? 'the login' : a.accountArchived ? 'the account' : null
  if (half && a.hasRosterRow) parts.push(`Restores ${half} and roster row.`)
  else if (half) parts.push(`Restores ${half}.`)
  else if (a.hasRosterRow) parts.push('Restores the roster row.')
  if (a.hasRosterRow) parts.push(`Opens a stint from ${longDate(a.backYmd)}.`)
  if (a.hrNote) parts.push('Adds one line to the HR file.')
  return parts.join(' ')
}

/** Whether a kind works in a Hours-tab team: the field, not the office. */
export function kindNeedsTeam(kind: string | null | undefined): boolean {
  return kind === 'helper' || kind === 'sub' || kind === 'master_technician'
}

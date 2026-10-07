/**
 * GC mode — design spike: the weekly report to the customer (Building lane, the owner's go-ahead
 * 2026-10-05; mock-up artifact 7rjejsyWCFv523rrii7RCi). Friday afternoon each job being built has
 * a draft drawn from the week's records: the daily logs, the schedule and its finish forecast,
 * inspections, submittals, what held work up, next week's look-ahead and change orders. The office
 * reads it, adds a line and sends it, from me by default. It never goes out on its own. It never
 * names our costs or a trade's price, and names a company only when the office ticks it.
 *
 * Import from `./gcModel`.
 */
import type { GcProject, GcState, SubmittalKind } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, lookAheadWeeks, milestoneRows, mondayOf, projectedFinish, scheduleRows, scheduleSummary, substantialCompletionOn } from './gcBuildingSchedule'
import { customerAsks, customerChanges, customerStages } from './gcCustomerSchedule'
import { dailyLogOn, isWorkday } from './gcBuildingLog'
import { submittalRowsOn } from './gcBuildingSubmittals'
import { partnerById } from './gcLookups'
import { shortDate, weekdayDate } from './gcWords'
import { lateFinish } from './gcLateFinish'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { WeeklyReport, WeeklySection, WeeklySectionKey } from '../gc/buildingWeekly'
import { WEEKLY_SECTIONS } from '../gc/buildingWeekly'
export type { WeeklyChoice, WeeklyReport, WeeklySection, WeeklySectionKey } from '../gc/buildingWeekly'
export { WEEKLY_REPORT_DAY, WEEKLY_SECTIONS, latestWeeklyReports, weeklyReportReady, weeklyReportSent, weeklyReportText } from '../gc/buildingWeekly'

const KIND_WORDS: Record<SubmittalKind, string> = { 'product data': 'product data', 'shop drawings': 'shop drawings', samples: 'samples' }

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function sentence(text: string): string {
  const t = text.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

function weekdayShort(iso: string): string {
  return weekdayDate(iso).split(' ')[0] ?? iso
}

const WEEKDAY_NAMES: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

/** "Monday", for a day this week. */
function weekdayName(iso: string): string {
  const short = weekdayShort(iso)
  return WEEKDAY_NAMES[short] ?? short
}

/** "Lighting" → "lighting", but "TPO membrane" stays as it is. */
function lowerFirst(text: string): string {
  return text.length > 1 && text.charAt(1) === text.charAt(1).toLowerCase() ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

/**
 * The report for a job's week (Monday `weekOf`), from what the records hold up to today.
 * `names`: say a company's name where it would say its trade.
 */
export function weeklyReport(state: GcState, project: GcProject, weekOf = mondayOf(state.today), names = false): WeeklyReport {
  const today = state.today
  const weekEnd = addDays(weekOf, 6)
  const upTo = today < weekEnd ? today : weekEnd
  const inWeek = (d: string | null | undefined) => !!d && d >= weekOf && d <= upTo
  const customer = state.customers.find((c) => c.id === project.customerId) ?? null
  const architectRecord = state.customers.find((c) => c.id === project.architectId) ?? null
  const contact = customer?.contact || customer?.name || project.owner
  const to = { name: contact, first: contact.split(/\s+/)[0] ?? contact, email: customer?.email ?? '' }
  const architect = architectRecord ? { name: architectRecord.name, email: architectRecord.email } : project.architect ? { name: project.architect, email: '' } : null
  const who = (packageId: string | null) => {
    const pkg = project.packages.find((k) => k.id === packageId)
    if (!pkg) return 'Our own work'
    if (pkg.selfPerform) return pkg.trade
    if (!names) return pkg.trade
    const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
    return (partnerId ? partnerById(state, partnerId)?.company : undefined) ?? pkg.trade
  }
  const sections: WeeklySection[] = []
  const hints: Partial<Record<WeeklySectionKey, string>> = {}
  const push = (key: WeeklySectionKey, lines: string[], hint?: string) => {
    if (lines.length === 0) return
    sections.push({ key, title: WEEKLY_SECTIONS.find((s) => s.key === key)?.title ?? key, lines })
    if (hint) hints[key] = hint
  }

  // At a glance: the finish against the contract, the work against the plan, the next milestone.
  const sum = scheduleSummary(project, today)
  const finish = projectedFinish(project, today)
  const contract = substantialCompletionOn(project)
  const glance: string[] = []
  if (finish) {
    const past = contract ? daysBetween(contract.on, finish.on) : null
    glance.push(
      past === null
        ? `Finish: about ${weekdayDate(finish.on)}.`
        : past > 0
          ? `Finish: about ${weekdayDate(finish.on)}. That is ${days(past)} past the ${shortDate(contract?.on ?? null)} in your contract.`
          : past === 0
            ? `Finish: about ${weekdayDate(finish.on)}. Your contract says ${shortDate(contract?.on ?? null)}, so there are no days to spare.`
            : `Finish: about ${weekdayDate(finish.on)}, ${days(-past)} ahead of the ${shortDate(contract?.on ?? null)} in your contract.`,
    )
    // Whose the late days are, in the customer's words (G-98). Only when the finish runs past the contract.
    glance.push(...lateFinish(state, project).customerWords)
  }
  if (sum) {
    const pace = sum.daysBehind > 0 ? `so we are ${days(sum.daysBehind)} behind` : sum.daysBehind < 0 ? `so we are ${days(-sum.daysBehind)} ahead` : 'right on plan'
    glance.push(`${Math.round(sum.donePct)}% of the work is done. ${Math.round(sum.plannedPct)}% was planned by now, ${pace}.`)
    if (sum.milestones.next) glance.push(`Next: ${sum.milestones.next.label}, ${weekdayDate(sum.milestones.next.planned)}.`)
  }
  push('glance', glance, 'Finish, percent done, next milestone')

  // The schedule picture (the Gantt, G-93): the stages as the customer's portal draws them, what changed this week, what we need from them.
  const scheduleLines: string[] = []
  for (const s of customerStages(state, project)) {
    if (s.state === 'done') continue
    const stand = s.state === 'behind' ? `behind, ${Math.round(s.pct)}% done` : s.state === 'underway' ? `under way, ${Math.round(s.pct)}% done` : `starts ${weekdayDate(s.start)}`
    scheduleLines.push(`${s.label}: ${stand}, ${shortDate(s.start)} to ${shortDate(s.finish)}.`)
  }
  const changed = customerChanges(project, today)
  if (changed.length > 0) scheduleLines.push(`What changed this week: ${changed.join(' ')}`)
  for (const ask of customerAsks(project)) scheduleLines.push(`We need from you: ${ask.words}`)
  push('schedule', scheduleLines, 'The stages, what changed, what we need from you')

  // This week: each day's log in the superintendent's words, then how many were on site.
  const logs = (project.dailyLogs ?? []).filter((l) => inWeek(l.date)).sort((a, b) => (a.date < b.date ? -1 : 1))
  const week: string[] = []
  for (const l of logs) {
    const visit = l.visitors && !/inspect/i.test(l.visitors) ? ` ${sentence(l.visitors)}` : ''
    const stop = l.weatherStop ? ' Work stopped for the weather.' : ''
    week.push(`${weekdayShort(l.date)}: ${sentence(l.done || 'Work went on.')}${stop}${visit}`)
  }
  const heads = logs.map((l) => l.crews.reduce((n, c) => n + c.workers, 0)).filter((n) => n > 0)
  if (heads.length > 0) {
    const low = Math.min(...heads)
    const high = Math.max(...heads)
    const trades = new Set(logs.flatMap((l) => l.crews.filter((c) => c.workers > 0).map((c) => c.packageId))).size
    week.push(`${low === high ? `${high}` : `${low} to ${high}`} people a day on site, from ${trades} ${trades === 1 ? 'trade' : 'trades'}.`)
  }
  const subs = submittalRowsOn(project, today)
  for (const r of subs) {
    if (r.approvedOn && inWeek(r.approvedOn)) week.push(`The ${lowerFirst(r.submittal.title)} ${KIND_WORDS[r.submittal.kind]} were approved.`)
  }
  push('week', week, `From ${logs.length} daily ${logs.length === 1 ? 'log' : 'logs'}`)

  // Inspections: failed or passed this week, and when one is checked again.
  const inspections: string[] = []
  let failedCount = 0
  for (const a of project.schedule?.activities ?? []) {
    const insp = a.inspection
    if (!insp) continue
    for (const f of insp.failed ?? []) {
      if (!inWeek(f.on)) continue
      failedCount += 1
      const again = f.reinspectOn === today ? 'today' : weekdayDate(f.reinspectOn)
      inspections.push(`The ${lowerFirst(insp.label)} did not pass ${weekdayName(f.on)}: ${sentence(lowerFirst(f.note))} The city checks it again ${again}.`)
    }
    if (insp.passedOn && inWeek(insp.passedOn)) inspections.push(`The ${lowerFirst(insp.label)} passed ${weekdayName(insp.passedOn)}.`)
  }
  push('inspections', inspections, failedCount > 0 ? `${failedCount} did not pass` : undefined)

  // What we are watching: milestones behind, what held work up, submittals waiting.
  const watching: string[] = []
  for (const m of milestoneRows(state, project)) {
    if (m.state === 'late') watching.push(`${m.milestone.label} is ${days(m.daysLate)} behind.`)
  }
  const seen = new Set<string>()
  for (const l of logs) {
    for (const d of l.delays) {
      const line = `${who(d.packageId)}: ${sentence(d.note || d.reason)}`
      if (!seen.has(line)) {
        seen.add(line)
        watching.push(line)
      }
    }
  }
  const architectName = architect?.name ?? 'the architect'
  for (const r of subs) {
    const what = `The ${lowerFirst(r.submittal.title)} ${KIND_WORDS[r.submittal.kind]}`
    if (r.state === 'architect') watching.push(`${what} are with ${architectName} for approval.`)
    else if (r.state === 'us') watching.push(`${what} are in. We send them to ${architectName} next.`)
    else if (r.state === 'trade' && r.daysLate > 0) watching.push(`${what} are ${days(r.daysLate)} late from ${names ? who(r.submittal.packageId) : 'the trade'}.`)
  }
  push('watching', watching)

  // Next week: the look-ahead's work by trade, its inspections, and a milestone due within two weeks.
  const rows = scheduleRows(state, project)
  const nextWeek = lookAheadWeeks(project, rows, today).find((w) => w.weekOf === addDays(weekOf, 7))
  const next: string[] = []
  if (nextWeek) {
    const byTrade = new Map<string, string[]>()
    for (const i of nextWeek.items) byTrade.set(i.row.trade, [...(byTrade.get(i.row.trade) ?? []), lowerFirst(i.row.label)])
    for (const [trade, labels] of byTrade) next.push(`${trade}: ${labels.join(', ')}.`)
    for (const i of nextWeek.inspections) if (i.activity.inspection) next.push(`The ${lowerFirst(i.activity.inspection.label)}, ${weekdayDate(i.activity.start)}.`)
  }
  for (const m of milestoneRows(state, project)) {
    const already = next.some((l) => l.toLowerCase().includes(m.milestone.label.toLowerCase()))
    if (m.state === 'due' && m.due > upTo && m.due <= addDays(weekOf, 13) && !already) next.push(`${m.milestone.label}: ${weekdayDate(m.due)}.`)
  }
  push('next', next, nextWeek ? 'From the look-ahead' : undefined)

  // Changes: signed this week, and waiting on them.
  const changes: string[] = []
  for (const co of project.changeOrders ?? []) {
    if (co.status === 'signed' && inWeek(co.answeredOn)) changes.push(`You signed change order ${co.number}: ${sentence(co.description)}${co.days ? ` It adds ${days(co.days)}.` : ''}`)
    if (co.status === 'sent') changes.push(`Change order ${co.number} waits on your signature: ${sentence(co.description)}`)
  }
  push('changes', changes)

  // The working days before today with no log, not before work started.
  const missing: string[] = []
  for (let d = weekOf; d < today && d <= addDays(weekOf, 4); d = addDays(d, 1)) {
    if (isWorkday(d) && (!project.startedOn || d >= project.startedOn) && !dailyLogOn(project, d)) missing.push(d)
  }

  return {
    projectId: project.id,
    weekOf,
    customer,
    to,
    architect,
    sections,
    logs: logs.length,
    missing,
    hints,
    nextTrades: nextWeek ? [...new Set(nextWeek.items.map((i) => i.row.trade))] : [],
    subject: `${project.name} · week of ${shortDate(weekOf)}`,
  }
}

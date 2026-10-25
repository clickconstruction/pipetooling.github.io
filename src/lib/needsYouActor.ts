import type { UserRole } from '../hooks/useAuth'
import type { NeedsYouItem } from './dashboardNeedsYou'

/**
 * Whose line it is (punch list #176, change 3). The Needs you builder gates each source by role,
 * and one office gate covers the owner, the assistant and the controller, so the owner's card
 * held the assistant's chores and the assistant's station held the owner's calls, in one
 * worst-first list. Every line now names its **actor**: the person who presses its button. The
 * card leads with the viewer's own lines and folds the rest by actor, so the owner reads his
 * seven and sees the office is on the rest, and the assistant works her lines and sees what
 * waits on the owner without owning it. The gate is unchanged; this is the second column.
 * Pure: items and a role in, groups out.
 */
export type NeedsYouActor = 'assistant' | 'owner' | 'controller' | 'estimator' | 'dev' | 'anyone'

/** The actor of every line. `anyone` is the viewer's whoever they are: their own card purchases, and the customers, the portal and the GC projects waiting on an answer, which the whole office answers. */
export const NEEDS_YOU_ITEM_ACTOR: Record<NeedsYouItem['key'], NeedsYouActor> = {
  // The office's chores: money to apply, paper to send, records to fill in, the lien desk's drafting.
  'ar-deposits': 'assistant',
  'returned-check': 'assistant',
  'tally-team': 'assistant',
  'lost-bids': 'assistant',
  'statement-round': 'assistant',
  'job-followups': 'assistant',
  'customer-messages': 'anyone',
  'todays-sends': 'anyone',
  'gc-review-weekly': 'assistant',
  'lien-serve-copy': 'assistant',
  'lien-tracking-owed': 'assistant',
  'docsmit-credit': 'assistant',
  'lien-notice-draft': 'assistant',
  'lien-window-missed': 'assistant',
  'lien-file-window': 'assistant',
  'owner-records-signed': 'assistant',
  'demand-deadline': 'assistant',
  'lien-unconditional': 'assistant',
  'hours-approvals': 'assistant',
  'contract-missing': 'assistant',
  'contract-stale': 'assistant',
  'work-orders-unpriced': 'assistant',
  'jobs-stale-open': 'assistant',
  'dispatch-requests-aged': 'assistant',
  'job-account-missing': 'assistant',
  'job-account-window': 'assistant',
  'vehicle-records-missing': 'assistant',
  'test-reports-ready': 'assistant',
  'gc-follow-up': 'anyone',
  'customer-waiting': 'anyone',
  'legal-firm-activity': 'assistant',
  // The owner's calls: approvals, signatures, reviews, the alerts.
  'lien-notice-approve': 'owner',
  'lien-notice-sign': 'owner',
  'lien-notice-batch': 'owner',
  'lien-suit-year': 'owner',
  'lien-waivers-to-sign': 'owner',
  'team-reviews': 'owner',
  'legal-review': 'owner',
  'capacity-under': 'owner',
  'bulk-delete': 'owner',
  'bulk-hours': 'owner',
  'claim-dev': 'owner',
  'typed-hours': 'owner',
  // The controller's.
  'label-approvals': 'controller',
  'contract-clauses': 'controller',
  // The estimator's: bids, pricing, robots, submittals.
  'bid-followups': 'estimator',
  'money-on-my-bids': 'estimator',
  'paid-claims-stale': 'estimator',
  'robot-audits': 'estimator',
  'robot-locked': 'estimator',
  'robot-asleep': 'estimator',
  'robot-blocked': 'estimator',
  'robot-answered': 'estimator',
  'd22-uncoded': 'estimator',
  'price-matrix-ready': 'estimator',
  'price-requests-late': 'estimator',
  'submittal-not-started': 'estimator',
  'submittal-unopened': 'estimator',
  'submittal-sent-back': 'estimator',
  'submittal-lead-time': 'estimator',
  // A dev's.
  'roadmap-needs-person': 'dev',
  'hr-reports-pending': 'dev',
  'robot-backlog': 'dev',
  // The viewer's own, whoever they are: their card purchases, and the conversations the whole office answers.
  'tally-self': 'anyone',
}

export function needsYouActorOf(item: Pick<NeedsYouItem, 'key'>): NeedsYouActor {
  return NEEDS_YOU_ITEM_ACTOR[item.key]
}

/** The actors a role presses for. The dev is the owner's own account here, so a dev reads as the owner too. */
export function needsYouViewerActors(role: UserRole | null | undefined): ReadonlySet<NeedsYouActor> {
  switch (role) {
    case 'dev':
      return new Set<NeedsYouActor>(['dev', 'owner', 'anyone'])
    case 'master_technician':
      return new Set<NeedsYouActor>(['owner', 'anyone'])
    case 'assistant':
      return new Set<NeedsYouActor>(['assistant', 'anyone'])
    case 'controller':
      return new Set<NeedsYouActor>(['controller', 'anyone'])
    case 'estimator':
    case 'primary':
      return new Set<NeedsYouActor>(['estimator', 'anyone'])
    default:
      return new Set<NeedsYouActor>(['anyone'])
  }
}

/** The fold's heading for lines that are someone else's. */
export const NEEDS_YOU_FOLD_LABEL: Record<Exclude<NeedsYouActor, 'anyone'>, string> = {
  assistant: 'The office is on these',
  controller: 'The controller is on these',
  estimator: 'The estimators are on these',
  owner: 'Waiting on the owner',
  dev: 'A dev is on these',
}

const FOLD_ORDER: ReadonlyArray<Exclude<NeedsYouActor, 'anyone'>> = ['assistant', 'controller', 'estimator', 'owner', 'dev']

export type NeedsYouFold<T> = { actor: Exclude<NeedsYouActor, 'anyone'>; label: string; items: T[] }
export type NeedsYouGroups<T> = {
  /** The viewer's own lines, in the order given. */
  yours: T[]
  /** Everyone else's, one fold per actor with lines, office first, then the controller, the estimators, the owner, a dev. */
  folds: NeedsYouFold<T>[]
}

/** The viewer's lines first, the rest folded by actor. The order inside each group is the order given (worst first). */
export function groupNeedsYouItems<T extends Pick<NeedsYouItem, 'key'>>(items: ReadonlyArray<T>, role: UserRole | null | undefined): NeedsYouGroups<T> {
  const mine = needsYouViewerActors(role)
  const yours: T[] = []
  const byActor = new Map<Exclude<NeedsYouActor, 'anyone'>, T[]>()
  for (const it of items) {
    const actor = needsYouActorOf(it)
    if (mine.has(actor)) yours.push(it)
    else if (actor !== 'anyone') {
      const list = byActor.get(actor) ?? []
      list.push(it)
      byActor.set(actor, list)
    }
  }
  const folds: NeedsYouFold<T>[] = []
  for (const actor of FOLD_ORDER) {
    const list = byActor.get(actor)
    if (list && list.length > 0) folds.push({ actor, label: NEEDS_YOU_FOLD_LABEL[actor], items: list })
  }
  return { yours, folds }
}

/** The walk's order across the groups: the viewer's lines, then each fold's, so Walk the list still reaches everything. */
export function needsYouWalkItems<T extends Pick<NeedsYouItem, 'key'>>(groups: NeedsYouGroups<T>): T[] {
  return [...groups.yours, ...groups.folds.flatMap((f) => f.items)]
}

/** "84 live jobs have no contract on file · 50 jobs bought parts … · 3 more" — the fold's one line while closed. */
export function needsYouFoldSummary(items: ReadonlyArray<Pick<NeedsYouItem, 'title'>>, shown = 3): string {
  const head = items.slice(0, shown).map((i) => i.title)
  const rest = items.length - head.length
  return rest > 0 ? `${head.join(' · ')} · ${rest} more` : head.join(' · ')
}

/** The header's words beside the count: "7 yours" and "24 for others", or '' when every line is the viewer's. */
export function needsYouHeaderWords<T>(groups: NeedsYouGroups<T>): { yours: string; others: string } {
  const others = groups.folds.reduce((n, f) => n + f.items.length, 0)
  return { yours: `${groups.yours.length} yours`, others: others > 0 ? `${others} for others` : '' }
}

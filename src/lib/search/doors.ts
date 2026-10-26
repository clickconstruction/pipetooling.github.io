/**
 * Go anywhere (punch list #181, PR 1): one index of every door the app has, so the header's box can open a page, a
 * Settings card, a guide, a window or a to-do by name. Every door carries its words, the link that already works, and
 * a gate that reads the helper the app already trusts for the same question, so a person never sees a door they cannot
 * open. The box (PR 2) draws `searchDoors` over `doorsFor(viewer)`; the Dev doors card keeps reading `DEV_DOORS`, which
 * this index folds in, and `isDevOnly` says which of these doors open for a dev alone.
 *
 * Pure: no React, no supabase, no Vite. The two sources that live in Vite-only modules, the guides (`import.meta.glob`)
 * and the punch list (`virtual:punch-list`), are handed in through `DoorSources`, so `doors.test.ts` can build the
 * whole index in node and hold it against `src/App.tsx`, the Settings groups and anchors, and the route guard.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from '../subcontractorLikeRole'
import { isPathAllowedForRole } from '../layoutRouteAccess'
import { canAccessBanking } from '../bankingAccess'
import { canOpenRoadmap } from '../roadmapVisibility'
import { canOpenGcProjects, canOpenMessages, canSeeGcMoney } from '../gc/access'
import { canOpenPunchList, PUNCH_LIST_PATH } from '../todos/punchListAccess'
import { canOpenMoneyfill } from '../quickfill/closeWeekChip'
import { canOpenDayBook } from '../people/dayBookAccess'
import { getZonedSettingsGroups, SETTINGS_ZONE_LABELS, type SettingsGroupDef } from '../settingsGroups'
import { SETTINGS_SEARCH_INDEX, type SettingsSearchEntry } from '../settingsSearch'
import { SETTINGS_HASH_ANCHOR_TO_TAB } from '../settingsDeepLink'
import { HELP_GUIDE_URL_PARAM } from '../helpGuideUrlParam'
import { BIDS_TABS, bidsTabOpenFor, canOpenBids, type BidsTabKey } from '../bids/bidsTabAccess'
import { canWorkRobotAudits } from '../bids/bidAudits'
import { DEV_DOORS, type DevDoor, type DevDoorWho } from '../settings/devDoors'
import { guideIsRelevantForRole, type HelpGuide } from '../helpGuides'
import { KIND_PILLS } from '../messages/kindPills'
import { GROUP_LABELS, type BoardGroup } from '../todos/todoBoard'
import { ROLES } from '../userRoles'

export type DoorKind = 'page' | 'window' | 'settings' | 'guide' | 'todo'

/** The group a door is drawn under: a window is a place too, so it draws with the pages. */
export type DoorGroupKey = 'page' | 'settings' | 'guide' | 'todo'

export const DOOR_GROUP_ORDER: readonly DoorGroupKey[] = ['page', 'settings', 'guide', 'todo']

export const DOOR_GROUP_LABELS: Readonly<Record<DoorGroupKey, string>> = {
  page: 'Pages',
  settings: 'Settings',
  guide: 'Guides',
  todo: 'Punch list',
}

export function doorGroupKey(kind: DoorKind): DoorGroupKey {
  return kind === 'window' ? 'page' : kind
}

/** Who is looking: the role and the per-person flags the route guard and the nav read. */
export interface DoorViewer {
  role: UserRole
  estimatorProspectsAccess: boolean
  teamProspectsAccess: boolean
  farmModeActive: boolean
}

export interface Door {
  /** Stable, unique: `page:/jobs?tab=stages`, `settings:settings-phone-texts-hours`, `guide:<slug>`, `todo:126`, `dev:<id>`. */
  id: string
  kind: DoorKind
  /** The row's words, as the screen prints the door's name. */
  label: string
  /** The row's muted line: where the door is. */
  where: string
  /** What people type for it: synonyms, the old name, the directory's task line. Lowercase. */
  words: readonly string[]
  /** The link that already works: a route with the query or hash that opens the tab, card or window. */
  to: string
  gate: (viewer: DoorViewer) => boolean
  /** A window door's proof that its link opens something: the file that reads its query key, and the read itself. */
  reads?: { file: string; text: string }
  /** A second press on the row: a guide's **Go there**, the page the guide is about (its `where:` line). */
  also?: { label: string; to: string }
}

/** The sources that live in Vite-only modules, handed in by the caller. */
export interface DoorSources {
  guides?: readonly HelpGuide[]
  todos?: readonly { number: number; name: string; group: BoardGroup }[]
}

// ---------------------------------------------------------------------------
// Gates — every one reads a helper the app already uses for the same door.
// ---------------------------------------------------------------------------

type Gate = (viewer: DoorViewer) => boolean

const everyone: Gate = () => true
const dev: Gate = (v) => v.role === 'dev'
const ownerOrDev: Gate = (v) => v.role === 'dev' || v.role === 'master_technician'
/** dev · master · assistant · controller — the roles `Layout` draws the office nav for. */
const office: Gate = (v) => v.role === 'dev' || v.role === 'master_technician' || isAssistantLike(v.role)
const officeOrSuper: Gate = (v) => office(v) || v.role === 'superintendent'
const officeOrEstimator: Gate = (v) => office(v) || v.role === 'estimator'
const notField: Gate = (v) => !isSubcontractorLikeRole(v.role)
const notFarm = (g: Gate): Gate => (v) => !v.farmModeActive && g(v)
const role = (...roles: UserRole[]): Gate => (v) => roles.includes(v.role)

/** The Dev doors card's `who`, as a gate. */
function whoGate(who: DevDoorWho): Gate {
  switch (who) {
    case 'dev':
      return dev
    case 'dev and controller':
      return role('dev', 'controller')
    case 'owner or dev':
      return ownerOrDev
    case 'controller':
      return role('controller')
  }
}

/** The route part of a link: `/jobs?tab=stages&legal=1` → `/jobs`, `/settings#settings-page-pins` → `/settings`. */
export function doorPath(to: string): string {
  return to.replace(/[?#].*$/, '') || '/'
}

/** The Settings tab a link lands on: its `?tab=`, else the tab that owns its `#anchor`, else a hash that names a tab. */
function settingsTabOf(to: string): string | null {
  if (!to.startsWith('/settings')) return null
  const hash = /#(settings-[a-z0-9-]+)/.exec(to)?.[1] ?? null
  const query = to.replace(/#.*$/, '').slice('/settings'.length)
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : '')
  const tab = params.get('tab')
  if (tab) return tab
  if (!hash) return null
  return SETTINGS_HASH_ANCHOR_TO_TAB[hash] ?? hash
}

const settingsTabVisible = (tabId: string): Gate => (v) => getZonedSettingsGroups(v.role).some((g) => g.id === tabId)

// ---------------------------------------------------------------------------
// Pages and windows — hand-kept, with the directory's "Go here when…" lines as their words.
// ---------------------------------------------------------------------------

type PageSeed = { label: string; where: string; words: readonly string[]; to: string; gate: Gate; kind?: 'page' | 'window'; reads?: Door['reads'] }

const p = (seed: PageSeed): Door => ({
  id: `${seed.kind ?? 'page'}:${seed.to}`,
  kind: seed.kind ?? 'page',
  label: seed.label,
  where: seed.where,
  words: seed.words,
  to: seed.to,
  gate: seed.gate,
  ...(seed.reads ? { reads: seed.reads } : {}),
})

const BIDS_TAB_LABELS: Readonly<Record<BidsTabKey, string>> = {
  'bid-board': 'Bid Board',
  'robot-board': 'Robot Board',
  audits: 'Audits',
  'robot-shadows': 'Shadows',
  'robot-queue': 'Robot queue',
  'robot-scoreboard': 'Robot scoreboard',
  'robot-console': 'Robot console',
  'builder-review': 'By builder',
  'call-queue': 'Call queue',
  working: 'Working',
  'bid-costs': 'Bid Costs',
  'day-book': 'Day book',
  estimators: 'Estimators',
  counts: 'Counts',
  takeoffs: 'Takeoffs',
  labor: 'Labor',
  pricing: 'Pricing',
  'cover-letter': 'Cover letter',
  submittals: 'Submittals',
  'submission-followup': 'By status',
  'why-we-lost': 'Why we lost',
  'waiting-to-hear': 'Waiting to hear',
  'job-accounts': 'Job accounts',
  money: 'Money',
  rfi: 'RFI',
  'change-order': 'Change order',
  'lien-release': 'Lien release',
}

const BIDS_TAB_WORDS: Partial<Record<BidsTabKey, readonly string[]>> = {
  'bid-board': ['bids', 'open bids', 'who it went to', 'won', 'waiting', 'bid board', 'new bid'],
  'robot-board': ['robots', 'robot board', 'shadows'],
  audits: ['robot audits', 'audit'],
  'robot-queue': ['robot queue', 'queue'],
  'robot-scoreboard': ['scoreboard', 'robot scores'],
  'robot-console': ['console', 'robot console', 'run the robots'],
  'builder-review': ['by builder', 'builder review', 'builders'],
  'call-queue': ['chase bids', 'log a call', 'call queue', 'mark won', 'mark lost'],
  working: ['bids not yet sent', 'by owner', 'working bids'],
  'bid-costs': ['bid costs', 'cost of bidding'],
  'day-book': ['day book', 'estimator day'],
  estimators: ['estimator workload', 'estimator performance', 'pivot'],
  counts: ['count fixtures', 'fixture counts', 'counts from plans'],
  takeoffs: ['takeoff', 'takeoffs', 'takeoff book'],
  labor: ['labor', 'cost estimate', 'labor book'],
  pricing: ['price a bid', 'margins', 'revenue', 'profit', 'multiple', 'workbench', 'pricing'],
  'cover-letter': ['proposal letter', 'cover letter', 'send the proposal', 'mark sent'],
  submittals: ['submittals', 'submittal'],
  'submission-followup': ['one bid record', 'sends', 'answers', 'by status', 'followup', 'plans', 'ask the robot'],
  'why-we-lost': ['why we lost', 'lost bids', 'lost summary'],
  'waiting-to-hear': ['waiting to hear', 'recent sends', 'answers'],
  'job-accounts': ['job accounts', 'supply house accounts'],
  money: ['bid money', 'money'],
  rfi: ['rfi', 'plans question', 'ask the gc', 'unanswered'],
  'change-order': ['change order', 'change orders'],
  'lien-release': ['lien release', 'lien waiver'],
}

function bidsTabDoors(): Door[] {
  return BIDS_TABS.filter((tab) => tab !== 'robot-shadows').map((tab) =>
    p({
      label: BIDS_TAB_LABELS[tab],
      where: tab === 'bid-board' ? 'Bids' : 'Bids · the tab',
      words: BIDS_TAB_WORDS[tab] ?? [],
      to: `/bids?tab=${tab}`,
      gate: (v) => canOpenBids(v.role) && bidsTabOpenFor(tab, v.role) && (tab !== 'robot-scoreboard' || canWorkRobotAudits(v.role)),
    }),
  )
}

/** The Jobs tabs, gated as `Jobs.tsx`'s router gates them: the owner alone on Crew P&L, no Team for an assistant or a superintendent. */
function jobsTabDoors(): Door[] {
  const superOrPrimaryReports: Gate = (v) => office(v) || v.role === 'superintendent' || v.role === 'primary'
  return [
    p({ label: 'Pipeline', where: 'Jobs · Stages', words: ['jobs', 'pipeline', 'stages', 'waiting', 'working', 'ready to bill', 'rtb', 'billed', 'collections', 'job board', 'stage'], to: '/jobs?tab=stages', gate: office }),
    p({ label: 'Reports', where: 'Jobs · Reports', words: ['field reports', 'job reports', 'tech reports', 'status report', 'file a report'], to: '/jobs?tab=reports', gate: superOrPrimaryReports }),
    p({ label: 'Billing', where: 'Jobs · Billing', words: ['bill a customer', 'bill customer', 'invoice', 'invoices', 'bills', 'finished job'], to: '/jobs?tab=billing', gate: office }),
    p({ label: 'Subs', where: 'Jobs · Subs', words: ['sub sheet', 'sub ledger', 'sub labor', 'subcontractors', 'subs'], to: '/jobs?tab=subs', gate: officeOrSuper }),
    p({ label: 'Subs · Pay', where: 'Jobs · Subs, the Pay view', words: ['pay subs', 'sub pay', 'pay a sub'], to: '/jobs?tab=subs&view=pay', gate: officeOrSuper }),
    p({ label: 'Team', where: 'Jobs · Team', words: ['team labor', 'labor rollups', 'combined labor', 'crew labor'], to: '/jobs?tab=combined-labor', gate: role('dev', 'master_technician', 'controller') }),
    p({ label: 'Crew P&L', where: 'Jobs · Crew P&L', words: ['crew profitability', 'teams summary', 'crew p&l', 'labor against billing'], to: '/jobs?tab=teams-summary', gate: dev }),
    p({ label: 'Parts', where: 'Jobs · Parts', words: ['job parts', 'parts on a job', 'job cost', 'parts'], to: '/jobs?tab=parts', gate: office }),
    p({ label: 'Job Summary', where: 'Jobs · Job Summary', words: ['money story', 'charges', 'payments', 'job money', 'job summary'], to: '/jobs?tab=job-summary', gate: office }),
    p({ label: 'Inspections', where: 'Jobs · Inspections', words: ['inspections', 'inspection'], to: '/jobs?tab=inspections', gate: office }),
  ]
}

const PAGE_DOORS: readonly Door[] = [
  p({ label: 'Dashboard', where: 'Your day', words: ['home', 'today', 'needs you', 'my schedule', 'clock in', 'pins', 'nudges', 'dashboard'], to: '/dashboard', gate: everyone }),
  ...jobsTabDoors(),
  p({ label: 'New job', kind: 'window', where: 'Jobs · Stages, the job form', words: ['add job', 'create job', 'new job', 'add a job'], to: '/jobs?tab=stages&newJob=true', gate: office, reads: { file: 'src/pages/Jobs.tsx', text: "searchParams.get('newJob')" } }),
  p({ label: 'Lien desk', kind: 'window', where: 'Jobs · Stages, the orange gavel', words: ['lien desk', 'lien notice', 'lien notices', 'send a lien notice', 'notices', '53.056', 'gavel', 'retainage', 'affidavit', 'do now', 'piles', 'owner records'], to: '/jobs?tab=stages&liendesk=1', gate: office, reads: { file: 'src/lib/jobs/stagesDeepLinks.ts', text: "lienDesk: ['liendesk'" } }),
  p({ label: 'Legal desk', kind: 'window', where: 'Jobs · Stages, the Collections desk', words: ['collections', 'legal desk', 'attorney', 'law firm', 'collections account', 'demand letter', 'run it in house', 'settlement', 'counsel', 'owner of record', 'supply houses owed'], to: '/jobs?tab=stages&legal=1', gate: office, reads: { file: 'src/pages/Jobs.tsx', text: "searchParams.get('legal')" } }),
  p({ label: 'Legal desk · Timeline', kind: 'window', where: 'Jobs · Stages, the Collections desk', words: ['timeline', 'what happens next', 'deadlines', 'planned step', 'evidence', 'lien clock'], to: '/jobs?tab=stages&legal=1&legalTab=timeline', gate: office, reads: { file: 'src/pages/Jobs.tsx', text: "searchParams.get('legalTab')" } }),
  p({ label: 'Weekly money movement', kind: 'window', where: 'Jobs · Stages', words: ['weekly money', 'money movement', 'stages money'], to: '/jobs?tab=stages&stagesMoney=1', gate: role('dev', 'controller'), reads: { file: 'src/pages/Jobs.tsx', text: "searchParams.get('stagesMoney')" } }),
  p({ label: 'GC Review', kind: 'window', where: 'Jobs · Stages', words: ['gc review', 'review the gcs', 'account men', 'gc certification'], to: '/jobs?tab=stages&gcReview=1', gate: office, reads: { file: 'src/lib/jobs/stagesDeepLinks.ts', text: "gcReview: ['gcReview']" } }),
  p({ label: 'Follow-ups · Idle jobs', kind: 'window', where: 'Jobs · Stages, the Follow-ups deck', words: ['idle jobs', 'no crew on site', 'follow-ups', 'follow ups', 'idle', '21 days'], to: '/jobs?tab=stages&followups=idle', gate: office, reads: { file: 'src/lib/jobs/stagesDeepLinks.ts', text: "search.get('followups') === 'idle'" } }),
  ...bidsTabDoors(),
  p({ label: 'New bid', kind: 'window', where: 'Bids · the bid form', words: ['create a bid', 'add bid', 'new bid'], to: '/bids?newBid=true', gate: (v) => canOpenBids(v.role) && v.role !== 'primary', reads: { file: 'src/pages/Bids.tsx', text: "params.get('newBid')" } }),
  p({ label: 'Customers', where: 'Customers', words: ['customers', 'builders', 'gcs', 'general contractors', 'customer profile', 'customer history', 'customer'], to: '/customers', gate: notFarm(officeOrEstimator) }),
  p({ label: 'New customer', kind: 'window', where: 'Customers · the customer form', words: ['add customer', 'create customer', 'new customer'], to: '/customers/new', gate: notFarm(officeOrEstimator) }),
  p({ label: 'Estimates', where: 'Estimates', words: ['estimates', 'quotes', 'homeowner quotes', 'small quotes', 'estimate'], to: '/estimates', gate: (v) => officeOrSuper(v) || v.role === 'estimator' || v.role === 'primary' }),
  p({ label: 'New estimate', kind: 'window', where: 'Estimates · the estimate form', words: ['start an estimate', 'add estimate', 'new estimate'], to: '/estimates?newEstimate=true', gate: (v) => officeOrSuper(v) || v.role === 'estimator' || v.role === 'primary', reads: { file: 'src/pages/Estimates.tsx', text: "searchParams.get('newEstimate')" } }),
  p({ label: 'Documents', where: 'Documents', words: ['contracts', 'document packets', 'packets', 'documents'], to: '/documents', gate: notFarm(notField) }),
  p({ label: 'Materials', where: 'Materials', words: ['materials', 'parts book', 'price book', 'labor book', 'assembly', 'assemblies', 'catalog', 'books'], to: '/materials', gate: notFarm(notField) }),
  p({ label: 'Supply houses', where: 'Materials · Supply houses', words: ['supply houses', 'supply house', 'house invoices', 'invoices from the house', 'bills from supply houses'], to: '/materials?tab=supply-houses', gate: notFarm(notField) }),
  p({ label: 'Job accounts to move', kind: 'window', where: 'Materials · Supply houses', words: ['job accounts', 'movable invoices', 'move onto a job account'], to: '/materials?tab=supply-houses&list=movable', gate: office, reads: { file: 'src/pages/Materials.tsx', text: "searchParams.get('list')" } }),
  p({ label: 'Map', where: 'Map', words: ['map of work', 'map', 'where the jobs are', 'clocked in map'], to: '/map', gate: notFarm(officeOrEstimator) }),
  p({ label: 'Schedule hub', where: 'Schedule', words: ['schedule crews', 'dispatch', 'schedule by week', 'crews to jobs', 'schedule'], to: '/schedule-dispatch', gate: officeOrSuper }),
  p({ label: 'Calendar', where: 'Calendar', words: ['calendar', 'calendar view', 'time off'], to: '/calendar', gate: everyone }),
  p({ label: 'Checklist', where: 'Checklist', words: ['tasks', 'company task list', 'checklist', 'today', 'to do'], to: '/checklist', gate: everyone }),
  p({ label: 'Roadmap', where: 'Roadmap', words: ['roadmap', 'plan', 'tech tree', 'roadmap tasks'], to: '/roadmap', gate: (v) => canOpenRoadmap(v.role, v.farmModeActive) }),
  p({ label: 'People', where: 'People', words: ['people', 'who worked', 'clock cards', 'users', 'accounts', 'roster', 'team'], to: '/people', gate: (v) => office(v) && v.role !== 'estimator' }),
  p({ label: 'Users', where: 'People · Users', words: ['users', 'accounts', 'roles', 'invite', 'archive user'], to: '/people?tab=users', gate: office }),
  p({ label: 'Day book', where: 'People · Day book', words: ['day book', 'estimator day'], to: '/people?tab=day_book', gate: (v) => canOpenDayBook(v.role) }),
  p({ label: 'Tally', where: 'Tally', words: ['job parts tally', 'purchases', 'card purchases', 'transactions', 'payroll marks', 'spending', 'tally', 'sort purchases'], to: '/tally', gate: notFarm(notField) }),
  p({ label: 'Banking', where: 'Banking', words: ['bank ledger', 'card sorting', 'accounting review', 'bank', 'mercury', 'banking'], to: '/banking', gate: (v) => canAccessBanking(v.role) }),
  p({ label: 'Accounts receivable', where: 'AR', words: ['who owes us', 'owed', 'ar', 'receivables', 'accounts receivable', 'money owed'], to: '/accounts-receivable', gate: office }),
  p({ label: 'Prospects', where: 'Prospects', words: ['prospects', 'new builders', 'new builder pipeline', 'hiring', 'candidates', 'hiring pipeline'], to: '/prospects', gate: (v) => office(v) || (v.role === 'estimator' && v.estimatorProspectsAccess) }),
  p({ label: 'GC leads', where: 'Prospects · GC leads', words: ['gc leads', 'owners', 'developers', 'architects', 'jobs to build as the gc', 'leads'], to: '/prospects?kind=gc-leads', gate: (v) => office(v) || (v.role === 'estimator' && v.estimatorProspectsAccess) }),
  p({ label: 'Subs for the bench', where: 'Prospects · Subs', words: ['subs', 'the bench', 'trade companies', 'call the top 3', 'find subs'], to: '/prospects?kind=subs', gate: (v) => office(v) || (v.role === 'estimator' && v.estimatorProspectsAccess) }),
  p({ label: 'GC projects', where: 'GC projects', words: ['gc projects', 'gc mode', 'project board', 'trades', 'scope', 'plans', 'gc'], to: '/gc', gate: (v) => canOpenGcProjects(v.role) }),
  p({ label: 'Trade partners', where: 'GC projects · Trade partners', words: ['trade partners', 'add a company', 'new to us', 'approve a company', 'subcontractor companies'], to: '/gc?view=partners', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('view')" } }),
  p({ label: 'Trade partners · By step', where: 'GC projects · Trade partners', words: ['by step', 'who is late', 'where every company stands'], to: '/gc?view=partners&by=step', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('view')" } }),
  p({ label: 'Call script', kind: 'window', where: 'GC projects · Trade partners', words: ['call script', 'what to say', 'phoning a company', 'script'], to: '/gc?view=partners&script=1', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('script')" } }),
  p({ label: 'GC customers', where: 'GC projects · Customers', words: ['gc customers', 'every customer and where each job stands', 'master agreement', 'portal'], to: '/gc?view=customers', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('view')" } }),
  p({ label: 'Follow up', where: 'GC projects · Follow up', words: ['follow up', 'waiting on us', 'we owe them', 'nudges', 'waiting on them', 'quote from a trade partner'], to: '/gc?view=followUp', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('view')" } }),
  p({ label: 'GC money', where: 'GC projects · Money', words: ['gc money', 'money on our gc jobs', 'pay application', 'bill day', 'draws', 'monday money email'], to: '/gc?view=money', gate: (v) => canSeeGcMoney(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('view')" } }),
  p({ label: 'Scope book', kind: 'window', where: 'GC projects', words: ['scope book', 'scope lines', 'scope by trade', 'scope set'], to: '/gc?book=1', gate: (v) => canOpenGcProjects(v.role), reads: { file: 'src/pages/GcProjects.tsx', text: "params.get('book')" } }),
  p({ label: 'Messages', where: 'Messages', words: ['messages', 'texts', 'emails', 'threads', 'everyone waiting on us', 'needs a reply', 'went out', 'new messages', 'sort new messages', 'who is this'], to: '/messages', gate: (v) => canOpenMessages(v.role) }),
  ...KIND_PILLS.filter((k) => k.key !== 'all').map((k) =>
    p({
      label: `Messages · ${k.label}`,
      where: 'Messages · the kind pill',
      words: [k.label.toLowerCase(), ...k.title.toLowerCase().replace(/[.’']/g, '').split(/[\s,]+/).filter((w) => w.length > 3)],
      to: `/messages?kind=${k.key}`,
      gate: (v) => canOpenMessages(v.role),
    }),
  ),
  p({ label: 'Quickfill', where: 'Quickfill', words: ['quickfill', 'morning round', 'stations', 'office round', 'the round', 'roller'], to: '/quickfill', gate: office }),
  p({ label: 'Moneyfill', where: 'Moneyfill', words: ['moneyfill', 'close the week', 'money round', 'controller round'], to: '/moneyfill', gate: (v) => canOpenMoneyfill(v.role) }),
  p({ label: 'The Bridge', where: 'Bridge', words: ['bridge', 'where the company stands', 'weakest link', 'monday sheet', 'the link', 'collect desk'], to: '/bridge', gate: dev }),
  p({ label: 'Punch list', where: 'Settings · the board', words: ['punch list', 'to-dos', 'todos', 'the board', 'to do list', 'mock-ups'], to: PUNCH_LIST_PATH, gate: (v) => canOpenPunchList(v.role) }),
  p({ label: 'Projects', where: 'Projects', words: ['projects', 'project workflow', 'workflows', 'project'], to: '/projects', gate: officeOrSuper }),
  p({ label: 'New project', kind: 'window', where: 'Projects · the project form', words: ['add project', 'create project', 'new project'], to: '/projects/new', gate: officeOrSuper }),
  p({ label: 'Partnerships', where: 'Partnerships', words: ['partnerships', 'partners', 'partner statement'], to: '/partnerships', gate: dev }),
  p({ label: 'Templates', where: 'Templates', words: ['templates', 'report templates', 'email templates'], to: '/templates', gate: dev }),
  // The route guard admits a dev alone, though Settings → Bids & materials links an estimator here too.
  p({ label: 'Duplicate materials', where: 'Materials · Duplicates', words: ['duplicate materials', 'dedupe parts', 'find duplicates', 'duplicates'], to: '/duplicates', gate: dev }),
  p({ label: 'Dispatch home', where: 'Dispatch Mode', words: ['dispatch mode', 'dispatch home', 'dispatch'], to: '/dispatch-mode', gate: office }),
  p({ label: 'Dispatch · Schedule', where: 'Dispatch Mode', words: ['dispatch schedule', 'schedule'], to: '/dispatch-mode/schedule', gate: office }),
  p({ label: 'Dispatch · Inbox', where: 'Dispatch Mode', words: ['dispatch inbox', 'inbox', 'dispatch requests'], to: '/dispatch-mode/inbox', gate: office }),
  p({ label: 'Dispatch · PO', where: 'Dispatch Mode', words: ['po', 'purchase order', 'po tab', 'po code'], to: '/dispatch-mode/po', gate: office }),
  p({ label: 'Dispatch · Customers', where: 'Dispatch Mode', words: ['dispatch customers', 'customer summary sheet'], to: '/dispatch-mode/customers', gate: office }),
  p({ label: 'Job Mode · My schedule', where: 'Job Mode', words: ['job mode', 'my schedule', 'my day', 'my jobs'], to: '/job-mode/schedule', gate: everyone }),
  p({ label: 'Job Mode · My inbox', where: 'Job Mode', words: ['job mode inbox', 'my inbox'], to: '/job-mode/inbox', gate: everyone }),
  p({ label: 'Job Mode · Customers', where: 'Job Mode', words: ['job mode customers', 'message the customer'], to: '/job-mode/customers', gate: everyone }),
  p({ label: 'Settings', where: 'Settings', words: ['settings', 'profile', 'theme', 'dark mode', 'sign out', 'release notes'], to: '/settings', gate: everyone }),
  p({ label: 'Help', where: 'Help', words: ['help', 'guides', 'how do i', 'how-do-i articles', 'manual', 'documentation'], to: '/help', gate: everyone }),
]

// ---------------------------------------------------------------------------
// Settings — the groups and the rail's own index, gated by the group's filter.
// ---------------------------------------------------------------------------

function allSettingsGroups(): SettingsGroupDef[] {
  const seen = new Map<string, SettingsGroupDef>()
  for (const r of ROLES) for (const g of getZonedSettingsGroups(r)) if (!seen.has(g.id)) seen.set(g.id, g)
  return [...seen.values()]
}

function settingsEntryTo(entry: SettingsSearchEntry): string {
  if (entry.guideSlug) return `/settings?tab=${entry.tabId}&${HELP_GUIDE_URL_PARAM}=${entry.guideSlug}`
  return `/settings?tab=${entry.tabId}${entry.anchorId ? `#${entry.anchorId}` : ''}`
}

function settingsDoors(): Door[] {
  const groups = allSettingsGroups()
  const labelOf = new Map(groups.map((g) => [g.id, g.label]))
  const doors: Door[] = groups.map((g) => ({
    id: `settings:${g.id}`,
    kind: 'settings',
    label: g.label,
    where: `Settings · ${SETTINGS_ZONE_LABELS[g.zone]}`,
    words: [g.label.toLowerCase()],
    to: `/settings?tab=${g.id}`,
    gate: settingsTabVisible(g.id),
  }))
  for (const entry of SETTINGS_SEARCH_INDEX) {
    const tabLabel = labelOf.get(entry.tabId) ?? 'Settings'
    const words = (entry.keywords ?? []).map((k) => k.toLowerCase())
    const group = doors.find((d) => d.id === `settings:${entry.tabId}` && d.label.toLowerCase() === entry.label.toLowerCase())
    if (group) {
      // The entry names its own tab ("Training", "Flows"): one door, the entry's words joined to it.
      ;(group as { words: readonly string[] }).words = [...group.words, ...words]
      continue
    }
    doors.push({
      id: `settings:${entry.tabId}:${slug(entry.label)}`,
      kind: 'settings',
      label: entry.label,
      where: `Settings · ${tabLabel}`,
      words,
      to: settingsEntryTo(entry),
      gate: settingsTabVisible(entry.tabId),
    })
  }
  return doors
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// The Dev doors card's rows — the same list, folded in. A row opens for the card's `who`, the people who may use the
// block. The Phone and texts cards and the Flows reminder are the exception: the office reads them and the owner sets
// them, so the door opens for whoever sees the tab, as the box answers who may get there.
// ---------------------------------------------------------------------------

const OFFICE_READS_THE_CARD: ReadonlySet<string> = new Set([
  'settings-phone-texts-send-texts',
  'settings-phone-texts-who-gets-it',
  'settings-phone-texts-quo',
  'settings-phone-texts-quo-seats',
  'settings-phone-texts-boxes',
  'settings-phone-texts-read-bids',
  'settings-phone-texts-email-count',
  'settings-phone-texts-reply-push',
  'settings-phone-texts-hours',
  'settings-phone-texts-reminders',
  'settings-flows-app-sends',
])

function devDoorToDoor(d: DevDoor, tabLabel: ReadonlyMap<string, string>): Door {
  const tab = settingsTabOf(d.to)
  const isSettings = d.area === 'Settings' && tab != null
  const who = whoGate(d.who)
  const officeReads = isSettings && OFFICE_READS_THE_CARD.has(d.id)
  return {
    id: `dev:${d.id}`,
    kind: isSettings ? 'settings' : 'window',
    label: d.label,
    where: isSettings ? `Settings · ${tabLabel.get(tab) ?? 'the card'}` : d.area,
    words: [d.what.toLowerCase()],
    to: d.to,
    gate: officeReads ? (v) => who(v) || settingsTabVisible(tab)(v) : who,
  }
}

/** Two doors with the same link and the same name are one door; the first keeps its gate and gains the other's words. */
function fold(doors: readonly Door[]): Door[] {
  const out: Door[] = []
  const byKey = new Map<string, Door>()
  for (const d of doors) {
    const key = `${d.to}|${d.label.toLowerCase()}`
    const prior = byKey.get(key)
    if (prior) {
      ;(prior as { words: readonly string[] }).words = [...new Set([...prior.words, ...d.words])]
      continue
    }
    byKey.set(key, d)
    out.push(d)
  }
  return out
}

// ---------------------------------------------------------------------------
// Guides and the punch list — from the sources handed in.
// ---------------------------------------------------------------------------

function guideDoors(guides: readonly HelpGuide[]): Door[] {
  return guides.map((g) => ({
    id: `guide:${g.slug}`,
    kind: 'guide',
    label: g.title,
    where: `Guide · ${g.category}`,
    words: g.keywords.map((k) => k.toLowerCase()),
    to: `/help?${HELP_GUIDE_URL_PARAM}=${g.slug}`,
    gate: (v) => guideIsRelevantForRole(g, v.role),
    ...(g.where ? { also: { label: GO_ANYWHERE_WORDS.goThere, to: g.where } } : {}),
  }))
}

function todoDoors(todos: NonNullable<DoorSources['todos']>): Door[] {
  return todos.map((t) => ({
    id: `todo:${t.number}`,
    kind: 'todo',
    label: `#${t.number} ${t.name}`,
    where: `Punch list · ${GROUP_LABELS[t.group] ?? t.group}`,
    words: [],
    to: `${PUNCH_LIST_PATH}#n${t.number}`,
    gate: (v) => canOpenPunchList(v.role),
  }))
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

/** Every door there is, whoever is looking. The box filters with `doorsFor`; the tests hold the whole list. */
export function allDoors(sources: DoorSources = {}): Door[] {
  const tabLabel = new Map(allSettingsGroups().map((g) => [g.id, g.label]))
  return fold([...PAGE_DOORS, ...settingsDoors(), ...DEV_DOORS.map((d) => devDoorToDoor(d, tabLabel)), ...guideDoors(sources.guides ?? []), ...todoDoors(sources.todos ?? [])])
}

/** The doors this viewer may open, in the index's order. */
export function doorsFor(viewer: DoorViewer, sources: DoorSources = {}): Door[] {
  return allDoors(sources).filter((d) => d.gate(viewer))
}

/** A viewer with no flags, for a role: what the tests and the Dev doors share ask with. */
export function plainViewer(role: UserRole): DoorViewer {
  return { role, estimatorProspectsAccess: false, teamProspectsAccess: false, farmModeActive: false }
}

/** True when the door opens for a dev and for no other role, flags on or off. */
export function isDevOnly(door: Door): boolean {
  if (!door.gate(plainViewer('dev'))) return false
  return ROLES.filter((r) => r !== 'dev').every((r) => !door.gate(plainViewer(r)) && !door.gate({ ...plainViewer(r), estimatorProspectsAccess: true, teamProspectsAccess: true }))
}

/** The route guard's word on a door for a viewer: a door the guard would bounce is a drift the test reports. */
export function doorAllowedByRouteGuard(door: Door, viewer: DoorViewer): boolean {
  return isPathAllowedForRole(viewer.role, doorPath(door.to), viewer.estimatorProspectsAccess)
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** `>` narrows to the places, pages and Settings cards. `?` to the guides. `#` to the punch list. */
export type DoorOnly = 'place' | 'guide' | 'todo'

export interface DoorQuery {
  only: DoorOnly | null
  /** The words after the prefix, trimmed, lowercased, a leading "how do I" and a trailing "?" stripped. */
  words: string
}

const LEADING_QUESTION = /^(?:how\s+(?:do|can|would|should)\s+(?:i|we|you)\s+|how\s+to\s+|where\s+(?:is|are|do\s+i)\s+)/i

export function doorQuery(raw: string): DoorQuery {
  let q = raw.trim()
  let only: DoorOnly | null = null
  if (q.startsWith('>')) {
    only = 'place'
    q = q.slice(1)
  } else if (q.startsWith('?')) {
    only = 'guide'
    q = q.slice(1)
  } else if (q.startsWith('#')) {
    only = 'todo'
    q = q.slice(1)
  }
  q = q.trim().replace(LEADING_QUESTION, '').replace(/\?+\s*$/, '').trim().toLowerCase()
  return { only, words: q }
}

/** A number, with or without J, B, E or C in front, is a job, a bid, an estimate or a customer: today's rows, no door. */
export function isNumberQuery(words: string): boolean {
  return /^[jbec]?\s*\d+$/i.test(words.trim())
}

const SEPARATORS = ' \\-/·,&(#:'
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wordStartIn(text: string, token: string): boolean {
  if (!token) return false
  return new RegExp(`(?:^|[${SEPARATORS}])${escapeRe(token)}`).test(text)
}

const LABEL_PREFIX = 120
const LABEL_WORD = 100
const WORDS_WORD = 50
const WHERE_WORD = 25

/** The door's score for the words, or null when a word matches nowhere. Every word must match at a word's start. */
export function scoreDoor(door: Door, tokens: readonly string[]): number | null {
  const label = door.label.toLowerCase()
  const words = door.words.join(' · ')
  const where = door.where.toLowerCase()
  let score = 0
  for (const t of tokens) {
    if (label.startsWith(t)) score += LABEL_PREFIX
    else if (wordStartIn(label, t)) score += LABEL_WORD
    else if (wordStartIn(words, t)) score += WORDS_WORD
    else if (wordStartIn(where, t)) score += WHERE_WORD
    else return null
  }
  return score
}

export interface DoorGroup {
  key: DoorGroupKey
  label: string
  doors: Door[]
  /** How many more matched beyond the ones drawn. */
  more: number
}

export const DOORS_PER_GROUP = 3
export const DOOR_MIN_CHARS = 2

/**
 * The groups the box draws under today's rows: the best few doors of each kind, in the kinds' order, each group capped
 * at `perGroup` with the rest counted. A number alone finds no door. With `only` set, a group key from a group's
 * "N more" press or a prefix typed, one group comes back whole.
 */
export function searchDoors(raw: string, doors: readonly Door[], opts: { perGroup?: number; only?: DoorOnly | DoorGroupKey | null } = {}): DoorGroup[] {
  const parsed = doorQuery(raw)
  const only = opts.only ?? parsed.only
  const words = parsed.words
  if (words.length < DOOR_MIN_CHARS) return []
  if (only == null && isNumberQuery(words)) return []
  const tokens = words.split(/\s+/).filter(Boolean)
  const allowed = (kind: DoorKind): boolean => {
    const group = doorGroupKey(kind)
    if (only == null) return true
    if (only === 'place') return group === 'page' || group === 'settings'
    return group === only
  }
  const scored: Array<{ door: Door; score: number; order: number }> = []
  doors.forEach((door, order) => {
    if (!allowed(door.kind)) return
    const score = scoreDoor(door, tokens)
    if (score != null) scored.push({ door, score, order })
  })
  // A tie goes to the shorter label, the closer match: *bill a customer and get paid* before *bill the customer on a GC job*.
  scored.sort((a, b) => b.score - a.score || a.door.label.length - b.door.label.length || a.order - b.order)
  const perGroup = only != null ? Number.POSITIVE_INFINITY : (opts.perGroup ?? DOORS_PER_GROUP)
  const groups = new Map<DoorGroupKey, DoorGroup>()
  for (const { door } of scored) {
    const key = doorGroupKey(door.kind)
    let g = groups.get(key)
    if (!g) {
      g = { key, label: DOOR_GROUP_LABELS[key], doors: [], more: 0 }
      groups.set(key, g)
    }
    if (g.doors.length < perGroup) g.doors.push(door)
    else g.more += 1
  }
  return DOOR_GROUP_ORDER.filter((k) => groups.has(k)).map((k) => groups.get(k)!)
}

/** The rows of every group in order, for the box's ↑ ↓ walk. */
export function flattenDoorGroups(groups: readonly DoorGroup[]): Door[] {
  return groups.flatMap((g) => g.doors)
}

// ---------------------------------------------------------------------------
// The box's words
// ---------------------------------------------------------------------------

/** `ui_nav_clicks.control` for a door opened from the box; the target is the door's id. */
export const GO_ANYWHERE_CONTROL = 'go_anywhere_door'

export const GO_ANYWHERE_WORDS = {
  placeholder: 'Jobs, bids, customers, pages, settings, guides…',
  noMatches: 'No matches. The box looks in jobs, bids, estimates, customers, pages, settings and guides.',
  recent: 'Recent',
  recentHint: 'on this device',
  allKinds: 'All kinds',
  more: (n: number): string => `${n} more`,
  window: 'a window',
  goThere: 'Go there',
  /** The keys, said once under the rows on a desk, the way the quick replies' / list says its own. */
  keys: ['↑ ↓ move', 'Enter opens', 'Tab next group', 'Esc closes', '> places', '? guides', '# punch list'] as readonly string[],
} as const

/**
 * Where Tab lands: the first row of the next group after the row at `index`, wrapping. `starts` is each group's
 * first index in the combined list of rows, in order; a list with one group or none goes nowhere.
 */
export function nextGroupStart(index: number, starts: readonly number[], step: 1 | -1 = 1): number | null {
  if (starts.length < 2) return null
  let current = -1
  starts.forEach((s, i) => {
    if (s <= index) current = i
  })
  const next = (current + step + starts.length) % starts.length
  return starts[next]!
}

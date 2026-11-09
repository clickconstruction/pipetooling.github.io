/**
 * Delete a person made by mistake (v2.6789). On 2026-11-09 a dev typed a new hire's name wrong, hired without the
 * invite, and found the only way off the roster was Archive — right for someone who worked here, wrong for a row made
 * a minute ago. `delete_fresh_person` (`20261109110000`) deletes the users row with no login and its People record in
 * one transaction, with the pay row and workday template the Hire form wrote; every foreign key into users(id) or
 * people(id) is counted first, and a row that points at the person — a clock session, a pay report, paperwork, a
 * customer, an HR file entry — is a hold the call answers instead of deleting. This file is the pure part: who is
 * offered the press, how the answer is read, and the words the confirm and the refusal carry.
 */

import { canArchiveAccount, type PersonDeskViewer } from './personDeskGates'
import { formatErrorMessage } from '../../utils/errorHandling'

export type FreshDeleteHold = { table: string; column: string; count: number }

export type FreshDeleteAnswer = {
  deleted: boolean
  dryRun: boolean
  name: string
  userId: string
  personId: string | null
  holds: FreshDeleteHold[]
  /** What went, or would go, with the person: the setup rows the Hire form wrote. */
  removed: string[]
}

/**
 * Who sees Delete… beside Archive…: the people who may archive (dev, controller, pay-approved leader), on a row with no
 * login that is not their own. The server holds the same gate and adds the scan; the press is offered before the scan
 * runs, and the confirm says what the scan found.
 */
export function canOfferFreshDelete(args: { loginAttachedAt: string | null | undefined; isSelf: boolean; archived?: boolean; viewer: PersonDeskViewer }): boolean {
  if (args.loginAttachedAt != null) return false
  if (args.isSelf) return false
  if (args.archived) return false
  return canArchiveAccount(args.viewer)
}

/** The answer's shape, or a thrown error with plain words when it is not one. */
export function readFreshDeleteAnswer(data: unknown): FreshDeleteAnswer {
  const d = data as { deleted?: unknown; dry_run?: unknown; name?: unknown; user_id?: unknown; person_id?: unknown; holds?: unknown; removed?: unknown } | null
  if (!d || typeof d.deleted !== 'boolean' || typeof d.user_id !== 'string') throw new Error('The answer had no verdict.')
  const holds = Array.isArray(d.holds)
    ? (d.holds as Array<{ table?: unknown; column?: unknown; count?: unknown }>)
        .filter((h) => typeof h.table === 'string' && typeof h.column === 'string')
        .map((h) => ({ table: h.table as string, column: h.column as string, count: typeof h.count === 'number' ? h.count : Number(h.count ?? 0) || 0 }))
    : []
  const removed = Array.isArray(d.removed) ? (d.removed as unknown[]).filter((r): r is string => typeof r === 'string') : []
  return {
    deleted: d.deleted,
    dryRun: d.dry_run === true,
    name: typeof d.name === 'string' && d.name.trim() ? d.name : 'This person',
    userId: d.user_id,
    personId: typeof d.person_id === 'string' ? d.person_id : null,
    holds,
    removed,
  }
}

/** The plain words for a table that points at the person: one (with its article) and many. */
const HOLD_WORDS: Record<string, [string, string]> = {
  clock_sessions: ['a clock session', 'clock sessions'],
  imported_clock_sessions: ['an imported day', 'imported days'],
  people_pay_stubs: ['a pay report', 'pay reports'],
  pay_stubs: ['a pay report', 'pay reports'],
  people_pay_config: ['a pay row', 'pay rows'],
  person_contract_documents: ['a paperwork item', 'paperwork items'],
  customers: ['a customer', 'customers'],
  people: ['a roster record', 'roster records'],
  hr_file_entries: ['an HR file entry', 'HR file entries'],
  person_file_entries: ['an HR file entry', 'HR file entries'],
  matters: ['a matter', 'matters'],
  legal_matters: ['a matter', 'matters'],
  contacts: ['a Messages contact', 'Messages contacts'],
  messages: ['a message', 'messages'],
  jobs_ledger: ['a job', 'jobs'],
  bids: ['a bid', 'bids'],
  job_schedule_blocks: ['a schedule block', 'schedule blocks'],
  people_crew_jobs: ['a crew assignment', 'crew assignments'],
  people_crew_bids: ['a crew assignment', 'crew assignments'],
  notification_history: ['a notification', 'notifications'],
  user_push_subscriptions: ['a push device', 'push devices'],
  vehicles: ['a vehicle', 'vehicles'],
  licenses: ['a license', 'licenses'],
}

/** "3 clock sessions", "a pay report", "2 rows in team prospects" for a table with no words of its own. */
export function holdWords(hold: FreshDeleteHold): string {
  const words = HOLD_WORDS[hold.table]
  if (words) return hold.count === 1 ? words[0] : `${hold.count} ${words[1]}`
  const table = hold.table.replace(/_/g, ' ')
  return hold.count === 1 ? `a row in ${table}` : `${hold.count} rows in ${table}`
}

function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** One line per hold, folded by table, so two keys from one table read once. */
export function foldHolds(holds: FreshDeleteHold[]): FreshDeleteHold[] {
  const byTable = new Map<string, FreshDeleteHold>()
  for (const h of holds) {
    const prev = byTable.get(h.table)
    if (prev) prev.count += h.count
    else byTable.set(h.table, { ...h })
  }
  return [...byTable.values()]
}

/** The confirm for a clean row: what goes, and that nothing else points at them. The button carries the verb. */
export function freshDeleteConfirmWords(name: string, removed: string[]): { title: string; message: string; confirmLabel: string } {
  const withThem = removed.length > 0 ? ` Their ${joinWords(removed)} ${removed.length === 1 ? 'goes' : 'go'} too.` : ''
  return {
    title: `Delete ${name}?`,
    message: `Made by mistake? This removes ${name} from the roster for good. Nothing points at them yet: no hours, no pay, no paperwork.${withThem} Someone who worked here is archived instead, so their history stays.`,
    confirmLabel: `Delete ${name}`,
  }
}

/** The words when the scan found holds: what points at them, and that Archive is the door. */
export function freshDeleteHeldWords(name: string, holds: FreshDeleteHold[]): { title: string; message: string; confirmLabel: string } {
  const folded = foldHolds(holds)
  const list = joinWords(folded.map(holdWords))
  return {
    title: `${name} cannot be deleted`,
    message: `${name} has ${list}. A person with history is archived, not deleted, so the history stays. Archive hides them from every list and can be undone.`,
    confirmLabel: 'Archive instead',
  }
}

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

/** Calls the function; a dry run answers the holds and deletes nothing. Throws with the refusal's words. */
export async function deleteFreshPerson(client: unknown, input: { userId: string; dryRun?: boolean }): Promise<FreshDeleteAnswer> {
  const db = client as RpcClient
  const { data, error } = await db.rpc('delete_fresh_person', { p_user_id: input.userId, p_dry_run: input.dryRun === true })
  if (error) throw new Error(formatErrorMessage(error, 'The person was not deleted.'))
  return readFreshDeleteAnswer(data)
}

/**
 * The whole press, with its windows injected: a dry run first, then either the typed confirm and the delete, or the
 * holds with Archive offered in Delete's place. One window at a time; `archiveInstead` is the desk's or the row's own
 * Archive door. Answers what happened so the caller can close the desk or reload the roster.
 */
export async function runFreshDelete(args: {
  client: unknown
  userId: string
  name: string
  confirm: (opts: { title: string; message: string; confirmLabel: string; danger: boolean }) => Promise<boolean>
  archiveInstead?: () => void
}): Promise<'deleted' | 'held' | 'cancelled'> {
  const probe = await deleteFreshPerson(args.client, { userId: args.userId, dryRun: true })
  const name = probe.name || args.name
  if (probe.holds.length > 0) {
    const words = freshDeleteHeldWords(name, probe.holds)
    const go = await args.confirm({ ...words, danger: true })
    if (go && args.archiveInstead) args.archiveInstead()
    return 'held'
  }
  const words = freshDeleteConfirmWords(name, probe.removed)
  const ok = await args.confirm({ ...words, danger: true })
  if (!ok) return 'cancelled'
  const done = await deleteFreshPerson(args.client, { userId: args.userId })
  if (!done.deleted) {
    // Something pointed at them between the two calls: name it, and offer the door.
    const held = freshDeleteHeldWords(name, done.holds)
    const go = await args.confirm({ ...held, danger: true })
    if (go && args.archiveInstead) args.archiveInstead()
    return 'held'
  }
  return 'deleted'
}

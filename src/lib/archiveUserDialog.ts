/** Active Accounts → Archive user: pure decision logic for the unified archive
 * dialog (v2.1016 — folds the old "Archive User & Reassign Customers" flow into
 * the single confirmation). The archive-user edge function already accepts an
 * optional reassign_customers_to, so this is client-side shaping only. */

export type ArchiveReassignMode = 'keep' | 'reassign'

export type ArchiveDialogUser = {
  id: string
  name: string | null
  email: string
  role: string
}

/** Masters/devs who can inherit the archived account's customers — never the account itself. */
export function eligibleReassignTargets<T extends ArchiveDialogUser>(
  users: T[],
  archivingUserId: string | null,
): T[] {
  return users.filter(
    (u) => (u.role === 'master_technician' || u.role === 'dev') && u.id !== archivingUserId,
  )
}

/**
 * Why the Archive action cannot run yet, or null when it can.
 * The reassign choice only gates submission when there are customers to move.
 */
export function archiveChoiceBlocker(args: {
  userSelected: boolean
  customerCount: number | null
  mode: ArchiveReassignMode
  reassignTargetId: string
}): string | null {
  if (!args.userSelected) return 'Pick the account to archive.'
  if (args.customerCount === null) return 'Counting customers…'
  if (args.customerCount > 0 && args.mode === 'reassign' && !args.reassignTargetId) {
    return 'Pick the master who inherits the customers.'
  }
  return null
}

export type ArchiveRequestBody = {
  email: string
  name: string
  reassign_customers_to?: string
}

/** Body for the archive-user edge function; reassignment rides along only when
 * chosen AND there is actually something to move. */
export function archiveRequestBody(
  user: { email: string; name: string | null },
  customerCount: number | null,
  mode: ArchiveReassignMode,
  reassignTargetId: string,
): ArchiveRequestBody {
  const body: ArchiveRequestBody = {
    email: (user.email ?? '').trim(),
    name: (user.name ?? '').trim(),
  }
  if ((customerCount ?? 0) > 0 && mode === 'reassign' && reassignTargetId) {
    body.reassign_customers_to = reassignTargetId
  }
  return body
}

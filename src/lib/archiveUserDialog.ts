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

/** Leaders/devs other than the account itself. Kept for the roster tools; the archive dialog no longer offers a picker (v2.3063). */
export function eligibleReassignTargets<T extends ArchiveDialogUser>(
  users: T[],
  archivingUserId: string | null,
): T[] {
  return users.filter(
    (u) => (u.role === 'master_technician' || u.role === 'dev') && u.id !== archivingUserId,
  )
}

/**
 * Why the Archive action cannot run yet, or null when it can. Since v2.3063 (one company)
 * the reassign choice needs no target — customers that move go to the company owner account.
 */
export function archiveChoiceBlocker(args: {
  userSelected: boolean
  customerCount: number | null
}): string | null {
  if (!args.userSelected) return 'Pick the account to archive.'
  if (args.customerCount === null) return 'Counting customers…'
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

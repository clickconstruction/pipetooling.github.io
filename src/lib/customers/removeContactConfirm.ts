/**
 * The question before a customer's contact is removed (punch list #416, the walk of 2026-11-23): **Remove** on Edit
 * customer → Contacts took the person off at once, with nothing asked.
 *
 * The removal deletes the row. The deleted-records archive keeps a copy for 90 days, and a dev can put it back from
 * Settings → Data & recovery → Recently deleted, so the words say that and do not say it is gone for good. A contact
 * who gets a copy of every bill stops getting one, so the words say that too.
 *
 * Pure: no React, no supabase.
 */
import type { ConfirmDialogOptions } from '../../contexts/ConfirmDialogContext'

/** The name the question uses: the contact's own, or *this contact* for a row that kept none. */
export function contactNameForConfirm(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ') || 'this contact'
}

/**
 * The confirm window's words. Its press names the act and the contact; Cancel is *Keep them*. *Keep them* is the safe
 * answer and takes the focus, so Enter does not remove (seen on the live walk of 2026-11-24: the focus sat on the
 * remove press).
 */
export function removeContactConfirm(contact: { name: string | null; getsBillCopies: boolean }): ConfirmDialogOptions {
  const who = contactNameForConfirm(contact.name)
  const bills = contact.getsBillCopies ? ' They stop getting a copy of every bill.' : ''
  return {
    message: `Remove ${who} from this customer’s contacts?${bills} A dev can put them back for 90 days, from Recently deleted in Settings.`,
    confirmLabel: `Remove ${who}`,
    cancelLabel: 'Keep them',
    danger: true,
    cancelIsSafe: true,
  }
}

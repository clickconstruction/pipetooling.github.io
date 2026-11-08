/**
 * The rich view's read (punch list #259 PR 2, v2.6676): the HTML part the bids@ reader kept at `messages.body_html_path`
 * (`<line id>/body.html`, v2.6675), downloaded from the private `message-attachments` bucket under the office's SELECT
 * policy, the one the kept files are opened with. A failure comes back as its `{ kind, message }` for
 * `OfflineRetryPanel`, so a lost signal offers Retry and a refusal shows its reason.
 */
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../offlineRecoveryState'
import { supabase } from '../supabase'

export const RICH_MAIL_BUCKET = 'message-attachments'

/** What the panel says when the read gives no reason of its own. */
export const RICH_MAIL_READ_FAILED = 'The sender’s layout could not be read.'

export type RichMailRead = { ok: true; html: string } | { ok: false; failure: OfflineRecoveryLastError }

export async function loadRichMail(path: string): Promise<RichMailRead> {
  try {
    const { data, error } = await supabase.storage.from(RICH_MAIL_BUCKET).download(path)
    if (error) throw error
    if (!data) throw new Error(RICH_MAIL_READ_FAILED)
    return { ok: true, html: await data.text() }
  } catch (e) {
    return { ok: false, failure: recoveryFailureFromError(e, RICH_MAIL_READ_FAILED) }
  }
}

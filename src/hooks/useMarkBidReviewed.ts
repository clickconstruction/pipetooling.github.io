import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { usePromptDialog } from '../contexts/ConfirmDialogContext'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../lib/bids/updateGuard'
import { resolveActorDisplayName } from '../lib/outcomeChangeBidNote'
import { BID_REVIEWED_EVENT, buildBidReviewPatch, buildBidReviewedNoteBody } from '../lib/bids/bidReview'

/**
 * Mark reviewed (v2.3201): asks for optional notes, stamps who / when / notes on
 * the bid, appends a method-less ledger note (so it shows in the bid's timeline
 * without moving the chase clock), and tells the Bids page to reload.
 * Returns true when the stamp landed.
 */
export function useMarkBidReviewed(): (bid: { id: string; project_name: string | null }) => Promise<boolean> {
  const { user, profileName } = useAuth()
  const { showToast } = useToastContext()
  const prompt = usePromptDialog()

  return useCallback(
    async (bid) => {
      if (!user?.id) {
        showToast('Sign in again to mark a bid reviewed.', 'error')
        return false
      }
      const name = bid.project_name?.trim() || 'this bid'
      const note = await prompt({
        title: 'Mark reviewed',
        message: `You looked over ${name} and it is ready to go out. Any notes for the file? (optional)`,
        confirmLabel: 'Mark reviewed',
        placeholder: 'e.g. trim margin is thin, watch the fixture count on sheet P3',
      })
      if (note === null) return false

      const nowIso = new Date().toISOString()
      const patch = buildBidReviewPatch({ userId: user.id, note, nowIso })
      const { data: rows, error } = await supabase.from('bids').update(patch).eq('id', bid.id).select('id')
      if (error) {
        showToast(`Couldn't mark reviewed: ${error.message}`, 'error')
        return false
      }
      if (bidUpdateRefused(rows)) {
        showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
        return false
      }

      // The ledger line is best effort: the stamp is the truth, the note is the story.
      const actor = resolveActorDisplayName(profileName, user.email)
      const { error: noteErr } = await supabase.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: buildBidReviewedNoteBody({ actorDisplayName: actor, note }),
        contact_method: null,
        occurred_at: nowIso,
        created_by: user.id,
      })
      if (noteErr) showToast(`Marked reviewed, but the bid note didn't save: ${noteErr.message}`, 'warning')
      else showToast('Marked reviewed.', 'success')

      window.dispatchEvent(new CustomEvent(BID_REVIEWED_EVENT, { detail: { bidId: bid.id } }))
      return true
    },
    [user, profileName, showToast, prompt],
  )
}

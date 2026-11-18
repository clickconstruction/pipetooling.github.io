import { useCallback, useEffect, useMemo, useState } from 'react'
import { canDeclineEstimate, type EstimateDeclineChannel } from '../../supabase/functions/_shared/estimateDecline'
import { canResendEstimateLink, type EstimateLinkResendVerdict } from '../../supabase/functions/_shared/estimateLinkResend'
import type { UserRole } from './useAuth'
import { storeEstimateAcceptUrl } from '../lib/estimates/estimateAcceptUrlSession'
import type { EstimateDetailRow } from '../lib/estimates/estimateDetailRow'
import { EXTEND_WORDS, canExtendEstimateGoodThrough, goodThroughState } from '../lib/estimates/estimateGoodThroughExtend'
import { postSendEstimate } from '../lib/estimates/sendEstimateIo'
import { recordNavClick } from '../lib/navClickTelemetry'
import { supabase } from '../lib/supabase'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/**
 * What the office can do to an estimate once it has left: send the link again, move its good-through
 * date (and mail the letter again), record a no heard by phone, and unlink the job it became.
 *
 * Moved whole from `EstimateDetail` (v2.7613, punch list #46 row 3, cut 3 of the Estimates map). Every
 * press returns early unless the row is sent or accepted, and none reads or writes the draft's form —
 * which is why this could leave the page before the draft's engine does. The page keeps `lastAcceptUrl`
 * (the send flow and the customer preview read it too) and the What went counter, and hands in their setters.
 */
export interface EstimateSentActionsInput {
  row: EstimateDetailRow | null
  user: { id: string } | null | undefined
  role: UserRole | null
  /** The page's full reload of the row. */
  load: () => Promise<void>
  loadEstimateCustomerEvents: () => Promise<void>
  setLastAcceptUrl: (url: string | null) => void
  /** What went re-reads after a letter goes from this page (v2.5997). */
  bumpWhatWent: () => void
  showToast: (message: string, kind?: 'success' | 'error' | 'info' | 'warning') => void
}

export interface EstimateSentActions {
  recordingDecline: boolean
  recordStaffDecline: (note: string, channel: EstimateDeclineChannel) => Promise<void>
  extendVerdict: ReturnType<typeof canExtendEstimateGoodThrough>
  extendingGoodThrough: boolean
  extendGoodThrough: (ymd: string, emailAgain?: boolean) => Promise<void>
  resendVerdict: EstimateLinkResendVerdict
  resending: boolean
  resentInfo: { email: string; emailed: boolean; url: string } | null
  resendCustomerLink: () => Promise<void>
  copyResentUrl: (url: string) => void
  unlinkingJob: boolean
  unlinkJobConfirmOpen: boolean
  openUnlinkJobConfirm: () => void
  closeUnlinkJobConfirm: () => void
  confirmUnlinkLinkedJob: () => Promise<void>
}

export function useEstimateSentActions({ row, user, role, load, loadEstimateCustomerEvents, setLastAcceptUrl, bumpWhatWent, showToast }: EstimateSentActionsInput): EstimateSentActions {
  // Resend link (v2.2856, J17-F2/N3): the fresh URL is shown once, in the tab that asked for it.
  const [resending, setResending] = useState(false)
  const [resentInfo, setResentInfo] = useState<{ email: string; emailed: boolean; url: string } | null>(null)
  const [unlinkingJob, setUnlinkingJob] = useState(false)
  const [unlinkJobConfirmOpen, setUnlinkJobConfirmOpen] = useState(false)
  // v2.2873 (J17-N1): the office heard a "no" on the phone — record it. One RPC flips
  // sent → declined and writes the `declined` event (metadata.by = staff) in one transaction.
  const [recordingDecline, setRecordingDecline] = useState(false)
  const [extendingGoodThrough, setExtendingGoodThrough] = useState(false)
  const declineVerdict = useMemo(() => canDeclineEstimate(row?.status), [row?.status])
  async function recordStaffDecline(note: string, channel: EstimateDeclineChannel) {
    if (!row || recordingDecline || !user || !declineVerdict.ok) return
    setRecordingDecline(true)
    try {
      // The RPC ships with this PR's migration; generated types catch up on the next gen-types run.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('record_estimate_decline', {
        p_estimate_id: row.id,
        p_note: note,
        p_channel: channel,
      })
      if (error) throw error
      showToast('Marked declined.', 'success')
      recordNavClick(user.id, role, 'estimate_declined', '#staff')
      await load()
      await loadEstimateCustomerEvents()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not mark declined'), 'error')
    } finally {
      setRecordingDecline(false)
    }
  }

  /** Resend link (v2.2856): can THIS row take a re-mint? Same kernel the edge function enforces. */
  /**
   * Extend good-through (v2.5992, punch list #206 PR 1): `extend_estimate_good_through` moves the date,
   * pushes the link's own end past it (the hash untouched, so every copy of the link keeps working)
   * and writes the trail row; the page reloads the row and its events.
   */
  const extendVerdict = useMemo(
    () => canExtendEstimateGoodThrough(row?.status, row?.sent_at, { inBidRoom: Boolean(row?.bid_room_id) }),
    [row?.status, row?.sent_at, row?.bid_room_id],
  )
  /**
   * The letter again with the same link (v2.5997, #206 PR 4): `send-estimate-to-customer` in mode
   * `remail` mails the stored letter with today's date and the link they already hold; nothing on the
   * row moves. The words name the address, or why it did not go.
   */
  async function remailCustomerLetter(): Promise<void> {
    if (!row || !user) return
    const post = await postSendEstimate({ estimateId: row.id, mode: 'remail' })
    if (post.kind === 'no-session') throw new Error('Not signed in')
    if (post.kind !== 'reply') throw new Error('The letter did not go')
    const json = post.json
    if (!post.httpOk || !json.ok) throw new Error(json.error || 'The letter did not go')
    if (json.accept_url) {
      setLastAcceptUrl(json.accept_url)
      storeEstimateAcceptUrl(row.id, json.accept_url)
    }
    const to = json.sent_to?.trim() || row.customer_email?.trim() || 'them'
    if (json.emailed) showToast(`Emailed again to ${to}, same link.`, 'success')
    else showToast(`The letter did not go. ${json.warning || json.email_error || ''}`.trim(), 'error')
    recordNavClick(user.id, role, 'estimate_letter_remailed', json.emailed ? '#emailed' : '#not-sent')
    bumpWhatWent()
  }
  async function extendGoodThrough(ymd: string, emailAgain = false) {
    if (!row || extendingGoodThrough || !user || !extendVerdict.ok) return
    const wasPassed = goodThroughState(row.valid_until, todayYmdInAppTz()).kind === 'passed'
    setExtendingGoodThrough(true)
    try {
      // The RPC ships with this PR's migration; generated types catch up on the next gen-types run.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('extend_estimate_good_through', {
        p_estimate_id: row.id,
        p_valid_until: ymd,
      })
      if (error) throw error
      showToast(EXTEND_WORDS.done(ymd, wasPassed), 'success')
      recordNavClick(user.id, role, 'estimate_good_through_extended', '#staff')
      if (emailAgain) {
        try {
          await remailCustomerLetter()
        } catch (e) {
          showToast(formatErrorMessage(e, 'The date moved, but the letter did not go. Use Resend link for a fresh one.'), 'error')
        }
      }
      await load()
      await loadEstimateCustomerEvents()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not extend the good-through date'), 'error')
    } finally {
      setExtendingGoodThrough(false)
    }
  }

  const resendVerdict = useMemo(
    () =>
      canResendEstimateLink(row?.status, row?.sent_at, new Date(), {
        validUntil: row?.valid_until ?? null,
        inBidRoom: Boolean(row?.bid_room_id),
      }),
    [row?.status, row?.sent_at, row?.valid_until, row?.bid_room_id],
  )

  // A different estimate → forget the one-time URL panel.
  useEffect(() => {
    setResentInfo(null)
  }, [row?.id])

  const copyResentUrl = useCallback(
    (url: string) => {
      void navigator.clipboard.writeText(url).then(
        () => showToast('Customer link copied.', 'success'),
        () => showToast('Could not copy link.', 'error'),
      )
    },
    [showToast],
  )

  /**
   * Resend link (v2.2856, J17-F2/N3): `send-estimate-to-customer` in `mode: 'resend'` mints a
   * fresh token (the old link dies), mails the stored email again to the address on the row,
   * and returns the new URL — kept in this tab like a first send, and shown once below.
   */
  async function resendCustomerLink() {
    if (!row || resending || !user || !resendVerdict.ok) return
    setResending(true)
    try {
      const post = await postSendEstimate({ estimateId: row.id, mode: 'resend' })
      if (post.kind === 'no-session') {
        showToast('Not signed in', 'error')
        return
      }
      if (post.kind !== 'reply') {
        showToast('Resend failed', 'error')
        return
      }
      const json = post.json
      if (!post.httpOk || !json.ok || !json.accept_url) {
        showToast(json.error || 'Resend failed', 'error')
        return
      }
      const email = json.sent_to?.trim() || row.customer_email?.trim() || ''
      setLastAcceptUrl(json.accept_url)
      storeEstimateAcceptUrl(row.id, json.accept_url)
      setResentInfo({ email, emailed: Boolean(json.emailed), url: json.accept_url })
      showToast(
        json.emailed ? `Link resent to ${email}.` : `New link ready — email did not go out. ${json.warning || json.email_error || ''}`.trim(),
        json.emailed ? 'success' : 'error',
      )
      recordNavClick(user.id, role, 'estimate_link_resent', json.emailed ? '#emailed' : '#link-only')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Resend failed'), 'error')
    } finally {
      setResending(false)
    }
  }

  function openUnlinkJobConfirm() {
    if (!row || row.status !== 'customer_accepted' || !row.job_ledger_id || unlinkingJob) return
    setUnlinkJobConfirmOpen(true)
  }

  function closeUnlinkJobConfirm() {
    if (unlinkingJob) return
    setUnlinkJobConfirmOpen(false)
  }

  async function confirmUnlinkLinkedJob() {
    if (!row || row.status !== 'customer_accepted' || !row.job_ledger_id || unlinkingJob) return
    setUnlinkingJob(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .update({ job_ledger_id: null })
            .eq('id', row.id)
            .eq('status', 'customer_accepted'),
        'unlink estimate job',
      )
      showToast('Job unlinked', 'success')
      setUnlinkJobConfirmOpen(false)
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not unlink job'), 'error')
    } finally {
      setUnlinkingJob(false)
    }
  }

  return {
    recordingDecline,
    recordStaffDecline,
    extendVerdict,
    extendingGoodThrough,
    extendGoodThrough,
    resendVerdict,
    resending,
    resentInfo,
    resendCustomerLink,
    copyResentUrl,
    unlinkingJob,
    unlinkJobConfirmOpen,
    openUnlinkJobConfirm,
    closeUnlinkJobConfirm,
    confirmUnlinkLinkedJob,
  }
}

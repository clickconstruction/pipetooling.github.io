/**
 * Dev inbox for /help guide feedback — thin clone of useDispatchInbox with the
 * group-membership, notes, and dismissal machinery removed (audience = role
 * 'dev'; items are simply open/closed).
 *
 * No useRealtimeChannel on purpose: help_feedback is not in the
 * supabase_realtime publication (see .cursor/rules/supabase-realtime.mdc — we
 * don't publish tables without a subscriber, and this low-traffic single-dev
 * inbox refreshes on load, on the same-tab changed event, and via push-click
 * navigation).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { useAuth } from './useAuth'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  HELP_FEEDBACK_CHANGED_EVENT,
  sortHelpFeedbackRows,
} from '../lib/helpFeedbackHelpers'

const HELP_FEEDBACK_SELECT =
  'id, guide_slug, body, status, created_at, closed_at, closed_note, from_user_id, ' +
  'sender:users!help_feedback_from_user_id_fkey(name, email), ' +
  'closed_by:users!help_feedback_closed_by_user_id_fkey(name)'

export type HelpFeedbackInboxRow = {
  id: string
  guide_slug: string
  body: string
  status: 'open' | 'closed'
  created_at: string | null
  closed_at: string | null
  closed_note: string | null
  from_user_id: string
  sender: { name: string | null; email: string | null } | null
  closed_by: { name: string | null } | null
}

export function useHelpFeedbackInbox() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()

  const helpFeedbackEligible = role === 'dev' && !!authUser?.id
  const [rows, setRows] = useState<HelpFeedbackInboxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)

  const loadHelpFeedback = useCallback(() => {
    if (!helpFeedbackEligible) {
      setRows([])
      return
    }
    setLoading(true)
    void supabase
      .from('help_feedback')
      .select(HELP_FEEDBACK_SELECT)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setLoading(false)
        if (error) {
          console.error('Help feedback inbox load:', error)
          return
        }
        setRows(sortHelpFeedbackRows((data ?? []) as unknown as HelpFeedbackInboxRow[]))
      })
  }, [helpFeedbackEligible])

  useEffect(() => {
    loadHelpFeedback()
  }, [loadHelpFeedback])

  useEffect(() => {
    if (!helpFeedbackEligible) return
    const onChanged = () => loadHelpFeedback()
    window.addEventListener(HELP_FEEDBACK_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(HELP_FEEDBACK_CHANGED_EVENT, onChanged)
  }, [helpFeedbackEligible, loadHelpFeedback])

  const closeHelpFeedback = useCallback(
    async (id: string, note?: string) => {
      if (!authUser?.id) return
      setClosingId(id)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('help_feedback')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by_user_id: authUser.id,
                closed_note: note?.trim() || null,
              })
              .eq('id', id),
          'close help feedback',
        )
        loadHelpFeedback()
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not close feedback'), 'error')
      } finally {
        setClosingId(null)
      }
    },
    [authUser?.id, loadHelpFeedback, showToast],
  )

  const reopenHelpFeedback = useCallback(
    async (id: string) => {
      setClosingId(id)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('help_feedback')
              .update({ status: 'open', closed_at: null, closed_by_user_id: null, closed_note: null })
              .eq('id', id),
          'reopen help feedback',
        )
        loadHelpFeedback()
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not reopen feedback'), 'error')
      } finally {
        setClosingId(null)
      }
    },
    [loadHelpFeedback, showToast],
  )

  return {
    helpFeedbackEligible,
    rows,
    loading,
    closingId,
    loadHelpFeedback,
    closeHelpFeedback,
    reopenHelpFeedback,
  }
}

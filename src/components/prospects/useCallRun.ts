import { useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { callerFirstName } from '../../lib/gc/callScript'
import { TEXT_NO_CHANNEL, TEXT_SENT, runTextNote, runTextPlan, runTextWords, type CallRun, type RunOutcome } from '../../lib/prospects/callRun'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { loadProspectThread, startProspectThread } from '../../lib/prospects/prospectThreadIo'
import { textRefusal } from '../../lib/prospects/textingRule'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'

/**
 * What a run on the Subs deck has done so far (v2.5808): one note a card, whether the run is done, the callback a
 * missed call set, and the text press's state. The notes reset when the run's ids change and do not survive a
 * refresh, since the address carries only the ids. Moved out of `src/pages/Prospects.tsx` unchanged; the rules
 * are in `lib/prospects/callRun.ts`.
 *
 * The page still decides the run from the address, sets `runDone` on the last Next and `runCallbackAt` on a
 * missed call, and notes each outcome from its own handlers.
 */
export function useCallRun({
  run,
  userId,
  authUserName,
  projectName,
  currentProspectId,
  loadComments,
}: {
  /** The run the address names on the Subs lane, or none. */
  run: CallRun | null
  userId: string | null
  authUserName: string
  /** The project a set of plans is for (`?for=`), which the text names. */
  projectName: string | null
  currentProspectId: string | null
  loadComments: (prospectId: string) => Promise<void>
}) {
  const { showToast } = useToastContext()
  const runKey = run ? run.ids.join(',') : ''
  const [runOutcomes, setRunOutcomes] = useState<RunOutcome[]>([])
  const [runDone, setRunDone] = useState(false)
  const [runCallbackAt, setRunCallbackAt] = useState<Date | null>(null)
  const [runTextState, setRunTextState] = useState<Record<string, 'sending' | 'sent'>>({})

  useEffect(() => {
    // A new run starts clean; the same run survives a refresh except for its receipt, which the ids cannot carry.
    setRunOutcomes([])
    setRunDone(false)
    setRunCallbackAt(null)
    setRunTextState({})
  }, [runKey])

  /** What the run did to a card (v2.5808), one note a card, the newest outcome standing. */
  function noteRunOutcome(id: string, kindOf: RunOutcome['kind'], patch: Partial<RunOutcome> = {}) {
    if (!run) return
    setRunOutcomes((prev) => {
      const was = prev.find((o) => o.id === id)
      const next: RunOutcome = { ...(was ?? { id, kind: kindOf }), kind: kindOf, ...patch }
      return [...prev.filter((o) => o.id !== id), next]
    })
  }

  /**
   * The one-press text after a missed call in a run (v2.5808): held by the texting rule until they said we may, sent
   * through quo-send to the number on their Messages thread, and noted on the card. The first text to a sub nobody
   * has written to starts their thread from the card's number (v2.6032: `runTextPlan` → `contact_for_prospect`).
   */
  async function sendRunText(prospect: Prospect) {
    if (!run || !userId) return
    const held = textRefusal(prospect)
    if (held) {
      showToast(held.words, 'info')
      return
    }
    setRunTextState((st) => ({ ...st, [prospect.id]: 'sending' }))
    const clear = () =>
      setRunTextState((st) => {
        const next = { ...st }
        delete next[prospect.id]
        return next
      })
    try {
      let plan = runTextPlan(prospect, await loadProspectThread(prospect.id))
      let started = false
      if (plan.kind === 'start') {
        plan = runTextPlan(prospect, await startProspectThread(prospect.id), true)
        started = true
      }
      if (plan.kind !== 'send') {
        showToast(plan.kind === 'hold' ? plan.words : TEXT_NO_CHANNEL, 'info')
        clear()
        return
      }
      const body = runTextWords({ caller: callerFirstName(authUserName), company: PORTAL_COMPANY.name, trade: run.trade, projectName })
      const { data, error } = await supabase.functions.invoke('quo-send', { body: { contactId: plan.contactId, channelId: plan.channelId, body } })
      const answer = (data ?? null) as { ok?: boolean; words?: string } | null
      if (error || !answer?.ok) throw new Error(answer?.words ?? 'The text did not go.')
      await supabase.from('prospect_comments').insert({ prospect_id: prospect.id, created_by: userId, comment_text: runTextNote(body, started), interaction_type: 'user_comment' })
      setRunTextState((st) => ({ ...st, [prospect.id]: 'sent' }))
      noteRunOutcome(prospect.id, 'didnt_answer', { texted: true })
      showToast(TEXT_SENT, 'success')
      if (currentProspectId === prospect.id) await loadComments(prospect.id)
    } catch (err) {
      showToast(formatErrorMessage(err, 'The text did not go.'), 'error')
      clear()
    }
  }

  return { runOutcomes, runDone, setRunDone, runCallbackAt, setRunCallbackAt, runTextState, noteRunOutcome, sendRunText }
}

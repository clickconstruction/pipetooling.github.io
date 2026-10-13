/**
 * Messages, residential R8 · 8's screens: a line on an estimate from a customer's message, inside the thread window
 * through cut 1's slots (`threadSlots.tsx`), after cut 4b's change order. The window calls `useThreadSlots`, and so this
 * hook, only while a thread is open. It reads the person and which of their messages became a line on which estimate
 * (`lineFromMessageIo.ts`) and fills two slots: the message window's *Line on the estimate* (`StartEstimateLine`) on a
 * customer's own line tied to a Pipeline job, and an *a line on estimate 1044* chip under a line that became one. Saving
 * says the kernel's words, reads again and asks the window to read the thread again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { draftedWords, onEstimateChip, whoMayDraft, type LineDraft } from '../../lib/estimates/lineFromMessage'
import { supabaseLineFromMessageIo, type LineFromMessageIo, type LineSaved, type ThreadEstimateLines } from '../../lib/estimates/lineFromMessageIo'
import { jobRefOf } from '../../lib/messages/load'
import { Chip } from '../gc/gcUi'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { StartEstimateLine } from './StartEstimateLine'

export type EstimateLineThreadSlots = Pick<ThreadSlots, 'messageWindowFirst' | 'underLine'>

const ON_TIP = 'This message is a line on the estimate. The money team prices it and sends it.'

export function useEstimateLineThreadSlots(io: LineFromMessageIo = supabaseLineFromMessageIo): EstimateLineThreadSlots {
  const { contactId } = useThreadWindow()
  // Optional, so a window drawn without the app's auth (another cut's smoke) draws none of these.
  const auth = useOptionalAuth()
  const { showToast } = useToastContext()
  const reread = useMessagesReread()
  const on = Boolean(contactId) && whoMayDraft(auth?.role ?? null)
  const [read, setRead] = useState<{ contactId: string; got: ThreadEstimateLines } | null>(null)
  // The thread asked for last: a read for one opened before it never lands on it.
  const asked = useRef<string | null>(null)

  const load = useCallback(async () => {
    asked.current = on ? contactId : null
    if (!on || !contactId) return
    try {
      const got = await io.loadThread(contactId)
      if (asked.current === contactId) setRead({ contactId, got })
    } catch {
      // The press and the chips wait for a read that works; the thread itself still draws.
    }
  }, [on, contactId, io])
  useEffect(() => {
    void load()
  }, [load])

  const got = on && read && read.contactId === contactId ? read.got : null

  const drafted = useCallback(
    async (saved: LineSaved, draft: LineDraft) => {
      showToast(draftedWords({ number: saved.lineNumber, estimateNumber: saved.estimateNumber, jobName: draft.jobName }), 'success')
      await load()
      reread()
    },
    [showToast, load, reread],
  )

  return useMemo<EstimateLineThreadSlots>(() => {
    if (!got) return {}
    const { contact, became } = got
    return {
      underLine: (m) => {
        const line = became.get(m.id)
        return line ? (
          <Chip tone="blue" small title={ON_TIP}>
            {onEstimateChip(line.estimateNumber)}
          </Chip>
        ) : null
      },
      messageWindowFirst: (m) => {
        // A customer's own lines, on one of their Pipeline jobs: a GC job's line takes a change order instead.
        if (!contact || contact.kind !== 'customer' || m.contactId !== contact.id || m.channel === 'event') return null
        const line = became.get(m.id)
        if (line)
          return (
            <Chip tone="blue" title={ON_TIP}>
              {onEstimateChip(line.estimateNumber)}
            </Chip>
          )
        if (jobRefOf(m.jobId)?.kind !== 'pipeline') return null
        return <StartEstimateLine key={m.id} message={m} contact={contact} io={io} onDrafted={drafted} />
      },
    }
  }, [got, io, drafted])
}

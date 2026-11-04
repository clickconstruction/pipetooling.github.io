/**
 * Messages, the email viewer's action row (v2.6509): the message window's first slot (`threadSlots.tsx`'s
 * `messageWindowFirst`), after cut 4b's change order, with the presses the kernel offers for the line
 * (`emailViewerActions.ts`: Start a bid, Put it on a bid…, Open the bid). The change order itself stays cut 4b's;
 * both hooks ask the same kernel, so one place decides the row. Each press writes through the New lane's *Bid it?* io or
 * the Tied to row's own writer, says what it did and asks the window to read the thread again (`useMessagesReread`).
 */
import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { lineInvitation } from '../../lib/followUp/newLaneRows'
import { canOpenMessages } from '../../lib/gc/access'
import { viewerPresses, type ViewerPress } from '../../lib/messages/emailViewerActions'
import { supabaseEmailViewerIo, type EmailViewerIo } from '../../lib/messages/emailViewerActionsIo'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { bidHref } from '../followUp/useNewLaneThreadSlots'
import { EmailViewerActions } from './EmailViewerActions'

let defaultIo: EmailViewerIo | null = null

export function useEmailViewerThreadSlots(io?: EmailViewerIo): Pick<ThreadSlots, 'messageWindowFirst'> {
  // Optional, so a window drawn without the app's providers (another cut's smoke) draws none of these.
  const auth = useOptionalAuth()
  const toasts = useOptionalToastContext()
  const reread = useMessagesReread()
  const navigate = useNavigate()
  const { closeThread } = useThreadWindow()
  const role = auth?.role ?? null
  const on = canOpenMessages(role) && toasts !== null
  const meId = auth?.user?.id ?? ''
  const say = useCallback((words: string, tone: 'success' | 'error') => toasts?.showToast(words, tone), [toasts])
  // Start a bid and Open the bid land where the Bid it? card's do: the thread closed, the Bid Board on the bid.
  const openBid = useCallback(
    (bidId: string) => {
      closeThread()
      navigate(bidHref(bidId))
    },
    [closeThread, navigate],
  )
  const theIo = io ?? (defaultIo ??= supabaseEmailViewerIo())
  return useMemo(
    () =>
      on
        ? {
            messageWindowFirst: (m) => {
              const inv = lineInvitation({ channel: m.channel, direction: m.direction, subject: m.subject, body: m.body, at: m.at, invitation: m.invitation })
              const presses = viewerPresses({ jobId: m.jobId, channel: m.channel, direction: m.direction, invitation: inv !== null, role }).filter(
                (p): p is Exclude<ViewerPress, 'change_order'> => p !== 'change_order',
              )
              if (presses.length === 0) return null
              return <EmailViewerActions key={`viewer:${m.id}`} message={m} invitation={inv} presses={presses} io={theIo} me={{ id: meId }} say={say} reread={reread} openBid={openBid} />
            },
          }
        : {},
    [on, role, theIo, meId, say, reread, openBid],
  )
}

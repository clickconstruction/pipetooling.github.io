/**
 * Messages → My email, the Sent side with no press (punch list #263 PR B, call 2, v2.6751): under a line the app put on
 * the job from a person's own Sent (`messages.placed_by_app`, written by `gmail-mine`'s follow), the grey mark *from
 * Wendi's mail · put here by the app* and, for the person whose mail it is alone, **Untag**: asked once through the
 * confirm window, then `gmail-mine`'s `untag` on the conversation, which takes the app's lines off and leaves the
 * tombstone so the app never puts it back; the page reads the thread again. Drawn through cut 1's slots
 * (`threadSlots.tsx`), `underLine`; nothing under any other line.
 */
import { useMemo, useRef, useState } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import type { ThreadMessage } from '../../lib/messages/thread'
import { PLACED_LINE_WORDS, placedLineWords } from '../../lib/myMail/mineFunction'
import { supabaseMyMailIo, type MyMailIo } from '../../lib/myMail/myMailIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useOpenThread } from '../gc/messages/openThread'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'

export type MyMailPlacedLineThreadSlots = Pick<ThreadSlots, 'underLine'>

/** The mark and the press under one placed line; it reads the team's names off the open thread. */
export function PlacedLineMark({ message, io }: { message: ThreadMessage; io?: Pick<MyMailIo, 'untag'> }) {
  const auth = useOptionalAuth()
  const open = useOpenThread()
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const reread = useMessagesReread()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const client = useRef<Pick<MyMailIo, 'untag'> | null>(null)
  const name = message.mailUserId ? (open?.userNames[message.mailUserId] ?? '') : ''
  const mine = Boolean(auth?.user?.id && message.mailUserId && auth.user.id === message.mailUserId)
  const untag = async () => {
    if (busy || !message.gmailThreadId) return
    const yes = await confirm({ message: PLACED_LINE_WORDS.untagAsk, confirmLabel: PLACED_LINE_WORDS.untag, danger: true })
    if (!yes) return
    setBusy(true)
    setProblem(null)
    try {
      client.current ??= io ?? supabaseMyMailIo()
      const a = await client.current.untag({ threadId: message.gmailThreadId })
      if (!a.ok) {
        setProblem(a.words)
        return
      }
      showToast(PLACED_LINE_WORDS.untagged, 'success')
      reread()
    } catch (e) {
      setProblem(formatErrorMessage(e, PLACED_LINE_WORDS.notUntagged))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div data-thread-placed={message.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
      <span>{placedLineWords(name)}</span>
      {mine && message.gmailThreadId ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void untag()
          }}
          disabled={busy}
          data-testid={`placed-untag-${message.id}`}
          style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-red-700)', cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? '…' : PLACED_LINE_WORDS.untag}
        </button>
      ) : null}
      {problem ? <span role="alert">{problem}</span> : null}
    </div>
  )
}

export function useMyMailPlacedLineThreadSlots(io?: Pick<MyMailIo, 'untag'>): MyMailPlacedLineThreadSlots {
  return useMemo<MyMailPlacedLineThreadSlots>(() => ({ underLine: (m) => (m.placedByApp ? <PlacedLineMark key={`placed:${m.id}`} message={m} io={io} /> : null) }), [io])
}

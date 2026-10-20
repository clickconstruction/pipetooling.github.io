/**
 * Messages, cut 4b's screens: a change order from a customer's message, inside the thread window through cut 1's slots
 * (`threadSlots.tsx`). The window calls `useThreadSlots`, and so this hook, only while a thread is open. It reads the
 * person and which of their messages became which change order (`fromMessageIo.ts`) and fills two slots, each after cut
 * 2's: the message window's *Start a change order* (`StartChangeOrder`), and a *became CO 2* chip under a line that
 * became one. Saving a draft says the kernel's words, reads again and asks the window to read the thread again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { becameChip, draftedWords, whoMayDraft } from '../../lib/changeOrders/fromMessage'
import { supabaseFromMessageIo, type FromMessageIo, type ThreadChangeOrders } from '../../lib/changeOrders/fromMessageIo'
import { jobRefOf } from '../../lib/messages/load'
import { Chip } from '../gc/gcUi'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { StartChangeOrder } from './StartChangeOrder'

export type ChangeOrderThreadSlots = Pick<ThreadSlots, 'messageWindowFirst' | 'underLine'>

const BECAME_TIP = 'A change order drafted from this message. The money team prices it and sends it to sign.'

export function useChangeOrderThreadSlots(io: FromMessageIo = supabaseFromMessageIo): ChangeOrderThreadSlots {
  const { contactId } = useThreadWindow()
  // Optional, so a window drawn without the app's auth (another cut's smoke) draws none of these. The window itself
  // needs the toasts, so they are always there.
  const auth = useOptionalAuth()
  const { showToast } = useToastContext()
  const reread = useMessagesReread()
  const on = Boolean(contactId) && whoMayDraft(auth?.role ?? null)
  const [read, setRead] = useState<{ contactId: string; got: ThreadChangeOrders } | null>(null)
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
    async (order: { number: number }, jobName: string) => {
      showToast(draftedWords(order.number, jobName), 'success')
      await load()
      reread()
    },
    [showToast, load, reread],
  )

  return useMemo<ChangeOrderThreadSlots>(() => {
    if (!got) return {}
    const { contact, became } = got
    return {
      underLine: (m) => {
        const order = became.get(m.id)
        return order ? (
          <Chip tone="blue" small title={BECAME_TIP}>
            {becameChip(order.number)}
          </Chip>
        ) : null
      },
      messageWindowFirst: (m) => {
        // A customer's own lines only: a change order goes to a customer, and is signed by the one who wrote.
        if (!contact || contact.kind !== 'customer' || m.contactId !== contact.id || m.channel === 'event') return null
        const order = became.get(m.id)
        if (order)
          return (
            <Chip tone="blue" title={BECAME_TIP}>
              {becameChip(order.number)}
            </Chip>
          )
        // A line on a Pipeline job goes on its estimate instead (R8 · 8's *Line on the estimate*).
        if (jobRefOf(m.jobId)?.kind === 'pipeline') return null
        return <StartChangeOrder key={m.id} message={m} contact={contact} io={io} onDrafted={drafted} />
      },
    }
  }, [got, io, drafted])
}

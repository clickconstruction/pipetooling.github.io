/**
 * Messages: what a press on a contact point in a message's words does (v2.6513, `bodyContacts.ts`, drawn by
 * `MessageBodyContacts`). Three presses, one line each on the thread the press was made in, with Undo on the toast for
 * ten seconds as Heard back has (v2.6500):
 *
 * - **Call** dials by itself (`CallButton`); this writes *Grace pressed Call on (832) 871-4166 ext. 121 from Glenn's
 *   email of Oct 22.* The line names the intent; a call Quo places lands its own call line as the fact.
 * - **Text** and **Email** open the reply box on that kind in the thread the number or the address belongs to: this
 *   thread when it is this person's (*… pressed Email on …*), else the thread of whoever holds it, or a thread made
 *   for them by the press (`BodyContactsIo.makeThread`, never by a read), and the line reads *… opened a thread for
 *   glenn@marrexbuilders.example from …* with a door to it (`contactForPressValue`, drawn by the window on the event line).
 * - **Open the map** opens by itself; this writes *… opened the map for …*.
 *
 * The lines are held in `bodyContactsIo.ts`'s store, so Undo survives the viewer closing and the thread changing;
 * a refused write says why on a toast, as Heard back's does.
 */
import { useCallback, useMemo, useRef } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { firstName, normalizeChannel, type Contact } from '../../../lib/contacts/kernel'
import { pressProblem } from '../../../lib/followUp/followUpIo'
import { contactPressBody, PRESS_UNDO_MS, PRESS_WORDS_UI, type ContactPoint, type ContactPress, type PressSource } from '../../../lib/messages/bodyContacts'
import { deferLine, supabaseBodyContactsIo, type BodyContactsIo } from '../../../lib/messages/bodyContactsIo'
import { channelWord, type ThreadMessage } from '../../../lib/messages/thread'
import { formatDenverCalendarDayShort } from '../../../utils/dateUtils'
import type { ContactPointActs } from './MessageBodyContacts'
import { useMessagesReread } from './useMessagesReread'
import type { OpenThreadMore } from './useThreadWindow'

/** Where the press was made, from the line's facts. */
export function pressSourceOf(message: Pick<ThreadMessage, 'direction' | 'channel' | 'at'>, contact: Pick<Contact, 'name' | 'goesBy' | 'kind'>): PressSource {
  const ours = message.direction !== 'in'
  return {
    first: message.direction === 'in' ? firstName(contact) || contact.name : null,
    channel: message.direction === 'team' ? 'note' : channelWord(message).toLowerCase(),
    dayWords: formatDenverCalendarDayShort(Date.parse(message.at)),
    ours,
  }
}

export interface ContactPointActsInput {
  contact: Contact | null
  message: ThreadMessage | null
  /** Closes the message window before the thread moves. */
  onClose: () => void
  /** Opens a thread, this one or another person's, with the box woken on the kind. */
  onShowContact?: (contactId: string, more?: OpenThreadMore) => void
  io?: BodyContactsIo
  undoMs?: number
}

export function useContactPointActs({ contact, message, onClose, onShowContact, io: ioGiven, undoMs = PRESS_UNDO_MS }: ContactPointActsInput): ContactPointActs {
  const { showToast, showActionToast } = useToastContext()
  const reread = useMessagesReread()
  const io = useMemo(() => ioGiven ?? supabaseBodyContactsIo(), [ioGiven])
  const myName = useRef<Promise<string> | null>(null)
  const busy = useRef(false)

  const line = useCallback(
    (press: ContactPress, value: string) => {
      if (!contact || !message) return
      const contactId = contact.id
      const source = pressSourceOf(message, contact)
      myName.current ??= io.myName().catch(() => '')
      const name = myName.current
      const { undo } = deferLine(
        async () => {
          await io.writeLine(contactId, contactPressBody(await name, press, value, source))
          reread()
        },
        (e) => showToast(pressProblem(e), 'error'),
        undoMs,
      )
      showActionToast(
        PRESS_WORDS_UI.toast(press, value),
        {
          label: PRESS_WORDS_UI.undo,
          onClick: () => {
            if (undo()) showToast(PRESS_WORDS_UI.undone, 'info')
          },
        },
        { durationMs: undoMs },
      )
    },
    [contact, message, io, reread, showToast, showActionToast, undoMs],
  )

  const onCall = useCallback((point: ContactPoint) => line('call', point.words), [line])
  const onMap = useCallback((point: ContactPoint) => line('map', point.words), [line])

  const onReply = useCallback(
    (point: ContactPoint, kind: 'text' | 'email') => {
      if (!contact || point.kind === 'address') return
      const value = point.kind === 'email' ? point.address : point.number
      const chKind = point.kind
      const key = normalizeChannel(chKind, value)
      const mine = contact.channels.some((ch) => ch.kind === chKind && normalizeChannel(ch.kind, ch.value) === key)
      if (mine) {
        onClose()
        onShowContact?.(contact.id, { reply: kind })
        line(kind, value)
        return
      }
      if (busy.current) return
      busy.current = true
      void (async () => {
        try {
          const found = await io.whoseChannel(chKind, value)
          if (found === contact.id) {
            onClose()
            onShowContact?.(contact.id, { reply: kind })
            line(kind, value)
            return
          }
          const id = found ?? (await io.makeThread(chKind, value, contact))
          onClose()
          onShowContact?.(id, { reply: kind })
          line('thread', value)
        } catch (e) {
          showToast(pressProblem(e), 'error')
        } finally {
          busy.current = false
        }
      })()
    },
    [contact, io, line, onClose, onShowContact, showToast],
  )

  return useMemo(() => ({ onCall, onReply, onMap }), [onCall, onReply, onMap])
}

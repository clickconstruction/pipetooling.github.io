/**
 * The estimate door on our side of the thread (v2.5698, punch list #139 PR 7; on texts since v2.5706, PR 14): on our
 * estimate email's line, a press that closes the thread and opens the estimate. Where the line's words only repeat
 * the subject (the email's own heading, so the subject read twice), the door draws in their place; otherwise under
 * the line. A text that carried the accept link draws it under the text, its estimate named by the link's token
 * hash (`estimateDoorIo.ts`). The rule is `lib/messages/estimateDoor.ts`. Drawn through cut 1's slots
 * (`threadSlots.tsx`); the texts' read runs once per open thread.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ESTIMATE_DOOR_WORDS, estimateDoorFor, estimateDoorHref, type EstimateDoor } from '../../lib/messages/estimateDoor'
import { loadTextDoors } from '../../lib/messages/estimateDoorIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useThreadWindow } from '../gc/messages/useThreadWindow'

export type EstimateDoorThreadSlots = Pick<ThreadSlots, 'lineBody' | 'underLine'>

const door: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  marginTop: '0.25rem',
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
}

const NO_DOORS: ReadonlyMap<string, EstimateDoor> = new Map()

export function useEstimateDoorThreadSlots(io: (contactId: string) => Promise<Map<string, EstimateDoor>> = loadTextDoors): EstimateDoorThreadSlots {
  const navigate = useNavigate()
  const { contactId, closeThread } = useThreadWindow()
  const [read, setRead] = useState<{ contactId: string; doors: Map<string, EstimateDoor> } | null>(null)
  // The thread asked for last: a read for one opened before it never lands on it.
  const asked = useRef<string | null>(null)
  const load = useCallback(async () => {
    asked.current = contactId
    if (!contactId) return
    try {
      const doors = await io(contactId)
      if (asked.current === contactId) setRead({ contactId, doors })
    } catch {
      // The texts draw no door until a read works; the thread itself still draws.
    }
  }, [contactId, io])
  useEffect(() => {
    void load()
  }, [load])
  const doors = read && read.contactId === contactId ? read.doors : NO_DOORS

  return useMemo<EstimateDoorThreadSlots>(() => {
    const doorFor = (m: ThreadMessage) => estimateDoorFor({ channel: m.channel, direction: m.direction, subject: m.subject ?? null, body: m.body })
    const button = (m: ThreadMessage, d: EstimateDoor) => (
      <button
        key={`estimate-door:${m.id}`}
        type="button"
        style={door}
        title={ESTIMATE_DOOR_WORDS.tip}
        data-testid="estimate-door"
        onClick={(e) => {
          // The line's own press opens the message window; this press leaves the thread for the estimate.
          e.stopPropagation()
          closeThread()
          navigate(estimateDoorHref(d))
        }}
      >
        📄 {ESTIMATE_DOOR_WORDS.open(d)}
      </button>
    )
    return {
      lineBody: (m) => {
        const d = doorFor(m)
        return d?.duplicate ? button(m, d) : null
      },
      underLine: (m) => {
        const d = doorFor(m)
        if (d) return d.duplicate ? null : button(m, d)
        const t = m.channel === 'text' && m.direction === 'out' ? doors.get(m.id) : undefined
        return t ? button(m, t) : null
      },
    }
  }, [navigate, closeThread, doors])
}

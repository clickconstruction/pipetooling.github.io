/**
 * Messages, cut 2's screens, PR C1: Follow up inside the thread window, through cut 1's slots (`threadSlots.tsx`). The
 * window calls `useThreadSlots`, and so this hook, only while a thread is open. It reads that person's Follow up rows
 * once (`followUpThreadIo.ts`) and fills three slots: who has it in the header (`WhoHasItPill`, as on Follow up's rows),
 * the back and snoozed pills in the status row (the prototype's `statusPills`), and ⋯'s No reply needed, Remind me
 * Monday and Reopen. Each press says the kernel's words, reads the rows again and asks the window to read the thread
 * again (`useMessagesReread`), for the gray line the press wrote.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { followUpContactOf, followUpMessagesFromRows, holdersFromRows } from '../../lib/followUp/followUpRows'
import { supabaseFollowUpThreadIo, type FollowUpThreadIo, type FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import { BACK_CLEARED_TOAST, backPill, hasToast, snoozedWords, standingBackNote, stateToast } from '../../lib/followUp/queue'
import type { Teammate } from '../../lib/followUp/team'
import { backPillTip, threadStateRows } from '../../lib/followUp/thread'
import { canOpenGcProjects } from '../../lib/gc/access'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { Chip } from '../gc/gcUi'
import type { ThreadMenuRow, ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { WhoHasItPill } from './WhoHasItPill'

const DEFAULT_IO = supabaseFollowUpThreadIo()

export type FollowUpThreadSlots = Pick<ThreadSlots, 'headerRight' | 'statusRow' | 'menuRows'>

export function useFollowUpThreadSlots(io: FollowUpThreadIo = DEFAULT_IO): FollowUpThreadSlots {
  const { contactId } = useThreadWindow()
  // Optional, so a window drawn without the app's providers (another cut's smoke) draws none of cut 2's pieces.
  const auth = useOptionalAuth()
  const toasts = useOptionalToastContext()
  const reread = useMessagesReread()
  const user = auth?.user ?? null
  const role = auth?.role ?? null
  const profileName = auth?.profileName ?? null
  const on = Boolean(contactId) && canOpenGcProjects(role) && toasts !== null
  const [read, setRead] = useState<{ contactId: string; rows: FollowUpThreadRows } | null>(null)
  const [team, setTeam] = useState<Teammate[]>([])
  const [pressing, setPressing] = useState<string | null>(null)
  // The thread asked for last: a read for one opened before it never lands on it.
  const asked = useRef<string | null>(null)

  const load = useCallback(async () => {
    asked.current = on ? contactId : null
    if (!on || !contactId) return
    try {
      const rows = await io.loadThread(contactId)
      if (asked.current === contactId) setRead({ contactId, rows })
    } catch {
      // The pieces wait for a read that works; the thread itself still draws.
    }
  }, [on, contactId, io])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!on) return
    let live = true
    io.loadTeam().then(
      (t) => live && setTeam(t),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [on, io])

  // A profile with no name still reads its own conversations as *You have this*.
  const me = useMemo<Teammate>(() => ({ id: user?.id ?? '', name: profileName || 'You', role: role ?? '' }), [user?.id, profileName, role])
  const userNames = useMemo(() => Object.fromEntries([...team, me].map((t) => [t.id, t.name])), [team, me])
  const rows = read && read.contactId === contactId ? read.rows : null
  const notes = useMemo(() => (rows ? followUpMessagesFromRows(rows.notes, { userNames }) : []), [rows, userNames])
  const holders = useMemo(() => (rows ? holdersFromRows(rows.holders, userNames) : []), [rows, userNames])

  if (!on || !rows || !toasts) return {}
  const { showToast } = toasts

  const press = async (name: string, run: () => Promise<unknown>, words: string | null) => {
    setPressing(name)
    try {
      await run()
      if (words) showToast(words, 'success')
      reread()
      await load()
    } catch (e) {
      showToast(pressProblem(e), 'error')
    } finally {
      setPressing(null)
    }
  }
  const todayYmd = todayYmdInAppTz()
  const nowIso = new Date().toISOString()
  // A slot draws only for the person the rows were read for.
  const mine = (id: string) => id === contactId

  return {
    headerRight: (c) =>
      mine(c.id) ? (
        <WhoHasItPill
          contact={followUpContactOf(c, rows.contact, userNames)}
          me={me}
          team={team}
          everyone={holders}
          todayYmd={todayYmd}
          nowIso={nowIso}
          busy={pressing === 'hand'}
          onHand={(userId) => {
            const to = userId === null ? null : userId === me.id ? me.name : (userNames[userId] ?? 'Someone')
            void press('hand', () => (userId === me.id ? io.takeIt(c.id) : io.handTo(c.id, userId)), hasToast(me.name, c.name, to))
          }}
        />
      ) : null,
    statusRow: (c) => {
      if (!mine(c.id)) return null
      const note = standingBackNote(notes, c.id)
      const back = note ? backPill(note) : null
      const snoozed = snoozedWords(followUpContactOf(c, rows.contact, userNames))
      if (!back && !snoozed) return null
      return (
        <>
          {note && back && (
            <span data-follow-up-back={note.id} title={backPillTip(note)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              <Chip tone="blue">{back}</Chip>
              <button
                type="button"
                aria-label="Clear the day"
                disabled={pressing === 'back'}
                onClick={() => void press('back', () => io.backDone(note.id), BACK_CLEARED_TOAST)}
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.2rem' }}
              >
                ×
              </button>
            </span>
          )}
          {snoozed && <Chip tone="grey">{snoozed}</Chip>}
        </>
      )
    },
    menuRows: (c): ThreadMenuRow[] =>
      mine(c.id)
        ? threadStateRows(followUpContactOf(c, rows.contact, userNames).state, todayYmd).map((r) => ({
            key: `follow-up-${r.move}`,
            label: r.label,
            tip: r.tip,
            disabled: pressing !== null,
            onPress: () => void press('state', () => io.setState(c.id, r.sets), stateToast(r.move, c.name)),
          }))
        : [],
  }
}

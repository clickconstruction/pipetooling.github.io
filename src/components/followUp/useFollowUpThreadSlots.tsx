/**
 * Messages, cut 2's screens, PR C1: Follow up inside the thread window, through cut 1's slots (`threadSlots.tsx`). The
 * window calls `useThreadSlots`, and so this hook, only while a thread is open. It reads that person's Follow up rows
 * once (`followUpThreadIo.ts`) and fills three slots: who has it in the header (`WhoHasItPill`, as on Follow up's rows),
 * the back and snoozed pills in the status row (the prototype's `statusPills`), and ⋯'s No reply needed, Remind me
 * Monday and Reopen. Each press says the kernel's words, reads the rows again and asks the window to read the thread
 * again (`useMessagesReread`), for the gray line the press wrote. Since C2 it fills `aboveBox` with what we owe them
 * (`OwedStrip`), opened from the status row's *We owe them…* or *Change what we owe*; *Mark it done, with a team note*
 * hands the box a settle (`owedStore`), which ends when the thread changes or closes. Since C3 it draws what a line was
 * heard as under it (`HeardUnderLine`), the running promise's pill, a line's highlights in place of its first lines
 * (`HighlightedBody`) and the message window's highlight tool (`HighlightTool`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { useOptionalAuth } from '../../hooks/useAuth'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { askArchitectToast, askTheArchitect, lineGcProject, planQuestionOf } from '../../lib/followUp/askArchitect'
import { followUpContactOf, followUpMessagesFromRows, heardLinesFromRows, highlightsFromRows, holdersFromRows, owedRecordsFromRows } from '../../lib/followUp/followUpRows'
import { supabaseFollowUpThreadIo, type FollowUpThreadIo, type FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import { BACK_CLEARED_TOAST, backPill, hasToast, openOwed, snoozedWords, standingBackNote, stateToast } from '../../lib/followUp/queue'
import { owedStore } from '../../lib/followUp/owedStore'
import { HIGHLIGHTED_TOAST, highlightsRemovedToast, wholeWords } from '../../lib/messages/highlights'
import { owedDayToast, owedMarkedToast, owedWhatToast, type DayKept } from '../../lib/messages/owed'
import { ANSWER_IT_MYSELF_TOAST, heardDay, promiseWrittenWords, runningPromise } from '../../lib/messages/promises'
import type { Teammate } from '../../lib/followUp/team'
import { backPillTip, threadStateRows } from '../../lib/followUp/thread'
import { canOpenGcProjects } from '../../lib/gc/access'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { Chip } from '../gc/gcUi'
import type { ThreadMenuRow, ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { HeardUnderLine } from './HeardUnderLine'
import { HighlightedBody } from './HighlightedBody'
import { HighlightTool } from './HighlightTool'
import { OwedStrip } from './OwedStrip'
import { WhoHasItPill } from './WhoHasItPill'

const DEFAULT_IO = supabaseFollowUpThreadIo()

export type FollowUpThreadSlots = Pick<ThreadSlots, 'headerRight' | 'statusRow' | 'menuRows' | 'aboveBox' | 'underLine' | 'lineBody' | 'messageWindowFirst'>

const quiet = { border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', padding: '0.1rem 0.55rem' } as const

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
  // What we owe's strip, open above the box for the open thread.
  const [owedOpen, setOwedOpen] = useState(false)
  const settle = useSyncExternalStore(owedStore.subscribe, owedStore.get, owedStore.get)
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
  // Read on open, and again when a team note from the box marked what we owe done.
  useEffect(() => {
    void load()
  }, [load, settle.version])
  // A settle, and the strip, belong to the thread they started in: leaving it ends them.
  useEffect(() => {
    setOwedOpen(false)
    return () => {
      owedStore.cancel(contactId)
      owedStore.unpublish(contactId)
    }
  }, [contactId])
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
  const owed = useMemo(() => (rows && contactId ? openOwed(owedRecordsFromRows(rows.owed, userNames), contactId) : null), [rows, contactId, userNames])
  const heard = useMemo(() => (rows ? heardLinesFromRows(rows.heard, userNames) : []), [rows, userNames])
  const heardByLine = useMemo(() => new Map(heard.map((l) => [l.messageId, l])), [heard])
  const highlights = useMemo(() => (rows ? highlightsFromRows(rows.highlights, userNames) : new Map<string, never[]>()), [rows, userNames])
  // What we owe the open person, for cut 3's send window (`useThreadOwed`), once read.
  useEffect(() => {
    if (rows && contactId) owedStore.publish(contactId, owed)
  }, [rows, contactId, owed])

  if (!on || !rows || !toasts) return {}
  const { showToast } = toasts

  // Every press: its words, or the words its end gives (Ask the architect's), then a read again here and in the window.
  const run = async (name: string, work: () => Promise<{ words: string; tone: 'success' | 'error' } | null>) => {
    setPressing(name)
    try {
      const said = await work()
      if (said) showToast(said.words, said.tone)
      reread()
      await load()
    } catch (e) {
      showToast(pressProblem(e), 'error')
    } finally {
      setPressing(null)
    }
  }
  const press = (name: string, work: () => Promise<unknown>, words: string | null) =>
    run(name, async () => {
      await work()
      return words ? { words, tone: 'success' as const } : null
    })
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
      return (
        <>
          <button
            type="button"
            aria-expanded={owedOpen}
            title={owed ? 'Change what we owe, or its day, or mark it done.' : 'Mark something we still have to do for them, with a day. It stays our move until it is done.'}
            onClick={() => setOwedOpen((o) => !o)}
            style={quiet}
          >
            {owed ? 'Change what we owe' : 'We owe them…'}
          </button>
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
          {(() => {
            const running = runningPromise(heard, c.id, todayYmd)
            return running ? (
              <Chip tone="amber" title="Their move runs until that day.">
                {running.pill}
              </Chip>
            ) : null
          })()}
        </>
      )
    },
    aboveBox: (c) => {
      if (!mine(c.id) || !owedOpen) return null
      const mark = (what: string, day: DayKept) => {
        const words = !owed
          ? owedMarkedToast(c.name, { what })
          : what !== owed.what
            ? owedWhatToast(c.name, { what })
            : owedDayToast({ byYmd: day.ymd, byWords: day.words })
        void press('owed', () => io.markOwed(c.id, what, day), words)
      }
      return (
        <OwedStrip
          key={`${c.id}-${owed ? 'owed' : 'new'}`}
          person={c}
          owed={owed}
          todayYmd={todayYmd}
          nowIso={nowIso}
          busy={pressing !== null}
          canSettle={settle.takers > 0}
          onMark={mark}
          onSettle={() => {
            if (!owed) return
            owedStore.start(c.id, owed)
            setOwedOpen(false)
          }}
          onPutOff={() => {
            setOwedOpen(false)
            void press('state', () => io.setState(c.id, 'snoozed'), stateToast('remindMonday', c.name))
          }}
          onClose={() => setOwedOpen(false)}
        />
      )
    },
    underLine: (m, c) => {
      const line = mine(c.id) ? heardByLine.get(m.id) : undefined
      if (!line) return null
      const jobName = (m.jobId && rows.jobNames[m.jobId]) || null
      return (
        <HeardUnderLine
          line={line}
          person={c}
          jobName={jobName}
          onGcProject={lineGcProject(m) !== null}
          busy={pressing !== null}
          onWrite={(choice) => {
            if (line.kind === 'question') return
            void press('heard', () => io.writeDown(m.id, choice.kind, choice.writes?.kind), promiseWrittenWords(choice, heardDay(line)))
          }}
          onJustTalk={() => void press('heard', () => io.writeDown(m.id, null), null)}
          onAsk={() => {
            const question = planQuestionOf(m, c)
            if (!question) return
            void run('heard', async () =>
              askArchitectToast(await askTheArchitect(io.planQuestions, () => io.readQuestion(m.id, 'asked'), question, { jobName, reason: pressProblem })),
            )
          }}
          onAnswerMyself={() => void press('heard', () => io.readQuestion(m.id, 'answered'), ANSWER_IT_MYSELF_TOAST)}
        />
      )
    },
    lineBody: (m, c) => {
      const marked = mine(c.id) ? highlights.get(m.id) : undefined
      if (!marked?.length) return null
      return <HighlightedBody highlights={marked} nowIso={nowIso} busy={pressing !== null} onRemove={(id) => void press('highlight', () => io.unhighlight(id), highlightsRemovedToast(1))} />
    },
    messageWindowFirst: (m, selection) => {
      if (!mine(m.contactId)) return null
      const marked = highlights.get(m.id) ?? []
      return (
        <HighlightTool
          selection={selection}
          count={marked.length}
          busy={pressing !== null}
          onHighlight={() => {
            const text = wholeWords(m.body, selection)
            if (text) void press('highlight', () => io.highlight(m.id, text), HIGHLIGHTED_TOAST)
          }}
          onRemoveAll={() => void press('highlight', () => Promise.all(marked.map((h) => io.unhighlight(h.id))), highlightsRemovedToast(marked.length))}
        />
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

/**
 * Messages, cut 2's screens, PR C1: Follow up inside the thread window, through cut 1's slots (`threadSlots.tsx`). The
 * window calls `useThreadSlots`, and so this hook, only while a thread is open. It reads that person's Follow up rows
 * once (`followUpThreadIo.ts`) and fills three slots: who has it in the header (`WhoHasItPill`, as on Follow up's rows),
 * the back and snoozed pills in the status row (the prototype's `statusPills`), and ⋯'s No reply needed, Remind me
 * Monday and Reopen. Each press says the kernel's words, reads the rows again and asks the window to read the thread
 * again (`useMessagesReread`), for the gray line the press wrote. Since C2 it fills `aboveBox` with what we owe them
 * (`OwedStrip`), opened from the status row's *We owe them…* or *Change what we owe*; *Mark it done, with a team note*
 * hands the box a settle (`owedStore`), which ends when the thread changes or closes. Since v2.5649 (punch list #129)
 * a customer's own line carries **Write down their word** under it: the sheet on the job the line is tied to, else
 * the customer's one job with money open, else a pick (`messages/wordFromLine.ts` over `list_customer_money_strip`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { callFirst, CALL_WORDS, callWhat, dayAfter } from '../../lib/calls/callTasks'
import { useOptionalAuth } from '../../hooks/useAuth'
import { pressProblem } from '../../lib/followUp/followUpIo'
import { followUpContactOf, followUpMessagesFromRows, holdersFromRows, owedRecordsFromRows } from '../../lib/followUp/followUpRows'
import { supabaseFollowUpThreadIo, type FollowUpThreadIo, type FollowUpThreadRows } from '../../lib/followUp/followUpThreadIo'
import { BACK_CLEARED_TOAST, backPill, hasToast, openOwed, snoozedWords, standingBackNote, stateToast } from '../../lib/followUp/queue'
import { owedStore } from '../../lib/followUp/owedStore'
import { owedDayToast, owedMarkedToast, owedWhatToast, type DayKept } from '../../lib/messages/owed'
import type { Teammate } from '../../lib/followUp/team'
import { backPillTip, threadStateRows } from '../../lib/followUp/thread'
import { canOpenGcProjects } from '../../lib/gc/access'
import { jobLabelOf, lineTakesWord, wordChannel, wordLanding, WORD_PICK_WORDS, WORD_PRESS, type WordLanding } from '../../lib/messages/wordFromLine'
import { loadCustomerMoneyLines } from '../../lib/messages/wordFromLineIo'
import type { BidMoneyLine } from '../../lib/bids/bidMoneyLine'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import SetPromisedPayDateModal from '../jobs/SetPromisedPayDateModal'
import { Chip } from '../gc/gcUi'
import type { ThreadMenuRow, ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'
import { useThreadWindow } from '../gc/messages/useThreadWindow'
import { OwedStrip } from './OwedStrip'
import { WhoHasItPill } from './WhoHasItPill'

const DEFAULT_IO = supabaseFollowUpThreadIo()

/** The customer's say (v2.5597), as the ⋯ menu offers it. */
const PREFERS_ROWS: readonly { value: 'text' | 'email' | 'either'; label: string; tip: string }[] = [
  { value: 'text', label: 'Hears from us by text', tip: 'They asked for texts. The sheet and the morning run text them.' },
  { value: 'email', label: 'Hears from us by email', tip: 'They asked for email. The morning run holds their texts for the office, and the sheet says so.' },
  { value: 'either', label: 'Hears from us either way', tip: 'No preference. Texts and emails go as the steps say.' },
]

export type FollowUpThreadSlots = Pick<ThreadSlots, 'headerRight' | 'statusRow' | 'menuRows' | 'aboveBox' | 'underLine'>

const quiet = { border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', padding: '0.1rem 0.55rem' } as const

/** For a smoke: the customer's jobs as money lines, in place of the read. */
export function useFollowUpThreadSlots(io: FollowUpThreadIo = DEFAULT_IO, loadLines: (customerId: string) => Promise<BidMoneyLine[]> = loadCustomerMoneyLines): FollowUpThreadSlots {
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
  // The word from a line (v2.5649): the line pressed, where it lands, and the sheet once a job is picked.
  const [word, setWord] = useState<{ messageId: string; landing: WordLanding; sheet: BidMoneyLine | null } | null>(null)

  const load = useCallback(async () => {
    asked.current = on ? contactId : null
    if (!on || !contactId) return
    try {
      const rows = await io.loadThread(contactId, todayYmdInAppTz())
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
    setWord(null)
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
  // What we owe the open person, for cut 3's send window (`useThreadOwed`), once read.
  useEffect(() => {
    if (rows && contactId) owedStore.publish(contactId, owed)
  }, [rows, contactId, owed])

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
    // Calls (v2.5596): under a text we sent a customer today, the quiet ask, until a call to them waits.
    underLine: (m, c) => {
      if (!mine(c.id)) return null
      // The word from their line (v2.5649): under a customer's own call, voicemail, text or email.
      if (lineTakesWord(m, c)) {
        const open = word?.messageId === m.id ? word : null
        const press = async () => {
          if (!c.customerId) return
          setPressing(`word ${m.id}`)
          try {
            const landing = wordLanding(await loadLines(c.customerId), m.jobId ?? null)
            if (landing.kind === 'none') showToast(landing.words, 'info')
            else setWord({ messageId: m.id, landing, sheet: landing.kind === 'job' ? landing.line : null })
          } finally {
            setPressing(null)
          }
        }
        return (
          <span key={`word-${m.id}`} data-word-from-line={m.id} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {open?.landing.kind === 'pick' && !open.sheet ? (
              <>
                {WORD_PICK_WORDS}
                {open.landing.lines.map((l) => (
                  <button key={l.job.id} type="button" style={quiet} onClick={() => setWord({ ...open, sheet: l })}>
                    {jobLabelOf(l)}
                  </button>
                ))}
                <button type="button" style={{ ...quiet, border: 'none' }} onClick={() => setWord(null)}>
                  Never mind
                </button>
              </>
            ) : (
              <button type="button" style={quiet} disabled={pressing === `word ${m.id}`} onClick={() => void press()} title="A day they will pay by, or that they say they paid, written on the job">
                {WORD_PRESS}
              </button>
            )}
            {open?.sheet ? (
              <SetPromisedPayDateModal
                jobId={open.sheet.job.id}
                jobLabel={jobLabelOf(open.sheet)}
                initialYmd={open.sheet.promise && open.sheet.promise.kind !== 'paid_claim' ? open.sheet.promise.promisedYmd : null}
                initialSaidBy={c.name}
                initialChannel={wordChannel(m.channel)}
                onClose={() => setWord(null)}
                onSaved={() => reread()}
              />
            ) : null}
          </span>
        )
      }
      if (c.kind !== 'customer' || m.direction !== 'out' || m.channel !== 'text') return null
      if (todayYmdInAppTz(new Date(m.at)) !== todayYmd || (rows.calls ?? []).length > 0) return null
      const first = callFirst(c)
      const day = dayAfter(todayYmd)
      return (
        <span key={`call-${m.id}`} data-call-ask={m.id} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {CALL_WORDS.quietAsk(first)}
          <button
            type="button"
            style={quiet}
            disabled={pressing === 'call add'}
            onClick={() => void press('call add', () => io.callAdd({ contactId: c.id, stepKey: null, jobKey: null, dueYmd: day, what: callWhat(null), script: null }), CALL_WORDS.added(first, day))}
          >
            {CALL_WORDS.addToMyCalls}
          </button>
        </span>
      )
    },
    headerRight: (c) =>
      mine(c.id) ? (
        <WhoHasItPill
          bare
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
    menuRows: (c): ThreadMenuRow[] =>
      mine(c.id)
        ? [
            ...threadStateRows(followUpContactOf(c, rows.contact, userNames).state, todayYmd).map((r) => ({
              key: `follow-up-${r.move}`,
              label: r.label,
              tip: r.tip,
              disabled: pressing !== null,
              onPress: () => void press('state', () => io.setState(c.id, r.sets), stateToast(r.move, c.name)),
            })),
            // The customer's say (v2.5597): how they hear from us, set by the office; a tick marks the one that stands.
            ...(c.kind === 'customer'
              ? PREFERS_ROWS.map((r) => ({
                  key: `prefers-${r.value}`,
                  label: `${rows.contact?.prefers === r.value ? '✓ ' : ''}${r.label}`,
                  tip: r.tip,
                  disabled: pressing !== null || rows.contact?.prefers === r.value,
                  onPress: () => void press('prefers', () => io.setPrefers(c.id, r.value), `${callFirst(c) ?? 'They'} ${callFirst(c) ? 'hears' : 'hear'} from us by ${r.value === 'either' ? 'text or email' : r.value}.`),
                }))
              : []),
          ]
        : [],
  }
}

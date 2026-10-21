/**
 * Messages, cut 2: the Follow up tab's top on `/gc?view=followUp`, above the asks it already lists. It loads the queue
 * (`useFollowUpQueue`), draws its sections (`FollowUpSections`) and runs each press: the press, a read of the queue,
 * and the kernel's words for what changed, or the press's own words when it was refused. The thread opens by the
 * page's `onOpenThread` (`?thread=<contactId>&at=<messageId>`), the clause rows come from their own hook, and the
 * nudges fill their slot when their screen lands. *Ask the architect* puts the question on the job's plan questions,
 * marks the line asked and emails the architect, through the page's GC writes (`planQuestions`, `followUp/askArchitect.ts`).
 * **Sort all** on New's header opens the desk (`SortAllDesk`, residential R7's mockup C) over the New this panel draws.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMessagesLive } from '../gc/messages/useMessagesLive'
import { askArchitectToast, planQuestionOf, type AskArchitectEnd, type PlanQuestionInput } from '../../lib/followUp/askArchitect'
import { pressProblem, supabaseFollowUpIo, type FollowUpIo } from '../../lib/followUp/followUpIo'
import { supabaseNewLaneCardIo, type NewLaneCardIo } from '../../lib/followUp/newLaneCardIo'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import { CALL_WORDS } from '../../lib/calls/callTasks'
import { anotherDay, BACK_CLEARED_TOAST, hasToast, stateToast, type FollowUpQueue, type OnPortal } from '../../lib/followUp/queue'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useFollowUpQueue } from '../../hooks/useFollowUpQueue'
import { Card } from '../gc/gcUi'
import { FollowUpSections, type FollowUpSectionActions } from './FollowUpSections'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { useLeadDoors } from '../messages/useLeadDoors'
import { SortAllDesk } from './SortAllDesk'
import type { Teammate } from './WhoHasItPill'

const DEFAULT_IO = supabaseFollowUpIo()
const DEFAULT_SORT_IO = supabaseNewLaneCardIo()

/** GC mode's plan questions, for *Ask the architect*: the page's own writes (`gcIo`). */
export interface PlanQuestionWrites {
  record: (question: PlanQuestionInput) => Promise<string>
  /** Emails it to the job's architect. Rejects with the send's own reason, its gate's included. */
  send: (questionId: string) => Promise<{ to: string }>
  /** The job's name, for the words when the email does not go. */
  jobName?: (projectId: string) => string | null
  /** After a question is recorded, so the job's questions show it. */
  onAsked?: () => void
}

export interface FollowUpPanelProps<C, N extends { contactId: string }> {
  me: Teammate
  team: readonly Teammate[]
  onOpenThread: (contactId: string, atMessageId?: string) => void
  /** Says what a press changed, or why it was refused. */
  say: (words: string, tone: 'success' | 'error') => void
  /** The reads and presses; the app's own unless a smoke hands it a fake. */
  io?: FollowUpIo
  /** Loads only while the tab is open. */
  enabled?: boolean
  clauses?: { rows: readonly C[]; render: (rows: readonly C[]) => ReactNode }
  nudges?: { build: (skip: OnPortal) => readonly N[]; render: (rows: readonly N[]) => ReactNode }
  seeTheirPage?: (contactId: string) => void
  /** *Ask the architect*'s writes. Unset: a plans question has no press here. */
  planQuestions?: PlanQuestionWrites
  /** Hears the badge's count each time the queue is read, so the page's pill stays with it. */
  onCount?: (count: number) => void
  /** The rows to draw out of the whole queue: `/messages`' kind pills (`messages/kindPills.ts`). The badge counts the whole. */
  narrow?: (queue: FollowUpQueue<C, N>, contacts: readonly FollowUpContact[]) => FollowUpQueue<C, N>
  /** Hears the whole queue and its people each time it is read, before `narrow`: the Show lens's counts (punch list #140 PR 3). */
  onQueue?: (queue: FollowUpQueue<C, N>, contacts: readonly FollowUpContact[]) => void
  /** Today and now, for a smoke; the app's clock otherwise. */
  todayYmd?: string
  nowIso?: string
  /** The Sort all desk's reads and presses: the lane's sort card's own unless a smoke hands it a fake. */
  sortIo?: NewLaneCardIo
  /** A lead's doors (punch list #140 PR 8): the writes behind Book a visit and Start an estimate; a smoke hands its own. */
  leadIo?: LeadDoorsIo
}

export function FollowUpPanel<C = never, N extends { contactId: string } = never>(props: FollowUpPanelProps<C, N>) {
  const { me, team, onOpenThread, say, io = DEFAULT_IO, enabled = true, clauses, nudges, seeTheirPage, planQuestions, onCount, narrow, onQueue, sortIo = DEFAULT_SORT_IO, leadIo } = props
  const leadDoors = useLeadDoors(leadIo)
  const todayYmd = props.todayYmd ?? todayYmdInAppTz()
  const nowIso = props.nowIso ?? new Date().toISOString()
  const userNames = useMemo(() => Object.fromEntries([...team, me].map((t) => [t.id, t.name])), [team, me])
  const passThrough = useMemo(() => ({ ...(clauses ? { clauses: clauses.rows } : {}), ...(nudges ? { nudges: nudges.build } : {}) }), [clauses, nudges])
  const q = useFollowUpQueue<C, N>({ io, userNames, enabled, passThrough, todayYmd, ...(props.nowIso ? { nowIso: props.nowIso } : {}) })
  const count = q.queue?.count
  // v2.5572: a new line or a teammate's press elsewhere re-reads the queue, one read after the settle.
  useMessagesLive(enabled, () => void q.reload())
  const [sorting, setSorting] = useState(false)
  // The queue as drawn: the kind pills' narrowing when the page has one. The desk walks the New this draws.
  const drawn = q.queue ? (narrow ? narrow(q.queue, q.contacts) : q.queue) : null
  useEffect(() => {
    if (count !== undefined) onCount?.(count)
  }, [count, onCount])
  useEffect(() => {
    if (q.queue) onQueue?.(q.queue, q.contacts)
  }, [q.queue, q.contacts, onQueue])

  const nameOf = (contactId: string) => q.contacts.find((c) => c.id === contactId)?.name ?? 'them'
  const run = async (name: string, press: (x: FollowUpIo) => Promise<unknown>, done: string | null) => {
    const ok = await q.press(name, press)
    if (ok && done) say(done, 'success')
  }

  /** The lead's order: the question on the job, the line marked asked so a second press makes none, then the email. */
  const askArchitect = async (writes: PlanQuestionWrites, messageId: string) => {
    const line = q.lines.get(messageId)
    const person = line ? q.contacts.find((c) => c.id === line.contactId) : undefined
    const question = line && person ? planQuestionOf(line, person) : null
    if (!question) return
    const out: { recorded: boolean; end: AskArchitectEnd | null } = { recorded: false, end: null }
    const ok = await q.press(`ask ${messageId}`, async (x) => {
      const questionId = await writes.record(question)
      out.recorded = true
      await x.readQuestion(messageId, 'asked')
      try {
        out.end = { sent: true, to: (await writes.send(questionId)).to }
      } catch (e) {
        out.end = { sent: false, job: writes.jobName?.(question.projectId) ?? null, reason: pressProblem(e) }
      }
    })
    if (out.recorded) writes.onAsked?.()
    if (ok && out.end) {
      const words = askArchitectToast(out.end)
      say(words.words, words.tone)
    }
  }

  const actions: FollowUpSectionActions = {
    openThread: onOpenThread,
    // A lead's doors (punch list #140 PR 8): the customer made from the lead, then Add Job or a new estimate.
    bookVisit: (contactId, words) => void leadDoors.book({ contactId, words }),
    startEstimate: (contactId, words) => void leadDoors.startEstimate({ contactId, words }),
    hand: (contactId, userId) => {
      const to = userId === null ? null : userId === me.id ? me.name : (userNames[userId] ?? 'Someone')
      void run(`hand ${contactId}`, (x) => (userId === me.id ? x.takeIt(contactId) : x.handTo(contactId, userId)), hasToast(me.name, nameOf(contactId), to))
    },
    noReplyNeeded: (contactId) => void run(`state ${contactId}`, (x) => x.setState(contactId, 'done'), stateToast('noReplyNeeded', nameOf(contactId))),
    remindMonday: (contactId) => void run(`state ${contactId}`, (x) => x.setState(contactId, 'snoozed'), stateToast('remindMonday', nameOf(contactId))),
    backDone: (noteId) => void run(`back ${noteId}`, (x) => x.backDone(noteId), BACK_CLEARED_TOAST),
    anotherDay: (noteId) => {
      const next = anotherDay(todayYmd)
      void run(`back ${noteId}`, (x) => x.setBackDay(noteId, { ymd: next.backOn, words: null }), next.toast)
    },
    // A call to make (v2.5596): I called writes the app's note, Skip a gray line, Tomorrow moves the day.
    callDone: (id, how) => void run(`call ${id}`, (x) => x.callDone(id, how), how === 'called' ? CALL_WORDS.calledToast : CALL_WORDS.skippedToast),
    callMove: (id, dueYmd) => void run(`call ${id}`, (x) => x.callMove(id, dueYmd), CALL_WORDS.movedToast(dueYmd)),
    ...(planQuestions ? { askArchitect: (messageId: string) => void askArchitect(planQuestions, messageId) } : {}),
    ...(seeTheirPage ? { seeTheirPage } : {}),
    sortAll: () => setSorting(true),
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {q.problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {q.problem}
        </div>
      )}
      {drawn ? (
        <FollowUpSections<C, N>
          queue={drawn}
          contacts={q.contacts}
          lines={q.lines}
          me={me}
          team={team}
          todayYmd={todayYmd}
          nowIso={nowIso}
          actions={actions}
          pressing={q.pressing}
          {...(clauses ? { renderClauses: clauses.render } : {})}
          {...(nudges ? { renderNudges: nudges.render } : {})}
        />
      ) : (
        !q.problem && <Card style={{ color: 'var(--text-muted)' }}>Loading who is waiting on us…</Card>
      )}
      {sorting && drawn && (
        <SortAllDesk
          lane={drawn.newLane}
          contacts={q.contacts}
          io={sortIo}
          me={me}
          say={say}
          reread={() => void q.reload()}
          onClose={() => setSorting(false)}
          onOpenThread={onOpenThread}
          {...(props.nowIso ? { nowIso: props.nowIso } : {})}
        />
      )}
    </div>
  )
}

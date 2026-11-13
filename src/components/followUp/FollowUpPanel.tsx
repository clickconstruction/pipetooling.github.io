/**
 * Messages, cut 2: the Follow up tab's top on `/gc?view=followUp`, above the asks it already lists. It loads the queue
 * (`useFollowUpQueue`), draws its sections (`FollowUpSections`) and runs each press: the press, a read of the queue,
 * and the kernel's words for what changed, or the press's own words when it was refused. The thread opens by the
 * page's `onOpenThread` (`?thread=<contactId>&at=<messageId>`), the clause rows come from their own hook, and the
 * nudges fill their slot when their screen lands. *Ask the architect* puts the question on the job's plan questions,
 * marks the line asked and emails the architect, through the page's GC writes (`planQuestions`, `followUp/askArchitect.ts`).
 * **Sort all** on New's header opens the desk (`SortAllDesk`, residential R7's mockup C) over the New this panel draws.
 *
 * On `/messages` (`keptRead`, punch list #183 PR 5) the queue is kept on the device through `useKeptRead`
 * (`lib/messages/keptQueue.ts`): while the live read runs, the lanes, the count the page hears and the fold's rows are
 * the device's kept read under the stamp *Who was waiting at 7:52 AM · reading again…*, the root carries
 * `data-kept-read` so the counts mute, every press that writes on a row is held, and the two desks wait; once every
 * read landed the live queue replaces it and is written back for next time. A failed read over a kept queue keeps it
 * with the stamp's Retry; with nothing kept, `OfflineRetryPanel` names the failure by its class. Either way a lost
 * signal reads again by itself when it is back, and a refusal shows its reason with no read of its own.
 */
import { PUT_BACK_WORDS } from '../../lib/followUp/setAsideFold'
import { reopenedWords } from '../../lib/followUp/doneFold'
import { DoneFold } from './DoneFold'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMessagesLive } from '../gc/messages/useMessagesLive'
import { askArchitectToast, planQuestionOf, type AskArchitectEnd, type PlanQuestionInput } from '../../lib/followUp/askArchitect'
import { pressProblem, supabaseFollowUpIo, type FollowUpIo } from '../../lib/followUp/followUpIo'
import { supabaseNewLaneCardIo, type NewLaneCardIo } from '../../lib/followUp/newLaneCardIo'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import { CALL_WORDS } from '../../lib/calls/callTasks'
import { anotherDay, BACK_CLEARED_TOAST, hasToast, QUEUE_READ_OFFLINE_WORDS, stateToast, type FollowUpQueue, type OnPortal } from '../../lib/followUp/queue'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useFollowUpQueue } from '../../hooks/useFollowUpQueue'
import { useKeptRead } from '../../hooks/useKeptRead'
import { MESSAGES_KEPT_LEAD } from '../../lib/keptRead'
import { buildMessagesKeptQueue, MESSAGES_KEPT_SCOPES, messagesKeptKey, messagesKeptRowIsValid, unpackMessagesKeptQueue, type MessagesKeptQueue, type MessagesQueueSource } from '../../lib/messages/keptQueue'
import { KeptReadStamp } from '../KeptReadStamp'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { Card } from '../gc/gcUi'
import { FollowUpSections, type FollowUpSectionActions, type LaneLook } from './FollowUpSections'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { useNavigate } from 'react-router-dom'
import { useLeadDoors } from '../messages/useLeadDoors'
import { SortAllDesk } from './SortAllDesk'
import { bidHref } from './useNewLaneThreadSlots'
import { AnswerAllDesk, type AnswerAllDeskProps, type AnswerThread } from './AnswerAllDesk'
import type { OpenThreadMore } from '../gc/messages/useThreadWindow'
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
  onOpenThread: (contactId: string, atMessageId?: string, more?: OpenThreadMore) => void
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
  /** The lanes' look (v2.5802): `/messages` draws bands and says the sentences behind its ?; GC projects print them under the headings. */
  laneLook?: LaneLook
  /** Today and now, for a smoke; the app's clock otherwise. */
  todayYmd?: string
  nowIso?: string
  /** The Sort all desk's reads and presses: the lane's sort card's own unless a smoke hands it a fake. */
  sortIo?: NewLaneCardIo
  /**
   * **Answer all** (punch list #140 PR 6): the page holds whether the desk is open, since the desk needs the page's view
   * of the threads (`thread`), which the page loads only while something needs it. Unset: no press on the header.
   */
  answerAll?: {
    on: boolean
    onChange: (on: boolean) => void
    thread: AnswerThread
    /** A smoke's fakes; the app's own when left out. */
    loadContact?: AnswerAllDeskProps['loadContact']
    replyIo?: AnswerAllDeskProps['replyIo']
    quickIo?: AnswerAllDeskProps['quickIo']
    quietIo?: AnswerAllDeskProps['quietIo']
  }
  /** A lead's doors (punch list #140 PR 8): the writes behind Book a visit and Start an estimate; a smoke hands its own. */
  leadIo?: LeadDoorsIo
  /**
   * Keep the queue on the device (punch list #183 PR 5): `/messages` passes it, so a slow morning draws who was waiting
   * as the device last read it; GC projects' tab leaves it out and keeps nothing. The key is the signed-in person's (`me.id`).
   */
  keptRead?: boolean
  /** Hears when the lanes on screen are the kept read (its `readAt`) and when they are live again (null), so the page can mute the bar's counts and hold the fold. */
  onKept?: (readAt: number | null) => void
}

export function FollowUpPanel<C = never, N extends { contactId: string } = never>(props: FollowUpPanelProps<C, N>) {
  const { me, team, onOpenThread, say, io = DEFAULT_IO, enabled = true, clauses, nudges, seeTheirPage, planQuestions, onCount, narrow, onQueue, sortIo = DEFAULT_SORT_IO, answerAll, leadIo, laneLook, keptRead = false, onKept } = props
  const leadDoors = useLeadDoors(leadIo)
  // Start a bid on the Sort all desk (v2.6222) leaves the desk for the Bid Board, open on the new bid.
  const navigate = useNavigate()
  const todayYmd = props.todayYmd ?? todayYmdInAppTz()
  const nowIso = props.nowIso ?? new Date().toISOString()
  const userNames = useMemo(() => Object.fromEntries([...team, me].map((t) => [t.id, t.name])), [team, me])
  const passThrough = useMemo(() => ({ ...(clauses ? { clauses: clauses.rows } : {}), ...(nudges ? { nudges: nudges.build } : {}) }), [clauses, nudges])
  const q = useFollowUpQueue<C, N>({ io, userNames, enabled, passThrough, todayYmd, ...(props.nowIso ? { nowIso: props.nowIso } : {}) })
  // The kept read (#183 PR 5): the live queue as one record, written once the read lands; the device's record while it runs.
  const liveSource = useMemo<MessagesQueueSource<C, N> | null>(() => (q.queue ? { queue: q.queue, contacts: q.contacts, lines: q.lines, setAside: q.setAside } : null), [q.queue, q.contacts, q.lines, q.setAside])
  const keptKey = keptRead && me.id ? messagesKeptKey(me.id) : null
  const toKeep = useMemo(() => (keptKey && liveSource ? buildMessagesKeptQueue(liveSource) : null), [keptKey, liveSource])
  const kept = useKeptRead<MessagesKeptQueue>(keptKey, toKeep, { loading: q.loading, scopes: MESSAGES_KEPT_SCOPES, failed: q.readFailure != null, rowIsValid: messagesKeptRowIsValid })
  const keptRows = kept.rows
  const keptAt = kept.readAt
  const keptNow = props.nowIso
  const keptSource = useMemo(() => (keptAt != null && keptRows ? unpackMessagesKeptQueue<C, N>(keptRows, { todayYmd, nowIso: keptNow ?? new Date().toISOString() }) : null), [keptAt, keptRows, todayYmd, keptNow])
  const held = keptSource != null
  const source = keptSource ?? liveSource
  const count = source?.queue.count
  const reload = () => void q.reload()
  // v2.5572: a new line or a teammate's press elsewhere re-reads the queue, one read after the settle.
  useMessagesLive(enabled, reload)
  // A lost signal reads again by itself once it is back. With nothing on screen `OfflineRetryPanel` does that; this is the same over rows already drawn.
  const lostSignal = q.readFailure?.kind === 'network' && source != null
  const readAgain = q.reload
  useEffect(() => {
    if (!lostSignal) return
    const back = () => void readAgain()
    window.addEventListener('online', back)
    return () => window.removeEventListener('online', back)
  }, [lostSignal, readAgain])
  const [sorting, setSorting] = useState(false)
  // The queue as drawn: the kind pills' narrowing when the page has one. The desk walks the New this draws.
  const drawn = source ? (narrow ? narrow(source.queue, source.contacts) : source.queue) : null
  useEffect(() => {
    if (count !== undefined) onCount?.(count)
  }, [count, onCount])
  const heardQueue = source?.queue
  const heardContacts = source?.contacts
  useEffect(() => {
    if (heardQueue && heardContacts) onQueue?.(heardQueue, heardContacts)
  }, [heardQueue, heardContacts, onQueue])
  useEffect(() => {
    onKept?.(held && keptAt != null ? keptAt : null)
  }, [held, keptAt, onKept])

  const nameOf = (contactId: string) => source?.contacts.find((c) => c.id === contactId)?.name ?? 'them'
  const loadDone = useCallback(() => io.loadDoneFold(), [io])
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
    noReplyNeeded: (contactId) => void run(`state ${contactId}`, (x) => x.noReplyNeeded(contactId, me.name), stateToast('noReplyNeeded', nameOf(contactId))),
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
    // Put back (v2.6231): the notice is marked for the next read; the queue re-reads without it.
    putBack: (id) => void run(`putBack ${id}`, (x) => x.putBack(id), PUT_BACK_WORDS),
    ...(answerAll ? { answerAll: () => answerAll.onChange(true) } : {}),
  }

  // The read failed with nothing kept: the failure by its class, with Retry when the signal was the trouble.
  const readBroken = q.readFailure != null && !drawn
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }} data-kept-read={held ? '' : undefined} data-follow-up-panel>
      {held && keptAt != null && <KeptReadStamp readAt={keptAt} lead={MESSAGES_KEPT_LEAD} failed={kept.failed} onRetry={reload} className="keptReadStampTight" />}
      {readBroken && q.readFailure ? (
        <OfflineRetryPanel failure={q.readFailure} onRetry={reload} surface="messages-queue" idempotent busy={q.loading} offlineMessage={QUEUE_READ_OFFLINE_WORDS} />
      ) : (
        // Over a kept queue a lost signal needs no line of its own: the stamp and the strip say it. Any other failure keeps its reason.
        q.problem && !(held && q.readFailure?.kind === 'network') && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {q.problem}
          </div>
        )
      )}
      {drawn && source ? (
        <FollowUpSections<C, N>
          queue={drawn}
          contacts={source.contacts}
          lines={source.lines}
          me={me}
          team={team}
          todayYmd={todayYmd}
          nowIso={nowIso}
          actions={actions}
          setAside={source.setAside}
          pressing={q.pressing}
          laneLook={laneLook}
          held={held}
          {...(clauses ? { renderClauses: clauses.render } : {})}
          {...(nudges ? { renderNudges: nudges.render } : {})}
        />
      ) : (
        !q.problem && <Card style={{ color: 'var(--text-muted)' }}>Loading who is waiting on us…</Card>
      )}
      {/* Done with no reply this week (v2.7030, punch list #324): where a closed conversation went, each with Reopen. */}
      {drawn && source && !held && (
        <DoneFold
          refreshKey={q.queue}
          nowIso={nowIso}
          busy={q.pressing !== null}
          load={loadDone}
          onReopen={(contactId, who) => void run(`state ${contactId}`, (x) => x.setState(contactId, 'waiting'), reopenedWords(who))}
          onOpenThread={(contactId) => onOpenThread(contactId)}
        />
      )}
      {answerAll?.on && drawn && !held && (
        <AnswerAllDesk
          lane={drawn.needsReply}
          weOwe={drawn.weOwe}
          contacts={q.contacts}
          lines={q.lines}
          reread={() => void q.reload()}
          noReplyNeeded={(contactId) => q.press(`state ${contactId}`, (x) => x.noReplyNeeded(contactId, me.name))}
          pressing={q.pressing}
          onClose={() => answerAll.onChange(false)}
          onOpenThread={onOpenThread}
          thread={answerAll.thread}
          {...(answerAll.loadContact ? { loadContact: answerAll.loadContact } : {})}
          {...(answerAll.replyIo ? { replyIo: answerAll.replyIo } : {})}
          {...(answerAll.quickIo ? { quickIo: answerAll.quickIo } : {})}
          {...(answerAll.quietIo ? { quietIo: answerAll.quietIo } : {})}
        />
      )}
      {sorting && drawn && !held && (
        <SortAllDesk
          lane={drawn.newLane}
          contacts={q.contacts}
          io={sortIo}
          me={me}
          say={say}
          reread={() => void q.reload()}
          onClose={() => setSorting(false)}
          onOpenThread={onOpenThread}
          openBid={(bidId) => navigate(bidHref(bidId))}
          {...(props.nowIso ? { nowIso: props.nowIso } : {})}
        />
      )}
    </div>
  )
}

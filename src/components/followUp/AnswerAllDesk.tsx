/**
 * Punch list #140 PR 6: **Answer all**, the desk behind Needs a reply's header, built like Sort all (`SortAllDesk.tsx`).
 * A window over Follow up that walks the lane one person at a time with nothing else on the screen: how far it has
 * come, the person and who has them, their last words, their job, and cut 3's reply box with the step's quick replies
 * (`ReplyBox`, over the host's view and their full contact, so a send goes as it would from the thread). A send or a
 * No reply needed moves on; Skip for now puts the person after the rest; Call dials; Open the thread leaves the desk at
 * their line. The end says what went and offers the quiet ones: Waiting on them's first row, opened with PR 4's nudge.
 * The words and the step are `followUp/answerDesk.ts`.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import {
  ANSWER_ALL,
  ANSWER_CALL,
  ANSWER_DONE,
  ANSWER_GONE,
  ANSWER_NEXT,
  ANSWER_NO_REPLY,
  ANSWER_NO_WAY,
  ANSWER_OPEN_THREAD,
  ANSWER_READING,
  ANSWER_SKIP,
  answerStep,
  countOne,
  EMPTY_TALLY,
  reachable,
  skipAnswer,
  tallyWords,
  type AnswerTally,
} from '../../lib/followUp/answerDesk'
import type { FollowUpContact, FollowUpLine } from '../../lib/followUp/followUpRows'
import { owedStore } from '../../lib/followUp/owedStore'
import type { NeedsReplyRow, OwedRow } from '../../lib/followUp/queue'
import type { JobTile } from '../../lib/messages/jobTiles'
import { loadContact as loadContactIo, type MessagesView } from '../../lib/messages/messagesIo'
import { supabaseReplyIo, type ReplyIo } from '../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../lib/quickReplies/quickRepliesIo'
import { agoWords, channelWord, lineWhen, snippetOf, threadOf } from '../../lib/messages/thread'
import { waitingOnThem, type WaitingRow, type WaitLine } from '../../lib/messages/waitingOnThem'
import { loadWaitingOnThem } from '../../lib/messages/waitingOnThemIo'
import { telHrefFor } from '../../lib/phoneContact'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { Btn, Chip } from '../gc/gcUi'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { ReplyBox } from '../gc/messages/reply/ReplyBox'
import { MessagesRereadContext } from '../gc/messages/useMessagesReread'
import type { OpenThreadMore } from '../gc/messages/useThreadWindow'

/** The thread's read for the box: the host's view (null while it reads), its clock and its job search. */
export interface AnswerThread {
  view: MessagesView | null
  nowIso: string
  searchJobs: (words: string) => Promise<JobTile[]>
}

export interface AnswerAllDeskProps {
  /** Needs a reply as Follow up draws it now (the lens's narrowing included): re-read after each press. */
  lane: readonly NeedsReplyRow[]
  /** We owe them, for the send window's After this sends. */
  weOwe: readonly OwedRow[]
  contacts: readonly FollowUpContact[]
  lines: ReadonlyMap<string, FollowUpLine>
  /** Reads Follow up again after a send. */
  reread: () => void
  /** No reply needed through the panel's press; resolves true when it went. */
  noReplyNeeded: (contactId: string) => Promise<boolean>
  pressing?: string | null
  onClose: () => void
  onOpenThread: (contactId: string, atMessageId?: string, more?: OpenThreadMore) => void
  thread: AnswerThread
  /** The person with their numbers, for the box; the app's own unless a smoke hands one. */
  loadContact?: (contactId: string) => Promise<Contact | null>
  replyIo?: ReplyIo
  quickIo?: QuickRepliesIo
  /** Who went quiet, for the end card; the app's own unless a smoke hands one. */
  quietIo?: (now?: Date) => Promise<WaitLine[]>
}

const KIND_WORDS: Readonly<Record<string, string>> = { customer: 'customer', trade: 'trade partner', arch: 'architect', unknown: 'who is this?' }
const companyOf = (c: FollowUpContact) => c.company || KIND_WORDS[c.kind] || ''
const clip = (s: string) => (s.length > 220 ? `${s.slice(0, 220).replace(/\s+\S*$/, '')}…` : s)

function Parts({ parts }: { parts: readonly string[] }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', gap: '0.4rem' }}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  )
}

export function AnswerAllDesk({ lane, weOwe, contacts, lines, reread, noReplyNeeded, pressing, onClose, onOpenThread, thread, loadContact = loadContactIo, replyIo, quickIo, quietIo = loadWaitingOnThem }: AnswerAllDeskProps) {
  // How many waited when the desk opened, so the count reads "2 of 4" as the desk goes.
  const [total] = useState(lane.length)
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set())
  // The person whose card is up; null between cards, so the next unskipped comes up and is pinned.
  const [pinned, setPinned] = useState<string | null>(null)
  // Sent or marked here, until the re-read drops them from the lane, so the card never shows them a second time.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set())
  const [tally, setTally] = useState<AnswerTally>(EMPTY_TALLY)
  const [full, setFull] = useState<Record<string, Contact | null>>({})
  const [quiet, setQuiet] = useState<WaitingRow[] | null | undefined>(undefined)

  const laneNow = useMemo(() => lane.filter((r) => !answered.has(r.contactId)), [lane, answered])
  const step = answerStep(laneNow, skipped, pinned, total)
  const current = step.current
  useEffect(() => {
    if (pinned === null && current) setPinned(current)
  }, [pinned, current])

  const row = current ? laneNow.find((r) => r.contactId === current) : undefined
  const person = current ? contacts.find((c) => c.id === current) : undefined
  // The re-read that dropped them dropped their row too, so their name comes from the contact the box loaded.
  const goneName = step.gone ? (full[step.gone]?.name ?? contacts.find((c) => c.id === step.gone)?.name ?? null) : null
  const line = row?.landOnId ? lines.get(row.landOnId) : undefined
  const view = thread.view
  const nowIso = thread.nowIso

  // Their numbers, for the box: read once per person while the desk is open.
  useEffect(() => {
    if (!current || current in full) return
    let live = true
    loadContact(current)
      .then((c) => live && setFull((f) => ({ ...f, [current]: c })))
      .catch(() => live && setFull((f) => ({ ...f, [current]: null })))
    return () => {
      live = false
    }
  }, [current, full, loadContact])

  // What we owe them, for After this sends: published while their card is up, as cut 2's thread hook does.
  useEffect(() => {
    if (!current) return
    owedStore.publish(current, weOwe.find((r) => r.contactId === current)?.owed ?? null)
    return () => owedStore.unpublish(current)
  }, [current, weOwe])

  // The end card: who went quiet, read once the lane is empty.
  useEffect(() => {
    if (laneNow.length > 0 || quiet !== undefined) return
    let live = true
    const now = new Date(nowIso)
    quietIo(now)
      .then((ls) => live && setQuiet(waitingOnThem(ls, 'all', now)))
      .catch(() => live && setQuiet(null))
    return () => {
      live = false
    }
  }, [laneNow.length, quiet, quietIo, nowIso])

  const moveOn = (contactId: string, key: keyof AnswerTally) => {
    setTally((t) => countOne(t, key))
    setAnswered((s) => new Set(s).add(contactId))
    setPinned(null)
  }
  const skip = (contactId: string) => {
    setSkipped((s) => skipAnswer(laneNow, s, contactId))
    setTally((t) => countOne(t, 'skipped'))
    setPinned(null)
  }
  const toThread = (contactId: string, at?: string | null, more?: OpenThreadMore) => {
    onClose()
    onOpenThread(contactId, at ?? undefined, more)
  }

  // The box's io, with what went written down: a send moves the desk on; a note counts and stays.
  const base = useMemo(() => replyIo ?? supabaseReplyIo(), [replyIo])
  const logIo = useMemo<ReplyIo | null>(() => {
    if (!current) return null
    const id = current
    return {
      loadSender: () => base.loadSender(),
      addNote: async (...a) => {
        const noteId = await base.addNote(...a)
        setTally((t) => countOne(t, 'notes'))
        return noteId
      },
      sendEmail: async (input) => {
        const messageId = await base.sendEmail(input)
        moveOn(id, 'emails')
        return messageId
      },
      sendText: async (input) => {
        const messageId = await base.sendText(input)
        moveOn(id, 'texts')
        return messageId
      },
    }
  }, [base, current])

  const contact = current ? full[current] : undefined
  const open = useMemo<OpenThread | null>(
    () =>
      contact && view
        ? { contact, lines: threadOf(view.messages, contact.id), jobFilter: null, rail: view.rails[contact.id] ?? [], tiles: view.tiles, userNames: view.userNames, nowIso, searchJobs: thread.searchJobs }
        : null,
    [contact, view, nowIso, thread.searchJobs],
  )
  const tile = person?.defaultJobId && view ? view.tiles[person.defaultJobId] : undefined
  const busy = current ? pressing === `state ${current}` : false

  return (
    <ResponsiveModalShell title={ANSWER_ALL} onRequestClose={onClose} fullScreenKey="follow-up-answer-all" maxWidthDesktop={720}>
      <div data-answer-all-desk style={{ display: 'grid', gap: '0.75rem', padding: '0.25rem 0 0.5rem' }}>
        {laneNow.length === 0 ? (
          <div data-answer-all-done style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center', textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <strong style={{ fontSize: '1.1rem' }}>{ANSWER_DONE.title}</strong>
            <span data-answer-all-tally>{tallyWords(tally)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ANSWER_DONE.note}</span>
            {quiet && quiet.length > 0 && (
              <div data-answer-all-quiet style={{ display: 'grid', gap: '0.4rem', justifyItems: 'center', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.9rem' }}>{ANSWER_DONE.quiet(quiet.length)}</span>
                <Btn onClick={() => toThread(quiet[0]!.contactId, null, { nudge: 'text' })}>{ANSWER_DONE.nudgeFirst}</Btn>
              </div>
            )}
            <Btn kind="primary" onClick={onClose}>
              {ANSWER_DONE.back}
            </Btn>
          </div>
        ) : step.gone ? (
          <div data-answer-all-gone style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start', padding: '0.5rem 0' }}>
            <div data-answer-all-progress style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Parts parts={step.progress} />
            </div>
            <span>{ANSWER_GONE(goneName ?? 'That person')}</span>
            <Btn kind="primary" onClick={() => setPinned(null)}>
              {ANSWER_NEXT}
            </Btn>
          </div>
        ) : row && person ? (
          <>
            <div data-answer-all-progress style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Parts parts={step.progress} />
            </div>
            <section
              aria-label={`Answer ${person.name}`}
              data-answer-all-card={person.id}
              style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.6rem' }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{person.name}</div>
                {row.waitingSince && (
                  <Chip tone="amber" title="Their word was last, so the next move is ours. It counts from their last message.">
                    Our move · {agoWords(row.waitingSince, nowIso)}
                  </Chip>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} data-answer-all-has>
                  {person.has ? `${person.has} has it` : 'nobody has it'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Parts parts={[companyOf(person), ...(tile ? [`${tile.num} ${tile.name}`] : [])].filter(Boolean)} />
              </div>
              {line && (
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 10, padding: '0.6rem 0.75rem', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }} data-answer-all-words>
                  <strong>
                    {channelWord(line)}, {lineWhen(line.at, nowIso)}:
                  </strong>{' '}
                  {clip(snippetOf(line))}
                </div>
              )}
              {!view ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ANSWER_READING.thread}</div>
              ) : contact === undefined ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ANSWER_READING.person}</div>
              ) : contact === null ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} data-answer-all-no-way>
                  {ANSWER_READING.failed}
                </div>
              ) : !reachable(contact) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} data-answer-all-no-way>
                  {ANSWER_NO_WAY}
                </div>
              ) : open && logIo ? (
                <MessagesRereadContext.Provider value={reread}>
                  <OpenThreadContext.Provider value={open}>
                    <ReplyBox key={`answer:${contact.id}`} contact={contact} io={logIo} quickIo={quickIo} openStrip />
                  </OpenThreadContext.Provider>
                </MessagesRereadContext.Provider>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Btn kind="quiet" onClick={() => skip(person.id)}>
                    {ANSWER_SKIP}
                  </Btn>
                  <Btn
                    disabled={busy}
                    onClick={() => {
                      void noReplyNeeded(person.id).then((ok) => ok && moveOn(person.id, 'noReply'))
                    }}
                  >
                    {ANSWER_NO_REPLY}
                  </Btn>
                  {person.phone && (
                    <a
                      href={telHrefFor(person.phone)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.8rem', borderRadius: 999, background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}
                      data-answer-all-call
                    >
                      ☎ {ANSWER_CALL}
                    </a>
                  )}
                  <Btn onClick={() => toThread(person.id, row.landOnId)}>{ANSWER_OPEN_THREAD}</Btn>
                </div>
                <span data-answer-all-more style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {step.more}
                </span>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}


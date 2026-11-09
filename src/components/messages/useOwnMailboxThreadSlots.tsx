/**
 * Punch list #207 (v2.6745), the owner's variant of call 1: the strip above the reply box (`threadSlots.tsx`'s
 * `aboveBox`, after cut 2's owed strip) while the court is ours by their last word alone. *Answered them from your own
 * mailbox?* with **Find my sent mail** (My email's list as the person over their Sent, a mail to one of their addresses
 * in the last 30 days; each not yet on a thread gets **Tag it** onto the job in view, else their star, else the job
 * picker) and **I answered, write it down** (one optional line, then `answered_from_own_mailbox`). The kernel
 * `messages/ownMailboxAnswer.ts` decides when the strip shows and the words; `ownMailboxAnswerIo.ts` calls. Drawn for
 * the office team alone, and only while a thread is open under the page's providers.
 */
import { useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import type { Contact } from '../../lib/contacts/kernel'
import { isOptedOut } from '../../lib/contacts/kernel'
import { owedStore } from '../../lib/followUp/owedStore'
import { canOpenGcProjects } from '../../lib/gc/access'
import { isMyMailRefusal } from '../../lib/myMail/myMailIo'
import { jobRefOf } from '../../lib/messages/jobKeys'
import { contactEmailAddresses, OWN_MAILBOX_WORDS, sentMailQuery, sentOffers, showOwnMailboxStrip, tagJobFor, type SentOffer } from '../../lib/messages/ownMailboxAnswer'
import { supabaseOwnMailboxAnswerIo, type OwnMailboxAnswerIo } from '../../lib/messages/ownMailboxAnswerIo'
import { courtOf } from '../../lib/messages/thread'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobPickerWindow } from '../gc/messages/JobPickerWindow'
import { useOpenThread } from '../gc/messages/openThread'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useMessagesReread } from '../gc/messages/useMessagesReread'

export type OwnMailboxThreadSlots = Pick<ThreadSlots, 'aboveBox'>

const strip: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-blue-tint)', fontSize: '0.85rem' }
const row: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }
const door: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.25rem 0.7rem', background: 'var(--surface)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', font: 'inherit' }
const quiet: CSSProperties = { ...door, color: 'var(--text-base)', fontWeight: 500 }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const mailRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', padding: '0.2rem 0' }
const field: CSSProperties = { flex: '1 1 16rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.5rem', font: 'inherit', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-base)' }

type Mode = 'idle' | 'finding' | 'found' | 'writing'

const dayWords = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function OwnMailboxStrip({ contact, io }: { contact: Contact; io: OwnMailboxAnswerIo }) {
  const open = useOpenThread()
  const reread = useMessagesReread()
  const snap = useSyncExternalStore(owedStore.subscribe, owedStore.get, owedStore.get)
  const [mode, setMode] = useState<Mode>('idle')
  const [offers, setOffers] = useState<SentOffer[]>([])
  const [words, setWords] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)

  const owed = snap.open?.contactId === contact.id ? snap.open.owed : null
  const court = useMemo(
    () => (open ? courtOf(open.lines, contact.id, open.nowIso, { optedOut: isOptedOut(contact), owed: owed ? { what: owed.what, by: owed.byWords ?? owed.byYmd } : null }) : null),
    [open, contact, owed],
  )
  if (!open || !showOwnMailboxStrip(court)) return null

  const addresses = contactEmailAddresses(contact)
  const theirs = open.rail.map((k) => open.tiles[k]).filter((t): t is NonNullable<typeof t> => Boolean(t))

  const find = async () => {
    const q = sentMailQuery(addresses)
    if (!q) {
      setStatus(OWN_MAILBOX_WORDS.noAddress)
      setMode('found')
      setOffers([])
      return
    }
    setMode('finding')
    setStatus(null)
    setBusy(true)
    try {
      const answer = await io.listSent(q)
      if (isMyMailRefusal(answer)) {
        setOffers([])
        setStatus(answer.words)
      } else {
        const found = sentOffers(answer.rows)
        setOffers(found)
        setStatus(found.length === 0 ? OWN_MAILBOX_WORDS.none : null)
      }
    } catch (e) {
      setOffers([])
      setStatus(formatErrorMessage(e))
    } finally {
      setBusy(false)
      setMode('found')
    }
  }

  const tagOnto = async (threadId: string, key: string | null) => {
    const job = jobRefOf(key)
    if (!job) return
    setBusy(true)
    setStatus(null)
    try {
      const answer = await io.tag(threadId, job)
      if (isMyMailRefusal(answer)) {
        setStatus(answer.words)
        return
      }
      setOffers((prev) => prev.map((o) => (o.row.threadId === threadId ? { ...o, offer: 'onThread' } : o)))
      setStatus(OWN_MAILBOX_WORDS.tagged)
      reread()
    } catch (e) {
      setStatus(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const tag = (threadId: string) => {
    const job = tagJobFor(open.jobFilter, contact.defaultJobId)
    if (job) void tagOnto(threadId, `${job.kind}:${job.id}`)
    else setPicking(threadId)
  }

  const write = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const job = tagJobFor(open.jobFilter, contact.defaultJobId)
      await io.record(contact.id, words.trim() || null, job)
      setWords('')
      setMode('idle')
      setStatus(OWN_MAILBOX_WORDS.written)
      reread()
    } catch (e) {
      setStatus(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-own-mailbox style={strip}>
      <div style={row}>
        <span>{OWN_MAILBOX_WORDS.ask}</span>
        {mode !== 'writing' && (
          <button type="button" style={door} title={OWN_MAILBOX_WORDS.findTip} disabled={busy} onClick={() => void find()}>
            {OWN_MAILBOX_WORDS.find}
          </button>
        )}
        {mode !== 'writing' && (
          <button type="button" style={door} title={OWN_MAILBOX_WORDS.writeTip} disabled={busy} onClick={() => { setMode('writing'); setStatus(null) }}>
            {OWN_MAILBOX_WORDS.write}
          </button>
        )}
      </div>
      {mode === 'finding' && <p style={{ ...muted, margin: 0 }}>{OWN_MAILBOX_WORDS.finding}</p>}
      {mode === 'found' && offers.length > 0 && (
        <ul data-own-mailbox-sent style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {offers.map((o) => (
            <li key={o.row.gmailId} style={mailRow}>
              <span style={muted}>{dayWords(o.row.at)}</span>
              <span style={{ fontWeight: 600 }}>{o.row.subject}</span>
              <span style={muted}>to {o.row.who.name || o.row.who.address}</span>
              {o.offer === 'tag' ? (
                <button type="button" style={door} disabled={busy} onClick={() => tag(o.row.threadId)}>
                  {OWN_MAILBOX_WORDS.tag}
                </button>
              ) : (
                <span style={muted}>{OWN_MAILBOX_WORDS.onThread}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {mode === 'writing' && (
        <div style={row}>
          <input
            type="text"
            aria-label={OWN_MAILBOX_WORDS.wordsLabel}
            placeholder={OWN_MAILBOX_WORDS.wordsLabel}
            style={field}
            value={words}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => setWords(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) void write()
            }}
          />
          <button type="button" style={door} disabled={busy} onClick={() => void write()}>
            {OWN_MAILBOX_WORDS.writeDown}
          </button>
          <button type="button" style={quiet} disabled={busy} onClick={() => { setMode('idle'); setWords(''); setStatus(null) }}>
            {OWN_MAILBOX_WORDS.notNow}
          </button>
        </div>
      )}
      {status && (
        <p role="status" style={{ ...muted, margin: 0 }}>
          {status}
        </p>
      )}
      {picking && (
        <JobPickerWindow
          title={OWN_MAILBOX_WORDS.pickTitle}
          theirs={theirs}
          searchJobs={open.searchJobs}
          onPick={(key) => {
            const threadId = picking
            setPicking(null)
            void tagOnto(threadId, key)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

const DEFAULT_IO = supabaseOwnMailboxAnswerIo()

export function useOwnMailboxThreadSlots(io: OwnMailboxAnswerIo = DEFAULT_IO): OwnMailboxThreadSlots {
  const auth = useOptionalAuth()
  const on = canOpenGcProjects(auth?.role ?? null)
  return useMemo<OwnMailboxThreadSlots>(
    () => ({ aboveBox: (c) => (on ? <OwnMailboxStrip key={`own-mailbox:${c.id}`} contact={c} io={io} /> : null) }),
    [io, on],
  )
}

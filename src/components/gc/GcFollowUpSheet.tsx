import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { followUpMailTo, mailToGreeting, mailToWhy } from '../../lib/gc/companyPeople'
import { followUpDraft, mailHref, smsHref, telHref, type DraftChoice, type FollowPerson } from '../../lib/gc/followUpSheet'
import { GC_COMPANY } from '../../lib/gc/company'
import { followCustomerId, followUpCallWrites, followUpNudgeRequest, followUpSentWrites, nudgeBody, runFollowUpWrites, type FollowUpWrite, type FollowUpWriters } from '../../lib/gc/followUpWrites'
import { PORTAL_SPANISH_ON } from '../../lib/gc/portalI18n'
import { GC_TRADE_EMAIL_REFUSALS, gcTradeEmailRefusal, type TradeEmailAnswer, type TradeEmailRequest, type TradeEmailTestAnswer } from '../../lib/gc/tradeEmail'
import { allFollowPeople } from '../../lib/gc/projectPeople'
import type { GcState } from '../../lib/gc/types'
import { Btn, input } from './gcUi'
import { EmptyState } from '../EmptyState'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * GC mode, the real build, the Board's B2b-viii-a: the Follow up sheet, from the design spike's `GcFollowUpSheet.tsx` (the owner,
 * 2026-10-04). One person at a time, the whole list down the side: what they owe, ticked; a polite draft that names it, as a
 * quick nudge or a full note, by text or email; Call beside their number, then what they said. Logging it moves on.
 *
 * Known differences from the spike:
 *   * From me opens the reader's own Messages or mail with the draft filled in, and **I sent it** logs it. From the company
 *     (B2b-viii-b, `fromCompany`, a dev's while trade email is) emails a trade partner from Click through `gc-trade-email`,
 *     to everyone there who gets the kinds ticked, and logs it once it went. **Send a test to me** sends a [TEST] copy to
 *     the reader alone and says who the real one reaches. A customer gets From me and Call only (V8-3).
 *   * A number or an address the record does not have is never offered: no made-up stand-in is dialled, texted or mailed.
 *   * A call's answer on new dates is logged, not taken. The schedule keeps its own presses for that.
 *   * The writes are main's presses (`followUpWrites.ts`), made by the page, which reads the board again after.
 */

const box: CSSProperties = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' }

/** The email from Click (B2b-viii-b): `gc-trade-email`'s send and its test copy, the page's. */
export interface FollowUpFromCompany {
  send: (req: TradeEmailRequest) => Promise<TradeEmailAnswer>
  test: (req: TradeEmailRequest) => Promise<TradeEmailTestAnswer | Extract<TradeEmailAnswer, { ok: false }>>
}

export function GcFollowUpSheet({
  state,
  writes,
  fromCompany,
  me,
  startPartnerId,
  startCalling = false,
  onClose,
  onLogged,
  list,
  title,
}: {
  state: GcState
  /** Main's presses for the log, the page's. */
  writes: FollowUpWriters
  /** The email from Click, for whoever may send a trade email (`canSendGcTradeEmail`). Unset: From me only. */
  fromCompany?: FollowUpFromCompany
  /** The signed-in person's name, for the draft's sign-off. Null: none. */
  me: string | null
  /** The person to open on. Unset: the first on the list. */
  startPartnerId?: string
  /** Open on "What did they say?": the person's Call was pressed. */
  startCalling?: boolean
  onClose: () => void
  /** After a send or a call is logged: the page reads the board again. */
  onLogged?: () => void | Promise<void>
  /**
   * The people to walk, in place of the badge's: one job's people from a board row's Who to call, or the schedule's call
   * list. Read again on every change.
   */
  list?: (state: GcState) => FollowPerson[]
  /** The sheet's heading in place of "Follow up": the job's name. */
  title?: string
}) {
  // Without a list: everyone Follow up's badge counts (allFollowPeople, so every opener stays in step with the badge).
  const source = (s: GcState) => (list ? list(s) : allFollowPeople(s, startPartnerId))
  // The list as it stood when the sheet opened: someone who gives a day drops off the badge, but stays here marked done,
  // so the list does not jump under the pointer.
  const [ids] = useState(() => source(state).map((p) => p.partner.id))
  // Someone the list no longer holds (a call gave a day): the last we saw of them.
  const [seen] = useState(() => new Map<string, FollowPerson>())
  const people = useMemo(() => {
    const now = new Map(source(state).map((p) => [p.partner.id, p]))
    for (const [id, p] of now) seen.set(id, p)
    return ids.flatMap((id) => {
      const p = now.get(id) ?? seen.get(id)
      return p ? [p] : []
    })
    // `source` is rebuilt each render from `list` and `startPartnerId`, which are in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, startPartnerId, ids, list])
  const phone = useMatchMedia('(max-width: 760px)')
  const [pid, setPid] = useState<string | undefined>(startPartnerId ?? people[0]?.partner.id)
  const [done, setDone] = useState<Record<string, string>>({})
  const person = people.find((p) => p.partner.id === pid) ?? people[0]

  useEffect(() => {
    // Caught first and marked, so a window under the sheet (the schedule's) stays open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const next = (from: string) => {
    const at = people.findIndex((p) => p.partner.id === from)
    const after = [...people.slice(at + 1), ...people.slice(0, at)].find((p) => !done[p.partner.id] && p.partner.id !== from)
    if (after) setPid(after.partner.id)
  }
  const finished = (partnerId: string, words: string) => {
    setDone((d) => ({ ...d, [partnerId]: words }))
    window.setTimeout(() => next(partnerId), 900)
  }

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ? `Follow up: ${title}` : 'Follow up'}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: phone ? '12px 12px 0 0' : 12,
          width: phone ? '100%' : 'min(1000px, 100%)',
          maxHeight: phone ? 'min(92vh, 100%)' : 'min(92vh, 760px, 100%)',
          display: 'grid',
          gridTemplateColumns: phone ? '1fr' : '15rem minmax(0, 1fr)',
          gridTemplateRows: phone ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
        }}
      >
        <nav
          aria-label="People to follow up"
          style={{
            background: 'var(--bg-subtle)',
            borderRight: phone ? 'none' : '1px solid var(--border)',
            borderBottom: phone ? '1px solid var(--border)' : 'none',
            padding: '0.6rem',
            display: phone ? 'flex' : 'grid',
            gap: '0.2rem',
            alignContent: 'start',
            overflow: 'auto',
          }}
        >
          {!phone && (
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.2rem 0.5rem 0.4rem' }}>
              {title ?? 'Follow up'} · {people.length}
            </div>
          )}
          {people.map((p) => {
            const on = p.partner.id === person?.partner.id
            const first = p.items.find((i) => i.due) ?? p.items[0]
            return (
              <button
                key={p.partner.id}
                type="button"
                onClick={() => setPid(p.partner.id)}
                aria-current={on}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: '0.05rem',
                  padding: '0.45rem 0.6rem',
                  borderRadius: 8,
                  background: on ? 'var(--surface)' : 'transparent',
                  boxShadow: on ? 'inset 3px 0 0 #2563eb' : 'none',
                  fontSize: '0.85rem',
                  whiteSpace: phone ? 'nowrap' : 'normal',
                }}
              >
                <strong>
                  {p.reach.name}
                  {done[p.partner.id] && <span style={{ color: 'var(--text-green-700)', fontWeight: 600, fontSize: '0.78rem' }}> · {done[p.partner.id]}</span>}
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  {p.partner.company}
                  {first && !phone ? ` · ${first.label.split(' · ')[0]}` : ''}
                </span>
              </button>
            )
          })}
        </nav>
        {person ? (
          <PersonPane
            key={person.partner.id}
            state={state}
            person={person}
            me={me}
            calling0={startCalling && person.partner.id === startPartnerId}
            writes={writes}
            {...(fromCompany ? { fromCompany } : {})}
            onClose={onClose}
            onDone={async (w) => {
              await onLogged?.()
              finished(person.partner.id, w)
            }}
            sent={done[person.partner.id] ?? null}
          />
        ) : (
          // Nobody to chase is the good state (punch list #184): the words, and Close.
          <div style={{ padding: '1.25rem', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: '0.25rem' }}>
            <EmptyState compact main="Nobody needs a follow up right now." />
            <Btn kind="quiet" onClick={onClose}>
              Close
            </Btn>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; words: string; off?: boolean; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            disabled={o.off}
            title={o.title}
            onClick={() => onChange(o.v)}
            style={{
              border: 'none',
              padding: '0 0.75rem',
              height: 30,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: o.off ? 'not-allowed' : 'pointer',
              background: value === o.v ? 'var(--bg-blue-200)' : 'var(--surface)',
              color: value === o.v ? 'var(--text-blue-800)' : 'var(--text-muted)',
              opacity: o.off ? 0.5 : 1,
            }}
          >
            {o.words}
          </button>
        ))}
      </div>
    </div>
  )
}

function PersonPane({
  state,
  person,
  me,
  calling0,
  writes,
  fromCompany,
  onClose,
  onDone,
  sent,
}: {
  /** For who an email goes to: a plans item's job (`followItemMailGroup`). */
  state: GcState
  person: FollowPerson
  me: string | null
  /** Open on "What did they say?". */
  calling0: boolean
  writes: FollowUpWriters
  fromCompany?: FollowUpFromCompany
  onClose: () => void
  onDone: (words: string) => Promise<void>
  sent: string | null
}) {
  const { partner, reach, items } = person
  const customer = followCustomerId(person) !== null
  // Only what the record has: a made-up stand-in is never dialled, texted or mailed.
  const realPhone = partner.phone ?? null
  const [ticked, setTicked] = useState<string[]>(() => {
    const due = items.filter((i) => i.due).map((i) => i.key)
    return due.length > 0 ? due : items.map((i) => i.key)
  })
  const picked = items.filter((i) => ticked.includes(i.key))
  // An email goes to whoever at the company gets the kinds ticked (the owner, 2026-10-05): a waiver to the bookkeeper the
  // company named in its portal. A text and a call stay with the main contact.
  const mailTo = followUpMailTo(state, partner, picked).filter((t) => (t.main ? Boolean(partner.email) : Boolean(t.email)))
  const [choice, setChoice] = useState<DraftChoice>(() => ({ from: 'me', via: realPhone || mailTo.length === 0 ? 'text' : 'email', length: 'nudge' }))
  const [edited, setEdited] = useState<{ subject: string; body: string } | null>(null)
  const [calling, setCalling] = useState(calling0)
  const [drafted, setDrafted] = useState(false)
  const [said, setSaid] = useState('')
  const [by, setBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // What the test copy said, and an email that already went today.
  const [sentNote, setSentNote] = useState<string | null>(null)
  // The email from Click: a trade partner's, for whoever may send it (V8-3: never a customer).
  const canCompany = Boolean(fromCompany) && !customer
  const fromClick = canCompany && choice.from === 'company'
  // Spanish waits for its reader (decision 8): the email from Click is refused in words while it does (V8b-3).
  const spanishWaits = fromClick && (partner.lang ?? 'en') === 'es' && !PORTAL_SPANISH_ON
  const onSchedule = picked.some((i) => i.kind === 'schedule')
  const toOthers = choice.via === 'email' && mailTo.some((t) => !t.main)
  const draft = followUpDraft(person, picked, choice, me, toOthers ? mailToGreeting(mailTo, partner.lang ?? 'en') : undefined)
  const subject = edited?.subject ?? draft.subject
  // From Click the box holds what the email says between its own greeting and sign-off.
  const body = edited?.body ?? (fromClick ? nudgeBody(draft.body) : draft.body)
  const pick = (patch: Partial<DraftChoice>) => {
    const next = { ...choice, ...patch }
    // From the company goes by email only for now (question 29).
    if (next.from === 'company') next.via = 'email'
    setChoice(next)
    setEdited(null)
    setDrafted(false)
    setSentNote(null)
    setProblem(null)
  }
  const run = async (make: () => FollowUpWrite[], words: string) => {
    setBusy(true)
    setProblem(null)
    try {
      await runFollowUpWrites(make(), writes)
      setCalling(false)
      setDrafted(false)
      await onDone(words)
    } catch (e) {
      setProblem(`It did not log: ${formatErrorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const sentIt = () => run(() => followUpSentWrites(person, picked, choice, body), choice.via === 'text' ? 'texted' : 'emailed')
  const saveCall = () => run(() => followUpCallWrites(person, picked, said, by || null), 'called')
  /** The email from Click: a [TEST] copy to me, or the real one, logged once it went. */
  const sendFromClick = async (test: boolean) => {
    if (!fromCompany) return
    const req = followUpNudgeRequest(state, person, picked, subject, body, test)
    if (!req) {
      setProblem('Nothing ticked goes to them by email from here.')
      return
    }
    setBusy(true)
    setProblem(null)
    setSentNote(null)
    try {
      if (test) {
        const a = await fromCompany.test(req)
        if (!a.ok) setProblem(gcTradeEmailRefusal(a.key))
        else setSentNote(`A test copy went to ${a.email}. The real one goes to ${a.wouldGo.map((r) => `${r.name || partner.company} <${r.email}>`).join(', ')}.`)
        return
      }
      const a = await fromCompany.send(req)
      if (!a.ok) {
        setProblem(gcTradeEmailRefusal(a.key))
        return
      }
      if (a.already) {
        setSentNote('That email already went today. Nothing new was sent or logged.')
        return
      }
      await runFollowUpWrites(followUpSentWrites(person, picked, choice, body), writes)
      await onDone('emailed')
    } catch (e) {
      setProblem(`It went, and did not log: ${formatErrorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const canText = Boolean(realPhone)
  const canEmail = mailTo.length > 0
  const reachable = choice.via === 'text' ? canText : canEmail
  const sendHref = reachable && !fromClick ? (choice.via === 'text' ? smsHref(realPhone ?? '', body) : mailHref(mailTo.map((t) => t.email).join(','), subject, body)) : null
  const nothing = picked.length === 0 || body.trim() === ''
  // From me it opens my own Messages or mail with the draft, so the button says Draft (the owner, 2026-10-05).
  const sendWords = choice.via === 'text' ? 'Draft text' : 'Draft email'
  const how = spanishWaits
    ? GC_TRADE_EMAIL_REFUSALS.spanishHeld
    : fromClick && reachable
      ? `Goes from ${GC_COMPANY.name} with their portal link, and is logged once it goes. Send a test to yourself first.`
      : !reachable
    ? choice.via === 'text'
      ? `We have no phone number for ${reach.first}.`
      : `We have no email address for ${reach.first}.`
    : drafted
      ? 'Did it go? Press I sent it and it is logged.'
      : choice.via === 'text'
        ? 'Opens Messages on your phone with this filled in. Nothing goes until you send it there.'
        : 'Opens your own email with this filled in, under your name. Nothing goes until you send it there.'
  const label = { fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 } as const
  let footer: ReactNode
  if (calling) {
    footer = (
      <div style={{ display: 'grid', gap: '0.45rem', padding: '0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9rem' }}>What did {reach.first} say?</strong>
        <input autoFocus value={said} onChange={(e) => setSaid(e.target.value)} placeholder={`What ${reach.first} said`} aria-label={`What ${reach.first} said`} style={box} />
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          They gave a day
          <input type="date" value={by} onChange={(e) => setBy(e.target.value)} style={box} aria-label="The day they gave" />
          <span>Leave it empty if they gave none.</span>
        </label>
        {!customer && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A day for a quote, a paper or a promise is kept with it.</span>}
        {onSchedule && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A day for the schedule goes in the log. Move the bar on the schedule.</span>}
        {problem && (
          <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {problem}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={busy || (said.trim() === '' && by === '') || picked.length === 0} onClick={() => void saveCall()}>
            {busy ? 'Saving…' : 'Save the call'}
          </Btn>
          <Btn kind="quiet" disabled={busy} onClick={() => setCalling(false)}>
            Back to the message
          </Btn>
        </div>
      </div>
    )
  } else {
    footer = (
      <div style={{ display: 'grid', gap: '0.45rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: '44ch' }}>{how}</span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="quiet" onClick={onClose}>
              Close
            </Btn>
            {sendHref && (
              <a
                href={sendHref}
                onClick={(e) => {
                  if (nothing) {
                    e.preventDefault()
                    return
                  }
                  setDrafted(true)
                }}
                aria-disabled={nothing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 30,
                  padding: '0 0.85rem',
                  borderRadius: 6,
                  border: drafted ? '1px solid var(--border-strong)' : '1px solid #2563eb',
                  background: drafted ? 'var(--surface)' : '#2563eb',
                  color: drafted ? 'var(--text-base)' : '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  opacity: nothing ? 0.5 : 1,
                }}
              >
                {sendWords}
              </a>
            )}
            {drafted && (
              <Btn kind="primary" disabled={busy || nothing} onClick={() => void sentIt()}>
                {busy ? 'Logging…' : 'I sent it'}
              </Btn>
            )}
            {fromClick && (
              <>
                <Btn disabled={busy || nothing || !reachable || spanishWaits} onClick={() => void sendFromClick(true)} title="A copy marked [TEST] to your own email only. Nothing is logged.">
                  Send a test to me
                </Btn>
                <Btn kind="primary" disabled={busy || nothing || !reachable || spanishWaits} onClick={() => void sendFromClick(false)}>
                  {busy ? 'Sending…' : 'Send email'}
                </Btn>
              </>
            )}
          </div>
        </div>
        {sentNote && (
          <span role="status" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {sentNote}
          </span>
        )}
        {problem && (
          <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {problem}
          </span>
        )}
      </div>
    )
  }
  return (
    <section style={{ padding: '0.9rem 1.1rem 1rem', display: 'grid', gap: '0.8rem', overflow: 'auto', minWidth: 0, alignContent: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Follow up with {reach.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {partner.company}
            {partner.lang === 'es' ? ' · writes in Spanish' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: realPhone ? 'var(--text-base)' : 'var(--text-muted)' }}>{realPhone ?? 'No phone number'}</span>
          {realPhone ? (
            <a
              href={telHref(realPhone)}
              onClick={() => setCalling(true)}
              style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, textDecoration: 'none' }}
            >
              Call
            </a>
          ) : (
            <Btn onClick={() => setCalling(true)} title="You called them another way: log what they said.">
              Log a call
            </Btn>
          )}
          <span style={{ color: 'var(--text-muted)' }}>{partner.email ?? 'No email address'}</span>
        </div>
      </div>

      {sent && (
        <div role="status" style={{ background: 'var(--bg-green-100)', color: 'var(--text-green-800)', borderRadius: 8, padding: '0.45rem 0.7rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {sent.charAt(0).toUpperCase() + sent.slice(1)} {reach.first}. It is logged.
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={label}>What is missing</span>
        {items.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing left to ask {reach.first} for.</span>}
        {items.map((i) => (
          <label key={i.key} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.1rem 0.6rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={ticked.includes(i.key)}
              onChange={(e) => {
                setTicked((t) => (e.target.checked ? [...t, i.key] : t.filter((k) => k !== i.key)))
                setEdited(null)
                setDrafted(false)
              }}
              style={{ marginTop: 3 }}
            />
            <strong style={{ fontWeight: 600 }}>
              {!i.due && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Also owed: </span>}
              {i.label}
            </strong>
            <span style={{ gridColumn: 2, color: i.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>{i.why}</span>
            {i.last && <span style={{ gridColumn: 2, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Last: {i.last}</span>}
          </label>
        ))}
      </div>

      {!calling && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
            {canCompany && (
              <Seg
                label="From"
                value={choice.from}
                onChange={(v) => pick({ from: v })}
                options={[
                  { v: 'me', words: me ? `Me · ${me}` : 'Me' },
                  { v: 'company', words: GC_COMPANY.name },
                ]}
              />
            )}
            <Seg
              label="Send as"
              value={choice.via}
              onChange={(v) => pick({ via: v })}
              options={[
                { v: 'text', words: 'Text', off: !canText || fromClick, title: fromClick ? 'From the company it goes by email for now.' : canText ? undefined : 'We have no phone number for them.' },
                { v: 'email', words: 'Email', off: !canEmail, title: canEmail ? undefined : 'We have no email address for them.' },
              ]}
            />
            <Seg
              label="Length"
              value={choice.length}
              onChange={(v) => pick({ length: v })}
              options={[
                { v: 'nudge', words: 'Quick nudge' },
                { v: 'note', words: 'A full note' },
              ]}
            />
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {choice.via === 'email' && canEmail && (
              <div data-tour="gc-follow-mail-to" style={{ fontSize: '0.85rem', display: 'grid', gap: '0.1rem' }}>
                {/* From above To (the owner, 2026-10-05). */}
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>From </span>
                  {fromClick ? `${GC_COMPANY.name}. The email adds the greeting, their portal link and the sign-off.` : `${me ?? 'You'}, your own email`}
                </span>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>To </span>
                  {mailTo.map((t) => `${t.name} <${t.email}>`).join(', ')}
                </span>
                {toOthers && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{mailToWhy(state, partner, picked, mailTo)}</span>}
              </div>
            )}
            {choice.via === 'email' && <input value={subject} onChange={(e) => setEdited({ subject: e.target.value, body })} aria-label="Subject" style={box} />}
            <textarea
              value={body}
              onChange={(e) => setEdited({ subject, body: e.target.value })}
              aria-label="The message"
              rows={choice.length === 'nudge' && choice.via === 'text' ? 4 : 10}
              style={{ ...input, width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.7rem', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
            />
            {edited && (
              <span>
                <Btn kind="quiet" onClick={() => setEdited(null)}>
                  Back to the draft
                </Btn>
              </span>
            )}
          </div>
        </>
      )}
      {footer}
    </section>
  )
}

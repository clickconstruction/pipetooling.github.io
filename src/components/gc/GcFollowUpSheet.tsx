import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  followUpCallActions,
  followUpDraft,
  followUpMailTo,
  mailToGreeting,
  mailToWhy,
  allFollowPeople,
  followUpSentActions,
  mailHref,
  smsHref,
  telHref,
  type DraftChoice,
  type FollowPerson,
  type GcAction,
  type GcState,
  GC_COMPANY,
} from '../../lib/gcMode/gcModel'
import { useAuth } from '../../hooks/useAuth'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { callListCallActions, type DatesAnswer } from '../../lib/gcMode/gcCallList'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: the Follow up sheet (the owner, 2026-10-04). One person at a time, the
 * whole list down the side: what they owe, ticked; a polite draft that names it, from me (the
 * default) or from the company, as a quick nudge or a full note, by text or email; Call beside
 * their number, then what they said. Sending or saving logs it on each ask and moves on.
 * From me opens my own Messages or mail with the draft filled in; from the company goes from
 * Click, email only for now (question 29). In the prototype nothing leaves the app from Click.
 * Kernel: gcFollowUpSheet.ts.
 */

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

/** Where an email from the company comes from. Made up; the real build sends through Resend. */
const COMPANY_FROM_EMAIL = 'bids@clickconstruction.example'

const box: CSSProperties = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' }

export function GcFollowUpSheet({
  state,
  dispatch,
  startPartnerId,
  startCalling = false,
  onClose,
  list,
  title,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  /** The person to open on. Unset: the first on the list. */
  startPartnerId?: string
  /** Open on "What did they say?": the card's Call was pressed. */
  startCalling?: boolean
  onClose: () => void
  /**
   * The people to walk, in place of the badge's (Board, 2026-10-04): one job's people from the
   * board row's Who to call card, with that job's reasons. Read again on every change.
   */
  list?: (state: GcState) => FollowPerson[]
  /** The sheet's heading in place of "Follow up": the job's name. */
  title?: string
}) {
  // Without a list: everyone Follow up's badge counts (the Board's allFollowPeople, so every opener
  // stays in step with the badge and the dashboard).
  const source = (s: GcState) => (list ? list(s) : allFollowPeople(s, startPartnerId))
  // The list as it stood when the sheet opened: someone who gives a day drops off the badge, but
  // stays here marked done, so the list does not jump under the pointer.
  const [ids] = useState(() => source(state).map((p) => p.partner.id))
  // A job's list keeps someone it no longer holds (a call gave a day): the last we saw of them.
  const [seen] = useState(() => new Map<string, FollowPerson>())
  const people = useMemo(() => {
    const now = new Map(source(state).map((p) => [p.partner.id, p]))
    for (const [id, p] of now) seen.set(id, p)
    return ids.flatMap((id) => {
      const p = now.get(id) ?? (list ? seen.get(id) : allFollowPeople(state, id).find((x) => x.partner.id === id) ?? seen.get(id))
      return p ? [p] : []
    })
    // `source` is rebuilt each render from `list` and `startPartnerId`, which are in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, startPartnerId, ids, list])
  const me = useMeName()
  const phone = useMatchMedia('(max-width: 760px)')
  const [pid, setPid] = useState<string | undefined>(startPartnerId ?? people[0]?.partner.id)
  const [done, setDone] = useState<Record<string, string>>({})
  const person = people.find((p) => p.partner.id === pid) ?? people[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Follow up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: phone ? '12px 12px 0 0' : 12,
          width: phone ? '100%' : 'min(1000px, 100%)',
          maxHeight: phone ? '92vh' : 'min(92vh, 760px)',
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
          <PersonPane key={person.partner.id} state={state} person={person} me={me} calling0={startCalling && person.partner.id === startPartnerId} dispatch={dispatch} onClose={onClose} onDone={(w) => finished(person.partner.id, w)} sent={done[person.partner.id] ?? null} />
        ) : (
          <div style={{ padding: '1.25rem' }}>
            No one to follow up right now.{' '}
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
  dispatch,
  onClose,
  onDone,
  sent,
}: {
  /** For who an email goes to: a plans item's job (the Board's `followItemMailGroup`). */
  state: GcState
  person: FollowPerson
  me: string | null
  /** Open on "What did they say?". */
  calling0: boolean
  dispatch: Dispatch<GcAction>
  onClose: () => void
  onDone: (words: string) => void
  sent: string | null
}) {
  const { partner, reach, items } = person
  const [ticked, setTicked] = useState<string[]>(() => {
    const due = items.filter((i) => i.due).map((i) => i.key)
    return due.length > 0 ? due : items.map((i) => i.key)
  })
  const [choice, setChoice] = useState<DraftChoice>({ from: me ? 'me' : 'company', via: me ? 'text' : 'email', length: 'nudge' })
  const [edited, setEdited] = useState<{ subject: string; body: string } | null>(null)
  const [calling, setCalling] = useState(calling0)
  const [said, setSaid] = useState('')
  const [by, setBy] = useState('')
  // New dates on the schedule (the Gantt's call list, G-115): the answer heard on the call, recorded as the portal would.
  const [dates, setDates] = useState<DatesAnswer>('none')
  const picked = items.filter((i) => ticked.includes(i.key))
  const asksDates = picked.some((i) => i.schedule?.kind === 'dates')
  const onSchedule = picked.some((i) => i.kind === 'schedule')
  // An email goes to whoever at the company gets the kinds ticked (the owner, 2026-10-05): a waiver
  // to the bookkeeper the company named in its portal. A text and a call stay with the main contact.
  const mailTo = followUpMailTo(state, partner, picked)
  const toOthers = choice.via === 'email' && mailTo.some((t) => !t.main)
  const draft = followUpDraft(person, picked, choice, me, toOthers ? mailToGreeting(mailTo, partner.lang ?? 'en') : undefined)
  const subject = edited?.subject ?? draft.subject
  const body = edited?.body ?? draft.body
  const pick = (patch: Partial<DraftChoice>) => {
    const nextChoice = { ...choice, ...patch }
    // From the company goes by email only for now (question 29).
    if (nextChoice.from === 'company') nextChoice.via = 'email'
    setChoice(nextChoice)
    setEdited(null)
  }
  const send = () => {
    for (const a of followUpSentActions(person, picked, choice, body)) dispatch(a)
    onDone(choice.via === 'text' ? 'texted' : 'emailed')
  }
  const saveCall = () => {
    const answer = asksDates ? dates : 'none'
    const words = said.trim() || (answer === 'work' ? 'Said the new dates work.' : answer === 'another' ? 'Asked for another day.' : '')
    for (const a of followUpCallActions(person, picked, words, by || null)) dispatch(a)
    // What the answer does past the log (G-115): the dates answered, a delivery's new day, a promise.
    for (const a of callListCallActions(person, picked, { dates: answer, day: by || null, said: words, by: me ?? 'the office' })) dispatch(a)
    setCalling(false)
    onDone('called')
  }
  const fromMe = choice.from === 'me'
  const sendHref = fromMe ? (choice.via === 'text' ? smsHref(reach.phone, body) : mailHref(mailTo.map((t) => t.email).join(','), subject, body)) : null
  // From me it opens my own Messages or mail with the draft, so the button says Draft (the owner, 2026-10-05).
  const sendWords = fromMe ? (choice.via === 'text' ? 'Draft text' : 'Draft email') : choice.via === 'text' ? 'Send text' : 'Send email'
  const how = fromMe
    ? choice.via === 'text'
      ? 'Opens Messages with this filled in, from your phone. It is logged on the ask.'
      : 'Opens your email with this filled in, under your name. It is logged on the ask.'
    : `Goes from ${'Click Construction'} with their portal link. In the prototype nothing leaves the app. It is logged on the ask.`
  const label = { fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 } as const
  let footer: ReactNode
  if (calling) {
    footer = (
      <div style={{ display: 'grid', gap: '0.45rem', padding: '0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8 }}>
        <strong style={{ fontSize: '0.9rem' }}>What did {reach.first} say?</strong>
        <input autoFocus value={said} onChange={(e) => setSaid(e.target.value)} placeholder={`What ${reach.first} said`} aria-label={`What ${reach.first} said`} style={box} />
        {asksDates && (
          <Seg
            label="On the new dates"
            value={dates}
            options={[
              { v: 'none', words: 'No answer yet' },
              { v: 'work', words: 'They work' },
              { v: 'another', words: 'They need another day', title: 'The day they gave below is the day they asked for.' },
            ]}
            onChange={setDates}
          />
        )}
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          They gave a day
          <input type="date" value={by} onChange={(e) => setBy(e.target.value)} style={box} aria-label="The day they gave" />
          <span>Leave it empty if they gave none.</span>
        </label>
        {onSchedule && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A day on a delivery, a submittal or a start is kept with it.</span>}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={(said.trim() === '' && by === '' && !(asksDates && dates !== 'none')) || picked.length === 0} onClick={saveCall}>
            Save the call
          </Btn>
          <Btn kind="quiet" onClick={() => setCalling(false)}>
            Back to the message
          </Btn>
        </div>
      </div>
    )
  } else {
    footer = (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: '44ch' }}>{how}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
          {sendHref ? (
            <a
              href={sendHref}
              onClick={(e) => {
                if (picked.length === 0 || body.trim() === '') {
                  e.preventDefault()
                  return
                }
                send()
              }}
              aria-disabled={picked.length === 0 || body.trim() === ''}
              style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.85rem', borderRadius: 6, background: '#2563eb', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', opacity: picked.length === 0 ? 0.5 : 1 }}
            >
              {sendWords}
            </a>
          ) : (
            <Btn kind="primary" disabled={picked.length === 0 || body.trim() === ''} onClick={send}>
              {sendWords}
            </Btn>
          )}
        </div>
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
          <span style={{ fontVariantNumeric: 'tabular-nums' }} title={reach.madeUp ? 'Made up for the prototype.' : undefined}>
            {reach.phone}
          </span>
          <a
            href={telHref(reach.phone)}
            onClick={() => setCalling(true)}
            style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', color: 'var(--text-base)', fontWeight: 600, textDecoration: 'none' }}
          >
            Call
          </a>
          <span style={{ color: 'var(--text-muted)' }} title={reach.madeUp ? 'Made up for the prototype.' : undefined}>
            {reach.email}
          </span>
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
            <Seg
              label="From"
              value={choice.from}
              onChange={(v) => pick({ from: v })}
              options={[
                { v: 'me', words: me ? `Me · ${me}` : 'Me', off: !me, title: me ? undefined : 'Sign in to send in your name.' },
                { v: 'company', words: 'Click Construction' },
              ]}
            />
            <Seg
              label="Send as"
              value={choice.via}
              onChange={(v) => pick({ via: v })}
              options={[
                { v: 'text', words: 'Text', off: choice.from === 'company', title: choice.from === 'company' ? 'From the company it goes by email for now.' : undefined },
                { v: 'email', words: 'Email' },
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
            {choice.via === 'email' && (
              <div data-tour="gc-follow-mail-to" style={{ fontSize: '0.85rem', display: 'grid', gap: '0.1rem' }}>
                {/* From above To (the owner, 2026-10-05). The company's address is made up, like every address here. */}
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>From </span>
                  {fromMe ? `${me ?? 'Me'}, your own email` : `${GC_COMPANY.name} <${COMPANY_FROM_EMAIL}>`}
                </span>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>To </span>
                  {mailTo.map((t) => `${t.name} <${t.email}>`).join(', ')}
                </span>
                {toOthers && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{mailToWhy(state, partner, picked, mailTo)}</span>}
              </div>
            )}
            {choice.via === 'email' && (
              <input value={subject} onChange={(e) => setEdited({ subject: e.target.value, body })} aria-label="Subject" style={box} />
            )}
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

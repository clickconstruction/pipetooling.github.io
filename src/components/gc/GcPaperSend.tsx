import { useEffect, useRef, useState, type Dispatch } from 'react'
import {
  gcReducer,
  paperDayChoices,
  portalLink,
  portalMessages,
  type GcAction,
  type GcState,
  type PaperStep,
  type Partner,
  type PortalMessage,
} from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: send a paper from the company window (the owner, 2026-10-04: "by clicking
 * on something it brings them into where they would send off that document"). It takes the
 * paper's place beside the Documents list: who it goes to, the day it is due, a line of your own,
 * and the email exactly as the company will get it, in its language. Cancel goes back to the paper.
 */

const INK = '#16283c'
const PAPER = '#f6f3ec'

/** What goes with the email, in the card under it. */
const ATTACHED: Record<PaperStep['paper'], { name: string; how: string }> = {
  msa: { name: 'Master subcontract agreement', how: 'They read it and sign it in their portal.' },
  sow: { name: 'Statement of work', how: 'They read it and sign it in their portal.' },
  insurance: { name: 'Insurance certificate', how: 'They send it from their portal.' },
  w9: { name: 'W-9 form', how: 'They fill it in and sign it in their portal. The tax number never shows here.' },
  waiver: { name: 'Unconditional lien waiver', how: 'They sign it in their portal.' },
}

/** The email the send would write: run the send on a copy and read the company's inbox. */
function previewOf(state: GcState, partner: Partner, step: PaperStep, action: GcAction): PortalMessage | null {
  const next = gcReducer(state, action)
  if (next === state) return null
  const inbox = portalMessages(next, partner.id)
  if (step.mode === 'first' && step.paper === 'msa') return inbox.find((m) => m.key === 'msa') ?? null
  if (step.mode === 'first' && step.paper === 'sow') return inbox.find((m) => m.kind === 'sow' && m.projectId === step.projectId && !m.key.startsWith('send:')) ?? null
  return inbox.find((m) => m.key === `send:send-${(state.paperSends ?? []).length + 1}`) ?? null
}

export function GcPaperSend({
  state,
  partner,
  step,
  dispatch,
  onDone,
  onCancel,
}: {
  state: GcState
  partner: Partner
  step: PaperStep
  dispatch: Dispatch<GcAction>
  onDone: () => void
  onCancel: () => void
}) {
  const days = paperDayChoices(state.today)
  const [by, setBy] = useState(days[1]?.on ?? state.today)
  const [note, setNote] = useState('')
  // Every send takes a line of your own; the first master agreement or statement of work puts it,
  // with the day, in the portal's own email (the owner, 2026-10-04).
  const action: GcAction = {
    type: 'sendPaper',
    partnerId: partner.id,
    paper: step.paper,
    ...(step.projectId ? { projectId: step.projectId } : {}),
    ...(step.packageId ? { packageId: step.packageId } : {}),
    by,
    note,
  }
  return (
    <SendView
      title={step.title}
      history={step.history}
      to={`${partner.contact || partner.company}, by email, with their portal link · in ${partner.lang === 'es' ? 'Spanish' : 'English'}`}
      dayWord={step.dayWord}
      today={state.today}
      by={by}
      onBy={setBy}
      note={note}
      onNote={setNote}
      email={previewOf(state, partner, step, action)}
      link={portalLink(partner.id)}
      recipient={partner.company}
      attached={ATTACHED[step.paper]}
      sendLabel={step.sendLabel}
      onSend={() => {
        dispatch(action)
        onDone()
      }}
      onCancel={onCancel}
    />
  )
}

/**
 * The send itself, for a trade's paper or a customer's (GcCustomerSend): who it goes to, the day,
 * a line of your own, and the email as they will get it, with what goes with it.
 */
export function SendView({
  title,
  history,
  to,
  dayWord,
  today,
  by,
  onBy,
  note,
  onNote,
  email,
  link,
  recipient,
  attached,
  sendLabel,
  onSend,
  onCancel,
  dayNote = 'Follow up shows it to chase after this day. Signing or sending it keeps it.',
}: {
  /** The line under the day: what the day does. A trade's paper: Follow up chases it. */
  dayNote?: string
  title: string
  history: string
  to: string
  dayWord: string
  today: string
  by: string
  onBy: (day: string) => void
  note: string
  onNote: (note: string) => void
  email: { subject: string; lines: string[] } | null
  /** Their portal's link, under the email. Null: no portal to send them to. */
  link: string | null
  recipient: string
  attached: { name: string; how: string }
  sendLabel: string
  onSend: () => void
  onCancel: () => void
}) {
  const box = useRef<HTMLDivElement | null>(null)
  // In a narrow window the send sits under the list: bring it into view when it opens.
  useEffect(() => {
    const el = box.current
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  const days = paperDayChoices(today)
  const field = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, auto) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'start', fontSize: '0.88rem' } as const
  const label = { color: 'var(--text-muted)', paddingTop: '0.2rem' } as const

  return (
    <div
      ref={box}
      data-tour="gc-paper-send"
      style={{ border: '1px solid var(--text-blue-500)', borderRadius: 8, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.65rem', boxShadow: '0 0 0 3px var(--bg-blue-tint)' }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</div>
        {history && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{history}</div>}
      </div>
      <div style={field}>
        <span style={label}>To</span>
        <span>{to}</span>
      </div>
      <div style={field}>
        <span style={label}>{dayWord}</span>
        <span style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label={dayWord}>
            {days.map((d) => {
              const on = d.on === by
              return (
                <button
                  key={d.on}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onBy(d.on)}
                  style={{
                    padding: '0.2rem 0.65rem',
                    borderRadius: 999,
                    border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                    background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                    fontWeight: on ? 600 : 400,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dayNote}</span>
        </span>
      </div>
      <label style={field}>
        <span style={label}>Your line</span>
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="Optional. Added to the email."
          aria-label="Your line, added to the email"
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit', fontSize: '0.88rem' }}
        />
      </label>
      {email && (
        <div data-theme="light" style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 8, overflow: 'hidden', fontSize: '0.85rem' }}>
          <div style={{ background: INK, color: PAPER, padding: '0.35rem 0.65rem', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            The email {recipient} gets
          </div>
          <div style={{ padding: '0.55rem 0.7rem', display: 'grid', gap: '0.35rem' }}>
            <div style={{ fontWeight: 700 }}>{email.subject}</div>
            {email.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {link && <div style={{ color: 'var(--text-blue-700)', textDecoration: 'underline', overflowWrap: 'anywhere' }}>{link}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', border: '1px solid #c9bfa8', borderRadius: 6, padding: '0.4rem 0.55rem', background: '#fffdf8' }}>
              <span aria-hidden style={{ fontSize: '1.1rem' }}>📄</span>
              <span>
                <strong>{attached.name}</strong>
                <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.75 }}>{attached.how}</span>
              </span>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn kind="primary" onClick={onSend}>
          {sendLabel}
        </Btn>
      </div>
    </div>
  )
}

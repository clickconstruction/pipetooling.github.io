import { useEffect, useRef, useState } from 'react'
import { paperEmail } from '../../lib/gc/paperEmail'
import { paperDayChoices, type PaperStep } from '../../lib/gc/paperSend'
import { notEmailedWords, type PaperSendOutcome } from '../../lib/gc/papersIo'
import type { PortalLang } from '../../lib/gc/portalI18n'
import type { GcState, Partner } from '../../lib/gc/types'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build, the Board's B6-b-ii: send a paper from the company window's Documents tab, from the design
 * spike's `GcPaperSend.tsx` (the owner, 2026-10-04: "by clicking on something it brings them into where they would
 * send off that document"). It takes the paper's place beside the list: who it goes to, the day it is due, a line of
 * your own, and the email as the company gets it, in its language. The spike ran its reducer on a copy to draw the
 * email; here `paperEmail` writes the words the press sends. Cancel goes back to the list.
 */

/** Light like a printed page in either theme, as the spike drew the email. */
const INK = '#16283c'
const PAPER = '#f6f3ec'

/** What goes with the email, in the card under it. */
const ATTACHED: Record<PaperStep['paper'], { name: string; how: string }> = {
  msa: { name: 'Master services agreement', how: 'They read it and sign it from the link in the email.' },
  sow: { name: 'Statement of work', how: 'They read it and sign it in their portal.' },
  insurance: { name: 'Insurance certificate', how: 'They reply with it. File it here with Record their insurance.' },
  w9: { name: 'W-9 form', how: 'They fill it in and sign it from the link in the email. The tax number never shows here.' },
  waiver: { name: 'Unconditional lien waiver', how: 'They sign it in their portal.' },
}

export function GcPaperSend({
  state,
  partner,
  step,
  lang,
  onSend,
  onDone,
  onCancel,
}: {
  state: GcState
  partner: Partner
  step: PaperStep
  lang: PortalLang
  /** The press: record the send and email it (`sendCompanyPaper`). */
  onSend: (by: string, note: string) => Promise<PaperSendOutcome>
  /** After the send is on record: the words to show, and the board read again. */
  onDone: (words: string) => void
  onCancel: () => void
}) {
  const days = paperDayChoices(state.today)
  const [by, setBy] = useState(days[1]?.on ?? state.today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  // In a narrow window the send sits under the list: bring it into view when it opens.
  useEffect(() => {
    const el = box.current
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  const email = paperEmail(state, partner, step, by, note, lang)
  const field = { display: 'grid', gridTemplateColumns: 'minmax(5.5rem, auto) minmax(0, 1fr)', gap: '0.5rem', alignItems: 'start', fontSize: '0.88rem' } as const
  const label = { color: 'var(--text-muted)', paddingTop: '0.2rem' } as const
  const attached = ATTACHED[step.paper]

  const send = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const outcome = await onSend(by, note)
      if (outcome.ok) onDone(outcome.emailed ? `Sent to ${outcome.to.join(', ') || partner.company}.` : 'On record. No email goes until their portal can sign it.')
      else if (outcome.recorded) onDone(notEmailedWords(outcome.why))
      else setProblem(outcome.why)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That did not send.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={box}
      data-gc-paper-send={step.docKey}
      style={{ border: '1px solid var(--text-blue-500)', borderRadius: 8, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'grid', gap: '0.65rem', boxShadow: '0 0 0 3px var(--bg-blue-tint)' }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{step.title}</div>
        {step.history && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{step.history}</div>}
      </div>
      <div style={field}>
        <span style={label}>To</span>
        <span>
          {partner.contact || partner.company}, by email · in {lang === 'es' ? 'Spanish' : 'English'}
        </span>
      </div>
      <div style={field}>
        <span style={label}>{step.dayWord}</span>
        <span style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label={step.dayWord}>
            {days.map((d) => {
              const on = d.on === by
              return (
                <button
                  key={d.on}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBy(d.on)}
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
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Follow up shows it to chase after this day. Signing or sending it keeps it.</span>
        </span>
      </div>
      <label style={field}>
        <span style={label}>Your line</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={lang === 'es' ? 'Optional. They read Spanish: write it in Spanish, it goes in as typed.' : 'Optional. Added to the email.'}
          aria-label="Your line, added to the email"
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit', fontSize: '0.88rem' }}
        />
      </label>
      {email ? (
        <div data-theme="light" data-gc-paper-email style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 8, overflow: 'hidden', fontSize: '0.85rem' }}>
          <div style={{ background: INK, color: PAPER, padding: '0.35rem 0.65rem', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The email {partner.company} gets</div>
          <div style={{ padding: '0.55rem 0.7rem', display: 'grid', gap: '0.35rem' }}>
            <div style={{ fontWeight: 700 }}>{email.subject}</div>
            {email.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {email.how === 'sign' && (
              <div>
                <span style={{ display: 'inline-block', background: INK, color: PAPER, borderRadius: 6, padding: '0.25rem 0.7rem', fontWeight: 600 }}>{email.actionLabel}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', border: '1px solid #c9bfa8', borderRadius: 6, padding: '0.4rem 0.55rem', background: '#fffdf8' }}>
              <span aria-hidden style={{ fontSize: '1.1rem' }}>📄</span>
              <span>
                <strong>{attached.name}</strong>
                <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.75 }}>{attached.how}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No email goes yet: their portal cannot sign it. The send is kept, and Follow up chases its day.</div>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn kind="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn kind="primary" onClick={() => void send()} disabled={busy}>
          {busy ? 'Sending…' : step.sendLabel}
        </Btn>
      </div>
    </div>
  )
}

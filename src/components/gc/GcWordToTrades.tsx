import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { batchOutcomeWords, countedLabel } from '../../lib/batchWords'
import { tradeMailLang } from '../../lib/gc/tradeEmail'
import type { GcProject, GcState } from '../../lib/gc/types'
import { andList, wordLines, wordRecipients, wordSubject, type WordRecipient } from '../../lib/gc/wordToTrades'
import type { WordToTrades } from '../../lib/gc/wordToTradesIo'
import { Btn, input } from './gcUi'

/**
 * Punch list #205, row 2 (PR 6): **Word to every trade** on a project's card, the pattern of `GcTellTrades.tsx`. One email
 * to every company awarded a trade on the job (`wordRecipients`), through `gc-trade-email` as a `nudge` to the people who
 * get the job's emails, in each company's language, under one key for the words, so a second press of the same words
 * sends nothing. The window: a subject (starting as *A word from Click on {project}*), the words, the companies by name,
 * and one press that says what it will do with its count (`countedLabel`), dead until something is typed and someone is
 * awarded. It keeps going past a refusal and names each company with why afterwards (`batchOutcomeWords`). Each email
 * lands in `gc_trade_messages`, so every company's thread in its portal shows it (PR 5).
 */

export function GcWordToTrades({
  state,
  project,
  onSend,
  onClose,
}: {
  state: GcState
  project: GcProject
  /** The press: every company shown, through the one sender. Never throws. */
  onSend: (recipients: WordRecipient[], subject: string, text: string) => Promise<WordToTrades>
  onClose: () => void
}) {
  const recipients = useMemo(() => wordRecipients(state, project), [state, project])
  const [subject, setSubject] = useState(() => wordSubject(project.name))
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<WordToTrades | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const ready = recipients.length > 0 && subject.trim() !== '' && wordLines(text).length > 0 && !sending
  const send = async () => {
    if (!ready) return
    setSending(true)
    try {
      setResult(await onSend(recipients, subject.trim(), text))
    } finally {
      setSending(false)
    }
  }
  const outcome = result ? batchOutcomeWords({ verb: 'send', past: 'Sent', done: result.sent.length, failed: result.refused.length, noun: ['email', 'emails'] }) : null
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Word to every trade"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(640px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Word to every trade on {project.name}</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {result ? 'Each company reads it in its portal too.' : 'One email to every company awarded a trade on this job. It goes to the people who get the job’s emails, in their language.'}
          </div>
        </div>
        {result && outcome ? (
          <div data-word-result style={{ display: 'grid', gap: '0.4rem' }}>
            <div style={{ color: outcome.tone === 'error' ? 'var(--text-red-700)' : outcome.tone === 'warning' ? 'var(--text-amber-800)' : 'var(--text-green-800)' }}>{outcome.line}</div>
            {result.sent.length > 0 && <div>Sent to {andList(result.sent.map((s) => s.company))}.</div>}
            {result.already.length > 0 && <div style={{ color: 'var(--text-muted)' }}>{andList(result.already.map((s) => s.company))} already had these words. Nothing was sent again.</div>}
            {outcome.head && <div style={{ color: 'var(--text-amber-800)' }}>{outcome.head}</div>}
            {result.refused.map((r) => (
              <div key={r.companyId} style={{ color: 'var(--text-amber-800)' }}>
                {r.company}: {r.words}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div role="group" aria-label="Companies on this job" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {recipients.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>No company is awarded a trade on this job yet. Award one first.</span>
              ) : (
                recipients.map((r) => (
                  <span key={r.partner.id} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {r.partner.company} · {r.trades.join(', ')}
                    {tradeMailLang(r.partner.lang) === 'es' ? ' · Español' : ''}
                  </span>
                ))
              )}
            </div>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subject</span>
              <input value={subject} maxLength={200} disabled={sending} onChange={(e) => setSubject(e.target.value)} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>The word</span>
              <textarea
                value={text}
                rows={5}
                maxLength={8000}
                disabled={sending}
                placeholder="What every trade on this job should know. A blank line starts a new paragraph."
                onChange={(e) => setText(e.target.value)}
                style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', font: 'inherit' }}
              />
            </label>
          </>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          {result ? (
            <>
              <span style={{ flex: '1 1 10rem' }} />
              <Btn kind="primary" onClick={onClose}>
                Done
              </Btn>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
                {recipients.length === 1 ? '1 email goes out' : `${recipients.length} emails go out`}, each with the company&apos;s portal link. The same words go once.
              </span>
              <Btn kind="quiet" onClick={onClose}>
                Cancel
              </Btn>
              <Btn kind="primary" disabled={!ready} onClick={() => void send()}>
                {sending ? 'Sending…' : countedLabel('Tell', recipients.length, ['company', 'companies'])}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The Collect desk, PR D (v2.5855): after the call. One payer's row of the
 * sheet, opened: four answers, the fields each needs, what the app then does,
 * and one button that records it as the Payment Chase touch or the promise
 * the app already keeps. Money is recorded where money lives, so the first
 * answer sends the caller to the customer's page and keeps only a note. The
 * writes come in through `writer`, so the sheet renders and tests without
 * the database.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { COLLECT_ANSWERS, COLLECT_DISPUTE_REASONS, COLLECT_NO_DATE_REASONS, collectOutcomePlan, mailedCheckYmd, type CollectAnswer, type CollectDisputeReason, type CollectNoDateReason, type CollectOutcomeWrite } from '../../lib/bridge/collect/collectOutcome'
import type { CollectPayer } from '../../lib/bridge/collect/collectPayers'

const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const field: CSSProperties = { height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem', color: 'var(--text-muted)' }

export type CollectOutcomeWriter = {
  /** One write, in order; the sheet calls it once per write the plan names. */
  write: (payer: CollectPayer, write: CollectOutcomeWrite) => Promise<void>
}

export function BridgeCollectOutcome({ payer, todayYmd, dayLabel, graceDays, quietDays, customerHref, writer, onClose, onRecorded }: { payer: CollectPayer; todayYmd: string; dayLabel: (ymd: string) => string; graceDays: number; quietDays: number; customerHref: string | null; writer: CollectOutcomeWriter; onClose: () => void; onRecorded: () => void }) {
  const [answer, setAnswer] = useState<CollectAnswer>(payer.promise.state === 'broken' ? 'promised' : 'promised')
  const [ymd, setYmd] = useState('')
  const [saidBy, setSaidBy] = useState('')
  const [words, setWords] = useState('')
  const [noDateReason, setNoDateReason] = useState<CollectNoDateReason>('no_answer')
  const [resend, setResend] = useState(false)
  const [disputeReason, setDisputeReason] = useState<CollectDisputeReason>('amount')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const input = answer === 'paid' ? { answer, words } : answer === 'promised' ? { answer, ymd, saidBy, words } : answer === 'nodate' ? { answer, reason: noDateReason, words, resend } : { answer, reason: disputeReason, words }
  const plan = collectOutcomePlan(input, { graceDays, quietDays, dayLabel })
  const canRecord = answer !== 'promised' || /^\d{4}-\d{2}-\d{2}$/.test(ymd)
  const promiseHead = payer.promise.state === 'broken' && payer.promise.promise ? `${payer.payerName} · ${stageUsd(payer.usd)} · promised ${dayLabel(payer.promise.promise.promisedYmd)}` : `${payer.payerName} · ${stageUsd(payer.usd)}`

  const record = async () => {
    setBusy(true)
    setError(null)
    try {
      for (const w of plan.writes) await writer.write(payer, w)
      onRecorded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The record did not save.')
      setBusy(false)
    }
  }

  const answerButton = (a: (typeof COLLECT_ANSWERS)[number]) => (
    <button key={a.key} type="button" onClick={() => setAnswer(a.key)} aria-pressed={answer === a.key} style={{ minHeight: 56, borderRadius: 10, border: `2px solid ${answer === a.key ? 'var(--text-base)' : 'var(--border)'}`, background: answer === a.key ? 'var(--bg-subtle)' : 'var(--surface)', color: 'var(--text)', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
      {a.label}
      <div style={{ ...det, fontWeight: 400 }}>{a.sub}</div>
    </button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} data-testid="bridge-collect-outcome">
      <div role="dialog" aria-modal="true" aria-label="After the call" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(760px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>After the call</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{promiseHead}</div>
          <div style={det}>Four answers cover the call. Each becomes the record the app already keeps. A call with nothing recorded is a call not made.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>{COLLECT_ANSWERS.map(answerButton)}</div>

        {answer === 'paid' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
            <div>
              Only when the money is visible. “It went out Friday” is not paid: it is a date, under They named a date. Money is recorded where money lives.{' '}
              {customerHref ? <Link to={customerHref}>Record the payment on the customer’s page ›</Link> : null} It goes to the bills the remittance names. Oldest first only when it names none.
            </div>
            <label style={labelStyle}>
              A note with it
              <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="check number, how it came" style={field} />
            </label>
          </div>
        )}
        {answer === 'promised' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
            <div style={det}>“The check went out Friday” is a promise dated by the mail: the mail day plus five. “Approved, on the next run” is a promise with the run’s date.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={labelStyle}>
                They will pay by
                <input type="date" value={ymd} min={todayYmd} onChange={(e) => setYmd(e.target.value)} style={field} aria-label="They will pay by" />
              </label>
              <label style={labelStyle}>
                Who said it
                <input value={saidBy} onChange={(e) => setSaidBy(e.target.value)} placeholder="Dana, accounts payable" style={field} />
              </label>
              <label style={labelStyle}>
                In their words
                <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="check run is Thursday, in the mail Friday" style={field} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setYmd(mailedCheckYmd(todayYmd))} style={{ ...det, border: '1px dashed var(--border)', borderRadius: 999, padding: '3px 9px', background: 'transparent', cursor: 'pointer' }}>
                Mailed today, so {dayLabel(mailedCheckYmd(todayYmd))}
              </button>
            </div>
          </div>
        )}
        {answer === 'nodate' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: '0.88rem' }}>
            <label style={labelStyle}>
              What happened
              <select value={noDateReason} onChange={(e) => setNoDateReason(e.target.value as CollectNoDateReason)} style={field} aria-label="What happened">
                {COLLECT_NO_DATE_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              In their words
              <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="optional" style={field} />
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} /> Resend the bill now, a resent touch too
            </label>
          </div>
        )}
        {answer === 'dispute' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, fontSize: '0.88rem' }}>
            <label style={labelStyle}>
              What they dispute
              <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value as CollectDisputeReason)} style={field} aria-label="What they dispute">
                {COLLECT_DISPUTE_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              In their words
              <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="what they said, as they said it" style={field} />
            </label>
          </div>
        )}

        <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <b style={{ color: 'var(--text)' }}>What the app then does:</b> {plan.then.join(' ')}
        </div>
        {error && <div style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
            Not now
          </button>
          <button type="button" disabled={busy || !canRecord} onClick={() => void record()} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--text-base)', color: 'var(--surface)', fontWeight: 700, cursor: 'pointer', opacity: busy || !canRecord ? 0.6 : 1 }} data-testid="bridge-collect-outcome-record">
            {busy ? 'Recording…' : answer === 'paid' ? 'Keep the note' : answer === 'promised' ? 'Record the promise' : answer === 'nodate' ? 'Record it' : 'Hand it to the owner'}
          </button>
        </div>
      </div>
    </div>
  )
}

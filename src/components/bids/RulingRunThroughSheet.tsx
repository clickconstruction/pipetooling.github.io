import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { runThroughProgress, type RunThroughItem } from '../../lib/bids/rulingRunThrough'
import { answerFromChoice } from '../../lib/bids/twinQuestionChoices'
import { TwinQuestionText } from './TwinQuestionText'
import type { SourceBidRef } from '../../lib/bids/twinQuestionBidRefs'

export type RunThroughOutcome = { item: RunThroughItem; what: 'answered' | 'not mine' | 'dismissed'; answer: string | null }

type Props = {
  /** The run, in order. The sheet keeps the list it opened with, so a reload mid-run never reshuffles it. */
  items: RunThroughItem[]
  startIndex?: number
  bidIdByNumber: Readonly<Record<string, string>>
  bidNumberById: Readonly<Record<string, string | null>>
  sourceByBidId: Readonly<Record<string, SourceBidRef>>
  /** Whether "Not mine" can write (the audience column exists). */
  audienceWritable: boolean
  busy: boolean
  /** Each resolves true when the rows were written; the sheet advances only then. */
  onAnswer: (item: RunThroughItem, text: string) => Promise<boolean>
  onNotMine: (item: RunThroughItem) => Promise<boolean>
  onDismiss: (item: RunThroughItem) => Promise<boolean>
  onClose: () => void
}

const bigBtn = (filled: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
  textAlign: 'left',
  padding: '0.8rem 1rem',
  borderRadius: 8,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '1rem',
  lineHeight: 1.3,
  border: `1px solid ${filled ? '#3b82f6' : 'var(--border-strong)'}`,
  background: filled ? '#3b82f6' : 'var(--surface)',
  color: filled ? 'white' : 'var(--text-strong)',
  fontWeight: filled ? 600 : 400,
})
const keyCap = (filled: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  height: 26,
  borderRadius: 6,
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '0.8rem',
  fontWeight: 700,
  border: `1px solid ${filled ? 'rgba(255,255,255,0.6)' : 'var(--border-strong)'}`,
  background: filled ? 'rgba(255,255,255,0.18)' : 'var(--bg-subtle)',
  color: filled ? 'white' : 'var(--text-700)',
  flexShrink: 0,
})
const quietBtn: CSSProperties = { padding: '0.35rem 0.7rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', whiteSpace: 'nowrap' }

/**
 * The run-through (punch list #63, PR 3, v2.4232): one question is the whole screen; the
 * robot's pick is the first big button; 1–4 tap, Enter takes the ★, → skips, Escape
 * closes. Not mine and Dismiss sit in the corner where they cannot be hit by accident. A
 * shared question says on whose bids the answer lands. At the end: what was saved, and the
 * door back to the queue. Already a phone shape.
 */
export function RulingRunThroughSheet({ items, startIndex = 0, bidIdByNumber, bidNumberById, sourceByBidId, audienceWritable, busy, onAnswer, onNotMine, onDismiss, onClose }: Props) {
  const [list] = useState(items)
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, list.length - 1)))
  const [outcomes, setOutcomes] = useState<RunThroughOutcome[]>([])
  const [skipped, setSkipped] = useState(0)
  const [freeText, setFreeText] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const item = list[index]
  const done = !item
  const total = list.length

  const advance = () => {
    setFreeText(false)
    setDraft('')
    setIndex((i) => i + 1)
  }
  const record = (what: RunThroughOutcome['what'], answer: string | null) => {
    if (!item) return
    setOutcomes((p) => [...p, { item, what, answer }])
    advance()
  }
  const answer = async (text: string) => {
    if (!item || busy || !text.trim()) return
    if (await onAnswer(item, text.trim())) record('answered', text.trim())
  }
  const notMine = async () => {
    if (!item || busy) return
    if (await onNotMine(item)) record('not mine', null)
  }
  const dismiss = async () => {
    if (!item || busy) return
    if (await onDismiss(item)) record('dismissed', null)
  }
  const skip = () => {
    if (!item) return
    setSkipped((n) => n + 1)
    advance()
  }

  const choices = item?.choices ?? null
  const showButtons = !!choices && !freeText

  // The keys: numbers pick, Enter takes the robot's pick, → skips, Escape closes — never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (typing || done) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        skip()
        return
      }
      if (!showButtons || !choices) return
      if (e.key === 'Enter') {
        const star = choices.find((c) => c.recommended)
        if (star) {
          e.preventDefault()
          void answer(answerFromChoice(star))
        }
        return
      }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= choices.length + 1) {
        e.preventDefault()
        if (n === choices.length + 1) setFreeText(true)
        else void answer(answerFromChoice(choices[n - 1]!))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, showButtons, choices, busy, done])

  useEffect(() => {
    if (freeText || !choices) inputRef.current?.focus()
  }, [freeText, choices, index])

  // v2.4295: the questions the run answers — a shared step counts every copy — so the header agrees with the button.
  const questionCount = useMemo(() => list.reduce((n, i) => n + i.questionIds.length, 0), [list])
  const progress = useMemo(() => runThroughProgress(index, total, outcomes.length, questionCount), [index, total, outcomes.length, questionCount])

  // 'asked on 2 bids · b496 → ours b490 · b495 → ours b489'
  const askedLine = useMemo(() => {
    if (!item) return ''
    const refs = item.aboutBidIds.map((id) => {
      const num = bidNumberById[id]
      const src = sourceByBidId[id]
      const own = num ? `b${num}` : 'a bid'
      return src?.number ? `${own} → ours b${src.number}` : own
    })
    const n = item.aboutBidIds.length
    if (n === 0) return item.askCount > 1 ? `asked ${item.askCount} times` : 'a job-wide question'
    return `asked on ${n} bid${n === 1 ? '' : 's'} · ${refs.join(' · ')}`
  }, [item, bidNumberById, sourceByBidId])

  return (
    <div role="dialog" aria-modal aria-label="Answer the robots' questions" data-testid="ruling-run-through" style={{ position: 'fixed', inset: 0, background: 'var(--surface)', zIndex: 1005, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
        <b style={{ fontSize: '0.95rem' }}>{done ? 'Done' : progress.position}</b>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{done ? `${outcomes.length} answered · ${skipped} skipped` : progress.progress}</span>
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ ...quietBtn, marginLeft: 'auto', fontSize: '1rem', lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: '1.25rem 1rem 2rem', boxSizing: 'border-box' }}>
        {done ? (
          <div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
              {outcomes.length === 0 ? 'Nothing saved this time.' : `Saved — ${outcomes.length} question${outcomes.length === 1 ? '' : 's'} handled. The robots pull every answer on their next run.`}
            </p>
            {outcomes.length > 0 ? (
              <ul style={{ margin: '0 0 1.25rem', paddingLeft: '1.2rem', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {outcomes.map((o) => (
                  <li key={o.item.key}>
                    <b>{o.item.label ?? 'Question'}</b>
                    {o.item.askCount > 1 ? <span style={{ color: 'var(--text-muted)' }}> · {o.item.askCount} copies</span> : null}
                    {' — '}
                    {o.what === 'answered' ? o.answer : o.what === 'not mine' ? "sent to the operator's console" : 'dismissed'}
                  </li>
                ))}
              </ul>
            ) : null}
            {skipped > 0 ? <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{skipped} skipped — still on the list.</p> : null}
            <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>Back to the queue</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {item.label ? (
                <span style={{ display: 'inline-block', padding: '0.1rem 0.55rem', borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-700)', fontSize: '0.75rem', fontWeight: 600 }}>{item.label}</span>
              ) : null}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{askedLine}</span>
            </div>
            <div style={{ fontSize: '1.05rem', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              🤖 <TwinQuestionText text={item.newest.question} bidIdByNumber={bidIdByNumber} aboutBidId={item.newest.about_bid_id} aboutBidNumber={item.newest.about_bid_id ? bidNumberById[item.newest.about_bid_id] : null} sourceByBidId={sourceByBidId} />
            </div>
            {showButtons && choices ? (
              <div role="group" aria-label="Answer with one tap" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {choices.map((c, i) => (
                  <button key={c.label} type="button" disabled={busy} onClick={() => void answer(answerFromChoice(c))} title={c.recommended ? "The robot's own pick — Enter agrees" : `Answer with this (${i + 1})`} style={bigBtn(c.recommended)}>
                    <span style={keyCap(c.recommended)}>{i + 1}</span>
                    <span>
                      {c.recommended ? '★ ' : ''}
                      {c.label}
                      {c.recommended ? <span style={{ opacity: 0.8, fontWeight: 400 }}> · the robot's pick</span> : null}
                    </span>
                  </button>
                ))}
                <button type="button" disabled={busy} onClick={() => setFreeText(true)} title="None of these — type your own answer" style={{ ...bigBtn(false), borderStyle: 'dashed', color: 'var(--text-muted)' }}>
                  <span style={keyCap(false)}>{choices.length + 1}</span>
                  <span>Something else…</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void answer(draft)
                  }}
                  placeholder={item.askCount > 1 ? 'Your ruling — answers every copy at once…' : 'Your answer — the robot pulls it next run…'}
                  style={{ flex: 1, padding: '0.6rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <button type="button" disabled={busy || !draft.trim()} onClick={() => void answer(draft)} style={{ padding: '0.6rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>
                  {item.askCount > 1 ? `Answer all ${item.askCount}` : 'Answer'}
                </button>
                {choices ? (
                  <button type="button" onClick={() => setFreeText(false)} style={quietBtn}>Back to the taps</button>
                ) : null}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>{item.askCount > 1 ? `One tap answers ${item.askCount === 2 ? 'both' : `all ${item.askCount}`} open copies; the robots pull it on their next run.` : 'The robot pulls it on its next run.'}</span>
              <button type="button" onClick={skip} title="Leave it on the list (→)" style={{ ...quietBtn, marginLeft: 'auto' }}>Skip →</button>
              {audienceWritable ? (
                <button type="button" disabled={busy} onClick={() => void notMine()} title="A robot's machine problem, not an estimating question — move it to the operator's console" style={quietBtn}>Not mine</button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => void dismiss()} title="Close without an answer — the robots stop asking" style={quietBtn}>Dismiss</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

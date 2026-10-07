import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { CALL_SCRIPT_NO_JOB_WORDS, CALL_SCRIPT_NO_LETTER_WORDS, CALL_SCRIPT_TITLE, callScriptLetterLine, callScriptOpeningLine, callScriptOpenings, genericCallFacts } from '../../lib/jobs/lienCallScript'
import type { CallLetterFacts } from '../../lib/jobs/lienOwnerCallScript'

/**
 * An owner is calling (v2.4731): what the ☎ button opens — counsel's opening line, the six
 * things owners say as chips (a chip shows the line that answers it, with its cite), the
 * letter in their hand when a job is under the reader, Record the call to the call sheet that
 * keeps the answers, Find the job to the list's find box, and the practice call. Nothing is
 * typed to get here and nothing is written here.
 */
type Props = {
  /** The selected job's last notice, or null when no job is under the reader. */
  facts: CallLetterFacts | null
  /** The job as the desk names it — "273 · Dudley (Lennox)". */
  jobLabel: string | null
  /** A notice has gone out on the job, so the call can be recorded on it. */
  hasLetter: boolean
  us: string
  onRecord: () => void
  onFindJob: () => void
  onPractice: () => void
  onClose: () => void
}

const fmt = { day: formatYmdMonthDay, money: formatUsdNoCents }
const GUIDE = 'answer-an-owner-who-calls-about-a-lien-letter'
const kicker: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }

export default function LienCallScriptModal({ facts, jobLabel, hasLetter, us, onRecord, onFindJob, onPractice, onClose }: Props) {
  const f = facts ?? genericCallFacts(us)
  const [picked, setPicked] = useState<string | null>(null)
  const opening = useMemo(() => callScriptOpeningLine(f, fmt), [f])
  const openings = useMemo(() => callScriptOpenings(f, fmt), [f])
  const chosen = openings.find((o) => o.key === picked) ?? null

  // Esc closes only this window, in the capture phase, so the desk under it never sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lien-call-script-title"
      data-testid="lien-call-script"
      data-has-job={facts ? 'yes' : 'no'}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: 'min(680px, calc(100vw - 2rem))', maxHeight: 'min(90dvh, calc(100dvh - 2rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px)))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="lien-call-script-title" style={{ margin: 0, fontSize: '0.95rem' }}>☎ {CALL_SCRIPT_TITLE}</h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="lien-call-script-sub">
              {facts ? `${jobLabel ?? f.jobLabel} · GC ${f.gcName} · ${f.instrument === 'retainage_53_057' ? '§ 53.057 retainage notice' : '§ 53.056 notice'}${f.mailedOn ? ` mailed ${fmt.day(f.mailedOn)}` : ''}` : 'No job under you · the words still read'}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.75rem', fontSize: '0.8125rem' }}>
          {facts ? (
            <div data-testid="lien-call-script-letter" style={{ display: 'flex', gap: '0.3rem 0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={kicker}>The letter in their hand</span>
              <span>{callScriptLetterLine(f, fmt)}</span>
              {f.ownerName ? <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>owner: {f.ownerName}</span> : null}
              {!hasLetter ? <span style={{ color: 'var(--text-amber-800)' }}>{CALL_SCRIPT_NO_LETTER_WORDS}</span> : null}
            </div>
          ) : (
            <div data-testid="lien-call-script-no-job" style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{CALL_SCRIPT_NO_JOB_WORDS}</span>
              <button type="button" onClick={onFindJob} style={link} data-testid="lien-call-script-find">Find the job ›</button>
            </div>
          )}

          <div data-testid="lien-call-script-open" style={{ borderLeft: '3px solid var(--border-blue)', background: 'var(--bg-blue-tint)', padding: '0.5rem 0.75rem', borderRadius: '0 8px 8px 0', fontSize: '0.875rem', lineHeight: 1.55 }}>
            <span style={{ ...kicker, color: 'var(--text-blue-800)', display: 'block', marginBottom: 2 }}>1 · open · say</span>
            {opening}
          </div>

          <div>
            <span style={kicker}>They say…</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {openings.map((o) => (
                <button key={o.key} type="button" aria-pressed={picked === o.key} onClick={() => setPicked((p) => (p === o.key ? null : o.key))} data-lien-call-script-opening={o.key} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, border: `1px solid ${picked === o.key ? 'var(--border-blue)' : 'var(--border-strong)'}`, background: picked === o.key ? 'var(--bg-blue-tint)' : 'var(--surface)', color: picked === o.key ? 'var(--text-blue-800)' : 'var(--text-700)', cursor: 'pointer' }}>
                  {o.chip}
                </button>
              ))}
            </div>
          </div>

          {chosen ? (
            <div data-testid="lien-call-script-next" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: 4, fontSize: '0.85rem', lineHeight: 1.5 }}>
              <span style={kicker}>{chosen.words}</span>
              <span>{chosen.say}</span>
              {chosen.cites ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>{chosen.cites}</span> : null}
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hasLetter ? 'Record the call keeps their answers on the notice’s record, and counsel’s pile for the affidavit follows from them.' : 'Pick a job with a letter out to record what they said.'}</span>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasLetter ? (
              <>
                <button type="button" onClick={onRecord} data-testid="lien-call-script-record" style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '6px 14px', borderRadius: 8, border: '1px solid transparent', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
                  Record the call ›
                </button>
                <span>keeps their answers on the notice</span>
              </>
            ) : (
              <span>Nothing is written here.</span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="button" onClick={onPractice} style={link} data-testid="lien-call-script-practice">Take a practice call ›</button>
            <a href={helpGuideHref(GUIDE)} target="_blank" rel="noopener noreferrer" style={{ ...link, textDecoration: 'none' }}>Read the guide ↗</a>
          </span>
        </div>
      </div>
    </div>
  )
}

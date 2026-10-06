import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { callerIndex, callerTryWords, deskFindIsEmpty, findOnDesk, lettersOutNow, type CallerJobHit, type CallerMatchInput, type CallerOwnerHit } from '../../lib/jobs/lienCallerMatch'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { helpGuideHref } from '../../lib/helpGuideAnchors'

/**
 * ☎ Someone's calling (v2.3854, to-do #47): the door on the Lien desk header for whoever
 * answers the phone. Type what the caller gives you — a job number, a street, an owner, a GC —
 * and every job on the desk that fits lines up in two groups: a letter sent (one click opens the
 * call sheet) and nothing mailed yet (one click opens the job on the desk). Before anything is
 * typed the box shows words to try, the letters that are out, and a practice call (v2.4249).
 * Nothing is loaded for it: `findOnDesk` runs over the data the desk already has.
 */

const fmt = { day: formatYmdMonthDay, money: formatUsdNoCents }
const GUIDE = 'answer-an-owner-who-calls-about-a-lien-letter'

const group: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, margin: '10px 0 0', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const row: CSSProperties = { display: 'grid', gap: 2, textAlign: 'left', padding: '8px 6px', border: 'none', borderTop: '1px solid var(--border)', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', width: '100%' }
const sub: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const go: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }
const state = (sent: boolean): CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: sent ? 'var(--bg-green-tint)' : 'var(--bg-yellow-tint)', color: sent ? 'var(--text-green-800)' : 'var(--text-yellow-800)' })

/** The words that matched, marked where they sit in the text. */
function marked(text: string, used: string): ReactNode {
  const words = used.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return text
  const lower = text.toLowerCase()
  const cuts: Array<[number, number]> = []
  for (const w of words) {
    const at = lower.indexOf(w)
    if (at >= 0 && !cuts.some(([a, b]) => at < b && at + w.length > a)) cuts.push([at, at + w.length])
  }
  if (cuts.length === 0) return text
  cuts.sort((a, b) => a[0] - b[0])
  const out: ReactNode[] = []
  let pos = 0
  for (const [a, b] of cuts) {
    if (a > pos) out.push(text.slice(pos, a))
    out.push(<mark key={a} style={{ background: 'var(--bg-yellow-tint)', boxShadow: 'inset 0 -2px 0 var(--text-yellow-800)', color: 'inherit', padding: '0 1px', borderRadius: 2 }}>{text.slice(a, b)}</mark>)
    pos = b
  }
  if (pos < text.length) out.push(text.slice(pos))
  return out
}

export function LienCallerDoor({ input, onPick, onOpenJob, onPractice, style }: { input: CallerMatchInput | null; onPick: (hit: CallerOwnerHit) => void; onOpenJob: (hit: CallerJobHit) => void; onPractice: () => void; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLInputElement | null>(null)
  const index = useMemo(() => (open && input ? callerIndex(input, fmt) : null), [open, input])
  const found = useMemo(() => (index ? findOnDesk(q, index) : null), [index, q])
  const tryWords = useMemo(() => (index ? callerTryWords(index) : []), [index])
  const out = useMemo(() => (index ? lettersOutNow(index) : { hits: [], total: 0 }), [index])
  useEffect(() => {
    if (open) box.current?.focus()
  }, [open])
  /** A pick closes the box and clears the words, so the next caller starts from the empty box. */
  const done = () => {
    setOpen(false)
    setQ('')
  }
  const typed = q.trim()
  const searching = typed.length >= 2
  const none = searching && found != null && deskFindIsEmpty(found)
  const used = found?.used ?? ''

  const ownerRow = (h: CallerOwnerHit, mark: boolean) => (
    <button key={h.itemId} type="button" onClick={() => { done(); onPick(h) }} style={row} data-lien-caller-hit={h.jobId}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{mark ? marked(h.who, used) : h.who}</strong><span style={go}>Open the call sheet ›</span></span>
      <span style={sub}><span style={state(true)}>Sent {fmt.day(h.facts.mailedOn)}</span> · {mark ? marked(h.what, used) : h.what}</span>
    </button>
  )
  const practice = (
    <div style={{ marginTop: 10, padding: '9px 10px', border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} data-lien-caller-practice>
      <span style={{ display: 'grid' }}>
        <strong>New to this? Take a practice call.</strong>
        <span style={sub}>A made-up letter. Nothing is saved.</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => { done(); onPractice() }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid transparent', background: 'var(--text-link)', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ Practice call</button>
        <a href={helpGuideHref(GUIDE)} target="_blank" rel="noopener noreferrer" style={{ ...go, textDecoration: 'none' }}>How this works ↗</a>
      </span>
    </div>
  )

  return (
    <span style={{ position: 'relative', display: 'inline-flex', ...style }} data-lien-caller-door>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Someone’s calling" title="Someone’s calling — an owner is calling about a letter: find the job by its number, the street, the owner or the GC" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '2px 10px', borderRadius: 7, border: '1px solid transparent', background: 'var(--text-link)', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ☎
      </button>
      {open ? (
        <div role="dialog" aria-label="Find the caller" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, width: 'min(34rem, calc(100vw - 2rem))', maxHeight: 'min(34rem, calc(100vh - 9rem))', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 18px 40px -18px rgba(0, 0, 0, 0.6)', padding: '0.6rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Find</span>
            <input ref={box} value={q} onChange={(e) => setQ(e.target.value)} placeholder="a job number, a street, an owner or a GC…" aria-label="Find a job on the Lien desk" style={{ flex: 1, minWidth: 0, font: 'inherit', padding: '5px 9px', border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'inherit' }} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>×</button>
          </div>

          {!searching ? (
            <>
              {tryWords.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '8px 0 2px', fontSize: '0.75rem', color: 'var(--text-muted)' }} data-lien-caller-try>
                  Try:
                  {tryWords.map((t) => (
                    <button key={t.kind} type="button" onClick={() => { setQ(t.word); box.current?.focus() }} style={{ padding: '2px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.75rem', cursor: 'pointer' }} data-lien-caller-try-word={t.kind}>
                      {t.word} <span style={{ color: 'var(--text-muted)' }}>{t.kind}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={group}><span>Letters out now · {out.total}</span>{out.total > 1 ? <span>newest first</span> : null}</div>
              <div style={{ display: 'grid' }} data-lien-caller-out>
                {out.total === 0 ? <div style={{ padding: '8px 6px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>No letters are out right now, so no owner is holding one.</div> : null}
                {out.hits.map((h) => ownerRow(h, false))}
                {out.total > out.hits.length ? <div style={{ ...sub, padding: '6px' }}>+ {out.total - out.hits.length} more. Type a word to find one.</div> : null}
              </div>
              {practice}
            </>
          ) : null}

          {searching && found ? (
            <div style={{ display: 'grid' }}>
              {found.trimmed ? <div style={{ ...sub, fontSize: '0.72rem', margin: '5px 0 0' }} data-lien-caller-trimmed>Nothing has “{typed}” in it. Showing <strong style={{ color: 'var(--text-700)' }}>“{used}”</strong>.</div> : null}
              {none ? (
                <>
                  <div style={{ padding: '9px 4px', color: 'var(--text-muted)' }} data-lien-caller-none>No job on the Lien desk matches “{typed}”. The desk holds jobs with an unpaid balance and a lien deadline. For any other job, search the Pipeline.</div>
                  {practice}
                </>
              ) : null}
              {found.gcs.map((g) => (
                <div key={g.gcCustomerId} style={{ display: 'grid', gap: 2 }} data-lien-caller-gc={g.gcCustomerId}>
                  <div style={group}><span>GC · {marked(g.who, used)} · {g.jobs} {g.jobs === 1 ? 'job' : 'jobs'} on the desk</span></div>
                  <div style={{ ...sub, padding: '6px', borderTop: '1px solid var(--border)' }}>A GC’s own call goes to the master, not to the call sheet. Its jobs:</div>
                </div>
              ))}
              {found.sent.length > 0 ? (
                <>
                  <div style={group}><span>Letter sent · {found.sent.length + found.sentMore}</span></div>
                  {found.sent.map((h) => ownerRow(h, true))}
                  {found.sentMore > 0 ? <div style={{ ...sub, padding: '6px' }}>+ {found.sentMore} more. Add a word to narrow it.</div> : null}
                </>
              ) : null}
              {found.unsent.length > 0 ? (
                <>
                  <div style={group}><span>No letter mailed yet · {found.unsent.length + found.unsentMore}</span></div>
                  {found.unsent.map((h) => (
                    <button key={h.jobId} type="button" onClick={() => { done(); onOpenJob(h) }} style={row} data-lien-caller-job={h.jobId}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{marked(h.who, used)}</strong><span style={go}>Open the job ›</span></span>
                      <span style={sub}><span style={state(false)}>{h.pile}</span>{h.what ? <> · {marked(h.what, used)}</> : null}</span>
                    </button>
                  ))}
                  {found.unsentMore > 0 ? <div style={{ ...sub, padding: '6px' }}>+ {found.unsentMore} more. Add a word to narrow it.</div> : null}
                  <div style={{ ...sub, padding: '6px', borderTop: '1px solid var(--border)' }} data-lien-caller-unsent-note>
                    {found.unsent.length + found.unsentMore === 1 ? 'Nothing has been mailed on this job, so the caller is not holding a notice from us about it.' : 'Nothing has been mailed on these jobs, so the caller is not holding a notice from us about them.'}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  )
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { matchCaller, type CallerHit, type CallerMatchInput } from '../../lib/jobs/lienCallerMatch'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'

/**
 * ☎ Someone's calling (v2.3853, to-do #47): the door on the Lien desk header for whoever
 * answers the phone. Type what the caller gives you — their name, the street, the job number —
 * and the sent notices they could be holding line up; one click opens the call sheet on that
 * job. Nothing is loaded for it: `matchCaller` runs over the data the desk already has.
 */
export function LienCallerDoor({ input, onPick, style }: { input: CallerMatchInput | null; onPick: (hit: Extract<CallerHit, { kind: 'owner' }>) => void; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLInputElement | null>(null)
  const hits = useMemo(() => (open && input ? matchCaller(q, input, { day: formatYmdMonthDay }) : []), [open, input, q])
  useEffect(() => {
    if (open) box.current?.focus()
  }, [open])
  return (
    <span style={{ position: 'relative', display: 'inline-flex', ...style }} data-lien-caller-door>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="An owner is calling about a letter — find the notice they are holding" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '2px 10px', borderRadius: 7, border: '1px solid transparent', background: 'var(--text-link)', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ☎ Someone’s calling ›
      </button>
      {open ? (
        <div role="dialog" aria-label="Find the caller" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, width: 'min(34rem, calc(100vw - 2rem))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 18px 40px -18px rgba(0, 0, 0, 0.6)', padding: '0.6rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Who is calling?</span>
            <input ref={box} value={q} onChange={(e) => setQ(e.target.value)} placeholder="their name, the street, the job number…" aria-label="Who is calling?" style={{ flex: 1, font: 'inherit', padding: '5px 9px', border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'inherit' }} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Matches the notices already sent — the owner of record, the mailing address, the job’s address or number, the GC.</div>
          <div style={{ marginTop: 6, display: 'grid' }}>
            {q.trim().length >= 2 && hits.length === 0 ? <div style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>No sent notice matches “{q.trim()}”. Try the street alone, or the job number.</div> : null}
            {hits.map((h) =>
              h.kind === 'owner' ? (
                <button key={h.itemId} type="button" onClick={() => { setOpen(false); onPick(h) }} style={{ display: 'grid', gap: 2, textAlign: 'left', padding: '8px 6px', border: 'none', borderTop: '1px solid var(--border)', background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }} data-lien-caller-hit={h.jobId}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{h.who}</strong><span style={{ color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>Open the call sheet ›</span></span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{h.what}</span>
                </button>
              ) : (
                <div key={h.gcCustomerId} style={{ display: 'grid', gap: 2, padding: '8px 6px', borderTop: '1px solid var(--border)' }} data-lien-caller-gc={h.gcCustomerId}>
                  <strong>{h.who}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{h.what}</span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}
    </span>
  )
}

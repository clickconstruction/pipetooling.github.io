import { useEffect, useState } from 'react'
import type { DocsmitHeld, DocsmitPreparedEnvelope } from '../../lib/mail/runDocsmitIo'

/**
 * Review before it mails (the Docsmit train, PR 5b — `docs/DOCSMIT_LIEN_RUN_PLAN.md`, "Review before it mails"):
 * nothing goes to Docsmit until the office has seen each envelope the way Docsmit will mail it. One envelope at a
 * time: the face (the recipient as checked, in the window; the certified line; where Docsmit's label goes), the
 * PDF Docsmit holds, the price. The foot carries the price line against the balance, the envelopes held on paper,
 * and the one button that mails. Arrow keys walk the envelopes; Esc closes.
 */
type Props = {
  prepared: ReadonlyArray<DocsmitPreparedEnvelope>
  held: ReadonlyArray<DocsmitHeld>
  priceWords: string
  short: boolean
  low: boolean
  sendBy: { words: string; late: boolean } | null
  busy: boolean
  /** The send's outcome line once it ran; the button then reads Close. */
  outcome: string | null
  onMail: () => void
  onClose: () => void
}

export default function DocsmitReviewModal({ prepared, held, priceWords, short, low, sendBy, busy, outcome, onMail, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const env = prepared[Math.min(index, Math.max(0, prepared.length - 1))] ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setIndex((i) => Math.min(prepared.length - 1, i + 1))
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prepared.length])

  const money = (n: number | null) => (n == null ? 'not priced' : `$${n.toFixed(2)}`)

  return (
    <div role="dialog" aria-modal="true" aria-label="Review before it mails" data-testid="dsm-review" onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: 'min(1040px, calc(100vw - 2rem))', maxHeight: 'min(92vh, calc(100dvh - 2rem - var(--app-top-chrome, 0px)))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1.1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Review before it mails</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Each envelope as Docsmit will mail it. Nothing goes until you press the button at the foot.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the review" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>
        {sendBy ? (
          <div data-testid="dsm-send-by" style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem', background: sendBy.late ? 'var(--bg-red-tint))' : 'var(--bg-page)', color: sendBy.late ? 'var(--text-red-600)' : 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{sendBy.words}</div>
        ) : null}
        <div className="dsmMain" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: 0, flex: 1, minHeight: 0 }}>
          <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', minWidth: 0 }}>
            {prepared.map((p, i) => (
              <button key={p.key} type="button" onClick={() => setIndex(i)} data-testid={`dsm-env-${p.n}`} aria-current={i === index ? 'true' : undefined} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.55rem 0.8rem', border: 'none', borderBottom: '1px solid var(--border)', background: i === index ? 'var(--bg-page)' : 'transparent', color: 'var(--text)', cursor: 'pointer', font: 'inherit' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Envelope {p.n} · {p.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{p.who}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sheets} {p.sheets === 1 ? 'sheet' : 'sheets'} · {p.envelope ?? '—'} · {money(p.price)}</div>
              </button>
            ))}
            {held.map((h) => (
              <div key={h.key} data-testid={`dsm-held-${h.n}`} style={{ padding: '0.55rem 0.8rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-red-600)' }}>
                Envelope {h.n} stays on paper · {h.why}
              </div>
            ))}
          </div>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {env ? (
              <>
                <div data-testid="dsm-face" style={{ margin: '0.8rem 1rem 0', padding: '0.7rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem 1rem', fontSize: '0.8rem' }}>
                  <div style={{ color: 'var(--text-muted)' }}>{env.sendType}</div>
                  <div data-testid="dsm-label" style={{ border: '1px dashed var(--border-strong)', borderRadius: 4, padding: '0.2rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Docsmit’s label and USPS number go here</div>
                  <div style={{ gridColumn: '1 / -1', border: '1px dashed var(--border-strong)', borderRadius: 4, padding: '0.5rem 0.7rem', maxWidth: 360, lineHeight: 1.4, fontFamily: 'Helvetica Neue, Arial, sans-serif' }}>
                    {env.windowLines.map((l) => <div key={l}>{l}</div>)}
                  </div>
                  {env.correction ? <div data-testid="dsm-correction" style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>Address as Docsmit checked it: {env.correction}</div> : null}
                  <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>Code on the owner’s letter: <code>{env.shortCode}</code> · {money(env.price)}</div>
                </div>
                <iframe data-testid="dsm-pdf" title={`Envelope ${env.n} as Docsmit mails it`} src={env.pdfUrl} style={{ flex: 1, minHeight: 320, margin: '0.6rem 1rem 0.8rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }} />
              </>
            ) : (
              <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nothing is ready for Docsmit. {held.length ? 'Every certified envelope is held; the reasons are on the left.' : ''}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem 1rem', padding: '0.7rem 1.1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-page)' }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: '0.82rem' }}>
            <div data-testid="dsm-price" style={{ fontWeight: 600, color: short ? 'var(--text-red-600)' : low ? 'var(--text-amber-700, var(--text-amber-700))' : 'var(--text)' }}>{priceWords}</div>
            {outcome ? <div data-testid="dsm-outcome" style={{ marginTop: 2 }}>{outcome}</div> : null}
          </div>
          {outcome ? (
            <button type="button" onClick={onClose} data-testid="dsm-close" style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', font: 'inherit' }}>Close ▸</button>
          ) : (
            <button type="button" onClick={onMail} disabled={busy || prepared.length === 0 || short} data-testid="dsm-mail" style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid transparent', background: '#2563eb', color: '#fff', cursor: busy || prepared.length === 0 || short ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}>
              {busy ? 'Mailing…' : `Mail ${prepared.length === 1 ? 'this envelope' : `these ${prepared.length} envelopes`} ▸`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

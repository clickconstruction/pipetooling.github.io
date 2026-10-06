import { useEffect, useRef, type CSSProperties } from 'react'
import { lienPaperBannerWords, lienPaperFixButtonWords, lienPaperFixWindow, type LienPaperGap, type LienPaperKind } from '../../lib/jobs/lienPaperGaps'
import { stepRunPreview } from '../../lib/jobs/lienDeskRun'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * Do now — the paper behind a chip (v2.4632, the owner's ask). A layer over the desk: the
 * notice or the affidavit as it would print today, every statutory blank marked on the page
 * with a red number, and a rail beside it that lists the blanks by number with the button
 * that fills each. ‹ › and the arrow keys walk the rows; Esc closes this alone. The pages
 * come from the same builders that print the paper (`lienPaperGaps.ts` paints the marks), so
 * the preview can never differ from the paper.
 *
 * Fix it from the paper (v2.4719, Taunya's ask): with `onFix`, a property blank's button opens
 * the property record and the GC's opens the GC picker, each in a window stacked above this one
 * (`paused` while it is open, so its keys stay its own). When the window saves, the blanks it
 * filled come back as green cards with their values, and the paper marks the new words.
 */
export type LienPaperPreviewEntry = {
  key: string
  /** "838 · Bruce Hall" */
  title: string
  kind: LienPaperKind
  /** "In the mail by Oct 15 · 10 days left" */
  deadline: string
  /** The envelope line above a notice: who it goes to. Null for an affidavit. Each side may carry a painted gap. */
  envelope: { ownerHtml: string; gcHtml: string } | null
  /** The paper, marks painted. */
  html: string
  gaps: ReadonlyArray<LienPaperGap>
  /** The next step's words, for a whole paper. */
  next: string
  /** The row's own button, when a gap's fix is that rung. */
  button: string | null
  /** The blanks the last fix window filled, with what they read now (v2.4719). */
  filled?: ReadonlyArray<{ key: string; label: string; value: string }>
}

type Props = {
  entries: ReadonlyArray<LienPaperPreviewEntry>
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  /** The row's own act, from the rail's button; the overlay closes first. */
  onAct: (index: number) => void
  /** Fix a blank in a window stacked above (v2.4719); without it the rail keeps the row's own act. */
  onFix?: (index: number, gap: LienPaperGap) => void
  /** A fix window is open above: the keys are its own. */
  paused?: boolean
}

const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const railHead: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const navBtn = (disabled: boolean): CSSProperties => ({ padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.9rem', lineHeight: 1.2, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 })
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css), as on the desk. */
const paperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: '1.1rem 1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.9rem', lineHeight: 1.6 }
const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }

export default function LienPaperPreviewOverlay({ entries, index, onIndex, onClose, onAct, onFix, paused = false }: Props) {
  const isMobile = useIsMobile()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const total = entries.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const entry = entries[safeIndex]

  // Esc closes only the preview; the arrows walk the rows. Capture, so the desk underneath never sees the key.
  useEffect(() => {
    if (paused) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.stopPropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      else onIndex(stepRunPreview(safeIndex, e.key === 'ArrowRight' ? 1 : -1, total))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, onIndex, safeIndex, total, paused])
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [safeIndex])

  if (!entry) return null
  const banner = lienPaperBannerWords(entry.kind, entry.gaps, entry.next, entry.deadline)
  const paperWord = entry.kind === 'affidavit' ? 'affidavit' : 'notice'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The paper as it stands"
      data-testid="lien-paper-preview"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 795 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(960px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} data-testid="lien-paper-preview-title">
            {entry.title} · {entry.kind === 'affidavit' ? 'Affidavit' : 'Notice'}
          </h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
            <button type="button" aria-label="Previous row" disabled={safeIndex === 0} onClick={() => onIndex(stepRunPreview(safeIndex, -1, total))} style={navBtn(safeIndex === 0)}>‹</button>
            <span data-testid="lien-paper-preview-count">{safeIndex + 1} of {total}</span>
            <button type="button" aria-label="Next row" disabled={safeIndex >= total - 1} onClick={() => onIndex(stepRunPreview(safeIndex, 1, total))} style={navBtn(safeIndex >= total - 1)}>›</button>
            <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div
          data-testid="lien-paper-preview-banner"
          data-tone={banner.tone}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.875rem', background: banner.tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-green-tint)', color: banner.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-green-800)', borderBottom: '1px solid var(--border)' }}
        >
          <span aria-hidden style={{ fontSize: '1.05rem' }}>{banner.tone === 'red' ? '⚠' : '✓'}</span>
          <span>{banner.words}</span>
        </div>
        <div ref={scrollRef} style={{ overflow: 'auto', minHeight: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 250px', gap: '0.85rem', padding: isMobile ? '0.6rem' : '0.85rem', background: 'var(--bg-muted)', alignItems: 'start' }}>
          <div data-theme="light" style={paperStyle}>
            {entry.envelope ? (
              <div data-testid="lien-paper-preview-envelope" style={{ border: '1px dashed var(--border-strong)', borderRadius: 4, padding: '0.45rem 0.65rem', marginBottom: '0.8rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                <span style={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.66rem' }}>Envelope</span>
                {' · owner of record: '}
                <span style={{ color: 'var(--text-strong)', fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: entry.envelope.ownerHtml }} />
                {' · original contractor: '}
                <span style={{ color: 'var(--text-strong)', fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: entry.envelope.gcHtml }} />
              </div>
            ) : null}
            <div data-testid="lien-paper-preview-paper" dangerouslySetInnerHTML={{ __html: entry.html }} />
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
            {entry.filled?.length ? (
              <>
                <div style={railHead}>Just filled</div>
                {entry.filled.map((f) => (
                  <div key={f.key} data-testid="lien-paper-preview-filled" style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start', padding: '0.5rem 0.65rem', border: '1px solid var(--border-green)', borderRadius: 8, background: 'var(--bg-green-tint)' }}>
                    <span aria-hidden style={{ background: '#15803d', color: '#fff', borderRadius: 999, width: 18, height: 18, display: 'inline-grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 800 }}>✓</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600 }}>{f.label}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-green-800)', overflowWrap: 'anywhere' }}>{f.value}</span>
                    </span>
                  </div>
                ))}
              </>
            ) : null}
            {entry.gaps.length ? (
              <>
                <div style={railHead}>What is missing</div>
                {entry.gaps.map((g) => (
                  <div key={g.n} data-testid="lien-paper-preview-gap" style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, alignItems: 'start', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)' }}>
                    <span aria-hidden style={{ background: '#dc2626', color: '#fff', borderRadius: 999, width: 18, height: 18, display: 'inline-grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 800 }}>{g.n}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600 }}>{g.label}</span>
                      <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{g.why}</span>
                      {onFix && lienPaperFixWindow(g) ? (
                        <button type="button" data-testid="lien-paper-preview-fix" onClick={() => onFix(safeIndex, g)} style={{ marginTop: 6, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' }}>
                          {lienPaperFixButtonWords(g)}
                        </button>
                      ) : entry.button && (g.fix === 'find_owner' || g.fix === 'fix_property') ? (
                        <button type="button" data-testid="lien-paper-preview-fix" onClick={() => onAct(safeIndex)} style={{ marginTop: 6, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' }}>
                          {entry.button}
                        </button>
                      ) : (
                        <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>{g.fixWords}</span>
                      )}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={railHead}>Nothing missing</div>
                <div style={{ padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-green-tint)', fontSize: '0.8rem', color: 'var(--text-green-800)' }}>Every line is filled. The next step is {entry.next}.</div>
              </>
            )}
            <div style={{ ...railHead, marginTop: 6 }}>Filled from the job</div>
            <div style={{ padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{onFix ? 'The claim, the months and the signer read from the job.' : 'The claim, the months, the GC and the signer read from the job.'} Change them at their source and the paper follows.</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', ...faint }}>
          <span>{onFix ? `The ${paperWord} as it would ${entry.kind === 'affidavit' ? 'file' : 'print'} today. Fix a blank and the paper follows.` : `Read-only: the ${paperWord} as it would ${entry.kind === 'affidavit' ? 'file' : 'print'} today, from the desk as it stands.`}</span>
          {isMobile ? null : <span><span style={kbd}>←</span> <span style={kbd}>→</span> next row · <span style={kbd}>Esc</span> back to the desk</span>}
        </div>
      </div>
    </div>
  )
}

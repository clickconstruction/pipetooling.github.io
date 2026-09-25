import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { filingDocHtml } from '../../lib/jobsDocuments/lienFilingDocuments'
import { daysUntil, type GcNoticeJob } from '../../lib/jobs/gcOnNotice'
import { daysLeftWords } from '../../lib/jobs/gcOnNoticeSteps'
import { buildGcNoticePreview, gcNoticeCopyLine, gcNoticePageLabel, stepGcNoticePreview, type GcNoticePreviewCopy, type GcNoticePreviewInput } from '../../lib/jobs/gcNoticePreview'
import { useNoticePayPage } from '../../hooks/useNoticePayPage'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * Put a GC on notice — read a notice before approving it (v2.3668).
 *
 * A layer over the window (which stays mounted underneath: its scroll, the
 * letter being edited and the ticks are untouched). One notice per job; ‹ ›
 * and the arrow keys walk the run without closing, Esc closes only this.
 * Owner's copy is the cover page then the § 53.056 form; the GC's copy is the
 * form alone. Read-only — the letter is edited once in Step 3, per-notice
 * wording on the Lien desk. The pages come from `buildGcNoticePreview`.
 */
export type GcNoticePreviewEntry = {
  job: GcNoticeJob
  /** Everything the kernel needs except Step 3's live letter, which the modal passes for all. */
  input: Omit<GcNoticePreviewInput, 'includeLetter' | 'letter'>
  /** "Erik Halvorsen · mail to 3203 Spider Lily…" — empty while Step 1 has not found the owner. */
  ownerLine: string
}

type Props = {
  entries: ReadonlyArray<GcNoticePreviewEntry>
  index: number
  /** The month that was clicked, ringed in the side list. */
  month: string | null
  gcName: string
  gcAddress: string
  includeLetter: boolean
  /** Step 3's live letter for this entry's property (v2.3745: one per kind, or the unresponsive letter for all). */
  letterFor: (job: GcNoticeJob) => string
  todayYmd: string
  onIndex: (index: number) => void
  onClose: () => void
  /** "Edit it in Step 3 ›" — closes the preview and scrolls the window to the letter. */
  onEditLetter: () => void
}

/** Literal fill: a white label sits on it in both themes (v2.3656). */
const PICKED_FILL = '#2563eb'
const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const railHead: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }
const navBtn = (disabled: boolean): CSSProperties => ({ padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 })
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css), as on the desk. */
const paperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: '1.1rem 1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }
const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }

export default function GcNoticePreviewModal({ entries, index, month, gcName, gcAddress, includeLetter, letterFor, todayYmd, onIndex, onClose, onEditLetter }: Props) {
  const isMobile = useIsMobile()
  const [copy, setCopy] = useState<GcNoticePreviewCopy>('owner')
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const paperScrollRef = useRef<HTMLDivElement | null>(null)
  const total = entries.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const entry = entries[safeIndex]

  // The pay page (punch list #35, PR 3): the job's unpaid bills, fetched once per job as the previews are walked.
  const pay = useNoticePayPage(entry?.job.jobId ?? null)
  const preview = useMemo(
    () => (entry ? buildGcNoticePreview({ ...entry.input, includeLetter, letter: letterFor(entry.job), pay: pay.rows.length ? { rows: pay.rows, assets: pay.assets } : undefined }) : null),
    [entry, includeLetter, letterFor, pay],
  )
  const pages = useMemo(() => (preview ? preview.pages[copy].map((pg) => ({ ...pg, html: filingDocHtml(pg.blocks) })) : []), [preview, copy])

  // Esc closes only the preview; the arrows walk the run. Capture, so the window underneath never sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = e.target as HTMLElement | null
      if (e.key !== 'Escape' && el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.stopPropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      else onIndex(stepGcNoticePreview(safeIndex, e.key === 'ArrowRight' ? 1 : -1, total))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, onIndex, safeIndex, total])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  // A new notice starts at its first page.
  useEffect(() => {
    if (paperScrollRef.current) paperScrollRef.current.scrollTop = 0
  }, [safeIndex, copy])

  if (!entry || !preview) return null
  const { job } = entry
  const toLine = copy === 'owner' ? entry.ownerLine : [gcName, gcAddress.trim() ? `mail to ${gcAddress.trim()}` : ''].filter(Boolean).join(' · ')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notice preview"
      data-testid="gc-notice-preview"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 95 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(920px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '0.95rem' }}>{entry.input.label}</h2>
            <div style={faint} data-testid="gc-notice-preview-to">
              {toLine ? <>To <span style={{ color: 'var(--text-700)', fontWeight: 600 }}>{toLine}</span></> : <span style={{ color: 'var(--text-amber-800)' }}>No owner of record on the job yet — Step 1 finds one before this can go.</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
            <button type="button" aria-label="Previous notice" disabled={safeIndex === 0} onClick={() => onIndex(stepGcNoticePreview(safeIndex, -1, total))} style={navBtn(safeIndex === 0)}>‹</button>
            <span data-testid="gc-notice-preview-count">{safeIndex + 1} of {total}</span>
            <button type="button" aria-label="Next notice" disabled={safeIndex >= total - 1} onClick={() => onIndex(stepGcNoticePreview(safeIndex, 1, total))} style={navBtn(safeIndex >= total - 1)}>›</button>
            <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem 1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <span role="group" aria-label="Whose copy" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden' }}>
            {([['owner', "Owner's copy"], ['original_contractor', "GC's copy"]] as const).map(([k, label], i) => (
              <button key={k} type="button" aria-pressed={copy === k} onClick={() => setCopy(k)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', border: 'none', borderLeft: i ? '1px solid var(--border-strong)' : 'none', background: copy === k ? PICKED_FILL : 'var(--surface)', color: copy === k ? '#fff' : 'var(--text-700)', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </span>
          <span style={faint} data-testid="gc-notice-preview-copy-line">
            {gcNoticeCopyLine(copy, preview, job.isBilled)}
          </span>
        </div>

        <div ref={paperScrollRef} style={{ overflow: 'auto', minHeight: 0, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 220px', gap: '0.85rem', padding: '0.85rem', background: 'var(--bg-muted)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
            {pages.map((pg, i) => (
              <div key={pg.key} style={{ display: 'grid', gap: 4 }}>
                <div style={{ ...railHead, marginBottom: 0 }} data-testid="gc-notice-preview-page-label">{gcNoticePageLabel(i, pages.length, pg.label)}</div>
                <div data-theme="light" data-gc-notice-preview-paper={pg.key} style={paperStyle}>
                  <div dangerouslySetInnerHTML={{ __html: pg.html }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: '0.85rem', alignContent: 'start', fontSize: '0.75rem', color: 'var(--text-700)' }}>
            <div>
              <div style={railHead}>Months this notice names</div>
              {job.months.map((m) => {
                const d = m.closed ? null : daysUntil(m.deadline || null, todayYmd)
                const on = month === m.key
                return (
                  <div key={m.key} data-testid="gc-notice-preview-month" data-on={on ? 'yes' : 'no'} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 6px', borderRadius: 5, color: m.closed ? 'var(--text-muted)' : d != null && d <= 7 ? 'var(--text-red-600)' : undefined, background: on ? 'var(--bg-blue-tint)' : undefined, boxShadow: on ? `0 0 0 2px ${PICKED_FILL}` : undefined }}>
                    <strong>{workMonthShort(m.key)}</strong>
                    <span>{m.closed ? 'window closed' : m.deadline ? `by ${formatYmdMonthDay(m.deadline)}${d != null ? ` · ${daysLeftWords(d)}` : ''}` : ''}</span>
                  </div>
                )
              })}
              <div style={{ ...faint, marginTop: 4 }}>One notice per job. The form claims the open months; a closed month's dollars are named in the letter only.</div>
            </div>
            <div>
              <div style={railHead}>Claim</div>
              <strong style={{ fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }} data-testid="gc-notice-preview-claim">{formatUsdNoCents(job.timelyClaim)}</strong>
              {job.staleClaim > 0 ? <div style={faint}>+ {formatUsdNoCents(job.staleClaim)} for the closed months, in the letter only</div> : null}
              <div style={faint}>{job.isBilled ? 'open on bills' : 'unbilled · contract balance'}{job.affidavitBy ? ` · affidavit by ${formatYmdMonthDay(job.affidavitBy)}` : ''}</div>
            </div>
            <div style={faint}>
              The letter is one per property kind, for all {total}.{' '}
              <button type="button" onClick={onEditLetter} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-link)' }}>Edit it in Step 3 ›</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', ...faint }}>
          <span>Read-only — what the run prints, from the window as it stands now.</span>
          <span><span style={kbd}>←</span> <span style={kbd}>→</span> next notice · <span style={kbd}>Esc</span> back to the window</span>
        </div>
      </div>
    </div>
  )
}

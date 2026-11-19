import { useId, useState, type CSSProperties } from 'react'
import { lienBinFoldLine } from '../../lib/jobs/lienBinFold'
import type { LienPublicBin, LienPublicBoardLine } from '../../lib/jobs/lienPublicProperty'
import { LienBinFoldHeader } from './LienBinFoldHeader'

/**
 * The Board's two parts for public property (v2.7443, Taunya's ask of 2026-11-16, the second drawing, parts 2 and 4).
 * The words are `lienPublicProperty.ts`; the desk owns the windows these open.
 */

const link: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem' }

/**
 * For the ones already in: one amber line over the bins while a job on a property that reads as public, unanswered,
 * still has a lien paper open. *Review them ›* opens the window for each property in turn.
 */
export function LienPublicBoardLineView({ line, isMobile, onReview }: { line: LienPublicBoardLine; isMobile: boolean; onReview: (() => void) | null }) {
  return (
    <div data-lien-public-board-line role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', padding: isMobile ? '0.55rem 0.7rem' : '0.5rem 0.8rem', border: '1px solid var(--border-amber)', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', fontWeight: 600 }}>
      <span aria-hidden="true">⊘</span>
      <span style={{ flex: '1 1 14rem', minWidth: 0 }}>{line.words}</span>
      {onReview ? (
        <button type="button" data-lien-public-review onClick={onReview} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '3px 12px', minHeight: isMobile ? 40 : undefined, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {line.action}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Afterwards: the bin is named for what to do next. *Public jobs · bond claim* with the money still owed, each job with
 * its GC, what went out and where it stands with the attorney, and *get the bond* while nobody knows if there is one.
 * *Put a job back on the lien path…* asks which job when the bin holds more than one property.
 *
 * The box opens folded to its header (punch list #390, part 1): the header counts the jobs and the rows that still
 * need the bond, and a press on it opens the rows. The fold lasts while the Board is drawn and is never stored.
 */
export function LienPublicBinView({ bin, isMobile, onPutBack }: { bin: LienPublicBin; isMobile: boolean; onPutBack: ((addressId: string) => void) | null }) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const bodyId = useId()
  const fold = lienBinFoldLine(bin)
  const padX = isMobile ? '0.7rem' : '0.85rem'
  // Folding the box also drops a half-made pick of which job to put back.
  const toggle = () => {
    setOpen((v) => !v)
    setChoosing(false)
  }
  const properties = [...new Set(bin.rows.map((r) => r.addressId))]
  const startPutBack = () => {
    if (!onPutBack) return
    if (properties.length === 1 && properties[0]) onPutBack(properties[0])
    else setChoosing((v) => !v)
  }
  return (
    <section data-lien-public-bin aria-label={bin.title} style={{ display: 'grid', gap: 0, border: '1px dashed var(--border-strong)', borderRadius: 9, background: 'var(--surface)' }}>
      <LienBinFoldHeader title={bin.title} words={fold.words} ask={fold.ask} open={open} onToggle={toggle} isMobile={isMobile} controls={bodyId} />
      {open ? (
        <div id={bodyId} data-lien-public-bin-body style={{ display: 'grid', gap: 0, padding: `0 ${padX} ${isMobile ? '0.55rem' : '0.6rem'}` }}>
          {bin.rows.map((r) => (
            <div key={r.jobId} data-lien-public-bin-row={r.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 0.75rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</strong>
                {r.chip ? (
                  <span data-lien-public-bin-chip style={{ padding: '0 7px', borderRadius: 5, fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
                    {r.chip}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{r.unpaidWords}</span>
              <span data-lien-public-bin-line style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.line}</span>
              {choosing && onPutBack ? (
                <span style={{ gridColumn: '1 / -1' }}>
                  <button type="button" data-lien-public-bin-back={r.jobId} style={link} onClick={() => onPutBack(r.addressId)}>
                    Put {r.label.split(' · ')[0]} back…
                  </button>
                </span>
              ) : null}
            </div>
          ))}
          {onPutBack ? (
            <div style={{ paddingTop: '0.45rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" data-lien-public-bin-put-back style={{ ...link, minHeight: isMobile ? 40 : undefined }} onClick={startPutBack}>
                {choosing ? 'Pick the job to put back' : bin.backLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

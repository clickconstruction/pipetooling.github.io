import type { CSSProperties } from 'react'
import type { LienOffPathBin } from '../../lib/jobs/lienOffPathBin'

/**
 * The Board's bin for the jobs a person took off the lien path (the *not lienable* train, PR 3; the owner's pick of
 * 2026-11-16). The words are `lienOffPathBin.ts`; the desk owns the window a row's press opens.
 *
 * The bin is the state of things for these jobs: each row says the job, what it still owes, who took it off, the day,
 * where it stands with the attorney, and the reason in the person's own words. *Put it back…* is on every row, since
 * each job left for a reason of its own.
 */

const link: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem' }

export function LienOffPathBinView({ bin, isMobile, onOpenJob, onPutBack }: { bin: LienOffPathBin; isMobile: boolean; onOpenJob?: ((jobId: string) => void) | null; onPutBack: ((jobId: string) => void) | null }) {
  return (
    <section data-lien-off-path-bin aria-label={bin.title} style={{ display: 'grid', gap: 0, padding: isMobile ? '0.55rem 0.7rem' : '0.6rem 0.85rem', border: '1px dashed var(--border-strong)', borderRadius: 9, background: 'var(--surface)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', paddingBottom: '0.4rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>{bin.title}</h4>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{bin.totalWords}</span>
        <span data-lien-off-path-bin-count style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{bin.count}</span>
      </header>
      {bin.rows.map((r) => (
        <div key={r.jobId} data-lien-off-path-bin-row={r.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 0.75rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }}>
          {onOpenJob ? (
            <button type="button" data-lien-off-path-bin-open={r.jobId} title="Opens the job" onClick={() => onOpenJob(r.jobId)} style={{ ...link, color: 'var(--text-strong)', fontWeight: 700, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: isMobile ? 40 : undefined }}>
              {r.label}
            </button>
          ) : (
            <strong style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</strong>
          )}
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{r.unpaidWords}</span>
          <span data-lien-off-path-bin-line style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.line}</span>
          <span data-lien-off-path-bin-reason style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--text-700)' }}>{r.reason}</span>
          {onPutBack ? (
            <span style={{ gridColumn: '1 / -1' }}>
              <button type="button" data-lien-off-path-bin-back={r.jobId} style={{ ...link, minHeight: isMobile ? 40 : undefined }} onClick={() => onPutBack(r.jobId)}>
                {bin.backLabel}
              </button>
            </span>
          ) : null}
        </div>
      ))}
    </section>
  )
}

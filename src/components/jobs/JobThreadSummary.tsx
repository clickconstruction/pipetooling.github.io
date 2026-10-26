import { useState, type CSSProperties } from 'react'
import { SUMMARY_WORDS, keepFolded, readFolded, type ThreadSummary } from '../../lib/jobs/threadSummary'

/**
 * Where it stands with the customer (punch list #186, item 2A, v2.5895): the card at the top of the job window's Job
 * tab. Three lines from `buildThreadSummary`, each with a door to the line it came from, the stamp, Read again and
 * Keep as a note. Folded per browser (`readFolded`). Draws only; the window reads and writes.
 */
export function JobThreadSummary({
  customerName,
  summary,
  loading,
  failed,
  onReadAgain,
  onKeep,
  keeping,
  kept,
  onOpenLine,
}: {
  customerName: string
  /** Null until the first read lands. */
  summary: ThreadSummary | null
  loading: boolean
  failed: boolean
  onReadAgain: () => void
  /** Keep as a note; undefined when the viewer cannot write a note on the job. */
  onKeep?: () => void
  keeping: boolean
  /** True once this card's lines were kept, until the next read. */
  kept: boolean
  /** A door's press: the line's thread, opened at the line. */
  onOpenLine: (href: string) => void
}) {
  const [folded, setFolded] = useState(() => readFolded())
  const toggle = () => {
    setFolded((f) => {
      keepFolded(!f)
      return !f
    })
  }
  const title = SUMMARY_WORDS.title(customerName)
  const headLine = summary && folded ? (summary.lines[0]?.text ?? null) : null
  return (
    <section
      data-testid="job-thread-summary"
      aria-label={title}
      style={{ border: '1px solid var(--border-blue-soft, var(--border))', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '8px 12px', marginBottom: '0.75rem', display: 'grid', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!folded}
          aria-label={folded ? `${SUMMARY_WORDS.unfold} ${title}` : `${SUMMARY_WORDS.fold} ${title}`}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-blue-700)', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span aria-hidden>{folded ? '▶' : '▼'}</span>
          {title}
        </button>
        {headLine ? <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headLine}</span> : null}
        {loading ? <span style={{ marginLeft: 'auto', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{SUMMARY_WORDS.reading}</span> : null}
      </div>
      {!folded ? (
        <>
          {summary ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {summary.lines.map((l) => (
                <div key={l.key} data-testid={`job-thread-summary-${l.key}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(84px, 112px) 1fr auto', gap: 8, alignItems: 'baseline', fontSize: '0.84rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.76rem', color: 'var(--text-secondary, var(--text-muted))' }}>{l.label}</span>
                  <span style={{ color: 'var(--text-strong)' }}>{l.text}</span>
                  {l.href ? (
                    <button
                      type="button"
                      onClick={() => onOpenLine(l.href as string)}
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.76rem', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {l.doorWord} ›
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          ) : failed ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-amber-800)' }}>{SUMMARY_WORDS.failed}</p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{SUMMARY_WORDS.reading}</p>
          )}
          {summary ? (
            <p style={{ margin: 0, fontSize: '0.74rem', fontStyle: 'italic', color: 'var(--text-muted)' }} data-testid="job-thread-summary-stamp">
              {summary.stamp}
              {failed ? ` ${SUMMARY_WORDS.failed}` : ''}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={onReadAgain} disabled={loading} style={smallBtn}>
              {SUMMARY_WORDS.readAgain}
            </button>
            {onKeep ? (
              <button type="button" onClick={onKeep} disabled={!summary || keeping || kept} style={smallBtn}>
                {keeping ? SUMMARY_WORDS.keeping : SUMMARY_WORDS.keep}
              </button>
            ) : null}
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{kept ? SUMMARY_WORDS.kept : SUMMARY_WORDS.quiet}</span>
          </div>
        </>
      ) : null}
    </section>
  )
}

const smallBtn: CSSProperties = {
  padding: '3px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontSize: '0.76rem',
  fontWeight: 600,
  cursor: 'pointer',
}

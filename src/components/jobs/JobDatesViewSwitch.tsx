import { setJobDatesView, useJobDatesView, type JobDatesView } from '../../hooks/useJobDatesView'

/**
 * The *Dates · Words | Track* switch (v2.6139, punch list #217): a small segmented control that
 * sits where a job's dates are drawn — on a Billed row's dates block and on the Job tab — and
 * flips both surfaces at once (`useJobDatesView`). The same shape as the lien strip's Steps ·
 * Windows switch, at the size of the block it sits on.
 */
export default function JobDatesViewSwitch({ size = 'row' }: { /** `row` is the Pipeline cell's size; `tab` the Job tab's. */ size?: 'row' | 'tab' }) {
  const view = useJobDatesView()
  const small = size === 'row'
  const btn = (v: JobDatesView, label: string, title: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      data-job-dates-view={v}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        setJobDatesView(v)
      }}
      style={{
        padding: small ? '0 6px' : '1px 9px',
        border: 'none',
        background: view === v ? 'var(--text-link)' : 'var(--surface)',
        color: view === v ? '#fff' : 'var(--text-700)',
        fontSize: small ? '0.625rem' : '0.7rem',
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: small ? '15px' : '18px',
        font: undefined,
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: small ? '0.625rem' : '0.7rem', color: 'var(--text-muted)' }}>Dates</span>
      <div role="group" aria-label="Dates view" data-testid="job-dates-view-switch" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
        {btn('words', 'Words', 'The dates as lines of words, the way they read today')}
        {btn('track', 'Track', 'The dates drawn against today — remembered on this device, on the Pipeline and in the job window alike')}
      </div>
    </div>
  )
}

import { QUICKFILL_VIEWS, type QuickfillView } from '../../lib/quickfill/views'

/**
 * The view switch beside the Quickfill title (punch list #147, v2.5778): one button per
 * view, the chosen one filled, remembered per person by the page.
 */
export function QuickfillViewSwitch({ view, onChange }: { view: QuickfillView; onChange: (view: QuickfillView) => void }) {
  return (
    <div role="group" aria-label="How the page is laid out" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden', background: 'var(--surface)' }}>
      {QUICKFILL_VIEWS.map((v) => {
        const on = v.view === view
        return (
          <button
            key={v.view}
            type="button"
            aria-pressed={on}
            title={v.title}
            onClick={() => onChange(v.view)}
            style={{
              border: 'none',
              padding: '0.3rem 0.8rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: on ? 'var(--text-link)' : 'transparent',
              color: on ? 'var(--surface)' : 'var(--text-700)',
            }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

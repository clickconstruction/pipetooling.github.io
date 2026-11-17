/**
 * The Plans look's two views, By part and By date (punch list #367), as the switch at the right of the card's head.
 * Its own file since the first look at the live page: on a phone-width window the switch is the head's only right-hand
 * piece, so it shrinks to its content, and with two equal halves the label *By date* wrapped onto a second line. The
 * labels never wrap now, and each button is as wide as its words, on a phone and a desktop alike.
 */
import type { PlansView } from '../../lib/developments/devicePrefs'

const VIEWS: ReadonlyArray<{ view: PlansView; label: string; title: string }> = [
  { view: 'part', label: 'By part', title: 'Each part of the site with the set it builds from' },
  { view: 'date', label: 'By date', title: 'Every set on the date on its sheets, with the bids, the crews’ days and the History lines on one axis' },
]

export function PlansViewSwitch({ view, onChange, phone }: { view: PlansView; onChange: (view: PlansView) => void; phone: boolean }) {
  return (
    <span role="group" aria-label="Plans views" data-testid="plans-views" style={{ display: 'inline-flex', flex: 'none', gap: 2, padding: 2, border: '1px solid var(--border)', borderRadius: 9999, background: 'var(--bg-subtle)' }}>
      {VIEWS.map((v) => {
        const on = view === v.view
        return (
          <button
            key={v.view}
            type="button"
            onClick={() => onChange(v.view)}
            aria-pressed={on}
            title={v.title}
            data-testid={`plans-view-${v.view}`}
            style={{
              border: `1px solid ${on ? 'var(--border-strong)' : 'transparent'}`,
              borderRadius: 9999,
              padding: phone ? '3px 10px' : '1px 10px',
              font: 'inherit',
              fontSize: '0.76rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--text-strong)' : 'var(--text-700)',
              fontWeight: on ? 700 : 500,
            }}
          >
            {v.label}
          </button>
        )
      })}
    </span>
  )
}

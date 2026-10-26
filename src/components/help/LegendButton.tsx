/**
 * The ? at the end of a desk's top bar (punch list #187, PR 3): the Messages bar's button made
 * general. A press opens the desk's card and writes one `legend_opened` row, so the Usage readout
 * says which ? are pressed. A blue dot sits on it until the person has pressed it once, kept per
 * person through the dismissal store, the one hint a first-timer gets that the card is there.
 */
import { useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LEGEND_OPENED_CONTROL, LEGEND_WORDS, legendOpenedTarget, type DeskLegend } from '../../lib/help/deskLegend'
import { markLegendPressed, readLegendPressed } from '../../lib/help/legendPressed'
import { recordNavClick } from '../../lib/navClickTelemetry'

const button = (on: boolean): CSSProperties => ({
  position: 'relative',
  width: 26,
  height: 26,
  flex: 'none',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-500)' : 'var(--text-700)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  fontWeight: 700,
  fontSize: '0.85rem',
  lineHeight: 1,
})

const dot: CSSProperties = { position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: 'var(--text-blue-500)', border: '2px solid var(--surface)' }

export function LegendButton({ legend, open, onToggle, style }: { legend: DeskLegend; open: boolean; onToggle: (open: boolean) => void; style?: CSSProperties }) {
  const { user, role } = useAuth()
  const [pressed, setPressed] = useState(() => readLegendPressed(user?.id, legend.key))
  const press = () => {
    const next = !open
    if (next) {
      recordNavClick(user?.id, role, LEGEND_OPENED_CONTROL, legendOpenedTarget(legend.key))
      if (!pressed) {
        markLegendPressed(user?.id, legend.key)
        setPressed(true)
      }
    }
    onToggle(next)
  }
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-expanded={open}
      aria-label={legend.label}
      title={open ? LEGEND_WORDS.closeTip : pressed ? LEGEND_WORDS.tip : LEGEND_WORDS.firstTip}
      onClick={press}
      data-testid={`legend-button-${legend.key}`}
      style={{ ...button(open), ...style }}
    >
      {LEGEND_WORDS.button}
      {!pressed && !open ? <span aria-hidden data-testid={`legend-dot-${legend.key}`} style={dot} /> : null}
    </button>
  )
}

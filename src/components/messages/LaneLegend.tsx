/**
 * What each lane holds (punch list #151 PR 3, v2.5802): the card behind the ? on Messages' bar, under it. The six lanes
 * in the strip's order with the sentence each heading printed under its name until this PR. Rows and words:
 * `lib/messages/laneLegend.ts`.
 */
import type { CSSProperties } from 'react'
import { laneLegend, LEGEND_WORDS } from '../../lib/messages/laneLegend'
import { JUMP_LANE_COLOR } from '../../lib/messages/jumpStrip'

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', background: 'var(--surface)', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.75rem', rowGap: '0.35rem', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-700)' }
const close: CSSProperties = { gridColumn: '1 / -1', justifySelf: 'end', border: 0, background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer', padding: 0 }

export function LaneLegend({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label={LEGEND_WORDS.label} data-testid="lane-legend" style={card}>
      {laneLegend().map((r) => (
        <div key={r.key} style={{ display: 'contents' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', borderLeft: `3px solid ${JUMP_LANE_COLOR[r.key]}`, paddingLeft: '0.5rem' }}>{r.label}</span>
          <span>{r.note}</span>
        </div>
      ))}
      <button type="button" onClick={onClose} title={LEGEND_WORDS.closeTip} style={close}>
        {LEGEND_WORDS.close}
      </button>
    </section>
  )
}

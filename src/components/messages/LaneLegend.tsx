/**
 * What each lane holds (punch list #151 PR 3, v2.5802): the card behind the ? on Messages' bar, under it. The six lanes
 * in the strip's order with the sentence each heading printed under its name until this PR. Rows and words:
 * `lib/messages/laneLegend.ts`. Since punch list #187's PR 3 the card is `LegendCard`, the same card every desk's ? opens,
 * with the lanes' colors as its stripes and no door: the page is its own guide.
 */
import { LegendCard } from '../help/LegendCard'
import { laneLegend, LEGEND_WORDS } from '../../lib/messages/laneLegend'
import { JUMP_LANE_COLOR } from '../../lib/messages/jumpStrip'

export function LaneLegend({ onClose }: { onClose: () => void }) {
  return <LegendCard rows={laneLegend().map((r) => ({ key: r.key, label: r.label, note: r.note, accent: JUMP_LANE_COLOR[r.key] }))} label={LEGEND_WORDS.label} onClose={onClose} testId="lane-legend" />
}

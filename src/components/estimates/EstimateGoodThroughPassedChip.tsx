/**
 * The Pipeline's good-through-passed chip (v2.6037, punch list #206's follow-up): a red pill on a
 * sent row whose good-through day is behind us, reading *good through passed · extend?*. It is a
 * link: the press lands on the estimate's sent view at the **Extend good-through** door (v2.5992's
 * panel, the one door), which the page scrolls to and hands the date field. Rule, words, tone and
 * address from `lib/estimates/estimateGoodThroughChip.ts`; the list table and the phone cards draw
 * it in place of the opened / never-opened chip.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { GOOD_THROUGH_PASSED_CHIP_COLORS, type GoodThroughPassedChip } from '../../lib/estimates/estimateGoodThroughChip'

const chipStyle: CSSProperties = {
  display: 'inline-block',
  background: GOOD_THROUGH_PASSED_CHIP_COLORS.bg,
  border: `1px solid ${GOOD_THROUGH_PASSED_CHIP_COLORS.border}`,
  color: GOOD_THROUGH_PASSED_CHIP_COLORS.fg,
  borderRadius: 999,
  padding: '0.1rem 0.55rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
}

export default function EstimateGoodThroughPassedChip({ chip, style }: { chip: GoodThroughPassedChip; style?: CSSProperties }) {
  return (
    <Link to={chip.href} title={chip.title} style={{ ...chipStyle, ...style }} data-testid="estimate-good-through-passed-chip">
      {chip.label}
    </Link>
  )
}
